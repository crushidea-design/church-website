import type { Config } from '@netlify/functions';
import { admin, getAppDb, initializeFirebaseAdmin, jsonResponse, requireAdmin } from './_shared/firebase-admin.mjs';

export default async (req: Request) => {
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const adminInitialized = initializeFirebaseAdmin();

  const adminCheck = await requireAdmin(req).catch(() => ({
    response: jsonResponse({ error: 'Authentication required' }, 401),
  }));
  if (adminCheck.response) return adminCheck.response;

  if (!adminInitialized) {
    return jsonResponse({
      ok: false,
      adminInitialized: false,
      messagingAvailable: false,
      firestoreReachable: false,
      activeTokenCount: 0,
      error: 'FIREBASE_SERVICE_ACCOUNT_KEY가 설정되지 않았습니다.',
    });
  }

  let firestoreReachable = false;
  let activeTokenCount = 0;
  let messagingAvailable = false;

  try {
    const db = getAppDb();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const snap = await db.collection('fcm_tokens').where('updatedAt', '>=', cutoff).count().get();
    activeTokenCount = snap.data().count;
    firestoreReachable = true;
  } catch (error) {
    console.error('Firestore health check failed:', error);
  }

  try {
    // messaging() 호출 자체가 초기화 검증
    admin.messaging();
    messagingAvailable = true;
  } catch {
    // messaging 초기화 실패
  }

  return jsonResponse({
    ok: firestoreReachable && messagingAvailable,
    adminInitialized,
    messagingAvailable,
    firestoreReachable,
    activeTokenCount,
  });
};

export const config: Config = {
  path: '/api/notifications/health',
};
