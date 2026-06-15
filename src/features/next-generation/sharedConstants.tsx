// Shared constants, types, and helpers used across the NextGeneration
// page family. Pulled out of NextGeneration.tsx so individual page
// components can be extracted without duplicating these.
import React from 'react';
import {
  BookMarked,
  CalendarDays,
  ClipboardList,
  FileText,
  HeartHandshake,
  Sparkles,
  Users,
} from 'lucide-react';
import { NEXT_GENERATION_PATH } from '../../lib/nextGenerationResources';
import { MaterialAttachment } from '../../lib/attachments';

export const introImage = '/next-generation-elementary-illustration.png';
export const elementaryImage = '/next-generation-elementary-illustration.png';
export const youngAdultsIntroImage = '/next-generation-young-adults-binder-illustration.png';
export const youngAdultsImage = '/next-generation-young-adults-binder-illustration.png';

export const elementaryWeeklyResourceIds = [
  'elementary_script',
  'elementary_workbook',
  'elementary_guide',
  'family_column',
];
const elementaryWeekKeyResourceIds = [...elementaryWeeklyResourceIds, 'family_worship'];

export const elementaryResourceTabs = [
  {
    id: 'elementary_weekly',
    name: '이번주 강의자료',
    description: '해당 주일에 필요한 강의원고, 공과, 공과 가이드, 예배를 잇는 가정을 한곳에서 확인합니다.',
    icon: CalendarDays,
  },
  {
    id: 'elementary_script',
    name: '강의원고',
    description: '',
    icon: FileText,
  },
  {
    id: 'elementary_workbook',
    name: '공과',
    description: '',
    icon: BookMarked,
  },
  {
    id: 'elementary_guide',
    name: '공과 가이드',
    description: '',
    icon: ClipboardList,
  },
  {
    id: 'family_column',
    name: '예배를 잇는 가정',
    description: '',
    icon: HeartHandshake,
  },
  {
    id: 'family_worship',
    name: '가정예배',
    description: '매주 가정에서 함께 드리는 가정예배 교안과 가정들의 나눔을 확인합니다.',
    icon: HeartHandshake,
  },
  {
    id: 'summer_bible_school',
    name: '여름성경학교',
    description: '여름성경학교 준비와 진행 자료를 함께 모읍니다.',
    icon: Sparkles,
  },
];

export const youngAdultResourceTabs = [
  {
    id: 'pilgrim_lecture',
    name: '천로역정 특강',
    description: '천로역정 특강 자료와 나눔 질문을 확인합니다.',
    icon: BookMarked,
  },
  {
    id: 'podcast_review',
    name: '복습 팟캐스트',
    description: '주일 천로역정 특강의 내용을 팟캐스트를 통해 복습합니다.',
    icon: FileText,
  },
  {
    id: 'retreat_materials',
    name: '수련회 자료',
    description: '청년부 수련회 준비와 모임 자료를 모읍니다.',
    icon: ClipboardList,
  },
];

export const allResourceTabs = [...elementaryResourceTabs, ...youngAdultResourceTabs];
const requiredDefaultResourceTabIds = new Set(['family_worship']);
const youtubeUrlResourceTabIds = new Set(['podcast_review', 'family_worship']);

export const mergeTabsWithRequiredDefaults = (tabs: any[]) => {
  if (tabs.length === 0) return allResourceTabs as any[];

  const existingIds = new Set(tabs.map((tab: any) => tab.slug || tab.id));
  const requiredMissingTabs = allResourceTabs.filter((tab: any) =>
    requiredDefaultResourceTabIds.has(tab.id) && !existingIds.has(tab.id)
  );

  return [...tabs, ...requiredMissingTabs];
};

export const elementaryWeeklyResourceTabs = elementaryResourceTabs.filter((tab) =>
  elementaryWeeklyResourceIds.includes(tab.id)
);

export const isElementaryWeeklyResource = (id?: string) => {
  return !!id && elementaryWeekKeyResourceIds.includes(id);
};

export const supportsNextGenerationYoutubeUrl = (id?: string) => {
  return !!id && youtubeUrlResourceTabIds.has(id);
};

export const sectionTabs = [
  {
    id: 'elementary',
    name: '유초등부',
    path: `${NEXT_GENERATION_PATH}/elementary`,
    image: elementaryImage,
    copy: '말씀을 듣고, 질문하고, 삶으로 이어 가는 어린이 공동체입니다.',
    icon: Sparkles,
  },
  {
    id: 'young-adults',
    name: '청년부',
    path: `${NEXT_GENERATION_PATH}/young-adults`,
    image: youngAdultsImage,
    copy: '복음 안에서 부르심을 찾고 함께 자라 가는 청년 공동체입니다.',
    icon: Users,
  },
];

export interface NextGenerationPost {
  id: string;
  title?: string;
  content?: string;
  subCategory?: string;
  nextGenerationTopicId?: string;
  authorName?: string;
  createdAt?: any;
  updatedAt?: any;
  youtubeUrl?: string;
  videoUrl?: string;
  pdfUrl?: string;
  pdfName?: string;
  attachments?: MaterialAttachment[];
  category?: string;
  [key: string]: any;
}

export interface ResourceTabItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  departmentSlug: string;
  isGuestOpen?: boolean;
  isWeeklyGroup?: boolean;
  useWeekKey?: boolean;
  useTopic?: boolean;
}

export interface DepartmentCardItem {
  id: string;
  slug: string;
  name: string;
  path: string;
  image: string;
  copy: string;
  heroTitle?: string;
  heroDescription?: string;
  heroClassName?: string;
  badgeClassName?: string;
  guestPostLimit?: number;
  icon: React.ComponentType<any>;
}

export const iconMap: Record<string, React.ComponentType<any>> = {
  CalendarDays,
  FileText,
  BookMarked,
  ClipboardList,
  HeartHandshake,
  Sparkles,
  Users,
};

export const getRejectedNoticeVersion = (member: any) => {
  if (!member) return '';
  if (typeof member.rejectedAt?.toMillis === 'function') {
    return String(member.rejectedAt.toMillis());
  }
  if (member.rejectionReason) {
    return String(member.rejectionReason);
  }
  return 'rejected';
};
