import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

export const FAMILY_WORSHIP_COLLECTION = 'next_generation_family_worship_logs';

export interface FamilyWorshipLog {
  id: string;
  weekKey: string;
  parentUid: string;
  completedAt?: any;
  childUids: string[];
  note?: string;
}

export function familyWorshipDocId(weekKey: string, parentUid: string) {
  return `${weekKey}_${parentUid}`;
}

export async function setFamilyWorshipLog(input: {
  weekKey: string;
  parentUid: string;
  childUids: string[];
  note?: string;
}) {
  const ref = doc(db, FAMILY_WORSHIP_COLLECTION, familyWorshipDocId(input.weekKey, input.parentUid));
  await setDoc(
    ref,
    {
      weekKey: input.weekKey,
      parentUid: input.parentUid,
      childUids: input.childUids,
      ...(input.note ? { note: input.note } : {}),
      completedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function subscribeMyFamilyWorshipLogs(
  parentUid: string,
  cb: (rows: FamilyWorshipLog[]) => void,
  onError?: (err: unknown) => void,
) {
  const q = query(collection(db, FAMILY_WORSHIP_COLLECTION), where('parentUid', '==', parentUid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FamilyWorshipLog, 'id'>) }));
      items.sort((a, b) => b.weekKey.localeCompare(a.weekKey));
      cb(items);
    },
    (err) => onError?.(err),
  );
}

export function subscribeFamilyWorshipStats(
  weekKeys: string[],
  cb: (rows: FamilyWorshipLog[]) => void,
  onError?: (err: unknown) => void,
) {
  if (weekKeys.length === 0) {
    cb([]);
    return () => {};
  }
  const q = query(
    collection(db, FAMILY_WORSHIP_COLLECTION),
    where('weekKey', 'in', weekKeys.slice(0, 30)),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FamilyWorshipLog, 'id'>) }))),
    (err) => onError?.(err),
  );
}
