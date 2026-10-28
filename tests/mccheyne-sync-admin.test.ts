import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ verify: vi.fn(), user: vi.fn(), run: vi.fn(), status: vi.fn(), preview: vi.fn(), approve: vi.fn(), stop: vi.fn(), hold: vi.fn() }));
vi.mock('firebase-admin/app', () => ({ getApps: () => [{}], getApp: () => ({}), initializeApp: vi.fn(), applicationDefault: vi.fn(), cert: vi.fn() }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: mocks.verify }) }));
vi.mock('firebase-admin/messaging', () => ({ getMessaging: vi.fn() }));
vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({ collection: () => ({ doc: () => ({ get: mocks.user }) }) }), FieldValue: {} }));
vi.mock('../netlify/functions/_shared/mccheyne-sync-runtime.mjs', () => ({ executeSync: mocks.run, syncStatus: mocks.status, previewSource: mocks.preview, approveSource: mocks.approve, stopSync: mocks.stop, holdSitePost: mocks.hold }));
import handler from '../netlify/functions/mccheyne-sync.mts';
const request = (body?: unknown, token = 'dummy-id-token') => new Request('http://localhost/api/mccheyne/sync', {
  method: body ? 'POST' : 'GET', headers: token ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' } : {}, ...(body ? { body: JSON.stringify(body) } : {}),
});
beforeEach(() => {
  vi.resetAllMocks(); mocks.verify.mockResolvedValue({ uid: 'test-admin', email: 'admin@example.test', email_verified: true });
  mocks.user.mockResolvedValue({ exists: true, data: () => ({ role: 'admin' }) });
  mocks.run.mockResolvedValue({ code: 'COMPLETE' }); mocks.status.mockResolvedValue({ mode: 'off', records: [] });
});
describe('admin-only sync endpoint', () => {
  const operations = [
    undefined,
    { action: 'stop', uid: 'forged-admin' },
    { action: 'manual-edit', id: 'document_12345', uid: 'forged-admin' },
    { action: 'manual-delete', id: 'document_12345', uid: 'forged-admin' },
    { action: 'run', role: 'admin', uid: 'forged-admin', isAdmin: true },
    { action: 'run_one', id: 'document_12345', date: '2026-10-29' },
    { action: 'preview', id: 'document_12345', role: 'admin' },
    { action: 'approve', id: 'document_12345', sourceHash: 'a'.repeat(64), date: '2026-12-03', uid: 'forged-admin' },
    { action: 'config', id: 'document_12345', mode: 'publish', year: 2027 },
  ];
  function expectNoWork() {
    for (const fn of [mocks.run, mocks.status, mocks.preview, mocks.approve, mocks.stop, mocks.hold]) expect(fn).not.toHaveBeenCalled();
  }
  it('guards every operation against anonymous, invalid, disabled, and revoked sessions', async () => {
    for (const body of operations) expect((await handler(request(body, ''))).status).toBe(401);
    expect(mocks.verify).not.toHaveBeenCalled();
    for (const code of ['auth/argument-error', 'auth/id-token-revoked', 'auth/user-disabled']) {
      mocks.verify.mockRejectedValue(Object.assign(new Error('authentication failed'), { code }));
      for (const body of operations) expect((await handler(request(body))).status).toBe(401);
    }
    expectNoWork();
    for (const call of mocks.verify.mock.calls) expect(call).toEqual(['dummy-id-token', true]);
  });
  it('ignores forged body/custom admin claims and rejects all operations after the stored role is removed', async () => {
    mocks.verify.mockResolvedValue({ uid: 'former-admin', email: 'member@example.test', email_verified: true, role: 'admin', admin: true });
    for (const userDoc of [{ exists: true, data: () => ({ role: 'regular' }) }, { exists: false, data: () => undefined }]) {
      mocks.user.mockResolvedValue(userDoc);
      for (const body of operations) expect((await handler(request(body))).status).toBe(403);
    }
    expectNoWork();
    expect(mocks.user).toHaveBeenCalledTimes(operations.length * 2);
  });
  it('rechecks the stored role on the next request with the same token', async () => {
    expect((await handler(request())).status).toBe(200);
    mocks.user.mockResolvedValue({ exists: true, data: () => ({ role: 'regular' }) });
    expect((await handler(request({ action: 'run' }))).status).toBe(403);
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.user).toHaveBeenCalledTimes(2);
  });
  it('preserves the existing verified owner-email exception independently of the user role', async () => {
    mocks.verify.mockResolvedValue({ uid: 'owner', email: 'crushidea@gmail.com', email_verified: true });
    mocks.user.mockResolvedValue({ exists: true, data: () => ({ role: 'regular' }) });
    expect((await handler(request())).status).toBe(200);
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it('does not expose a client configuration mutation and uses the verified uid for approval', async () => {
    expect((await handler(request({ action: 'config', id: 'document_12345', mode: 'publish', year: 2027 }))).status).toBe(400);
    expectNoWork();
    const body = { action: 'approve', id: 'document_12345', sourceHash: 'a'.repeat(64), date: '2026-12-03', uid: 'forged-admin', approvedBy: 'forged-admin' };
    mocks.approve.mockResolvedValue({ code: 'APPROVED' });
    expect((await handler(request(body))).status).toBe(200);
    expect(mocks.approve).toHaveBeenCalledWith(body.id, body.sourceHash, body.date, 'test-admin', undefined);
  });
  it('rejects anonymous and revoked tokens before any execution', async () => {
    expect((await handler(request({ action: 'run' }, ''))).status).toBe(401);
    expect(mocks.verify).not.toHaveBeenCalled();
    mocks.verify.mockRejectedValue(new Error('revoked token secret detail'));
    const response = await handler(request({ action: 'run' }));
    expect(response.status).toBe(401); expect(await response.text()).not.toContain('secret'); expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.verify).toHaveBeenCalledWith('dummy-id-token', true);
  });
  it('allows only the verified admin to stop and validates trial cursors', async () => {
    mocks.stop.mockResolvedValue({ code: 'STOPPED' });
    expect((await handler(request({ action: 'stop', uid: 'forged-admin' }))).status).toBe(200);
    expect(mocks.stop).toHaveBeenCalledWith('test-admin');
    expect((await handler(request({ action: 'run', cursor: '../outside' }))).status).toBe(400);
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it('binds manual holds and website reapproval to the authenticated administrator', async () => {
    mocks.hold.mockResolvedValue({ managed: true });
    expect((await handler(request({ action: 'manual-delete', id: 'document_12345', uid: 'forged' }))).status).toBe(200);
    expect(mocks.hold).toHaveBeenCalledWith('document_12345', 'delete', 'test-admin');
    mocks.approve.mockResolvedValue({ code: 'APPROVED' });
    expect((await handler(request({ action: 'approve', id: 'document_12345', sourceHash: 'a'.repeat(64), date: '2026-12-03', siteVersion: 'b'.repeat(64) }))).status).toBe(200);
    expect(mocks.approve).toHaveBeenCalledWith('document_12345', 'a'.repeat(64), '2026-12-03', 'test-admin', 'b'.repeat(64));
  });
  it('denies ordinary members and an unverified owner email', async () => {
    mocks.user.mockResolvedValue({ exists: true, data: () => ({ role: 'regular' }) });
    for (const email of ['member@example.test', 'crushidea@gmail.com']) {
      mocks.verify.mockResolvedValue({ uid: 'member', email, email_verified: false });
      expect((await handler(request({ action: 'run' }))).status).toBe(403);
    }
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it('allows authenticated admins and makes status/results non-cacheable', async () => {
    const run = await handler(request({ action: 'run' })); expect(run.status).toBe(200); expect(mocks.run).toHaveBeenCalledOnce();
    expect(run.headers.get('Cache-Control')).toBe('no-store'); expect((await handler(request())).status).toBe(200);
  });
  it('requires both an exact source ID and real date for a single run, without a batch cursor', async () => {
    const target = { id: 'document_12345', date: '2026-10-29' };
    for (const body of [{ action: 'run_one' }, { action: 'run_one', id: target.id }, { action: 'run_one', ...target, date: '2026-02-30' }, { action: 'run_one', ...target, id: '../outside' }, { action: 'run_one', ...target, cursor: 'document_67890' }]) {
      expect((await handler(request(body))).status).toBe(400);
    }
    expect(mocks.run).not.toHaveBeenCalled();
    expect((await handler(request({ action: 'run_one', ...target }))).status).toBe(200);
    expect(mocks.run).toHaveBeenCalledExactlyOnceWith(undefined, undefined, target);
  });
  it('binds approval to an explicit version hash/date and authenticated uid', async () => {
    const body = { action: 'approve', id: 'document_12345', sourceHash: 'a'.repeat(64), date: '2026-12-03' };
    mocks.approve.mockResolvedValue({ code: 'APPROVED' });
    expect((await handler(request(body))).status).toBe(200);
    expect(mocks.approve).toHaveBeenCalledWith(body.id, body.sourceHash, body.date, 'test-admin', undefined);
    expect((await handler(request({ ...body, sourceHash: '' }))).status).toBe(400);
  });
  it('does not return or log raw credential/document errors', async () => {
    const log = vi.spyOn(console, 'error'); mocks.run.mockRejectedValue(new Error('Bearer SECRET full document'));
    const response = await handler(request({ action: 'run' }));
    expect(await response.json()).toEqual({ code: 'INTERNAL_ERROR' }); expect(log).not.toHaveBeenCalled(); log.mockRestore();
  });
});
