import { describe, expect, it, vi } from 'vitest';
import { checkHostingBackends } from '../scripts/check-hosting-backends.mjs';
import { checkProductionRoute, productionChecks } from '../scripts/check-hosting-production.mjs';

describe('Hosting deployment backend preflight', () => {
  it('fails closed when the CLI cannot list functions instead of silently accepting a v1 fallback', async () => {
    const request = vi.fn().mockResolvedValue(new Response('{}', { status: 403 }));
    await expect(checkHostingBackends('test-token', request)).rejects.toThrow('Cannot list v1');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-active backend without exposing its configuration', async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response('{}'))
      .mockResolvedValueOnce(new Response('{}'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ environment: 'GEN_2', state: 'FAILED', serviceConfig: { service: 'service', environmentVariables: { PRIVATE: 'do-not-print' } } })));
    await expect(checkHostingBackends('test-token', request)).rejects.toThrow('siteApi must be an active');
  });

  it('fails before upload when Hosting cannot inspect the underlying Cloud Run service', async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response('{}'))
      .mockResolvedValueOnce(new Response('{}'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ environment: 'GEN_2', state: 'ACTIVE', serviceConfig: { service: 'siteapi' } })))
      .mockResolvedValueOnce(new Response('{}', { status: 403 }));
    await expect(checkHostingBackends('test-token', request)).rejects.toThrow('Cannot read siteapi Cloud Run metadata (403)');
    expect(request.mock.calls[3][0]).toBe('https://run.googleapis.com/v2/projects/gen-lang-client-0036445484/locations/asia-northeast1/services/siteapi');
    expect(request).toHaveBeenCalledTimes(4);
  });
});

describe('Production route verification', () => {
  it('rejects an API rewritten to the SPA, and sends no authentication', async () => {
    const request = vi.fn().mockResolvedValue(new Response('<html>SPA</html>', { status: 200 }));
    await expect(checkProductionRoute(productionChecks[0], request)).rejects.toThrow('expected 401, got 200');
    const options = request.mock.calls[0][1];
    expect(options.headers).not.toHaveProperty('Authorization');
    expect(options.redirect).toBe('manual');
  });

  it('rejects the church HTML served on RAAH even if a script mentions the surface attribute', async () => {
    const check = productionChecks.find((item: { kind: string }) => item.kind === 'raah');
    const request = vi.fn().mockResolvedValue(new Response('<html><script>const example = \'data-app-surface="raah"\';</script></html>'));
    await expect(checkProductionRoute(check, request)).rejects.toThrow('wrong app entry point');
  });
});
