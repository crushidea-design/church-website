import type { WordFruitProgress } from './types';

export interface TeacherStudent {
  uid: string;
  displayName: string;
  groupId: string;
}

export function mergeTeacherStudentsWithProgress(
  rosterStudents: TeacherStudent[],
  progresses: WordFruitProgress[],
  teacherGroupIds: string[],
): TeacherStudent[] {
  const teacherGroupSet = new Set(teacherGroupIds);
  const studentsByUid = new Map<string, TeacherStudent>();

  rosterStudents.forEach((student) => {
    studentsByUid.set(student.uid, student);
  });

  progresses.forEach((progress) => {
    const groupId = progress.groupId ?? '';
    if (!progress.userId || !teacherGroupSet.has(groupId) || studentsByUid.has(progress.userId)) {
      return;
    }
    studentsByUid.set(progress.userId, {
      uid: progress.userId,
      displayName: progress.childName || '이름 없음',
      groupId,
    });
  });

  return Array.from(studentsByUid.values()).sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'));
}
