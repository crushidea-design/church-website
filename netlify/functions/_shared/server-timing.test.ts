import { describe, expect, it } from 'vitest';
import { formatServerTiming, timed, withServerTiming } from './server-timing.mjs';

describe('server timing', () => {
  it('formats phases with counts, the total and a cold marker', () => {
    const value = formatServerTiming(new Map([['db', { dur: 12.4, count: 2 }]]), 30.6, true);
    expect(value).toBe('db;dur=12;desc="2x", app;dur=31, cold;desc="first request of this instance"');
  });

  it('adds a header built from the phases timed during the request', async () => {
    const handler = withServerTiming(async () => {
      await timed('auth', async () => undefined);
      await timed('db', async () => undefined);
      await timed('db', async () => undefined);
      return new Response('{}');
    });
    const header = (await handler(new Request('https://example.test'))).headers.get('Server-Timing') || '';
    expect(header).toMatch(/auth;dur=\d+;desc="1x"/);
    expect(header).toMatch(/db;dur=\d+;desc="2x"/);
    expect(header).toMatch(/app;dur=\d+/);
  });

  it('copies responses whose headers are immutable', async () => {
    const frozen = new Response('x', { status: 201 });
    Object.defineProperty(frozen, 'headers', { value: { append: () => { throw new TypeError('immutable'); }, forEach: () => undefined, [Symbol.iterator]: [][Symbol.iterator] } });
    const handler = withServerTiming(async () => frozen);
    const response = await handler(new Request('https://example.test'));
    expect(response.status).toBe(201);
    expect(response.headers.get('Server-Timing')).toMatch(/app;dur=/);
  });

  it('runs fn untouched outside a request', async () => {
    await expect(timed('db', async () => 7)).resolves.toBe(7);
  });
});
