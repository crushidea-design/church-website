// Pure helpers for the "이번 주 문답 여정" (four steps per child per week).
import type { SchoolClassId } from '../types';

export type JourneyRole = 'parent' | 'student';
export type JourneyStepId = 'learn' | 'worship' | 'practice' | 'memory';
export type JourneyStepState = 'done' | 'active' | 'waiting';

export const JOURNEY_STATE_LABELS: Record<JourneyStepState, string> = {
  done: '완료',
  active: '진행 중',
  waiting: '아직',
};

export const JOURNEY_STEP_LABELS: Record<JourneyStepId, string> = {
  learn: '배움',
  worship: '가정예배',
  practice: '실천',
  memory: '암송',
};

export const SEED_PRACTICE_TEXT = '주일에 함께 읽은 말씀 동화를 주중에 다시 읽기';

export const MAX_JOURNEY_DATES = 7;

const DAY_NAMES = ['월', '화', '수', '목', '금', '토'] as const;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` plus N days (UTC math avoids DST drift). */
export function addDaysToKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 다음 주일 키: 암송은 다음 주일 교사가 확인한다. */
export const nextWeekKey = (weekKey: string) => addDaysToKey(weekKey, 7);

export interface JourneyDay {
  date: string;
  /** 월 ~ 토 */
  label: string;
}

/** 주일 다음 날(월)부터 토요일까지 여섯 날. */
export function weekDays(weekKey: string): JourneyDay[] {
  return DAY_NAMES.map((label, index) => ({ date: addDaysToKey(weekKey, index + 1), label }));
}

/** 이번 주(월~토) 안의, 오늘까지의 날만 체크할 수 있다. */
export function isDayCheckable(date: string, weekKey: string, todayKey: string): boolean {
  return weekDays(weekKey).some((day) => day.date === date) && date <= todayKey;
}

/** 저장된 날짜 목록에서 이 주 월~토에 속한 것만 중복 없이 남긴다. */
export function cleanDates(dates: readonly string[] | undefined, weekKey: string): string[] {
  const allowed = new Set(weekDays(weekKey).map((day) => day.date));
  return Array.from(new Set((dates ?? []).filter((date) => DATE_KEY.test(date) && allowed.has(date)))).sort();
}

/** 날짜를 넣거나 뺀다(오름차순, 최대 7개). */
export function toggleDate(dates: readonly string[], date: string): string[] {
  const set = new Set(dates);
  if (set.has(date)) set.delete(date);
  else set.add(date);
  return Array.from(set).sort().slice(0, MAX_JOURNEY_DATES);
}

/** 반별로 누가 실천을 체크하는가. 씨앗·자람은 부모, 세움·디딤은 학생. */
export function practiceChecker(classId: SchoolClassId): JourneyRole {
  return classId === 'seed' || classId === 'jaram' ? 'parent' : 'student';
}

/**
 * 보는 사람이 단계를 체크할 수 있는가. 가정예배는 부모만.
 * 실천은 반별 담당자만 하되, 계정이 없는 대리 자녀는 부모가 대신한다.
 */
export function canCheckStep(input: {
  step: 'worship' | 'practice';
  classId: SchoolClassId;
  viewer: JourneyRole;
  isProxyChild?: boolean;
}): boolean {
  if (input.step === 'worship') return input.viewer === 'parent';
  if (input.isProxyChild) return input.viewer === 'parent';
  return input.viewer === practiceChecker(input.classId);
}

/** 씨앗반은 암송 단계가 없다. */
export const hasMemoryStep = (classId: SchoolClassId) => classId !== 'seed';

export interface JourneyStepInput {
  classId: SchoolClassId;
  present: boolean;
  worshipDates: readonly string[];
  practiceDates: readonly string[];
  /** 이번 주 실천 약속(씨앗반은 고정 문구라 필요 없다). */
  promise?: string;
  /** 다음 주 반 기록의 암송 확인. */
  memoryChecked: boolean;
  /** 오늘이 이 주 월~토에 속하는가(체크가 열려 있는 기간). */
  weekOpen: boolean;
}

export interface JourneyStep {
  id: JourneyStepId;
  label: string;
  state: JourneyStepState;
  /** 날짜 체크 횟수(가정예배·실천). */
  count?: number;
}

export function buildJourneySteps(input: JourneyStepInput): JourneyStep[] {
  const worshipCount = input.worshipDates.length;
  const practiceCount = input.practiceDates.length;
  const hasPractice = input.classId === 'seed' || !!input.promise?.trim();
  const steps: JourneyStep[] = [
    { id: 'learn', label: JOURNEY_STEP_LABELS.learn, state: input.present ? 'done' : 'waiting' },
    {
      id: 'worship',
      label: JOURNEY_STEP_LABELS.worship,
      state: worshipCount >= 1 ? 'done' : input.weekOpen ? 'active' : 'waiting',
      count: worshipCount,
    },
    {
      id: 'practice',
      label: JOURNEY_STEP_LABELS.practice,
      state: practiceCount >= 1 ? 'done' : input.weekOpen && hasPractice ? 'active' : 'waiting',
      count: practiceCount,
    },
  ];
  if (hasMemoryStep(input.classId)) {
    steps.push({ id: 'memory', label: JOURNEY_STEP_LABELS.memory, state: input.memoryChecked ? 'done' : 'waiting' });
  }
  return steps;
}

export type FruitStage = 0 | 1 | 2 | 3;

/** 완료한 단계 수로 열매 단계를 정한다. 모든 단계를 마치면 3. */
export function fruitStageFromSteps(steps: readonly JourneyStep[]): FruitStage {
  const total = steps.length;
  const done = steps.filter((step) => step.state === 'done').length;
  if (total === 0 || done === 0) return 0;
  if (done >= total) return 3;
  return done / total < 0.5 ? 1 : 2;
}

/** 가정예배·실천을 1번 넘게 한 날 수. 열매가 더 풍성해지는 정도. */
export function extraDayCount(worshipCount: number, practiceCount: number): number {
  return Math.max(worshipCount - 1, 0) + Math.max(practiceCount - 1, 0);
}

export interface LinkedChildInfo {
  memberName?: string;
  memberClassId?: SchoolClassId;
  attendanceName?: string;
  attendanceClassId?: SchoolClassId;
}

/** A linked child's class: the member doc's current groupId wins; attendance history is only a fallback. */
export const pickLinkedClassId = (info: LinkedChildInfo | undefined): SchoolClassId | undefined =>
  info?.memberClassId ?? info?.attendanceClassId;

export const journeyDocId = (weekKey: string, studentUid: string) => `${weekKey}_${studentUid}`;

/** 오늘이 이 주 월~토 안인가. */
export function isWeekOpen(weekKey: string, todayKey: string): boolean {
  return todayKey > weekKey && todayKey <= addDaysToKey(weekKey, 6);
}

/** 지난 주일 키. */
export const previousWeekKey = (weekKey: string) => addDaysToKey(weekKey, -7);

export interface LastWeekSummary {
  steps: JourneyStep[];
  stage: FruitStage;
  /** 모든 단계를 마쳐 열매가 완성되었는가. */
  completed: boolean;
  /** 지난주에 기록된 것이 하나라도 있는가(없으면 요약을 숨긴다). */
  hasRecord: boolean;
}

/**
 * 지난주 여정 요약(읽기 전용). 암송 확인은 이번 주일(= 지난주의 다음 주) 반 기록에 있으므로
 * memoryChecked는 이번 주 기록에서 받는다.
 */
export function buildLastWeekSummary(input: {
  classId: SchoolClassId;
  present: boolean;
  worshipDates: readonly string[];
  practiceDates: readonly string[];
  promise?: string;
  memoryChecked: boolean;
}): LastWeekSummary {
  const steps = buildJourneySteps({ ...input, weekOpen: false });
  const stage = fruitStageFromSteps(steps);
  return { steps, stage, completed: stage === 3, hasRecord: steps.some((step) => step.state === 'done') };
}

export interface JourneyCounts {
  worship: number;
  practice: number;
}

/** 교사용: 학생 uid별 가정예배·실천 횟수. */
export function countsByStudent(
  docs: ReadonlyArray<{ studentUid: string; weekKey?: string; familyWorshipDates?: string[]; practiceDates?: string[] }>,
): Map<string, JourneyCounts> {
  const map = new Map<string, JourneyCounts>();
  for (const doc of docs) {
    map.set(doc.studentUid, {
      worship: doc.familyWorshipDates?.length ?? 0,
      practice: doc.practiceDates?.length ?? 0,
    });
  }
  return map;
}

export function formatCountsLine(counts: JourneyCounts | undefined): string {
  const worship = counts?.worship ?? 0;
  const practice = counts?.practice ?? 0;
  return `가정예배 ${worship}회 · 실천 ${practice}회`;
}

export function formatWorshipSummary(count: number): string {
  return count > 0 ? `이번 주 가정예배 ${count}번 드렸어요` : '이번 주 가정예배는 아직이에요';
}

export function formatPracticeSummary(count: number): string {
  return count > 0 ? `이번 주 실천 ${count}번 했어요` : '이번 주 실천은 아직이에요';
}

/** 열매 단계별 한마디. 차분하고 감사하는 말투. */
export const FRUIT_MESSAGES: Record<FruitStage, string> = {
  0: '이번 주 여정이 이제 시작돼요.',
  1: '한 걸음 걸었어요. 감사해요.',
  2: '열매가 천천히 익어 가요.',
  3: '하나님께서 자라게 하셨어요. 함께 감사해요.',
};
