// Pure helpers for the teacher's Sunday class screen (/next/school/class).
import type { AttendanceDoc } from '../word-fruit/attendanceApi';
import type { TeacherStudent } from '../word-fruit/teacherRoster';
import { getActiveSundayKey } from '../../lib/nextGenerationResources';
import { findPreviousMemoryEntry, getMemoryLines, isMemoryClass } from './memory';
import { getEntriesForSunday } from './schedule';
import type { CurriculumEntry, SchoolClassId, SchoolWeeklyDoc } from './types';

export const SCHOOL_CLASS_IDS: readonly SchoolClassId[] = ['seed', 'jaram', 'seum', 'didim'];

export const SCHOOL_CLASS_NAMES: Record<SchoolClassId, string> = {
  seed: '씨앗반',
  jaram: '자람반',
  seum: '세움반',
  didim: '디딤반',
};

export const PROMISE_MAX_LENGTH = 200;

export const isSchoolClassId = (id: string): id is SchoolClassId =>
  (SCHOOL_CLASS_IDS as readonly string[]).includes(id);

/** 씨앗반은 약속·암송 입력 없이 출석만 다룬다. */
export const hasPromiseAndMemory = (classId: SchoolClassId) => classId !== 'seed';

/** 반 화면을 볼 수 있는 사람: 교역자 또는 교사 회원. */
export function canUseClassScreen(input: { isPastor: boolean; isMember: boolean; isTeacher: boolean }): boolean {
  return input.isPastor || (input.isMember && input.isTeacher);
}

/** 교사는 자기 groupIds 중 반 id만, 교역자는 네 반 모두. */
export function manageableClassIds(isPastor: boolean, groupIds: string[] | undefined): SchoolClassId[] {
  if (isPastor) return [...SCHOOL_CLASS_IDS];
  const owned = new Set(groupIds ?? []);
  return SCHOOL_CLASS_IDS.filter((id) => owned.has(id));
}

const DATE_PARAM = /^\d{4}-\d{2}-\d{2}$/;

/** `?date=YYYY-MM-DD` -> the Sunday key of that week, or null when invalid. */
export function sundayKeyFromDateParam(value: string | null): string | null {
  if (!value || !DATE_PARAM.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return getActiveSundayKey(date);
}

/** 한 주 전 주일 키 (YYYY-MM-DD). */
export function previousSundayKey(sundayKey: string): string {
  const date = new Date(`${sundayKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 7);
  return date.toISOString().slice(0, 10);
}

export interface WeekCurriculumInfo {
  /** 예: "제2주일 · 율법으로 아는 나의 비참" (없으면 undefined) */
  line?: string;
  promiseExamples: string[];
}

/** 이번 주 진도 한 줄과 예시 약속. */
export function getWeekCurriculumInfo(curriculum: CurriculumEntry[], sundayKey: string): WeekCurriculumInfo {
  const entries = getEntriesForSunday(curriculum, sundayKey);
  const primary =
    entries.find((entry) => entry.date === sundayKey && entry.kind !== 'holiday') ??
    entries.find((entry) => entry.kind !== 'retreat' && entry.kind !== 'holiday');
  const line = primary
    ? `${primary.lordsDay ? `하이델베르크 제${primary.lordsDay}주일 · ` : ''}${primary.title}`
    : undefined;
  const withExamples = entries.find((entry) => (entry.memory?.promiseExamples?.length ?? 0) > 0);
  return { line, promiseExamples: withExamples?.memory?.promiseExamples ?? [] };
}

export interface MemoryCheckTarget {
  question?: number;
  /** 예: "3문" */
  label: string;
  /** 반 수준에 맞는 암송 문구 (없을 수 있음). */
  text?: string;
}

/** 이번 주일에 확인할 "지난주 암송". 씨앗반이거나 지난 암송이 없으면 undefined. */
export function getMemoryCheckTarget(
  curriculum: CurriculumEntry[],
  sundayKey: string,
  classId: SchoolClassId,
): MemoryCheckTarget | undefined {
  if (!isMemoryClass(classId)) return undefined;
  const entry = findPreviousMemoryEntry(curriculum, sundayKey);
  if (!entry) return undefined;
  const question = entry.memory?.question;
  return {
    question,
    label: question === undefined ? '지난주 암송' : `${question}문`,
    text: getMemoryLines(entry, classId)[0]?.text,
  };
}

/** Identity of one class screen load: data is only valid for the exact class and Sunday it was fetched for. */
export const classBoardKey = (classId: string, sundayKey: string) => `${classId}|${sundayKey}`;

export type ClassBoardStatus = 'loading' | 'error' | 'ready';

/**
 * Rows are editable/saveable only once the roster, attendance and weekly
 * subscriptions all delivered data for the current key. Missing records before
 * that point must not be treated as "absent / empty".
 */
export function getClassBoardStatus(input: {
  key: string;
  rosterLoaded: boolean;
  attendanceKey: string | null;
  weeklyKey: string | null;
  hasError: boolean;
}): ClassBoardStatus {
  if (input.hasError) return 'error';
  if (!input.rosterLoaded || input.attendanceKey !== input.key || input.weeklyKey !== input.key) return 'loading';
  return 'ready';
}

export interface ClassRowDraft {
  uid: string;
  name: string;
  present: boolean;
  period2: boolean;
  publicWorship: boolean;
  memoryChecked: boolean;
  promise: string;
}

/** 학생 목록과 저장된 값으로 편집용 초안을 만든다. */
export function buildRowDrafts(
  students: TeacherStudent[],
  attendance: AttendanceDoc[],
  weekly: SchoolWeeklyDoc[],
): ClassRowDraft[] {
  const attendanceByUid = new Map(attendance.map((doc) => [doc.studentUid, doc]));
  const weeklyByUid = new Map(weekly.map((doc) => [doc.studentUid, doc]));
  return students.map((student) => {
    const attended = attendanceByUid.get(student.uid) as (AttendanceDoc & { period2?: boolean; publicWorship?: boolean }) | undefined;
    const record = weeklyByUid.get(student.uid);
    return {
      uid: student.uid,
      name: student.displayName || '이름 없음',
      present: !!attended?.present,
      period2: !!attended?.period2,
      publicWorship: !!attended?.publicWorship,
      memoryChecked: !!record?.memoryChecked,
      promise: record?.promise ?? '',
    };
  });
}

/** 지난주 약속을 학생 uid별로. */
export function previousPromiseByUid(previousWeekly: SchoolWeeklyDoc[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const doc of previousWeekly) if (doc.promise) map.set(doc.studentUid, doc.promise);
  return map;
}

export interface WeeklyWrite {
  studentUid: string;
  studentName: string;
  /** string = set, null = clear the field. */
  promise: string | null;
  memoryChecked: true | null;
  memoryQuestion: number | null;
}

/**
 * 반 주간 문서에 쓸 내용. 씨앗반은 쓰지 않는다. 입력도 없고 기존 문서도 없으면
 * 문서를 새로 만들지 않는다(빈 문서 방지).
 */
export function buildWeeklyWrites(
  rows: ClassRowDraft[],
  classId: SchoolClassId,
  target: MemoryCheckTarget | undefined,
  existingWeeklyUids: ReadonlySet<string>,
): WeeklyWrite[] {
  if (!hasPromiseAndMemory(classId)) return [];
  const writes: WeeklyWrite[] = [];
  for (const row of rows) {
    const promise = row.promise.trim().slice(0, PROMISE_MAX_LENGTH);
    const memoryChecked = !!target && row.memoryChecked;
    const hasContent = promise !== '' || memoryChecked;
    if (!hasContent && !existingWeeklyUids.has(row.uid)) continue;
    writes.push({
      studentUid: row.uid,
      studentName: row.name,
      promise: promise === '' ? null : promise,
      memoryChecked: memoryChecked ? true : null,
      memoryQuestion: memoryChecked && target?.question !== undefined ? target.question : null,
    });
  }
  return writes;
}
