import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHOOL_CURRICULUM, DEFAULT_SCHOOL_TERMS } from '../seedData';
import type { CurriculumEntry, SchoolTerm } from '../types';
import {
  computeSundayKey,
  summarizeTerm,
  validateCurriculumEntry,
  validateTerm,
} from './scheduleAdmin';

const [term1, summer] = DEFAULT_SCHOOL_TERMS;

describe('validateTerm', () => {
  it('accepts the seeded terms', () => {
    DEFAULT_SCHOOL_TERMS.forEach((term) => {
      expect(validateTerm(term, DEFAULT_SCHOOL_TERMS).errors).toEqual([]);
    });
  });

  it('rejects start after end', () => {
    const bad: SchoolTerm = { ...term1, startDate: '2027-07-01', endDate: '2027-06-01' };
    expect(validateTerm(bad, DEFAULT_SCHOOL_TERMS).errors.length).toBeGreaterThan(0);
  });

  it('allows a one-day term', () => {
    const one: SchoolTerm = { id: 'x', kind: 'term', name: '하루', startDate: '2030-01-06', endDate: '2030-01-06', order: 99 };
    expect(validateTerm(one, DEFAULT_SCHOOL_TERMS).errors).toEqual([]);
  });

  it('rejects overlap with another term', () => {
    const overlapping: SchoolTerm = { ...summer, startDate: '2027-06-27' };
    const result = validateTerm(overlapping, DEFAULT_SCHOOL_TERMS);
    expect(result.errors.some((message) => message.includes('겹칩니다'))).toBe(true);
  });

  it('ignores itself and handles a new term', () => {
    expect(validateTerm(term1, DEFAULT_SCHOOL_TERMS).errors).toEqual([]);
    const fresh: SchoolTerm = { id: 'new', kind: 'term', name: '새', startDate: '2027-06-20', endDate: '2027-06-30', order: 9 };
    expect(validateTerm(fresh, DEFAULT_SCHOOL_TERMS).errors.length).toBeGreaterThan(0);
  });

  it('validates name, date format and order', () => {
    expect(validateTerm({ ...term1, name: ' ' }, []).errors).toHaveLength(1);
    expect(validateTerm({ ...term1, startDate: '2027-13-40' }, []).errors).toHaveLength(1);
    expect(validateTerm({ ...term1, order: 0 }, []).errors).toHaveLength(1);
  });

  it('warns about a duplicate order number', () => {
    const result = validateTerm({ ...summer, order: 1 }, DEFAULT_SCHOOL_TERMS);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });
});

describe('validateCurriculumEntry', () => {
  const existingIds = DEFAULT_SCHOOL_CURRICULUM.map((entry) => entry.id);
  const base = { date: '2027-02-28', kind: 'class' as const, title: '제목', lordsDay: 6, questions: [16, 17] as [number, number] };

  it('accepts a narrowed range inside the Lord\'s Day', () => {
    const result = validateCurriculumEntry(base, { term: term1, existingIds, editingId: '2027-02-28' });
    expect(result).toEqual({ errors: [], warnings: [] });
  });

  it('rejects a date outside the term', () => {
    const result = validateCurriculumEntry({ ...base, date: '2027-07-04' }, { term: term1, existingIds });
    expect(result.errors.some((message) => message.includes('밖'))).toBe(true);
  });

  it('rejects questions outside the Lord\'s Day range', () => {
    const result = validateCurriculumEntry({ ...base, questions: [16, 20] }, { term: term1, existingIds, editingId: base.date });
    expect(result.errors).toHaveLength(1);
  });

  it('skips the range check for review/closing/opening/holiday', () => {
    const review = { date: '2027-06-20', kind: 'review' as const, title: '복습', lordsDay: 6, questions: [1, 36] as [number, number] };
    expect(validateCurriculumEntry(review, { term: term1, existingIds, editingId: review.date }).errors).toEqual([]);
  });

  it('rejects lordsDay out of 1..52', () => {
    expect(validateCurriculumEntry({ ...base, lordsDay: 53, questions: undefined }, { term: term1, existingIds, editingId: base.date }).errors).toHaveLength(1);
    expect(validateCurriculumEntry({ ...base, lordsDay: 0, questions: undefined }, { term: term1, existingIds, editingId: base.date }).errors).toHaveLength(1);
  });

  it('warns about a duplicate date unless editing that entry', () => {
    expect(validateCurriculumEntry(base, { term: term1, existingIds }).warnings).toHaveLength(1);
    expect(validateCurriculumEntry(base, { term: term1, existingIds, editingId: base.date }).warnings).toHaveLength(0);
  });

  it('requires a title and a Lord\'s Day for classes', () => {
    expect(validateCurriculumEntry({ ...base, title: '' }, { term: term1, existingIds, editingId: base.date }).errors).toHaveLength(1);
    expect(
      validateCurriculumEntry({ ...base, lordsDay: undefined, questions: undefined }, { term: term1, existingIds, editingId: base.date }).errors,
    ).toHaveLength(1);
  });
});

describe('computeSundayKey', () => {
  it('maps Saturday to the next Sunday and keeps Sunday', () => {
    expect(computeSundayKey('2027-01-09')).toBe('2027-01-10');
    expect(computeSundayKey('2027-01-10')).toBe('2027-01-10');
  });
});

describe('summarizeTerm', () => {
  it('summarizes the seeded first term', () => {
    const summary = summarizeTerm(DEFAULT_SCHOOL_CURRICULUM, term1);
    expect(summary.holidayCount).toBe(2);
    expect(summary.lessonCount).toBe(22);
    expect(summary.progressLabel).toBe('제14주일');
  });

  it('flags a partially covered Lord\'s Day', () => {
    const partial: CurriculumEntry[] = DEFAULT_SCHOOL_CURRICULUM.filter((entry) => entry.date <= '2027-02-28');
    const label = summarizeTerm(partial, { ...term1, endDate: '2027-02-28' }).progressLabel;
    expect(label).toBe('제6주일(부분)');
  });
});
