import { beforeAll, describe, expect, it } from 'vitest';

// Runs only through `npm run test:db` against the local Supabase stack.
// All names are fictional; no pastoral content is written.
const url = process.env.RAAH_TEST_SUPABASE_URL;
const serviceKey = process.env.RAAH_TEST_SERVICE_ROLE_KEY;
const anonKey = process.env.RAAH_TEST_ANON_KEY;
const enabled = Boolean(url && serviceKey && anonKey);

const WS = 'default';
const PASTOR = 'uid-communion-pastor';
const OTHER_WS = 'other-church';

function rest(path: string, init: RequestInit = {}, key = serviceKey!) {
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...init.headers,
    },
  });
}

async function rpc<T>(name: string, args: Record<string, unknown>, key = serviceKey!) {
  const response = await rest(`rpc/${name}`, { method: 'POST', body: JSON.stringify(args) }, key);
  const body = await response.json();
  return { status: response.status, body: body as T & { code?: string; message?: string } };
}

async function insert(table: string, row: Record<string, unknown>) {
  const response = await rest(table, { method: 'POST', body: JSON.stringify(row) });
  expect(response.status, await response.clone().text()).toBe(201);
  return (await response.json())[0];
}

async function count(table: string, filter: string) {
  const response = await rest(`${table}?select=*&${filter}`);
  return ((await response.json()) as unknown[]).length;
}

let keySeq = 0;
const createPeriodAs = (key: string) =>
  rpc<string>('raah_rpc_create_communion_period', {
    p_workspace: WS, p_actor: PASTOR, p_idempotency_key: 'anon-attempt-01', p_request_hash: 'hash-anon-01',
    p_name: '가상', p_starts_on: '2026-10-01', p_ends_on: '2026-10-25', p_guide_version: 'draft-2026-09',
  }, key);
const createPeriod = (overrides: Record<string, unknown> = {}) =>
  rpc<string>('raah_rpc_create_communion_period', {
    p_workspace: WS,
    p_actor: PASTOR,
    p_idempotency_key: `period-key-${++keySeq}-${Date.now()}`,
    p_request_hash: 'hash-0000001',
    p_name: '가을 목양 주기',
    p_starts_on: '2026-10-01',
    p_ends_on: '2026-10-25',
    p_guide_version: 'draft-2026-09',
    ...overrides,
  });

describe.skipIf(!enabled)('RAAH communion schema and RPCs (local Supabase only)', () => {
  let memberA: string;
  let memberB: string;

  beforeAll(async () => {
    await insert('raah_workspace_access', { firebase_uid: PASTOR, access_role: 'pastor' });
    await insert('raah_workspace_access', { workspace_id: OTHER_WS, firebase_uid: PASTOR, access_role: 'pastor' });
    memberA = (await insert('raah_members', { name: '가상 성도 가', search_name: '가상성도가' })).id;
    memberB = (await insert('raah_members', { name: '가상 성도 나', search_name: '가상성도나' })).id;
  });

  describe('create period', () => {
    it('creates a period with its service, an idempotency record and an audit event', async () => {
      const result = await createPeriod({ p_service_date: '2026-10-25' });
      expect(result.status).toBe(200);
      const periodId = result.body;
      expect(await count('raah_communion_occasions', `period_id=eq.${periodId}`)).toBe(1);
      expect(await count('raah_audit_events', `target_id=eq.${periodId}&action=eq.communion_period.create`)).toBe(1);
    });

    it('returns the same period when the same request is retried', async () => {
      const args = { p_idempotency_key: 'retry-key-0001', p_request_hash: 'hash-retry-1' };
      const first = await createPeriod(args);
      const second = await createPeriod(args);
      expect(second.body).toBe(first.body);
      expect(await count('raah_audit_events', `target_id=eq.${first.body}`)).toBe(1);
    });

    it('rejects a reused key with a different request', async () => {
      await createPeriod({ p_idempotency_key: 'reuse-key-0001', p_request_hash: 'hash-aaaaaaa' });
      const reused = await createPeriod({ p_idempotency_key: 'reuse-key-0001', p_request_hash: 'hash-bbbbbbb' });
      expect(reused.body.code).toBe('P0422');
    });

    it('rolls back everything when a later insert fails', async () => {
      const before = await count('raah_communion_periods', 'name=eq.롤백 확인');
      const failed = await createPeriod({
        p_name: '롤백 확인',
        p_idempotency_key: 'rollback-key-01',
        p_service_date: '2026-10-25',
        p_attendance_event_id: '00000000-0000-0000-0000-000000000000',
      });
      expect(failed.body.code).toBe('23503'); // unknown attendance event → foreign key violation
      expect(await count('raah_communion_periods', 'name=eq.롤백 확인')).toBe(before);
      expect(await count('raah_idempotency_keys', 'key=eq.rollback-key-01')).toBe(0);
    });

    it('refuses callers without an active grant', async () => {
      const denied = await createPeriod({ p_actor: 'uid-homepage-admin-only' });
      expect(denied.body.code).toBe('P0403');
    });

    it('validates dates', async () => {
      expect((await createPeriod({ p_service_date: '2026-11-30' })).body.code).toBe('P0422');
      expect((await createPeriod({ p_ends_on: '2026-09-01' })).body.code).toBe('23514');
    });
  });

  describe('roster', () => {
    let periodId: string;
    beforeAll(async () => {
      periodId = (await createPeriod()).body;
    });

    const setRoster = (memberId: string, included: boolean, overrides: Record<string, unknown> = {}) =>
      rpc<string>('raah_rpc_set_roster_entry', {
        p_workspace: WS,
        p_actor: PASTOR,
        p_period_id: periodId,
        p_member_id: memberId,
        p_included: included,
        ...overrides,
      });

    it('adds a member once however often the roster is reloaded', async () => {
      const first = await setRoster(memberA, true);
      const again = await setRoster(memberA, true);
      expect(again.body).toBe(first.body);
      expect(await count('raah_communion_reviews', `period_id=eq.${periodId}&member_id=eq.${memberA}`)).toBe(1);
    });

    it('keeps an excluded member as history and can include them again', async () => {
      const reviewId = (await setRoster(memberB, true)).body;
      await setRoster(memberB, false);
      const excluded = await (await rest(`raah_communion_reviews?id=eq.${reviewId}&select=roster_state`)).json();
      expect(excluded[0].roster_state).toBe('excluded');
      expect((await setRoster(memberB, true)).body).toBe(reviewId);
    });

    it('does not find periods in another workspace', async () => {
      const result = await setRoster(memberA, true, { p_workspace: OTHER_WS });
      expect(result.body.code).toBe('P0404');
    });

    it('refuses changes after the period is closed', async () => {
      const closedId = (await createPeriod()).body;
      await rest(`raah_communion_periods?id=eq.${closedId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'closed', closed_at: new Date().toISOString(), closed_by: PASTOR }),
      });
      const result = await rpc('raah_rpc_set_roster_entry', {
        p_workspace: WS, p_actor: PASTOR, p_period_id: closedId, p_member_id: memberA, p_included: true,
      });
      expect(result.body.code).toBe('P0422');
    });
  });

  describe('review transitions', () => {
    let reviewId: string;
    beforeAll(async () => {
      const periodId = (await createPeriod()).body;
      reviewId = (await rpc<string>('raah_rpc_set_roster_entry', {
        p_workspace: WS, p_actor: PASTOR, p_period_id: periodId, p_member_id: memberA, p_included: true,
      })).body;
    });

    const transition = (expectedRevision: number, toStatus: string, reason?: string) =>
      rpc<number>('raah_rpc_transition_review', {
        p_workspace: WS,
        p_actor: PASTOR,
        p_review_id: reviewId,
        p_expected_revision: expectedRevision,
        p_to_status: toStatus,
        p_reason: reason ?? null,
      });

    it('walks the normal path and bumps the revision each time', async () => {
      expect((await transition(1, 'scheduled')).body).toBe(2);
      expect((await transition(2, 'in_progress')).body).toBe(3);
      expect((await transition(3, 'reviewed')).body).toBe(4);
    });

    it('rejects a stale revision so a second window cannot overwrite silently', async () => {
      expect((await transition(3, 'in_progress', '추가 면담')).body.code).toBe('P0409');
    });

    it('rejects transitions outside the workflow', async () => {
      expect((await transition(4, 'scheduled')).body.code).toBe('P0422');
      expect((await transition(4, 'not_a_status')).body.code).toBe('P0422');
    });

    it('requires a reason to reopen or to close without contact', async () => {
      expect((await transition(4, 'in_progress')).body.code).toBe('P0422');
      expect((await transition(4, 'in_progress', '후속 면담')).body).toBe(5);
      expect((await transition(5, 'closed_without_contact')).body.code).toBe('P0422');
      expect((await transition(5, 'closed_without_contact', '연락 닿지 않음')).body).toBe(6);
    });

    it('keeps reasons out of the audit trail', async () => {
      const events = await (await rest(`raah_audit_events?target_id=eq.${reviewId}&select=*`)).json();
      expect(events.length).toBeGreaterThanOrEqual(5);
      expect(JSON.stringify(events)).not.toContain('연락 닿지 않음');
    });
  });

  describe('browser keys', () => {
    it.each(['raah_communion_periods', 'raah_communion_reviews', 'raah_audit_events', 'raah_member_ecclesial_profiles'])(
      'cannot read %s',
      async (table) => {
        const response = await rest(`${table}?select=*`, {}, anonKey!);
        expect(response.ok).toBe(false);
      }
    );

    it('cannot call the RPC functions', async () => {
      const assertAccess = await rpc('raah_rpc_assert_access', { p_workspace: WS, p_actor: PASTOR }, anonKey!);
      const create = await createPeriodAs(anonKey!);
      expect(assertAccess.status).not.toBe(200);
      expect(create.status).not.toBe(200);
      expect(await count('raah_idempotency_keys', 'key=eq.anon-attempt-01')).toBe(0);
    });

    it.each(['raah_rpc_create_review_log', 'raah_rpc_link_review_log'])('cannot call %s', async (name) => {
      const result = await rpc(name, { p_workspace: WS, p_actor: PASTOR }, anonKey!);
      expect(result.status).not.toBe(200);
    });
  });

  describe('constraints', () => {
    it('defaults ecclesial facts to unknown', async () => {
      const profile = await insert('raah_member_ecclesial_profiles', { member_id: memberB });
      expect(profile).toMatchObject({ baptism_status: 'unknown', profession_status: 'unknown', communicant_status: 'unknown' });
    });

    it('keeps the audit trail append-only for the server role', async () => {
      const response = await rest('raah_audit_events?actor_uid=eq.' + PASTOR, { method: 'DELETE' });
      expect(response.ok).toBe(false);
    });

    it('will not delete a member who has pastoral history', async () => {
      const response = await rest(`raah_members?id=eq.${memberA}`, { method: 'DELETE' });
      expect(response.ok).toBe(false);
    });
  });
});
