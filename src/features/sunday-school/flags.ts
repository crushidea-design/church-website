import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';

// `settings` is publicly readable, so guests can read the flag too.
export const SUNDAY_SCHOOL_FLAG_DOC = { collection: 'settings', id: 'next_generation_flags' } as const;
export const SUNDAY_SCHOOL_FLAG_FIELD = 'sunday_school_2027';

export function useSundaySchool2027Flag(): { enabled: boolean; loading: boolean } {
  const [state, setState] = useState({ enabled: false, loading: true });

  useEffect(() => {
    return onSnapshot(
      doc(db, SUNDAY_SCHOOL_FLAG_DOC.collection, SUNDAY_SCHOOL_FLAG_DOC.id),
      (snap) => {
        setState({ enabled: snap.data()?.[SUNDAY_SCHOOL_FLAG_FIELD] === true, loading: false });
      },
      (err) => {
        console.error('Failed to load sunday school flag', err);
        setState({ enabled: false, loading: false });
      },
    );
  }, []);

  return state;
}
