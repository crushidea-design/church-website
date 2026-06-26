import { describe, expect, it } from 'vitest';
import { getMemberStudentOptions, mergeElementaryStudents } from './elementaryStudents';

describe('mergeElementaryStudents', () => {
  it('includes teacher-assigned child profiles with approved student members', () => {
    const result = mergeElementaryStudents(
      [
        { uid: 'student-1', displayName: '이종이', groupId: 'class-a' },
      ],
      [
        { uid: 'teacher-child:teacher-1:1', displayName: '이종일', groupId: 'class-a' },
      ],
    );

    expect(result.map((student) => student.displayName)).toEqual(['이종이', '이종일']);
    expect(result.find((student) => student.uid.startsWith('teacher-child:'))).toMatchObject({
      displayName: '이종일',
      groupId: 'class-a',
    });
  });

  it('keeps virtual child profiles out of member-only parent links', () => {
    const result = getMemberStudentOptions([
      { uid: 'student-1', displayName: '이종이', groupId: 'class-a', source: 'member' },
      { uid: 'proxy:parent-1:1', displayName: '이하임', groupId: 'class-a', source: 'child' },
      { uid: 'teacher-child:teacher-1:1', displayName: '이종일', groupId: 'class-a', source: 'child' },
    ]);

    expect(result.map((student) => student.uid)).toEqual(['student-1']);
  });
});
