import { describe, expect, it } from 'vitest';
import {
  buildRowDrafts,
  buildWeeklyWrites,
  canUseClassScreen,
  getMemoryCheckTarget,
  getWeekCurriculumInfo,
  manageableClassIds,
  previousPromiseByUid,
  previousSundayKey,
  sundayKeyFromDateParam,
} from './classScreen';
import type { CurriculumEntry, SchoolWeeklyDoc } from './types';

const entry = (date: string, extra: Partial<CurriculumEntry> = {}): CurriculumEntry => ({
  id: date,
  date,
  sundayKey: date,
  termId: '2027-1',
  kind: 'class',
  title: '제목',
  ...extra,
});

describe('class access', () => {
  it('lets pastors and teacher members in, nobody else', () => {
    expect(canUseClassScreen({ isPastor: true, isMember: false, isTeacher: false })).toBe(true);
    expect(canUseClassScreen({ isPastor: false, isMember: true, isTeacher: true })).toBe(true);
    expect(canUseClassScreen({ isPastor: false, isMember: false, isTeacher: true })).toBe(false);
    expect(canUseClassScreen({ isPastor: false, isMember: true, isTeacher: false })).toBe(false);
  });

  it('gives teachers only their class-id groups and pastors all four', () => {
    expect(manageableClassIds(false, ['didim', '2026-a', 'seed'])).toEqual(['seed', 'didim']);
    expect(manageableClassIds(false, ['2026-a'])).toEqual([]);
    expect(manageableClassIds(false, undefined)).toEqual([]);
    expect(manageableClassIds(true, [])).toEqual(['seed', 'jaram', 'seum', 'didim']);
  });
});

describe('week keys', () => {
  it('computes the previous Sunday across month and year ends', () => {
    expect(previousSundayKey('2027-03-07')).toBe('2027-02-28');
    expect(previousSundayKey('2027-01-03')).toBe('2026-12-27');
  });

  it('maps a ?date= value to its Sunday and rejects bad input', () => {
    expect(sundayKeyFromDateParam('2027-03-10')).toBe('2027-03-07');
    expect(sundayKeyFromDateParam('nope')).toBeNull();
    expect(sundayKeyFromDateParam(null)).toBeNull();
  });
});

describe('getWeekCurriculumInfo', () => {
  it('builds the Heidelberg line and finds example promises', () => {
    const curriculum = [
      entry('2027-03-07', { lordsDay: 2, title: '율법으로 아는 비참', memory: { question: 3, promiseExamples: ['가', '나'] } }),
    ];
    expect(getWeekCurriculumInfo(curriculum, '2027-03-07')).toEqual({
      line: '하이델베르크 제2주일 · 율법으로 아는 비참',
      promiseExamples: ['가', '나'],
    });
  });

  it('is empty for an unscheduled week', () => {
    expect(getWeekCurriculumInfo([], '2027-03-07')).toEqual({ line: undefined, promiseExamples: [] });
  });
});

describe('getMemoryCheckTarget', () => {
  const curriculum = [
    entry('2027-02-28', { memory: { question: 3, jaram: '핵심', seum: '문장', didim: '전체' } }),
    entry('2027-03-07', { memory: { question: 5, didim: '다음' } }),
  ];

  it('returns last week memory at the class level', () => {
    expect(getMemoryCheckTarget(curriculum, '2027-03-07', 'seum')).toEqual({ question: 3, label: '3문', text: '문장' });
  });

  it('is undefined for seed and when there is nothing before', () => {
    expect(getMemoryCheckTarget(curriculum, '2027-03-07', 'seed')).toBeUndefined();
    expect(getMemoryCheckTarget(curriculum, '2027-02-28', 'seum')).toBeUndefined();
  });
});

describe('rows and writes', () => {
  const students = [{ uid: 'a', displayName: '가온', groupId: 'seum' }, { uid: 'b', displayName: '나온', groupId: 'seum' }];
  const weekly = (uid: string, extra: Partial<SchoolWeeklyDoc>): SchoolWeeklyDoc => ({
    id: `2027-03-07_${uid}`, weekKey: '2027-03-07', studentUid: uid, studentName: uid, classId: 'seum', updatedBy: 't', ...extra,
  });

  it('seeds drafts from saved attendance and weekly docs; old attendance docs stay valid', () => {
    const attendance = [{ id: 'x', weekKey: 'w', sundayDate: 'w', studentUid: 'a', studentName: '가온', groupId: 'seum', present: true, checkedBy: 't' }];
    const rows = buildRowDrafts(students, attendance, [weekly('b', { promise: '기도', memoryChecked: true })]);
    expect(rows[0]).toMatchObject({ uid: 'a', present: true, period2: false, publicWorship: false, promise: '' });
    expect(rows[1]).toMatchObject({ uid: 'b', present: false, memoryChecked: true, promise: '기도' });
  });

  it('indexes previous promises by student', () => {
    expect(previousPromiseByUid([weekly('a', { promise: '약속' }), weekly('b', {})]).get('a')).toBe('약속');
    expect(previousPromiseByUid([weekly('b', {})]).size).toBe(0);
  });

  const rows = [
    { uid: 'a', name: '가온', present: true, period2: false, publicWorship: false, memoryChecked: true, promise: '  동생에게 인사  ' },
    { uid: 'b', name: '나온', present: true, period2: false, publicWorship: false, memoryChecked: false, promise: '' },
    { uid: 'c', name: '다온', present: false, period2: false, publicWorship: false, memoryChecked: false, promise: '' },
  ];
  const target = { question: 3, label: '3문' };

  it('writes only rows with content or an existing doc, trimmed, clearing empties with null', () => {
    const writes = buildWeeklyWrites(rows, 'seum', target, new Set(['c']));
    expect(writes).toEqual([
      { studentUid: 'a', studentName: '가온', promise: '동생에게 인사', memoryChecked: true, memoryQuestion: 3 },
      { studentUid: 'c', studentName: '다온', promise: null, memoryChecked: null, memoryQuestion: null },
    ]);
  });

  it('ignores the memory toggle when there is no target, and writes nothing for seed', () => {
    expect(buildWeeklyWrites(rows.slice(0, 1), 'seum', undefined, new Set())[0].memoryChecked).toBeNull();
    expect(buildWeeklyWrites(rows, 'seed', target, new Set(['a']))).toEqual([]);
  });

  it('caps promises at 200 characters', () => {
    const [write] = buildWeeklyWrites([{ ...rows[1], promise: 'ㅇ'.repeat(250) }], 'seum', target, new Set());
    expect(write.promise).toHaveLength(200);
  });
});
