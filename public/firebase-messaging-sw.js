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
const NEXT_GENERATION_BADGE_CACHE = 'next-generation-app-badge';
const NEXT_GENERATION_BADGE_CACHE_KEY = '/__next_generation__/badge-count';

const normalizeBadgeCount = (value) => {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return parsed;
};

const resolveNotificationUrl = (payload) =>
  payload?.data?.url || payload?.fcmOptions?.link || payload?.notification?.click_action || '/';

const isNextGenerationPayload = (payload) => {
  if (payload?.data?.appScope === 'next') {
    return true;
  }

  const url = resolveNotificationUrl(payload);
  return typeof url === 'string' && url.startsWith('/next');
};

const readStoredBadgeCount = async () => {
  try {
    const cache = await caches.open(NEXT_GENERATION_BADGE_CACHE);
    const response = await cache.match(NEXT_GENERATION_BADGE_CACHE_KEY);
    if (!response) {
      return 0;
    }

    const data = await response.json().catch(() => null);
    return normalizeBadgeCount(data?.count);
  } catch (error) {
    console.warn('[firebase-messaging-sw.js] Failed to read badge count', error);
    return 0;
  }
};

const writeStoredBadgeCount = async (count) => {
  const normalizedCount = normalizeBadgeCount(count);

  try {
    const cache = await caches.open(NEXT_GENERATION_BADGE_CACHE);
    await cache.put(
      NEXT_GENERATION_BADGE_CACHE_KEY,
      new Response(JSON.stringify({ count: normalizedCount }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
  } catch (error) {
    console.warn('[firebase-messaging-sw.js] Failed to write badge count', error);
  }

  return normalizedCount;
};

const applyAppBadge = async (count) => {
  try {
    if (count > 0 && typeof self.navigator?.setAppBadge === 'function') {
      await self.navigator.setAppBadge(count);
      return;
    }

    if (typeof self.navigator?.clearAppBadge === 'function') {
      await self.navigator.clearAppBadge();
    }
  } catch (error) {
    console.warn('[firebase-messaging-sw.js] Failed to update app badge', error);
  }
};

const notifyClientsOfBadgeUpdate = async (count) => {
  const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  windowClients.forEach((client) => {
    client.postMessage({
      type: 'next-generation-badge-update',
      count,
    });
  });
};

const resolveBadgeCountFromPayload = (payload) => {
  if (!payload?.data || !Object.prototype.hasOwnProperty.call(payload.data, 'badgeCount')) {
    return null;
  }

  return normalizeBadgeCount(payload.data.badgeCount);
};

const updateNextGenerationBadge = async (payload) => {
  if (!isNextGenerationPayload(payload)) {
    return 0;
  }

  const explicitBadgeCount = resolveBadgeCountFromPayload(payload);
  const nextBadgeCount = explicitBadgeCount !== null ? explicitBadgeCount : (await readStoredBadgeCount()) + 1;
  const storedBadgeCount = await writeStoredBadgeCount(nextBadgeCount);

  await applyAppBadge(storedBadgeCount);
  await notifyClientsOfBadgeUpdate(storedBadgeCount);

  return storedBadgeCount;
};

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const badgeUpdatePromise = updateNextGenerationBadge(payload);
  
  // If the payload has a notification object, FCM will automatically show it.
  // However, to ensure our custom options are applied (especially for data-only messages),
  // we can manually call showNotification if it's a data message.
  if (!payload.notification && payload.data) {
    const notificationTitle = payload.data.title || '새로운 알림';
    const notificationOptions = {
      body: payload.data.body || '',
      icon: '/pwa-icon-192-v7.png',
      badge: '/favicon-48x48-v7.png',
      vibrate: [100, 50, 100],
      data: {
        url: payload.data.url || '/',
        badgeCount: payload.data.badgeCount || null,
        appScope: payload.data.appScope || null,
      }
    };

    if (payload.data.image) {
      notificationOptions.image = payload.data.image;
    }

    return Promise.all([
      badgeUpdatePromise,
      self.registration.showNotification(notificationTitle, notificationOptions),
    ]);
  }

  return badgeUpdatePromise;
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Extract URL from various possible payload structures
  let urlToOpen = '/';
  if (event.notification.data?.url) {
    urlToOpen = event.notification.data.url;
  } else if (event.notification.data?.FCM_MSG?.data?.url) {
    urlToOpen = event.notification.data.FCM_MSG.data.url;
  }

  // If it's a relative URL, make it absolute
  if (urlToOpen.startsWith('/')) {
    urlToOpen = self.location.origin + urlToOpen;
  }

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

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'next-generation-badge-update') {
    return;
  }

  const count = normalizeBadgeCount(event.data.count);
  event.waitUntil(
    writeStoredBadgeCount(count).then(() => applyAppBadge(count))
  );
});
