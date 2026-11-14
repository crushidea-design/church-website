export const SCHOOL_TERMS_COLLECTION = 'next_generation_school_terms';
export const SCHOOL_CURRICULUM_COLLECTION = 'next_generation_school_curriculum';
export const SCHOOL_CLASSES_COLLECTION = 'next_generation_school_classes';
export const SCHOOL_WEEKLY_COLLECTION = 'next_generation_school_weekly';

export type SchoolTermKind = 'term' | 'vacation';

export interface SchoolTerm {
  id: string;
  kind: SchoolTermKind;
  name: string;
  startDate: string; // YYYY-MM-DD (a Sunday)
  endDate: string; // YYYY-MM-DD (a Sunday)
  order: number;
}

export type CurriculumEntryKind =
  | 'opening'
  | 'retreat'
  | 'class'
  | 'special'
  | 'review'
  | 'closing'
  | 'holiday';

export interface CurriculumEntry {
  id: string; // equals date
  date: string; // YYYY-MM-DD; may be a Saturday (retreat)
  sundayKey: string; // Sunday this entry belongs to (Saturday -> next day)
  termId: string;
  kind: CurriculumEntryKind;
  session?: number; // counted lesson number (1..n)
  lordsDay?: number; // Heidelberg Lord's Day 1..52
  questions?: [number, number]; // inclusive question range
  title: string;
  note?: string;
  isCommunionSunday?: boolean;
  /** 이번 주 암송: 암송할 문 하나와 반별 암송 범위(씨앗반은 암송 없음). */
  memory?: CurriculumMemory;
}

export interface CurriculumMemory {
  question?: number;
  /** 질문 + 핵심 한 구절 */
  jaram?: string;
  /** 질문 + 답의 핵심 문장 */
  seum?: string;
  /** 질문 + 답 전체 */
  didim?: string;
  /** 교사에게 보여 줄 예시 실천 약속 (1~3개). */
  promiseExamples?: string[];
}

export type SchoolClassId = 'seed' | 'jaram' | 'seum' | 'didim';

export interface SchoolClass {
  id: SchoolClassId;
  name: string;
  ageRule: string;
  verseRef: string;
  verseText: string;
  emphasis: string;
  room: string;
  mode: 'parent' | 'class';
  order: number;
  isVisible: boolean;
}

/**
 * 반별 주간 기록 (문서 id = `${weekKey}_${studentUid}`). 교사가 주일에 입력한다.
 * 이후 단계에서 부모·학생의 날짜별 체크 필드를 더할 수 있다.
 */
export interface SchoolWeeklyDoc {
  id: string;
  weekKey: string; // Sunday YYYY-MM-DD, same as the attendance weekKey
  studentUid: string;
  studentName: string;
  classId: SchoolClassId;
  /** 이번 주 실천 약속 (교사가 아이의 말을 받아 적음, 200자 이내). */
  promise?: string;
  /** 지난주 암송을 이번 주일에 확인했는가. */
  memoryChecked?: boolean;
  /** 확인한 암송 문항 번호. */
  memoryQuestion?: number;
  updatedBy: string;
  updatedAt?: any;
}
