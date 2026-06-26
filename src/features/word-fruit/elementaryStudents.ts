export interface ElementaryStudentListItem {
  uid: string;
  displayName: string;
  groupId?: string;
  source?: 'member' | 'child';
}

export function mergeElementaryStudents(
  memberStudents: ElementaryStudentListItem[],
  childStudents: ElementaryStudentListItem[],
): ElementaryStudentListItem[] {
  const byUid = new Map<string, ElementaryStudentListItem>();

  [...memberStudents, ...childStudents].forEach((student) => {
    if (!student.uid) return;
    byUid.set(student.uid, {
      ...student,
      displayName: student.displayName || '이름 없음',
    });
  });

  return Array.from(byUid.values()).sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'));
}

export function getMemberStudentOptions(students: ElementaryStudentListItem[]): ElementaryStudentListItem[] {
  return students.filter((student) => student.source !== 'child');
}
