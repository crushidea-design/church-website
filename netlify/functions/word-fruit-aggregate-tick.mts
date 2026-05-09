import type { Config } from '@netlify/functions';
import {
  admin,
  getAppDb,
  initializeFirebaseAdmin,
  jsonResponse,
} from './_shared/firebase-admin.mjs';

/* ────────────────────────── helpers ────────────────────────────────────── */

const krDateParts = (now = new Date()) => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
  };
};

/** ISO week id like 2026-W19 from a Date (UTC components). */
const getWeekId = (date: Date): string => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const currentWeekIdKst = (now = new Date()): string => {
  const { year, month, day } = krDateParts(now);
  // Build a UTC date that mirrors today's KST calendar date at noon.
  const d = new Date(Date.UTC(year, month - 1, day, 12));
  return getWeekId(d);
};

/* ────────────────────────── core logic ─────────────────────────────────── */

interface TickResult {
  ok: boolean;
  weekId: string;
  reason: 'NO_FRUIT' | 'NOT_PUBLISHED' | 'NO_PROGRESS' | 'UPDATED' | 'UNCHANGED';
  total?: number;
  completed?: number;
  growing?: number;
}

const runTick = async (now = new Date()): Promise<TickResult> => {
  const weekId = currentWeekIdKst(now);
  const db = getAppDb();
  const fruitRef = db.collection('next_generation_word_fruits').doc(weekId);
  const fruitSnap = await fruitRef.get();

  if (!fruitSnap.exists) return { ok: true, weekId, reason: 'NO_FRUIT' };
  const fruit = fruitSnap.data() as any;
  if (fruit.status !== 'published') return { ok: true, weekId, reason: 'NOT_PUBLISHED' };

  const progressSnap = await db
    .collection('next_generation_word_fruit_progress')
    .where('weekId', '==', weekId)
    .get();

  if (progressSnap.empty) return { ok: true, weekId, reason: 'NO_PROGRESS' };

  let total = 0;
  let completed = 0;
  let growing = 0;
  progressSnap.forEach((d) => {
    const data = d.data() as { checkCount?: number; completed?: boolean };
    total += 1;
    if (data.completed) completed += 1;
    else if ((data.checkCount ?? 0) > 0) growing += 1;
  });

  // Skip the write if numbers haven't changed — keep aggregateUpdatedAt stable.
  if (
    fruit.aggregateTotal === total &&
    fruit.aggregateCompleted === completed &&
    fruit.aggregateGrowing === growing
  ) {
    return { ok: true, weekId, reason: 'UNCHANGED', total, completed, growing };
  }

  // N-anonymity: hide raw numbers if the cohort is too small.
  // The pastor-set message stays untouched. We only fill placeholder when empty.
  const placeholder =
    total >= 5
      ? `우리 유초등부 ${total}명 중 ${completed}명이 이번 주 열매가 익었어요.`
      : '우리 유초등부의 말씀 열매가 자라고 있어요.';

  const updates: Record<string, unknown> = {
    aggregateTotal: total,
    aggregateCompleted: completed,
    aggregateGrowing: growing,
    aggregateUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (!fruit.aggregateMessage || typeof fruit.aggregateMessage !== 'string' || !fruit.aggregateMessage.trim()) {
    updates.aggregateMessage = placeholder;
  }

  await fruitRef.update(updates);
  return { ok: true, weekId, reason: 'UPDATED', total, completed, growing };
};

/* ────────────────────────── handler ────────────────────────────────────── */

export default async (_req: Request) => {
  if (!initializeFirebaseAdmin()) {
    return jsonResponse({ error: 'Firebase Admin not initialized' }, 500);
  }
  try {
    const result = await runTick();
    return jsonResponse(result);
  } catch (e) {
    console.error('word-fruit-aggregate-tick error:', e);
    return jsonResponse({ ok: false, error: String(e) }, 200);
  }
};

/**
 * Cron schedule (UTC). Daily 14:00 UTC = 23:00 KST.
 * Recomputes the public anonymous aggregate so the panel doesn't drift
 * from reality between manual pastor saves.
 */
export const config: Config = {
  schedule: '0 14 * * *',
};
