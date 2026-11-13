import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHOOL_CURRICULUM as curriculum, DEFAULT_SCHOOL_TERMS as terms } from './seedData';
import { getCommunionSundays, getHeidelbergProgress, getSchoolWeekStatus } from './schedule';

const status = (sundayKey: string) => getSchoolWeekStatus({ terms, curriculum, sundayKey });

describe('getSchoolWeekStatus', () => {
  it('is off outside any term', () => {
    expect(status('2026-12-27').mode).toBe('off');
  });

  it('handles the opening Sunday', () => {
    const s = status('2027-01-03');
    expect(s.mode === 'lesson' && s.entry.kind).toBe('opening');
  });

  it('attaches the Saturday retreat as an event', () => {
    const s = status('2027-01-10');
    expect(s.mode).toBe('lesson');
    if (s.mode === 'lesson') {
      expect(s.entry.session).toBe(1);
      expect(s.events.map((e) => e.kind)).toEqual(['retreat']);
    }
  });

  it('detects holidays', () => {
    expect(status('2027-02-07').mode).toBe('holiday');
  });

  it('treats the Easter special as a lesson', () => {
    const s = status('2027-03-28');
    expect(s.mode === 'lesson' && s.entry.kind).toBe('special');
    expect(s.mode === 'lesson' && s.entry.lordsDay).toBe(17);
  });

  it('counts vacation weeks', () => {
    const s = status('2027-07-18');
    expect(s.mode).toBe('vacation');
    if (s.mode === 'vacation') {
      expect(s.weekIndex).toBe(3);
      expect(s.totalWeeks).toBe(6);
    }
  });

  it('marks term weeks without entries as unscheduled', () => {
    expect(status('2027-08-22').mode).toBe('unscheduled');
  });
});

describe('getHeidelbergProgress', () => {
  it('reports LD2 as misery', () => {
    const p = getHeidelbergProgress(curriculum, '2027-01-24');
    expect(p?.lordsDay).toBe(2);
    expect(p?.part).toBe('misery');
    expect(p?.partLabel).toBe('비참');
  });

  it('ignores special entries', () => {
    const p = getHeidelbergProgress(curriculum, '2027-04-04');
    expect(p?.lordsDay).toBe(8);
    expect(p?.part).toBe('deliverance');
  });

  it('is null before the first Lord\'s Day', () => {
    expect(getHeidelbergProgress(curriculum, '2027-01-03')).toBeNull();
  });
});

describe('getCommunionSundays', () => {
  it('lists the communion Sundays', () => {
    expect(getCommunionSundays(curriculum)).toEqual(['2027-02-28', '2027-04-25', '2027-06-27']);
  });
});
