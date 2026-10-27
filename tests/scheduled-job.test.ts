import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ initialize: vi.fn(), db: vi.fn() }));
vi.mock('../netlify/functions/_shared/firebase-admin.mjs', () => ({
  initializeFirebaseAdmin: mocks.initialize, getAppDb: mocks.db,
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));
import { JOBS, runScheduledJob, scheduledSlot, netlifyScheduledHandler } from '../netlify/functions/_shared/scheduled-job.mjs';

type Data = Record<string, unknown>;
let records: Map<string, Data>;
const ref = (path: string) => ({ path, update: async (data: Data) => { records.set(path, { ...records.get(path), ...data }); } });
function database() {
  let queue = Promise.resolve();
  return {
    collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
    runTransaction: (work: (tx: unknown) => Promise<unknown>) => {
      const pending = queue.then(() => work({
        get: async (doc: { path: string }) => ({ exists: records.has(doc.path), data: () => records.get(doc.path) }),
        create: (doc: { path: string }, data: Data) => { if (records.has(doc.path)) throw new Error('already exists'); records.set(doc.path, data); },
      }));
      queue = pending.then(() => {}, () => {});
      return pending;
    },
  };
}
const success = () => Promise.resolve(Response.json({ ok: true }));
const control = (owner: unknown) => records.set('_scheduler_control/jobs', { owners: { wordFruitAutoDraft: owner } });
const ledger = () => [...records.entries()].filter(([key]) => key.startsWith('_scheduled_job_runs/')).map(([, value]) => value);

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-17T14:00:00Z'));
  records = new Map(); mocks.initialize.mockReturnValue(true); mocks.db.mockReturnValue(database());
});
afterEach(() => vi.useRealTimers());

describe('schedule slots', () => {
  it('keeps the four original schedules when expressed in Seoul time', () => {
    expect(Object.values(JOBS).map(j => j.kstCron)).toEqual(['0 * * * *', '0 23 * * *', '0 12 * * 5', '0 23 * * 6']);
  });
  it('uses stable UTC slot keys across boundaries and delayed calls', () => {
    expect(scheduledSlot('scheduledNotifications', new Date('2026-10-17T14:59:59Z'))).toBe('2026-10-17T14:00:00.000Z');
    expect(scheduledSlot('wordFruitAggregate', new Date('2026-10-17T13:59:59Z'))).toBe('2026-10-16T14:00:00.000Z');
    expect(scheduledSlot('wordFruitFridayWarning', new Date('2026-10-16T02:59:59Z'))).toBe('2026-10-09T03:00:00.000Z');
    expect(scheduledSlot('wordFruitAutoDraft', new Date('2027-01-02T14:10:00Z'))).toBe('2027-01-02T14:00:00.000Z');
  });
});

describe('cross-provider at-most-once execution', () => {
  it('keeps Firebase inactive until an explicit control change', async () => {
    const work = vi.fn(success);
    expect(await (await runScheduledJob('wordFruitAutoDraft', 'firebase', work)).json()).toEqual({ ok: true, status: 'INACTIVE_PROVIDER' });
    expect(work).not.toHaveBeenCalled(); expect(ledger()).toHaveLength(0);
    await runScheduledJob('wordFruitAutoDraft', 'netlify', work);
    expect(work).toHaveBeenCalledTimes(1); expect(ledger()[0].status).toBe('completed');
  });
  it.each(['paused', 'invalid', null])('fails closed for an explicit %s owner', async (owner) => {
    control(owner); const work = vi.fn(success);
    await runScheduledJob('wordFruitAutoDraft', 'netlify', work);
    await runScheduledJob('wordFruitAutoDraft', 'firebase', work);
    expect(work).not.toHaveBeenCalled();
  });
  it('claims only once for concurrent duplicate deliveries', async () => {
    control('firebase'); const work = vi.fn(success);
    await Promise.all(Array.from({ length: 5 }, () => runScheduledJob('wordFruitAutoDraft', 'firebase', work, '2026-10-17T14:00:00Z')));
    expect(work).toHaveBeenCalledTimes(1); expect(ledger()).toHaveLength(1);
  });
  it('does not repeat a slot when switching providers during execution', async () => {
    const work = vi.fn(async () => { control('firebase'); return success(); });
    await runScheduledJob('wordFruitAutoDraft', 'netlify', work);
    await runScheduledJob('wordFruitAutoDraft', 'firebase', work);
    expect(work).toHaveBeenCalledTimes(1);
  });
  it('never auto-expires an uncertain processing claim', async () => {
    control('firebase');
    records.set('_scheduled_job_runs/wordFruitAutoDraft__2026-10-17T14:00:00.000Z', { status: 'processing' });
    const work = vi.fn(success); await runScheduledJob('wordFruitAutoDraft', 'firebase', work);
    expect(work).not.toHaveBeenCalled();
  });
  it('marks ambiguous failures for review, without storing content or retrying', async () => {
    control('firebase'); const work = vi.fn(async () => { throw new Error('private token or manuscript'); });
    await expect(runScheduledJob('wordFruitAutoDraft', 'firebase', work)).rejects.toThrow('SCHEDULED_JOB_NEEDS_REVIEW');
    await runScheduledJob('wordFruitAutoDraft', 'firebase', work);
    expect(work).toHaveBeenCalledTimes(1); expect(ledger()[0].status).toBe('needs_review');
    expect(JSON.stringify(ledger())).not.toContain('private');
  });
  it.each(['AI_FAILED', undefined])('detects a handler HTTP-200 failure (%s)', async (reason) => {
    await expect(runScheduledJob('wordFruitAutoDraft', 'netlify', () => Promise.resolve(Response.json({ ok: false, reason })))).rejects.toThrow();
    expect(ledger()[0].status).toBe('needs_review');
  });
  it.each(['ALREADY_PUBLISHED', 'HUMAN_EDITED', 'NO_MANUSCRIPT'])('treats %s as a terminal skip', async (reason) => {
    await runScheduledJob('wordFruitAutoDraft', 'netlify', () => Promise.resolve(Response.json({ ok: false, reason })));
    expect(ledger()[0].status).toBe('skipped');
  });
  it('allows the following scheduled slot without retrying the old one', async () => {
    const work = vi.fn(success);
    await runScheduledJob('scheduledNotifications', 'netlify', work);
    vi.setSystemTime(new Date('2026-10-17T15:00:00Z'));
    await runScheduledJob('scheduledNotifications', 'netlify', work);
    expect(work).toHaveBeenCalledTimes(2); expect(ledger()).toHaveLength(2);
  });
  it('rejects invalid and stale scheduler events before any job work', async () => {
    const work = vi.fn(success);
    for (const time of ['invalid', '2026-10-17T12:00:00Z', '2026-10-17T15:00:00Z']) {
      await expect(runScheduledJob('wordFruitAutoDraft', 'firebase', work, time)).rejects.toThrow();
    }
    expect(mocks.db).not.toHaveBeenCalled(); expect(work).not.toHaveBeenCalled();
  });
  it('fails closed when Admin is unavailable', async () => {
    mocks.initialize.mockReturnValue(false); const work = vi.fn(success);
    expect((await netlifyScheduledHandler('scheduledNotifications', work)()).status).toBe(500);
    expect(mocks.db).not.toHaveBeenCalled(); expect(work).not.toHaveBeenCalled();
  });
});
