import { getSundayDate, toLocalDateKey } from '../../../lib/nextGenerationResources';
import { HEIDELBERG_LORDS_DAYS, HEIDELBERG_TOTAL_LORDS_DAYS } from '../heidelberg';
import { getHeidelbergProgress } from '../schedule';
import type { CurriculumEntry, CurriculumEntryKind, SchoolTerm } from '../types';

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export const CURRICULUM_KIND_LABELS: Record<CurriculumEntryKind, string> = {
  opening: '개강',
  retreat: '수련회',
  class: '수업',
  special: '특강',
  review: '복습',
  closing: '종강',
  holiday: '휴강',
};

export const CURRICULUM_KINDS = Object.keys(CURRICULUM_KIND_LABELS) as CurriculumEntryKind[];

/** Kinds whose question range is not tied to one Lord's Day. */
const RANGE_CHECK_SKIPPED_KINDS: CurriculumEntryKind[] = ['review', 'closing', 'opening', 'holiday'];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isValidDateKey = (value: string) => {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

/** Sunday a date belongs to (a Saturday retreat belongs to the next day). */
export const computeSundayKey = (date: string) => toLocalDateKey(getSundayDate(new Date(`${date}T12:00:00`)));

/** Validates one term against the other terms (overlap, order, date range). */
export function validateTerm(term: SchoolTerm, otherTerms: SchoolTerm[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!term.name.trim()) errors.push('구간 이름을 입력해 주세요.');
  if (!isValidDateKey(term.startDate) || !isValidDateKey(term.endDate)) {
    errors.push('시작일과 종료일을 YYYY-MM-DD 형식으로 입력해 주세요.');
  } else {
    if (term.startDate > term.endDate) errors.push('시작일이 종료일보다 늦을 수 없습니다.');
    for (const other of otherTerms) {
      if (other.id === term.id) continue;
      if (term.startDate <= other.endDate && other.startDate <= term.endDate) {
        errors.push(`「${other.name}」(${other.startDate}~${other.endDate})과 기간이 겹칩니다.`);
      }
    }
  }
  if (!Number.isInteger(term.order) || term.order < 1) errors.push('순서는 1 이상의 정수여야 합니다.');
  else if (otherTerms.some((other) => other.id !== term.id && other.order === term.order)) {
    warnings.push('다른 구간과 순서 번호가 같습니다.');
  }
  return { errors, warnings };
}

export interface ValidateEntryOptions {
  term: SchoolTerm;
  existingIds: Iterable<string>;
  /** id of the entry being edited, if any. */
  editingId?: string | null;
}

export function validateCurriculumEntry(
  entry: Pick<CurriculumEntry, 'date' | 'kind' | 'title' | 'lordsDay' | 'questions'>,
  { term, existingIds, editingId }: ValidateEntryOptions,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isValidDateKey(entry.date)) {
    errors.push('날짜를 입력해 주세요.');
  } else {
    if (entry.date < term.startDate || entry.date > term.endDate) {
      errors.push(`날짜가 「${term.name}」 기간(${term.startDate}~${term.endDate}) 밖입니다.`);
    }
    if (entry.date !== editingId && new Set(existingIds).has(entry.date)) {
      warnings.push('같은 날짜의 진도표 항목이 이미 있습니다. 저장하면 덮어씁니다.');
    }
  }
  if (!entry.title.trim()) errors.push('제목을 입력해 주세요.');

  if (entry.lordsDay !== undefined) {
    if (!Number.isInteger(entry.lordsDay) || entry.lordsDay < 1 || entry.lordsDay > HEIDELBERG_TOTAL_LORDS_DAYS) {
      errors.push(`주일은 1~${HEIDELBERG_TOTAL_LORDS_DAYS} 사이여야 합니다.`);
    }
  } else if (entry.kind === 'class') {
    errors.push('수업에는 하이델베르크 주일을 선택해 주세요.');
  }

  if (entry.questions) {
    const [from, to] = entry.questions;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
      errors.push('문 범위가 올바르지 않습니다.');
    } else if (
      entry.lordsDay !== undefined &&
      !RANGE_CHECK_SKIPPED_KINDS.includes(entry.kind)
    ) {
      const range = HEIDELBERG_LORDS_DAYS.find((item) => item.lordsDay === entry.lordsDay)?.questions;
      if (range && (from < range[0] || to > range[1])) {
        errors.push(`문 범위가 제${entry.lordsDay}주일(${range[0]}~${range[1]}문) 밖입니다.`);
      }
    }
  }
  return { errors, warnings };
}

export interface TermSummary {
  lessonCount: number;
  holidayCount: number;
  progressLabel: string | null;
}

/** "수업 n회 · 휴강 n회 · 진도: 제X주일(부분)" for one term. */
export function summarizeTerm(curriculum: CurriculumEntry[], term: SchoolTerm): TermSummary {
  const inTerm = curriculum.filter((entry) => entry.termId === term.id);
  const lessonCount = inTerm.filter((entry) => ['class', 'special', 'review'].includes(entry.kind)).length;
  const holidayCount = inTerm.filter((entry) => entry.kind === 'holiday').length;

  const progress = getHeidelbergProgress(curriculum, term.endDate);
  let progressLabel: string | null = null;
  if (progress) {
    const range = HEIDELBERG_LORDS_DAYS.find((item) => item.lordsDay === progress.lordsDay)?.questions;
    const coveredTo = curriculum
      .filter(
        (entry) =>
          entry.kind !== 'special' &&
          entry.lordsDay === progress.lordsDay &&
          entry.questions &&
          entry.sundayKey <= term.endDate,
      )
      .reduce((max, entry) => Math.max(max, entry.questions?.[1] ?? 0), 0);
    const partial = !!range && coveredTo > 0 && coveredTo < range[1];
    progressLabel = `제${progress.lordsDay}주일${partial ? '(부분)' : ''}`;
  }
  return { lessonCount, holidayCount, progressLabel };
}

export const formatQuestionRange = (questions?: [number, number]) =>
  !questions ? '' : questions[0] === questions[1] ? `${questions[0]}문` : `${questions[0]}~${questions[1]}문`;
