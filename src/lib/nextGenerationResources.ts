import { getYouTubeId } from './utils';

export const NEXT_GENERATION_PATH = '/next';

export interface NextGenerationResourcePost {
  content?: string;
  createdAt?: unknown;
  nextGenerationWeekKey?: string;
  nextGenerationTabSlug?: string;
  subCategory?: string;
  videoUrl?: string;
  youtubeUrl?: string;
}

export interface NextGenerationResourceTabLike {
  id: string;
  slug?: string;
  name: string;
  departmentSlug?: string;
}

export interface NextGenerationDepartmentLike {
  slug?: string;
}

const legacyYoungAdultResourceIds = new Set(['pilgrim_lecture', 'podcast_review', 'retreat_materials']);

export const getYouTubeVideoId = (url: string): string | null => {
  const match = url.match(/(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([^&\n?#]+)/);
  return match ? match[1] : null;
};

export const getPostYouTubeVideoId = (post: Pick<NextGenerationResourcePost, 'youtubeUrl' | 'videoUrl' | 'content'>) => {
  const directUrl = post.youtubeUrl || post.videoUrl || '';
  return getYouTubeVideoId(directUrl) || getYouTubeId(post.content || '');
};

export const isFamilyWorshipPost = (post: Pick<NextGenerationResourcePost, 'nextGenerationTabSlug' | 'subCategory'>) => {
  return (post.nextGenerationTabSlug || post.subCategory) === 'family_worship';
};

export const getCreatedAtTime = (value: unknown) => {
  if (!value) return 0;
  if (typeof value === 'object' && value !== null && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const toLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getSundayDate = (baseDate = new Date()) => {
  const date = new Date(baseDate);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + ((7 - date.getDay()) % 7));
  return date;
};

export const getCurrentSundayKey = () => toLocalDateKey(getSundayDate());

export const getPostWeekKey = (post: NextGenerationResourcePost) => {
  if (typeof post.nextGenerationWeekKey === 'string' && post.nextGenerationWeekKey) {
    return post.nextGenerationWeekKey;
  }

  const createdAtTime = getCreatedAtTime(post.createdAt);
  if (!createdAtTime) return '';
  return toLocalDateKey(getSundayDate(new Date(createdAtTime)));
};

export const getPostPrimarySortTime = (post: NextGenerationResourcePost): number => {
  if (typeof post.nextGenerationWeekKey === 'string' && post.nextGenerationWeekKey) {
    return new Date(post.nextGenerationWeekKey).getTime();
  }
  return getCreatedAtTime(post.createdAt);
};

export const getResourceLabel = (id: string | undefined, tabs: NextGenerationResourceTabLike[]) => {
  return tabs.find((tab) => tab.id === id || tab.slug === id)?.name || '다음세대 자료';
};

export const getResourceDepartmentPath = (
  id: string | undefined,
  tabs: NextGenerationResourceTabLike[] = [],
  departments: NextGenerationDepartmentLike[] = []
) => {
  const foundTab = tabs.find((tab) => tab.id === id || tab.slug === id);
  const legacyDepartmentSlug = id && legacyYoungAdultResourceIds.has(id) ? 'young-adults' : undefined;
  const departmentSlug = foundTab?.departmentSlug || legacyDepartmentSlug || departments[0]?.slug || 'elementary';
  return `${NEXT_GENERATION_PATH}/${departmentSlug}`;
};

export interface NextGenerationPostBackPathOptions {
  sourcePath?: string;
  topicId?: string | null;
  includeTopic?: boolean;
}

export const getSafeNextGenerationListPath = (sourcePath?: string) => {
  if (!sourcePath) return null;
  try {
    const url = new URL(sourcePath, 'http://local.invalid');
    if (url.origin !== 'http://local.invalid') return null;
    if (!url.pathname.startsWith(`${NEXT_GENERATION_PATH}/`)) return null;
    if (
      url.pathname.startsWith(`${NEXT_GENERATION_PATH}/post/`) ||
      url.pathname.startsWith(`${NEXT_GENERATION_PATH}/edit/`) ||
      url.pathname.startsWith(`${NEXT_GENERATION_PATH}/create`)
    ) {
      return null;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
};

export const getNextGenerationPostBackPath = (
  postTabSlug: string | undefined,
  tabs: NextGenerationResourceTabLike[] = [],
  departments: NextGenerationDepartmentLike[] = [],
  fallbackResourceId?: string,
  options: NextGenerationPostBackPathOptions = {}
) => {
  const sourcePath = getSafeNextGenerationListPath(options.sourcePath);
  if (sourcePath) return sourcePath;

  const resourceId = postTabSlug || fallbackResourceId || tabs[0]?.id || 'elementary_weekly';
  const path = `${getResourceDepartmentPath(resourceId, tabs, departments)}?resource=${resourceId}`;
  return options.includeTopic && options.topicId ? `${path}&topic=${options.topicId}` : path;
};

export const getResourceTab = <T extends NextGenerationResourceTabLike>(id: string | undefined, tabs: T[]) => {
  return tabs.find((tab) => tab.id === id || tab.slug === id) || tabs[0];
};

export const getContentPreview = (content?: string) => {
  if (!content) return '함께 확인할 자료가 준비되어 있습니다.';
  return content.replace(/\s+/g, ' ').trim().slice(0, 110);
};

export const toDateOrNull = (value: unknown): Date | null => {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (value instanceof Date) return value;
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatShortDate = (value: unknown) => {
  const date = toDateOrNull(value);
  if (!date) return '';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};
