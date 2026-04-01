import { messaging, db } from '../lib/firebase';
import { getToken, onMessage, isSupported } from 'firebase/messaging';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

// IMPORTANT: This VAPID key must be replaced with the one from your Firebase Console
// Project Settings -> Cloud Messaging -> Web configuration -> Web Push certificates
const VAPID_KEY = "BBpJh2G328v2gR5RIPIl4p4clTa5WEQFRzlufKWGiB2EfositXsJQHaqME57pL0zzj_orvkl-zXFC3EJU_huFV4"; 

export const requestNotificationPermission = async (userId: string) => {
  console.log('requestNotificationPermission called for user:', userId);
  
  if (typeof window === 'undefined') return null;

  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('Notifications are not supported in this browser');
      return null;
    }

    // Check if Notification API is available (it might not be in some iOS browsers if not PWA)
    if (!('Notification' in window)) {
      console.warn('Notification API not supported in this browser.');
      return null;
    }

    const permission = await Notification.requestPermission();
    console.log('Notification permission status:', permission);
    
    if (permission === 'granted') {
      // Ensure messaging is initialized
      let activeMessaging = messaging;
      if (!activeMessaging) {
        console.log('Messaging not yet initialized, waiting...');
        // Wait up to 3 seconds for messaging to initialize
        for (let i = 0; i < 30; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          activeMessaging = (window as any).firebase_messaging || messaging;
          if (activeMessaging) break;
        }
      }

      if (!activeMessaging) {
        console.error('Messaging failed to initialize');
        return null;
      }

      console.log('Attempting to get FCM token with VAPID key...');
      
      // Register service worker manually if needed before getting token
      let swRegistration = null;
      try {
        swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service Worker registered for FCM:', swRegistration.scope);
      } catch (swError) {
        console.error('Service Worker registration failed:', swError);
      }

      const token = await getToken(activeMessaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swRegistration || undefined
      });

      if (token) {
        console.log('FCM Token generated:', token.substring(0, 10) + '...');
        // Store token in Firestore
        const tokensRef = collection(db, 'fcm_tokens');
        const q = query(tokensRef, where('token', '==', token));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          console.log('Saving new token to Firestore...');
          await addDoc(tokensRef, {
            userId,
            token,
            updatedAt: serverTimestamp()
          });
          console.log('Token saved successfully');
        } else {
          console.log('Token already exists in Firestore, updating updatedAt...');
          const docId = snapshot.docs[0].id;
          const { updateDoc, doc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'fcm_tokens', docId), {
            updatedAt: serverTimestamp(),
            userId // Update userId in case it changed (e.g. logged in)
          });
          console.log('Token updatedAt refreshed');
        }
        return token;
      } else {
        console.warn('No FCM token received. Check if VAPID key is correct and service worker is registered.');
      }
    } else {
      console.warn('Notification permission denied by user');
    }
  } catch (error) {
    console.error('Error in requestNotificationPermission:', error);
  }
  return null;
};

let messageListenerUnsubscribe: (() => void) | null = null;
let activeCallbacks: Set<(payload: any) => void> = new Set();

export const onMessageListener = (callback: (payload: any) => void) => {
  const activeMessaging = (window as any).firebase_messaging || messaging;
  if (!activeMessaging) {
    console.warn('Messaging not initialized yet for onMessageListener');
    return () => {};
  }
  
  activeCallbacks.add(callback);

  if (!messageListenerUnsubscribe) {
    messageListenerUnsubscribe = onMessage(activeMessaging, (payload) => {
      activeCallbacks.forEach(cb => cb(payload));
    });
  }
  
  return () => {
    activeCallbacks.delete(callback);
    if (activeCallbacks.size === 0 && messageListenerUnsubscribe) {
      messageListenerUnsubscribe();
      messageListenerUnsubscribe = null;
    }
  };
};

export const sendPushNotification = async (title: string, body: string, targetUrl: string = '/', targetUserIds?: string[]) => {
  try {
    // Optimization: Only fetch tokens updated in the last 30 days to reduce read costs
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Fetch tokens from Firestore
    const tokensRef = collection(db, 'fcm_tokens');
    const q = query(tokensRef, where('updatedAt', '>=', thirtyDaysAgo));
    const snapshot = await getDocs(q);
    
    let allTokens = snapshot.docs.map(doc => doc.data());
    
    // Filter by targetUserIds if provided
    if (targetUserIds && targetUserIds.length > 0) {
      allTokens = allTokens.filter(t => targetUserIds.includes(t.userId));
    }
    
    const tokens = Array.from(new Set(allTokens.map(t => t.token)));

    if (tokens.length === 0) {
      console.log('No matching FCM tokens found in Firestore');
      return { success: false, error: '수신 가능한 기기가 없습니다.' };
    }

    const response = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        title, 
        body, 
        targetUrl, 
        targetTokens: tokens 
      }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error: '알림 발송 중 오류가 발생했습니다.' };
  }
};
