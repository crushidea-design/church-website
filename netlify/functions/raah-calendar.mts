import type { Config, Context } from '@netlify/functions';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { admin, getAppDb, initializeFirebaseAdmin, jsonResponse } from './_shared/firebase-admin.mjs';

declare const Netlify:
  | {
      env: {
        get: (key: string) => string | undefined;
      };
    }
  | undefined;

type RaahUser = { uid: string; email?: string; name: string };
type EncryptedPayload = { iv: string; tag: string; ciphertext: string };
type CalendarToken = { accessToken: string; refreshToken: string; expiresAt?: string; scope?: string };
type CalendarSettingsRow = { client_id?: string | null; client_secret?: string | null; calendar_id?: string | null; enabled?: boolean | null };
type CalendarConnectionRow = {
  id: string;
  calendar_id: string;
  calendar_summary?: string | null;
  google_account_email?: string | null;
  encrypted_token: EncryptedPayload | string;
  scope?: string | null;
  token_expiry?: string | null;
  connected_at?: string;
};
type ScheduleItemRow = {
  id: string;
  title: string;
  date: string;
  end_date?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  item_type: 'visitation' | 'counseling' | 'task' | 'meeting' | 'other';
  member_id?: string | null;
  member_name?: string | null;
  status: 'open' | 'done';
  source: 'manual' | 'google_calendar';
  external_id?: string | null;
  memo?: string | null;
  created_at?: string;
  updated_at?: string;
};
type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};
type CalendarEventInput = {
  title: string;
  date: string;
  endDate?: string;
  startsAt: string;
  endsAt?: string;
  memberId?: string;
  memberName?: string;
  memo?: string;
  sourceLogId?: string;
};

const ADMIN_EMAIL = 'crushidea@gmail.com';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const TIME_ZONE = 'Asia/Seoul';
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const SCHEDULE_SELECT = 'id,title,date,end_date,starts_at,ends_at,item_type,member_id,member_name,status,source,external_id,memo,created_at,updated_at';

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

const cleanText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const validDate = (value?: string) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
const validTime = (value?: string) => !value || /^\d{2}:\d{2}$/.test(value);

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
  return {
    id: String(data?.id || ''),
    email: typeof data?.email === 'string' ? data.email : undefined,
    name: typeof data?.user_metadata?.name === 'string' ? data.user_metadata.name : undefined,
    isAdmin,
  };
};

const requireRaahAdmin = async (req: Request): Promise<{ user?: RaahUser; response?: Response }> => {
  const token = getBearerToken(req);
  if (!token) return { response: jsonResponse({ error: 'Authentication required' }, 401) };

  if (initializeFirebaseAdmin()) {
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      if (decoded.email === ADMIN_EMAIL) {
        return { user: { uid: decoded.uid, email: decoded.email, name: decoded.name || decoded.email || 'Admin' } };
      }

      const userDoc = await getAppDb().collection('users').doc(decoded.uid).get();
      if (userDoc.exists && userDoc.data()?.role === 'admin') {
        return { user: { uid: decoded.uid, email: decoded.email, name: decoded.name || decoded.email || 'Admin' } };
      }
    } catch {
      // Supabase Auth tokens are allowed during the transition period.
    }
  }

  const supabaseUser = await getSupabaseAuthUser(token);
  if (supabaseUser?.isAdmin) {
    return { user: { uid: supabaseUser.id, email: supabaseUser.email, name: supabaseUser.name || supabaseUser.email || 'Admin' } };
  }

  return { response: jsonResponse({ error: 'Admin permission required' }, 403) };
};

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

const getRedirectUri = (req: Request) => `${new URL(req.url).origin}/.netlify/functions/raah-calendar-callback`;

const supabaseFetch = async (path: string, init: RequestInit = {}) => {
  const config = getConfig();
  if (!config) {
    return {
      response: noStoreJson({ error: 'RAAH Supabase environment variables are not configured.', code: 'RAAH_SUPABASE_NOT_CONFIGURED' }, 503),
    };
  }

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
  if (!base) return { config: null };
  if (base.clientId && base.clientSecret) return { config: { ...base, calendarId: base.calendarId || 'primary' } };

  const result = await supabaseFetch('raah_calendar_oauth_settings?select=client_id,client_secret,calendar_id,enabled&id=eq.google_calendar&limit=1');
  if (result.response) return { response: result.response };
  const rows = (await result.supabaseResponse.json().catch(() => [])) as CalendarSettingsRow[];
  if (!result.supabaseResponse.ok) return { response: noStoreJson({ error: 'Failed to load RAAH calendar settings.' }, result.supabaseResponse.status) };
  const settings = rows.find((row) => row.enabled !== false);
  return {
    config: {
      ...base,
      clientId: base.clientId || settings?.client_id || '',
      clientSecret: base.clientSecret || settings?.client_secret || '',
      calendarId: base.calendarId !== 'primary' ? base.calendarId : settings?.calendar_id || base.calendarId || 'primary',
    },
  };
};

const encryptJson = (payload: unknown, secret: string): EncryptedPayload => {
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString('base64'), tag: tag.toString('base64'), ciphertext: ciphertext.toString('base64') };
};

const decryptJson = <T,>(payload: EncryptedPayload | string, secret: string): T => {
  const encrypted = typeof payload === 'string' ? (JSON.parse(payload) as EncryptedPayload) : payload;
  const key = createHash('sha256').update(secret).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encrypted.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, 'base64')), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext) as T;
};

const base64Url = (value: string | Buffer) => Buffer.from(value).toString('base64url');
const signStatePayload = (payload: Record<string, unknown>, secret: string) => {
  const body = base64Url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
};

export const verifyStatePayload = (state: string, secret: string) => {
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

const getLatestConnection = async () => {
  const result = await supabaseFetch(
    'raah_calendar_connections?select=id,calendar_id,calendar_summary,google_account_email,encrypted_token,scope,token_expiry,connected_at&provider=eq.google_calendar&order=connected_at.desc&limit=1'
  );
  if (result.response) return { response: result.response };
  const rows = (await result.supabaseResponse.json().catch(() => [])) as CalendarConnectionRow[];
  if (!result.supabaseResponse.ok) return { response: noStoreJson({ error: 'Failed to load RAAH calendar connection.' }, result.supabaseResponse.status) };
  return { config: result.config, connection: rows[0] || null };
};

const rowToScheduleItem = (row: ScheduleItemRow) => ({
  id: row.id,
  title: row.title,
  date: row.date,
  endDate: row.end_date || row.date,
  startsAt: row.starts_at || '',
  endsAt: row.ends_at || '',
  itemType: row.item_type,
  memberId: row.member_id || '',
  memberName: row.member_name || '',
  status: row.status,
  source: row.source,
  externalId: row.external_id || '',
  memo: row.memo || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const refreshAccessToken = async (connection: CalendarConnectionRow, secret: string, clientId: string, clientSecret: string) => {
  const token = decryptJson<CalendarToken>(connection.encrypted_token, secret);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(typeof data.error_description === 'string' ? data.error_description : 'Failed to refresh Google access token.');
  return String(data.access_token);
};

const addOneHour = (time: string) => {
  const [hour = '0', minute = '0'] = time.split(':');
  return `${String((Number(hour) + 1) % 24).padStart(2, '0')}:${String(Number(minute)).padStart(2, '0')}`;
};

const addDaysIso = (dateIso: string, days: number) => {
  const [year, month, day] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

const buildGoogleEventPayload = (input: CalendarEventInput) => {
  const endDate = input.endDate || input.date;
  if (!input.startsAt && !input.endsAt && endDate !== input.date) {
    return {
      summary: input.title,
      description: input.memo || '',
      start: { date: input.date },
      end: { date: addDaysIso(endDate, 1) },
    };
  }
  const startsAt = input.startsAt || '09:00';
  const endsAt = input.endsAt || addOneHour(startsAt);
  return {
    summary: input.title,
    description: input.memo || '',
    start: { dateTime: `${input.date}T${startsAt}:00`, timeZone: TIME_ZONE },
    end: { dateTime: `${endDate}T${endsAt}:00`, timeZone: TIME_ZONE },
  };
};

const normalizeGoogleTime = (value?: { date?: string; dateTime?: string }) => {
  if (!value) return { date: '', startsAt: '' };
  if (value.date) return { date: value.date, startsAt: '' };
  const dateTime = value.dateTime || '';
  return { date: dateTime.slice(0, 10), startsAt: dateTime.slice(11, 16) };
};

const inferItemType = (title: string): ScheduleItemRow['item_type'] => {
  if (title.includes('심방')) return 'visitation';
  if (title.includes('상담')) return 'counseling';
  if (title.includes('회의') || title.includes('모임')) return 'meeting';
  return 'task';
};

const googleEventToScheduleRow = (event: GoogleEvent, overrides: Partial<ScheduleItemRow> = {}) => {
  const start = normalizeGoogleTime(event.start);
  const end = normalizeGoogleTime(event.end);
  const endDate = event.end?.date ? addDaysIso(event.end.date, -1) : end.date || start.date;
  const title = event.summary || 'Google Calendar 일정';
  return {
    title,
    date: start.date,
    end_date: endDate < start.date ? start.date : endDate,
    starts_at: start.startsAt || null,
    ends_at: end.startsAt || null,
    item_type: inferItemType(title),
    status: 'open',
    source: 'google_calendar',
    external_id: event.id,
    memo: event.description || null,
    ...(overrides.member_id !== undefined ? { member_id: overrides.member_id || null } : {}),
    ...(overrides.member_name !== undefined ? { member_name: overrides.member_name || null } : {}),
  };
};

const parseEventInput = (raw: unknown): CalendarEventInput | null => {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const input: CalendarEventInput = {
    title: cleanText(data.title),
    date: cleanText(data.date),
    endDate: cleanText(data.endDate) || cleanText(data.date),
    startsAt: cleanText(data.startsAt),
    endsAt: cleanText(data.endsAt),
    memberId: cleanText(data.memberId),
    memberName: cleanText(data.memberName).replace(/\s+/g, ' '),
    memo: cleanText(data.memo),
    sourceLogId: cleanText(data.sourceLogId),
  };
  if (!input.title || input.title.length > 120 || !validDate(input.date) || !validDate(input.endDate) || !validTime(input.startsAt) || !validTime(input.endsAt)) return null;
  if ((input.endDate || input.date) < input.date) return null;
  if ((input.memberName || '').length > 100 || (input.memo || '').length > 1000) return null;
  return input;
};

const getKoreanWeekWindow = () => {
  const nowKst = new Date(Date.now() + KST_OFFSET_MS);
  const dayOfWeek = nowKst.getUTCDay();
  const year = nowKst.getUTCFullYear();
  const month = nowKst.getUTCMonth();
  const date = nowKst.getUTCDate();
  const weekStartUtc = Date.UTC(year, month, date - dayOfWeek, 0, 0, 0, 0) - KST_OFFSET_MS;
  const weekEndUtc = Date.UTC(year, month, date + (6 - dayOfWeek), 23, 59, 59, 999) - KST_OFFSET_MS;
  return {
    timeMin: new Date(weekStartUtc).toISOString(),
    timeMax: new Date(weekEndUtc).toISOString(),
  };
};

const getCalendarSyncWindow = () => {
  const nowKst = new Date(Date.now() + KST_OFFSET_MS);
  const year = nowKst.getUTCFullYear();
  const month = nowKst.getUTCMonth();
  const date = nowKst.getUTCDate();
  return {
    timeMin: new Date(Date.UTC(year, month - 3, date, 0, 0, 0, 0) - KST_OFFSET_MS).toISOString(),
    timeMax: new Date(Date.UTC(year + 1, month, date, 23, 59, 59, 999) - KST_OFFSET_MS).toISOString(),
  };
};

const handleStatus = async () => {
  const runtime = await getCalendarConfig();
  if ('response' in runtime) return runtime.response;
  const config = runtime.config;
  const configured = Boolean(config?.clientId && config.clientSecret && config.secret && config.supabaseUrl && config.serviceKey);
  if (!config || !configured) {
    return noStoreJson({ configured: false, connected: false, message: 'Google Calendar environment variables are not configured.' });
  }
  const result = await getLatestConnection();
  if ('response' in result) return result.response;
  return noStoreJson({
    configured,
    connected: Boolean(result.connection),
    calendarId: result.connection?.calendar_id || config.calendarId,
    calendarSummary: result.connection?.calendar_summary || '',
    googleAccountEmail: result.connection?.google_account_email || '',
    connectedAt: result.connection?.connected_at || '',
  });
};

const handleAuthUrl = async (req: Request, user: RaahUser) => {
  const runtime = await getCalendarConfig();
  if ('response' in runtime) return runtime.response;
  const config = runtime.config;
  if (!config?.clientId || !config.clientSecret) return noStoreJson({ error: 'Google Calendar OAuth is not configured.' }, 503);
  const state = signStatePayload({ uid: user.uid, email: user.email || '', name: user.name, iat: Date.now() }, config.secret);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', getRedirectUri(req));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', CALENDAR_SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  return noStoreJson({ url: url.toString() });
};

const upsertScheduleItem = async (row: Record<string, unknown>) => {
  const externalId = cleanText(row.external_id);
  const source = cleanText(row.source);
  let existingId = '';

  if (source && externalId) {
    const existing = await supabaseFetch(
      `raah_ministry_schedule_items?select=id&source=eq.${encodeURIComponent(source)}&external_id=eq.${encodeURIComponent(externalId)}&limit=1`
    );
    if (existing.response) return { response: existing.response };
    const existingRows = (await existing.supabaseResponse.json().catch(() => [])) as Array<{ id?: string }>;
    if (!existing.supabaseResponse.ok) return { response: noStoreJson({ error: 'Failed to check existing RAAH schedule item.' }, existing.supabaseResponse.status) };
    existingId = cleanText(existingRows[0]?.id);
  }

  const result = existingId
    ? await supabaseFetch(
        `raah_ministry_schedule_items?select=${SCHEDULE_SELECT}&id=eq.${encodeURIComponent(existingId)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(row),
        }
      )
    : await supabaseFetch(
        `raah_ministry_schedule_items?select=${SCHEDULE_SELECT}`,
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(row),
        }
      );
  if (result.response) return { response: result.response };
  const rows = (await result.supabaseResponse.json().catch(() => [])) as ScheduleItemRow[];
  if (!result.supabaseResponse.ok) return { response: noStoreJson({ error: 'Failed to upsert RAAH schedule item.' }, result.supabaseResponse.status) };
  if (!rows[0]) return { response: noStoreJson({ error: 'RAAH schedule item was not saved.' }, 500) };
  return { item: rowToScheduleItem(rows[0]) };
};

const getCalendarAccess = async () => {
  const result = await getLatestConnection();
  if ('response' in result) return { response: result.response };
  if (!result.connection) return { response: noStoreJson({ error: 'Google Calendar is not connected.' }, 409) };
  const runtime = await getCalendarConfig();
  if ('response' in runtime) return { response: runtime.response };
  const config = runtime.config;
  if (!config?.clientId || !config.clientSecret) return { response: noStoreJson({ error: 'Google Calendar OAuth is not configured.' }, 503) };
  try {
    const accessToken = await refreshAccessToken(result.connection, config.secret, config.clientId, config.clientSecret);
    return { config, connection: result.connection, accessToken };
  } catch (error) {
    return { response: noStoreJson({ error: error instanceof Error ? error.message : 'Failed to refresh Google Calendar token.' }, 401) };
  }
};

const handleSync = async () => {
  const access = await getCalendarAccess();
  if ('response' in access) return access.response;
  const { timeMin, timeMax } = getCalendarSyncWindow();
  const exportedItems = [];
  const manualResult = await supabaseFetch(
    `raah_ministry_schedule_items?select=${SCHEDULE_SELECT}&source=eq.manual&external_id=is.null&status=eq.open&date=gte.${encodeURIComponent(timeMin.slice(0, 10))}&date=lte.${encodeURIComponent(timeMax.slice(0, 10))}&limit=100`
  );
  if (manualResult.response) return manualResult.response;
  const manualRows = (await manualResult.supabaseResponse.json().catch(() => [])) as ScheduleItemRow[];
  if (!manualResult.supabaseResponse.ok) return noStoreJson({ error: 'Failed to load RAAH schedules for Google Calendar export.' }, manualResult.supabaseResponse.status);
  for (const row of manualRows) {
    const createResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(access.connection.calendar_id)}/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(
        buildGoogleEventPayload({
          title: row.title,
          date: row.date,
          endDate: row.end_date || row.date,
          startsAt: row.starts_at || '',
          endsAt: row.ends_at || '',
          memo: row.memo || '',
        })
      ),
    });
    const createdEvent = (await createResponse.json().catch(() => ({}))) as GoogleEvent & { error?: { message?: string } };
    if (!createResponse.ok || !createdEvent.id) {
      return noStoreJson({ error: createdEvent.error?.message || 'Failed to export RAAH schedule to Google Calendar.' }, createResponse.status || 500);
    }
    const update = await supabaseFetch(`raah_ministry_schedule_items?select=${SCHEDULE_SELECT}&id=eq.${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ source: 'google_calendar', external_id: createdEvent.id }),
    });
    if (update.response) return update.response;
    const updatedRows = (await update.supabaseResponse.json().catch(() => [])) as ScheduleItemRow[];
    if (!update.supabaseResponse.ok) return noStoreJson({ error: 'Failed to mark exported RAAH schedule.' }, update.supabaseResponse.status);
    if (updatedRows[0]) exportedItems.push(rowToScheduleItem(updatedRows[0]));
  }

  const items = [];
  const googleEvents: GoogleEvent[] = [];
  let pageToken = '';
  do {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(access.connection.calendar_id)}/events`);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${access.accessToken}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return noStoreJson({ error: typeof data.error?.message === 'string' ? data.error.message : 'Failed to sync Google Calendar events.' }, response.status);
    googleEvents.push(...((Array.isArray(data.items) ? data.items : []) as GoogleEvent[]));
    pageToken = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
  } while (pageToken);

  for (const event of googleEvents) {
    const upsert = await upsertScheduleItem(googleEventToScheduleRow(event));
    if ('response' in upsert) return upsert.response;
    if (upsert.item) items.push(upsert.item);
  }
  const byId = new Map([...exportedItems, ...items].map((item) => [item.id, item]));
  return noStoreJson({ items: [...byId.values()], exportedItems, calendarEventCount: googleEvents.length, exportedCount: exportedItems.length, timeMin, timeMax });
};

const handleCreateEvent = async (req: Request) => {
  const input = parseEventInput(await req.json().catch(() => null));
  if (!input) return noStoreJson({ error: 'Invalid Google Calendar event input.' }, 400);
  const access = await getCalendarAccess();
  if ('response' in access) return access.response;
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(access.connection.calendar_id)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildGoogleEventPayload(input)),
  });
  const event = (await response.json().catch(() => ({}))) as GoogleEvent & { error?: { message?: string } };
  if (!response.ok || !event.id) return noStoreJson({ error: event.error?.message || 'Failed to create Google Calendar event.' }, response.status || 500);

  const upsert = await upsertScheduleItem(
    googleEventToScheduleRow(event, {
      member_id: input.memberId || null,
      member_name: input.memberName || null,
    } as Partial<ScheduleItemRow>)
  );
  if ('response' in upsert) return upsert.response;
  return noStoreJson({ item: upsert.item }, 201);
};

export default async (req: Request, _context: Context) => {
  const adminCheck = await requireRaahAdmin(req);
  if (adminCheck.response || !adminCheck.user) return adminCheck.response;
  const pathname = new URL(req.url).pathname;

  if (req.method === 'GET' && pathname.endsWith('/status')) return handleStatus();
  if (req.method === 'GET' && pathname.endsWith('/auth-url')) return handleAuthUrl(req, adminCheck.user);
  if (req.method === 'POST' && pathname.endsWith('/sync')) return handleSync();
  if (req.method === 'POST' && pathname.endsWith('/events')) return handleCreateEvent(req);

  return noStoreJson({ error: 'Method not allowed' }, 405);
};

export const config: Config = {
  path: ['/api/raah/calendar/status', '/api/raah/calendar/auth-url', '/api/raah/calendar/sync', '/api/raah/calendar/events'],
};
