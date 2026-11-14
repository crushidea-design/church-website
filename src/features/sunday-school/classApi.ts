// Firestore access for the teacher's Sunday class screen.
import {
  collection,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ATTENDANCE_COLLECTION, attendanceDocId } from '../word-fruit/attendanceApi';
import { WORD_FRUIT_GROUPS_COLLECTION } from '../word-fruit/types';
import { SCHOOL_WEEKLY_COLLECTION } from './types';
import type { SchoolClassId, SchoolWeeklyDoc } from './types';
import { SCHOOL_CLASS_IDS, SCHOOL_CLASS_NAMES } from './classScreen';
import type { ClassRowDraft, WeeklyWrite } from './classScreen';

export const schoolWeeklyDocId = (weekKey: string, studentUid: string) => `${weekKey}_${studentUid}`;

/** Live weekly records of one class for one Sunday. */
export function subscribeSchoolWeekly(
  classId: SchoolClassId,
  weekKey: string,
  cb: (rows: SchoolWeeklyDoc[]) => void,
  onError?: (err: unknown) => void,
) {
  const q = query(
    collection(db, SCHOOL_WEEKLY_COLLECTION),
    where('classId', '==', classId),
    where('weekKey', '==', weekKey),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Omit<SchoolWeeklyDoc, 'id'>), id: d.id }))),
    (err) => onError?.(err),
  );
}

/** Attendance fields written by the class screen: same shape as attendanceApi plus the two optional flags. */
export function buildAttendanceFields(input: {
  weekKey: string;
  classId: SchoolClassId;
  checkedBy: string;
  row: ClassRowDraft;
}) {
  return {
    weekKey: input.weekKey,
    sundayDate: input.weekKey,
    studentUid: input.row.uid,
    studentName: input.row.name,
    groupId: input.classId,
    present: input.row.present,
    period2: input.row.period2,
    publicWorship: input.row.publicWorship,
    checkedBy: input.checkedBy,
    checkedAt: serverTimestamp(),
  };
}

/** Weekly fields: empty optional values are removed with deleteField (merge keeps old keys otherwise). */
export function buildWeeklyFields(input: {
  weekKey: string;
  classId: SchoolClassId;
  updatedBy: string;
  write: WeeklyWrite;
}) {
  const { write } = input;
  return {
    weekKey: input.weekKey,
    studentUid: write.studentUid,
    studentName: write.studentName,
    classId: input.classId,
    promise: write.promise === null ? deleteField() : write.promise,
    memoryChecked: write.memoryChecked === null ? deleteField() : write.memoryChecked,
    memoryQuestion: write.memoryQuestion === null ? deleteField() : write.memoryQuestion,
    updatedBy: input.updatedBy,
    updatedAt: serverTimestamp(),
  };
}

const ROWS_PER_BATCH = 200; // two writes per row, Firestore allows 500 per batch

/** Saves a class's attendance (with period2/publicWorship) and weekly records. */
export async function saveClassRows(input: {
  weekKey: string;
  classId: SchoolClassId;
  checkedBy: string;
  rows: ClassRowDraft[];
  weeklyWrites: WeeklyWrite[];
}) {
  const weeklyByUid = new Map(input.weeklyWrites.map((write) => [write.studentUid, write]));
  for (let start = 0; start < input.rows.length; start += ROWS_PER_BATCH) {
    const batch = writeBatch(db);
    for (const row of input.rows.slice(start, start + ROWS_PER_BATCH)) {
      batch.set(
        doc(db, ATTENDANCE_COLLECTION, attendanceDocId(input.weekKey, row.uid)),
        buildAttendanceFields({ weekKey: input.weekKey, classId: input.classId, checkedBy: input.checkedBy, row }),
        { merge: true },
      );
      const write = weeklyByUid.get(row.uid);
      if (write) {
        batch.set(
          doc(db, SCHOOL_WEEKLY_COLLECTION, schoolWeeklyDocId(input.weekKey, row.uid)),
          buildWeeklyFields({ weekKey: input.weekKey, classId: input.classId, updatedBy: input.checkedBy, write }),
          { merge: true },
        );
      }
    }
    await batch.commit();
  }
}

/**
 * Creates the missing 반 groups (id = class id, e.g. `seed`) in the word-fruit
 * group collection. Existing groups are never modified.
 */
export async function createMissingClassGroups(): Promise<{ created: SchoolClassId[]; existing: SchoolClassId[] }> {
  const snapshot = await getDocs(collection(db, WORD_FRUIT_GROUPS_COLLECTION));
  const existingIds = new Set(snapshot.docs.map((d) => d.id));
  const missing = SCHOOL_CLASS_IDS.filter((id) => !existingIds.has(id));
  const existing = SCHOOL_CLASS_IDS.filter((id) => existingIds.has(id));
  if (missing.length > 0) {
    const batch = writeBatch(db);
    for (const id of missing) {
      batch.set(doc(db, WORD_FRUIT_GROUPS_COLLECTION, id), {
        name: SCHOOL_CLASS_NAMES[id],
        description: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
  return { created: missing, existing };
}
