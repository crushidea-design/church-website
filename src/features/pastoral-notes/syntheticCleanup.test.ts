import { describe, expect, it } from 'vitest';
import { canDeleteTestPeriod, describeSyntheticDelete } from './syntheticCleanup';

const members = [
  { id: 'real', isSynthetic: false },
  { id: 'legacy' },
  { id: 'test-1', isSynthetic: true },
  { id: 'test-2', isSynthetic: true },
];

describe('canDeleteTestPeriod', () => {
  it('allows an empty period', () => {
    expect(canDeleteTestPeriod([], members)).toBe(true);
  });
  it('allows a period holding only synthetic members', () => {
    expect(canDeleteTestPeriod([{ memberId: 'test-1' }, { memberId: 'test-2' }], members)).toBe(true);
  });
  it('refuses when any real member has a review', () => {
    expect(canDeleteTestPeriod([{ memberId: 'test-1' }, { memberId: 'real' }], members)).toBe(false);
  });
  it('treats members without the flag, or unknown members, as real', () => {
    expect(canDeleteTestPeriod([{ memberId: 'legacy' }], members)).toBe(false);
    expect(canDeleteTestPeriod([{ memberId: 'missing' }], members)).toBe(false);
  });
});

describe('describeSyntheticDelete', () => {
  it('summarises the counts', () => {
    expect(describeSyntheticDelete({ visitationLogs: 2, reviews: 1, careTasks: 1, scheduleItems: 1 })).toBe(
      '시범 자료를 삭제했습니다. (기록 2건, 후속 돌봄 1건, 일정 1건)'
    );
  });
  it('falls back to zero for missing counts', () => {
    expect(describeSyntheticDelete({})).toBe('시범 자료를 삭제했습니다. (기록 0건, 후속 돌봄 0건, 일정 0건)');
  });
});
