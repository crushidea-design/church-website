importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// This will be replaced by the actual config during build or we can fetch it
// For now, we'll use a placeholder or the user can manually update it
// Actually, in this environment, I can read the config and inject it.

// I'll use a generic handler first.
firebase.initializeApp({
  apiKey: "REDACTED",
  authDomain: "ais-dev-v47rikjpj2fqleu63x4mrp.firebaseapp.com",
  projectId: "ais-dev-v47rikjpj2fqleu63x4mrp",
  storageBucket: "ais-dev-v47rikjpj2fqleu63x4mrp.firebasestorage.app",
  messagingSenderId: "638399109645",
  appId: "1:638399109645:web:8664188448987484d720f1"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/pwa-icon-192-v6.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
