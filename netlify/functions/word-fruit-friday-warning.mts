import type { Config } from '@netlify/functions';
import {
  createInAppNotifications,
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
    weekday: 'short',
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: get('weekday'),
  };
};

const formatYmd = (d: Date) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

/** Returns the upcoming Sunday's YYYY-MM-DD in KST. If today is Sunday, returns today. */
const upcomingSundayKstKey = (now = new Date()): string => {
  const { year, month, day, weekday } = krDateParts(now);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = map[weekday] ?? 0;
  const offset = dow === 0 ? 0 : 7 - dow;
  const base = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + offset);
  return formatYmd(base);
};

const findPastorUids = async (): Promise<string[]> => {
  const db = getAppDb();
  const snap = await db
    .collection('next_generation_members')
    .where('role', '==', 'member')
    .where('isNextGenerationAdmin', '==', true)
    .get();
  return snap.docs.map((d) => (d.data() as any).uid).filter((u): u is string => !!u);
};

/* ────────────────────────── handler ────────────────────────────────────── */

export default async (_req: Request) => {
  if (!initializeFirebaseAdmin()) {
    return jsonResponse({ error: 'Firebase Admin not initialized' }, 500);
  }
  try {
    const sundayKey = upcomingSundayKstKey();
    const db = getAppDb();
    const snap = await db
      .collection('posts')
      .where('category', '==', 'next_generation')
      .where('subCategory', '==', 'elementary_script')
      .where('nextGenerationWeekKey', '==', sundayKey)
      .limit(1)
      .get();

    if (!snap.empty) {
      // Manuscript exists — no warning needed
      return jsonResponse({ ok: true, sundayKey, status: 'MANUSCRIPT_FOUND' });
    }

    const pastorUids = await findPastorUids();
    await createInAppNotifications(
      pastorUids,
      `다가오는 주일(${sundayKey}) 강의원고가 아직 게시되지 않았어요. 토요일 23시 자동 초안을 위해 그 전에 게시해 주세요.`,
    );

    return jsonResponse({
      ok: true,
      sundayKey,
      status: 'MANUSCRIPT_MISSING_NOTIFIED',
      pastorCount: pastorUids.length,
    });
  } catch (e) {
    console.error('word-fruit-friday-warning error:', e);
    return jsonResponse({ ok: false, error: String(e) }, 200);
  }
};

/**
 * Cron schedule (UTC). Friday 03:00 UTC = Friday 12:00 KST.
 * Gives the pastor ~36 hours to upload the manuscript before the Saturday
 * 23:00 KST auto-draft cron tries to read it.
 */
export const config: Config = {
  schedule: '0 3 * * 5',
};
