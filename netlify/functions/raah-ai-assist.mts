import type { Config } from '@netlify/functions';
import { admin, getAppDb, initializeFirebaseAdmin, jsonResponse } from './_shared/firebase-admin.mjs';

declare const Netlify:
  | {
      env: {
        get: (key: string) => string | undefined;
      };
    }
  | undefined;

type RaahAiDraft = {
  publicSummary: string;
  innerNote: string;
  prayerTopics: string;
  nextSteps: string;
  privateRemarks: string;
  recommendedAction: string;
};

const ADMIN_EMAIL = 'crushidea@gmail.com';
const MODEL = 'gemini-2.5-flash';
const MAX_MEMO_LENGTH = 12000;

const getEnv = (key: string) => {
  const netlifyValue = typeof Netlify !== 'undefined' ? Netlify.env.get(key) : undefined;
  return netlifyValue || process.env[key];
};

const noStoreJson = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const cleanText = (value: unknown, limit = 4000) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, limit);
};

const getBearerToken = (req: Request) => {
  const authHeader = req.headers.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
};

const getSupabaseAuthUser = async (token: string) => {
  const url = getEnv('SUPABASE_URL');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return null;

  const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;

  const data = await response.json();
  const appRole = data?.app_metadata?.role;
  const userRole = data?.user_metadata?.role;
  const isAdmin = data?.email === ADMIN_EMAIL || appRole === 'admin' || userRole === 'admin';
  return { isAdmin };
};

const requireRaahAdmin = async (req: Request) => {
  const token = getBearerToken(req);
  if (!token) return { response: jsonResponse({ error: 'Authentication required' }, 401) };

  if (initializeFirebaseAdmin()) {
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      if (decoded.email === ADMIN_EMAIL) return {};

      const userDoc = await getAppDb().collection('users').doc(decoded.uid).get();
      if (userDoc.exists && userDoc.data()?.role === 'admin') return {};
    } catch {
      // Supabase Auth tokens are allowed during the transition period.
    }
  }

  const supabaseUser = await getSupabaseAuthUser(token);
  if (supabaseUser?.isAdmin) return {};

  return { response: jsonResponse({ error: 'Admin permission required' }, 403) };
};

const parseInput = async (req: Request) => {
  const data = await req.json().catch(() => null);
  if (!data || typeof data !== 'object') return null;

  const input = data as Record<string, unknown>;
  const rawMemo = cleanText(input.rawMemo, MAX_MEMO_LENGTH);
  if (!rawMemo || rawMemo.length < 10) return null;

  return {
    rawMemo,
    memberName: cleanText(input.memberName, 100),
    logType: cleanText(input.logType, 50),
    date: cleanText(input.date, 20),
  };
};

const safeDraft = (value: unknown): RaahAiDraft => {
  const draft = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    publicSummary: cleanText(draft.publicSummary, 500),
    innerNote: cleanText(draft.innerNote, 5000),
    prayerTopics: cleanText(draft.prayerTopics, 2500),
    nextSteps: cleanText(draft.nextSteps, 2000),
    privateRemarks: cleanText(draft.privateRemarks, 2000),
    recommendedAction: cleanText(draft.recommendedAction, 1500),
  };
};

const buildPrompt = (input: NonNullable<Awaited<ReturnType<typeof parseInput>>>) => `
너는 한국어 목양 관리 기록을 정리하는 보조자다.
아래 긴 메모를 RAAH 목양 기록 양식에 맞게 정리하라.

원칙:
- 사실을 지어내지 말고, 메모에 있는 내용만 근거로 삼아라.
- 민감한 판단, 진단, 단정은 피하고 관찰 가능한 표현으로 쓴다.
- 공개 요약은 다른 관리자에게 보여도 되는 수준으로 짧게 쓴다.
- 내밀한 목양 기록은 상담/심방의 맥락과 핵심 내용을 정리한다.
- 기도 제목은 기도할 수 있는 항목으로 나눈다.
- 다음 단계는 실제 후속 목양 액션으로 짧게 쓴다.
- 추천 목양 액션은 저장 전 참고용 제안으로, 명령형보다 검토형으로 쓴다.

성도: ${input.memberName || '미지정'}
유형: ${input.logType || '미지정'}
날짜: ${input.date || '미지정'}

긴 메모:
${input.rawMemo}
`;

const callGemini = async (input: NonNullable<Awaited<ReturnType<typeof parseInput>>>) => {
  const apiKey = getEnv('GEMINI_API_KEY');
  if (!apiKey) {
    return noStoreJson({ error: 'Gemini API key is not configured.', code: 'RAAH_GEMINI_NOT_CONFIGURED' }, 503);
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: buildPrompt(input) }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            publicSummary: { type: 'string' },
            innerNote: { type: 'string' },
            prayerTopics: { type: 'string' },
            nextSteps: { type: 'string' },
            privateRemarks: { type: 'string' },
            recommendedAction: { type: 'string' },
          },
          required: ['publicSummary', 'innerNote', 'prayerTopics', 'nextSteps', 'privateRemarks', 'recommendedAction'],
        },
      },
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error('RAAH Gemini request failed:', data);
    return noStoreJson({ error: 'AI draft generation failed.' }, response.status);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    return noStoreJson({ error: 'AI response was empty.' }, 502);
  }

  try {
    return noStoreJson({ draft: safeDraft(JSON.parse(text)), model: MODEL });
  } catch (error) {
    console.error('RAAH Gemini JSON parse failed:', error);
    return noStoreJson({ error: 'AI response could not be parsed.' }, 502);
  }
};

export default async (req: Request) => {
  if (req.method !== 'POST') return noStoreJson({ error: 'Method not allowed' }, 405);

  const adminCheck = await requireRaahAdmin(req);
  if (adminCheck.response) return adminCheck.response;

  const input = await parseInput(req);
  if (!input) return noStoreJson({ error: 'A longer memo is required.' }, 400);

  return callGemini(input);
};

export const config: Config = {
  path: '/api/raah/ai-assist',
};
