import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

declare const Netlify:
  | {
      env: {
        get: (key: string) => string | undefined;
      };
    }
  | undefined;

const ADMIN_EMAIL = 'crushidea@gmail.com';
const FIRESTORE_DATABASE_ID = 'ai-studio-718ae15e-9471-4be1-ad56-c48181aa8613';
const ACTIVE_TOKEN_DAYS = 30;
const FCM_MULTICAST_LIMIT = 500;
const FIRESTORE_IN_LIMIT = 30;

type ServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

type NotificationPayload = {
  title: string;
  body: string;
  targetUrl?: string;
  imageUrl?: string;
  appScope?: string;
  badgeCount?: number;
};

const getEnv = (key: string) => {
  const netlifyValue = typeof Netlify !== 'undefined' ? Netlify.env.get(key) : undefined;
  return netlifyValue || process.env[key];
};

const robustParse = (input: string): ServiceAccount | null => {
  try {
    const parsed = JSON.parse(input);
    if (typeof parsed === 'string') return robustParse(parsed);
    if (typeof parsed === 'object' && parsed !== null) return parsed;
  } catch {
    if (input.includes('\\"')) {
      const unescaped = input.replace(/\\"/g, '"').replace(/\\n/g, '\n');
      const parsed = robustParse(unescaped);
      if (parsed) return parsed;
    }

    const firstBrace = input.indexOf('{');
    const lastBrace = input.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return robustParse(input.substring(firstBrace, lastBrace + 1));
    }
  }

  return null;
};

const parseServiceAccount = (rawKey: string): ServiceAccount | null => {
  const trimmed = rawKey.trim();
  return robustParse(trimmed) || robustParse(Buffer.from(trimmed, 'base64').toString('utf8'));
};

export const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const initializeFirebaseAdmin = () => {
  if (admin.apps.length > 0) return true;

  const rawKey = getEnv('FIREBASE_SERVICE_ACCOUNT_KEY');
  if (!rawKey) return false;

  const serviceAccount = parseServiceAccount(rawKey);
  if (!serviceAccount?.project_id) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not a valid service account JSON.');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });

  return true;
};

export const getAppDb = () => getFirestore(FIRESTORE_DATABASE_ID);

export const verifyRequestUser = async (req: Request) => {
  const authHeader = req.headers.get('authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!idToken) return null;
  return admin.auth().verifyIdToken(idToken);
};

export const requireAdmin = async (req: Request) => {
  const decoded = await verifyRequestUser(req);
  if (!decoded) return { response: jsonResponse({ error: 'Authentication required' }, 401) };

  if (decoded.email === ADMIN_EMAIL) {
    return { decoded };
  }

  const userDoc = await getAppDb().collection('users').doc(decoded.uid).get();
  if (userDoc.exists && userDoc.data()?.role === 'admin') {
    return { decoded };
  }

  return { response: jsonResponse({ error: 'Admin permission required' }, 403) };
};

export const buildNotificationMessage = ({ title, body, targetUrl = '/', imageUrl, appScope, badgeCount }: NotificationPayload) => ({
  notification: { title, body },
  data: {
    url: targetUrl,
    ...(appScope ? { appScope } : {}),
    ...(typeof badgeCount === 'number' ? { badgeCount: String(Math.max(0, Math.floor(badgeCount))) } : {}),
    ...(imageUrl ? { image: imageUrl } : {}),
  },
  webpush: {
    notification: {
      icon: '/pwa-icon-192-v7.png',
      badge: '/favicon-48x48-v7.png',
      vibrate: [100, 50, 100],
      ...(imageUrl ? { image: imageUrl } : {}),
    },
    fcm_options: { link: targetUrl },
  },
});

export const getActiveTokensForUserIds = async (userIds: string[]) => {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ACTIVE_TOKEN_DAYS);
  const tokenSet = new Set<string>();
  const db = getAppDb();

  for (let i = 0; i < uniqueUserIds.length; i += FIRESTORE_IN_LIMIT) {
    const chunk = uniqueUserIds.slice(i, i + FIRESTORE_IN_LIMIT);
    const snapshot = await db
      .collection('fcm_tokens')
      .where('userId', 'in', chunk)
      .where('updatedAt', '>=', cutoff)
      .get();

    snapshot.docs.forEach((doc) => {
      const token = doc.data().token;
      if (typeof token === 'string' && token.length > 0) {
        tokenSet.add(token);
      }
    });
  }

  return Array.from(tokenSet);
};

export const sendMulticastInChunks = async (baseMessage: any, tokens: string[]) => {
  const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < uniqueTokens.length; i += FCM_MULTICAST_LIMIT) {
    const response = await admin.messaging().sendEachForMulticast({
      ...baseMessage,
      tokens: uniqueTokens.slice(i, i + FCM_MULTICAST_LIMIT),
    });
    successCount += response.successCount;
    failureCount += response.failureCount;
  }

  return { successCount, failureCount };
};

export { admin };
