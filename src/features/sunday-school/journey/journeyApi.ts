// Firestore access for 이번 주 문답 여정. Reads are per student (rules need the
// studentUid constraint in the query); date checks write one list atomically.
import { arrayRemove, arrayUnion, collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { ATTENDANCE_COLLECTION } from '../../word-fruit/attendanceApi';
import type { AttendanceDoc } from '../../word-fruit/attendanceApi';
import { SCHOOL_WEEKLY_COLLECTION } from '../types';
import type { SchoolClassId, SchoolWeeklyDoc } from '../types';
import { journeyDocId } from './journey';

export const SCHOOL_JOURNEY_COLLECTION = 'next_generation_school_journey';

export interface SchoolJourneyDoc {
  id: string;
  weekKey: string;
  studentUid: string;
  studentName: string;
  classId: SchoolClassId;
  familyWorshipDates: string[];
  practiceDates: string[];
  updatedBy: string;
  updatedAt?: unknown;
}

type Unsubscribe = () => void;

function subscribeRows<T>(
  collectionName: string,
  constraints: Array<ReturnType<typeof where>>,
  cb: (rows: T[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, collectionName), ...constraints),
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T)),
    (err) => onError?.(err),
  );
}

/** One child's journey record for one week (0 or 1 docs). */
export function subscribeJourneyForStudent(
  studentUid: string,
  weekKey: string,
  cb: (rows: SchoolJourneyDoc[]) => void,
  onError?: (err: unknown) => void,
) {
  return subscribeRows<SchoolJourneyDoc>(
    SCHOOL_JOURNEY_COLLECTION,
    [where('studentUid', '==', studentUid), where('weekKey', '==', weekKey)],
    cb,
    onError,
  );
}

/** One child's attendance record for one Sunday. */
export function subscribeAttendanceForStudentWeek(
  studentUid: string,
  weekKey: string,
  cb: (rows: AttendanceDoc[]) => void,
  onError?: (err: unknown) => void,
) {
  return subscribeRows<AttendanceDoc>(
    ATTENDANCE_COLLECTION,
    [where('studentUid', '==', studentUid), where('weekKey', '==', weekKey)],
    cb,
    onError,
  );
}

/** One child's weekly class records (promise, memory check) for the given Sundays. */
export function subscribeWeeklyForStudent(
  studentUid: string,
  weekKeys: string[],
  cb: (rows: SchoolWeeklyDoc[]) => void,
  onError?: (err: unknown) => void,
) {
  return subscribeRows<SchoolWeeklyDoc>(
    SCHOOL_WEEKLY_COLLECTION,
    [where('studentUid', '==', studentUid), where('weekKey', 'in', weekKeys)],
    cb,
    onError,
  );
}

/** Teacher view: a class's journey records for one week. */
export function subscribeJourneyForClass(
  classId: SchoolClassId,
  weekKey: string,
  cb: (rows: SchoolJourneyDoc[]) => void,
  onError?: (err: unknown) => void,
) {
  return subscribeRows<SchoolJourneyDoc>(
    SCHOOL_JOURNEY_COLLECTION,
    [where('classId', '==', classId), where('weekKey', '==', weekKey)],
    cb,
    onError,
  );
}

export type JourneyDateKind = 'worship' | 'practice';

const DATE_FIELD: Record<JourneyDateKind, 'familyWorshipDates' | 'practiceDates'> = {
  worship: 'familyWorshipDates',
  practice: 'practiceDates',
};

/**
 * Fields for one date check. Only the changed list is touched, with arrayUnion /
 * arrayRemove, so a parent (가정예배) and a student (실천) editing the same
 * document never overwrite each other. The other list gets an empty arrayUnion:
 * a no-op on an existing document, and `[]` when the first write creates it
 * (the rules require both lists to exist).
 */
export function buildJourneyDateFields(input: {
  weekKey: string;
  studentUid: string;
  studentName: string;
  classId: SchoolClassId;
  kind: JourneyDateKind;
  date: string;
  checked: boolean;
  updatedBy: string;
}) {
  const changed = DATE_FIELD[input.kind];
  const other = DATE_FIELD[input.kind === 'worship' ? 'practice' : 'worship'];
  return {
    weekKey: input.weekKey,
    studentUid: input.studentUid,
    studentName: input.studentName,
    classId: input.classId,
    [changed]: input.checked ? arrayUnion(input.date) : arrayRemove(input.date),
    [other]: arrayUnion(),
    updatedBy: input.updatedBy,
    updatedAt: serverTimestamp(),
  };
}

/** Checks or unchecks one date of the child's journey without replacing the other list. */
export async function saveJourneyDate(input: Parameters<typeof buildJourneyDateFields>[0]) {
  await setDoc(
    doc(db, SCHOOL_JOURNEY_COLLECTION, journeyDocId(input.weekKey, input.studentUid)),
    buildJourneyDateFields(input),
    { merge: true },
  );
}
