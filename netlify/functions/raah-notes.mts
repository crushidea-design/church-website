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

type PastoralNotePayload = {
  currentSituation: string;
  encouragement: string;
  prayerTopics: string;
  nextFollowUpDate?: string;
  remarks?: string;
};

type PastoralNoteInput = PastoralNotePayload & {
  memberName: string;
  date: string;
  meetingType: string;
};

type SupabaseRow = {
  id: string;
  member_name: string;
  member_search_name: string;
  date: string;
  meeting_type: string;
  encrypted_payload?: EncryptedPayload | string | null;
  encryption_version?: number | null;
  is_encrypted?: boolean | null;
  created_by?: { uid?: string; name?: string; email?: string } | null;
  created_at?: string;
  updated_at?: string;
};

type EncryptedPayload = {
  iv: string;
  tag: string;
  ciphertext: string;
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

const normalizeMemberName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR');

const cleanText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const parseInput = (raw: unknown): PastoralNoteInput | null => {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const input = {
    memberName: cleanText(data.memberName),
    date: cleanText(data.date),
    meetingType: cleanText(data.meetingType),
    currentSituation: cleanText(data.currentSituation),
    encouragement: cleanText(data.encouragement),
    prayerTopics: cleanText(data.prayerTopics),
    nextFollowUpDate: cleanText(data.nextFollowUpDate),
    remarks: cleanText(data.remarks),
  };

  if (
    !input.memberName ||
    input.memberName.length > 100 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
    !input.meetingType ||
    input.meetingType.length > 50 ||
    !input.currentSituation ||
    !input.encouragement ||
    !input.prayerTopics ||
    input.currentSituation.length > 5000 ||
    input.encouragement.length > 5000 ||
    input.prayerTopics.length > 5000 ||
    input.remarks.length > 2000 ||
    (input.nextFollowUpDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.nextFollowUpDate))
  ) {
    return null;
  }

  return input;
};

const getBearerToken = (req: Request) => {
  const authHeader = req.headers.get('authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
};

const requireRaahAdmin = async (req: Request) => {
  const token = getBearerToken(req);
  if (!token) return { response: jsonResponse({ error: 'Authentication required' }, 401) };

  const firebaseReady = initializeFirebaseAdmin();
  if (firebaseReady) {
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      if (decoded.email === ADMIN_EMAIL) return { user: { uid: decoded.uid, email: decoded.email, name: decoded.name || decoded.email || 'Admin' } };

      const userDoc = await getAppDb().collection('users').doc(decoded.uid).get();
      if (userDoc.exists && userDoc.data()?.role === 'admin') {
        return { user: { uid: decoded.uid, email: decoded.email, name: decoded.name || decoded.email || 'Admin' } };
      }
    } catch {
      // The transition period allows Supabase Auth tokens too, so continue below.
    }
  }

  const supabaseUser = await getSupabaseAuthUser(token);
  if (supabaseUser?.isAdmin) {
    return { user: { uid: supabaseUser.id, email: supabaseUser.email, name: supabaseUser.name || supabaseUser.email || 'Admin' } };
  }

  return { response: jsonResponse({ error: 'Admin permission required' }, 403) };
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

const getSupabaseConfig = () => {
  const url = getEnv('SUPABASE_URL')?.replace(/\/$/, '');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = getEnv('SUPABASE_ANON_KEY') || getEnv('VITE_SUPABASE_ANON_KEY') || serviceKey;
  const secret = getEnv('RAAH_ENCRYPTION_SECRET');

  if (!url || !serviceKey || !secret) {
    return null;
  }

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

const encryptPayload = (payload: PastoralNotePayload, secret: string): EncryptedPayload => {
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

const decryptPayload = (payload: EncryptedPayload | string | null | undefined, secret: string): PastoralNotePayload => {
  const encrypted = typeof payload === 'string' ? (JSON.parse(payload) as EncryptedPayload) : payload;
  if (!encrypted?.iv || !encrypted.tag || !encrypted.ciphertext) {
    throw new Error('Encrypted payload is missing or invalid.');
  }

  const key = createHash('sha256').update(secret).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encrypted.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, 'base64')), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext) as PastoralNotePayload;
};

const rowToNote = (row: SupabaseRow, includeSensitive = false, secret?: string) => {
  const createdBy = row.created_by || {};
  const sensitive = includeSensitive ? decryptPayload(row.encrypted_payload, secret || '') : undefined;

  return {
    id: row.id,
    memberName: row.member_name,
    memberSearchName: row.member_search_name,
    date: row.date,
    meetingType: row.meeting_type,
    createdByUid: createdBy.uid || '',
    createdByName: createdBy.name || createdBy.email || 'Admin',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isEncrypted: row.is_encrypted !== false,
    encryptionVersion: row.encryption_version || ENCRYPTION_VERSION,
    ...(sensitive ? { sensitive } : {}),
  };
};

const handleList = async () => {
  const result = await supabaseFetch(
    'raah_notes?select=id,member_name,member_search_name,date,meeting_type,encryption_version,is_encrypted,created_by,created_at,updated_at&order=date.desc&order=created_at.desc'
  );
  if (result.response) return result.response;

  const rows = (await result.supabaseResponse.json().catch(() => [])) as SupabaseRow[];
  if (!result.supabaseResponse.ok) return noStoreJson({ error: 'Failed to load RAAH notes.' }, result.supabaseResponse.status);

  return noStoreJson({ notes: rows.map((row) => rowToNote(row)) });
};

const handleDetail = async (noteId: string) => {
  const result = await supabaseFetch(
    `raah_notes?select=id,member_name,member_search_name,date,meeting_type,encrypted_payload,encryption_version,is_encrypted,created_by,created_at,updated_at&id=eq.${encodeURIComponent(noteId)}&limit=1`
  );
  if (result.response) return result.response;

  const rows = (await result.supabaseResponse.json().catch(() => [])) as SupabaseRow[];
  if (!result.supabaseResponse.ok) return noStoreJson({ error: 'Failed to load RAAH note.' }, result.supabaseResponse.status);
  if (!rows[0]) return noStoreJson({ error: 'RAAH note not found.' }, 404);

  try {
    return noStoreJson({ note: rowToNote(rows[0], true, result.config.secret) });
  } catch {
    return noStoreJson({ error: 'Failed to decrypt RAAH note.' }, 500);
  }
};

const handleCreate = async (req: Request, user: { uid: string; email?: string; name: string }) => {
  const input = parseInput(await req.json().catch(() => null));
  if (!input) return noStoreJson({ error: 'Invalid RAAH note input.' }, 400);

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
      currentSituation: input.currentSituation,
      encouragement: input.encouragement,
      prayerTopics: input.prayerTopics,
      nextFollowUpDate: input.nextFollowUpDate || '',
      remarks: input.remarks || '',
    },
    config.secret
  );

  const result = await supabaseFetch('raah_notes?select=id,member_name,member_search_name,date,meeting_type,encrypted_payload,encryption_version,is_encrypted,created_by,created_at,updated_at', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      member_name: memberName,
      member_search_name: normalizeMemberName(memberName),
      date: input.date,
      meeting_type: input.meetingType,
      encrypted_payload: encryptedPayload,
      encryption_version: ENCRYPTION_VERSION,
      is_encrypted: true,
      created_by: {
        uid: user.uid,
        email: user.email || '',
        name: user.name,
      },
    }),
  });
  if (result.response) return result.response;

  const rows = (await result.supabaseResponse.json().catch(() => [])) as SupabaseRow[];
  if (!result.supabaseResponse.ok) return noStoreJson({ error: 'Failed to create RAAH note.' }, result.supabaseResponse.status);

  return noStoreJson({ note: rowToNote(rows[0], true, config.secret) }, 201);
};

const handleDelete = async (noteId: string) => {
  const result = await supabaseFetch(`raah_notes?id=eq.${encodeURIComponent(noteId)}`, {
    method: 'DELETE',
  });
  if (result.response) return result.response;
  if (!result.supabaseResponse.ok) return noStoreJson({ error: 'Failed to delete RAAH note.' }, result.supabaseResponse.status);

  return noStoreJson({ ok: true });
};

export default async (req: Request, context: Context) => {
  const adminCheck = await requireRaahAdmin(req);
  if (adminCheck.response) return adminCheck.response;

  const noteId = context.params?.id;

  if (req.method === 'GET' && noteId) return handleDetail(noteId);
  if (req.method === 'GET') return handleList();
  if (req.method === 'POST' && !noteId) return handleCreate(req, adminCheck.user);
  if (req.method === 'DELETE' && noteId) return handleDelete(noteId);

  return noStoreJson({ error: 'Method not allowed' }, 405);
};

export const config: Config = {
  path: ['/api/raah/notes', '/api/raah/notes/:id'],
};
