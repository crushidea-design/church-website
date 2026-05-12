export interface ClassDashboardMember {
  uid: string;
  displayName?: string;
  email?: string;
  role?: string;
  department?: string;
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

export interface ClassDashboardStudent extends ClassDashboardMember {
  groupId: string;
  groupLabel: string;
  completedBooks: number;
  readingPercent: number;
  questionCount: number;
  unansweredQuestionCount: number;
  lastActivityMillis: number;
}

export interface ClassDashboardGroup {
  groupId: string;
  groupLabel: string;
  students: ClassDashboardStudent[];
  totalCompletedBooks: number;
  totalQuestions: number;
  totalUnansweredQuestions: number;
}

export interface ClassDashboardSummary {
  students: ClassDashboardStudent[];
  groups: ClassDashboardGroup[];
  totalStudents: number;
  totalCompletedBooks: number;
  totalQuestions: number;
  totalUnansweredQuestions: number;
}

interface TimestampLike {
  toMillis?: () => number;
}

interface BuildClassDashboardArgs {
  members: ClassDashboardMember[];
  readings: ClassDashboardReading[];
  qaItems: ClassDashboardQA[];
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
  studentDepartment,
  visibleGroupIds,
}: BuildClassDashboardArgs): ClassDashboardSummary {
  const visibleGroupSet = visibleGroupIds && visibleGroupIds.length > 0
    ? new Set(visibleGroupIds)
    : null;
  const readingByUid = new Map(readings.map((reading) => [reading.uid, reading]));
  const questionsByUid = new Map<string, ClassDashboardQA[]>();

  qaItems.forEach((item) => {
    if (!item.authorId) return;
    const existing = questionsByUid.get(item.authorId) ?? [];
    existing.push(item);
    questionsByUid.set(item.authorId, existing);
  });

  const students = members
    .filter((member) => member.role === 'member' && member.department === studentDepartment)
    .filter((member) => !visibleGroupSet || (member.groupId && visibleGroupSet.has(member.groupId)))
    .map((member): ClassDashboardStudent => {
      const normalizedGroupId = normalizeGroupId(member.groupId);
      const reading = readingByUid.get(member.uid);
      const completedBooks = reading?.completedBooks?.length ?? 0;
      const questions = questionsByUid.get(member.uid) ?? [];
      const lastQuestionMillis = Math.max(0, ...questions.map((item) => timestampToMillis(item.createdAt)));
      const lastActivityMillis = Math.max(timestampToMillis(reading?.updatedAt), lastQuestionMillis);

      return {
        ...member,
        groupId: normalizedGroupId,
        groupLabel: normalizedGroupId === UNASSIGNED_GROUP_ID ? UNASSIGNED_GROUP_LABEL : normalizedGroupId,
        completedBooks,
        readingPercent: Math.round((completedBooks / BIBLE_BOOK_TOTAL) * 100),
        questionCount: questions.length,
        unansweredQuestionCount: questions.filter((item) => !item.isAnswered).length,
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
  };
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
    };

    group.students.push(student);
    group.totalCompletedBooks += student.completedBooks;
    group.totalQuestions += student.questionCount;
    group.totalUnansweredQuestions += student.unansweredQuestionCount;
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
