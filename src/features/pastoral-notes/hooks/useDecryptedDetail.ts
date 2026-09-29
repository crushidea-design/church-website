import React from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '../adminHelpers';

/**
 * Loads one decrypted record for the selected id and drops it as soon as the
 * selection changes, the loader is disabled or the component unmounts, so a
 * previous person's body never lingers on screen. `load` must be memoised.
 */
export function useDecryptedDetail<T>(
  id: string | null,
  enabled: boolean,
  load: (id: string) => Promise<T>,
  errorMessage: string
) {
  const [value, setValue] = React.useState<T | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!id || !enabled) return;

    let cancelled = false;
    setValue(null);
    setIsLoading(true);
    load(id)
      .then((next) => {
        if (!cancelled) setValue(next);
      })
      .catch((error) => {
        if (!cancelled) toast.error(getErrorMessage(error, errorMessage));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      setValue(null);
      setIsLoading(false);
    };
  }, [enabled, errorMessage, id, load]);

  return { value, setValue, isLoading };
}
