import type { SchoolClassId } from '../types';

export type ClassFilter = SchoolClassId | 'all';

export const CLASS_FILTER_IDS: SchoolClassId[] = ['seed', 'jaram', 'seum', 'didim'];

/** Tabs shown for every class. */
export const COMMON_WEEKLY_TAB_IDS = ['elementary_script', 'family_column', 'family_worship'] as const;

export const CLASS_TAB_IDS: Record<SchoolClassId, string> = {
  seed: 'seed_songs_stories',
  jaram: 'workbook_jaram',
  seum: 'workbook_seum',
  didim: 'workbook_didim',
};

export const WEEKLY_TAB_NAMES: Record<string, string> = {
  elementary_script: '공통 강해 원고',
  family_column: '예배를 잇는 가정',
  family_worship: '가정예배',
  seed_songs_stories: '씨앗반 찬송·동화',
  workbook_jaram: '자람반 공과',
  workbook_seum: '세움반 공과',
  workbook_didim: '디딤반 공과',
};

export function parseClassFilter(value: string | null | undefined): ClassFilter {
  return CLASS_FILTER_IDS.includes(value as SchoolClassId) ? (value as SchoolClassId) : 'all';
}

/** Tab ids for the "이번 주 자료" section: common tabs first, then the class tab(s). */
export function getWeeklyTabIds(classFilter: ClassFilter): string[] {
  const classTabs = classFilter === 'all' ? CLASS_FILTER_IDS.map((id) => CLASS_TAB_IDS[id]) : [CLASS_TAB_IDS[classFilter]];
  return [...COMMON_WEEKLY_TAB_IDS, ...classTabs];
}

interface WeeklyPostLike {
  subCategory?: string;
  nextGenerationTabSlug?: string;
  nextGenerationWeekKey?: string;
}

export interface WeeklyMaterialGroup<T> {
  tabId: string;
  name: string;
  posts: T[];
}

export function groupWeeklyMaterials<T extends WeeklyPostLike>({
  posts,
  sundayKey,
  classFilter,
  allowedTabIds,
}: {
  posts: T[];
  sundayKey: string;
  classFilter: ClassFilter;
  /** Optional whitelist (student / guest restrictions). */
  allowedTabIds?: readonly string[];
}): Array<WeeklyMaterialGroup<T>> {
  const tabIds = getWeeklyTabIds(classFilter).filter((id) => !allowedTabIds || allowedTabIds.includes(id));
  return tabIds.map((tabId) => ({
    tabId,
    name: WEEKLY_TAB_NAMES[tabId] || tabId,
    posts: posts.filter(
      (post) => (post.nextGenerationTabSlug || post.subCategory) === tabId && post.nextGenerationWeekKey === sundayKey,
    ),
  }));
}

/**
 * What visitors who are not logged in may see in "이번 주 자료". The old weekly
 * group (open to guests) held script, workbook, guide and column; these are the
 * 2027 equivalents (the teacher-only guide stays out).
 */
export const GUEST_WEEKLY_TAB_IDS: readonly string[] = [
  'elementary_script',
  'family_column',
  'workbook_jaram',
  'workbook_seum',
  'workbook_didim',
];
