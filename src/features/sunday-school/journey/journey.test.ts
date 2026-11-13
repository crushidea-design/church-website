import { describe, expect, it } from 'vitest';
import {
  addDaysToKey,
  buildJourneySteps,
  canCheckStep,
  cleanDates,
  countsByStudent,
  extraDayCount,
  formatCountsLine,
  fruitStageFromSteps,
  hasMemoryStep,
  isDayCheckable,
  isWeekOpen,
  nextWeekKey,
  practiceChecker,
  toggleDate,
  weekDays,
} from './journey';
import type { JourneyStepInput } from './journey';

const WEEK = '2027-03-14'; // a Sunday

const base = (overrides: Partial<JourneyStepInput> = {}): JourneyStepInput => ({
  classId: 'seum',
  present: false,
  worshipDates: [],
  practiceDates: [],
  promise: '아침에 동생에게 인사하기',
  memoryChecked: false,
  weekOpen: true,
  ...overrides,
});

describe('week days and keys', () => {
  it('lists Monday to Saturday after the Sunday', () => {
    const days = weekDays(WEEK);
    expect(days.map((d) => d.label)).toEqual(['월', '화', '수', '목', '금', '토']);
    expect(days[0].date).toBe('2027-03-15');
    expect(days[5].date).toBe('2027-03-20');
  });

  it('computes the next Sunday key across month ends', () => {
    expect(nextWeekKey(WEEK)).toBe('2027-03-21');
    expect(nextWeekKey('2027-03-28')).toBe('2027-04-04');
    expect(addDaysToKey('2027-12-26', 7)).toBe('2028-01-02');
  });

  it('allows only past and current days of this week', () => {
    expect(isDayCheckable('2027-03-15', WEEK, '2027-03-16')).toBe(true);
    expect(isDayCheckable('2027-03-16', WEEK, '2027-03-16')).toBe(true);
    expect(isDayCheckable('2027-03-17', WEEK, '2027-03-16')).toBe(false);
    expect(isDayCheckable(WEEK, WEEK, '2027-03-16')).toBe(false); // Sunday is not a stamp day
    expect(isDayCheckable('2027-03-22', WEEK, '2027-03-30')).toBe(false); // other week
  });

  it('knows when the week is open for checks', () => {
    expect(isWeekOpen(WEEK, WEEK)).toBe(false);
    expect(isWeekOpen(WEEK, '2027-03-15')).toBe(true);
    expect(isWeekOpen(WEEK, '2027-03-20')).toBe(true);
    expect(isWeekOpen(WEEK, '2027-03-21')).toBe(false);
  });
});

describe('dates', () => {
  it('toggles a date in sorted order without duplicates', () => {
    expect(toggleDate([], '2027-03-16')).toEqual(['2027-03-16']);
    expect(toggleDate(['2027-03-16'], '2027-03-15')).toEqual(['2027-03-15', '2027-03-16']);
    expect(toggleDate(['2027-03-15', '2027-03-16'], '2027-03-15')).toEqual(['2027-03-16']);
  });

  it('keeps only valid days of the week', () => {
    expect(cleanDates(['2027-03-16', '2027-03-16', '2027-03-30', 'x', WEEK], WEEK)).toEqual(['2027-03-16']);
    expect(cleanDates(undefined, WEEK)).toEqual([]);
  });
});

describe('who may check', () => {
  it('assigns practice checks by class', () => {
    expect(practiceChecker('seed')).toBe('parent');
    expect(practiceChecker('jaram')).toBe('parent');
    expect(practiceChecker('seum')).toBe('student');
    expect(practiceChecker('didim')).toBe('student');
  });

  it('lets only parents check family worship', () => {
    expect(canCheckStep({ step: 'worship', classId: 'didim', viewer: 'parent' })).toBe(true);
    expect(canCheckStep({ step: 'worship', classId: 'didim', viewer: 'student' })).toBe(false);
  });

  it('enforces the practice checker and lets parents stand in for proxy children', () => {
    expect(canCheckStep({ step: 'practice', classId: 'seed', viewer: 'parent' })).toBe(true);
    expect(canCheckStep({ step: 'practice', classId: 'jaram', viewer: 'student' })).toBe(false);
    expect(canCheckStep({ step: 'practice', classId: 'seum', viewer: 'parent' })).toBe(false);
    expect(canCheckStep({ step: 'practice', classId: 'seum', viewer: 'student' })).toBe(true);
    expect(canCheckStep({ step: 'practice', classId: 'didim', viewer: 'parent', isProxyChild: true })).toBe(true);
  });
});

describe('journey steps', () => {
  it('starts with nothing done, family worship and practice in progress', () => {
    const steps = buildJourneySteps(base());
    expect(steps.map((s) => [s.id, s.state])).toEqual([
      ['learn', 'waiting'],
      ['worship', 'active'],
      ['practice', 'active'],
      ['memory', 'waiting'],
    ]);
  });

  it('completes each step from its own record', () => {
    const steps = buildJourneySteps(
      base({ present: true, worshipDates: ['2027-03-15', '2027-03-17'], practiceDates: ['2027-03-16'], memoryChecked: true }),
    );
    expect(steps.every((s) => s.state === 'done')).toBe(true);
    expect(steps.find((s) => s.id === 'worship')?.count).toBe(2);
  });

  it('keeps practice waiting until the teacher writes a promise (not for the seed class)', () => {
    expect(buildJourneySteps(base({ promise: undefined })).find((s) => s.id === 'practice')?.state).toBe('waiting');
    const seed = buildJourneySteps(base({ classId: 'seed', promise: undefined }));
    expect(seed.find((s) => s.id === 'practice')?.state).toBe('active');
    expect(seed.some((s) => s.id === 'memory')).toBe(false);
    expect(hasMemoryStep('seed')).toBe(false);
    expect(hasMemoryStep('jaram')).toBe(true);
  });

  it('does not mark steps active outside the open week', () => {
    const steps = buildJourneySteps(base({ weekOpen: false }));
    expect(steps.find((s) => s.id === 'worship')?.state).toBe('waiting');
  });
});

describe('fruit stage', () => {
  const stageFor = (overrides: Partial<JourneyStepInput>) => fruitStageFromSteps(buildJourneySteps(base(overrides)));

  it('grows with completed steps', () => {
    expect(stageFor({})).toBe(0);
    expect(stageFor({ present: true })).toBe(1);
    expect(stageFor({ present: true, worshipDates: ['2027-03-15'] })).toBe(2);
    expect(stageFor({ present: true, worshipDates: ['2027-03-15'], practiceDates: ['2027-03-15'] })).toBe(2);
    expect(
      stageFor({ present: true, worshipDates: ['2027-03-15'], practiceDates: ['2027-03-15'], memoryChecked: true }),
    ).toBe(3);
  });

  it('ripens the seed class with three steps', () => {
    const seed = { classId: 'seed' as const, promise: undefined };
    expect(stageFor({ ...seed, present: true })).toBe(1);
    expect(stageFor({ ...seed, present: true, worshipDates: ['2027-03-15'] })).toBe(2);
    expect(stageFor({ ...seed, present: true, worshipDates: ['2027-03-15'], practiceDates: ['2027-03-16'] })).toBe(3);
  });

  it('counts extra days beyond the first', () => {
    expect(extraDayCount(0, 0)).toBe(0);
    expect(extraDayCount(1, 1)).toBe(0);
    expect(extraDayCount(3, 2)).toBe(3);
  });
});

describe('teacher summary', () => {
  it('counts last week per student without ranking', () => {
    const map = countsByStudent([
      { studentUid: 'a', familyWorshipDates: ['1', '2'], practiceDates: ['1'] },
      { studentUid: 'b' },
    ]);
    expect(formatCountsLine(map.get('a'))).toBe('가정예배 2회 · 실천 1회');
    expect(formatCountsLine(map.get('b'))).toBe('가정예배 0회 · 실천 0회');
    expect(formatCountsLine(map.get('missing'))).toBe('가정예배 0회 · 실천 0회');
  });
});
