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
      const token = await getToken(activeMessaging, {
        vapidKey: VAPID_KEY
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
          console.log('Token already exists in Firestore');
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

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
