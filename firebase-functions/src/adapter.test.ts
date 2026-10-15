import { describe, expect, it, vi } from 'vitest';
import { createHmac, createHash, createDecipheriv } from 'node:crypto';
import {
  buildRouteTable,
  handleRequest,
  matchRoute,
  normalizePath,
  toRequest,
  type HandlerModule,
  type IncomingLike,
  type OutgoingLike,
} from './adapter';
import * as management from '../../netlify/functions/raah-management.mjs';
import * as communion from '../../netlify/functions/raah-communion.mjs';
import * as careTasks from '../../netlify/functions/raah-care-tasks.mjs';
import * as calendar from '../../netlify/functions/raah-calendar.mjs';
import * as aiAssist from '../../netlify/functions/raah-ai-assist.mjs';
import * as calendarCallback from '../../netlify/functions/raah-calendar-callback.mjs';

const realModules = [management, communion, careTasks, calendar, aiAssist, calendarCallback] as unknown as HandlerModule[];

const fakeModule = (name: string, path: string | string[]) => {
  const handler = vi.fn(async (_req: Request, ctx: { params: Record<string, string> }) =>
    new Response(JSON.stringify({ name, params: ctx.params }), { status: 200 }));
  return { mod: { default: handler, config: { path } } as HandlerModule, handler };
};

const fakeRes = () => {
  const headers: Record<string, string | string[]> = {};
  const state = { statusCode: 0, body: undefined as Uint8Array | string | undefined, ended: false };
  const res: OutgoingLike = {
    get statusCode() { return state.statusCode; },
    set statusCode(v: number) { state.statusCode = v; },
    setHeader: (n, v) => { headers[n.toLowerCase()] = v; },
    end: (chunk) => { state.body = chunk; state.ended = true; },
  };
  return { res, headers, state };
};

const fakeReq = (over: Partial<IncomingLike> = {}): IncomingLike => ({
  method: 'GET',
  originalUrl: '/api/raah/x',
  headers: { host: 'raah.example.org' },
  ...over,
});

describe('route table', () => {
  it('matches every real handler path, with ids', () => {
    const routes = buildRouteTable(realModules);
    let count = 0;
    for (const mod of realModules) {
      const raw = mod.config!.path!;
      for (const pattern of Array.isArray(raw) ? raw : [raw]) {
        count += 1;
        const concrete = pattern.replace(/:id/g, 'abc-123');
        const match = matchRoute(routes, concrete);
        expect(match, pattern).not.toBeNull();
        expect(match!.route.handler).toBe(mod.default);
        expect(match!.route.pattern).toBe(pattern);
        if (pattern.includes(':id')) expect(match!.params.id).toBe('abc-123');
      }
    }
    expect(count).toBeGreaterThan(20);
  });

  it('routes communion sub-paths with the right id', () => {
    const routes = buildRouteTable(realModules);
    for (const [path, pattern] of [
      ['/api/raah/communion/periods/p1/roster', '/api/raah/communion/periods/:id/roster'],
      ['/api/raah/communion/periods/p1/close', '/api/raah/communion/periods/:id/close'],
      ['/api/raah/communion/periods/p1/reopen', '/api/raah/communion/periods/:id/reopen'],
      ['/api/raah/communion/periods/p1/occasions', '/api/raah/communion/periods/:id/occasions'],
      ['/api/raah/communion/members/m9/profile', '/api/raah/communion/members/:id/profile'],
      ['/api/raah/communion/profiles', '/api/raah/communion/profiles'],
    ] as const) {
      const match = matchRoute(routes, path)!;
      expect(match.route.pattern).toBe(pattern);
      expect(match.route.handler).toBe(communion.default);
    }
    expect(matchRoute(routes, '/api/raah/communion/periods/p1/close')!.params.id).toBe('p1');
  });

  it('prefers the longest literal match regardless of registration order', () => {
    const generic = fakeModule('generic', '/api/raah/things/:id');
    const specific = fakeModule('specific', '/api/raah/things/latest');
    for (const order of [[generic.mod, specific.mod], [specific.mod, generic.mod]]) {
      const routes = buildRouteTable(order);
      expect(matchRoute(routes, '/api/raah/things/latest')!.route.handler).toBe(specific.mod.default);
      expect(matchRoute(routes, '/api/raah/things/other')!.route.handler).toBe(generic.mod.default);
    }
  });

  it('returns null for unknown or partially matching paths and decodes ids', () => {
    const routes = buildRouteTable(realModules);
    expect(matchRoute(routes, '/api/raah/nope')).toBeNull();
    expect(matchRoute(routes, '/api/raah/members/1/extra/deep')).toBeNull();
    expect(matchRoute(routes, '/api/raah/members/a%20b')!.params.id).toBe('a b');
    expect(matchRoute(routes, '/api/raah/members/%E0%A4%A')).toBeNull();
  });
});

describe('normalizePath', () => {
  it('strips the function prefix and trailing slash, rejects non-RAAH paths', () => {
    expect(normalizePath('/raahApi/api/raah/bootstrap')).toBe('/api/raah/bootstrap');
    expect(normalizePath('/api/raah/bootstrap/')).toBe('/api/raah/bootstrap');
    expect(normalizePath('/raahApiX/api/raah/bootstrap')).toBeNull();
    expect(normalizePath('/other')).toBeNull();
    expect(normalizePath('/')).toBeNull();
  });
});

describe('calendar callback', () => {
  const path = '/.netlify/functions/raah-calendar-callback';

  it('allows only the exact legacy callback path', () => {
    expect(normalizePath(path)).toBe(path);
    expect(normalizePath(`/raahApi${path}`)).toBe(path);
    expect(normalizePath(`${path}/extra`)).toBeNull();
    expect(normalizePath('/.netlify/functions/notifications-send')).toBeNull();
  });

  it('preserves OAuth query encoding and the registered public redirect origin', async () => {
    const { mod, handler } = fakeModule('callback', path);
    const { res, state } = fakeRes();
    const query = '?code=test%2Bcode%2Fvalue&state=signed.payload';
    await handleRequest(buildRouteTable([mod]), fakeReq({
      originalUrl: `/raahApi${path}${query}`,
      headers: { host: 'cloudfunctions.net', 'x-forwarded-host': 'untrusted.example' },
    }), res, 'https://raah.builttogether.church');
    const [request] = handler.mock.calls[0];
    expect(request.url).toBe(`https://raah.builttogether.church${path}${query}`);
    expect(new URL(request.url).searchParams.get('code')).toBe('test+code/value');
    expect(state.statusCode).toBe(200);
  });

  it('exchanges a signed callback using the public URI and stores encrypted tokens', async () => {
    const secret = 'test-secret';
    for (const [name, value] of Object.entries({
      SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      RAAH_ENCRYPTION_SECRET: secret, GOOGLE_CALENDAR_CLIENT_ID: 'test-client',
      GOOGLE_CALENDAR_CLIENT_SECRET: 'test-client-secret', GOOGLE_CALENDAR_ID: 'primary',
    })) vi.stubEnv(name, value);
    const body = Buffer.from(JSON.stringify({ uid: 'admin-test', iat: Date.now() })).toString('base64url');
    const signedState = `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ access_token: 'test-access', refresh_token: 'test-refresh' }))
      .mockResolvedValueOnce(Response.json({ items: [] }))
      .mockResolvedValueOnce(Response.json([{ id: 'connection-test' }]));
    try {
      const { res, state } = fakeRes();
      await handleRequest(buildRouteTable(realModules), fakeReq({
        originalUrl: `/raahApi${path}?code=test&state=${signedState}`,
      }), res, 'https://raah.builttogether.church');
      expect(state.statusCode).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      const exchange = fetchSpy.mock.calls[0][1]!;
      expect((exchange.body as URLSearchParams).get('redirect_uri')).toBe(`https://raah.builttogether.church${path}`);
      const saved = JSON.parse(fetchSpy.mock.calls[2][1]!.body as string);
      expect(saved.connected_by.uid).toBe('admin-test');
      expect(JSON.stringify(saved)).not.toContain('test-refresh');
      const encrypted = saved.encrypted_token;
      const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), Buffer.from(encrypted.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
      const decrypted = Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, 'base64')), decipher.final()]);
      expect(JSON.parse(decrypted.toString()).refreshToken).toBe('test-refresh');
    } finally {
      fetchSpy.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it('rejects invalid OAuth state before exchanging a token or saving a connection', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://db.example');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
    vi.stubEnv('RAAH_ENCRYPTION_SECRET', 'test-secret');
    vi.stubEnv('GOOGLE_CALENDAR_CLIENT_ID', 'test-client');
    vi.stubEnv('GOOGLE_CALENDAR_CLIENT_SECRET', 'test-client-secret');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      const { res, headers, state } = fakeRes();
      await handleRequest(buildRouteTable(realModules), fakeReq({
        originalUrl: `/raahApi${path}?code=test&state=invalid.signature`,
      }), res, 'https://raah.builttogether.church');
      expect(state.statusCode).toBe(400);
      expect(headers['content-type']).toContain('text/html');
      expect(headers['cache-control']).toBe('no-store');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});

describe('handleRequest', () => {
  it('passes method, headers, query, params and body bytes to the handler', async () => {
    const { mod, handler } = fakeModule('m', '/api/raah/things/:id');
    const routes = buildRouteTable([mod]);
    const body = new TextEncoder().encode('{"a":"한글"}');
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      const { res, state } = fakeRes();
      await handleRequest(routes, fakeReq({
        method,
        originalUrl: '/raahApi/api/raah/things/42?x=1',
        headers: {
          host: 'raah.example.org',
          authorization: 'Bearer tok',
          'idempotency-key': 'k1',
          'content-type': 'application/json',
          'x-multi': ['a', 'b'],
        },
        rawBody: body,
      }), res);
      const [request, ctx] = handler.mock.calls.at(-1)!;
      expect(request.method).toBe(method);
      expect(request.url).toBe('https://raah.example.org/api/raah/things/42?x=1');
      expect(request.headers.get('authorization')).toBe('Bearer tok');
      expect(request.headers.get('idempotency-key')).toBe('k1');
      expect(request.headers.get('content-type')).toBe('application/json');
      expect(request.headers.get('x-multi')).toBe('a, b');
      expect(new Uint8Array(await request.arrayBuffer())).toEqual(body);
      expect(ctx).toEqual({ params: { id: '42' } });
      expect(state.statusCode).toBe(200);
    }
  });

  it('sends no body for GET and HEAD even when rawBody is present', async () => {
    const { mod, handler } = fakeModule('m', '/api/raah/things');
    const routes = buildRouteTable([mod]);
    for (const method of ['GET', 'HEAD']) {
      const { res, state } = fakeRes();
      await handleRequest(routes, fakeReq({ method, originalUrl: '/api/raah/things', rawBody: new Uint8Array([1, 2]) }), res);
      const [request] = handler.mock.calls.at(-1)!;
      expect(request.body).toBeNull();
      if (method === 'HEAD') expect(state.body).toBeUndefined();
    }
  });

  it('writes back status, all headers and body bytes', async () => {
    const handler = vi.fn(async () => {
      const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      headers.append('Server-Timing', 'auth;dur=1');
      headers.append('Server-Timing', 'db;dur=2');
      headers.append('Set-Cookie', 'a=1');
      headers.append('Set-Cookie', 'b=2');
      return new Response('{"ok":true}', { status: 201, headers });
    });
    const routes = buildRouteTable([{ default: handler, config: { path: '/api/raah/x' } }]);
    const { res, headers, state } = fakeRes();
    await handleRequest(routes, fakeReq(), res);
    expect(state.statusCode).toBe(201);
    expect(headers['cache-control']).toBe('no-store');
    expect(headers['content-type']).toBe('application/json');
    expect(headers['server-timing']).toBe('auth;dur=1, db;dur=2');
    expect(headers['set-cookie']).toEqual(['a=1', 'b=2']);
    expect(new TextDecoder().decode(state.body as Uint8Array)).toBe('{"ok":true}');
  });

  it('returns a no-store 404 for unknown paths without calling any handler', async () => {
    const { mod, handler } = fakeModule('m', '/api/raah/things');
    const routes = buildRouteTable([mod]);
    for (const url of ['/api/raah/unknown', '/something/else', '/raahApi/health']) {
      const { res, headers, state } = fakeRes();
      await handleRequest(routes, fakeReq({ originalUrl: url }), res);
      expect(state.statusCode).toBe(404);
      expect(headers['cache-control']).toBe('no-store');
      expect(JSON.parse(new TextDecoder().decode(state.body as Uint8Array))).toEqual({ error: 'Not found' });
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it('turns a throwing handler into a generic 500 without leaking the message', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const routes = buildRouteTable([{ default: async () => { throw new Error('secret member note'); }, config: { path: '/api/raah/x' } }]);
    const { res, state } = fakeRes();
    await handleRequest(routes, fakeReq(), res);
    expect(state.statusCode).toBe(500);
    expect(new TextDecoder().decode(state.body as Uint8Array)).not.toContain('secret');
    expect(JSON.stringify(spy.mock.calls)).not.toContain('secret');
    spy.mockRestore();
  });
});

describe('real handlers through the route table', () => {
  it('returns the handler\'s own unauthenticated/disabled response unchanged', async () => {
    vi.stubEnv('RAAH_COMMUNION_ENABLED', 'false');
    const routes = buildRouteTable(realModules);
    const { res, headers, state } = fakeRes();
    await handleRequest(routes, fakeReq({ originalUrl: '/raahApi/api/raah/communion/periods' }), res);
    vi.unstubAllEnvs();
    expect(state.statusCode).toBe(404);
    expect(headers['cache-control']).toBe('no-store');
    expect(headers['server-timing']).toBeDefined();
    const parsed = JSON.parse(new TextDecoder().decode(state.body as Uint8Array));
    expect(typeof parsed.error).toBe('string');
    // The adapter's own 404 has no code; the handler's response does.
    expect(parsed.code).toBe('RAAH_COMMUNION_DISABLED');
  });

  it('rejects a bootstrap request with no Authorization header', async () => {
    const routes = buildRouteTable(realModules);
    const { res, state } = fakeRes();
    await handleRequest(routes, fakeReq({ originalUrl: '/api/raah/bootstrap' }), res);
    expect([401, 503]).toContain(state.statusCode);
  });
});

describe('public origin', () => {
  it('presents the site address to handlers when one is given', () => {
    const request = toRequest(
      { method: 'GET', url: '/api/raah/calendar/auth-url', headers: { host: 'asia-northeast1-x.cloudfunctions.net' } } as never,
      '/api/raah/calendar/auth-url',
      'https://raah.builttogether.church'
    );
    expect(new URL(request.url).origin).toBe('https://raah.builttogether.church');
    expect(new URL(request.url).pathname).toBe('/api/raah/calendar/auth-url');
  });
});
