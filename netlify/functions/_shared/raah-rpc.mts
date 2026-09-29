import { supabaseRequest } from './supabase-request.mjs';

// Shared request plumbing for RAAH APIs that write through raah_rpc_* functions
// (communion care, care tasks). Upstream messages are never forwarded or logged.

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,128}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const getEnv = (key: string) => {
  const netlifyValue = typeof Netlify !== 'undefined' ? Netlify.env.get(key) : undefined;
  return netlifyValue || process.env[key];
};

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const fail = (status: number, error: string, code: string) => json({ error, code }, status);

/** Communion care and its follow-up tasks share one rollout flag. */
export const isCommunionEnabled = () => getEnv('RAAH_COMMUNION_ENABLED') === 'true';

export const isValidDate = (value: unknown): value is string =>
  typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
export const cleanText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  const body = await req.json().catch(() => null);
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

// Exactly one of `data` / `response` is set; `response` is the error to return as-is.
export type Upstream = { data: unknown; response?: undefined } | { data?: undefined; response: Response };

const getConfig = () => {
  const url = getEnv('SUPABASE_URL')?.replace(/\/$/, '');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  return url && serviceKey ? { url, serviceKey } : null;
};

// PostgREST returns the SQLSTATE in `code`. Only the code is used; upstream
// messages can echo ids and are never passed to the client or logs.
const SQLSTATE_TO_HTTP: Record<string, [number, string, string]> = {
  P0403: [403, '라아 목양 접근 권한이 없습니다.', 'RAAH_ACCESS_NOT_GRANTED'],
  P0404: [404, '대상을 찾을 수 없습니다.', 'RAAH_NOT_FOUND'],
  P0409: [409, '다른 곳에서 먼저 변경되었습니다. 새로고침 후 다시 시도해 주세요.', 'RAAH_REVISION_CONFLICT'],
  P0422: [422, '요청을 처리할 수 없는 상태입니다.', 'RAAH_INVALID_STATE'],
  '23505': [409, '이미 등록된 항목입니다.', 'RAAH_DUPLICATE'],
  '23503': [422, '연결할 대상을 찾을 수 없습니다.', 'RAAH_INVALID_REFERENCE'],
  '23514': [422, '입력값이 올바르지 않습니다.', 'RAAH_INVALID_INPUT'],
  '22P02': [422, '입력값이 올바르지 않습니다.', 'RAAH_INVALID_INPUT'],
  '22007': [422, '날짜 형식이 올바르지 않습니다.', 'RAAH_INVALID_INPUT'],
  '22008': [422, '날짜 형식이 올바르지 않습니다.', 'RAAH_INVALID_INPUT'],
};

export function mapUpstreamError(code: string | undefined) {
  const mapped = code ? SQLSTATE_TO_HTTP[code] : undefined;
  if (mapped) return fail(mapped[0], mapped[1], mapped[2]);
  console.error('RAAH upstream error', code || 'unknown');
  return fail(502, '저장소 요청을 처리하지 못했습니다.', 'RAAH_UPSTREAM_ERROR');
}

export async function upstream(path: string, init: RequestInit = {}): Promise<Upstream> {
  const config = getConfig();
  if (!config) {
    return { response: fail(503, 'RAAH Supabase environment variables are not configured.', 'RAAH_SUPABASE_NOT_CONFIGURED') };
  }
  let response: Response;
  try {
    response = await supabaseRequest(`${config.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
  } catch {
    return { response: fail(503, '저장소에 연결하지 못했습니다.', 'RAAH_UPSTREAM_UNAVAILABLE') };
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) return { response: mapUpstreamError((data as { code?: string } | null)?.code) };
  return { data };
}

export const rpc = (name: string, args: Record<string, unknown>) =>
  upstream(`rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });
