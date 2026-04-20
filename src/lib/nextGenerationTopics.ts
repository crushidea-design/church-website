export interface NextGenerationTopicOption {
  id: string;
  name: string;
  keywords: string[];
}

export const NEXT_GENERATION_TOPICABLE_RESOURCE_IDS = [
  'elementary_script',
  'elementary_workbook',
  'elementary_guide',
  'family_column',
] as const;

export const NEXT_GENERATION_TOPIC_OPTIONS: NextGenerationTopicOption[] = [
  {
    id: 'ten-commandments',
    name: '십계명',
    keywords: ['십계명', '하나님 앞에서', '우상숭배'],
  },
  {
    id: 'scripture',
    name: '성경',
    keywords: ['성경', '성경의 유익', '성경의 능력'],
  },
  {
    id: 'apostles-creed',
    name: '사도신경',
    keywords: ['사도신경', '영원히 사는 것', '몸의 부활'],
  },
];

export const NEXT_GENERATION_UNASSIGNED_TOPIC_ID = 'unassigned';

export const supportsNextGenerationTopic = (resourceId?: string) => {
  return !!resourceId && NEXT_GENERATION_TOPICABLE_RESOURCE_IDS.includes(resourceId as typeof NEXT_GENERATION_TOPICABLE_RESOURCE_IDS[number]);
};

export const getNextGenerationTopicLabel = (topicId?: string) => {
  if (topicId === NEXT_GENERATION_UNASSIGNED_TOPIC_ID) {
    return '기타';
  }

  return NEXT_GENERATION_TOPIC_OPTIONS.find((topic) => topic.id === topicId)?.name || '기타';
};

export const inferNextGenerationTopicId = (post?: {
  nextGenerationTopicId?: string;
  title?: string;
  content?: string;
}) => {
  if (!post) return NEXT_GENERATION_UNASSIGNED_TOPIC_ID;

  if (
    typeof post.nextGenerationTopicId === 'string' &&
    (
      NEXT_GENERATION_TOPIC_OPTIONS.some((topic) => topic.id === post.nextGenerationTopicId) ||
      post.nextGenerationTopicId === NEXT_GENERATION_UNASSIGNED_TOPIC_ID
    )
  ) {
    return post.nextGenerationTopicId;
  }

  const haystack = `${post.title || ''} ${post.content || ''}`.toLowerCase();
  const matchedTopic = NEXT_GENERATION_TOPIC_OPTIONS.find((topic) => (
    topic.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
  ));

  return matchedTopic?.id || NEXT_GENERATION_UNASSIGNED_TOPIC_ID;
};
