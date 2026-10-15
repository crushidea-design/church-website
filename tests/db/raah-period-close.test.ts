import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Closing and reopening a communion period: RPCs and HTTP handlers against
// local Supabase (`npm run test:db`). Only Firebase token verification is mocked.
// All names are fictional.
const url = process.env.RAAH_TEST_SUPABASE_URL;
const serviceKey = process.env.RAAH_TEST_SERVICE_ROLE_KEY;
const anonKey = process.env.RAAH_TEST_ANON_KEY;
const enabled = Boolean(url && serviceKey && anonKey);

const WS = 'default';
const PASTOR = 'uid-close-pastor';

const auth = vi.hoisted(() => ({ uid: 'uid-close-pastor' }));
vi.mock('../../netlify/functions/_shared/raah-auth.mjs', () => ({
  requireRaahAdmin: async (req: Request) =>
    req.headers.get('authorization')
      ? { user: { uid: auth.uid, name: '가상 목양자' } }
      : { response: new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 }) },
}));
import communion from '../../netlify/functions/raah-communion.mts';
import careTasks from '../../netlify/functions/raah-care-tasks.mts';

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
async function call(handler: typeof communion, path: string, init: RequestInit & { params?: Record<string, string> } = {}) {
  const { params, ...rest } = init;
  const response = await handler(
    new Request(`https://raah.test${path}`, { ...rest, headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json', ...(rest.headers || {}) } }),
    { params: params || {} } as never
  );
  return { status: response!.status, body: await response!.json() };
}

type Summary = { included: number; excluded: number; byStatus: Record<string, number>; openCareTasks: number };
const closePeriod = (periodId: string, revision: number, actor = PASTOR) =>
  rpc<{ revision: number; closingSummary: Summary }>('raah_rpc_close_period', { p_workspace: WS, p_actor: actor, p_period_id: periodId, p_expected_revision: revision });
const reopenPeriod = (periodId: string, revision: number, reason: string, actor = PASTOR) =>
  rpc<{ revision: number }>('raah_rpc_reopen_period', { p_workspace: WS, p_actor: actor, p_period_id: periodId, p_expected_revision: revision, p_reason: reason });

let seq = 0;
const newMember = () => {
  seq += 1;
  return insert('raah_members', { name: `가상 마감성도${seq}`, search_name: `가상마감성도${seq}` }).then((row) => row.id as string);
};
const newPeriod = () =>
  insert('raah_communion_periods', { name: '가상 마감 주기', starts_on: '2026-10-01', ends_on: '2026-10-25', owner_uid: PASTOR, guide_version: 'draft', created_by: PASTOR })
    .then((row) => row.id as string);
const newReview = (periodId: string, memberId: string, status: string, rosterState = 'included') =>
  insert('raah_communion_reviews', { period_id: periodId, member_id: memberId, assignee_uid: PASTOR, roster_changed_by: PASTOR, status, roster_state: rosterState })
    .then((row) => row as { id: string; revision: number });
const newTask = (memberId: string, status: string) =>
  insert('raah_care_tasks', { member_id: memberId, source_type: 'manual', assignee_uid: PASTOR, title: '후속 면담', status, status_changed_by: PASTOR, created_by: PASTOR })
    .then((row) => row as { id: string; revision: number });
const periodRow = async (periodId: string) => (await (await db(`raah_communion_periods?id=eq.${periodId}&select=*`)).json())[0];

describe.skipIf(!enabled)('raah period close and reopen against local Supabase', () => {
  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', url!);
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', serviceKey!);
    vi.stubEnv('RAAH_COMMUNION_ENABLED', 'true');
    vi.stubEnv('RAAH_ENCRYPTION_SECRET', 'local-synthetic-secret-not-used-elsewhere');
    await insert('raah_workspace_access', { firebase_uid: PASTOR, access_role: 'pastor' });
  });
  afterAll(() => vi.unstubAllEnvs());

  it('snapshots counts of included members only, bumps the revision and audits by id', async () => {
    const period = await newPeriod();
    const [a, b, c, d, excluded, outside] = await Promise.all([newMember(), newMember(), newMember(), newMember(), newMember(), newMember()]);
    await newReview(period, a, 'reviewed');
    await newReview(period, b, 'reviewed');
    await newReview(period, c, 'not_started');
    await newReview(period, d, 'in_progress');
    await newReview(period, excluded, 'reviewed', 'excluded');
    // Open/deferred tasks of included members count; done, cancelled and non-members do not.
    await newTask(a, 'open');
    await newTask(a, 'deferred');
    await newTask(b, 'done');
    await newTask(c, 'cancelled');
    await newTask(excluded, 'open');
    await newTask(outside, 'open');

    const result = await closePeriod(period, 1);
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body.revision).toBe(2);
    expect(result.body.closingSummary).toEqual({
      included: 4,
      excluded: 1,
      byStatus: { not_started: 1, scheduled: 0, in_progress: 1, reviewed: 2, closed_without_contact: 0 },
      openCareTasks: 2,
    });

    const row = await periodRow(period);
    expect(row).toMatchObject({ status: 'closed', closed_by: PASTOR, revision: 2, closing_summary: result.body.closingSummary });
    expect(row.closed_at).not.toBeNull();

    const [event] = await (await db(`raah_audit_events?target_id=eq.${period}&action=eq.period.close&select=*`)).json();
    expect(event).toMatchObject({ target_type: 'communion_period', actor_uid: PASTOR, outcome: 'success' });
    expect(JSON.stringify(event)).not.toContain('마감성도');
  });

  it('refuses a stale revision with 409, a double close with 422 and an unknown period with 404', async () => {
    const period = await newPeriod();
    expect((await closePeriod(period, 5)).body.code).toBe('P0409');
    expect((await closePeriod(period, 1)).status).toBe(200);
    expect((await closePeriod(period, 2)).body.code).toBe('P0422');
    expect((await closePeriod('00000000-0000-4000-8000-000000000000', 1)).body.code).toBe('P0404');
    expect((await periodRow(period)).revision).toBe(2);
  });

  it('freezes roster, transitions and conversation logs but leaves care tasks workable', async () => {
    const period = await newPeriod();
    const member = await newMember();
    const other = await newMember();
    const review = await newReview(period, member, 'in_progress');
    const task = await newTask(member, 'open');
    expect((await closePeriod(period, 1)).status).toBe(200);

    const roster = await rpc('raah_rpc_set_roster_entry', { p_workspace: WS, p_actor: PASTOR, p_period_id: period, p_member_id: other, p_included: true });
    expect(roster.body.code).toBe('P0422');
    const transition = await rpc('raah_rpc_transition_review', {
      p_workspace: WS, p_actor: PASTOR, p_review_id: review.id, p_expected_revision: review.revision, p_to_status: 'reviewed', p_reason: null,
    });
    expect(transition.body.code).toBe('P0422');
    const log = await call(communion, `/api/raah/communion/reviews/${review.id}/logs`, {
      method: 'POST', params: { id: review.id }, headers: { 'Idempotency-Key': 'close-frozen-log-01' },
      body: JSON.stringify({ expectedRevision: review.revision, date: '2026-10-10', publicSummary: '', innerNote: '[말씀과 예배] 다룸', prayerTopics: '', nextSteps: '' }),
    });
    expect(log.status).toBe(422);

    // The care task is untouched and can still be completed.
    const stillOpen = (await (await db(`raah_care_tasks?id=eq.${task.id}&select=status`)).json())[0];
    expect(stillOpen.status).toBe('open');
    const done = await call(careTasks, `/api/raah/care-tasks/${task.id}`, {
      method: 'PATCH', params: { id: task.id }, body: JSON.stringify({ status: 'done', expectedRevision: task.revision }),
    });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
  });

  it('requires a reason to reopen, then restores editing and keeps the closing summary', async () => {
    const period = await newPeriod();
    const member = await newMember();
    const other = await newMember();
    await newReview(period, member, 'reviewed');
    const closed = await closePeriod(period, 1);

    expect((await reopenPeriod(period, 2, '   ')).body.code).toBe('P0422');
    expect((await reopenPeriod(period, 2, '가'.repeat(201))).body.code).toBe('P0422');
    expect((await reopenPeriod(period, 1, '마감 뒤 추가 면담')).body.code).toBe('P0409');
    const reopened = await reopenPeriod(period, 2, '  마감 뒤 추가 면담  ');
    expect(reopened.status, JSON.stringify(reopened.body)).toBe(200);
    expect(reopened.body.revision).toBe(3);

    const row = await periodRow(period);
    expect(row).toMatchObject({ status: 'active', closed_at: null, closed_by: null, reopened_by: PASTOR, reopen_reason: '마감 뒤 추가 면담', revision: 3 });
    expect(row.reopened_at).not.toBeNull();
    expect(row.closing_summary).toEqual(closed.body.closingSummary);

    const roster = await rpc('raah_rpc_set_roster_entry', { p_workspace: WS, p_actor: PASTOR, p_period_id: period, p_member_id: other, p_included: true });
    expect(roster.status, JSON.stringify(roster.body)).toBe(200);

    // Not closed any more: reopening again is refused; closing works again.
    expect((await reopenPeriod(period, 3, '다시')).body.code).toBe('P0422');
    expect((await closePeriod(period, 3)).status).toBe(200);

    const events = await (await db(`raah_audit_events?target_id=eq.${period}&action=in.(period.close,period.reopen)&select=action,actor_uid`)).json();
    expect(events.map((event: { action: string }) => event.action).sort()).toEqual(['period.close', 'period.close', 'period.reopen']);
    expect(JSON.stringify(events)).not.toContain('추가 면담');
  });

  it('cannot be executed with the anon key or by an actor without a grant', async () => {
    const period = await newPeriod();
    const args = { p_workspace: WS, p_actor: PASTOR, p_period_id: period, p_expected_revision: 1 };
    expect((await rpc('raah_rpc_close_period', args, anonKey!)).status).toBeGreaterThanOrEqual(400);
    expect((await rpc('raah_rpc_reopen_period', { ...args, p_reason: '이유' }, anonKey!)).status).toBeGreaterThanOrEqual(400);
    expect((await periodRow(period)).status).toBe('active');
    expect((await closePeriod(period, 1, 'uid-not-granted')).body.code).toBe('P0403');
    expect((await periodRow(period)).status).toBe('active');
  });

  describe('HTTP endpoints', () => {
    const post = (path: string, id: string, body: unknown) =>
      call(communion, `/api/raah/communion/periods/${id}/${path}`, { method: 'POST', params: { id }, body: JSON.stringify(body) });

    it('closes and reopens, and lists the new fields', async () => {
      const period = await newPeriod();
      const member = await newMember();
      await newReview(period, member, 'reviewed');

      const closed = await post('close', period, { expectedRevision: 1 });
      expect(closed.status).toBe(200);
      expect(closed.body).toMatchObject({ revision: 2, closingSummary: { included: 1, byStatus: { reviewed: 1 } } });

      const detail = await call(communion, `/api/raah/communion/periods/${period}`, { params: { id: period } });
      expect(detail.body.period).toMatchObject({ status: 'closed', revision: 2, reopenReason: null, closingSummary: { included: 1 } });
      expect(detail.body.period.closedAt).toEqual(expect.any(String));

      const reopened = await post('reopen', period, { expectedRevision: 2, reason: '마감 뒤 추가 면담' });
      expect(reopened.status).toBe(200);
      expect(reopened.body).toEqual({ revision: 3 });

      const list = await call(communion, '/api/raah/communion/periods');
      const listed = list.body.periods.find((item: { id: string }) => item.id === period);
      expect(listed).toMatchObject({ status: 'active', closedAt: null, reopenReason: '마감 뒤 추가 면담', closingSummary: { included: 1 } });
      expect(listed.reopenedAt).toEqual(expect.any(String));
    });

    it('answers 409 for a stale revision, 422 for bad input or state and 404 for an unknown period', async () => {
      const period = await newPeriod();
      const stale = await post('close', period, { expectedRevision: 9 });
      expect(stale.status).toBe(409);
      expect(stale.body).toMatchObject({ code: 'RAAH_REVISION_CONFLICT' });

      expect((await post('close', period, {})).status).toBe(422);
      expect((await post('close', period, { expectedRevision: 0 })).status).toBe(422);
      expect((await post('reopen', period, { expectedRevision: 1, reason: '이유' })).status).toBe(422); // not closed
      expect((await post('close', period, { expectedRevision: 1 })).status).toBe(200);
      expect((await post('close', period, { expectedRevision: 2 })).status).toBe(422); // already closed
      expect((await post('reopen', period, { expectedRevision: 2 })).status).toBe(422); // no reason
      expect((await post('reopen', period, { expectedRevision: 2, reason: '   ' })).status).toBe(422);
      expect((await post('reopen', period, { expectedRevision: 2, reason: '가'.repeat(201) })).status).toBe(422);
      expect((await post('close', '00000000-0000-4000-8000-000000000000', { expectedRevision: 1 })).status).toBe(404);
      expect(JSON.stringify((await post('close', period, { expectedRevision: 2 })).body)).not.toContain('already closed');
    });

    it('answers 403 without a RAAH grant and refuses other methods', async () => {
      const period = await newPeriod();
      auth.uid = 'uid-homepage-admin-only';
      try {
        expect((await post('close', period, { expectedRevision: 1 })).status).toBe(403);
        expect((await post('reopen', period, { expectedRevision: 1, reason: '이유' })).status).toBe(403);
      } finally {
        auth.uid = PASTOR;
      }
      expect((await periodRow(period)).status).toBe('active');
      const get = await call(communion, `/api/raah/communion/periods/${period}/close`, { params: { id: period } });
      expect(get.status).toBe(405);
      const del = await call(communion, `/api/raah/communion/periods/${period}/close`, { method: 'DELETE', params: { id: period } });
      expect(del.status).toBe(405);
      expect((await periodRow(period)).id).toBe(period);
    });
  });
});
