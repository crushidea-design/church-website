import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Communion services (occasions) and participation facts: RPCs and HTTP handlers
// against local Supabase (`npm run test:db`). Only Firebase token verification
// is mocked. All names are fictional.
const url = process.env.RAAH_TEST_SUPABASE_URL;
const serviceKey = process.env.RAAH_TEST_SERVICE_ROLE_KEY;
const anonKey = process.env.RAAH_TEST_ANON_KEY;
const enabled = Boolean(url && serviceKey && anonKey);

const WS = 'default';
const PASTOR = 'uid-occasion-pastor';

const auth = vi.hoisted(() => ({ uid: 'uid-occasion-pastor' }));
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

const addOccasion = (periodId: string, date: string, actor = PASTOR) =>
  rpc<{ id: string; revision: number }>('raah_rpc_add_occasion', { p_workspace: WS, p_actor: actor, p_period_id: periodId, p_service_date: date });
const updateOccasion = (id: string, revision: number, patch: { status?: string; date?: string }, actor = PASTOR) =>
  rpc<{ revision: number }>('raah_rpc_update_occasion', {
    p_workspace: WS, p_actor: actor, p_occasion_id: id, p_expected_revision: revision, p_status: patch.status ?? null, p_service_date: patch.date ?? null,
  });

let seq = 0;
const newMember = () => {
  seq += 1;
  return insert('raah_members', { name: `가상 시행성도${seq}`, search_name: `가상시행성도${seq}` }).then((row) => row as { id: string; name: string; search_name: string });
};
const newPeriod = () =>
  insert('raah_communion_periods', { name: '가상 시행 주기', starts_on: '2026-10-01', ends_on: '2026-10-25', owner_uid: PASTOR, guide_version: 'draft', created_by: PASTOR })
    .then((row) => row.id as string);
const newReview = (periodId: string, memberId: string, status = 'in_progress') =>
  insert('raah_communion_reviews', { period_id: periodId, member_id: memberId, assignee_uid: PASTOR, roster_changed_by: PASTOR, status, roster_state: 'included' })
    .then((row) => row as { id: string; revision: number });
const newTask = (memberId: string) =>
  insert('raah_care_tasks', { member_id: memberId, source_type: 'manual', assignee_uid: PASTOR, title: '후속 면담', status: 'open', status_changed_by: PASTOR, created_by: PASTOR })
    .then((row) => row as { id: string });
const newEvent = (date: string, overrides: Record<string, unknown> = {}) =>
  insert('raah_attendance_events', { date, event_type: 'sunday_morning', ...overrides }).then((row) => row.id as string);
const newRecord = (eventId: string, member: { id: string; name: string; search_name: string }, communion: boolean, note?: string) =>
  insert('raah_attendance_records', {
    event_id: eventId, member_id: member.id, member_name: member.name, member_search_name: member.search_name, attended: true, communion_participated: communion, note: note ?? null,
  });
const occasionRow = async (id: string) => (await (await db(`raah_communion_occasions?id=eq.${id}&select=*`)).json())[0];
const closePeriod = (periodId: string, revision = 1) =>
  rpc('raah_rpc_close_period', { p_workspace: WS, p_actor: PASTOR, p_period_id: periodId, p_expected_revision: revision });
const reviewDetail = (id: string) => call(`/api/raah/communion/reviews/${id}`, { params: { id } });

describe.skipIf(!enabled)('raah communion occasions against local Supabase', () => {
  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', url!);
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', serviceKey!);
    vi.stubEnv('RAAH_COMMUNION_ENABLED', 'true');
    vi.stubEnv('RAAH_ENCRYPTION_SECRET', 'local-synthetic-secret-not-used-elsewhere');
    await insert('raah_workspace_access', { firebase_uid: PASTOR, access_role: 'pastor' });
  });
  afterAll(() => vi.unstubAllEnvs());

  it('adds a scheduled service, audits by id, and refuses a duplicate date, a closed or an unknown period', async () => {
    const period = await newPeriod();
    const added = await addOccasion(period, '2026-10-11');
    expect(added.status, JSON.stringify(added.body)).toBe(200);
    expect(await occasionRow(added.body.id)).toMatchObject({ period_id: period, service_date: '2026-10-11', status: 'scheduled', revision: 1 });
    expect(added.body.revision).toBe(1);

    const [event] = await (await db(`raah_audit_events?target_id=eq.${added.body.id}&action=eq.occasion.add&select=*`)).json();
    expect(event).toMatchObject({ target_type: 'communion_occasion', actor_uid: PASTOR, outcome: 'success' });

    expect((await addOccasion(period, '2026-10-11')).body.code).toBe('P0409');
    expect((await addOccasion('00000000-0000-4000-8000-000000000000', '2026-10-11')).body.code).toBe('P0404');
    expect((await closePeriod(period)).status).toBe(200);
    expect((await addOccasion(period, '2026-10-18')).body.code).toBe('P0422');
  });

  it('changes the date only while scheduled and refuses a colliding date', async () => {
    const period = await newPeriod();
    const a = (await addOccasion(period, '2026-10-11')).body;
    const b = (await addOccasion(period, '2026-10-18')).body;
    const linkedEvent = await newEvent('2026-02-01');
    await db(`raah_communion_occasions?id=eq.${a.id}`, { method: 'PATCH', body: JSON.stringify({ attendance_event_id: linkedEvent }) });

    expect((await updateOccasion(a.id, 1, { date: '2026-10-18' })).body.code).toBe('P0409'); // collides with b
    const moved = await updateOccasion(a.id, 1, { date: '2026-10-25' });
    expect(moved.status, JSON.stringify(moved.body)).toBe(200);
    expect(moved.body.revision).toBe(2);
    // The link belonged to the old date, so it is cleared.
    expect(await occasionRow(a.id)).toMatchObject({ service_date: '2026-10-25', revision: 2, attendance_event_id: null });

    // A date and a status change together, or a date change on a held service, are refused.
    expect((await updateOccasion(a.id, 2, { date: '2026-10-04', status: 'held' })).body.code).toBe('P0422');
    expect((await updateOccasion(b.id, 1, { status: 'held' })).status).toBe(200);
    expect((await updateOccasion(b.id, 2, { date: '2026-10-04' })).body.code).toBe('P0422');
    expect((await occasionRow(b.id)).service_date).toBe('2026-10-18');
    const [event] = await (await db(`raah_audit_events?target_id=eq.${a.id}&action=eq.occasion.update&select=*`)).json();
    expect(event).toMatchObject({ target_type: 'communion_occasion', actor_uid: PASTOR });
  });

  it('allows scheduled to held or cancelled and back, and refuses every other transition', async () => {
    const period = await newPeriod();
    const held = (await addOccasion(period, '2026-10-11')).body;
    const cancelled = (await addOccasion(period, '2026-10-18')).body;

    expect((await updateOccasion(held.id, 1, { status: 'held' })).body.revision).toBe(2);
    expect((await updateOccasion(cancelled.id, 1, { status: 'cancelled' })).body.revision).toBe(2);

    // held <-> cancelled directly, and staying in the same state, are invalid.
    expect((await updateOccasion(held.id, 2, { status: 'cancelled' })).body.code).toBe('P0422');
    expect((await updateOccasion(cancelled.id, 2, { status: 'held' })).body.code).toBe('P0422');
    expect((await updateOccasion(held.id, 2, { status: 'held' })).body.code).toBe('P0422');
    expect((await updateOccasion(held.id, 2, {})).body.code).toBe('P0422');
    expect((await updateOccasion(held.id, 2, { status: 'postponed' })).status).toBeGreaterThanOrEqual(400);

    // Undo both.
    expect((await updateOccasion(held.id, 2, { status: 'scheduled' })).body.revision).toBe(3);
    expect((await updateOccasion(cancelled.id, 2, { status: 'scheduled' })).body.revision).toBe(3);
    expect((await occasionRow(held.id)).status).toBe('scheduled');
  });

  it('refuses a stale revision (409), an unknown occasion (404), a closed period (422) and a missing grant', async () => {
    const period = await newPeriod();
    const occasion = (await addOccasion(period, '2026-10-11')).body;
    expect((await updateOccasion(occasion.id, 7, { status: 'held' })).body.code).toBe('P0409');
    expect((await updateOccasion('00000000-0000-4000-8000-000000000000', 1, { status: 'held' })).body.code).toBe('P0404');
    expect((await updateOccasion(occasion.id, 1, { status: 'held' }, 'uid-not-granted')).body.code).toBe('P0403');
    expect((await closePeriod(period)).status).toBe(200);
    expect((await updateOccasion(occasion.id, 1, { status: 'held' })).body.code).toBe('P0422');
    expect((await occasionRow(occasion.id)).status).toBe('scheduled');
  });

  it('keeps reviews, conversations and care tasks when a service is cancelled', async () => {
    const period = await newPeriod();
    const member = await newMember();
    const review = await newReview(period, member.id, 'in_progress');
    const task = await newTask(member.id);
    const occasion = (await addOccasion(period, '2026-10-11')).body;
    expect((await updateOccasion(occasion.id, 1, { status: 'cancelled' })).status).toBe(200);

    const reviewAfter = (await (await db(`raah_communion_reviews?id=eq.${review.id}&select=status,revision,roster_state`)).json())[0];
    expect(reviewAfter).toEqual({ status: 'in_progress', revision: review.revision, roster_state: 'included' });
    const taskAfter = (await (await db(`raah_care_tasks?id=eq.${task.id}&select=status`)).json())[0];
    expect(taskAfter.status).toBe('open');
    expect((await occasionRow(occasion.id)).status).toBe('cancelled');
  });

  it('cannot be executed with the anon key', async () => {
    const period = await newPeriod();
    const anonAdd = await rpc('raah_rpc_add_occasion', { p_workspace: WS, p_actor: PASTOR, p_period_id: period, p_service_date: '2026-10-11' }, anonKey!);
    expect(anonAdd.status).toBeGreaterThanOrEqual(400);
    const occasion = (await addOccasion(period, '2026-10-18')).body;
    const anonUpdate = await rpc(
      'raah_rpc_update_occasion',
      { p_workspace: WS, p_actor: PASTOR, p_occasion_id: occasion.id, p_expected_revision: 1, p_status: 'held', p_service_date: null },
      anonKey!
    );
    expect(anonUpdate.status).toBeGreaterThanOrEqual(400);
    expect((await occasionRow(occasion.id)).status).toBe('scheduled');
    const rows = await (await db(`raah_communion_occasions?period_id=eq.${period}&select=id`)).json();
    expect(rows).toHaveLength(1);
  });

  describe('participation facts', () => {
    it('derives participated / not recorded / no event / upcoming without leaking attendance notes', async () => {
      const period = await newPeriod();
      const member = await newMember();
      const review = await newReview(period, member.id);
      const eventA = await newEvent('2026-03-01');
      const eventB = await newEvent('2026-03-08');
      await newRecord(eventA, member, true, '가상 출석 메모');
      await newRecord(eventB, member, false, '가상 다른 메모');
      // A midweek event on the third day must not count as the service day.
      await newEvent('2026-03-15', { event_type: 'wednesday_prayer' });
      for (const date of ['2026-03-01', '2026-03-08', '2026-03-15', '2099-01-04']) expect((await addOccasion(period, date)).status).toBe(200);
      const cancelled = (await addOccasion(period, '2026-03-22')).body;
      await updateOccasion(cancelled.id, 1, { status: 'cancelled' });

      const detail = await reviewDetail(review.id);
      expect(detail.status, JSON.stringify(detail.body)).toBe(200);
      expect(detail.body.participation).toEqual([
        { serviceDate: '2026-03-01', occasionStatus: 'scheduled', fact: 'participated' },
        { serviceDate: '2026-03-08', occasionStatus: 'scheduled', fact: 'not_recorded' },
        { serviceDate: '2026-03-15', occasionStatus: 'scheduled', fact: 'no_attendance_event' },
        { serviceDate: '2099-01-04', occasionStatus: 'scheduled', fact: 'upcoming' },
      ]);
      expect(JSON.stringify(detail.body.participation)).not.toContain('메모');
    });

    it('is empty without occasions, and a member with no record on an existing event is not_recorded', async () => {
      const period = await newPeriod();
      const member = await newMember();
      const other = await newMember();
      const review = await newReview(period, member.id);
      expect((await reviewDetail(review.id)).body.participation).toEqual([]);

      const event = await newEvent('2026-04-05');
      await newRecord(event, other, true);
      await addOccasion(period, '2026-04-05');
      expect((await reviewDetail(review.id)).body.participation).toEqual([{ serviceDate: '2026-04-05', occasionStatus: 'scheduled', fact: 'not_recorded' }]);
    });

    it('prefers the linked attendance event and a communion service among several', async () => {
      const period = await newPeriod();
      const member = await newMember();
      const review = await newReview(period, member.id);
      const withoutCommunion = await newEvent('2026-05-03', { includes_communion: false });
      const linked = await newEvent('2026-05-03', { event_type: 'other' });
      await newRecord(linked, member, true);
      const occasion = (await addOccasion(period, '2026-05-03')).body;
      // Without a link, the morning event of that day is used (no record there).
      expect((await reviewDetail(review.id)).body.participation[0].fact).toBe('not_recorded');
      await db(`raah_communion_occasions?id=eq.${occasion.id}`, { method: 'PATCH', body: JSON.stringify({ attendance_event_id: linked }) });
      expect((await reviewDetail(review.id)).body.participation[0].fact).toBe('participated');
      expect(withoutCommunion).not.toBe(linked);
    });

    it('does not tie the review status and attendance to each other', async () => {
      const period = await newPeriod();
      const member = await newMember();
      const review = await newReview(period, member.id, 'not_started');
      const event = await newEvent('2026-06-07');
      await addOccasion(period, '2026-06-07');
      const recordsBefore = await (await db(`raah_attendance_records?member_id=eq.${member.id}&select=*`)).json();
      expect(recordsBefore).toEqual([]);

      // Reviewing changes the status but writes no attendance and does not change the fact.
      const moved = await call(`/api/raah/communion/reviews/${review.id}`, {
        method: 'PATCH', params: { id: review.id }, body: JSON.stringify({ status: 'reviewed', expectedRevision: review.revision }),
      });
      expect(moved.status, JSON.stringify(moved.body)).toBe(200);
      expect(await (await db(`raah_attendance_records?member_id=eq.${member.id}&select=*`)).json()).toEqual([]);
      expect((await reviewDetail(review.id)).body.participation[0].fact).toBe('not_recorded');

      // Recording participation changes the fact but never the review status.
      await newRecord(event, member, true);
      const after = await reviewDetail(review.id);
      expect(after.body.participation[0].fact).toBe('participated');
      expect(after.body.review).toMatchObject({ status: 'reviewed', revision: moved.body.revision });
    });
  });

  describe('HTTP endpoints', () => {
    const post = (periodId: string, body: unknown) =>
      call(`/api/raah/communion/periods/${periodId}/occasions`, { method: 'POST', params: { id: periodId }, body: JSON.stringify(body) });
    const patch = (id: string, body: unknown) => call(`/api/raah/communion/occasions/${id}`, { method: 'PATCH', params: { id }, body: JSON.stringify(body) });

    it('adds and updates a service and exposes revision in the period', async () => {
      const period = await newPeriod();
      const added = await post(period, { serviceDate: '2026-10-11' });
      expect(added.status, JSON.stringify(added.body)).toBe(201);
      expect(added.body).toEqual({ id: expect.any(String), revision: 1 });

      const updated = await patch(added.body.id, { expectedRevision: 1, status: 'held' });
      expect(updated.status).toBe(200);
      expect(updated.body).toEqual({ revision: 2 });

      const detail = await call(`/api/raah/communion/periods/${period}`, { params: { id: period } });
      expect(detail.body.period.occasions).toEqual([{ id: added.body.id, serviceDate: '2026-10-11', status: 'held', revision: 2 }]);
      const list = await call('/api/raah/communion/periods');
      expect(list.body.periods.find((item: { id: string }) => item.id === period).occasions[0]).toMatchObject({ status: 'held', revision: 2 });
    });

    it('answers 409 for a stale revision or a duplicate date, 422 for bad input or a closed period, 404 for unknown ids', async () => {
      const period = await newPeriod();
      const first = (await post(period, { serviceDate: '2026-10-11' })).body;
      expect((await post(period, { serviceDate: '2026-10-11' })).status).toBe(409);
      const second = (await post(period, { serviceDate: '2026-10-18' })).body;
      expect((await patch(second.id, { expectedRevision: 1, serviceDate: '2026-10-11' })).status).toBe(409);
      const stale = await patch(first.id, { expectedRevision: 9, status: 'held' });
      expect(stale.status).toBe(409);
      expect(stale.body).toMatchObject({ code: 'RAAH_REVISION_CONFLICT' });

      expect((await post(period, {})).status).toBe(422);
      expect((await post(period, { serviceDate: '내일' })).status).toBe(422);
      expect((await patch(first.id, { status: 'held' })).status).toBe(422);
      expect((await patch(first.id, { expectedRevision: 1 })).status).toBe(422);
      expect((await patch(first.id, { expectedRevision: 1, status: 'postponed' })).status).toBe(422);
      expect((await patch(first.id, { expectedRevision: 1, serviceDate: '2026-13-40' })).status).toBe(422);
      expect((await patch(first.id, { expectedRevision: 1, status: 'held', serviceDate: '2026-10-25' })).status).toBe(422);
      expect((await patch('00000000-0000-4000-8000-000000000000', { expectedRevision: 1, status: 'held' })).status).toBe(404);
      expect((await post('00000000-0000-4000-8000-000000000000', { serviceDate: '2026-10-11' })).status).toBe(404);

      expect((await closePeriod(period)).status).toBe(200);
      expect((await post(period, { serviceDate: '2026-10-25' })).status).toBe(422);
      expect((await patch(first.id, { expectedRevision: 1, status: 'held' })).status).toBe(422);
    });

    it('answers 403 without a RAAH grant and keeps the period routes for GET and DELETE', async () => {
      const period = await newPeriod();
      const occasion = (await post(period, { serviceDate: '2026-10-11' })).body;
      auth.uid = 'uid-homepage-admin-only';
      try {
        expect((await post(period, { serviceDate: '2026-10-18' })).status).toBe(403);
        expect((await patch(occasion.id, { expectedRevision: 1, status: 'held' })).status).toBe(403);
      } finally {
        auth.uid = PASTOR;
      }
      expect((await occasionRow(occasion.id)).status).toBe('scheduled');
      // The occasions sub-path is not the period itself: GET and DELETE are refused there.
      expect((await call(`/api/raah/communion/periods/${period}/occasions`, { params: { id: period } })).status).toBe(405);
      expect((await call(`/api/raah/communion/periods/${period}/occasions`, { method: 'DELETE', params: { id: period } })).status).toBe(405);
      expect((await call(`/api/raah/communion/occasions/${occasion.id}`, { params: { id: occasion.id } })).status).toBe(405);
      expect((await call(`/api/raah/communion/periods/${period}`, { params: { id: period } })).status).toBe(200);
    });
  });
});
