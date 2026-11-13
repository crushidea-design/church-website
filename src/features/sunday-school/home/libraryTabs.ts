import { STUDENT_ACCESSIBLE_TAB_SLUGS } from '../../../lib/nextGenerationAuth';
import { HEIDELBERG_TOPIC_PREFIX } from '../admin/preparationCatalog';
import {
  NEXT_GENERATION_UNASSIGNED_TOPIC_ID,
  inferNextGenerationTopicId,
} from '../../../lib/nextGenerationTopics';
import type { NextGenerationTopicOption } from '../../../lib/nextGenerationTopics';

export const SCHOOL_DEPARTMENT_SLUG = 'elementary';

export const PREPARATION_TAB_IDS = [
  'workbook_jaram',
  'workbook_seum',
  'workbook_didim',
  'seed_songs_stories',
  'parent_guide',
  'school_events',
] as const;

/** 2025-26 tabs: not in the tab bar, listed under "지난 자료" instead. */
export const ARCHIVED_TAB_IDS = ['elementary_workbook', 'summer_bible_school'] as const;

/** Replaced by the "이번 주 자료" section. */
export const REPLACED_TAB_IDS = ['elementary_weekly'] as const;

export const SCHOOL_TAB_ORDER = [
  'elementary_script',
  'workbook_jaram',
  'workbook_seum',
  'workbook_didim',
  'seed_songs_stories',
  'elementary_guide',
  'family_column',
  'family_worship',
  'parent_guide',
  'school_events',
] as const;

/** Display names that differ from the CMS docs (school page only). */
export const SCHOOL_TAB_NAME_OVERRIDES: Record<string, string> = {
  elementary_script: '공통 강해 원고',
};

export const ARCHIVED_TAB_LINKS: Array<{ id: string; name: string }> = [
  { id: 'elementary_workbook', name: '공과 (2025–26)' },
  { id: 'summer_bible_school', name: '여름성경학교 (2025–26)' },
];

interface TabLike {
  id: string;
  slug?: string;
  name: string;
  departmentSlug?: string;
  isVisible?: boolean;
}

const inList = (list: readonly string[], id: string) => list.includes(id);

export function selectSchoolLibraryTabs<T extends TabLike>(tabs: T[]): T[] {
  const orderOf = (tab: T) => {
    const index = (SCHOOL_TAB_ORDER as readonly string[]).indexOf(tab.id);
    return index === -1 ? SCHOOL_TAB_ORDER.length : index;
  };
  return tabs
    .map((tab, position) => ({ tab, position }))
    .filter(({ tab }) => {
      if (tab.departmentSlug !== SCHOOL_DEPARTMENT_SLUG) return false;
      if (inList(ARCHIVED_TAB_IDS, tab.id) || inList(REPLACED_TAB_IDS, tab.id)) return false;
      return tab.isVisible !== false || inList(PREPARATION_TAB_IDS, tab.id);
    })
    // Stable: unknown tabs keep their incoming (CMS) order after the known ones.
    .sort((a, b) => orderOf(a.tab) - orderOf(b.tab) || a.position - b.position)
    .map(({ tab }) =>
      SCHOOL_TAB_NAME_OVERRIDES[tab.id] ? { ...tab, name: SCHOOL_TAB_NAME_OVERRIDES[tab.id] } : tab,
    );
}

/** Tabs a 학생 account may open: the original one plus the 2027 class workbooks and the common script. */
export const SCHOOL_STUDENT_TAB_IDS: readonly string[] = [
  ...STUDENT_ACCESSIBLE_TAB_SLUGS,
  'workbook_seum',
  'workbook_didim',
  'elementary_script',
];

/** Topics usable for chips: department topics, including hidden Heidelberg ones. */
export function getSchoolTopics(topics: NextGenerationTopicOption[]): NextGenerationTopicOption[] {
  return topics
    .filter((topic) => !topic.departmentSlug || topic.departmentSlug === SCHOOL_DEPARTMENT_SLUG)
    .filter((topic) => topic.isVisible !== false || topic.id.startsWith(HEIDELBERG_TOPIC_PREFIX))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export interface TopicChip {
  id: string;
  name: string;
  count: number;
}

export interface TopicChipGroups {
  current: TopicChip[];
  past: TopicChip[];
}

/** Heidelberg topics with posts first, then older topics ("지난 주제"). */
export function buildTopicChips(
  posts: Array<Parameters<typeof inferNextGenerationTopicId>[0]>,
  schoolTopics: NextGenerationTopicOption[],
): TopicChipGroups {
  const counts = new Map<string, number>();
  for (const post of posts) {
    const id = inferNextGenerationTopicId(post, schoolTopics);
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  const current: TopicChip[] = [];
  const past: TopicChip[] = [];
  for (const topic of schoolTopics) {
    const count = counts.get(topic.id) || 0;
    if (count === 0) continue;
    const isHeidelberg = topic.id.startsWith(HEIDELBERG_TOPIC_PREFIX);
    // Hidden non-Heidelberg topics are not offered as chips.
    if (!isHeidelberg && topic.isVisible === false) continue;
    (isHeidelberg ? current : past).push({ id: topic.id, name: topic.name, count });
  }
  const unassigned = counts.get(NEXT_GENERATION_UNASSIGNED_TOPIC_ID) || 0;
  if (unassigned > 0) past.push({ id: NEXT_GENERATION_UNASSIGNED_TOPIC_ID, name: '기타', count: unassigned });
  return { current, past };
}
