import { describe, expect, it } from 'vitest';
import {
  buildMemory,
  findPreviousMemoryEntry,
  findWeekMemoryEntry,
  getMemoryLines,
  hasMemoryText,
  memoryWarnings,
} from './memory';
import type { CurriculumEntry } from './types';

const entry = (date: string, extra: Partial<CurriculumEntry> = {}): CurriculumEntry => ({
  id: date,
  date,
  sundayKey: date,
  termId: '2027-1',
  kind: 'class',
  title: 't',
  ...extra,
});

describe('buildMemory', () => {
  it('returns undefined when everything is empty', () => {
    expect(buildMemory({ question: ' ', jaram: '', seum: ' ', didim: '' })).toBeUndefined();
  });

  it('keeps only filled fields, trimmed', () => {
    expect(buildMemory({ question: '1', jaram: ' 나는 나의 것이 아니요 ', seum: '', didim: '' })).toEqual({
      question: 1,
      jaram: '나는 나의 것이 아니요',
    });
  });
});

describe('memoryWarnings', () => {
  it('warns when the question is outside the week range', () => {
    expect(memoryWarnings({ question: 6, seum: 'x' }, [3, 5])).toEqual(['암송 문항(6문)이 이번 주 문 범위 밖입니다.']);
  });

  it('warns when text has no question', () => {
    expect(memoryWarnings({ didim: 'x' }, [1, 1])).toEqual(['암송 문구가 있으면 암송할 문항도 정해 주세요.']);
  });

  it('warns on an impossible question number', () => {
    expect(memoryWarnings({ question: 130 })).toEqual(['암송 문항은 1~129 사이여야 합니다.']);
  });

  it('is quiet for a valid memory', () => {
    expect(memoryWarnings({ question: 3, jaram: 'x' }, [3, 5])).toEqual([]);
    expect(memoryWarnings(undefined, [3, 5])).toEqual([]);
  });
});

describe('getMemoryLines', () => {
  const withMemory = entry('2027-01-17', { memory: { question: 2, jaram: 'a', didim: 'c' } });

  it('lists every filled class for "all" in class order', () => {
    expect(getMemoryLines(withMemory, 'all').map((line) => line.classId)).toEqual(['jaram', 'didim']);
  });

  it('shows only the selected class', () => {
    expect(getMemoryLines(withMemory, 'didim')).toEqual([
      { classId: 'didim', level: '질문 + 답 전체', text: 'c' },
    ]);
    expect(getMemoryLines(withMemory, 'seum')).toEqual([]);
  });

  it('never shows memory lines for the seed class', () => {
    expect(getMemoryLines(withMemory, 'seed')).toEqual([]);
  });

  it('handles missing entries and memory', () => {
    expect(getMemoryLines(undefined, 'all')).toEqual([]);
    expect(getMemoryLines(entry('2027-01-24'), 'all')).toEqual([]);
  });
});

describe('findPreviousMemoryEntry', () => {
  const curriculum = [
    entry('2027-01-10', { memory: { question: 1, seum: 'a' } }),
    entry('2027-01-17', { memory: { question: 2 } }), // no text → skipped
    entry('2027-01-24', { memory: { question: 3, didim: 'b' } }),
    entry('2027-01-31', { memory: { question: 6, didim: 'c' } }),
  ];

  it('picks the latest earlier entry that has memory text', () => {
    expect(findPreviousMemoryEntry(curriculum, '2027-01-31')?.id).toBe('2027-01-24');
    expect(findPreviousMemoryEntry(curriculum, '2027-01-24')?.id).toBe('2027-01-10');
  });

  it('returns undefined before any memory', () => {
    expect(findPreviousMemoryEntry(curriculum, '2027-01-10')).toBeUndefined();
  });

  it('hasMemoryText ignores a bare question', () => {
    expect(hasMemoryText({ question: 2 })).toBe(false);
  });
});

describe('findWeekMemoryEntry', () => {
  it('prefers the Sunday entry over the Saturday retreat of the same week', () => {
    const curriculum = [
      { ...entry('2027-01-09', { memory: { question: 1, seum: 'retreat' } }), sundayKey: '2027-01-10' },
      entry('2027-01-10', { memory: { question: 1, seum: 'sunday' } }),
    ];
    expect(findWeekMemoryEntry(curriculum, '2027-01-10')?.date).toBe('2027-01-10');
  });

  it('falls back to another entry of the week, or nothing', () => {
    const curriculum = [{ ...entry('2027-01-09', { memory: { question: 1, seum: 'x' } }), sundayKey: '2027-01-10' }];
    expect(findWeekMemoryEntry(curriculum, '2027-01-10')?.date).toBe('2027-01-09');
    expect(findWeekMemoryEntry(curriculum, '2027-01-17')).toBeUndefined();
  });
});
