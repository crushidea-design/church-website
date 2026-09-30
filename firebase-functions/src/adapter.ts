// Pure adapter that lets the Netlify-style RAAH handlers run behind a single
// Firebase HTTP function. It adds no authentication of its own: every request
// is passed to the handler unchanged, and auth stays inside the handlers.

export type HandlerContext = { params: Record<string, string> };
export type RaahHandler = (req: Request, context: HandlerContext) => Promise<Response> | Response;
export type HandlerModule = {
  default: RaahHandler;
  config?: { path?: string | string[] };
};

export type Route = {
  pattern: string;
  segments: string[];
  literalCount: number;
  handler: RaahHandler;
};

export type RouteMatch = { route: Route; params: Record<string, string> };

/** Minimal shape of the Express request that Firebase gives us. */
export type IncomingLike = {
  method: string;
  originalUrl?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  rawBody?: Uint8Array;
  protocol?: string;
};

/** Minimal shape of the Express response (Node ServerResponse compatible). */
export type OutgoingLike = {
  statusCode: number;
  setHeader: (name: string, value: string | string[]) => unknown;
  end: (chunk?: Uint8Array | string) => unknown;
};

const FUNCTION_PREFIX = '/raahApi';
const API_PREFIX = '/api/raah/';
const SKIPPED_RESPONSE_HEADERS = new Set(['content-length', 'transfer-encoding', 'connection']);

const splitPath = (path: string) => path.split('/').filter((part) => part.length > 0);

export const buildRouteTable = (modules: HandlerModule[]): Route[] => {
  const routes: Route[] = [];
  for (const mod of modules) {
    const raw = mod.config?.path;
    const patterns = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const pattern of patterns) {
      const segments = splitPath(pattern);
      routes.push({
        pattern,
        segments,
        literalCount: segments.filter((segment) => !segment.startsWith(':')).length,
        handler: mod.default,
      });
    }
  }
  // Most literal segments first, so a specific route beats a parameterised one
  // regardless of registration order. Array.sort is stable.
  return routes.sort((a, b) => b.literalCount - a.literalCount);
};

/** Removes the Firebase function-name prefix and returns the path, or null when it is not an RAAH API path. */
export const normalizePath = (pathname: string): string | null => {
  let path = pathname;
  if (path === FUNCTION_PREFIX || path.startsWith(`${FUNCTION_PREFIX}/`)) {
    path = path.slice(FUNCTION_PREFIX.length) || '/';
  }
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path.startsWith(API_PREFIX) ? path : null;
};

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

export const matchRoute = (routes: Route[], normalizedPath: string): RouteMatch | null => {
  const parts = splitPath(normalizedPath);
  for (const route of routes) {
    if (route.segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < parts.length; i += 1) {
      const segment = route.segments[i];
      if (segment.startsWith(':')) {
        const decoded = safeDecode(parts[i]);
        if (decoded === null) {
          ok = false;
          break;
        }
        params[segment.slice(1)] = decoded;
      } else if (segment !== parts[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return null;
};

export const notFoundResponse = () =>
  new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const internalErrorResponse = () =>
  new Response(JSON.stringify({ error: 'Internal error' }), {
    status: 500,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const toRequest = (incoming: IncomingLike, normalizedUrl: string): Request => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (value === undefined || name.startsWith(':')) continue;
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else headers.set(name, value);
  }
  const method = incoming.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const rawBody = hasBody ? incoming.rawBody : undefined;
  const host = headers.get('x-forwarded-host') || headers.get('host') || 'localhost';
  const protocol = headers.get('x-forwarded-proto')?.split(',')[0].trim() || incoming.protocol || 'https';
  return new Request(`${protocol}://${host}${normalizedUrl}`, {
    method,
    headers,
    body: rawBody && rawBody.length > 0 ? new Uint8Array(rawBody) : undefined,
  });
};

export const writeResponse = async (response: Response, res: OutgoingLike, isHead = false) => {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() === 'set-cookie' || SKIPPED_RESPONSE_HEADERS.has(name.toLowerCase())) return;
    res.setHeader(name, value);
  });
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length > 0) res.setHeader('set-cookie', cookies);
  const body = isHead ? undefined : new Uint8Array(await response.arrayBuffer());
  res.end(body && body.length > 0 ? body : undefined);
};

/** Handles one Express request end to end. Never throws. */
export const handleRequest = async (routes: Route[], incoming: IncomingLike, res: OutgoingLike) => {
  const rawUrl = incoming.originalUrl || incoming.url || '/';
  const queryIndex = rawUrl.indexOf('?');
  const pathname = queryIndex === -1 ? rawUrl : rawUrl.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : rawUrl.slice(queryIndex);
  const normalizedPath = normalizePath(pathname);
  const match = normalizedPath ? matchRoute(routes, normalizedPath) : null;
  if (!normalizedPath || !match) {
    await writeResponse(notFoundResponse(), res);
    return;
  }
  let response: Response;
  try {
    const request = toRequest(incoming, `${normalizedPath}${query}`);
    response = await match.route.handler(request, { params: match.params });
  } catch (error) {
    // Log only the error class: messages can carry record content.
    console.error('raahApi handler failed', error instanceof Error ? error.name : 'unknown');
    response = internalErrorResponse();
  }
  await writeResponse(response, res, incoming.method.toUpperCase() === 'HEAD');
};
