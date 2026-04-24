type BadgeCapableNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

const NEXT_GENERATION_BADGE_CACHE = 'next-generation-app-badge';
const NEXT_GENERATION_BADGE_CACHE_KEY = '/__next_generation__/badge-count';
const NEXT_GENERATION_BADGE_STORAGE_KEY = 'next_generation_badge_count';
const NEXT_GENERATION_BADGE_SCOPE = 'next';

const normalizeBadgeCount = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
};

const getBadgeNavigator = () => {
  if (typeof navigator === 'undefined') return null;
  return navigator as BadgeCapableNavigator;
};

const storeBadgeCountInLocalStorage = (count: number) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(NEXT_GENERATION_BADGE_STORAGE_KEY, String(count));
  } catch (error) {
    console.warn('Unable to persist badge count in localStorage:', error);
  }
};

const readBadgeCountFromLocalStorage = () => {
  if (typeof window === 'undefined') return 0;
  try {
    return normalizeBadgeCount(window.localStorage.getItem(NEXT_GENERATION_BADGE_STORAGE_KEY));
  } catch (error) {
    console.warn('Unable to read badge count from localStorage:', error);
    return 0;
  }
};

const writeBadgeCountToCache = async (count: number) => {
  if (typeof caches === 'undefined') return count;
  try {
    const cache = await caches.open(NEXT_GENERATION_BADGE_CACHE);
    await cache.put(
      NEXT_GENERATION_BADGE_CACHE_KEY,
      new Response(JSON.stringify({ count }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
  } catch (error) {
    console.warn('Unable to persist badge count in Cache Storage:', error);
  }

  return count;
};

export const readNextGenerationBadgeCount = async () => {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(NEXT_GENERATION_BADGE_CACHE);
      const response = await cache.match(NEXT_GENERATION_BADGE_CACHE_KEY);
      if (response) {
        const data = await response.json().catch(() => null);
        const cachedCount = normalizeBadgeCount(data?.count);
        storeBadgeCountInLocalStorage(cachedCount);
        return cachedCount;
      }
    } catch (error) {
      console.warn('Unable to read badge count from Cache Storage:', error);
    }
  }

  return readBadgeCountFromLocalStorage();
};

const applyAppBadge = async (count: number) => {
  const badgeNavigator = getBadgeNavigator();
  if (!badgeNavigator) return;

  try {
    if (count > 0 && typeof badgeNavigator.setAppBadge === 'function') {
      await badgeNavigator.setAppBadge(count);
      return;
    }

    if (typeof badgeNavigator.clearAppBadge === 'function') {
      await badgeNavigator.clearAppBadge();
    }
  } catch (error) {
    console.warn('Unable to update app badge:', error);
  }
};

const broadcastBadgeCount = (count: number) => {
  if (typeof BroadcastChannel === 'undefined') return;

  try {
    const channel = new BroadcastChannel('next-generation-badge');
    channel.postMessage({ type: 'next-generation-badge-update', count });
    channel.close();
  } catch (error) {
    console.warn('Unable to broadcast badge update:', error);
  }
};

export const setNextGenerationBadgeCount = async (count: number, broadcast = true) => {
  const normalizedCount = normalizeBadgeCount(count);
  storeBadgeCountInLocalStorage(normalizedCount);
  await writeBadgeCountToCache(normalizedCount);
  await applyAppBadge(normalizedCount);

  if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'next-generation-badge-update',
      count: normalizedCount,
    });
  }

  if (broadcast) {
    broadcastBadgeCount(normalizedCount);
  }

  return normalizedCount;
};

export const clearNextGenerationBadge = async () => {
  await setNextGenerationBadgeCount(0);
};

export const incrementNextGenerationBadgeCount = async (step = 1) => {
  const currentCount = await readNextGenerationBadgeCount();
  return setNextGenerationBadgeCount(currentCount + Math.max(1, normalizeBadgeCount(step) || 1));
};

export const syncNextGenerationBadgeFromStorage = async () => {
  const storedCount = await readNextGenerationBadgeCount();
  await applyAppBadge(storedCount);
  return storedCount;
};

const resolveNotificationUrl = (payload: any) =>
  payload?.data?.url || payload?.fcmOptions?.link || payload?.notification?.click_action || '';

export const isNextGenerationNotificationPayload = (payload: any) => {
  const appScope = payload?.data?.appScope;
  if (appScope === NEXT_GENERATION_BADGE_SCOPE) {
    return true;
  }

  const url = resolveNotificationUrl(payload);
  return typeof url === 'string' && url.startsWith('/next');
};

export const extractBadgeCountFromPayload = (payload: any) => {
  if (!payload?.data || !Object.prototype.hasOwnProperty.call(payload.data, 'badgeCount')) {
    return null;
  }

  return normalizeBadgeCount(payload.data.badgeCount);
};

export const handleNextGenerationBadgePayload = async (payload: any) => {
  if (!isNextGenerationNotificationPayload(payload)) {
    return readNextGenerationBadgeCount();
  }

  const explicitBadgeCount = extractBadgeCountFromPayload(payload);
  if (explicitBadgeCount !== null) {
    return setNextGenerationBadgeCount(explicitBadgeCount);
  }

  return incrementNextGenerationBadgeCount();
};

export const initializeNextGenerationBadgeSync = () => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  void syncNextGenerationBadgeFromStorage();

  const handleServiceWorkerMessage = (event: MessageEvent) => {
    if (event.data?.type !== 'next-generation-badge-update') {
      return;
    }

    void setNextGenerationBadgeCount(event.data.count, false);
  };

  navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

  let channel: BroadcastChannel | null = null;
  const handleBroadcast = (event: MessageEvent) => {
    if (event.data?.type !== 'next-generation-badge-update') {
      return;
    }

    void setNextGenerationBadgeCount(event.data.count, false);
  };

  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('next-generation-badge');
    channel.addEventListener('message', handleBroadcast);
  }

  return () => {
    navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    if (channel) {
      channel.removeEventListener('message', handleBroadcast);
      channel.close();
    }
  };
};
