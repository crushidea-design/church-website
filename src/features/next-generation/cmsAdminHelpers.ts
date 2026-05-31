// Shared types, constants, and tiny helpers used by the
// AdminNextGenerationCms page and its tab panels.
import {
  NextGenerationIconName,
  PROTECTED_NEXT_GEN_DEPARTMENT_SLUGS,
  PROTECTED_NEXT_GEN_TAB_SLUGS,
} from '../../lib/nextGenerationCms';

export type CmsAdminTab = 'departments' | 'resourceTabs' | 'intro' | 'materials' | 'tools';

export const isProtectedDepartmentSlug = (slug: string) =>
  (PROTECTED_NEXT_GEN_DEPARTMENT_SLUGS as readonly string[]).includes(slug);

export const isProtectedTabSlug = (slug: string) =>
  (PROTECTED_NEXT_GEN_TAB_SLUGS as readonly string[]).includes(slug);

export const ELEMENTARY_TAB_HINT_SLUGS = [
  'elementary_script',
  'elementary_workbook',
  'elementary_guide',
  'family_column',
  'elementary_weekly',
  'summer_bible_school',
];

export const YOUNG_ADULT_TAB_HINT_SLUGS = [
  'pilgrim_lecture',
  'podcast_review',
  'retreat_materials',
];

export interface NextGenerationPostSummary {
  id: string;
  title: string;
  subCategory?: string;
  nextGenerationDepartmentSlug?: string;
  nextGenerationTabSlug?: string;
  nextGenerationWeekKey?: string;
  nextGenerationTopicId?: string;
  authorName?: string;
  isArchived?: boolean;
  createdAt?: any;
}

export const formatPostDate = (value: any) => {
  const date = value?.toDate?.() || (typeof value === 'string' ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ko-KR');
};

export const ICON_OPTIONS: NextGenerationIconName[] = [
  'CalendarDays',
  'FileText',
  'BookMarked',
  'ClipboardList',
  'HeartHandshake',
  'Sparkles',
  'Users',
];
