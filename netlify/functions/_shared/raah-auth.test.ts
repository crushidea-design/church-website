import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ initialize: vi.fn(), verify: vi.fn(), get: vi.fn() }));
vi.mock('./firebase-admin.mjs', () => ({
  initializeFirebaseAdmin: mocks.initialize,
  getAppDb: () => ({ collection: () => ({ doc: () => ({ get: mocks.get }) }) }),
}));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: mocks.verify }) }));
import { requireRaahAdmin } from './raah-auth.mjs';
import aiHandler from '../raah-ai-assist.mjs';

const request = (token = 'test-token') => new Request('https://example.test/api/raah/notes', {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});

describe('RAAH authorization boundary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.initialize.mockReturnValue(true);
    mocks.verify.mockResolvedValue({ uid: 'member', email: 'member@example.test', email_verified: true });
    mocks.get.mockResolvedValue({ exists: true, data: () => ({ role: 'user' }) });
  });
  it('rejects missing and revoked tokens', async () => {
    expect((await requireRaahAdmin(request(''))).response?.status).toBe(401);
    mocks.verify.mockRejectedValue(new Error('revoked'));
    expect((await requireRaahAdmin(request())).response?.status).toBe(401);
    expect(mocks.verify).toHaveBeenCalledWith('test-token', true);
  });
  it('rejects member-controlled admin metadata', async () => {
    mocks.verify.mockResolvedValue({ uid: 'member', user_metadata: { role: 'admin' } });
    expect((await requireRaahAdmin(request())).response?.status).toBe(403);
  });
  it('checks the current server role on every request', async () => {
    mocks.get.mockResolvedValueOnce({ exists: true, data: () => ({ role: 'admin' }) });
    expect((await requireRaahAdmin(request())).user?.uid).toBe('member');
    expect((await requireRaahAdmin(request())).response?.status).toBe(403);
  });
  it('does not trust an unverified owner email', async () => {
    mocks.verify.mockResolvedValue({ uid: 'other', email: 'crushidea@gmail.com', email_verified: false });
    expect((await requireRaahAdmin(request())).response?.status).toBe(403);
    mocks.verify.mockResolvedValue({ uid: 'owner', email: 'crushidea@gmail.com', email_verified: true });
    expect((await requireRaahAdmin(request())).user?.uid).toBe('owner');
  });
  it('fails closed when the authentication service is unavailable', async () => {
    mocks.initialize.mockReturnValue(false);
    expect((await requireRaahAdmin(request())).response?.status).toBe(503);
    expect(mocks.verify).not.toHaveBeenCalled();
  });
  it('never reads or forwards an AI memo, even for an administrator', async () => {
    mocks.get.mockResolvedValue({ exists: true, data: () => ({ role: 'admin' }) });
    const req = new Request('https://example.test/api/raah/ai-assist', {
      method: 'POST', headers: { Authorization: 'Bearer test-token' },
      body: JSON.stringify({ rawMemo: 'PRIVATE_TEST_MARKER' }),
    });
    const readBody = vi.spyOn(req, 'json');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network'));
    try {
      const response = await aiHandler(req);
      expect(response.status).toBe(410);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(readBody).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(await response.text()).not.toContain('PRIVATE_TEST_MARKER');
    } finally { fetchSpy.mockRestore(); }
  });
});
