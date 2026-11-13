import type { NextGenerationIconName } from '../../../lib/nextGenerationCms';
import { HEIDELBERG_LORDS_DAYS } from '../heidelberg';

// Hidden 2027 resource tabs and Heidelberg topics. Pure builders: the
// Firestore write lives in api.ts (createMissingPreparationCatalog).

export interface PreparationTabDoc {
  slug: string;
  departmentSlug: string;
  name: string;
  description: string;
  iconName: NextGenerationIconName;
  isVisible: boolean;
  order: number;
  isGuestOpen: boolean;
  isWeeklyGroup: boolean;
  useWeekKey: boolean;
  useTopic: boolean;
}

export interface PreparationTopicDoc {
  slug: string;
  departmentSlug: string;
  name: string;
  keywords: string[];
  isVisible: boolean;
  order: number;
}

const DEPARTMENT_SLUG = 'elementary';

const TAB_SPECS: Array<{
  slug: string;
  name: string;
  description: string;
  iconName: NextGenerationIconName;
  useWeekKey: boolean;
  useTopic: boolean;
}> = [
  { slug: 'workbook_jaram', name: '자람반 공과', description: '자람반(유치~초등) 주일 공과 자료입니다.', iconName: 'BookMarked', useWeekKey: true, useTopic: true },
  { slug: 'workbook_seum', name: '세움반 공과', description: '세움반(중학생) 주일 공과 자료입니다.', iconName: 'BookMarked', useWeekKey: true, useTopic: true },
  { slug: 'workbook_didim', name: '디딤반 공과', description: '디딤반(고등학생) 주일 공과 자료입니다.', iconName: 'BookMarked', useWeekKey: true, useTopic: true },
  { slug: 'seed_songs_stories', name: '씨앗반 찬송·동화', description: '씨앗반과 부모님이 함께 나누는 찬송과 동화 자료입니다.', iconName: 'Sparkles', useWeekKey: true, useTopic: true },
  { slug: 'parent_guide', name: '부모 안내', description: '주일학교 개편 안내와 가정 신앙교육 길잡이입니다.', iconName: 'HeartHandshake', useWeekKey: false, useTopic: false },
  { slug: 'school_events', name: '수련회·캠프', description: '개강 수련회와 여름방학캠프 안내 및 자료입니다.', iconName: 'CalendarDays', useWeekKey: false, useTopic: false },
];

export const HEIDELBERG_TOPIC_PREFIX = 'heidelberg-ld-';

export const heidelbergTopicId = (lordsDay: number) =>
  `${HEIDELBERG_TOPIC_PREFIX}${String(lordsDay).padStart(2, '0')}`;

export function buildPreparationTabs(): PreparationTabDoc[] {
  return TAB_SPECS.map((spec, index) => ({
    ...spec,
    departmentSlug: DEPARTMENT_SLUG,
    isVisible: false,
    order: 101 + index,
    isGuestOpen: false,
    isWeeklyGroup: false,
  }));
}

export function buildHeidelbergTopics(): PreparationTopicDoc[] {
  return HEIDELBERG_LORDS_DAYS.map(({ lordsDay, questions }) => ({
    slug: heidelbergTopicId(lordsDay),
    departmentSlug: DEPARTMENT_SLUG,
    name: `하이델베르크 제${lordsDay}주일 (${questions[0] === questions[1] ? `${questions[0]}문` : `${questions[0]}~${questions[1]}문`})`,
    // No keywords: they would be shared by all 52 topics, so keyword inference
    // would file any untagged post mentioning 하이델베르크 under 제1주일.
    keywords: [],
    isVisible: false,
    order: 1000 + lordsDay,
  }));
}

/** Docs whose slug is not in existingIds. Existing documents are never returned. */
export function pickMissing<T extends { slug: string }>(existingIds: Iterable<string>, docs: T[]): T[] {
  const existing = new Set(existingIds);
  return docs.filter((item) => !existing.has(item.slug));
}
