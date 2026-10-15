import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Church-record facts per member: RPC and HTTP handler against local Supabase
// (`npm run test:db`). Only Firebase token verification is mocked. All names are fictional.
const url = process.env.RAAH_TEST_SUPABASE_URL;
const serviceKey = process.env.RAAH_TEST_SERVICE_ROLE_KEY;
const anonKey = process.env.RAAH_TEST_ANON_KEY;
const enabled = Boolean(url && serviceKey && anonKey);

const WS = 'default';
const PASTOR = 'uid-ecclesial-pastor';
const MISSING = '00000000-0000-4000-8000-000000000000';

const auth = vi.hoisted(() => ({ uid: 'uid-ecclesial-pastor' }));
vi.mock('../../netlify/functions/_shared/raah-auth.mjs', () => ({
  requireRaahAdmin: async (req: Request) =>
    req.headers.get('authorization')
      ? { user: { uid: auth.uid, name: '가상 목양자' } }
      : { response: new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 }) },
}));
import communion from '../../netlify/functions/raah-communion.mts';

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
async function rpc<T = unknown>(name: string, args: Record<string, unknown>, key = serviceKey!) {
  const response = await db(`rpc/${name}`, { method: 'POST', body: JSON.stringify(args) }, key);
  return { status: response.status, body: (await response.json()) as T & { code?: string } };
}
async function call(path: string, init: RequestInit & { params?: Record<string, string> } = {}) {
  const { params, ...rest } = init;
  const response = await communion(
    new Request(`https://raah.test${path}`, { ...rest, headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json', ...(rest.headers || {}) } }),
    { params: params || {} } as never
  );
  return { status: response!.status, body: await response!.json() };
}

type Args = { revision?: number; baptism?: string; profession?: string; communicant?: string; source?: string | null; actor?: string };
const setProfile = (memberId: string, a: Args = {}) =>
  rpc<{ revision: number }>('raah_rpc_set_ecclesial_profile', {
    p_workspace: WS,
    p_actor: a.actor ?? PASTOR,
    p_member_id: memberId,
    p_expected_revision: a.revision ?? 0,
    p_baptism: a.baptism ?? 'unknown',
    p_profession: a.profession ?? 'unknown',
    p_communicant: a.communicant ?? 'unknown',
    p_source_label: a.source === undefined ? null : a.source,
  });
const profileRow = async (memberId: string) => (await (await db(`raah_member_ecclesial_profiles?member_id=eq.${memberId}&select=*`)).json())[0];

let seq = 0;
const newMember = () => {
  seq += 1;
  return insert('raah_members', { name: `가상 기록성도${seq}`, search_name: `가상기록성도${seq}` }).then((row) => row.id as string);
};
const profilePath = (memberId: string) => `/api/raah/communion/members/${memberId}/profile`;
const putProfile = (memberId: string, body: Record<string, unknown>) =>
  call(profilePath(memberId), { method: 'PUT', params: { id: memberId }, body: JSON.stringify(body) });

describe.skipIf(!enabled)('raah ecclesial profile against local Supabase', () => {
  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', url!);
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', serviceKey!);
    vi.stubEnv('RAAH_COMMUNION_ENABLED', 'true');
    vi.stubEnv('RAAH_ENCRYPTION_SECRET', 'local-synthetic-secret-not-used-elsewhere');
    await insert('raah_workspace_access', { firebase_uid: PASTOR, access_role: 'pastor' });
  });
  afterAll(() => vi.unstubAllEnvs());
  beforeEach(() => {
    auth.uid = PASTOR;
  });

  it('inserts revision 1 from expected 0, then updates with the matching revision and audits by id', async () => {
    const member = await newMember();
    const first = await setProfile(member, { baptism: 'baptized', communicant: 'registered', source: '교적부 2026' });
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.revision).toBe(1);
    expect(await profileRow(member)).toMatchObject({
      baptism_status: 'baptized', profession_status: 'unknown', communicant_status: 'registered',
      source_label: '교적부 2026', verified_by: PASTOR, revision: 1,
    });

    const second = await setProfile(member, { revision: 1, baptism: 'baptized', profession: 'confirmed', communicant: 'registered', source: '교적부 2026' });
    expect(second.body.revision).toBe(2);
    expect(await profileRow(member)).toMatchObject({ profession_status: 'confirmed', revision: 2 });

    const events = await (await db(`raah_audit_events?target_id=eq.${member}&action=eq.ecclesial_profile.update&select=*`)).json();
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ target_type: 'member', actor_uid: PASTOR, outcome: 'success' });
    expect(JSON.stringify(events)).not.toContain('교적부');
  });

  it('refuses a stale revision, expected 0 on an existing row, and a non-zero revision when no row exists', async () => {
    const member = await newMember();
    expect((await setProfile(member, { revision: 3 })).body.code).toBe('P0409');
    expect(await profileRow(member)).toBeUndefined();
    expect((await setProfile(member, { baptism: 'not_baptized', source: '교적부' })).status).toBe(200);
    expect((await setProfile(member, { revision: 0, baptism: 'baptized', source: '교적부' })).body.code).toBe('P0409');
    expect((await setProfile(member, { revision: 5, baptism: 'baptized', source: '교적부' })).body.code).toBe('P0409');
    expect((await profileRow(member)).baptism_status).toBe('not_baptized');
  });

  it('requires a source whenever any status is recorded, and trims it', async () => {
    const member = await newMember();
    expect((await setProfile(member, { baptism: 'baptized' })).body.code).toBe('P0422');
    expect((await setProfile(member, { communicant: 'not_registered', source: '   ' })).body.code).toBe('P0422');
    expect((await setProfile(member, { profession: 'preparing', source: 'ㄱ'.repeat(121) })).body.code).toBe('P0422');
    expect(await profileRow(member)).toBeUndefined();
    expect((await setProfile(member, { profession: 'preparing', source: '  교적부 2026  ' })).status).toBe(200);
    expect((await profileRow(member)).source_label).toBe('교적부 2026');
  });

  it('validates enum values and the revision', async () => {
    const member = await newMember();
    expect((await setProfile(member, { baptism: 'sprinkled', source: '교적부' })).body.code).toBe('P0422');
    expect((await setProfile(member, { profession: 'registered', source: '교적부' })).body.code).toBe('P0422');
    expect((await setProfile(member, { communicant: 'confirmed', source: '교적부' })).body.code).toBe('P0422');
    expect((await setProfile(member, { revision: -1 })).body.code).toBe('P0422');
  });

  it('refuses an unknown member and a caller without a grant', async () => {
    expect((await setProfile(MISSING)).body.code).toBe('P0404');
    const member = await newMember();
    expect((await setProfile(member, { actor: 'uid-no-grant' })).body.code).toBe('P0403');
  });

  it('sets verified_at when a status is recorded and clears it (and the source) when everything is unknown again', async () => {
    const member = await newMember();
    await setProfile(member, { communicant: 'registered', source: '교적부' });
    const recorded = await profileRow(member);
    expect(recorded.verified_at).toBeTruthy();
    expect(recorded.verified_by).toBe(PASTOR);

    const cleared = await setProfile(member, { revision: 1 });
    expect(cleared.body.revision).toBe(2);
    expect(await profileRow(member)).toMatchObject({ communicant_status: 'unknown', verified_at: null, verified_by: null, source_label: null, revision: 2 });
  });

  it('cannot be executed with the anon key', async () => {
    const member = await newMember();
    const denied = await rpc(
      'raah_rpc_set_ecclesial_profile',
      { p_workspace: WS, p_actor: PASTOR, p_member_id: member, p_expected_revision: 0, p_baptism: 'baptized', p_profession: 'unknown', p_communicant: 'unknown', p_source_label: '교적부' },
      anonKey!
    );
    expect(denied.status).toBeGreaterThanOrEqual(400);
    expect(await profileRow(member)).toBeUndefined();
  });

  it('serves the all-unknown default with revision 0, then saves and reads back over HTTP', async () => {
    const member = await newMember();
    const empty = await call(profilePath(member), { params: { id: member } });
    expect(empty.status).toBe(200);
    expect(empty.body.profile).toEqual({ baptismStatus: 'unknown', professionStatus: 'unknown', communicantStatus: 'unknown', verifiedAt: null, sourceLabel: '', revision: 0 });

    const saved = await putProfile(member, { expectedRevision: 0, baptismStatus: 'baptized', professionStatus: 'confirmed', communicantStatus: 'registered', sourceLabel: '교적부 2026' });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body).toEqual({ revision: 1 });

    const read = await call(profilePath(member), { params: { id: member } });
    expect(read.body.profile).toMatchObject({ baptismStatus: 'baptized', professionStatus: 'confirmed', communicantStatus: 'registered', sourceLabel: '교적부 2026', revision: 1 });
    expect(read.body.profile.verifiedAt).toBeTruthy();

    expect((await call(profilePath(MISSING), { params: { id: MISSING } })).status).toBe(404);
    expect((await call('/api/raah/communion/members/not-a-uuid/profile', { params: { id: 'not-a-uuid' } })).status).toBe(404);
  });

  it('rejects bad input with 422, a stale revision with 409, and callers without a grant with 403', async () => {
    const member = await newMember();
    const base = { expectedRevision: 0, baptismStatus: 'baptized', professionStatus: 'unknown', communicantStatus: 'unknown', sourceLabel: '교적부' };
    expect((await putProfile(member, { ...base, sourceLabel: '' })).status).toBe(422);
    expect((await putProfile(member, { ...base, baptismStatus: 'sprinkled' })).status).toBe(422);
    expect((await putProfile(member, { ...base, professionStatus: undefined })).status).toBe(422);
    expect((await putProfile(member, { ...base, expectedRevision: -1 })).status).toBe(422);
    expect((await putProfile(member, { ...base, expectedRevision: '0' })).status).toBe(422);
    expect((await putProfile(member, { ...base, sourceLabel: 'ㄱ'.repeat(121) })).status).toBe(422);
    // All unknown needs no source.
    expect((await putProfile(member, { ...base, baptismStatus: 'unknown', sourceLabel: '' })).status).toBe(200);

    const stale = await putProfile(member, { ...base, expectedRevision: 0 });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ code: 'RAAH_REVISION_CONFLICT' });
    expect((await putProfile(MISSING, { ...base })).status).toBe(404);

    auth.uid = 'uid-homepage-admin-only';
    expect((await putProfile(member, { ...base, expectedRevision: 1 })).status).toBe(403);
    expect((await call(profilePath(member), { params: { id: member } })).status).toBe(403);
    expect((await call('/api/raah/communion/profiles')).status).toBe(403);
  });

  it('lists profiles without the source or the verifier', async () => {
    const member = await newMember();
    await putProfile(member, { expectedRevision: 0, baptismStatus: 'baptized', professionStatus: 'preparing', communicantStatus: 'not_registered', sourceLabel: '가상 출처 문구' });
    const listed = await call('/api/raah/communion/profiles');
    expect(listed.status).toBe(200);
    const entry = listed.body.profiles.find((profile: { memberId: string }) => profile.memberId === member);
    expect(entry).toEqual({ memberId: member, baptismStatus: 'baptized', professionStatus: 'preparing', communicantStatus: 'not_registered' });
    const text = JSON.stringify(listed.body);
    expect(text).not.toContain('가상 출처 문구');
    expect(text).not.toContain(PASTOR);
    expect(text).not.toContain('verif');
  });
});
