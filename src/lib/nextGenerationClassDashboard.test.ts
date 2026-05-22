import { describe, expect, it } from 'vitest';
import { buildNextGenerationClassDashboard } from './nextGenerationClassDashboard';

describe('buildNextGenerationClassDashboard', () => {
  it('groups approved students and attaches reading and QA summaries', () => {
    const dashboard = buildNextGenerationClassDashboard({
      members: [
        {
          uid: 'student-a',
          displayName: 'Student A',
          email: 'a@example.com',
          role: 'member',
          department: 'student',
          church: 'Church',
          intro: '',
          provider: 'email',
          createdAt: {} as any,
          groupId: 'class-1',
        },
        {
          uid: 'student-b',
          displayName: 'Student B',
          email: 'b@example.com',
          role: 'member',
          department: 'student',
          church: 'Church',
          intro: '',
          provider: 'email',
          createdAt: {} as any,
        },
        {
          uid: 'teacher',
          displayName: 'Teacher',
          email: 't@example.com',
          role: 'member',
          department: 'teacher',
          church: 'Church',
          intro: '',
          provider: 'email',
          createdAt: {} as any,
        },
      ],
      readings: [
        { uid: 'student-a', completedBooks: ['Genesis', 'Exodus'], updatedAt: makeTimestamp(30) },
      ],
      qaItems: [
        { id: 'qa-1', authorId: 'student-a', isAnswered: false, createdAt: makeTimestamp(20) },
        { id: 'qa-2', authorId: 'student-a', isAnswered: true, createdAt: makeTimestamp(10) },
        { id: 'qa-3', authorId: 'student-b', isAnswered: false, createdAt: makeTimestamp(40) },
      ],
      studentDepartment: 'student',
    });

    expect(dashboard.totalStudents).toBe(2);
    expect(dashboard.totalCompletedBooks).toBe(2);
    expect(dashboard.totalQuestions).toBe(3);
    expect(dashboard.totalUnansweredQuestions).toBe(2);
    expect(dashboard.groups.map((group) => group.groupId)).toEqual(['class-1', 'unassigned']);
    expect(dashboard.groups[0].students[0]).toMatchObject({
      uid: 'student-a',
      completedBooks: 2,
      questionCount: 2,
      unansweredQuestionCount: 1,
    });
  });

  it('limits students to a teacher assigned groups list', () => {
    const dashboard = buildNextGenerationClassDashboard({
      members: [
        baseStudent('student-a', 'class-1'),
        baseStudent('student-b', 'class-2'),
        baseStudent('student-c', undefined),
      ],
      readings: [],
      qaItems: [],
      studentDepartment: 'student',
      visibleGroupIds: ['class-2'],
    });

    expect(dashboard.students.map((student) => student.uid)).toEqual(['student-b']);
    expect(dashboard.groups).toHaveLength(1);
    expect(dashboard.groups[0].groupId).toBe('class-2');
  });

  it('adds current week and recent attendance summaries', () => {
    const dashboard = buildNextGenerationClassDashboard({
      members: [
        baseStudent('student-a', 'class-1'),
        baseStudent('student-b', 'class-1'),
        baseStudent('student-c', 'class-1'),
      ],
      readings: [],
      qaItems: [],
      attendanceItems: [
        attendance('2026-05-17', 'student-a', 'class-1', true),
        attendance('2026-05-17', 'student-b', 'class-1', false),
        attendance('2026-05-10', 'student-a', 'class-1', true),
        attendance('2026-05-10', 'student-b', 'class-1', true),
      ],
      currentWeekKey: '2026-05-17',
      recentWeekKeys: ['2026-05-17', '2026-05-10'],
      studentDepartment: 'student',
    });

    expect(dashboard.currentPresentCount).toBe(1);
    expect(dashboard.currentAbsentCount).toBe(1);
    expect(dashboard.currentUncheckedCount).toBe(1);
    expect(dashboard.groups[0]).toMatchObject({
      currentPresentCount: 1,
      currentAbsentCount: 1,
      currentUncheckedCount: 1,
      recentAttendancePercent: 50,
    });
    expect(dashboard.students.map((student) => ({
      uid: student.uid,
      status: student.currentAttendanceStatus,
      percent: student.recentAttendancePercent,
    }))).toEqual([
      { uid: 'student-a', status: 'present', percent: 100 },
      { uid: 'student-b', status: 'absent', percent: 50 },
      { uid: 'student-c', status: 'unchecked', percent: 0 },
    ]);
  });
});

function baseStudent(uid: string, groupId?: string) {
  return {
    uid,
    displayName: uid,
    email: `${uid}@example.com`,
    role: 'member',
    department: 'student',
    church: 'Church',
    intro: '',
    provider: 'email',
    createdAt: {} as any,
    groupId,
  };
}

function makeTimestamp(value: number) {
  return {
    toMillis: () => value,
  };
}

function attendance(weekKey: string, studentUid: string, groupId: string, present: boolean) {
  return {
    id: `${weekKey}_${studentUid}`,
    weekKey,
    sundayDate: weekKey,
    studentUid,
    studentName: studentUid,
    groupId,
    present,
    checkedBy: 'teacher',
  };
}
