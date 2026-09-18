import type { Config } from '@netlify/functions';
import { requireRaahAdmin } from './_shared/raah-auth.mjs';

// Keep the route for older clients, but never read or forward pastoral memo bodies.
export default async (req: Request) => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  const access = await requireRaahAdmin(req);
  if (access.response) return access.response;
  return new Response(JSON.stringify({
    error: '목양 메모 보호를 위해 외부 AI 정리를 중단했습니다. 기록 양식에 직접 정리해 주세요.',
    code: 'RAAH_EXTERNAL_AI_DISABLED',
  }), { status: 410, headers });
};

export const config: Config = { path: '/api/raah/ai-assist' };
