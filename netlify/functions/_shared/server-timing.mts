import { AsyncLocalStorage } from 'node:async_hooks';

// Per-request timing for the Server-Timing response header (visible in the
// browser's network panel). Only phase names, durations and call counts are
// recorded: never URLs, queries, names or record content.
type Phase = { dur: number; count: number };

const store = new AsyncLocalStorage<Map<string, Phase>>();
// True only for the first request a function instance serves (a cold start).
let warm = false;

/** Adds the time spent in `fn` to the named phase of the current request. */
export async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const phases = store.getStore();
  if (!phases) return fn();
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const phase = phases.get(name) ?? { dur: 0, count: 0 };
    phase.dur += performance.now() - start;
    phase.count += 1;
    phases.set(name, phase);
  }
}

export function formatServerTiming(phases: Map<string, Phase>, totalMs: number, cold: boolean) {
  const parts = [...phases].map(([name, phase]) => `${name};dur=${Math.round(phase.dur)};desc="${phase.count}x"`);
  parts.push(`app;dur=${Math.round(totalMs)}`);
  if (cold) parts.push('cold;desc="first request of this instance"');
  return parts.join(', ');
}

/** Wraps a Netlify function so every response carries a Server-Timing header. */
export function withServerTiming<A extends unknown[]>(handler: (req: Request, ...rest: A) => Promise<Response>) {
  return async (req: Request, ...rest: A): Promise<Response> => {
    const cold = !warm;
    warm = true;
    const phases = new Map<string, Phase>();
    const start = performance.now();
    const response = await store.run(phases, () => handler(req, ...rest));
    // Some handlers can fall through without a response; pass that on unchanged.
    if (!response) return response;
    const value = formatServerTiming(phases, performance.now() - start, cold);
    try {
      response.headers.append('Server-Timing', value);
      return response;
    } catch {
      // Responses passed through from fetch have immutable headers.
      const headers = new Headers(response.headers);
      headers.append('Server-Timing', value);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }
  };
}
