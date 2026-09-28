import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireRaahAdmin: vi.fn() }));
vi.mock('./raah-auth.mjs', () => ({ requireRaahAdmin: mocks.requireRaahAdmin }));
import { requireRaahAccess } from './raah-access.mjs';

const request = () => new Request('https://example.test/api/raah/members', { headers: { Authorization: 'Bearer t' } });
const admin = { uid: 'admin-uid', email: 'admin@example.test', name: 'Admin' };
const grantResponse = (rows: unknown[]) => new Response(JSON.stringify(rows), { status: 200 });
const grant = (overrides: Record<string, unknown> = {}) => ({
  access_role: 'pastor',
  active: true,
  expires_at: null,
  revoked_at: null,
  ...overrides,
});

describe('RAAH workspace access', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireRaahAdmin.mockResolvedValue({ user: admin });
    vi.stubEnv('SUPABASE_URL', 'https://supabase.example.test/');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    vi.stubEnv('RAAH_ACCESS_ENFORCED', 'true');
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it('keeps the legacy admin rejection first', async () => {
    const forbidden = new Response(null, { status: 403 });
    mocks.requireRaahAdmin.mockResolvedValue({ response: forbidden });
    expect((await requireRaahAccess(request())).response).toBe(forbidden);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('passes admins through without a grant lookup while enforcement is off', async () => {
    vi.stubEnv('RAAH_ACCESS_ENFORCED', '');
    const result = await requireRaahAccess(request());
    expect(result.access).toEqual({ user: admin, workspaceId: 'default', accessRole: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('still requires a grant for grant-only features while enforcement is off', async () => {
    vi.stubEnv('RAAH_ACCESS_ENFORCED', '');
    fetchSpy.mockResolvedValue(grantResponse([]));
    expect((await requireRaahAccess(request(), { requireGrant: true })).response?.status).toBe(403);
    fetchSpy.mockResolvedValue(grantResponse([grant()]));
    expect((await requireRaahAccess(request(), { requireGrant: true })).access?.accessRole).toBe('pastor');
  });

  it('rejects a homepage admin without a RAAH grant', async () => {
    fetchSpy.mockResolvedValue(grantResponse([]));
    const result = await requireRaahAccess(request());
    expect(result.response?.status).toBe(403);
    expect(await result.response?.json()).toMatchObject({ code: 'RAAH_ACCESS_NOT_GRANTED' });
  });

  it.each([
    ['inactive', grant({ active: false })],
    ['revoked', grant({ active: false, revoked_at: '2026-09-01T00:00:00Z' })],
    ['expired', grant({ expires_at: '2020-01-01T00:00:00Z' })],
  ])('rejects an %s grant', async (_label, row) => {
    fetchSpy.mockResolvedValue(grantResponse([row]));
    expect((await requireRaahAccess(request())).response?.status).toBe(403);
  });

  it('accepts an active grant and looks it up by the verified uid in the fixed workspace', async () => {
    fetchSpy.mockResolvedValue(grantResponse([grant({ expires_at: '2999-01-01T00:00:00Z' })]));
    const result = await requireRaahAccess(request());
    expect(result.access).toEqual({ user: admin, workspaceId: 'default', accessRole: 'pastor' });

    const url = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe('https://supabase.example.test/rest/v1/raah_workspace_access');
    expect(url.searchParams.get('firebase_uid')).toBe('eq.admin-uid');
    expect(url.searchParams.get('workspace_id')).toBe('eq.default');
  });

  it('re-reads the grant on every request so revocation applies immediately', async () => {
    fetchSpy.mockResolvedValueOnce(grantResponse([grant()])).mockResolvedValueOnce(grantResponse([grant({ active: false })]));
    expect((await requireRaahAccess(request())).access).toBeDefined();
    expect((await requireRaahAccess(request())).response?.status).toBe(403);
  });

  it.each([
    ['a lookup error', () => fetchSpy.mockResolvedValue(new Response('{}', { status: 500 }))],
    ['a network failure', () => fetchSpy.mockRejectedValue(new Error('offline'))],
    ['missing configuration', () => vi.stubEnv('SUPABASE_URL', '')],
  ])('fails closed with 503 on %s', async (_label, arrange) => {
    arrange();
    expect((await requireRaahAccess(request())).response?.status).toBe(503);
  });
});
