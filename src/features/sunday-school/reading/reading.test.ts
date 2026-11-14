import { describe, expect, it } from 'vitest';
import { BIBLE_BOOK_SPOTS } from '../../../lib/bibleReadingLayout';
import { BIBLE_CANON, TOTAL_CHAPTERS } from './bibleCanon';
import {
  MAX_READING_LOG,
  addDays,
  applyCheck,
  bookFills,
  canCheckReading,
  canUndoLastCheck,
  chapterRefFromIndex,
  currentBookName,
  defaultCheckTarget,
  formatRange,
  formatReadThrough,
  indexFromChapterRef,
  isReadingClass,
  lastCheckLabel,
  mondayOf,
  nextReadingLabel,
  normalizeReadingState,
  percentRead,
  plannedChaptersByEndOf,
  plannedRangeForDate,
  readingDocId,
  undoLastCheck,
  weekPlan,
  weekStamps,
} from './reading';

describe('bible canon', () => {
  it('has 66 books and 1,189 chapters', () => {
    expect(BIBLE_CANON).toHaveLength(66);
    expect(TOTAL_CHAPTERS).toBe(1189);
    expect(BIBLE_CANON.slice(0, 39).reduce((sum, book) => sum + book.chapters, 0)).toBe(929);
  });

  it('uses exactly the names of the shelf layout, in the same order', () => {
    expect(BIBLE_CANON.map((book) => book.name)).toEqual(BIBLE_BOOK_SPOTS.map((spot) => spot.name));
  });
});

describe('chapter index', () => {
  it('maps indexes to book and chapter at the boundaries', () => {
    expect(chapterRefFromIndex(1)).toMatchObject({ book: '창세기', chapter: 1 });
    expect(chapterRefFromIndex(50)).toMatchObject({ book: '창세기', chapter: 50 });
    expect(chapterRefFromIndex(51)).toMatchObject({ book: '출애굽기', chapter: 1 });
    expect(chapterRefFromIndex(929)).toMatchObject({ book: '말라기', chapter: 4 });
    expect(chapterRefFromIndex(930)).toMatchObject({ book: '마태복음', chapter: 1 });
    expect(chapterRefFromIndex(1189)).toMatchObject({ book: '요한계시록', chapter: 22 });
    expect(chapterRefFromIndex(0)).toBeNull();
    expect(chapterRefFromIndex(1190)).toBeNull();
  });

  it('round-trips every chapter', () => {
    for (let i = 1; i <= TOTAL_CHAPTERS; i += 1) {
      const ref = chapterRefFromIndex(i)!;
      expect(indexFromChapterRef(ref.book, ref.chapter)).toBe(i);
    }
    expect(indexFromChapterRef('창세기', 51)).toBeNull();
    expect(indexFromChapterRef('없는책', 1)).toBeNull();
  });

  it('formats positions and ranges', () => {
    expect(formatReadThrough(0)).toBe('아직 시작 전');
    expect(formatReadThrough(25)).toBe('창세기 25장까지');
    expect(formatReadThrough(1189)).toBe('성경 전체를 다 읽었어요');
    expect(nextReadingLabel(25)).toBe('창세기 26장');
    expect(nextReadingLabel(0)).toBe('창세기 1장');
    expect(nextReadingLabel(50)).toBe('출애굽기 1장');
    expect(nextReadingLabel(1189)).toBeNull();
    expect(formatRange(24, 26)).toBe('창세기 24~26장');
    expect(formatRange(49, 52)).toBe('창세기 49장 ~ 출애굽기 2장');
    expect(formatRange(5, 5)).toBe('창세기 5장');
    expect(formatRange(6, 5)).toBe('');
    expect(percentRead(0)).toBe(0);
    expect(percentRead(595)).toBe(50);
    expect(percentRead(1189)).toBe(100);
  });
});

describe('date plan', () => {
  it('is zero before the year and everything on the last day', () => {
    expect(plannedChaptersByEndOf(2027, '2026-12-31')).toBe(0);
    expect(plannedChaptersByEndOf(2027, '2027-01-01')).toBe(4); // ceil(3.26)
    expect(plannedChaptersByEndOf(2027, '2027-12-31')).toBe(1189);
    expect(plannedChaptersByEndOf(2027, '2028-02-01')).toBe(1189);
  });

  it('never decreases and adds up day by day', () => {
    let previous = 0;
    let sum = 0;
    for (let day = 0; day < 365; day += 1) {
      const date = addDays('2027-01-01', day);
      const range = plannedRangeForDate(2027, date);
      const planned = plannedChaptersByEndOf(2027, date);
      expect(planned).toBeGreaterThanOrEqual(previous);
      expect(range.to - range.from + 1).toBeGreaterThanOrEqual(3);
      expect(range.to - range.from + 1).toBeLessThanOrEqual(4);
      sum += range.to - range.from + 1;
      previous = planned;
    }
    expect(sum).toBe(1189);
  });

  it('gives an empty range before the year starts', () => {
    expect(plannedRangeForDate(2027, '2026-12-20').empty).toBe(true);
  });

  it('finds the week range Monday to Sunday', () => {
    expect(mondayOf('2027-01-03')).toBe('2026-12-28'); // Sunday
    expect(mondayOf('2027-01-04')).toBe('2027-01-04'); // Monday
    expect(mondayOf('2027-01-10')).toBe('2027-01-04');
    const week = weekPlan(2027, '2027-01-06');
    expect(week.monday).toBe('2027-01-04');
    expect(week.sunday).toBe('2027-01-10');
    expect(week.from).toBe(plannedChaptersByEndOf(2027, '2027-01-03') + 1);
    expect(week.to).toBe(plannedChaptersByEndOf(2027, '2027-01-10'));
    // first (partial) week starts at chapter 1
    const first = weekPlan(2027, '2027-01-01');
    expect(first.from).toBe(1);
    expect(first.to).toBe(plannedChaptersByEndOf(2027, '2027-01-03'));
  });

  it('stamps the days of the week that have a check', () => {
    const stamps = weekStamps([{ date: '2027-01-05', to: 3 }, { date: '2027-01-10', to: 9 }, { date: '2026-12-30', to: 1 }], '2027-01-06');
    expect(stamps.map((day) => day.label).join('')).toBe('월화수목금토일');
    expect(stamps.filter((day) => day.checked).map((day) => day.date)).toEqual(['2027-01-05', '2027-01-10']);
  });

  it('defaults the picker to today\'s plan end, at least the next chapter, capped', () => {
    expect(defaultCheckTarget(2027, '2027-01-02', 0)).toBe(plannedChaptersByEndOf(2027, '2027-01-02'));
    expect(defaultCheckTarget(2027, '2027-01-02', 40)).toBe(41);
    expect(defaultCheckTarget(2027, '2027-12-31', 1000)).toBe(1189);
    expect(defaultCheckTarget(2027, '2027-12-31', 1189)).toBe(1189);
  });
});

describe('shelf', () => {
  it('fills books in proportion', () => {
    const fills = bookFills(75); // 창세기 full, 출애굽기 25/40
    expect(fills[0]).toEqual({ name: '창세기', fraction: 1 });
    expect(fills[1].fraction).toBeCloseTo(25 / 40);
    expect(fills[2].fraction).toBe(0);
    expect(bookFills(1189).every((book) => book.fraction === 1)).toBe(true);
    expect(bookFills(0).every((book) => book.fraction === 0)).toBe(true);
  });

  it('marks the book that holds the next chapter', () => {
    expect(currentBookName(0)).toBe('창세기');
    expect(currentBookName(49)).toBe('창세기');
    expect(currentBookName(50)).toBe('출애굽기');
    expect(currentBookName(1189)).toBeNull();
  });
});

describe('check and undo', () => {
  const empty = { chaptersRead: 0, log: [] };

  it('records contiguously and refuses to go backwards', () => {
    const one = applyCheck(empty, '2027-01-01', 4)!;
    expect(one).toEqual({ chaptersRead: 4, log: [{ date: '2027-01-01', to: 4 }] });
    expect(applyCheck(one, '2027-01-02', 4)).toBeNull();
    expect(applyCheck(one, '2027-01-02', 2)).toBeNull();
    expect(applyCheck(one, 'bad', 9)).toBeNull();
    const two = applyCheck(one, '2027-01-02', 7)!;
    expect(two.chaptersRead).toBe(7);
    expect(two.log).toHaveLength(2);
  });

  it('caps at the end of the Bible', () => {
    expect(applyCheck({ chaptersRead: 1188, log: [] }, '2027-12-31', 5000)?.chaptersRead).toBe(1189);
    expect(applyCheck({ chaptersRead: 1189, log: [] }, '2027-12-31', 1189)).toBeNull();
  });

  it('undoes the last check only', () => {
    const two = applyCheck(applyCheck(empty, '2027-01-01', 4)!, '2027-01-02', 7)!;
    expect(canUndoLastCheck(two)).toBe(true);
    expect(lastCheckLabel(two)).toBe('창세기 5~7장');
    const back = undoLastCheck(two)!;
    expect(back).toEqual({ chaptersRead: 4, log: [{ date: '2027-01-01', to: 4 }] });
    expect(undoLastCheck(back)).toEqual(empty);
    expect(undoLastCheck(empty)).toBeNull();
    expect(canUndoLastCheck(empty)).toBe(false);
  });

  it('keeps the log within the cap and the first entry starting from the beginning', () => {
    let state = empty;
    for (let i = 1; i <= MAX_READING_LOG + 20; i += 1) {
      state = applyCheck(state, '2027-02-01', i)!;
    }
    expect(state.log).toHaveLength(MAX_READING_LOG);
    expect(state.chaptersRead).toBe(MAX_READING_LOG + 20);
    expect(state.log[state.log.length - 1].to).toBe(MAX_READING_LOG + 20);
  });

  it('normalizes stored documents', () => {
    expect(normalizeReadingState(null)).toEqual(empty);
    expect(normalizeReadingState({ chaptersRead: 5000, log: [{ date: '2027-01-01', to: 9 }, { date: 'x', to: 1 }, null] })).toEqual({
      chaptersRead: 1189,
      log: [{ date: '2027-01-01', to: 9 }],
    });
  });
});

describe('who checks', () => {
  it('lets both child and parent check in 세움, only the student in 디딤', () => {
    expect(canCheckReading({ classId: 'seum', viewer: 'student' })).toBe(true);
    expect(canCheckReading({ classId: 'seum', viewer: 'parent' })).toBe(true);
    expect(canCheckReading({ classId: 'didim', viewer: 'student' })).toBe(true);
    expect(canCheckReading({ classId: 'didim', viewer: 'parent' })).toBe(false);
    expect(canCheckReading({ classId: 'didim', viewer: 'parent', isProxyChild: true })).toBe(true);
    expect(canCheckReading({ classId: 'seed', viewer: 'parent' })).toBe(false);
    expect(canCheckReading({ classId: 'jaram', viewer: 'student' })).toBe(false);
  });

  it('targets only 세움 and 디딤 and builds ids', () => {
    expect(isReadingClass('seum')).toBe(true);
    expect(isReadingClass('didim')).toBe(true);
    expect(isReadingClass('jaram')).toBe(false);
    expect(isReadingClass(undefined)).toBe(false);
    expect(readingDocId(2027, 'abc')).toBe('2027_abc');
  });
});
