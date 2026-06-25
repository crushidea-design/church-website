export interface ClassDashboardMember {
  uid: string;
  displayName?: string;
  email?: string;
  role?: string;
  department?: string;
  departments?: string[];
  church?: string;
  intro?: string;
  provider?: string;
  createdAt?: unknown;
  groupId?: string;
}

export interface ClassDashboardReading {
  uid: string;
  completedBooks?: string[];
  updatedAt?: TimestampLike;
}

export interface ClassDashboardQA {
  id: string;
  authorId?: string;
  isAnswered?: boolean;
  createdAt?: TimestampLike;
}

export interface ClassDashboardAttendance {
  id?: string;
  weekKey: string;
  studentUid: string;
  groupId?: string;
  present: boolean;
  checkedAt?: TimestampLike;
}

export type AttendanceStatus = 'present' | 'absent' | 'unchecked';

export interface ClassDashboardStudent extends ClassDashboardMember {
  groupId: string;
  groupLabel: string;
  completedBooks: number;
  readingPercent: number;
  questionCount: number;
  unansweredQuestionCount: number;
  currentAttendanceStatus: AttendanceStatus;
  recentAttendanceCount: number;
  recentAttendancePercent: number;
  lastActivityMillis: number;
}

export interface ClassDashboardGroup {
  groupId: string;
  groupLabel: string;
  students: ClassDashboardStudent[];
  totalCompletedBooks: number;
  totalQuestions: number;
  totalUnansweredQuestions: number;
  currentPresentCount: number;
  currentAbsentCount: number;
  currentUncheckedCount: number;
  recentAttendancePercent: number;
}

export interface ClassDashboardSummary {
  students: ClassDashboardStudent[];
  groups: ClassDashboardGroup[];
  totalStudents: number;
  totalCompletedBooks: number;
  totalQuestions: number;
  totalUnansweredQuestions: number;
  currentPresentCount: number;
  currentAbsentCount: number;
  currentUncheckedCount: number;
  recentAttendancePercent: number;
}

interface TimestampLike {
  toMillis?: () => number;
}

interface BuildClassDashboardArgs {
  members: ClassDashboardMember[];
  readings: ClassDashboardReading[];
  qaItems: ClassDashboardQA[];
  attendanceItems?: ClassDashboardAttendance[];
  currentWeekKey?: string;
  recentWeekKeys?: string[];
  studentDepartment: string;
  visibleGroupIds?: string[];
}

const UNASSIGNED_GROUP_ID = 'unassigned';
const UNASSIGNED_GROUP_LABEL = '미지정';
const BIBLE_BOOK_TOTAL = 66;

export function buildNextGenerationClassDashboard({
  members,
  readings,
  qaItems,
  attendanceItems = [],
  currentWeekKey = '',
  recentWeekKeys = [],
  studentDepartment,
  visibleGroupIds,
}: BuildClassDashboardArgs): ClassDashboardSummary {
  const visibleGroupSet = visibleGroupIds && visibleGroupIds.length > 0
    ? new Set(visibleGroupIds)
    : null;
  const readingByUid = new Map(readings.map((reading) => [reading.uid, reading]));
  const currentAttendanceByUid = new Map(
    attendanceItems
      .filter((item) => item.weekKey === currentWeekKey)
      .map((item) => [item.studentUid, item]),
  );
  const recentAttendanceByUid = new Map<string, ClassDashboardAttendance[]>();
  const questionsByUid = new Map<string, ClassDashboardQA[]>();

  const recentWeekSet = new Set(recentWeekKeys);
  attendanceItems.forEach((item) => {
    if (!recentWeekSet.has(item.weekKey)) return;
    const existing = recentAttendanceByUid.get(item.studentUid) ?? [];
    existing.push(item);
    recentAttendanceByUid.set(item.studentUid, existing);
  });

  qaItems.forEach((item) => {
    if (!item.authorId) return;
    const existing = questionsByUid.get(item.authorId) ?? [];
    existing.push(item);
    questionsByUid.set(item.authorId, existing);
  });

  const students = members
    .filter((member) => member.role === 'member' && hasDashboardDepartment(member, studentDepartment))
    .filter((member) => !visibleGroupSet || (member.groupId && visibleGroupSet.has(member.groupId)))
    .map((member): ClassDashboardStudent => {
      const normalizedGroupId = normalizeGroupId(member.groupId);
      const reading = readingByUid.get(member.uid);
      const completedBooks = reading?.completedBooks?.length ?? 0;
      const questions = questionsByUid.get(member.uid) ?? [];
      const currentAttendance = currentAttendanceByUid.get(member.uid);
      const recentAttendance = recentAttendanceByUid.get(member.uid) ?? [];
      const currentAttendanceStatus: AttendanceStatus = currentAttendance
        ? currentAttendance.present ? 'present' : 'absent'
        : 'unchecked';
      const recentAttendanceCount = recentAttendance.filter((item) => item.present).length;
      const lastQuestionMillis = Math.max(0, ...questions.map((item) => timestampToMillis(item.createdAt)));
      const lastAttendanceMillis = Math.max(0, ...recentAttendance.map((item) => timestampToMillis(item.checkedAt)));
      const lastActivityMillis = Math.max(timestampToMillis(reading?.updatedAt), lastQuestionMillis, lastAttendanceMillis);

      return {
        ...member,
        groupId: normalizedGroupId,
        groupLabel: normalizedGroupId === UNASSIGNED_GROUP_ID ? UNASSIGNED_GROUP_LABEL : normalizedGroupId,
        completedBooks,
        readingPercent: Math.round((completedBooks / BIBLE_BOOK_TOTAL) * 100),
        questionCount: questions.length,
        unansweredQuestionCount: questions.filter((item) => !item.isAnswered).length,
        currentAttendanceStatus,
        recentAttendanceCount,
        recentAttendancePercent: recentWeekKeys.length > 0
          ? Math.round((recentAttendanceCount / recentWeekKeys.length) * 100)
          : 0,
        lastActivityMillis,
      };
    })
    .sort((a, b) => {
      const groupCompare = a.groupLabel.localeCompare(b.groupLabel, 'ko');
      if (groupCompare !== 0) return groupCompare;
      return (a.displayName ?? '').localeCompare(b.displayName ?? '', 'ko');
    });

  const groups = buildGroups(students);

  return {
    students,
    groups,
    totalStudents: students.length,
    totalCompletedBooks: students.reduce((sum, student) => sum + student.completedBooks, 0),
    totalQuestions: students.reduce((sum, student) => sum + student.questionCount, 0),
    totalUnansweredQuestions: students.reduce((sum, student) => sum + student.unansweredQuestionCount, 0),
    currentPresentCount: students.filter((student) => student.currentAttendanceStatus === 'present').length,
    currentAbsentCount: students.filter((student) => student.currentAttendanceStatus === 'absent').length,
    currentUncheckedCount: students.filter((student) => student.currentAttendanceStatus === 'unchecked').length,
    recentAttendancePercent: averagePercent(students.map((student) => student.recentAttendancePercent)),
  };
}

function hasDashboardDepartment(member: ClassDashboardMember, department: string) {
  return member.department === department ||
    (Array.isArray(member.departments) && member.departments.includes(department));
}

function buildGroups(students: ClassDashboardStudent[]): ClassDashboardGroup[] {
  const groupsById = new Map<string, ClassDashboardGroup>();

  students.forEach((student) => {
    const group = groupsById.get(student.groupId) ?? {
      groupId: student.groupId,
      groupLabel: student.groupLabel,
      students: [],
      totalCompletedBooks: 0,
      totalQuestions: 0,
      totalUnansweredQuestions: 0,
      currentPresentCount: 0,
      currentAbsentCount: 0,
      currentUncheckedCount: 0,
      recentAttendancePercent: 0,
    };

    group.students.push(student);
    group.totalCompletedBooks += student.completedBooks;
    group.totalQuestions += student.questionCount;
    group.totalUnansweredQuestions += student.unansweredQuestionCount;
    if (student.currentAttendanceStatus === 'present') group.currentPresentCount += 1;
    if (student.currentAttendanceStatus === 'absent') group.currentAbsentCount += 1;
    if (student.currentAttendanceStatus === 'unchecked') group.currentUncheckedCount += 1;
    group.recentAttendancePercent = averagePercent(group.students.map((item) => item.recentAttendancePercent));
    groupsById.set(student.groupId, group);
  });

  return [...groupsById.values()].sort((a, b) => {
    if (a.groupId === UNASSIGNED_GROUP_ID) return 1;
    if (b.groupId === UNASSIGNED_GROUP_ID) return -1;
    return a.groupLabel.localeCompare(b.groupLabel, 'ko');
  });
}

function normalizeGroupId(groupId: string | undefined) {
  const trimmed = groupId?.trim();
  return trimmed || UNASSIGNED_GROUP_ID;
}

function timestampToMillis(timestamp: TimestampLike | undefined) {
  return timestamp?.toMillis?.() ?? 0;
}

function averagePercent(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
