import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Legacy note (이전) -> visitation log (기록) migration: the HTTP handlers and the RPC
// against local Supabase (`npm run test:db`). Only Firebase token verification is
// mocked. All data is fictional; names carry a per-run tag so parallel files cannot collide.
const url = process.env.RAAH_TEST_SUPABASE_URL;
const serviceKey = process.env.RAAH_TEST_SERVICE_ROLE_KEY;
const anonKey = process.env.RAAH_TEST_ANON_KEY;
const enabled = Boolean(url && serviceKey && anonKey);

const WS = 'default';
const PASTOR = 'uid-legacy-pastor';
const OUTSIDER = 'uid-legacy-outsider';
const SECRET = 'local-test-secret-not-used-anywhere-else';
const TAG = randomUUID().slice(0, 8);

const auth = vi.hoisted(() => ({ uid: 'uid-legacy-pastor' }));
vi.mock('../../netlify/functions/_shared/raah-auth.mjs', () => ({
  requireRaahAdmin: async () => ({ user: { uid: auth.uid, name: '가상 목양자' } }),
}));
import notesHandler, { encryptPayload as encryptLegacy } from '../../netlify/functions/raah-notes.mts';
import managementHandler, { decryptPayload as decryptLog } from '../../netlify/functions/raah-management.mts';

const db = (path: string, init: RequestInit = {}, key = serviceKey!) =>
  fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) },
  });

async function insert(table: string, row: Record<string, unknown>) {
  const response = await db(table, { method: 'POST', body: JSON.stringify(row) });
  expect(response.status, await response.clone().text()).toBe(201);
  return (await response.json())[0];
}

async function select<T = Record<string, unknown>>(path: string) {
  return (await (await db(path)).json()) as T[];
}

async function rpc<T = unknown>(name: string, args: Record<string, unknown>, key = serviceKey!) {
  const response = await db(`rpc/${name}`, { method: 'POST', body: JSON.stringify(args) }, key);
  return { status: response.status, body: (await response.json()) as T & { code?: string } };
}

const migrate = (body: unknown = {}) =>
  notesHandler(
    new Request('https://raah.test/api/raah/notes/migrate', { method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    { params: {} } as never
  ) as Promise<Response>;
const listNotes = () =>
  notesHandler(new Request('https://raah.test/api/raah/notes', { headers: { Authorization: 'Bearer test' } }), { params: {} } as never) as Promise<Response>;
const bootstrap = () =>
  managementHandler(new Request('https://raah.test/api/raah/bootstrap?date=2026-10-04', { headers: { Authorization: 'Bearer test' } }), { params: {} } as never) as Promise<Response>;

const legacyBody = (over: Record<string, string> = {}) => ({
  currentSituation: '가상 현재 상황', encouragement: '', prayerTopics: '가상 기도 제목', nextFollowUpDate: '', remarks: '', ...over,
});
const newNote = (name: string, meetingType: string, payload: unknown, createdAt: string) =>
  insert('raah_notes', {
    member_name: name,
    member_search_name: name.replace(/\s/g, ''),
    date: '2026-03-01',
    meeting_type: meetingType,
    encrypted_payload: payload,
    created_by: { uid: 'uid-old-author', name: '가상 작성자', email: 'author@example.test' },
    created_at: createdAt,
  }).then((row) => row.id as string);

describe.skipIf(!enabled)('legacy note migration against local Supabase', () => {
  const names = {
    matched: `가상 이관${TAG}`,
    twin: `가상 동명${TAG}`,
    test: `가상 시범${TAG}`,
    nobody: `가상 무명${TAG}`,
  };
  const ids: Record<'matched' | 'unknownType' | 'synthetic' | 'nobody' | 'corrupt' | 'tooLong', string> = {} as never;
  let memberId: string;
  const originals: Record<string, unknown> = {};

  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', url!);
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', serviceKey!);
    vi.stubEnv('RAAH_ENCRYPTION_SECRET', SECRET);
    await insert('raah_workspace_access', { firebase_uid: PASTOR, access_role: 'pastor' });
    memberId = (await insert('raah_members', { name: names.matched, search_name: names.matched.replace(/\s/g, '') })).id;
    await insert('raah_members', { name: names.twin, search_name: names.twin.replace(/\s/g, '') });
    await insert('raah_members', { name: names.twin, search_name: names.twin.replace(/\s/g, '') });
    await insert('raah_members', { name: names.test, search_name: names.test.replace(/\s/g, ''), is_synthetic: true });

    ids.matched = await newNote(
      names.matched, '심방',
      encryptLegacy(legacyBody({ encouragement: '가상 권면', nextFollowUpDate: '2026-04-01', remarks: '가상 비고' }), SECRET),
      '2026-03-01T09:00:00Z'
    );
    ids.unknownType = await newNote(names.twin, '가정 방문', encryptLegacy(legacyBody(), SECRET), '2026-03-02T09:00:00Z');
    ids.synthetic = await newNote(names.test, '상담', encryptLegacy(legacyBody(), SECRET), '2026-03-03T09:00:00Z');
    ids.nobody = await newNote(names.nobody, '전화', encryptLegacy(legacyBody(), SECRET), '2026-03-04T09:00:00Z');
    ids.corrupt = await newNote(names.nobody, '심방', { iv: 'eA==', tag: 'eA==', ciphertext: 'eA==' }, '2026-03-05T09:00:00Z');
    ids.tooLong = await newNote(names.nobody, '심방', encryptLegacy(legacyBody({ currentSituation: 'ㄱ'.repeat(5001) }), SECRET), '2026-03-06T09:00:00Z');

    for (const row of await select<{ id: string; encrypted_payload: unknown }>(`raah_notes?select=id,encrypted_payload&id=in.(${Object.values(ids).join(',')})`)) {
      originals[row.id] = row.encrypted_payload;
    }
  });
  afterAll(() => vi.unstubAllEnvs());

  it('refuses callers without a RAAH grant', async () => {
    auth.uid = OUTSIDER;
    try {
      expect((await migrate()).status).toBe(403);
      expect(await select(`raah_notes?select=id&id=eq.${ids.matched}&migrated_to_log_id=is.null`)).toHaveLength(1);
    } finally {
      auth.uid = PASTOR;
    }
  });

  it('moves notes into logs and reports what it had to skip', async () => {
    const response = await migrate();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const result = await response.json();

    expect(result.migrated).toBeGreaterThanOrEqual(4);
    expect(result.skipped).toEqual(expect.arrayContaining([{ id: ids.corrupt, reason: 'decrypt_failed' }, { id: ids.tooLong, reason: 'too_long' }]));
    expect(result.skipped.map((skip: { id: string }) => skip.id)).not.toContain(ids.matched);
    expect(result.remaining).toBe(0);
    expect(JSON.stringify(result)).not.toContain('가상');
  });

  it('writes a four-field body, links the member and keeps author and time', async () => {
    const note = (await select<{ migrated_to_log_id: string; migrated_at: string }>(`raah_notes?select=migrated_to_log_id,migrated_at&id=eq.${ids.matched}`))[0];
    expect(note.migrated_to_log_id).toBeTruthy();
    expect(note.migrated_at).toBeTruthy();

    const log = (await select<Record<string, unknown>>(`raah_visitation_logs?select=*&id=eq.${note.migrated_to_log_id}`))[0];
    expect(log).toMatchObject({ member_id: memberId, member_name: names.matched, date: '2026-03-01', log_type: '심방', public_summary: null, is_encrypted: true, encryption_version: 1 });
    expect(Date.parse(log.created_at as string)).toBe(Date.parse('2026-03-01T09:00:00Z'));
    expect(log.created_by).toEqual({ uid: 'uid-old-author', name: '가상 작성자', email: 'author@example.test' });
    expect(decryptLog(log.encrypted_payload as never, SECRET)).toEqual({
      innerNote: '가상 현재 상황\n\n[권면]\n가상 권면',
      prayerTopics: '가상 기도 제목',
      nextSteps: '다음 확인일: 2026-04-01',
      privateRemarks: '가상 비고',
    });
  });

  it('files an unknown meeting type under 기타 and leaves duplicate, synthetic and unknown names unlinked', async () => {
    const bodyOf = async (noteId: string) => {
      const { migrated_to_log_id } = (await select<{ migrated_to_log_id: string }>(`raah_notes?select=migrated_to_log_id&id=eq.${noteId}`))[0];
      const log = (await select<Record<string, unknown>>(`raah_visitation_logs?select=*&id=eq.${migrated_to_log_id}`))[0];
      return { log, body: decryptLog(log.encrypted_payload as never, SECRET) };
    };

    const unknown = await bodyOf(ids.unknownType);
    expect(unknown.log).toMatchObject({ log_type: '기타', member_id: null });
    expect(unknown.body.innerNote).toBe('[만남 유형] 가정 방문\n\n가상 현재 상황');
    expect((await bodyOf(ids.synthetic)).log).toMatchObject({ log_type: '상담', member_id: null });
    expect((await bodyOf(ids.nobody)).log).toMatchObject({ log_type: '전화', member_id: null });
  });

  it('keeps every original untouched and leaves skipped notes pending', async () => {
    const rows = await select<{ id: string; encrypted_payload: unknown; migrated_to_log_id: string | null }>(
      `raah_notes?select=id,encrypted_payload,migrated_to_log_id&id=in.(${Object.values(ids).join(',')})`
    );
    expect(rows).toHaveLength(6);
    for (const row of rows) expect(row.encrypted_payload).toEqual(originals[row.id]);
    const pending = rows.filter((row) => row.migrated_to_log_id === null).map((row) => row.id).sort();
    expect(pending).toEqual([ids.corrupt, ids.tooLong].sort());
  });

  it('is idempotent: a second run migrates nothing and adds no logs', async () => {
    const countLogs = async () => (await select(`raah_visitation_logs?select=id&member_search_name=like.*${TAG}*`)).length;
    const before = await countLogs();
    const result = await (await migrate({ offset: 2 })).json();
    expect(result.migrated).toBe(0);
    expect(await countLogs()).toBe(before);
    expect(before).toBe(4);

    const again = await (await migrate()).json();
    expect(again.migrated).toBe(0);
    expect(again.skipped).toEqual(expect.arrayContaining([{ id: ids.corrupt, reason: 'decrypt_failed' }]));
    expect(await countLogs()).toBe(before);
  });

  it('hides migrated notes from the legacy list and counts the rest in the bootstrap', async () => {
    const listed = ((await (await listNotes()).json()).notes as Array<{ id: string }>).map((note) => note.id);
    expect(listed).toEqual(expect.arrayContaining([ids.corrupt, ids.tooLong]));
    for (const id of [ids.matched, ids.unknownType, ids.synthetic, ids.nobody]) expect(listed).not.toContain(id);

    const boot = await (await bootstrap()).json();
    expect(boot.legacyPendingCount).toBeGreaterThanOrEqual(2);
    expect(boot.logs.filter((log: { memberSearchName: string }) => log.memberSearchName.includes(TAG))).toHaveLength(4);
  });

  it('is atomic and idempotent per note at the RPC level, and audits by id only', async () => {
    const id = await newNote(names.nobody, '기도', encryptLegacy(legacyBody(), SECRET), '2026-03-07T09:00:00Z');
    const args = {
      p_workspace: WS, p_actor: PASTOR, p_note_id: id, p_member_id: null, p_member_name: names.nobody, p_member_search_name: names.nobody.replace(/\s/g, ''),
      p_date: '2026-03-01', p_log_type: '기도', p_encrypted_payload: { iv: 'a', tag: 'b', ciphertext: 'c' }, p_encryption_version: 1,
    };
    const first = await rpc<{ logId: string; alreadyMigrated: boolean }>('raah_rpc_migrate_legacy_note', args);
    const second = await rpc<{ logId: string; alreadyMigrated: boolean }>('raah_rpc_migrate_legacy_note', args);
    expect(first.body.alreadyMigrated).toBe(false);
    expect(second.body).toEqual({ logId: first.body.logId, alreadyMigrated: true });
    expect(await select(`raah_visitation_logs?select=id&id=eq.${first.body.logId}`)).toHaveLength(1);

    const audits = await select<Record<string, unknown>>(`raah_audit_events?select=*&action=eq.legacy_note.migrate&target_id=eq.${id}`);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ workspace_id: WS, actor_uid: PASTOR, target_type: 'raah_note', outcome: 'success' });

    expect((await rpc('raah_rpc_migrate_legacy_note', { ...args, p_note_id: randomUUID() })).body.code).toBe('P0404');
    expect((await rpc('raah_rpc_migrate_legacy_note', { ...args, p_actor: OUTSIDER })).body.code).toBe('P0403');
  });

  it('keeps the RPC out of reach of the browser roles', async () => {
    const result = await rpc('raah_rpc_migrate_legacy_note', {
      p_workspace: WS, p_actor: PASTOR, p_note_id: ids.corrupt, p_member_id: null, p_member_name: 'x', p_member_search_name: 'x',
      p_date: '2026-03-01', p_log_type: '기타', p_encrypted_payload: {}, p_encryption_version: 1,
    }, anonKey!);
    expect(result.status).not.toBe(200);
    expect(result.body.code).not.toBe('P0404');
    expect(await select(`raah_notes?select=id&id=eq.${ids.corrupt}&migrated_to_log_id=is.null`)).toHaveLength(1);
  });
});
