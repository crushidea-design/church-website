import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Drives the real care-task handler against local Supabase (`npm run test:db`).
// Only Firebase token verification is mocked. All data is fictional.
const url = process.env.RAAH_TEST_SUPABASE_URL;
const serviceKey = process.env.RAAH_TEST_SERVICE_ROLE_KEY;
const anonKey = process.env.RAAH_TEST_ANON_KEY;
const enabled = Boolean(url && serviceKey && anonKey);
const SECRET = 'local-care-task-secret-not-used-elsewhere';

vi.mock('../../netlify/functions/_shared/raah-auth.mjs', () => ({
  requireRaahAdmin: async () => ({ user: { uid: 'uid-care-pastor', name: '가상 목양자' } }),
}));
import handler from '../../netlify/functions/raah-care-tasks.mts';

const call = (path: string, init: RequestInit & { params?: Record<string, string> } = {}) => {
  const { params, ...rest } = init;
  return handler(
    new Request(`https://raah.test/api/raah/care-tasks${path}`, {
      ...rest,
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json', ...(rest.headers || {}) },
    }),
    { params: params || {} } as never
  ) as Promise<Response>;
};

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

describe.skipIf(!enabled)('raah-care-tasks API against local Supabase', () => {
  let member: string;
  let otherMember: string;
  let otherLog: string;

  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', url!);
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', serviceKey!);
    vi.stubEnv('RAAH_COMMUNION_ENABLED', 'true');
    vi.stubEnv('RAAH_ENCRYPTION_SECRET', SECRET);
    await insert('raah_workspace_access', { firebase_uid: 'uid-care-pastor', access_role: 'pastor' });
    member = (await insert('raah_members', { name: '가상 돌봄성도', search_name: '가상돌봄성도' })).id;
    otherMember = (await insert('raah_members', { name: '가상 다른성도', search_name: '가상다른성도' })).id;
    otherLog = (await insert('raah_visitation_logs', {
      member_id: otherMember, member_name: '가상 다른성도', member_search_name: '가상다른성도', date: '2026-10-01', log_type: '심방',
      encrypted_payload: { iv: 'x', tag: 'y', ciphertext: 'z' },
    })).id;
  });
  afterAll(() => vi.unstubAllEnvs());

  const newTask = (key: string, body: Record<string, unknown>) =>
    call('', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) });

  const baseTask = {
    sourceType: 'manual',
    sourceId: null,
    title: '후속 면담',
    dueOn: '2026-10-12',
    detail: 'PRIVATE_TASK_MARKER 복음의 확신을 다시 살피기',
    schedule: { date: '2026-10-11', startsAt: '14:00' },
  };

  let taskId: string;
  let scheduleItemId: string;

  it('creates the task and a neutral schedule slot together, with the detail encrypted', async () => {
    const created = await newTask('care-task-key-001', { ...baseTask, memberId: member });
    expect(created.status).toBe(201);
    ({ taskId, scheduleItemId } = await created.json());

    const [row] = await (await db(`raah_care_tasks?id=eq.${taskId}&select=*`)).json();
    expect(JSON.stringify(row)).not.toContain('PRIVATE_TASK_MARKER');
    expect(row).toMatchObject({ title: '후속 면담', status: 'open', schedule_item_id: scheduleItemId, encryption_version: 1 });

    const [slot] = await (await db(`raah_ministry_schedule_items?id=eq.${scheduleItemId}&select=*`)).json();
    expect(slot).toMatchObject({ title: '목양 일정', memo: null, date: '2026-10-11', starts_at: '14:00', item_type: 'visitation', member_id: member });
  });

  it('returns the same task for a retried request without a second schedule slot', async () => {
    const retried = await (await newTask('care-task-key-001', { ...baseTask, memberId: member })).json();
    expect(retried.taskId).toBe(taskId);
    const slots = await (await db(`raah_ministry_schedule_items?member_id=eq.${member}&select=id`)).json();
    expect(slots).toHaveLength(1);
  });

  it('lists tasks without their detail', async () => {
    const { tasks } = await (await call(`?memberId=${member}`)).json();
    expect(tasks).toEqual([expect.objectContaining({ id: taskId, title: '후속 면담', hasDetail: true, schedule: expect.objectContaining({ id: scheduleItemId }) })]);
    expect(JSON.stringify(tasks)).not.toContain('PRIVATE_TASK_MARKER');
  });

  it('reveals the detail only on the single-task endpoint and audits that view', async () => {
    const { task } = await (await call(`/${taskId}`, { params: { id: taskId } })).json();
    expect(task.detail).toBe(baseTask.detail);
    const events = await (await db(`raah_audit_events?target_id=eq.${taskId}&action=eq.care_task.detail_view&select=id`)).json();
    expect(events).toHaveLength(1);
  });

  it('keeps the calendar slot and the care separate in both directions', async () => {
    await db(`raah_ministry_schedule_items?id=eq.${scheduleItemId}`, { method: 'PATCH', body: JSON.stringify({ status: 'done' }) });
    let { task } = await (await call(`/${taskId}`, { params: { id: taskId } })).json();
    expect(task.status).toBe('open');

    const done = await call(`/${taskId}`, { method: 'PATCH', params: { id: taskId }, body: JSON.stringify({ status: 'done', expectedRevision: task.revision }) });
    expect(done.status).toBe(200);
    await db(`raah_ministry_schedule_items?id=eq.${scheduleItemId}`, { method: 'PATCH', body: JSON.stringify({ status: 'open' }) });
    ({ task } = await (await call(`/${taskId}`, { params: { id: taskId } })).json());
    expect(task).toMatchObject({ status: 'done', schedule: expect.objectContaining({ status: 'open' }) });
  });

  it('reopens, defers with a new date only, and rejects stale revisions', async () => {
    const reopened = await (await call(`/${taskId}`, { method: 'PATCH', params: { id: taskId }, body: JSON.stringify({ status: 'open', expectedRevision: 2 }) })).json();
    expect(reopened.revision).toBe(3);
    expect((await call(`/${taskId}`, { method: 'PATCH', params: { id: taskId }, body: JSON.stringify({ status: 'deferred', expectedRevision: 3 }) })).status).toBe(422);
    expect((await call(`/${taskId}`, { method: 'PATCH', params: { id: taskId }, body: JSON.stringify({ status: 'deferred', dueOn: '2026-10-20', expectedRevision: 3 }) })).status).toBe(200);
    expect((await call(`/${taskId}`, { method: 'PATCH', params: { id: taskId }, body: JSON.stringify({ status: 'done', expectedRevision: 3 }) })).status).toBe(409);
  });

  it('only accepts a source record of the same person', async () => {
    const wrong = await newTask('care-task-key-002', { ...baseTask, memberId: member, sourceType: 'visitation_log', sourceId: otherLog, schedule: null });
    expect(wrong.status).toBe(422);
    const slots = await (await db(`raah_ministry_schedule_items?member_id=eq.${member}&select=id`)).json();
    expect(slots).toHaveLength(1);
    const right = await newTask('care-task-key-003', { ...baseTask, memberId: otherMember, sourceType: 'visitation_log', sourceId: otherLog, schedule: null, detail: '' });
    expect(right.status).toBe(201);
  });

  it('hides completed tasks from the active list', async () => {
    const created = await (await newTask('care-task-key-004', { ...baseTask, memberId: member, title: '연락', schedule: null, detail: '' })).json();
    await call(`/${created.taskId}`, { method: 'PATCH', params: { id: created.taskId }, body: JSON.stringify({ status: 'cancelled', expectedRevision: 1 }) });
    const active = await (await call(`?memberId=${member}`)).json();
    const all = await (await call(`?memberId=${member}&scope=all`)).json();
    expect(active.tasks.map((task: { id: string }) => task.id)).not.toContain(created.taskId);
    expect(all.tasks.map((task: { id: string }) => task.id)).toContain(created.taskId);
  });

  it('is closed to browser keys', async () => {
    expect((await db('raah_care_tasks?select=*', {}, anonKey!)).ok).toBe(false);
    const rpc = await db('rpc/raah_rpc_set_care_task_status', { method: 'POST', body: JSON.stringify({ p_workspace: 'default' }) }, anonKey!);
    expect(rpc.ok).toBe(false);
  });
});
