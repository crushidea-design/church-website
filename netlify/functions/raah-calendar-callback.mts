import type { Config } from '@netlify/functions';

// Netlify reserves /.netlify/* and rejects redirect rules for this legacy URL.
// Keep the Google-registered URL as a transport shim; Firebase owns OAuth work.
const TARGET = 'https://asia-northeast1-gen-lang-client-0036445484.cloudfunctions.net/raahApi/.netlify/functions/raah-calendar-callback';

export default async (req: Request) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET', 'Cache-Control': 'no-store' } });
  }
  const target = new URL(TARGET);
  target.search = new URL(req.url).search;
  try {
    const upstream = await fetch(target, {
      method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(20_000),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    // Never log OAuth codes, signed state, or upstream response content.
    return new Response('캘린더 연결 서버에 접속하지 못했습니다. 잠시 후 다시 연결해 주세요.', {
      status: 502, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
};

export const config: Config = { path: '/.netlify/functions/raah-calendar-callback' };
