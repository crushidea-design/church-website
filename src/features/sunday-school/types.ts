export const SCHOOL_TERMS_COLLECTION = 'next_generation_school_terms';
export const SCHOOL_CURRICULUM_COLLECTION = 'next_generation_school_curriculum';
export const SCHOOL_CLASSES_COLLECTION = 'next_generation_school_classes';

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
