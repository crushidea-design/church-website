import { messaging, db, auth } from '../lib/firebase';
import { getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { handleNextGenerationBadgePayload } from './appBadgeService';

const VAPID_KEY = "BBpJh2G328v2gR5RIPIl4p4clTa5WEQFRzlufKWGiB2EfositXsJQHaqME57pL0zzj_orvkl-zXFC3EJU_huFV4";
const TOKEN_SYNC_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const MAIN_NOTIFICATION_TOPIC = 'all_members';
export const NEXT_GENERATION_NOTIFICATION_TOPIC = 'next_members';

const getAuthHeaders = async () => {
  const idToken = await auth.currentUser?.getIdToken();
  return {
    'Content-Type': 'application/json',
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
  };
};

export const requestNotificationPermission = async (
  userId: string,
  options?: {
    topic?: string;
  }
) => {
  console.log('requestNotificationPermission called for user:', userId);

  if (typeof window === 'undefined') return null;

  // topic이 명시되지 않으면 토큰 등록만 하고 구독은 건너뜀
  const topic = options?.topic ?? null;
  const topicCacheKey = topic ? topic.replace(/[^a-z0-9_-]/gi, '_').toLowerCase() : null;
  const unsubscribeTopics = topic === NEXT_GENERATION_NOTIFICATION_TOPIC ? [MAIN_NOTIFICATION_TOPIC] : [];

  const cachedToken = localStorage.getItem(`fcm_synced_${userId}`);
  const lastSyncedAt = Number(localStorage.getItem(`fcm_synced_at_${userId}`) || 0);
  const cachedTopicToken = topicCacheKey ? localStorage.getItem(`fcm_topic_synced_${userId}_${topicCacheKey}`) : null;
  const lastTopicSyncedAt = topicCacheKey ? Number(localStorage.getItem(`fcm_topic_synced_at_${userId}_${topicCacheKey}`) || 0) : 0;

  try {
    if (!('Notification' in window)) {
      console.warn('Notification API not supported in this browser.');
      return null;
    }

    const permission = await Notification.requestPermission();
    console.log('Notification permission status:', permission);

    if (permission === 'granted') {
      const supported = await isSupported();
      if (!supported) {
        console.warn('Firebase Messaging is not supported in this browser after notification permission was granted.');
        return null;
      }

      let activeMessaging = messaging;
      if (!activeMessaging) {
        console.log('Messaging not yet initialized, waiting...');
        for (let i = 0; i < 30; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          activeMessaging = (window as any).firebase_messaging || messaging;
          if (activeMessaging) break;
        }
      }

      if (!activeMessaging) {
        console.error('Messaging failed to initialize');
        return null;
      }

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

        const tokenRecentlySynced = cachedToken === token && Date.now() - lastSyncedAt < TOKEN_SYNC_TTL_MS;
        if (!tokenRecentlySynced) {
          const tokenDocId = btoa(token).replace(/[^a-zA-Z0-9]/g, '').slice(0, 120);
          await setDoc(doc(db, 'fcm_tokens', tokenDocId), {
            userId: userId || 'anonymous',
            token,
            updatedAt: serverTimestamp()
          }, { merge: true });
          console.log('Token synced to Firestore');
          localStorage.setItem(`fcm_synced_${userId}`, token);
          localStorage.setItem(`fcm_synced_at_${userId}`, String(Date.now()));
        } else {
          console.log('Token already synced to Firestore recently');
        }

        const topicRecentlySynced = topicCacheKey
          ? cachedTopicToken === token && Date.now() - lastTopicSyncedAt < TOKEN_SYNC_TTL_MS
          : false;
        let subscribedToTopic = false;

        if (topic && topicCacheKey && !topicRecentlySynced) {
          try {
            await Promise.all(
              unsubscribeTopics.map(async (topicToRemove) => {
                const topicToRemoveCacheKey = topicToRemove.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
                const unsubscribeResponse = await fetch('/api/notifications/subscribe', {
                  method: 'POST',
                  headers: await getAuthHeaders(),
                  body: JSON.stringify({ token, topic: topicToRemove, action: 'unsubscribe' })
                });

                if (!unsubscribeResponse.ok) {
                  throw new Error(`Topic unsubscribe failed with status ${unsubscribeResponse.status}`);
                }

                localStorage.removeItem(`fcm_topic_synced_${userId}_${topicToRemoveCacheKey}`);
                localStorage.removeItem(`fcm_topic_synced_at_${userId}_${topicToRemoveCacheKey}`);
              })
            );

            const subscribeResponse = await fetch('/api/notifications/subscribe', {
              method: 'POST',
              headers: await getAuthHeaders(),
              body: JSON.stringify({ token, topic, action: 'subscribe' })
            });

            if (!subscribeResponse.ok) {
              throw new Error(`Topic subscription failed with status ${subscribeResponse.status}`);
            }

            subscribedToTopic = true;
            console.log(`Subscribed to ${topic} topic`);
          } catch (subError) {
            console.error('Failed to subscribe to topic:', subError);
          }
        } else if (topic && topicCacheKey && topicRecentlySynced) {
          subscribedToTopic = true;
          console.log(`Topic already synced recently for ${topic}`);
        }

        if (subscribedToTopic && topicCacheKey) {
          localStorage.setItem(`fcm_topic_synced_${userId}_${topicCacheKey}`, token);
          localStorage.setItem(`fcm_topic_synced_at_${userId}_${topicCacheKey}`, String(Date.now()));
        }

        return token;
      }

      console.warn('No FCM token received. Check if VAPID key is correct and service worker is registered.');
    } else {
      console.warn('Notification permission denied by user');
    }
  } catch (error) {
    console.error('Error in requestNotificationPermission:', error);
  }

  return null;
};

let messageListenerUnsubscribe: (() => void) | null = null;
const activeCallbacks: Set<(payload: any) => void> = new Set();

export const onMessageListener = (callback: (payload: any) => void) => {
  const activeMessaging = (window as any).firebase_messaging || messaging;
  if (!activeMessaging) {
    console.warn('Messaging not initialized yet for onMessageListener');
    return () => {};
  }

  activeCallbacks.add(callback);

  if (!messageListenerUnsubscribe) {
    messageListenerUnsubscribe = onMessage(activeMessaging, (payload) => {
      void handleNextGenerationBadgePayload(payload);
      activeCallbacks.forEach((cb) => cb(payload));
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

export const sendPushNotification = async (
  title: string,
  body: string,
  targetUrl: string = '/',
  targetUserIds?: string[],
  options?: {
    topic?: string;
    appScope?: string;
    badgeCount?: number;
    imageUrl?: string;
  }
) => {
  try {
    const response = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        title,
        body,
        targetUrl,
        imageUrl: options?.imageUrl,
        targetUserIds,
        useTopic: !targetUserIds || targetUserIds.length === 0 ? (options?.topic || MAIN_NOTIFICATION_TOPIC) : false,
        appScope: options?.appScope,
        badgeCount: options?.badgeCount,
      }),
    });

    return await response.json();
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error: '?뚮┝ 諛쒖넚 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.' };
  }
};
