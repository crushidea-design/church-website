import type { Config } from '@netlify/functions';
import {
  admin,
  buildNotificationMessage,
  createInAppNotifications,
  getActiveTokensForUserIds,
  getAppDb,
  initializeFirebaseAdmin,
  jsonResponse,
  sendMulticastInChunks,
  verifyRequestUser,
} from './_shared/firebase-admin.mjs';

const ADMIN_EMAIL = 'crushidea@gmail.com';

const ensureNextGenerationPastor = async (uid: string, email: string | undefined) => {
  if (email === ADMIN_EMAIL) return true;
  const snap = await getAppDb().collection('next_generation_members').doc(uid).get();
  if (!snap.exists) return false;
  const data = snap.data() as { role?: string; isNextGenerationAdmin?: boolean };
  return data.role === 'member' && data.isNextGenerationAdmin === true;
};

const fetchElementaryMemberUids = async (): Promise<string[]> => {
  const db = getAppDb();
  const out = new Set<string>();
  for (const department of ['학생', '학부모', '교사']) {
    const snap = await db
      .collection('next_generation_members')
      .where('department', '==', department)
      .where('role', '==', 'member')
      .get();
    snap.docs.forEach((d) => {
      const data = d.data() as { uid?: string };
      if (data.uid) out.add(data.uid);
    });
  }
  return Array.from(out);
};

export default async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  if (!initializeFirebaseAdmin()) {
    return jsonResponse({ error: 'Firebase Admin not initialized' }, 500);
  }

  const decoded = await verifyRequestUser(req).catch(() => null);
  if (!decoded) return jsonResponse({ error: 'Authentication required' }, 401);

  if (!(await ensureNextGenerationPastor(decoded.uid, decoded.email))) {
    return jsonResponse({ error: 'Pastor permission required' }, 403);
  }

  const body = await req.json().catch(() => null);
  const weekId = typeof body?.weekId === 'string' ? body.weekId.trim() : '';
  if (!weekId) return jsonResponse({ error: 'weekId required' }, 400);

  const fruitSnap = await getAppDb().collection('next_generation_word_fruits').doc(weekId).get();
  if (!fruitSnap.exists) return jsonResponse({ error: 'FRUIT_NOT_FOUND' }, 404);
  const fruit = fruitSnap.data() as { title?: string; status?: string };
  if (fruit.status !== 'published') {
    return jsonResponse({ error: 'NOT_PUBLISHED', message: '게시 후 알림을 보낼 수 있습니다.' }, 400);
  }

  const targets = await fetchElementaryMemberUids();
  const title = '이번 주 말씀 열매';
  const messageBody = `${fruit.title || ''} — 한 주 동안 작은 순종을 함께 실천해 보아요.`;

  await createInAppNotifications(targets, messageBody);

  const tokens = await getActiveTokensForUserIds(targets);
  let fcmResult = { successCount: 0, failureCount: 0 };
  if (tokens.length > 0) {
    const baseMessage = buildNotificationMessage({
      title,
      body: messageBody,
      targetUrl: '/next/elementary?highlight=word-fruit',
      appScope: 'next',
    });
    fcmResult = await sendMulticastInChunks(baseMessage, tokens);
  }

  return jsonResponse({
    success: true,
    inAppCount: targets.length,
    fcmTokenCount: tokens.length,
    ...fcmResult,
  });
};

export const config: Config = {
  path: '/api/word-fruit/notify-publish',
};
