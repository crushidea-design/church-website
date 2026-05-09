import type { Config } from '@netlify/functions';
import {
  getAppDb,
  initializeFirebaseAdmin,
  jsonResponse,
  verifyRequestUser,
} from './_shared/firebase-admin.mjs';

declare const Netlify:
  | { env: { get: (key: string) => string | undefined } }
  | undefined;

const ADMIN_EMAIL = 'crushidea@gmail.com';
const getEnv = (key: string) =>
  (typeof Netlify !== 'undefined' ? Netlify.env.get(key) : undefined) || process.env[key];

const ensureNextGenerationPastor = async (uid: string, email: string | undefined) => {
  if (email === ADMIN_EMAIL) return true;
  const snap = await getAppDb().collection('next_generation_members').doc(uid).get();
  if (!snap.exists) return false;
  const data = snap.data() as { role?: string; isNextGenerationAdmin?: boolean };
  return data.role === 'member' && data.isNextGenerationAdmin === true;
};

const PROMPT = `다음은 유초등부 주일 강의원고입니다. 이 원고를 바탕으로 “이번 주 말씀 열매” 기능에 사용할 3개의 실천 카드를 만들어 주세요.

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
  "recommendedPractices": ["string", "string", "string", "string", "string"],
  "fruitName": "string",
  "memoryVerse": "string",
  "cards": [
    { "order": 1, "title": "말씀을 기억해요", "summary": "string", "question": "string", "prayer": "string" },
    { "order": 2, "title": "마음을 돌아보아요", "summary": "string", "question": "string", "prayer": "string" },
    { "order": 3, "title": "하나님께 감사해요", "summary": "string", "question": "string", "prayer": "string" }
  ]
}

강의원고:
`;

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
  const manuscript = typeof body?.manuscript === 'string' ? body.manuscript.trim() : '';
  if (manuscript.length < 30) {
    return jsonResponse({ error: 'MANUSCRIPT_TOO_SHORT', message: '강의원고가 너무 짧습니다.' }, 400);
  }
  if (manuscript.length > 60_000) {
    return jsonResponse({ error: 'MANUSCRIPT_TOO_LONG', message: '강의원고가 너무 깁니다.' }, 400);
  }

  const apiKey = getEnv('GEMINI_API_KEY');
  if (!apiKey) {
    return jsonResponse({ error: 'AI_KEY_MISSING', message: 'AI 키가 서버에 설정되지 않았습니다.' }, 500);
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: PROMPT + manuscript,
      config: { responseMimeType: 'application/json' },
    });
    const text = (response as any).text ?? '';
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('JSON parse failed');
      parsed = JSON.parse(m[0]);
    }
    return jsonResponse({ success: true, data: parsed });
  } catch (err: any) {
    console.error('word-fruit-generate-cards error:', err);
    return jsonResponse({ error: 'AI_FAILED', message: err?.message || String(err) }, 500);
  }
};

export const config: Config = {
  path: '/api/word-fruit/generate-cards',
};
