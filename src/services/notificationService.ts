import { messaging, db, auth } from '../lib/firebase';
import { getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// IMPORTANT: This VAPID key must be replaced with the one from your Firebase Console
// Project Settings -> Cloud Messaging -> Web configuration -> Web Push certificates
const VAPID_KEY = "BBpJh2G328v2gR5RIPIl4p4clTa5WEQFRzlufKWGiB2EfositXsJQHaqME57pL0zzj_orvkl-zXFC3EJU_huFV4"; 
const TOKEN_SYNC_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const getAuthHeaders = async () => {
  const idToken = await auth.currentUser?.getIdToken();
  return {
    'Content-Type': 'application/json',
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
  };
};

export const requestNotificationPermission = async (userId: string) => {
  console.log('requestNotificationPermission called for user:', userId);
  
  if (typeof window === 'undefined') return null;

  // [최적화 1] 로컬 캐시 확인: 이미 동기화된 토큰이면 DB 조회를 건너뜁니다.
  const cachedToken = localStorage.getItem(`fcm_synced_${userId}`);
  const lastSyncedAt = Number(localStorage.getItem(`fcm_synced_at_${userId}`) || 0);

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
        
        // Keep Firestore updated often enough for the 30-day active-device count.
        const tokenRecentlySynced = cachedToken === token && Date.now() - lastSyncedAt < TOKEN_SYNC_TTL_MS;
        if (tokenRecentlySynced) {
          console.log('Token already synced recently');
          return token;
        }

        const tokenDocId = btoa(token).replace(/[^a-zA-Z0-9]/g, '').slice(0, 120);
        await setDoc(doc(db, 'fcm_tokens', tokenDocId), {
          userId: userId || 'anonymous',
          token,
          updatedAt: serverTimestamp()
        }, { merge: true });
        console.log('Token synced to Firestore');

        // Subscribe to all_members topic for zero-read broadcasts
        let subscribedToTopic = false;
        try {
          const subscribeResponse = await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify({ token, topic: 'all_members' })
          });
          if (!subscribeResponse.ok) {
            throw new Error(`Topic subscription failed with status ${subscribeResponse.status}`);
          }
          subscribedToTopic = true;
          console.log('Subscribed to all_members topic');
        } catch (subError) {
          console.error('Failed to subscribe to topic:', subError);
        }

        // 동기화 완료 후 로컬에 기록 (다음번엔 읽기 발생 안 함)
        localStorage.setItem(`fcm_synced_${userId}`, token);
        if (subscribedToTopic) {
          localStorage.setItem(`fcm_synced_at_${userId}`, String(Date.now()));
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
    // [최적화 2] 클라이언트에서 토큰을 직접 getDocs하지 않습니다.
    // 대신 서버 API(/api/notifications/send)에 정보만 넘깁니다.
    
    const response = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ 
        title, 
        body, 
        targetUrl, 
        targetUserIds, // 토큰 대신 대상 ID만 보냄
        useTopic: !targetUserIds // 대상이 없으면 전체 토픽(all_members) 사용 요청
      }),
    });

    return await response.json();
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error: '알림 발송 중 오류가 발생했습니다.' };
  }
};
