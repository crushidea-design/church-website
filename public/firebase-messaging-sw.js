importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// This will be replaced by the actual config during build or we can fetch it
// For now, we'll use a placeholder or the user can manually update it
// Actually, in this environment, I can read the config and inject it.

// I'll use a generic handler first.
firebase.initializeApp({
  apiKey: "AIzaSyBe4AUkbqJepdMbq-3-6WcVTnwBfH4Lg9U",
  authDomain: "gen-lang-client-0036445484.firebaseapp.com",
  projectId: "gen-lang-client-0036445484",
  storageBucket: "gen-lang-client-0036445484.firebasestorage.app",
  messagingSenderId: "638399109645",
  appId: "1:638399109645:web:26e54039ac88c438765344"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // FCM automatically shows a notification if the payload contains a 'notification' object.
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.FCM_MSG?.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with this URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
