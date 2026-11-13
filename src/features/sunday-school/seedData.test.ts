import { describe, expect, it } from 'vitest';
import { getSundayDate, toLocalDateKey } from '../../lib/nextGenerationResources';
import { HEIDELBERG_LORDS_DAYS } from './heidelberg';
import { DEFAULT_SCHOOL_CLASSES, DEFAULT_SCHOOL_CURRICULUM, DEFAULT_SCHOOL_TERMS } from './seedData';

const parse = (key: string) => new Date(`${key}T12:00:00`);

describe('sunday school seed data', () => {
  it('has unique ids and id equals date', () => {
    const ids = DEFAULT_SCHOOL_CURRICULUM.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    DEFAULT_SCHOOL_CURRICULUM.forEach((e) => expect(e.id).toBe(e.date));
    const termIds = DEFAULT_SCHOOL_TERMS.map((t) => t.id);
    expect(new Set(termIds).size).toBe(termIds.length);
  });

  it('keeps each entry within its term and on a valid Sunday key', () => {
    for (const entry of DEFAULT_SCHOOL_CURRICULUM) {
      const term = DEFAULT_SCHOOL_TERMS.find((t) => t.id === entry.termId);
      expect(term).toBeDefined();
      expect(entry.sundayKey >= term!.startDate && entry.sundayKey <= term!.endDate).toBe(true);
      expect(parse(entry.sundayKey).getDay()).toBe(0);
      expect(entry.sundayKey).toBe(toLocalDateKey(getSundayDate(parse(entry.date))));
    }
    const retreat = DEFAULT_SCHOOL_CURRICULUM.find((e) => e.date === '2027-01-09');
    expect(retreat?.sundayKey).toBe('2027-01-10');
  });

  it('keeps question ranges inside the Lord\'s Day catalog', () => {
    for (const entry of DEFAULT_SCHOOL_CURRICULUM) {
      if (!entry.lordsDay || !entry.questions) continue;
      const range = HEIDELBERG_LORDS_DAYS[entry.lordsDay - 1].questions;
      expect(entry.questions[0]).toBeGreaterThanOrEqual(range[0]);
      expect(entry.questions[1]).toBeLessThanOrEqual(range[1]);
    }
  });

  it('numbers counted sessions 1..23 without gaps', () => {
    const sessions = DEFAULT_SCHOOL_CURRICULUM
      .filter((e) => ['class', 'special', 'review', 'closing'].includes(e.kind))
      .map((e) => e.session);
    expect(sessions).toEqual(Array.from({ length: 23 }, (_, i) => i + 1));
  });

  it('has ordered, non-overlapping terms', () => {
    DEFAULT_SCHOOL_TERMS.forEach((term, i) => {
      expect(term.order).toBe(i + 1);
      expect(term.startDate <= term.endDate).toBe(true);
      if (i > 0) expect(DEFAULT_SCHOOL_TERMS[i - 1].endDate < term.startDate).toBe(true);
    });
  });

  it('has exactly the four classes', () => {
    expect(DEFAULT_SCHOOL_CLASSES.map((c) => c.id)).toEqual(['seed', 'jaram', 'seum', 'didim']);
  });
});
