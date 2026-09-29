import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Guards added after the Codex review of #101: concurrent retries share one
// result, finished reviews take no new conversations, and stale pages cannot
// link records into excluded reviews or closed periods. Local Supabase only.
const url = process.env.RAAH_TEST_SUPABASE_URL;
const serviceKey = process.env.RAAH_TEST_SERVICE_ROLE_KEY;
const enabled = Boolean(url && serviceKey && process.env.RAAH_TEST_ANON_KEY);

vi.mock('../../netlify/functions/_shared/raah-auth.mjs', () => ({
  requireRaahAdmin: async () => ({ user: { uid: 'uid-guard-pastor', name: '가상 목양자' } }),
}));
import communion from '../../netlify/functions/raah-communion.mts';
import careTasks from '../../netlify/functions/raah-care-tasks.mts';

async function call(handler: typeof communion, path: string, init: RequestInit & { params?: Record<string, string> } = {}) {
  const { params, ...rest } = init;
  const response = await handler(
    new Request(`https://raah.test${path}`, {
      ...rest,
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json', ...(rest.headers || {}) },
    }),
    { params: params || {} } as never
  );
  return { status: response!.status, body: await response!.json() };
}

const db = (path: string, init: RequestInit = {}) =>
  fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) },
  });
const insert = async (table: string, row: Record<string, unknown>) => (await (await db(table, { method: 'POST', body: JSON.stringify(row) })).json())[0];

let seq = 0;
async function setup() {
  const memberId = (await insert('raah_members', { name: `가상 가드성도${++seq}`, search_name: `가상가드성도${seq}` })).id as string;
  const period = await call(communion, '/api/raah/communion/periods', {
    method: 'POST',
    headers: { 'Idempotency-Key': `guard-period-${seq}-${Date.now()}` },
    body: JSON.stringify({ name: '가드 주기', startsOn: '2026-11-01', endsOn: '2026-11-29', guideVersion: 'draft-2026-09', serviceDate: null }),
  });
  const roster = await call(communion, `/api/raah/communion/periods/${period.body.id}/roster`, {
    method: 'POST', params: { id: period.body.id }, body: JSON.stringify({ entries: [{ memberId, included: true }] }),
  });
  return { memberId, periodId: period.body.id as string, reviewId: roster.body.reviewIds[0] as string };
}

const conversation = (reviewId: string, expectedRevision: number, key: string) =>
  call(communion, `/api/raah/communion/reviews/${reviewId}/logs`, {
    method: 'POST', params: { id: reviewId }, headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ expectedRevision, date: '2026-11-10', publicSummary: '', innerNote: '[말씀과 예배] 다룸', prayerTopics: '', nextSteps: '' }),
  });
const transition = (reviewId: string, expectedRevision: number, status: string, reason?: string) =>
  call(communion, `/api/raah/communion/reviews/${reviewId}`, {
    method: 'PATCH', params: { id: reviewId }, body: JSON.stringify({ status, expectedRevision, reason }),
  });

describe.skipIf(!enabled)('review guards (local Supabase only)', () => {
  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', url!);
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', serviceKey!);
    vi.stubEnv('RAAH_COMMUNION_ENABLED', 'true');
    vi.stubEnv('RAAH_ENCRYPTION_SECRET', 'guard-secret-not-used-elsewhere');
    await insert('raah_workspace_access', { firebase_uid: 'uid-guard-pastor', access_role: 'pastor' });
  });
  afterAll(() => vi.unstubAllEnvs());

  it('gives two overlapping retries of one period request the same result', async () => {
    const request = () =>
      call(communion, '/api/raah/communion/periods', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'guard-concurrent-period' },
        body: JSON.stringify({ name: '동시 요청 주기', startsOn: '2026-12-01', endsOn: '2026-12-20', guideVersion: 'draft-2026-09', serviceDate: null }),
      });
    const results = await Promise.all([request(), request(), request()]);
    expect(results.map((result) => result.status)).toEqual([201, 201, 201]);
    expect(new Set(results.map((result) => result.body.id)).size).toBe(1);
    expect(await (await db('raah_communion_periods?name=eq.동시 요청 주기&select=id')).json()).toHaveLength(1);
  });

  it('gives overlapping retries of one conversation and one care task a single record each', async () => {
    const { memberId, reviewId } = await setup();
    const logs = await Promise.all([conversation(reviewId, 1, 'guard-concurrent-log'), conversation(reviewId, 1, 'guard-concurrent-log')]);
    expect(logs.map((result) => result.status)).toEqual([201, 201]);
    expect(logs[0].body.logId).toBe(logs[1].body.logId);

    const task = () =>
      call(careTasks, '/api/raah/care-tasks', {
        method: 'POST', headers: { 'Idempotency-Key': 'guard-concurrent-task' },
        body: JSON.stringify({ memberId, sourceType: 'communion_review', sourceId: reviewId, title: '후속 면담', dueOn: null, detail: '', schedule: { date: '2026-11-20', startsAt: '10:00' } }),
      });
    const tasks = await Promise.all([task(), task()]);
    expect(tasks[0].body.taskId).toBe(tasks[1].body.taskId);
    expect(await (await db(`raah_ministry_schedule_items?member_id=eq.${memberId}&select=id`)).json()).toHaveLength(1);
  });

  it('refuses a conversation on a confirmed or closed-without-contact review until it is reopened', async () => {
    const { reviewId } = await setup();
    expect((await transition(reviewId, 1, 'closed_without_contact', '연락 닿지 않음')).status).toBe(200);
    expect((await conversation(reviewId, 2, 'guard-closed-log')).status).toBe(422);
    expect((await transition(reviewId, 2, 'in_progress', '다시 연락됨')).status).toBe(200);
    const saved = await conversation(reviewId, 3, 'guard-reopened-log');
    expect(saved.status).toBe(201);
    expect((await transition(reviewId, saved.body.revision, 'reviewed')).status).toBe(200);
    expect((await conversation(reviewId, saved.body.revision + 1, 'guard-reviewed-log')).status).toBe(422);
  });

  it('refuses to link records into an excluded review or a closed period', async () => {
    const { memberId, periodId, reviewId } = await setup();
    const log = await insert('raah_visitation_logs', {
      member_id: memberId, member_name: '가상', member_search_name: '가상', date: '2026-10-01', log_type: '심방', encrypted_payload: { iv: 'x', tag: 'y', ciphertext: 'z' },
    });
    const link = () => call(communion, `/api/raah/communion/reviews/${reviewId}/logs`, { method: 'POST', params: { id: reviewId }, body: JSON.stringify({ visitationLogId: log.id }) });

    await call(communion, `/api/raah/communion/periods/${periodId}/roster`, {
      method: 'POST', params: { id: periodId }, body: JSON.stringify({ entries: [{ memberId, included: false }] }),
    });
    expect((await link()).status).toBe(422);

    await call(communion, `/api/raah/communion/periods/${periodId}/roster`, {
      method: 'POST', params: { id: periodId }, body: JSON.stringify({ entries: [{ memberId, included: true }] }),
    });
    await db(`raah_communion_periods?id=eq.${periodId}`, {
      method: 'PATCH', body: JSON.stringify({ status: 'closed', closed_at: new Date().toISOString(), closed_by: 'uid-guard-pastor' }),
    });
    expect((await link()).status).toBe(422);
    expect(await (await db(`raah_communion_review_logs?review_id=eq.${reviewId}&select=review_id`)).json()).toEqual([]);
  });
});
