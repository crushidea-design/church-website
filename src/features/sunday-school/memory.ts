// 이번 주 암송: 진도표 항목의 반별 암송 범위를 다루는 순수 함수.
import type { CurriculumEntry, CurriculumMemory, SchoolClassId } from './types';

export type MemoryClassId = 'jaram' | 'seum' | 'didim';

/** 암송하는 반. 씨앗반은 암송 대신 주중에 말씀 동화를 다시 읽는다. */
export const MEMORY_CLASS_IDS: readonly MemoryClassId[] = ['jaram', 'seum', 'didim'];

export const MEMORY_LEVEL_LABELS: Record<MemoryClassId, string> = {
  jaram: '질문 + 핵심 한 구절',
  seum: '질문 + 답의 핵심 문장',
  didim: '질문 + 답 전체',
};

export const SEED_MEMORY_NOTE = '씨앗반은 암송 대신 주일에 함께 읽은 말씀 동화를 주중에 다시 읽습니다.';

export const isMemoryClass = (id: string): id is MemoryClassId =>
  (MEMORY_CLASS_IDS as readonly string[]).includes(id);

/** 편집 폼 값 → 저장할 memory. 아무것도 없으면 undefined. */
export function buildMemory(input: {
  question: string;
  jaram: string;
  seum: string;
  didim: string;
  /** 한 줄에 하나씩, 최대 3개. */
  promiseExamples?: string;
}): CurriculumMemory | undefined {
  const memory: CurriculumMemory = {};
  const question = input.question.trim() === '' ? undefined : Number(input.question);
  if (question !== undefined && Number.isFinite(question)) memory.question = question;
  for (const id of MEMORY_CLASS_IDS) {
    const text = input[id].trim();
    if (text) memory[id] = text;
  }
  const examples = parsePromiseExamples(input.promiseExamples ?? '');
  if (examples.length > 0) memory.promiseExamples = examples;
  return Object.keys(memory).length > 0 ? memory : undefined;
}

export const MAX_PROMISE_EXAMPLES = 3;

/** 한 줄에 하나씩 적은 예시 약속 → 빈 줄을 뺀 목록(최대 3개). */
export function parsePromiseExamples(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_PROMISE_EXAMPLES);
}

export function hasMemoryText(memory: CurriculumMemory | undefined): boolean {
  return !!memory && MEMORY_CLASS_IDS.some((id) => !!memory[id]);
}

/** 저장 전 확인할 점 (저장을 막지 않는 경고). */
export function memoryWarnings(memory: CurriculumMemory | undefined, questions?: [number, number]): string[] {
  if (!memory) return [];
  const warnings: string[] = [];
  if (memory.question !== undefined) {
    if (!Number.isInteger(memory.question) || memory.question < 1 || memory.question > 129) {
      warnings.push('암송 문항은 1~129 사이여야 합니다.');
    } else if (questions && (memory.question < questions[0] || memory.question > questions[1])) {
      warnings.push(`암송 문항(${memory.question}문)이 이번 주 문 범위 밖입니다.`);
    }
  }
  if (hasMemoryText(memory) && memory.question === undefined) {
    warnings.push('암송 문구가 있으면 암송할 문항도 정해 주세요.');
  }
  return warnings;
}

export interface MemoryLine {
  classId: MemoryClassId;
  level: string;
  text: string;
}

/** 반 선택에 맞춰 보여 줄 암송 문구. 'all'이면 입력된 반 전부. */
export function getMemoryLines(entry: CurriculumEntry | undefined, classFilter: SchoolClassId | 'all'): MemoryLine[] {
  const memory = entry?.memory;
  if (!memory) return [];
  const ids = classFilter === 'all' ? MEMORY_CLASS_IDS : isMemoryClass(classFilter) ? [classFilter] : [];
  return ids
    .filter((id) => !!memory[id])
    .map((id) => ({ classId: id, level: MEMORY_LEVEL_LABELS[id], text: memory[id] as string }));
}

/**
 * 교사가 이번 주일에 확인할 "지난주 암송": 이번 주일보다 앞선 항목 가운데
 * 암송 문구가 있는 가장 최근 항목.
 */
export function findPreviousMemoryEntry(curriculum: CurriculumEntry[], sundayKey: string): CurriculumEntry | undefined {
  return curriculum
    .filter((entry) => entry.sundayKey < sundayKey && hasMemoryText(entry.memory))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

/** 이번 주일에 속한 항목 가운데 암송 문구가 있는 항목 (주일 당일 항목 우선). */
export function findWeekMemoryEntry(curriculum: CurriculumEntry[], sundayKey: string): CurriculumEntry | undefined {
  const candidates = curriculum.filter((entry) => entry.sundayKey === sundayKey && hasMemoryText(entry.memory));
  return candidates.find((entry) => entry.date === sundayKey) ?? candidates[0];
}
