import type { Config } from '@netlify/functions';
import {
  admin,
  createInAppNotifications,
  getAppDb,
  initializeFirebaseAdmin,
  jsonResponse,
} from './_shared/firebase-admin.mjs';

declare const Netlify:
  | { env: { get: (key: string) => string | undefined } }
  | undefined;

const getEnv = (key: string) =>
  (typeof Netlify !== 'undefined' ? Netlify.env.get(key) : undefined) || process.env[key];

/* ────────────────────────── date helpers (Asia/Seoul) ───────────────────── */

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
    weekday: get('weekday'), // 'Sat', 'Sun', etc.
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
  const offset = dow === 0 ? 0 : 7 - dow; // days until Sunday (KST)
  // Build a UTC date that represents (KST date) at noon and add offset days.
  const base = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + offset);
  return formatYmd(base);
};

/** ISO week id like 2026-W19 from a Date. */
const getWeekId = (date: Date): string => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

/** Sunday YYYY-MM-DD → fruit weekId (the following Mon-Sat ISO week). */
const fruitWeekIdFromSundayKey = (sundayKey: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sundayKey);
  if (!m) return '';
  const monday = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  return getWeekId(monday);
};

const addDaysIso = (sundayKey: string, days: number): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sundayKey);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return formatYmd(d);
};

/* ────────────────────────── Gemini prompt ───────────────────────────────── */

const AI_PROMPT_HEADER = `다음은 유초등부 주일 강의원고입니다. 이 원고를 바탕으로 “이번 주 말씀 열매” 기능에 사용할 3개의 실천 카드를 만들어 주세요.

대상: 초등학교 유초등부 아이들
신학 방향: 실천을 아이의 공로나 점수로 표현하지 말고, 하나님께서 말씀으로 우리 삶에 열매를 맺게 하신다는 관점으로 작성
문체: 짧고 따뜻하게, 아이들이 이해할 수 있는 말로 작성
분량: 각 카드의 요약은 1-2문장, 질문 1개, 기도문 1문장
반드시 다음 3단계로 작성:
1회차: 말씀을 기억해요
2회차: 마음을 돌아보아요
3회차: 하나님께 감사해요

오로지 다음 JSON 스키마만 출력하세요. JSON 외의 다른 텍스트는 절대 출력하지 마세요.
{
  "title": "string",
  "passage": "string",
  "fruitName": "string",
  "memoryVerse": "string",
  "recommendedPractices": ["string"],
  "cards": [
    { "order": 1, "title": "말씀을 기억해요", "summary": "string", "question": "string", "prayer": "string" },
    { "order": 2, "title": "마음을 돌아보아요", "summary": "string", "question": "string", "prayer": "string" },
    { "order": 3, "title": "하나님께 감사해요", "summary": "string", "question": "string", "prayer": "string" }
  ]
}

강의원고:
`;

const DEFAULT_CARD_TITLES: Record<1 | 2 | 3, string> = {
  1: '말씀을 기억해요',
  2: '마음을 돌아보아요',
  3: '하나님께 감사해요',
};

/* ────────────────────────── core logic ─────────────────────────────────── */

interface FoundManuscript {
  postId: string;
  title: string;
  content: string;
}

const findElementaryScriptForSunday = async (sundayKey: string): Promise<FoundManuscript | null> => {
  const db = getAppDb();
  const snap = await db
    .collection('posts')
    .where('category', '==', 'next_generation')
    .where('subCategory', '==', 'elementary_script')
    .where('nextGenerationWeekKey', '==', sundayKey)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data() as any;

  let content: string = typeof data.content === 'string' ? data.content : '';
  if (data.isLongContent) {
    // Concatenate post_contents/{postId}_{i} chunks
    const chunkSnap = await db
      .collection('post_contents')
      .where('postId', '==', doc.id)
      .orderBy('index')
      .get();
    if (!chunkSnap.empty) {
      content = chunkSnap.docs.map((d) => (d.data() as any).content ?? '').join('');
    }
  }
  return { postId: doc.id, title: data.title ?? '', content };
};

const callGemini = async (manuscript: string): Promise<any> => {
  const apiKey = getEnv('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: AI_PROMPT_HEADER + manuscript,
    config: { responseMimeType: 'application/json' },
  });
  const text = (response as any).text ?? '';
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI 응답에서 JSON을 찾지 못했습니다.');
    return JSON.parse(match[0]);
  }
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

interface RunResult {
  ok: boolean;
  weekId: string;
  sundayKey: string;
  reason?:
    | 'NO_MANUSCRIPT'
    | 'ALREADY_PUBLISHED'
    | 'HUMAN_EDITED'
    | 'AI_FAILED'
    | 'SAVED';
  postId?: string;
  message?: string;
}

const runAutoDraft = async (now = new Date()): Promise<RunResult> => {
  const sundayKey = upcomingSundayKstKey(now);
  const weekId = fruitWeekIdFromSundayKey(sundayKey);
  const db = getAppDb();
  const fruitRef = db.collection('next_generation_word_fruits').doc(weekId);

  const existing = await fruitRef.get();
  if (existing.exists) {
    const cur = existing.data() as any;
    if (cur.status === 'published') {
      return {
        ok: false,
        weekId,
        sundayKey,
        reason: 'ALREADY_PUBLISHED',
        message: '이미 게시된 주차입니다. 자동 초안을 덮어쓰지 않습니다.',
      };
    }
    // Detect human edits: any save through the admin form bumps `updatedAt`
    // beyond the original `autoDraftedAt` snapshot. Tolerate 10s for the
    // initial server-timestamp pair from the same set() call.
    const updatedAtMs = cur.updatedAt?.toMillis?.() ?? 0;
    const autoDraftedAtMs = cur.autoDraftedAt?.toMillis?.() ?? 0;
    const humanEdited =
      // No auto-draft trace → entire doc is human-authored
      !cur.autoDraftedAt ||
      updatedAtMs > autoDraftedAtMs + 10_000;
    if (humanEdited) {
      const pastorUids = await findPastorUids();
      await createInAppNotifications(
        pastorUids,
        `자동 초안 건너뜀: ${weekId} 주차에 수동 수정 흔적이 있어 덮어쓰지 않았습니다.`,
      );
      return {
        ok: false,
        weekId,
        sundayKey,
        reason: 'HUMAN_EDITED',
        message: '수동 수정이 감지되어 자동 초안을 덮어쓰지 않았습니다.',
      };
    }
  }

  const manuscript = await findElementaryScriptForSunday(sundayKey);
  if (!manuscript || !manuscript.content || manuscript.content.trim().length < 30) {
    // Notify pastors that nothing was found
    const pastorUids = await findPastorUids();
    await createInAppNotifications(
      pastorUids,
      `자동 초안 실패: ${sundayKey} 주일 강의원고를 찾지 못했어요. 강의원고를 게시한 뒤 “관리” 화면에서 수동 생성해 주세요.`,
    );
    return {
      ok: false,
      weekId,
      sundayKey,
      reason: 'NO_MANUSCRIPT',
      message: '강의원고를 찾지 못했습니다.',
    };
  }

  let parsed: any;
  try {
    parsed = await callGemini(manuscript.content);
  } catch (err) {
    console.error('Gemini call failed:', err);
    const pastorUids = await findPastorUids();
    await createInAppNotifications(
      pastorUids,
      `자동 초안 실패: AI 생성 중 오류가 발생했어요. 관리 화면에서 직접 “강의원고로 카드 생성”을 눌러 주세요.`,
    );
    return { ok: false, weekId, sundayKey, reason: 'AI_FAILED', message: String(err) };
  }

  const cards = [1, 2, 3].map((order) => {
    const f = (parsed?.cards ?? []).find((c: any) => Number(c?.order) === order);
    return {
      order,
      title:
        typeof f?.title === 'string' && f.title.trim()
          ? f.title.trim()
          : DEFAULT_CARD_TITLES[order as 1 | 2 | 3],
      summary: typeof f?.summary === 'string' ? f.summary.trim() : '',
      question: typeof f?.question === 'string' ? f.question.trim() : '',
      prayer: typeof f?.prayer === 'string' ? f.prayer.trim() : '',
    };
  });

  const recommendedPractices = Array.isArray(parsed?.recommendedPractices)
    ? parsed.recommendedPractices
        .filter((s: any): s is string => typeof s === 'string')
        .map((s: string) => s.trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];

  const startDate = addDaysIso(sundayKey, 1); // Monday
  const endDate = addDaysIso(sundayKey, 6); // Saturday
  const isCreate = !existing.exists;

  const docPayload: Record<string, unknown> = {
    weekId,
    title: typeof parsed?.title === 'string' && parsed.title.trim() ? parsed.title.trim() : manuscript.title,
    passage: typeof parsed?.passage === 'string' ? parsed.passage.trim() : '',
    memoryVerse: typeof parsed?.memoryVerse === 'string' ? parsed.memoryVerse.trim() : '',
    fruitName: typeof parsed?.fruitName === 'string' ? parsed.fruitName.trim() : '',
    startDate,
    endDate,
    status: 'draft', // never auto-publish
    topMessage: '하나님께서 우리 삶에 열매를 맺게 하세요.',
    guideMessage: '이번 주 말씀을 기억하며, 한 주에 3번 이상 작은 순종을 실천해 보세요.',
    recommendedPractices,
    cards,
    autoDraftSourcePostId: manuscript.postId,
    autoDraftedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (isCreate) {
    docPayload.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }

  await fruitRef.set(docPayload, { merge: true });

  // Notify pastors
  const pastorUids = await findPastorUids();
  await createInAppNotifications(
    pastorUids,
    `주일 말씀 열매 초안이 준비됐어요 (${weekId}). “관리” 화면에서 검토 후 게시해 주세요.`,
  );

  return { ok: true, weekId, sundayKey, reason: 'SAVED', postId: manuscript.postId };
};

/* ────────────────────────── handler ────────────────────────────────────── */

export default async (req: Request) => {
  if (!initializeFirebaseAdmin()) {
    return jsonResponse({ error: 'Firebase Admin not initialized' }, 500);
  }
  try {
    const result = await runAutoDraft();
    return jsonResponse(result, result.ok ? 200 : 200); // always 200 to avoid retries
  } catch (e) {
    console.error('word-fruit-auto-draft error:', e);
    return jsonResponse({ ok: false, error: String(e) }, 200);
  }
};

/**
 * Cron schedule (UTC). Saturday 14:00 UTC = Saturday 23:00 KST.
 * Runs every Saturday late evening so a draft is ready by Sunday morning.
 */
export const config: Config = {
  schedule: '0 14 * * 6',
};
