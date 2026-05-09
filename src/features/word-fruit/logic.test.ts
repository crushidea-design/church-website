import { describe, expect, it } from 'vitest';
import {
  fruitStageOf,
  fruitWeekIdFromSundayKey,
  getTodayKey,
  getWeekId,
  isCheckAllowedDay,
  progressDocId,
  summarizeProgress,
} from './logic';
import type { WordFruitProgress } from './types';

describe('getWeekId', () => {
  it('uses ISO 8601 numbering (week starts Mon)', () => {
    // 2026-05-11 is a Monday → ISO week 20
    expect(getWeekId(new Date(2026, 4, 11))).toBe('2026-W20');
    expect(getWeekId(new Date(2026, 4, 16))).toBe('2026-W20'); // Sat
  });

  it('places Sunday at the END of the previous ISO week', () => {
    // Sunday 2026-05-10 closes ISO week 19, not 20
    expect(getWeekId(new Date(2026, 4, 10))).toBe('2026-W19');
  });

  it('handles year boundaries (Jan 1 belonging to previous year week)', () => {
    // 2027-01-01 is a Friday → ISO week 53 of 2026
    expect(getWeekId(new Date(2027, 0, 1))).toBe('2026-W53');
  });

  it('zero-pads single-digit weeks', () => {
    // 2026-01-05 (Mon) is ISO week 2
    expect(getWeekId(new Date(2026, 0, 5))).toBe('2026-W02');
  });
});

describe('fruitWeekIdFromSundayKey', () => {
  it('maps Sunday curriculum key to next Mon-Sat fruit week', () => {
    expect(fruitWeekIdFromSundayKey('2026-05-10')).toBe('2026-W20');
    expect(fruitWeekIdFromSundayKey('2026-12-27')).toBe('2026-W53');
  });

  it('returns empty string on malformed input', () => {
    expect(fruitWeekIdFromSundayKey('')).toBe('');
    expect(fruitWeekIdFromSundayKey('2026/05/10')).toBe('');
    expect(fruitWeekIdFromSundayKey('not-a-date')).toBe('');
  });
});

describe('getTodayKey', () => {
  it('formats as YYYY-MM-DD with zero padding', () => {
    expect(getTodayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(getTodayKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('isCheckAllowedDay', () => {
  it('rejects Sunday', () => {
    // 2026-05-10 is a Sunday
    expect(isCheckAllowedDay(new Date(2026, 4, 10))).toBe(false);
  });
  it('accepts Monday through Saturday', () => {
    for (let i = 11; i <= 16; i += 1) {
      expect(isCheckAllowedDay(new Date(2026, 4, i))).toBe(true);
    }
  });
});

describe('fruitStageOf', () => {
  it('clamps to 0..3', () => {
    expect(fruitStageOf(-1)).toBe(0);
    expect(fruitStageOf(0)).toBe(0);
    expect(fruitStageOf(1)).toBe(1);
    expect(fruitStageOf(2)).toBe(2);
    expect(fruitStageOf(3)).toBe(3);
    expect(fruitStageOf(4)).toBe(3);
    expect(fruitStageOf(99)).toBe(3);
  });
});

describe('progressDocId', () => {
  it('joins with double-underscore', () => {
    expect(progressDocId('2026-W20', 'abc123')).toBe('2026-W20__abc123');
  });
});

describe('summarizeProgress', () => {
  const make = (i: number, partial: Partial<WordFruitProgress> = {}): WordFruitProgress => ({
    id: `p${i}`,
    weekId: '2026-W20',
    userId: `u${i}`,
    childName: `이름${i}`,
    practice: '',
    checkCount: 0,
    checkedDates: [],
    fruitStage: 0,
    completed: false,
    ...partial,
  });

  it('counts completed and growing categories disjointly', () => {
    const progresses: WordFruitProgress[] = [
      make(1, { checkCount: 3, completed: true }),
      make(2, { checkCount: 5, completed: true }),
      make(3, { checkCount: 1 }),
      make(4, { checkCount: 2 }),
      make(5, { checkCount: 0 }),
    ];
    expect(summarizeProgress(progresses)).toEqual({
      total: 5,
      completed: 2,
      growing: 2, // checkCount > 0 && !completed
    });
  });

  it('handles empty list', () => {
    expect(summarizeProgress([])).toEqual({ total: 0, completed: 0, growing: 0 });
  });
});
