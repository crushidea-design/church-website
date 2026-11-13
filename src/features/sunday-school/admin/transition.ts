import {
  NEXT_GENERATION_UNASSIGNED_TOPIC_ID,
  NEXT_GENERATION_TOPIC_OPTIONS,
  inferNextGenerationTopicId,
  supportsNextGenerationTopic,
} from '../../../lib/nextGenerationTopics';
import type { NextGenerationTopicOption } from '../../../lib/nextGenerationTopics';
import { ARCHIVED_TAB_IDS, PREPARATION_TAB_IDS, SCHOOL_DEPARTMENT_SLUG } from '../home/libraryTabs';

// Pure helpers for the "전환 준비" admin section (plan §5-3). The Firestore
// reads/writes live in api.ts; nothing here touches the network.

/** Fields of a post that the preservation check needs. */
export interface InventoryPost {
  title?: string;
  content?: string;
  subCategory?: string;
  nextGenerationTabSlug?: string;
  nextGenerationDepartmentSlug?: string;
  nextGenerationTopicId?: string;
}

const YOUNG_ADULT_TAB_IDS = ['pilgrim_lecture', 'podcast_review', 'retreat_materials'];

/** 2025–26 elementary tabs plus the archived ones, in display order. */
export const INVENTORY_TAB_IDS = [
  'elementary_weekly',
  'elementary_script',
  'elementary_workbook',
  'elementary_guide',
  'family_column',
  'family_worship',
  'summer_bible_school',
  ...PREPARATION_TAB_IDS,
] as const;

export const postTabId = (post: InventoryPost) => post.nextGenerationTabSlug || post.subCategory || '';

export function isElementaryPost(post: InventoryPost): boolean {
  if (post.nextGenerationDepartmentSlug) return post.nextGenerationDepartmentSlug === SCHOOL_DEPARTMENT_SLUG;
  return !YOUNG_ADULT_TAB_IDS.includes(postTabId(post));
}

export interface InventoryRow {
  id: string;
  published: number;
  private: number;
  archived: boolean;
}

export interface PreservationInventory {
  tabs: InventoryRow[];
  topics: Array<{ id: string; published: number; private: number }>;
  total: { published: number; private: number };
}

export function buildPreservationInventory(
  published: InventoryPost[],
  unpublished: InventoryPost[],
  topics: NextGenerationTopicOption[] = NEXT_GENERATION_TOPIC_OPTIONS,
): PreservationInventory {
  const tabCounts = new Map<string, { published: number; private: number }>();
  const topicCounts = new Map<string, { published: number; private: number }>();
  const total = { published: 0, private: 0 };

  const bump = (map: Map<string, { published: number; private: number }>, key: string, field: 'published' | 'private') => {
    const entry = map.get(key) ?? { published: 0, private: 0 };
    entry[field] += 1;
    map.set(key, entry);
  };

  const visit = (posts: InventoryPost[], field: 'published' | 'private') => {
    for (const post of posts) {
      if (!isElementaryPost(post)) continue;
      const tabId = postTabId(post) || 'unassigned';
      total[field] += 1;
      bump(tabCounts, tabId, field);
      if (supportsNextGenerationTopic(tabId)) {
        bump(topicCounts, inferNextGenerationTopicId(post, topics), field);
      }
    }
  };
  visit(published, 'published');
  visit(unpublished, 'private');

  const knownIds: string[] = [...INVENTORY_TAB_IDS];
  const extraIds = [...tabCounts.keys()].filter((id) => !knownIds.includes(id)).sort();
  const tabRows: InventoryRow[] = [...knownIds, ...extraIds].map((id) => ({
    id,
    published: tabCounts.get(id)?.published ?? 0,
    private: tabCounts.get(id)?.private ?? 0,
    archived: (ARCHIVED_TAB_IDS as readonly string[]).includes(id),
  }));

  const topicIds = [
    ...topics.filter((topic) => topic.isVisible !== false && (!topic.departmentSlug || topic.departmentSlug === SCHOOL_DEPARTMENT_SLUG)).map((topic) => topic.id),
    NEXT_GENERATION_UNASSIGNED_TOPIC_ID,
  ];
  const topicRows = [...new Set([...topicIds, ...topicCounts.keys()])].map((id) => ({
    id,
    published: topicCounts.get(id)?.published ?? 0,
    private: topicCounts.get(id)?.private ?? 0,
  }));

  return { tabs: tabRows, topics: topicRows, total };
}

/** Keeps every row that has posts and all known tabs; used to hide empty unknown rows. */
export const hasPosts = (row: { published: number; private: number }) => row.published + row.private > 0;
