import { describe, expect, it } from 'vitest';
import { mergeElementaryStudents } from './elementaryStudents';

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
});
