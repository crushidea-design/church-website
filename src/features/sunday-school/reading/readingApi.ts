// Firestore access for 올해 성경 읽기. Reads are per student or per class (rules need the
// studentUid / classId constraint in the query); writes carry the full document shape.
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { SchoolClassId } from '../types';
import { READING_COLLECTION, normalizeReadingState, readingDocId } from './reading';
import type { ReadingState } from './reading';

export interface ReadingYearDoc {
  id: string;
  year: number;
  studentUid: string;
  studentName: string;
  classId: SchoolClassId;
  chaptersRead: number;
  log: Array<{ date: string; to: number }>;
  updatedBy: string;
  updatedAt?: unknown;
}

type Unsubscribe = () => void;

function subscribeRows(
  constraints: Array<ReturnType<typeof where>>,
  cb: (rows: ReadingYearDoc[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, READING_COLLECTION), ...constraints),
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as ReadingYearDoc)),
    (err) => onError?.(err),
  );
}

/** One child's reading record for the year (0 or 1 docs). */
export function subscribeReadingForStudent(
  studentUid: string,
  year: number,
  cb: (rows: ReadingYearDoc[]) => void,
  onError?: (err: unknown) => void,
) {
  return subscribeRows([where('studentUid', '==', studentUid), where('year', '==', year)], cb, onError);
}

/** Teacher view: a class's reading records for the year. */
export function subscribeReadingForClass(
  classId: SchoolClassId,
  year: number,
  cb: (rows: ReadingYearDoc[]) => void,
  onError?: (err: unknown) => void,
) {
  return subscribeRows([where('classId', '==', classId), where('year', '==', year)], cb, onError);
}

export function buildReadingFields(input: {
  year: number;
  studentUid: string;
  studentName: string;
  classId: SchoolClassId;
  state: ReadingState;
  updatedBy: string;
}) {
  return {
    year: input.year,
    studentUid: input.studentUid,
    studentName: input.studentName,
    classId: input.classId,
    chaptersRead: input.state.chaptersRead,
    log: input.state.log,
    updatedBy: input.updatedBy,
    updatedAt: serverTimestamp(),
  };
}

/** Saves the child's whole reading record for the year. */
export async function saveReadingState(input: Parameters<typeof buildReadingFields>[0]) {
  await setDoc(doc(db, READING_COLLECTION, readingDocId(input.year, input.studentUid)), buildReadingFields(input));
}

export const stateFromDoc = (row: ReadingYearDoc | null | undefined): ReadingState => normalizeReadingState(row);
