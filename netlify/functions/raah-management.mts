import type { Config, Context } from '@netlify/functions';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { admin, getAppDb, initializeFirebaseAdmin, jsonResponse } from './_shared/firebase-admin.mjs';

declare const Netlify:
  | {
      env: {
        get: (key: string) => string | undefined;
      };
    }
  | undefined;

type RaahUser = { uid: string; email?: string; name: string };

type MemberInput = {
  name: string;
  birthDate?: string;
  phone?: string;
  address?: string;
  position?: string;
  district?: string;
  registeredAt?: string;
  status: 'active' | 'inactive';
  publicNote?: string;
};

type LogSensitivePayload = {
  innerNote: string;
  prayerTopics: string;
  nextSteps?: string;
  privateRemarks?: string;
};

type LogInput = LogSensitivePayload & {
  memberId?: string;
  memberName: string;
  date: string;
  logType: string;
  publicSummary?: string;
};

type AttendanceInput = {
  date: string;
  serviceType: string;
  includesCommunion: boolean;
  memo?: string;
  records: Array<{
    memberId: string;
    memberName: string;
    attended: boolean;
    communionParticipated: boolean;
    note?: string;
  }>;
};

type EncryptedPayload = {
  iv: string;
  tag: string;
  ciphertext: string;
};

type SupabaseMemberRow = {
  id: string;
  name: string;
  search_name: string;
  birth_date?: string | null;
  phone?: string | null;
  address?: string | null;
  position?: string | null;
  district?: string | null;
  registered_at?: string | null;
  status?: 'active' | 'inactive' | null;
  public_note?: string | null;
  created_at?: string;
  updated_at?: string;
};

type SupabaseLogRow = {
  id: string;
  member_id?: string | null;
  member_name: string;
  member_search_name: string;
  date: string;
  log_type: string;
  public_summary?: string | null;
  encrypted_payload?: EncryptedPayload | string | null;
  encryption_version?: number | null;
  is_encrypted?: boolean | null;
  created_by?: { uid?: string; name?: string; email?: string } | null;
  created_at?: string;
  updated_at?: string;
};

type SupabaseAttendanceEventRow = {
  id: string;
  date: string;
  service_type: string;
  includes_communion?: boolean | null;
  memo?: string | null;
  created_at?: string;
  updated_at?: string;
};

type SupabaseAttendanceRecordRow = {
  id?: string;
  event_id?: string;
  member_id: string;
  member_name: string;
  member_search_name: string;
  attended?: boolean | null;
  communion_participated?: boolean | null;
  note?: string | null;
};

const ADMIN_EMAIL = 'crushidea@gmail.com';
const ENCRYPTION_VERSION = 1;

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
const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR');
const validDate = (value?: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);

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

const getSupabaseConfig = () => {
  const url = getEnv('SUPABASE_URL')?.replace(/\/$/, '');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = getEnv('SUPABASE_ANON_KEY') || getEnv('VITE_SUPABASE_ANON_KEY') || serviceKey;
  const secret = getEnv('RAAH_ENCRYPTION_SECRET');

  if (!url || !serviceKey || !secret) return null;
  return { url, serviceKey, anonKey, secret };
};

const supabaseFetch = async (path: string, init: RequestInit = {}) => {
  const config = getSupabaseConfig();
  if (!config) {
    return {
      response: noStoreJson(
        {
          error: 'RAAH Supabase environment variables are not configured.',
          code: 'RAAH_SUPABASE_NOT_CONFIGURED',
        },
        503
      ),
    };
  }

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.serviceKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  return { config, supabaseResponse: response };
};

const encryptPayload = (payload: LogSensitivePayload, secret: string): EncryptedPayload => {
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
};

const decryptPayload = (payload: EncryptedPayload | string | null | undefined, secret: string): LogSensitivePayload => {
  const encrypted = typeof payload === 'string' ? (JSON.parse(payload) as EncryptedPayload) : payload;
  if (!encrypted?.iv || !encrypted.tag || !encrypted.ciphertext) throw new Error('Encrypted payload is missing or invalid.');

  const key = createHash('sha256').update(secret).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encrypted.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, 'base64')), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext) as LogSensitivePayload;
};

const parseMemberInput = (raw: unknown): MemberInput | null => {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const input: MemberInput = {
    name: cleanText(data.name).replace(/\s+/g, ' '),
    birthDate: cleanText(data.birthDate),
    phone: cleanText(data.phone),
    address: cleanText(data.address),
    position: cleanText(data.position),
    district: cleanText(data.district),
    registeredAt: cleanText(data.registeredAt),
    status: data.status === 'inactive' ? 'inactive' : 'active',
    publicNote: cleanText(data.publicNote),
  };

  if (!input.name || input.name.length > 100 || !validDate(input.birthDate) || !validDate(input.registeredAt)) return null;
  if ([input.phone, input.address, input.position, input.district, input.publicNote].some((value) => (value || '').length > 1000)) return null;
  return input;
};

const parseLogInput = (raw: unknown): LogInput | null => {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const input: LogInput = {
    memberId: cleanText(data.memberId),
    memberName: cleanText(data.memberName).replace(/\s+/g, ' '),
    date: cleanText(data.date),
    logType: cleanText(data.logType),
    publicSummary: cleanText(data.publicSummary),
    innerNote: cleanText(data.innerNote),
    prayerTopics: cleanText(data.prayerTopics),
    nextSteps: cleanText(data.nextSteps),
    privateRemarks: cleanText(data.privateRemarks),
  };

  if (!input.memberName || input.memberName.length > 100 || !validDate(input.date) || !input.date || !input.logType || input.logType.length > 50) return null;
  if (!input.innerNote || !input.prayerTopics || input.innerNote.length > 5000 || input.prayerTopics.length > 5000) return null;
  if ([input.publicSummary, input.nextSteps, input.privateRemarks].some((value) => (value || '').length > 3000)) return null;
  return input;
};

const parseAttendanceInput = (raw: unknown): AttendanceInput | null => {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const records = Array.isArray(data.records) ? data.records : [];
  const input: AttendanceInput = {
    date: cleanText(data.date),
    serviceType: cleanText(data.serviceType) || '주일예배',
    includesCommunion: Boolean(data.includesCommunion),
    memo: cleanText(data.memo),
    records: records
      .map((record) => {
        const row = record && typeof record === 'object' ? (record as Record<string, unknown>) : {};
        return {
          memberId: cleanText(row.memberId),
          memberName: cleanText(row.memberName).replace(/\s+/g, ' '),
          attended: Boolean(row.attended),
          communionParticipated: Boolean(row.communionParticipated),
          note: cleanText(row.note),
        };
      })
      .filter((record) => record.memberId && record.memberName),
  };

  if (!validDate(input.date) || !input.date || input.serviceType.length > 80 || input.memo.length > 1000) return null;
  if (input.records.some((record) => record.memberName.length > 100 || record.note.length > 500)) return null;
  return input;
};

const rowToMember = (row: SupabaseMemberRow) => ({
  id: row.id,
  name: row.name,
  searchName: row.search_name,
  birthDate: row.birth_date || '',
  phone: row.phone || '',
  address: row.address || '',
  position: row.position || '',
  district: row.district || '',
  registeredAt: row.registered_at || '',
  status: row.status || 'active',
  publicNote: row.public_note || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const rowToLog = (row: SupabaseLogRow, includeSensitive = false, secret?: string) => {
  const createdBy = row.created_by || {};
  const sensitive = includeSensitive ? decryptPayload(row.encrypted_payload, secret || '') : undefined;

  return {
    id: row.id,
    memberId: row.member_id || '',
    memberName: row.member_name,
    memberSearchName: row.member_search_name,
    date: row.date,
    logType: row.log_type,
    publicSummary: row.public_summary || '',
    isEncrypted: row.is_encrypted !== false,
    encryptionVersion: row.encryption_version || ENCRYPTION_VERSION,
    createdByName: createdBy.name || createdBy.email || 'Admin',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(sensitive ? { sensitive } : {}),
  };
};

const rowToAttendance = (event: SupabaseAttendanceEventRow, records: SupabaseAttendanceRecordRow[] = []) => ({
  id: event.id,
  date: event.date,
  serviceType: event.service_type,
  includesCommunion: event.includes_communion !== false,
  memo: event.memo || '',
  records: records.map((record) => ({
    id: record.id || '',
    memberId: record.member_id,
    memberName: record.member_name,
    memberSearchName: record.member_search_name,
    attended: record.attended === true,
    communionParticipated: record.communion_participated === true,
    note: record.note || '',
  })),
  createdAt: event.created_at,
  updatedAt: event.updated_at,
});

const handleSummary = async () => {
  const [membersResult, logsResult, attendanceResult] = await Promise.all([
    supabaseFetch('raah_members?select=id,status'),
    supabaseFetch('raah_visitation_logs?select=id,date,is_encrypted'),
    supabaseFetch('raah_attendance_records?select=attended,communion_participated,raah_attendance_events!inner(date)'),
  ]);

  if (membersResult.response) return membersResult.response;
  if (logsResult.response) return logsResult.response;
  if (attendanceResult.response) return attendanceResult.response;

  const members = (await membersResult.supabaseResponse.json().catch(() => [])) as Array<{ status?: string }>;
  const logs = (await logsResult.supabaseResponse.json().catch(() => [])) as Array<{ date?: string; is_encrypted?: boolean }>;
  const attendanceRecords = attendanceResult.supabaseResponse.ok
    ? ((await attendanceResult.supabaseResponse.json().catch(() => [])) as Array<{
    attended?: boolean;
    communion_participated?: boolean;
    raah_attendance_events?: { date?: string };
  }>)
    : [];
  if (!membersResult.supabaseResponse.ok) return noStoreJson({ error: 'Failed to load RAAH members.' }, membersResult.supabaseResponse.status);
  if (!logsResult.supabaseResponse.ok) return noStoreJson({ error: 'Failed to load RAAH logs.' }, logsResult.supabaseResponse.status);
  if (!attendanceResult.supabaseResponse.ok && attendanceResult.supabaseResponse.status !== 404) {
    return noStoreJson({ error: 'Failed to load RAAH attendance.' }, attendanceResult.supabaseResponse.status);
  }

  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  return noStoreJson({
    summary: {
      memberCount: members.length,
      activeMemberCount: members.filter((member) => member.status !== 'inactive').length,
      logCount: logs.length,
      encryptedLogCount: logs.filter((log) => log.is_encrypted !== false).length,
      thisWeekLogCount: logs.filter((log) => log.date && new Date(`${log.date}T00:00:00`) >= weekStart).length,
      thisWeekAttendanceCount: attendanceRecords.filter((record) => record.attended && record.raah_attendance_events?.date && new Date(`${record.raah_attendance_events.date}T00:00:00`) >= weekStart).length,
      thisWeekCommunionCount: attendanceRecords.filter(
        (record) => record.communion_participated && record.raah_attendance_events?.date && new Date(`${record.raah_attendance_events.date}T00:00:00`) >= weekStart
      ).length,
    },
  });
};

const handleListMembers = async () => {
  const result = await supabaseFetch(
    'raah_members?select=id,name,search_name,birth_date,phone,address,position,district,registered_at,status,public_note,created_at,updated_at&order=name.asc'
  );
  if (result.response) return result.response;

  const rows = (await result.supabaseResponse.json().catch(() => [])) as SupabaseMemberRow[];
  if (!result.supabaseResponse.ok) return noStoreJson({ error: 'Failed to load RAAH members.' }, result.supabaseResponse.status);
  return noStoreJson({ members: rows.map(rowToMember) });
};

const handleCreateMember = async (req: Request, user: RaahUser) => {
  const input = parseMemberInput(await req.json().catch(() => null));
  if (!input) return noStoreJson({ error: 'Invalid RAAH member input.' }, 400);

  const result = await supabaseFetch(
    'raah_members?select=id,name,search_name,birth_date,phone,address,position,district,registered_at,status,public_note,created_at,updated_at',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        name: input.name,
        search_name: normalizeName(input.name),
        birth_date: input.birthDate || null,
        phone: input.phone || null,
        address: input.address || null,
        position: input.position || null,
        district: input.district || null,
        registered_at: input.registeredAt || null,
        status: input.status,
        public_note: input.publicNote || null,
        created_by: { uid: user.uid, email: user.email || '', name: user.name },
      }),
    }
  );
  if (result.response) return result.response;

  const rows = (await result.supabaseResponse.json().catch(() => [])) as SupabaseMemberRow[];
  if (!result.supabaseResponse.ok) return noStoreJson({ error: 'Failed to create RAAH member.' }, result.supabaseResponse.status);
  return noStoreJson({ member: rowToMember(rows[0]) }, 201);
};

const handleUpdateMember = async (req: Request, memberId: string) => {
  const input = parseMemberInput(await req.json().catch(() => null));
  if (!input) return noStoreJson({ error: 'Invalid RAAH member input.' }, 400);

  const result = await supabaseFetch(
    `raah_members?select=id,name,search_name,birth_date,phone,address,position,district,registered_at,status,public_note,created_at,updated_at&id=eq.${encodeURIComponent(memberId)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        name: input.name,
        search_name: normalizeName(input.name),
        birth_date: input.birthDate || null,
        phone: input.phone || null,
        address: input.address || null,
        position: input.position || null,
        district: input.district || null,
        registered_at: input.registeredAt || null,
        status: input.status,
        public_note: input.publicNote || null,
      }),
    }
  );
  if (result.response) return result.response;

  const rows = (await result.supabaseResponse.json().catch(() => [])) as SupabaseMemberRow[];
  if (!result.supabaseResponse.ok) return noStoreJson({ error: 'Failed to update RAAH member.' }, result.supabaseResponse.status);
  if (!rows[0]) return noStoreJson({ error: 'RAAH member not found.' }, 404);
  return noStoreJson({ member: rowToMember(rows[0]) });
};

const handleListLogs = async () => {
  const result = await supabaseFetch(
    'raah_visitation_logs?select=id,member_id,member_name,member_search_name,date,log_type,public_summary,encryption_version,is_encrypted,created_by,created_at,updated_at&order=date.desc&order=created_at.desc'
  );
  if (result.response) return result.response;

  const rows = (await result.supabaseResponse.json().catch(() => [])) as SupabaseLogRow[];
  if (!result.supabaseResponse.ok) return noStoreJson({ error: 'Failed to load RAAH visitation logs.' }, result.supabaseResponse.status);
  return noStoreJson({ logs: rows.map((row) => rowToLog(row)) });
};

const handleLogDetail = async (logId: string) => {
  const result = await supabaseFetch(
    `raah_visitation_logs?select=id,member_id,member_name,member_search_name,date,log_type,public_summary,encrypted_payload,encryption_version,is_encrypted,created_by,created_at,updated_at&id=eq.${encodeURIComponent(logId)}&limit=1`
  );
  if (result.response) return result.response;

  const rows = (await result.supabaseResponse.json().catch(() => [])) as SupabaseLogRow[];
  if (!result.supabaseResponse.ok) return noStoreJson({ error: 'Failed to load RAAH visitation log.' }, result.supabaseResponse.status);
  if (!rows[0]) return noStoreJson({ error: 'RAAH visitation log not found.' }, 404);

  try {
    return noStoreJson({ log: rowToLog(rows[0], true, result.config.secret) });
  } catch {
    return noStoreJson({ error: 'Failed to decrypt RAAH visitation log.' }, 500);
  }
};

const handleCreateLog = async (req: Request, user: RaahUser) => {
  const input = parseLogInput(await req.json().catch(() => null));
  if (!input) return noStoreJson({ error: 'Invalid RAAH visitation log input.' }, 400);

  const config = getSupabaseConfig();
  if (!config) {
    return noStoreJson(
      {
        error: 'RAAH Supabase environment variables are not configured.',
        code: 'RAAH_SUPABASE_NOT_CONFIGURED',
      },
      503
    );
  }

  const memberName = input.memberName.trim().replace(/\s+/g, ' ');
  const encryptedPayload = encryptPayload(
    {
      innerNote: input.innerNote,
      prayerTopics: input.prayerTopics,
      nextSteps: input.nextSteps || '',
      privateRemarks: input.privateRemarks || '',
    },
    config.secret
  );

  const result = await supabaseFetch(
    'raah_visitation_logs?select=id,member_id,member_name,member_search_name,date,log_type,public_summary,encrypted_payload,encryption_version,is_encrypted,created_by,created_at,updated_at',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        member_id: input.memberId || null,
        member_name: memberName,
        member_search_name: normalizeName(memberName),
        date: input.date,
        log_type: input.logType,
        public_summary: input.publicSummary || null,
        encrypted_payload: encryptedPayload,
        encryption_version: ENCRYPTION_VERSION,
        is_encrypted: true,
        created_by: { uid: user.uid, email: user.email || '', name: user.name },
      }),
    }
  );
  if (result.response) return result.response;

  const rows = (await result.supabaseResponse.json().catch(() => [])) as SupabaseLogRow[];
  if (!result.supabaseResponse.ok) return noStoreJson({ error: 'Failed to create RAAH visitation log.' }, result.supabaseResponse.status);
  return noStoreJson({ log: rowToLog(rows[0], true, config.secret) }, 201);
};

const handleGetAttendance = async (req: Request) => {
  const date = new URL(req.url).searchParams.get('date') || new Date().toISOString().slice(0, 10);
  if (!validDate(date)) return noStoreJson({ error: 'Invalid attendance date.' }, 400);

  const eventResult = await supabaseFetch(
    `raah_attendance_events?select=id,date,service_type,includes_communion,memo,created_at,updated_at&date=eq.${encodeURIComponent(date)}&order=created_at.desc&limit=1`
  );
  if (eventResult.response) return eventResult.response;

  const events = (await eventResult.supabaseResponse.json().catch(() => [])) as SupabaseAttendanceEventRow[];
  if (!eventResult.supabaseResponse.ok) return noStoreJson({ error: 'Failed to load RAAH attendance event.' }, eventResult.supabaseResponse.status);
  if (!events[0]) return noStoreJson({ attendance: null });

  const recordsResult = await supabaseFetch(
    `raah_attendance_records?select=id,event_id,member_id,member_name,member_search_name,attended,communion_participated,note&event_id=eq.${encodeURIComponent(events[0].id)}&order=member_name.asc`
  );
  if (recordsResult.response) return recordsResult.response;

  const records = (await recordsResult.supabaseResponse.json().catch(() => [])) as SupabaseAttendanceRecordRow[];
  if (!recordsResult.supabaseResponse.ok) return noStoreJson({ error: 'Failed to load RAAH attendance records.' }, recordsResult.supabaseResponse.status);

  return noStoreJson({ attendance: rowToAttendance(events[0], records) });
};

const handleSaveAttendance = async (req: Request, user: RaahUser) => {
  const input = parseAttendanceInput(await req.json().catch(() => null));
  if (!input) return noStoreJson({ error: 'Invalid RAAH attendance input.' }, 400);

  const eventResult = await supabaseFetch(
    'raah_attendance_events?select=id,date,service_type,includes_communion,memo,created_at,updated_at',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        date: input.date,
        service_type: input.serviceType,
        includes_communion: input.includesCommunion,
        memo: input.memo || null,
        created_by: { uid: user.uid, email: user.email || '', name: user.name },
      }),
    }
  );
  if (eventResult.response) return eventResult.response;

  const events = (await eventResult.supabaseResponse.json().catch(() => [])) as SupabaseAttendanceEventRow[];
  if (!eventResult.supabaseResponse.ok) return noStoreJson({ error: 'Failed to save RAAH attendance event.' }, eventResult.supabaseResponse.status);
  const event = events[0];
  if (!event) return noStoreJson({ error: 'RAAH attendance event was not saved.' }, 500);

  const deleteResult = await supabaseFetch(`raah_attendance_records?event_id=eq.${encodeURIComponent(event.id)}`, { method: 'DELETE' });
  if (deleteResult.response) return deleteResult.response;
  if (!deleteResult.supabaseResponse.ok) return noStoreJson({ error: 'Failed to reset RAAH attendance records.' }, deleteResult.supabaseResponse.status);

  const rowsToInsert = input.records.map((record) => ({
    event_id: event.id,
    member_id: record.memberId,
    member_name: record.memberName,
    member_search_name: normalizeName(record.memberName),
    attended: record.attended,
    communion_participated: input.includesCommunion ? record.communionParticipated : false,
    note: record.note || null,
    created_by: { uid: user.uid, email: user.email || '', name: user.name },
  }));

  if (rowsToInsert.length === 0) return noStoreJson({ attendance: rowToAttendance(event, []) });

  const recordsResult = await supabaseFetch(
    'raah_attendance_records?select=id,event_id,member_id,member_name,member_search_name,attended,communion_participated,note',
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(rowsToInsert),
    }
  );
  if (recordsResult.response) return recordsResult.response;

  const records = (await recordsResult.supabaseResponse.json().catch(() => [])) as SupabaseAttendanceRecordRow[];
  if (!recordsResult.supabaseResponse.ok) return noStoreJson({ error: 'Failed to save RAAH attendance records.' }, recordsResult.supabaseResponse.status);

  return noStoreJson({ attendance: rowToAttendance(event, records) });
};

export default async (req: Request, context: Context) => {
  const adminCheck = await requireRaahAdmin(req);
  if (adminCheck.response || !adminCheck.user) return adminCheck.response;

  const pathname = new URL(req.url).pathname;
  const route = pathname.includes('/attendance')
    ? 'attendance'
    : pathname.includes('/visitation-logs')
      ? 'visitation-logs'
      : pathname.includes('/members')
        ? 'members'
        : pathname.includes('/summary')
          ? 'summary'
          : '';
  const id = context.params?.id;

  if (req.method === 'GET' && route === 'summary') return handleSummary();
  if (route === 'attendance' && req.method === 'GET') return handleGetAttendance(req);
  if (route === 'attendance' && req.method === 'POST') return handleSaveAttendance(req, adminCheck.user);
  if (route === 'members' && req.method === 'GET' && !id) return handleListMembers();
  if (route === 'members' && req.method === 'POST' && !id) return handleCreateMember(req, adminCheck.user);
  if (route === 'members' && req.method === 'PATCH' && id) return handleUpdateMember(req, id);
  if (route === 'visitation-logs' && req.method === 'GET' && !id) return handleListLogs();
  if (route === 'visitation-logs' && req.method === 'GET' && id) return handleLogDetail(id);
  if (route === 'visitation-logs' && req.method === 'POST' && !id) return handleCreateLog(req, adminCheck.user);

  return noStoreJson({ error: 'Method not allowed' }, 405);
};

export const config: Config = {
  path: ['/api/raah/summary', '/api/raah/members', '/api/raah/members/:id', '/api/raah/visitation-logs', '/api/raah/visitation-logs/:id', '/api/raah/attendance'],
};
