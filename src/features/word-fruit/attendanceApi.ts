import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

export const ATTENDANCE_COLLECTION = 'next_generation_attendance';

export interface AttendanceDoc {
  id: string;
  weekKey: string;
  sundayDate: string;
  studentUid: string;
  studentName: string;
  groupId: string;
  present: boolean;
  note?: string;
  checkedBy: string;
  checkedAt?: any;
}

export function attendanceDocId(weekKey: string, studentUid: string) {
  return `${weekKey}_${studentUid}`;
}

export async function setAttendance(input: {
  weekKey: string;
  sundayDate: string;
  studentUid: string;
  studentName: string;
  groupId: string;
  present: boolean;
  note?: string;
  checkedBy: string;
}) {
  const ref = doc(db, ATTENDANCE_COLLECTION, attendanceDocId(input.weekKey, input.studentUid));
  await setDoc(
    ref,
    {
      weekKey: input.weekKey,
      sundayDate: input.sundayDate,
      studentUid: input.studentUid,
      studentName: input.studentName,
      groupId: input.groupId,
      present: input.present,
      ...(input.note ? { note: input.note } : {}),
      checkedBy: input.checkedBy,
      checkedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function setAttendanceBatch(rows: Array<{
  weekKey: string;
  sundayDate: string;
  studentUid: string;
  studentName: string;
  groupId: string;
  present: boolean;
  checkedBy: string;
}>) {
  const batch = writeBatch(db);
  rows.forEach((r) => {
    const ref = doc(db, ATTENDANCE_COLLECTION, attendanceDocId(r.weekKey, r.studentUid));
    batch.set(
      ref,
      {
        weekKey: r.weekKey,
        sundayDate: r.sundayDate,
        studentUid: r.studentUid,
        studentName: r.studentName,
        groupId: r.groupId,
        present: r.present,
        checkedBy: r.checkedBy,
        checkedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
  await batch.commit();
}

export function subscribeAttendanceForGroup(
  groupId: string,
  weekKeys: string[],
  cb: (rows: AttendanceDoc[]) => void,
  onError?: (err: unknown) => void,
) {
  if (!groupId || weekKeys.length === 0) {
    cb([]);
    return () => {};
  }
  const q = query(
    collection(db, ATTENDANCE_COLLECTION),
    where('groupId', '==', groupId),
    where('weekKey', 'in', weekKeys.slice(0, 30)),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceDoc, 'id'>) }))),
    (err) => onError?.(err),
  );
}

export function subscribeAttendanceForStudent(
  studentUid: string,
  cb: (rows: AttendanceDoc[]) => void,
  onError?: (err: unknown) => void,
) {
  const q = query(collection(db, ATTENDANCE_COLLECTION), where('studentUid', '==', studentUid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceDoc, 'id'>) }));
      items.sort((a, b) => b.weekKey.localeCompare(a.weekKey));
      cb(items);
    },
    (err) => onError?.(err),
  );
}

/** Returns YYYY-Www for the most recent Sunday (and N prior). */
export function getRecentSundayWeekKeys(count: number, now: Date = new Date()): string[] {
  const keys: string[] = [];
  const d = new Date(now);
  // back up to the most recent Sunday (day = 0)
  const dow = d.getDay();
  d.setDate(d.getDate() - dow);
  for (let i = 0; i < count; i += 1) {
    keys.push(sundayWeekKey(d));
    d.setDate(d.getDate() - 7);
  }
  return keys;
}

/** Returns YYYY-MM-DD for a Sunday date (already on Sunday). */
export function sundayWeekKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
