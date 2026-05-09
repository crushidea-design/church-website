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

const PROGRESS_COLLECTION = 'next_generation_word_fruit_progress';

/** Compute today's YYYY-MM-DD in Asia/Seoul. */
const todayKeyKr = (now = new Date()): string => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(now);
};

/** Day of week (0=Sun..6=Sat) in Asia/Seoul. */
const dayOfWeekKr = (now = new Date()): number => {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' });
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(fmt.format(now));
};

const fruitStageOf = (count: number): 0 | 1 | 2 | 3 => {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return 3;
};

/**
 * After a successful check, notify linked parents (in-app + FCM).
 * Best-effort: failures are logged but never block the check response.
 */
const notifyLinkedParents = async (
  childUid: string,
  childName: string,
  count: number,
  completed: boolean,
): Promise<void> => {
  const db = getAppDb();
  const parentSnap = await db
    .collection('next_generation_members')
    .where('department', '==', '학부모')
    .where('role', '==', 'member')
    .where('childIds', 'array-contains', childUid)
    .get();

  const parentUids = parentSnap.docs
    .map((d) => (d.data() as any).uid)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);
  if (parentUids.length === 0) return;

  const name = childName || '자녀';
  const body = completed
    ? `${name} — 이번 주 말씀 열매가 모두 익었어요! 🎉`
    : `${name} — 오늘도 작은 순종을 실천했어요. (${Math.min(count, 3)}/3)`;

  await createInAppNotifications(parentUids, body);

  const tokens = await getActiveTokensForUserIds(parentUids);
  if (tokens.length === 0) return;
  const baseMessage = buildNotificationMessage({
    title: '자녀 말씀 열매',
    body,
    targetUrl: '/next/elementary?highlight=word-fruit',
    appScope: 'next',
  });
  await sendMulticastInChunks(baseMessage, tokens);
};

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!initializeFirebaseAdmin()) {
    return jsonResponse({ error: 'Firebase Admin not initialized' }, 500);
  }

  const decoded = await verifyRequestUser(req).catch(() => null);
  if (!decoded) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  const body = await req.json().catch(() => null);
  const weekId = typeof body?.weekId === 'string' ? body.weekId.trim() : '';
  if (!weekId) {
    return jsonResponse({ error: 'weekId required' }, 400);
  }

  // Sunday is reserved for receiving the new word fruit; checks paused.
  if (dayOfWeekKr() === 0) {
    return jsonResponse({ error: 'CHECK_NOT_ALLOWED_SUNDAY', message: '주일은 새 말씀 열매를 받는 날이에요.' }, 400);
  }

  const today = todayKeyKr();
  const docId = `${weekId}__${decoded.uid}`;
  const db = getAppDb();
  const ref = db.collection(PROGRESS_COLLECTION).doc(docId);

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new Error('PROGRESS_NOT_FOUND');
      }
      const data = snap.data() as {
        userId: string;
        weekId: string;
        childName?: string;
        checkCount: number;
        checkedDates: string[];
      };
      if (data.userId !== decoded.uid) {
        throw new Error('FORBIDDEN');
      }
      const dates = Array.isArray(data.checkedDates) ? data.checkedDates : [];
      if (dates.includes(today)) {
        throw new Error('ALREADY_CHECKED_TODAY');
      }
      const nextCount = (data.checkCount ?? 0) + 1;
      const nextDates = [...dates, today];
      tx.update(ref, {
        checkCount: nextCount,
        checkedDates: nextDates,
        fruitStage: fruitStageOf(nextCount),
        completed: nextCount >= 3,
        lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { count: nextCount, dates: nextDates, childName: data.childName ?? '' };
    });

    // Fire-and-forget parent notification (don't block check response on failure)
    notifyLinkedParents(decoded.uid, result.childName, result.count, result.count >= 3).catch(
      (err) => console.error('notifyLinkedParents failed:', err),
    );

    return jsonResponse({ success: true, count: result.count, dates: result.dates });
  } catch (e: any) {
    const code = String(e?.message ?? e);
    if (code === 'PROGRESS_NOT_FOUND') {
      return jsonResponse({ error: code, message: '이번 주 작은 순종이 등록되지 않았어요.' }, 404);
    }
    if (code === 'FORBIDDEN') {
      return jsonResponse({ error: code }, 403);
    }
    if (code === 'ALREADY_CHECKED_TODAY') {
      return jsonResponse({ error: code, message: '오늘은 이미 열매를 돌보았어요.' }, 409);
    }
    console.error('word-fruit-check failed:', e);
    return jsonResponse({ error: 'INTERNAL', message: '체크 중 오류가 발생했습니다.' }, 500);
  }
};

export const config: Config = {
  path: '/api/word-fruit/check',
};
