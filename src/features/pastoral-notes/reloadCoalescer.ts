/**
 * Runs `run` for reload requests without ever running two at once. A request made
 * while a run is in flight marks it dirty and shares the same promise; when the
 * run ends it is repeated once more (however many requests came in meanwhile), so
 * the last request always sees data read after it was made. The returned promise
 * never rejects: failures go to `onError`.
 */
export function createReloadCoalescer(run: () => Promise<void>, onError?: (error: unknown) => void) {
  let inFlight: Promise<void> | null = null;
  let dirty = false;

  const loop = async () => {
    try {
      do {
        dirty = false;
        try {
          await run();
        } catch (error) {
          onError?.(error);
        }
      } while (dirty);
    } finally {
      inFlight = null;
    }
  };

  return {
    request(): Promise<void> {
      if (inFlight) {
        dirty = true;
        return inFlight;
      }
      inFlight = loop();
      return inFlight;
    },
  };
}
