import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import admin from 'firebase-admin';

const FIRESTORE_DATABASE_ID = 'ai-studio-718ae15e-9471-4be1-ad56-c48181aa8613';
const ENCRYPTION_VERSION = 1;
const apply = process.argv.includes('--apply');
const sqlOutput = process.argv.includes('--sql');

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseServiceAccount(raw) {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === 'string' ? parseServiceAccount(parsed) : parsed;
  } catch {
    return JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
  }
}

function normalizeMemberName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR');
}

function encryptPayload(payload, secret) {
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
}

function timestampToIso(value) {
  if (!value) return undefined;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return undefined;
}

const supabaseUrl = requiredEnv('SUPABASE_URL').replace(/\/$/, '');
const supabaseServiceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || supabaseServiceRoleKey;
const encryptionSecret = requiredEnv('RAAH_ENCRYPTION_SECRET');
const serviceAccount = parseServiceAccount(requiredEnv('FIREBASE_SERVICE_ACCOUNT_KEY'));

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore(app);
firestore.settings({ databaseId: FIRESTORE_DATABASE_ID });
const snapshot = await firestore.collection('pastoral_notes').orderBy('date', 'desc').get();

const rows = snapshot.docs.map((doc) => {
  const data = doc.data();
  const memberName = String(data.memberName || '').trim().replace(/\s+/g, ' ');
  return {
    member_name: memberName,
    member_search_name: String(data.memberSearchName || normalizeMemberName(memberName)),
    date: data.date,
    meeting_type: String(data.meetingType || '기타'),
    encrypted_payload: encryptPayload(
      {
        currentSituation: String(data.currentSituation || ''),
        encouragement: String(data.encouragement || ''),
        prayerTopics: String(data.prayerTopics || ''),
        nextFollowUpDate: String(data.nextFollowUpDate || ''),
        remarks: String(data.remarks || ''),
      },
      encryptionSecret
    ),
    encryption_version: ENCRYPTION_VERSION,
    is_encrypted: true,
    created_by: {
      uid: String(data.createdByUid || ''),
      name: String(data.createdByName || 'Admin'),
    },
    created_at: timestampToIso(data.createdAt),
    updated_at: timestampToIso(data.updatedAt),
  };
});

const log = sqlOutput ? console.error : console.log;
log(`RAAH migration ${apply ? 'apply' : 'dry-run'}: ${rows.length} Firestore notes found.`);
log(`First rows preview: ${rows.slice(0, 3).map((row) => `${row.date} ${row.member_name}`).join(', ') || 'none'}`);

if (sqlOutput) {
  const values = rows.map((row) => {
    const literal = (value) => (value == null ? 'null' : toSqlUnicodeLiteral(String(value)));
    const jsonLiteral = (value) => `'${escapeJsonAscii(JSON.stringify(value)).replace(/'/g, "''")}'::jsonb`;
    return `(${[
      literal(row.member_name),
      literal(row.member_search_name),
      literal(row.date),
      literal(row.meeting_type),
      jsonLiteral(row.encrypted_payload),
      row.encryption_version,
      row.is_encrypted ? 'true' : 'false',
      jsonLiteral(row.created_by),
      literal(row.created_at),
      literal(row.updated_at),
    ].join(', ')})`;
  });

  console.log('');
  console.log('begin;');
  console.log(`insert into public.raah_notes (
  member_name,
  member_search_name,
  date,
  meeting_type,
  encrypted_payload,
  encryption_version,
  is_encrypted,
  created_by,
  created_at,
  updated_at
) values`);
  console.log(values.join(',\n'));
  console.log(';');
  console.log('commit;');
  process.exit(0);
}

function toSqlUnicodeLiteral(value) {
  let output = '';
  for (const char of value) {
    if (char === "'") {
      output += "''";
      continue;
    }

    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) continue;
    if (codePoint >= 0x20 && codePoint <= 0x7e && char !== '\\') {
      output += char;
      continue;
    }

    if (codePoint <= 0xffff) {
      output += `\\${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
    } else {
      const adjusted = codePoint - 0x10000;
      const high = 0xd800 + (adjusted >> 10);
      const low = 0xdc00 + (adjusted & 0x3ff);
      output += `\\${high.toString(16).toUpperCase()}\\${low.toString(16).toUpperCase()}`;
    }
  }

  return `U&'${output}'`;
}

function escapeJsonAscii(value) {
  return value.replace(/[^\x20-\x7E]/g, (char) => {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) return '';
    if (codePoint <= 0xffff) {
      return `\\u${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
    }

    const adjusted = codePoint - 0x10000;
    const high = 0xd800 + (adjusted >> 10);
    const low = 0xdc00 + (adjusted & 0x3ff);
    return `\\u${high.toString(16).toUpperCase()}\\u${low.toString(16).toUpperCase()}`;
  });
}

if (!apply) {
  console.log('Dry-run only. Re-run with --apply to insert encrypted rows into Supabase.');
  process.exit(0);
}

for (let index = 0; index < rows.length; index += 100) {
  const chunk = rows.slice(index, index + 100);
  const response = await fetch(`${supabaseUrl}/rest/v1/raah_notes`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(chunk),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase insert failed at row ${index}: ${response.status} ${text}`);
  }
}

console.log(`Inserted ${rows.length} encrypted RAAH rows into Supabase.`);
