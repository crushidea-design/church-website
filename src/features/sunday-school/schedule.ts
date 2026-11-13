import { HEIDELBERG_PART_LABELS, HEIDELBERG_TOTAL_LORDS_DAYS, getHeidelbergPart } from './heidelberg';
import type { HeidelbergPart } from './heidelberg';
import type { CurriculumEntry, SchoolTerm } from './types';

export type SchoolWeekStatus =
  | { mode: 'off' }
  | { mode: 'vacation'; term: SchoolTerm; weekIndex: number; totalWeeks: number }
  | { mode: 'holiday'; term: SchoolTerm; entry: CurriculumEntry }
  | { mode: 'lesson'; term: SchoolTerm; entry: CurriculumEntry; events: CurriculumEntry[] }
  | { mode: 'unscheduled'; term: SchoolTerm };

export interface HeidelbergProgress {
  lordsDay: number;
  total: number;
  percent: number;
  part: HeidelbergPart;
  partLabel: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Whole weeks between two YYYY-MM-DD keys (UTC math avoids DST drift).
const weeksBetween = (fromKey: string, toKey: string) =>
  Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / (7 * DAY_MS));

export function findTermForDate(terms: SchoolTerm[], dateKey: string): SchoolTerm | undefined {
  return terms.find((term) => term.startDate <= dateKey && dateKey <= term.endDate);
}

export function getEntriesForSunday(curriculum: CurriculumEntry[], sundayKey: string): CurriculumEntry[] {
  return curriculum
    .filter((entry) => entry.sundayKey === sundayKey)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getSchoolWeekStatus({
  terms,
  curriculum,
  sundayKey,
}: {
  terms: SchoolTerm[];
  curriculum: CurriculumEntry[];
  sundayKey: string;
}): SchoolWeekStatus {
  const term = findTermForDate(terms, sundayKey);
  if (!term) return { mode: 'off' };

  if (term.kind === 'vacation') {
    return {
      mode: 'vacation',
      term,
      weekIndex: weeksBetween(term.startDate, sundayKey) + 1,
      totalWeeks: weeksBetween(term.startDate, term.endDate) + 1,
    };
  }

  const entries = getEntriesForSunday(curriculum, sundayKey);
  if (entries.length === 0) return { mode: 'unscheduled', term };

  const primary =
    entries.find((entry) => entry.date === sundayKey) ??
    entries.find((entry) => entry.kind !== 'retreat') ??
    entries[0];

  if (primary.kind === 'holiday') return { mode: 'holiday', term, entry: primary };
  return { mode: 'lesson', term, entry: primary, events: entries.filter((entry) => entry !== primary) };
}

export function getHeidelbergProgress(curriculum: CurriculumEntry[], sundayKey: string): HeidelbergProgress | null {
  let furthest = 0;
  for (const entry of curriculum) {
    // Specials (e.g. Easter lecture) are out of order and must not move progress.
    if (entry.kind === 'special' || !entry.lordsDay || entry.sundayKey > sundayKey) continue;
    furthest = Math.max(furthest, entry.lordsDay);
  }
  if (furthest === 0) return null;
  const part = getHeidelbergPart(furthest);
  return {
    lordsDay: furthest,
    total: HEIDELBERG_TOTAL_LORDS_DAYS,
    percent: Math.round((furthest / HEIDELBERG_TOTAL_LORDS_DAYS) * 100),
    part,
    partLabel: HEIDELBERG_PART_LABELS[part],
  };
}

export function getCommunionSundays(curriculum: CurriculumEntry[]): string[] {
  return curriculum
    .filter((entry) => entry.isCommunionSunday)
    .map((entry) => entry.sundayKey)
    .sort();
}
