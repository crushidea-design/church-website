import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Drives the real Netlify handler against the local Supabase stack
// (`npm run test:db`). Only Firebase token verification is mocked.
const url = process.env.RAAH_TEST_SUPABASE_URL;
const serviceKey = process.env.RAAH_TEST_SERVICE_ROLE_KEY;
const enabled = Boolean(url && serviceKey && process.env.RAAH_TEST_ANON_KEY);

const auth = vi.hoisted(() => ({ uid: 'uid-api-pastor' }));
vi.mock('../../netlify/functions/_shared/raah-auth.mjs', () => ({
  requireRaahAdmin: async (req: Request) =>
    req.headers.get('authorization')
      ? { user: { uid: auth.uid, name: '가상 목양자' } }
      : { response: new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 }) },
}));
import handler from '../../netlify/functions/raah-communion.mts';

const BASE = 'https://raah.test/api/raah/communion';

function call(path: string, init: RequestInit & { params?: Record<string, string> } = {}) {
  const { params, ...rest } = init;
  const request = new Request(`${BASE}${path}`, {
    ...rest,
    headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json', ...(rest.headers || {}) },
  });
  return handler(request, { params: params || {} } as never) as Promise<Response>;
}

async function insert(table: string, row: Record<string, unknown>) {
  const response = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  expect(response.status, await response.clone().text()).toBe(201);
  return (await response.json())[0];
}

const periodBody = { name: '대림절 목양 주기', startsOn: '2026-11-29', endsOn: '2026-12-20', guideVersion: 'draft-2026-09', serviceDate: '2026-12-20' };

describe.skipIf(!enabled)('raah-communion API against local Supabase', () => {
  let memberA: string;
  let memberB: string;

  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', url!);
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', serviceKey!);
    vi.stubEnv('RAAH_COMMUNION_ENABLED', 'true');
    await insert('raah_workspace_access', { firebase_uid: 'uid-api-pastor', access_role: 'pastor' });
    memberA = (await insert('raah_members', { name: '가상 나성도', search_name: '가상나성도' })).id;
    memberB = (await insert('raah_members', { name: '가상 가성도', search_name: '가상가성도' })).id;
  });
  afterAll(() => vi.unstubAllEnvs());
  beforeEach(() => {
    auth.uid = 'uid-api-pastor';
  });

  it('is hidden while the feature flag is off', async () => {
    vi.stubEnv('RAAH_COMMUNION_ENABLED', '');
    const response = await call('/periods');
    expect(response.status).toBe(404);
    vi.stubEnv('RAAH_COMMUNION_ENABLED', 'true');
  });

  it('requires sign-in and a RAAH grant even for homepage admins', async () => {
    expect((await handler(new Request(`${BASE}/periods`), { params: {} } as never))?.status).toBe(401);
    auth.uid = 'uid-homepage-admin-only';
    expect((await call('/periods')).status).toBe(403);
  });

  it('runs the period → roster → review flow end to end', async () => {
    const created = await call('/periods', { method: 'POST', headers: { 'Idempotency-Key': 'api-flow-key-01' }, body: JSON.stringify(periodBody) });
    expect(created.status).toBe(201);
    expect(created.headers.get('cache-control')).toBe('no-store');
    const { id: periodId } = await created.json();

    const retried = await call('/periods', { method: 'POST', headers: { 'Idempotency-Key': 'api-flow-key-01' }, body: JSON.stringify(periodBody) });
    expect((await retried.json()).id).toBe(periodId);

    const roster = await call(`/periods/${periodId}/roster`, {
      method: 'POST',
      params: { id: periodId },
      body: JSON.stringify({ entries: [{ memberId: memberA, included: true }, { memberId: memberB, included: true }] }),
    });
    expect(roster.status).toBe(200);
    expect((await roster.json()).applied).toBe(2);

    const detail = await (await call(`/periods/${periodId}`, { params: { id: periodId } })).json();
    expect(detail.period.occasions).toEqual([expect.objectContaining({ serviceDate: '2026-12-20' })]);
    expect(detail.period.counts).toMatchObject({ included: 2, byStatus: { not_started: 2 } });
    expect(detail.reviews.map((review: { memberName: string }) => review.memberName)).toEqual(['가상 가성도', '가상 나성도']);

    const review = detail.reviews[0];
    const moved = await call(`/reviews/${review.id}`, {
      method: 'PATCH',
      params: { id: review.id },
      body: JSON.stringify({ status: 'scheduled', expectedRevision: review.revision }),
    });
    expect(await moved.json()).toMatchObject({ status: 'scheduled', revision: review.revision + 1 });

    const stale = await call(`/reviews/${review.id}`, {
      method: 'PATCH',
      params: { id: review.id },
      body: JSON.stringify({ status: 'in_progress', expectedRevision: review.revision }),
    });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: 'RAAH_REVISION_CONFLICT' });

    const list = await (await call('/periods')).json();
    const listed = list.periods.find((period: { id: string }) => period.id === periodId);
    expect(listed.counts).toMatchObject({ included: 2, byStatus: { not_started: 1, scheduled: 1 } });
  });

  it('maps invalid transitions and bad input to 422 without upstream details', async () => {
    const { id: periodId } = await (await call('/periods', {
      method: 'POST', headers: { 'Idempotency-Key': 'api-422-key-01' }, body: JSON.stringify(periodBody),
    })).json();
    const { reviewIds } = await (await call(`/periods/${periodId}/roster`, {
      method: 'POST', params: { id: periodId }, body: JSON.stringify({ entries: [{ memberId: memberA, included: true }] }),
    })).json();

    const markReviewed = await call(`/reviews/${reviewIds[0]}`, {
      method: 'PATCH', params: { id: reviewIds[0] }, body: JSON.stringify({ status: 'reviewed', expectedRevision: 1 }),
    });
    expect(markReviewed.status).toBe(200);
    const reopenWithoutReason = await call(`/reviews/${reviewIds[0]}`, {
      method: 'PATCH', params: { id: reviewIds[0] }, body: JSON.stringify({ status: 'in_progress', expectedRevision: 2 }),
    });
    expect(reopenWithoutReason.status).toBe(422);
    const body = JSON.stringify(await reopenWithoutReason.json());
    expect(body).not.toContain('reason required');

    expect((await call('/periods', { method: 'POST', body: JSON.stringify(periodBody) })).status).toBe(422);
    expect((await call('/periods', {
      method: 'POST', headers: { 'Idempotency-Key': 'api-422-key-02' }, body: JSON.stringify({ ...periodBody, endsOn: '2026-01-01' }),
    })).status).toBe(422);
  });

  it('does not reveal whether an id exists in another workspace or at all', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    expect((await call(`/periods/${missing}`, { params: { id: missing } })).status).toBe(404);
    expect((await call('/periods/not-a-uuid', { params: { id: 'not-a-uuid' } })).status).toBe(404);
  });
});
