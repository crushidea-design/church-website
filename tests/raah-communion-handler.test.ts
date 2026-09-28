import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireRaahAccess: vi.fn() }));
vi.mock('../netlify/functions/_shared/raah-access.mjs', () => ({ requireRaahAccess: mocks.requireRaahAccess }));
import handler from '../netlify/functions/raah-communion.mjs';
import { mapUpstreamError } from '../netlify/functions/_shared/raah-rpc.mjs';

describe('raah-communion handler', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it('answers 404 without checking auth or touching storage while disabled', async () => {
    vi.stubEnv('RAAH_COMMUNION_ENABLED', '');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const response = await handler(new Request('https://raah.test/api/raah/communion/periods'), { params: {} } as never);
    expect(response?.status).toBe(404);
    expect(mocks.requireRaahAccess).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('asks for a RAAH grant regardless of the global enforcement flag', async () => {
    vi.stubEnv('RAAH_COMMUNION_ENABLED', 'true');
    mocks.requireRaahAccess.mockResolvedValue({ response: new Response(null, { status: 403 }) });
    await handler(new Request('https://raah.test/api/raah/communion/periods'), { params: {} } as never);
    expect(mocks.requireRaahAccess).toHaveBeenCalledWith(expect.any(Request), { requireGrant: true });
  });

  it('maps known SQLSTATEs and hides unknown upstream errors', async () => {
    expect(mapUpstreamError('P0409').status).toBe(409);
    expect(mapUpstreamError('P0403').status).toBe(403);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const unknown = mapUpstreamError('XX000');
    expect(unknown.status).toBe(502);
    expect(await unknown.json()).toEqual({ error: '저장소 요청을 처리하지 못했습니다.', code: 'RAAH_UPSTREAM_ERROR' });
    expect(errorSpy).toHaveBeenCalledWith('RAAH upstream error', 'XX000');
    errorSpy.mockRestore();
  });
});
