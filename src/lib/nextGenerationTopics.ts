export interface NextGenerationTopicOption {
  id: string;
  name: string;
  keywords: string[];
  /** Empty means the topic is shared by every department. */
  departmentSlug?: string;
  isVisible?: boolean;
  order?: number;
}

export const NEXT_GENERATION_WEEKLY_RESOURCE_IDS = [
  'elementary_script',
  'elementary_workbook',
  'elementary_guide',
  'family_column',
] as const;

export const isNextGenerationWeeklyResource = (resourceId?: string) => {
  return !!resourceId && NEXT_GENERATION_WEEKLY_RESOURCE_IDS.includes(resourceId as typeof NEXT_GENERATION_WEEKLY_RESOURCE_IDS[number]);
};

export const NEXT_GENERATION_TOPICABLE_RESOURCE_IDS = [
  'elementary_script',
  'elementary_workbook',
  'elementary_guide',
  'family_column',
] as const;

/**
 * Fallback topic catalog. The live catalog lives in the
 * `next_generation_topics` CMS collection; these values seed it and are used
 * while the collection has not loaded yet.
 */
export const NEXT_GENERATION_TOPIC_OPTIONS: NextGenerationTopicOption[] = [
  {
    id: 'ten-commandments',
    name: '십계명',
    keywords: ['십계명', '하나님 앞에서', '우상숭배'],
    departmentSlug: 'elementary',
    isVisible: true,
    order: 1,
  },
  {
    id: 'scripture',
    name: '성경',
    keywords: ['성경', '성경의 유익', '성경의 능력'],
    departmentSlug: 'elementary',
    isVisible: true,
    order: 2,
  },
  {
    id: 'apostles-creed',
    name: '사도신경',
    keywords: ['사도신경', '영원히 사는 것', '몸의 부활'],
    departmentSlug: 'elementary',
    isVisible: true,
    order: 3,
  },
];

export const NEXT_GENERATION_UNASSIGNED_TOPIC_ID = 'unassigned';

export const supportsNextGenerationTopic = (resourceId?: string) => {
  return !!resourceId && NEXT_GENERATION_TOPICABLE_RESOURCE_IDS.includes(resourceId as typeof NEXT_GENERATION_TOPICABLE_RESOURCE_IDS[number]);
};

/**
 * Topics visible in one department: department-specific ones plus the topics
 * left without a department (shared by every department).
 */
export const getDepartmentTopics = (
  topics: NextGenerationTopicOption[],
  departmentSlug?: string
) =>
  topics
    .filter((topic) => topic.isVisible !== false)
    .filter((topic) => !topic.departmentSlug || !departmentSlug || topic.departmentSlug === departmentSlug)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

export const getNextGenerationTopicLabel = (
  topicId?: string,
  topics: NextGenerationTopicOption[] = NEXT_GENERATION_TOPIC_OPTIONS
) => {
  if (topicId === NEXT_GENERATION_UNASSIGNED_TOPIC_ID) {
    return '기타';
  }

  return topics.find((topic) => topic.id === topicId)?.name || '기타';
};

export const inferNextGenerationTopicId = (
  post?: {
    nextGenerationTopicId?: string;
    title?: string;
    content?: string;
  },
  topics: NextGenerationTopicOption[] = NEXT_GENERATION_TOPIC_OPTIONS
) => {
  if (!post) return NEXT_GENERATION_UNASSIGNED_TOPIC_ID;

  if (
    typeof post.nextGenerationTopicId === 'string' &&
    (
      topics.some((topic) => topic.id === post.nextGenerationTopicId) ||
      post.nextGenerationTopicId === NEXT_GENERATION_UNASSIGNED_TOPIC_ID
    )
  ) {
    return post.nextGenerationTopicId;
  }

  const haystack = `${post.title || ''} ${post.content || ''}`.toLowerCase();
  const matchedTopic = topics.find((topic) => (
    topic.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
  ));

  return matchedTopic?.id || NEXT_GENERATION_UNASSIGNED_TOPIC_ID;
};
