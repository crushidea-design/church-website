import { describe, expect, it } from 'vitest';
import { mergeTeacherStudentsWithProgress, TeacherStudent } from './teacherRoster';
import type { WordFruitProgress } from './types';

const progress = (overrides: Partial<WordFruitProgress>): WordFruitProgress => ({
  id: 'progress-1',
  weekId: '2026-05-18',
  userId: 'student-1',
  childName: '이종이',
  practice: '사랑 실천하기',
  checkCount: 1,
  checkedDates: [],
  fruitStage: 1,
  completed: false,
  groupId: 'elementary-a',
  ...overrides,
});

describe('mergeTeacherStudentsWithProgress', () => {
  it('adds students from assigned-group progress when the member roster query misses them', () => {
    expect(mergeTeacherStudentsWithProgress([], [progress({})], ['elementary-a'])).toEqual([
      {
        uid: 'student-1',
        displayName: '이종이',
        groupId: 'elementary-a',
      },
    ]);
  });

  it('keeps roster data first and ignores progress outside the teacher groups', () => {
    const roster: TeacherStudent[] = [
      { uid: 'student-1', displayName: '기존 이름', groupId: 'elementary-a' },
    ];

    expect(
      mergeTeacherStudentsWithProgress(
        roster,
        [
          progress({ childName: '진행 이름' }),
          progress({ id: 'progress-2', userId: 'student-2', childName: '다른 반', groupId: 'elementary-b' }),
        ],
        ['elementary-a'],
      ),
    ).toEqual(roster);
  });
});
