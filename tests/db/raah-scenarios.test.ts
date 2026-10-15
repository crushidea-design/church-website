import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Plan 17.1 pastoral scenarios, run end to end with synthetic people through
// the real communion and care-task handlers on local Supabase
// (`npm run test:db`). Only Firebase token verification is mocked.
// Scenario numbers match docs/2026-10-01-raah-p1a-pilot-readiness.md.
const url = process.env.RAAH_TEST_SUPABASE_URL;
const serviceKey = process.env.RAAH_TEST_SERVICE_ROLE_KEY;
const enabled = Boolean(url && serviceKey && process.env.RAAH_TEST_ANON_KEY);

vi.mock('../../netlify/functions/_shared/raah-auth.mjs', () => ({
  requireRaahAdmin: async () => ({ user: { uid: 'uid-scenario-pastor', name: '가상 목양자' } }),
}));
import communion from '../../netlify/functions/raah-communion.mts';
import careTasks from '../../netlify/functions/raah-care-tasks.mts';

let keySeq = 0;
const key = () => `scenario-key-${++keySeq}-${Date.now()}`;

function api(handler: typeof communion, base: string) {
  return async (path: string, init: RequestInit & { params?: Record<string, string>; idempotent?: boolean } = {}) => {
    const { params, idempotent, ...rest } = init;
    const response = await handler(
      new Request(`https://raah.test${base}${path}`, {
        ...rest,
        headers: {
          Authorization: 'Bearer test',
          'Content-Type': 'application/json',
          ...(idempotent ? { 'Idempotency-Key': key() } : {}),
          ...(rest.headers || {}),
        },
      }),
      { params: params || {} } as never
    );
    return { status: response!.status, body: await response!.json() };
  };
}
const communionApi = api(communion, '/api/raah/communion');
const taskApi = api(careTasks, '/api/raah/care-tasks');

const db = (path: string, init: RequestInit = {}) =>
  fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) },
  });
const insert = async (table: string, row: Record<string, unknown>) => (await (await db(table, { method: 'POST', body: JSON.stringify(row) })).json())[0];
const member = async (name: string) => (await insert('raah_members', { name, search_name: name.replace(/\s/g, '') })).id as string;

async function newPeriod(name = '시나리오 주기') {
  const { body } = await communionApi('/periods', {
    method: 'POST',
    idempotent: true,
    body: JSON.stringify({ name, startsOn: '2026-11-01', endsOn: '2026-11-29', guideVersion: 'draft-2026-09', serviceDate: '2026-11-29' }),
  });
  return body.id as string;
}
async function enrol(periodId: string, memberId: string) {
  const { body } = await communionApi(`/periods/${periodId}/roster`, {
    method: 'POST', params: { id: periodId }, body: JSON.stringify({ entries: [{ memberId, included: true }] }),
  });
  return body.reviewIds[0] as string;
}
const review = async (reviewId: string) => (await communionApi(`/reviews/${reviewId}`, { params: { id: reviewId } })).body;
const recordConversation = (reviewId: string, expectedRevision: number, innerNote: string) =>
  communionApi(`/reviews/${reviewId}/logs`, {
    method: 'POST', params: { id: reviewId }, idempotent: true,
    body: JSON.stringify({ expectedRevision, date: '2026-11-15', publicSummary: '', innerNote, prayerTopics: '', nextSteps: '' }),
  });
const profileOf = async (memberId: string) => (await (await db(`raah_member_ecclesial_profiles?member_id=eq.${memberId}&select=*`)).json())[0];

describe.skipIf(!enabled)('plan 17.1 pastoral scenarios (synthetic data)', () => {
  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', url!);
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', serviceKey!);
    vi.stubEnv('RAAH_COMMUNION_ENABLED', 'true');
    vi.stubEnv('RAAH_ENCRYPTION_SECRET', 'scenario-secret-not-used-elsewhere');
    await insert('raah_workspace_access', { firebase_uid: 'uid-scenario-pastor', access_role: 'pastor' });
  });
  afterAll(() => vi.unstubAllEnvs());

  it('S1 · a fearful member with weak assurance: comfort is recorded, nothing restricts participation', async () => {
    const memberId = await member('가상 확신약한성도');
    const reviewId = await enrol(await newPeriod(), memberId);
    const saved = await recordConversation(reviewId, 1, '[연약함과 확신] 다룸\n성찬을 두려워함. 요한복음 6:37로 위로함');
    expect(saved.status).toBe(201);
    expect((await review(reviewId)).review.status).toBe('in_progress');
    expect(await profileOf(memberId)).toBeUndefined();
  });

  it('S2 · repeated absence through illness does not change pastoral status or create any judgement', async () => {
    const memberId = await member('가상 투병성도');
    for (const date of ['2026-10-04', '2026-10-11', '2026-10-18']) {
      const event = await insert('raah_attendance_events', { date, event_type: 'sunday_morning' });
      await insert('raah_attendance_records', { event_id: event.id, member_id: memberId, member_name: '가상 투병성도', attended: false, note: '입원' });
    }
    const reviewId = await enrol(await newPeriod(), memberId);
    expect((await review(reviewId)).review.status).toBe('not_started');
    expect(await profileOf(memberId)).toBeUndefined();
  });

  it('S4 · an active member without baptism or profession records stays unknown after enrolment', async () => {
    const memberId = await member('가상 교적미확인성도');
    await insert('raah_member_ecclesial_profiles', { member_id: memberId });
    await enrol(await newPeriod(), memberId);
    expect(await profileOf(memberId)).toMatchObject({ baptism_status: 'unknown', profession_status: 'unknown', communicant_status: 'unknown' });
  });

  it('S5 · care confirmed yet a further meeting needed: the review is confirmed and the task stays open', async () => {
    const memberId = await member('가상 추가면담성도');
    const reviewId = await enrol(await newPeriod(), memberId);
    await recordConversation(reviewId, 1, '[복음과 그리스도] 다룸');
    const confirmed = await communionApi(`/reviews/${reviewId}`, { method: 'PATCH', params: { id: reviewId }, body: JSON.stringify({ status: 'reviewed', expectedRevision: 2 }) });
    expect(confirmed.status).toBe(200);
    const task = await taskApi('', {
      method: 'POST', idempotent: true,
      body: JSON.stringify({ memberId, sourceType: 'communion_review', sourceId: reviewId, title: '후속 면담', dueOn: '2026-12-06', detail: '', schedule: null }),
    });
    expect(task.status).toBe(201);
    expect((await review(reviewId)).review.status).toBe('reviewed');
    expect((await taskApi(`?memberId=${memberId}`)).body.tasks).toEqual([expect.objectContaining({ status: 'open' })]);
  });

  it('S6 · finishing the visit on the calendar completes neither the care nor the review', async () => {
    const memberId = await member('가상 일정완료성도');
    const reviewId = await enrol(await newPeriod(), memberId);
    const { body } = await taskApi('', {
      method: 'POST', idempotent: true,
      body: JSON.stringify({ memberId, sourceType: 'communion_review', sourceId: reviewId, title: '심방', dueOn: null, detail: '', schedule: { date: '2026-11-10', startsAt: '15:00' } }),
    });
    await db(`raah_ministry_schedule_items?id=eq.${body.scheduleItemId}`, { method: 'PATCH', body: JSON.stringify({ status: 'done' }) });
    expect((await taskApi(`/${body.taskId}`, { params: { id: body.taskId } })).body.task.status).toBe('open');
    expect((await review(reviewId)).review.status).toBe('not_started');
  });

  it('S7 · two members with the same name are kept apart by id', async () => {
    const first = await member('가상 동명이인');
    const second = await member('가상 동명이인');
    const periodId = await newPeriod();
    const firstReview = await enrol(periodId, first);
    const secondReview = await enrol(periodId, second);
    expect(firstReview).not.toBe(secondReview);
    const saved = await recordConversation(firstReview, 1, '[말씀과 예배] 다룸');
    const { logId } = saved.body;
    const crossLink = await communionApi(`/reviews/${secondReview}/logs`, { method: 'POST', params: { id: secondReview }, body: JSON.stringify({ visitationLogId: logId }) });
    expect(crossLink.status).toBe(422);
    expect((await review(secondReview)).logs).toEqual([]);
  });

  it('S8 · a new period does not inherit an earlier confirmation; nobody is auto-completed', async () => {
    const memberId = await member('가상 매주성찬성도');
    const earlier = await enrol(await newPeriod('이전 주기'), memberId);
    await communionApi(`/reviews/${earlier}`, { method: 'PATCH', params: { id: earlier }, body: JSON.stringify({ status: 'reviewed', expectedRevision: 1 }) });
    const later = await enrol(await newPeriod('다음 주기'), memberId);
    expect((await review(later)).review.status).toBe('not_started');
  });

  it('S9 · follow-up care survives the period being closed', async () => {
    const memberId = await member('가상 마감후돌봄성도');
    const periodId = await newPeriod();
    const reviewId = await enrol(periodId, memberId);
    await taskApi('', {
      method: 'POST', idempotent: true,
      body: JSON.stringify({ memberId, sourceType: 'communion_review', sourceId: reviewId, title: '안부 연락', dueOn: '2026-12-13', detail: '', schedule: null }),
    });
    await db(`raah_communion_periods?id=eq.${periodId}`, {
      method: 'PATCH', body: JSON.stringify({ status: 'closed', closed_at: new Date().toISOString(), closed_by: 'uid-scenario-pastor' }),
    });
    expect((await taskApi(`?memberId=${memberId}`)).body.tasks).toEqual([expect.objectContaining({ title: '안부 연락', status: 'open' })]);
  });

  it('S12 · a recorded non-participation changes nothing about the person', async () => {
    const memberId = await member('가상 성찬미참여성도');
    const reviewId = await enrol(await newPeriod(), memberId);
    const event = await insert('raah_attendance_events', { date: '2026-11-29', event_type: 'sunday_morning', includes_communion: true });
    await insert('raah_attendance_records', { event_id: event.id, member_id: memberId, member_name: '가상 성찬미참여성도', attended: true, communion_participated: false });
    expect((await review(reviewId)).review.status).toBe('not_started');
    expect(await profileOf(memberId)).toBeUndefined();
    const audit = await (await db(`raah_audit_events?target_id=eq.${reviewId}&select=action`)).json();
    expect(audit.map((event: { action: string }) => event.action)).toEqual(['communion_review.roster_included']);
  });
});
