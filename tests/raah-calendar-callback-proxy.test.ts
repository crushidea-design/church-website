import { afterEach, describe, expect, it, vi } from 'vitest';
import callback from '../netlify/functions/raah-calendar-callback.mjs';

afterEach(() => vi.restoreAllMocks());

describe('legacy calendar callback forwarding', () => {
  it('forwards encoded OAuth query to the fixed Firebase target and preserves HTML errors', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('invalid state', {
      status: 400, headers: { 'content-type': 'text/html; charset=utf-8' },
    }));
    const response = await callback(new Request('https://untrusted.example/.netlify/functions/raah-calendar-callback?code=a%2Bb&state=test.signature'));
    const [target, options] = spy.mock.calls[0];
    expect(String(target)).toBe('https://asia-northeast1-gen-lang-client-0036445484.cloudfunctions.net/raahApi/.netlify/functions/raah-calendar-callback?code=a%2Bb&state=test.signature');
    expect(options?.redirect).toBe('manual');
    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toBe('invalid state');
  });

  it('returns a generic no-store failure without exposing the upstream error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('private-oauth-code'));
    const response = await callback(new Request('https://raah.example/.netlify/functions/raah-calendar-callback'));
    expect(response.status).toBe(502);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).not.toContain('private-oauth-code');
  });

  it('rejects non-GET requests without forwarding', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    const response = await callback(new Request('https://raah.example/.netlify/functions/raah-calendar-callback', { method: 'POST' }));
    expect(response.status).toBe(405);
    expect(spy).not.toHaveBeenCalled();
  });
});
