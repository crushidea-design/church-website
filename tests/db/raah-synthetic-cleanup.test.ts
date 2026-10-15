import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Test ("시범") data cleanup: RPCs and HTTP handlers against local Supabase
// (`npm run test:db`). Only Firebase token verification is mocked. All data is fictional.
const url = process.env.RAAH_TEST_SUPABASE_URL;
const serviceKey = process.env.RAAH_TEST_SERVICE_ROLE_KEY;
const anonKey = process.env.RAAH_TEST_ANON_KEY;
const enabled = Boolean(url && serviceKey && anonKey);

const WS = 'default';
const PASTOR = 'uid-synthetic-pastor';
const OUTSIDER = 'uid-synthetic-outsider';

const auth = vi.hoisted(() => ({ uid: 'uid-synthetic-pastor' }));
vi.mock('../../netlify/functions/_shared/raah-auth.mjs', () => ({
  requireRaahAdmin: async () => ({ user: { uid: auth.uid, name: '가상 목양자' } }),
}));
import managementHandler from '../../netlify/functions/raah-management.mts';
import communionHandler from '../../netlify/functions/raah-communion.mts';

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

async function count(table: string, filter: string) {
  return ((await (await db(`${table}?select=*&${filter}`)).json()) as unknown[]).length;
}

async function rpc<T = unknown>(name: string, args: Record<string, unknown>, key = serviceKey!) {
  const response = await db(`rpc/${name}`, { method: 'POST', body: JSON.stringify(args) }, key);
  return { status: response.status, body: (await response.json()) as T & { code?: string } };
}

const deleteMember = (memberId: string, actor = PASTOR) =>
  rpc<Record<string, number>>('raah_rpc_delete_synthetic_member', { p_workspace: WS, p_actor: actor, p_member_id: memberId });
const deletePeriod = (periodId: string, actor = PASTOR) =>
  rpc<Record<string, number>>('raah_rpc_delete_test_period', { p_workspace: WS, p_actor: actor, p_period_id: periodId });

const newMember = (name: string, synthetic: boolean) =>
  insert('raah_members', { name, search_name: name.replace(/\s/g, ''), is_synthetic: synthetic }).then((row) => row.id as string);
const newLog = (memberId: string, name: string) =>
  insert('raah_visitation_logs', {
    member_id: memberId, member_name: name, member_search_name: name.replace(/\s/g, ''), date: '2026-10-05', log_type: '성찬 목양',
    encrypted_payload: { iv: 'x', tag: 'y', ciphertext: 'z' },
  }).then((row) => row.id as string);
const newPeriod = () =>
  insert('raah_communion_periods', {
    name: '가상 주기', starts_on: '2026-10-01', ends_on: '2026-10-25', owner_uid: PASTOR, guide_version: 'draft', created_by: PASTOR,
  }).then((row) => row.id as string);
const newReview = (periodId: string, memberId: string) =>
  insert('raah_communion_reviews', { period_id: periodId, member_id: memberId, assignee_uid: PASTOR, roster_changed_by: PASTOR }).then((row) => row.id as string);
const newSlot = (memberId: string, name: string) =>
  insert('raah_ministry_schedule_items', { title: '목양 일정', date: '2026-10-11', item_type: 'visitation', member_id: memberId, member_name: name }).then((row) => row.id as string);
const newTask = (memberId: string, sourceType: string, sourceId: string | null, scheduleItemId: string | null) =>
  insert('raah_care_tasks', {
    member_id: memberId, source_type: sourceType, source_id: sourceId, assignee_uid: PASTOR, title: '후속 면담',
    schedule_item_id: scheduleItemId, status_changed_by: PASTOR, created_by: PASTOR,
  }).then((row) => row.id as string);

describe.skipIf(!enabled)('raah synthetic cleanup against local Supabase', () => {
  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', url!);
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', serviceKey!);
    vi.stubEnv('RAAH_COMMUNION_ENABLED', 'true');
    vi.stubEnv('RAAH_ENCRYPTION_SECRET', 'local-synthetic-secret-not-used-elsewhere');
    await insert('raah_workspace_access', { firebase_uid: PASTOR, access_role: 'pastor' });
  });
  afterAll(() => vi.unstubAllEnvs());

  describe('raah_rpc_delete_synthetic_member', () => {
    it('deletes the member with everything attached and audits by id only', async () => {
      const member = await newMember('가상 시범성도', true);
      const other = await newMember('가상 실제성도', false);
      const otherLog = await newLog(other, '가상 실제성도');
      const period = await newPeriod();
      const review = await newReview(period, member);
      const log = await newLog(member, '가상 시범성도');
      await insert('raah_communion_review_logs', { review_id: review, visitation_log_id: log, linked_by: PASTOR });
      await insert('raah_member_ecclesial_profiles', { member_id: member });
      const slot = await newSlot(member, '가상 시범성도');
      await newTask(member, 'communion_review', review, slot);
      const strayLog = await newLog(member, '가상 시범성도');
      await insert('raah_follow_up_resolutions', { source_type: 'visitation', source_id: strayLog, candidate_key: `visitation:${strayLog}`, member_id: member });
      const attendanceEvent = await insert('raah_attendance_events', { date: '2026-12-27' });
      await insert('raah_attendance_records', { event_id: attendanceEvent.id, member_id: member, member_name: '가상 시범성도', member_search_name: '가상시범성도' });

      const result = await deleteMember(member);
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      expect(result.body).toEqual({ visitationLogs: 2, reviews: 1, careTasks: 1, scheduleItems: 1 });

      expect(await count('raah_members', `id=eq.${member}`)).toBe(0);
      expect(await count('raah_visitation_logs', `member_id=eq.${member}`)).toBe(0);
      expect(await count('raah_communion_reviews', `member_id=eq.${member}`)).toBe(0);
      expect(await count('raah_communion_review_logs', `review_id=eq.${review}`)).toBe(0);
      expect(await count('raah_member_ecclesial_profiles', `member_id=eq.${member}`)).toBe(0);
      expect(await count('raah_care_tasks', `member_id=eq.${member}`)).toBe(0);
      expect(await count('raah_ministry_schedule_items', `id=eq.${slot}`)).toBe(0);
      expect(await count('raah_follow_up_resolutions', `source_id=eq.${strayLog}`)).toBe(0);
      expect(await count('raah_attendance_records', `member_id=eq.${member}`)).toBe(0);
      // Unrelated data and the period itself stay.
      expect(await count('raah_members', `id=eq.${other}`)).toBe(1);
      expect(await count('raah_visitation_logs', `id=eq.${otherLog}`)).toBe(1);
      expect(await count('raah_communion_periods', `id=eq.${period}`)).toBe(1);

      const [event] = await (await db(`raah_audit_events?target_id=eq.${member}&select=*`)).json();
      expect(event).toMatchObject({ action: 'member.synthetic_delete', target_type: 'member', actor_uid: PASTOR, outcome: 'success' });
      expect(JSON.stringify(event)).not.toContain('시범성도');
    });

    it('refuses a real member with 422 and leaves everything untouched', async () => {
      const member = await newMember('가상 보호성도', false);
      const log = await newLog(member, '가상 보호성도');
      const result = await deleteMember(member);
      expect(result.body.code).toBe('P0422');
      expect(await count('raah_members', `id=eq.${member}`)).toBe(1);
      expect(await count('raah_visitation_logs', `id=eq.${log}`)).toBe(1);
      expect(await count('raah_audit_events', `target_id=eq.${member}`)).toBe(0);
    });

    it('answers 404 for a missing member and 403 without a grant', async () => {
      expect((await deleteMember('00000000-0000-4000-8000-000000000000')).body.code).toBe('P0404');
      const member = await newMember('가상 권한시범', true);
      expect((await deleteMember(member, OUTSIDER)).body.code).toBe('P0403');
      expect(await count('raah_members', `id=eq.${member}`)).toBe(1);
    });
  });

  describe('raah_rpc_delete_test_period', () => {
    it('refuses a period where a real member has a review, even an excluded one', async () => {
      const real = await newMember('가상 주기실제', false);
      const test = await newMember('가상 주기시범', true);
      const period = await newPeriod();
      await newReview(period, test);
      const realReview = await newReview(period, real);
      await db(`raah_communion_reviews?id=eq.${realReview}`, { method: 'PATCH', body: JSON.stringify({ roster_state: 'excluded' }) });

      const result = await deletePeriod(period);
      expect(result.body.code).toBe('P0409');
      expect(await count('raah_communion_periods', `id=eq.${period}`)).toBe(1);
      expect(await count('raah_communion_reviews', `period_id=eq.${period}`)).toBe(2);
    });

    it('deletes a synthetic-only period with its reviews, links, tasks and slots but keeps the logs', async () => {
      const test = await newMember('가상 주기전용', true);
      const period = await newPeriod();
      await insert('raah_communion_occasions', { period_id: period, service_date: '2026-10-25' });
      const review = await newReview(period, test);
      const log = await newLog(test, '가상 주기전용');
      await insert('raah_communion_review_logs', { review_id: review, visitation_log_id: log, linked_by: PASTOR });
      const slot = await newSlot(test, '가상 주기전용');
      await newTask(test, 'communion_review', review, slot);
      // A task from a different source survives.
      const manualTask = await newTask(test, 'manual', null, null);

      const result = await deletePeriod(period);
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      expect(result.body).toEqual({ reviews: 1, careTasks: 1, scheduleItems: 1 });
      expect(await count('raah_communion_periods', `id=eq.${period}`)).toBe(0);
      expect(await count('raah_communion_occasions', `period_id=eq.${period}`)).toBe(0);
      expect(await count('raah_communion_reviews', `period_id=eq.${period}`)).toBe(0);
      expect(await count('raah_communion_review_logs', `review_id=eq.${review}`)).toBe(0);
      expect(await count('raah_ministry_schedule_items', `id=eq.${slot}`)).toBe(0);
      expect(await count('raah_visitation_logs', `id=eq.${log}`)).toBe(1);
      expect(await count('raah_care_tasks', `id=eq.${manualTask}`)).toBe(1);
      expect(await count('raah_audit_events', `target_id=eq.${period}&action=eq.period.test_delete&target_type=eq.communion_period`)).toBe(1);
    });

    it('deletes an empty period, and answers 404 / 403 otherwise', async () => {
      const period = await newPeriod();
      expect((await deletePeriod(period)).body).toEqual({ reviews: 0, careTasks: 0, scheduleItems: 0 });
      expect((await deletePeriod(period)).body.code).toBe('P0404');
      const another = await newPeriod();
      expect((await deletePeriod(another, OUTSIDER)).body.code).toBe('P0403');
      expect(await count('raah_communion_periods', `id=eq.${another}`)).toBe(1);
    });
  });

  it('keeps both functions out of reach of the browser roles', async () => {
    for (const key of [anonKey!]) {
      const member = await rpc('raah_rpc_delete_synthetic_member', { p_workspace: WS, p_actor: PASTOR, p_member_id: '00000000-0000-4000-8000-000000000000' }, key);
      const period = await rpc('raah_rpc_delete_test_period', { p_workspace: WS, p_actor: PASTOR, p_period_id: '00000000-0000-4000-8000-000000000000' }, key);
      expect(member.status).not.toBe(200);
      expect(period.status).not.toBe(200);
      expect(member.body.code).not.toBe('P0404');
      expect(period.body.code).not.toBe('P0404');
    }
  });

  describe('HTTP handlers', () => {
    const manage = (path: string, init: RequestInit & { id?: string } = {}) => {
      const { id, ...rest } = init;
      return managementHandler(
        new Request(`https://raah.test/api/raah/members${path}`, {
          ...rest,
          headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
        }),
        { params: id ? { id } : {} } as never
      ) as Promise<Response>;
    };
    const memberBody = { name: '가상 API성도', status: 'active' };

    it('sets isSynthetic on create only; PATCH cannot flip it either way', async () => {
      const created = await (await manage('', { method: 'POST', body: JSON.stringify({ ...memberBody, isSynthetic: true }) })).json();
      expect(created.member.isSynthetic).toBe(true);
      const real = await (await manage('', { method: 'POST', body: JSON.stringify(memberBody) })).json();
      expect(real.member.isSynthetic).toBe(false);

      const patchReal = await manage(`/${real.member.id}`, { method: 'PATCH', id: real.member.id, body: JSON.stringify({ ...memberBody, name: '가상 API수정', isSynthetic: true }) });
      expect((await patchReal.json()).member).toMatchObject({ name: '가상 API수정', isSynthetic: false });
      const patchTest = await manage(`/${created.member.id}`, { method: 'PATCH', id: created.member.id, body: JSON.stringify({ ...memberBody, isSynthetic: false }) });
      expect((await patchTest.json()).member.isSynthetic).toBe(true);

      const list = await (await manage('')).json();
      expect(list.members.find((item: { id: string }) => item.id === created.member.id).isSynthetic).toBe(true);
    });

    it('deletes a synthetic member over HTTP and refuses a real one', async () => {
      const test = (await (await manage('', { method: 'POST', body: JSON.stringify({ ...memberBody, isSynthetic: true }) })).json()).member.id;
      const real = (await (await manage('', { method: 'POST', body: JSON.stringify(memberBody) })).json()).member.id;
      await newLog(test, '가상 API성도');

      const refused = await manage(`/${real}`, { method: 'DELETE', id: real });
      expect(refused.status).toBe(422);
      expect(await count('raah_members', `id=eq.${real}`)).toBe(1);

      const deleted = await manage(`/${test}`, { method: 'DELETE', id: test });
      expect(deleted.status).toBe(200);
      expect(await deleted.json()).toEqual({ visitationLogs: 1, reviews: 0, careTasks: 0, scheduleItems: 0 });
      expect(await count('raah_members', `id=eq.${test}`)).toBe(0);

      expect((await manage('/not-a-uuid', { method: 'DELETE', id: 'not-a-uuid' })).status).toBe(404);
    });

    it('requires a workspace grant to delete', async () => {
      const test = await newMember('가상 API권한', true);
      auth.uid = OUTSIDER;
      try {
        expect((await manage(`/${test}`, { method: 'DELETE', id: test })).status).toBe(403);
      } finally {
        auth.uid = PASTOR;
      }
      expect(await count('raah_members', `id=eq.${test}`)).toBe(1);
    });

    it('deletes a test period over HTTP and answers 409 when a real member is in it', async () => {
      const call = (id: string) =>
        communionHandler(
          new Request(`https://raah.test/api/raah/communion/periods/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer test' } }),
          { params: { id } } as never
        ) as Promise<Response>;
      const test = await newMember('가상 API주기시범', true);
      const real = await newMember('가상 API주기실제', false);

      const mixed = await newPeriod();
      await newReview(mixed, test);
      await newReview(mixed, real);
      expect((await call(mixed)).status).toBe(409);
      expect(await count('raah_communion_periods', `id=eq.${mixed}`)).toBe(1);

      const clean = await newPeriod();
      await newReview(clean, test);
      const ok = await call(clean);
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({ reviews: 1, careTasks: 0, scheduleItems: 0 });
      expect(await count('raah_communion_periods', `id=eq.${clean}`)).toBe(0);
    });
  });
});
