import React from 'react';
import { toast } from 'sonner';
import { createReloadCoalescer } from '../reloadCoalescer';

export type Load<T> = { state: 'loading' } | { state: 'ready'; data: T } | { state: 'error'; status?: number };

/**
 * Loads data for `key` and keeps it fresh without blocking the screen.
 * - `reload` restarts the load from the loading state (retry button).
 * - `update` edits what is shown right away from a response that already carries
 *   the new state (a revision, a status), so the next action uses it.
 * - `refresh` re-reads in the background to reconcile. Requests are coalesced, keep
 *   showing the current data, and never overwrite an edit made while they were
 *   in flight (they run again instead). A failure shows one quiet notice.
 */
export function useRefreshableLoad<T>(key: string | null, load: () => Promise<T>) {
  const [result, setResult] = React.useState<Load<T>>({ state: 'loading' });
  const [attempt, setAttempt] = React.useState(0);
  const loadedKey = React.useRef<string | null>(null);
  const loadRef = React.useRef(load);
  loadRef.current = load;
  const keyRef = React.useRef(key);
  keyRef.current = key;
  // Bumped when the key changes or the component unmounts: older responses are dropped.
  const epoch = React.useRef(0);
  // Bumped by every local edit: a response read before the edit must not replace it.
  const version = React.useRef(0);

  const coalescer = React.useRef(
    createReloadCoalescer(
      async () => {
        if (keyRef.current === null) return;
        const startedEpoch = epoch.current;
        const startedVersion = version.current;
        const data = await loadRef.current();
        if (startedEpoch !== epoch.current) return;
        if (startedVersion !== version.current) {
          void coalescer.current.request();
          return;
        }
        setResult({ state: 'ready', data });
      },
      () => toast('화면을 최신 상태로 새로 고치지 못했습니다. 잠시 후 다시 확인해 주세요.', { id: 'raah-refresh-failed' })
    )
  );

  React.useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    // A refresh of the same thing keeps showing what is loaded, so forms below
    // (and their unsaved drafts) stay mounted. A different key starts clean.
    if (loadedKey.current !== key) setResult({ state: 'loading' });
    loadedKey.current = key;
    const startedVersion = version.current;
    loadRef.current()
      .then((data) => {
        if (cancelled) return;
        // An edit made while this first load was running is newer than what it read.
        if (startedVersion !== version.current) {
          void coalescer.current.request();
          return;
        }
        setResult({ state: 'ready', data });
      })
      .catch((error: { status?: number }) => !cancelled && setResult({ state: 'error', status: error?.status }));
    return () => {
      cancelled = true;
      epoch.current += 1;
    };
    // `load` is recreated each render; `key` and `attempt` decide when to refetch.
  }, [key, attempt]);

  const update = React.useCallback((change: (data: T) => T) => {
    version.current += 1;
    setResult((prev) => (prev.state === 'ready' ? { state: 'ready', data: change(prev.data) } : prev));
  }, []);
  const refresh = React.useCallback(() => {
    void coalescer.current.request();
  }, []);
  const reload = React.useCallback(() => setAttempt((value) => value + 1), []);

  return { result, reload, refresh, update };
}
