import type { WordFruitProgress } from './types';

/** ISO week id like 2026-W19. Week starts on Monday (ISO 8601). */
export function getWeekId(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Maps a Sunday's YYYY-MM-DD (the existing `nextGenerationWeekKey` format used
 * by curriculum posts) to the word-fruit weekId of the *following* Mon–Sat
 * working week — i.e. the week the fruit is actually checked.
 */
export function fruitWeekIdFromSundayKey(sundayKey: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sundayKey);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + 1); // Monday
  return getWeekId(d);
}

export function getTodayKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Returns true if `date` falls on Monday–Saturday (local time).
 * Sunday is the day a new word fruit is given, so checks are paused.
 */
export function isCheckAllowedDay(date: Date = new Date()): boolean {
  return date.getDay() !== 0;
}

export function progressDocId(weekId: string, userId: string): string {
  return `${weekId}__${userId}`;
}

export function fruitStageOf(checkCount: number): 0 | 1 | 2 | 3 {
  if (checkCount <= 0) return 0;
  if (checkCount === 1) return 1;
  if (checkCount === 2) return 2;
  return 3;
}

export function summarizeProgress(progresses: WordFruitProgress[]) {
  const total = progresses.length;
  const completed = progresses.filter((p) => p.completed).length;
  const growing = progresses.filter((p) => !p.completed && p.checkCount > 0).length;
  return { total, completed, growing };
}

export function normalizeLegacyFruitTotalInput(input: {
  childName: string;
  totalCount: number;
  memo?: string;
}) {
  const childName = input.childName.trim();
  if (!childName) return null;

  return {
    childName,
    totalCount: Math.max(0, Math.floor(Number.isFinite(input.totalCount) ? input.totalCount : 0)),
    memo: (input.memo ?? '').trim(),
  };
}
