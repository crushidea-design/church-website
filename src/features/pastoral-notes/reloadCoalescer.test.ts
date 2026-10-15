import { describe, expect, it, vi } from 'vitest';
import { createReloadCoalescer } from './reloadCoalescer';

const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe('createReloadCoalescer', () => {
  it('runs once for a single request', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    await createReloadCoalescer(run).request();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('never runs two reloads at the same time and repeats once for all requests made meanwhile', async () => {
    const gates = [deferred(), deferred()];
    let active = 0;
    let maxActive = 0;
    const run = vi.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await gates[run.mock.calls.length - 1].promise;
      active -= 1;
    });
    const coalescer = createReloadCoalescer(run);
    const first = coalescer.request();
    const second = coalescer.request();
    const third = coalescer.request();
    expect(run).toHaveBeenCalledTimes(1);
    gates[0].resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(2);
    gates[1].resolve();
    await Promise.all([first, second, third]);
    expect(run).toHaveBeenCalledTimes(2);
    expect(maxActive).toBe(1);
  });

  it('starts a fresh run for a request made after it went idle', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const coalescer = createReloadCoalescer(run);
    await coalescer.request();
    await coalescer.request();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('reports a failure without rejecting and still serves the next request', async () => {
    const onError = vi.fn();
    const run = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const coalescer = createReloadCoalescer(run, onError);
    await expect(coalescer.request()).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
    await coalescer.request();
    expect(run).toHaveBeenCalledTimes(2);
  });
});
