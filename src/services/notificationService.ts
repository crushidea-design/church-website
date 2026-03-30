import { messaging, db } from '../lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { collection, addDoc, query, where, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';

const VAPID_KEY = "BOC9xmFZn7oC6uplUAEFVDpxYkz-NuOsd2aDJng_9hc"; // This is often the same as the web verification key or a separate one.
// User will need to provide their VAPID key from Firebase Console -> Project Settings -> Cloud Messaging -> Web configuration -> Web Push certificates

export const requestNotificationPermission = async (userId: string) => {
  if (!messaging) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY
      });

      if (token) {
        // Store token in Firestore
        const tokensRef = collection(db, 'fcm_tokens');
        const q = query(tokensRef, where('token', '==', token));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          await addDoc(tokensRef, {
            userId,
            token,
            updatedAt: serverTimestamp()
          });
        }
        return token;
      }
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
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
