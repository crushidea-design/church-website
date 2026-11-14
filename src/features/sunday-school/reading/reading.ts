// Pure helpers for "올해 성경 읽기" (1년 1독): chapters are read contiguously from
// 창세기 1장. The date plan is only a goal line; nothing here scolds for being behind.
import type { SchoolClassId } from '../types';
import { BIBLE_CANON, TOTAL_CHAPTERS } from './bibleCanon';

export { TOTAL_CHAPTERS };

export const READING_COLLECTION = 'next_generation_bible_reading_year';
/** Classes that get the reading panel for now (자람 later, 씨앗 never). */
export const READING_CLASS_IDS: readonly SchoolClassId[] = ['seum', 'didim'];
export const MAX_READING_LOG = 400;
/** The 2027 reading year (each year is a fresh document). */
export const READING_YEAR = 2027;

export type ReadingViewer = 'student' | 'parent';

export interface ReadingLogEntry {
  date: string; // YYYY-MM-DD
  to: number; // chapters read in total after this check
}

export interface ReadingState {
  chaptersRead: number;
  log: ReadingLogEntry[];
}

export interface ChapterRef {
  bookIndex: number;
  book: string;
  chapter: number;
}

export const isReadingClass = (classId: SchoolClassId | undefined): classId is SchoolClassId =>
  !!classId && (READING_CLASS_IDS as readonly string[]).includes(classId);

export const readingDocId = (year: number, studentUid: string) => `${year}_${studentUid}`;

/** 세움반은 아이와 부모 모두, 디딤반은 학생 본인(계정 없는 대리 자녀는 부모). 규칙은 부모도 허용한다. */
export function canCheckReading(input: { classId: SchoolClassId; viewer: ReadingViewer; isProxyChild?: boolean }): boolean {
  if (!isReadingClass(input.classId)) return false;
  if (input.classId === 'seum') return true;
  return input.isProxyChild ? input.viewer === 'parent' : input.viewer === 'student';
}

// ── chapter index <-> (book, chapter) ────────────────────────────

const BOOK_START: number[] = (() => {
  const starts: number[] = [];
  let total = 0;
  for (const book of BIBLE_CANON) {
    starts.push(total);
    total += book.chapters;
  }
  return starts;
})();

/** 1-based chapter index (1..1189) to its book and chapter; null when out of range. */
export function chapterRefFromIndex(index: number): ChapterRef | null {
  if (!Number.isInteger(index) || index < 1 || index > TOTAL_CHAPTERS) return null;
  for (let i = BIBLE_CANON.length - 1; i >= 0; i -= 1) {
    if (index > BOOK_START[i]) return { bookIndex: i, book: BIBLE_CANON[i].name, chapter: index - BOOK_START[i] };
  }
  return null;
}

/** (book, chapter) to the 1-based chapter index; null when it does not exist. */
export function indexFromChapterRef(book: string, chapter: number): number | null {
  const bookIndex = BIBLE_CANON.findIndex((item) => item.name === book);
  if (bookIndex < 0 || !Number.isInteger(chapter) || chapter < 1 || chapter > BIBLE_CANON[bookIndex].chapters) return null;
  return BOOK_START[bookIndex] + chapter;
}

export const formatChapterRef = (index: number): string => {
  const ref = chapterRefFromIndex(index);
  return ref ? `${ref.book} ${ref.chapter}장` : '';
};

/** "창세기 26장까지" / "아직 시작 전" / "다 읽었어요". */
export function formatReadThrough(chaptersRead: number): string {
  if (chaptersRead <= 0) return '아직 시작 전';
  if (chaptersRead >= TOTAL_CHAPTERS) return '성경 전체를 다 읽었어요';
  return `${formatChapterRef(chaptersRead)}까지`;
}

/** The next place to read, or null when the whole Bible is read. */
export function nextReadingLabel(chaptersRead: number): string | null {
  return chaptersRead >= TOTAL_CHAPTERS ? null : formatChapterRef(Math.max(0, chaptersRead) + 1);
}

/** "창세기 26장 ~ 창세기 29장" (same book: "창세기 26 ~ 29장"). Empty range gives ''. */
export function formatRange(from: number, to: number): string {
  if (to < from || from < 1) return '';
  const a = chapterRefFromIndex(from);
  const b = chapterRefFromIndex(Math.min(to, TOTAL_CHAPTERS));
  if (!a || !b) return '';
  if (from === to) return `${a.book} ${a.chapter}장`;
  if (a.book === b.book) return `${a.book} ${a.chapter}~${b.chapter}장`;
  return `${a.book} ${a.chapter}장 ~ ${b.book} ${b.chapter}장`;
}

export const percentRead = (chaptersRead: number): number =>
  Math.min(100, Math.floor((Math.max(0, chaptersRead) / TOTAL_CHAPTERS) * 100));

// ── date plan (goal line only) ───────────────────────────────────

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const toUtcDay = (dateKey: string): number => Math.floor(new Date(`${dateKey}T00:00:00Z`).getTime() / 86400000);

export function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export const readingYearStart = (year: number) => `${year}-01-01`;
export const readingYearEnd = (year: number) => `${year}-12-31`;

export function daysInYear(year: number): number {
  return toUtcDay(readingYearEnd(year)) - toUtcDay(readingYearStart(year)) + 1;
}

/** Chapters the plan wants read by the END of the given date (0 before the year, all after). */
export function plannedChaptersByEndOf(year: number, dateKey: string): number {
  if (!DATE_KEY.test(dateKey)) return 0;
  const dayNumber = toUtcDay(dateKey) - toUtcDay(readingYearStart(year)) + 1;
  if (dayNumber <= 0) return 0;
  const days = daysInYear(year);
  if (dayNumber >= days) return TOTAL_CHAPTERS;
  return Math.ceil((TOTAL_CHAPTERS * dayNumber) / days);
}

export interface PlanRange {
  from: number;
  to: number;
  /** Nothing planned (before the year starts, or the Bible is already planned through). */
  empty: boolean;
}

const rangeBetween = (before: number, through: number): PlanRange => ({
  from: before + 1,
  to: through,
  empty: through <= before,
});

/** Today's planned chapters: from the end of yesterday's plan to the end of today's. */
export function plannedRangeForDate(year: number, dateKey: string): PlanRange {
  return rangeBetween(plannedChaptersByEndOf(year, addDays(dateKey, -1)), plannedChaptersByEndOf(year, dateKey));
}

/** 월요일 of the week containing the date (the week runs 월 ~ 일). */
export function mondayOf(dateKey: string): string {
  const day = new Date(`${dateKey}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(dateKey, day === 0 ? -6 : 1 - day);
}

export interface WeekPlan extends PlanRange {
  monday: string;
  sunday: string;
}

/** The week's planned chapters (월 ~ 일 containing the date), clipped to the reading year. */
export function weekPlan(year: number, dateKey: string): WeekPlan {
  const monday = mondayOf(dateKey);
  const sunday = addDays(monday, 6);
  return { monday, sunday, ...rangeBetween(plannedChaptersByEndOf(year, addDays(monday, -1)), plannedChaptersByEndOf(year, sunday)) };
}

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;

export interface WeekStampDay {
  date: string;
  label: string;
  checked: boolean;
}

/** Mon–Sun stamps: a day is stamped when the log has a check on it. */
export function weekStamps(log: readonly ReadingLogEntry[], dateKey: string): WeekStampDay[] {
  const monday = mondayOf(dateKey);
  const checked = new Set(log.map((entry) => entry.date));
  return WEEKDAY_LABELS.map((label, index) => {
    const date = addDays(monday, index);
    return { date, label, checked: checked.has(date) };
  });
}

/**
 * Where the reader's "up to" picker starts: the end of today's plan, but never
 * before the next unread chapter, capped at the end of the Bible.
 */
export function defaultCheckTarget(year: number, dateKey: string, chaptersRead: number): number {
  if (chaptersRead >= TOTAL_CHAPTERS) return TOTAL_CHAPTERS;
  return Math.min(TOTAL_CHAPTERS, Math.max(plannedChaptersByEndOf(year, dateKey), chaptersRead + 1));
}

// ── shelf ────────────────────────────────────────────────────────

export interface BookFill {
  name: string;
  /** 0..1 portion of the book's chapters already read. */
  fraction: number;
}

export function bookFills(chaptersRead: number): BookFill[] {
  const read = Math.min(Math.max(0, Math.floor(chaptersRead)), TOTAL_CHAPTERS);
  return BIBLE_CANON.map((book, index) => ({
    name: book.name,
    fraction: Math.min(1, Math.max(0, (read - BOOK_START[index]) / book.chapters)),
  }));
}

/** The book being read now (the one holding the next chapter); null when all is read. */
export function currentBookName(chaptersRead: number): string | null {
  if (chaptersRead >= TOTAL_CHAPTERS) return null;
  return chapterRefFromIndex(Math.max(0, Math.floor(chaptersRead)) + 1)?.book ?? null;
}

// ── checking and undoing ─────────────────────────────────────────

const clampRead = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(TOTAL_CHAPTERS, Math.max(0, Math.floor(value))) : 0;

/** Cleans a stored document into a state; the contiguous count wins over the log. */
export function normalizeReadingState(input: { chaptersRead?: unknown; log?: unknown } | null | undefined): ReadingState {
  const log: ReadingLogEntry[] = Array.isArray(input?.log)
    ? (input.log as Array<Partial<ReadingLogEntry>>)
        .filter((entry) => typeof entry?.date === 'string' && DATE_KEY.test(entry.date) && typeof entry.to === 'number')
        .map((entry) => ({ date: entry.date as string, to: clampRead(entry.to) }))
    : [];
  return { chaptersRead: clampRead(input?.chaptersRead), log };
}

/**
 * Records the chapters read up to `to` on `dateKey`, continuing from the current
 * position. Returns null when there is nothing new to record. Past the log cap the
 * two oldest entries are merged so the first entry always starts from 창세기 1장.
 */
export function applyCheck(state: ReadingState, dateKey: string, to: number): ReadingState | null {
  if (!DATE_KEY.test(dateKey)) return null;
  const target = Math.min(TOTAL_CHAPTERS, Math.floor(to));
  if (!Number.isFinite(target) || target <= state.chaptersRead) return null;
  let log = [...state.log, { date: dateKey, to: target }];
  while (log.length > MAX_READING_LOG) log = [log[1], ...log.slice(2)];
  return { chaptersRead: target, log };
}

export const canUndoLastCheck = (state: ReadingState): boolean => state.log.length > 0;

/** Takes back the last check; the position returns to the previous entry (or the start). */
export function undoLastCheck(state: ReadingState): ReadingState | null {
  if (state.log.length === 0) return null;
  const log = state.log.slice(0, -1);
  return { chaptersRead: log.length > 0 ? log[log.length - 1].to : 0, log };
}

/** What the last check recorded, for the undo button ("창세기 24~26장"). */
export function lastCheckLabel(state: ReadingState): string {
  const last = state.log[state.log.length - 1];
  if (!last) return '';
  const before = state.log.length >= 2 ? state.log[state.log.length - 2].to : 0;
  return formatRange(before + 1, last.to);
}

/** The reading year for a date: 2027 until the year begins, then that calendar year. */
export const readingYearFor = (todayKey: string): number => Math.max(READING_YEAR, Number(todayKey.slice(0, 4)) || READING_YEAR);
