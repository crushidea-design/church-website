import type { Config } from '@netlify/functions';
import { createCipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

declare const Netlify:
  | {
      env: {
        get: (key: string) => string | undefined;
      };
    }
  | undefined;

type EncryptedPayload = { iv: string; tag: string; ciphertext: string };
type CalendarSettingsRow = { client_id?: string | null; client_secret?: string | null; calendar_id?: string | null; enabled?: boolean | null };

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

const getEnv = (key: string) => {
  const netlifyValue = typeof Netlify !== 'undefined' ? Netlify.env.get(key) : undefined;
  return netlifyValue || process.env[key];
};

const html = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:system-ui,sans-serif;max-width:640px;margin:12vh auto;padding:24px;line-height:1.7;color:#202721}a{color:#25352e}</style></head><body><h1>${title}</h1><p>${body}</p><p><a href="/raah">RAAH로 돌아가기</a></p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );

const getConfig = () => {
  const supabaseUrl = getEnv('SUPABASE_URL')?.replace(/\/$/, '');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = getEnv('SUPABASE_ANON_KEY') || getEnv('VITE_SUPABASE_ANON_KEY') || serviceKey;
  const secret = getEnv('RAAH_ENCRYPTION_SECRET');
  const clientId = getEnv('GOOGLE_CALENDAR_CLIENT_ID');
  const clientSecret = getEnv('GOOGLE_CALENDAR_CLIENT_SECRET');
  const calendarId = getEnv('GOOGLE_CALENDAR_ID') || 'primary';
  if (!supabaseUrl || !serviceKey || !secret) return null;
  return { supabaseUrl, serviceKey, anonKey, secret, clientId, clientSecret, calendarId };
};

const getRedirectUri = (requestUrl: string) => `${new URL(requestUrl).origin}/.netlify/functions/raah-calendar-callback`;

const encryptJson = (payload: unknown, secret: string): EncryptedPayload => {
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('base64'), tag: tag.toString('base64'), ciphertext: ciphertext.toString('base64') };
};

const verifyStatePayload = (state: string, secret: string) => {
  const [body, signature] = state.split('.');
  if (!body || !signature) return null;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { uid?: string; email?: string; name?: string; iat?: number };
  if (!payload.uid || !payload.iat || Date.now() - payload.iat > 10 * 60 * 1000) return null;
  return payload;
};

const supabaseFetch = async (path: string, init: RequestInit = {}) => {
  const config = getConfig();
  if (!config) return { response: html('설정이 필요합니다', 'Google Calendar 또는 Supabase 환경 변수가 아직 설정되지 않았습니다.', 503) };
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.anonKey || config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  return { config, supabaseResponse: response };
};

const getCalendarConfig = async () => {
  const base = getConfig();
  if (!base) return { response: html('설정이 필요합니다', 'Supabase 환경 변수가 아직 설정되지 않았습니다.', 503) };
  if (base.clientId && base.clientSecret) return { config: { ...base, calendarId: base.calendarId || 'primary' } };

  const result = await supabaseFetch('raah_calendar_oauth_settings?select=client_id,client_secret,calendar_id,enabled&id=eq.google_calendar&limit=1');
  if (result.response) return { response: result.response };
  const rows = (await result.supabaseResponse.json().catch(() => [])) as CalendarSettingsRow[];
  if (!result.supabaseResponse.ok) return { response: html('Google Calendar 연결 실패', 'RAAH 캘린더 OAuth 설정을 불러오지 못했습니다.', 500) };
  const settings = rows.find((row) => row.enabled !== false);
  const config = {
    ...base,
    clientId: base.clientId || settings?.client_id || '',
    clientSecret: base.clientSecret || settings?.client_secret || '',
    calendarId: base.calendarId !== 'primary' ? base.calendarId : settings?.calendar_id || base.calendarId || 'primary',
  };
  if (!config.clientId || !config.clientSecret) return { response: html('설정이 필요합니다', 'Google Calendar OAuth 설정이 아직 저장되지 않았습니다.', 503) };
  return { config };
};

export default async (req: Request) => {
  const runtime = await getCalendarConfig();
  if ('response' in runtime) return runtime.response;
  const config = runtime.config;
  if (!config) return html('설정이 필요합니다', 'Google Calendar OAuth 환경 변수를 먼저 설정해 주세요.', 503);

  const url = new URL(req.url);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const error = url.searchParams.get('error') || '';
  if (error) return html('Google Calendar 연결 취소', `Google에서 ${error} 응답을 받았습니다.`, 400);
  const user = verifyStatePayload(state, config.secret);
  if (!code || !user) return html('Google Calendar 연결 실패', 'OAuth 응답을 확인하지 못했습니다. 다시 연결해 주세요.', 400);

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: getRedirectUri(req.url),
      grant_type: 'authorization_code',
    }),
  });
  const tokenData = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenData.access_token || !tokenData.refresh_token) {
    return html('Google Calendar 연결 실패', '토큰을 발급받지 못했습니다. 이미 연결했던 계정이면 다시 동의 화면에서 권한을 허용해 주세요.', 400);
  }

  const calendarCheckUrl = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`);
  calendarCheckUrl.searchParams.set('maxResults', '1');
  calendarCheckUrl.searchParams.set('singleEvents', 'true');
  calendarCheckUrl.searchParams.set('timeMin', new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString());
  const calendarResponse = await fetch(calendarCheckUrl, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!calendarResponse.ok) return html('Google Calendar 연결 실패', '지정한 RAAH 전용 캘린더를 읽지 못했습니다. GOOGLE_CALENDAR_ID를 확인해 주세요.', 400);

  const encryptedToken = encryptJson(
    {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString() : '',
      scope: tokenData.scope || CALENDAR_SCOPE,
    },
    config.secret
  );

  const result = await supabaseFetch('raah_calendar_connections?select=id&on_conflict=provider', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      provider: 'google_calendar',
      calendar_id: config.calendarId,
      calendar_summary: config.calendarId === 'primary' ? 'Primary calendar' : config.calendarId,
      google_account_email: '',
      encrypted_token: encryptedToken,
      scope: tokenData.scope || CALENDAR_SCOPE,
      token_expiry: tokenData.expires_in ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString() : null,
      connected_by: { uid: user.uid, email: user.email || '', name: user.name || 'Admin' },
      connected_at: new Date().toISOString(),
    }),
  });
  if (result.response) return result.response;
  if (!result.supabaseResponse.ok) return html('Google Calendar 연결 실패', 'RAAH에 캘린더 연결 정보를 저장하지 못했습니다.', 500);

  return html('Google Calendar 연결 완료', 'RAAH 전용 캘린더가 연결되었습니다. 이제 RAAH로 돌아가 일정을 동기화할 수 있습니다.');
};

export const config: Config = {
  path: '/.netlify/functions/raah-calendar-callback',
};
