import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

export type NextGenerationIconName =
  | 'CalendarDays'
  | 'FileText'
  | 'BookMarked'
  | 'ClipboardList'
  | 'HeartHandshake'
  | 'Sparkles'
  | 'Users';

export interface NextGenerationDepartment {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string;
  heroTitle: string;
  heroDescription: string;
  heroClassName: string;
  badgeClassName: string;
  guestPostLimit?: number;
  isVisible: boolean;
  order: number;
}

export interface NextGenerationResourceTab {
  id: string;
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

export type NextGenerationIntroSectionType = 'text' | 'highlights' | 'gallery';

export interface NextGenerationIntroSection {
  id: string;
  departmentSlug: string;
  title: string;
  sectionType: NextGenerationIntroSectionType;
  paragraphs: string[];
  highlights: string[];
  gallery: Array<{ src: string; alt: string }>;
  isVisible: boolean;
  order: number;
}

export const DEFAULT_NEXT_GENERATION_DEPARTMENTS: NextGenerationDepartment[] = [
  {
    id: 'elementary',
    slug: 'elementary',
    name: '유초등부',
    description: '말씀을 듣고, 질문하고, 삶으로 이어 가는 어린이 공동체입니다.',
    image: '/next-generation-2026.png',
    heroTitle: '예배가 한 주의 삶으로 이어지도록',
    heroDescription: '이번 주 강의원고, 공과, 공과가이드, 부모 칼럼을 한곳에서 확인합니다.',
    heroClassName: 'bg-amber-50',
    badgeClassName: 'bg-white text-coral-800',
    isVisible: true,
    order: 1,
  },
  {
    id: 'young-adults',
    slug: 'young-adults',
    name: '청년부',
    description: '복음 안에서 부르심을 찾고 함께 자라 가는 청년 공동체입니다.',
    image: '/young-adults-pilgrims-progress.png',
    heroTitle: '복음 안에서 함께 질문하고 함께 걸어갑니다',
    heroDescription: '천로역정 특강과 수련회 자료를 한곳에서 확인합니다.',
    heroClassName: 'bg-white',
    badgeClassName: 'bg-sky-100 text-emerald-950',
    guestPostLimit: 4,
    isVisible: true,
    order: 2,
  },
];

export const DEFAULT_NEXT_GENERATION_TABS: NextGenerationResourceTab[] = [
  {
    id: 'elementary_weekly',
    slug: 'elementary_weekly',
    departmentSlug: 'elementary',
    name: '이번주 강의자료',
    description: '해당 주일에 필요한 강의원고, 공과, 공과 가이드, 가정 자료를 모아 보여줍니다.',
    iconName: 'CalendarDays',
    isVisible: true,
    order: 1,
    isGuestOpen: true,
    isWeeklyGroup: true,
    useWeekKey: false,
    useTopic: false,
  },
  {
    id: 'elementary_script',
    slug: 'elementary_script',
    departmentSlug: 'elementary',
    name: '강의원고',
    description: '',
    iconName: 'FileText',
    isVisible: true,
    order: 2,
    isGuestOpen: false,
    isWeeklyGroup: false,
    useWeekKey: true,
    useTopic: true,
  },
  {
    id: 'elementary_workbook',
    slug: 'elementary_workbook',
    departmentSlug: 'elementary',
    name: '공과',
    description: '',
    iconName: 'BookMarked',
    isVisible: true,
    order: 3,
    isGuestOpen: false,
    isWeeklyGroup: false,
    useWeekKey: true,
    useTopic: true,
  },
  {
    id: 'elementary_guide',
    slug: 'elementary_guide',
    departmentSlug: 'elementary',
    name: '공과 가이드',
    description: '',
    iconName: 'ClipboardList',
    isVisible: true,
    order: 4,
    isGuestOpen: false,
    isWeeklyGroup: false,
    useWeekKey: true,
    useTopic: true,
  },
  {
    id: 'family_column',
    slug: 'family_column',
    departmentSlug: 'elementary',
    name: '예배를 잇는 가정',
    description: '',
    iconName: 'HeartHandshake',
    isVisible: true,
    order: 5,
    isGuestOpen: false,
    isWeeklyGroup: false,
    useWeekKey: true,
    useTopic: true,
  },
  {
    id: 'summer_bible_school',
    slug: 'summer_bible_school',
    departmentSlug: 'elementary',
    name: '여름성경학교',
    description: '여름성경학교 준비와 진행 자료를 함께 모읍니다.',
    iconName: 'Sparkles',
    isVisible: true,
    order: 6,
    isGuestOpen: false,
    isWeeklyGroup: false,
    useWeekKey: false,
    useTopic: false,
  },
  {
    id: 'pilgrim_lecture',
    slug: 'pilgrim_lecture',
    departmentSlug: 'young-adults',
    name: '천로역정 특강',
    description: '천로역정 특강 자료와 나눔 질문을 확인합니다.',
    iconName: 'BookMarked',
    isVisible: true,
    order: 1,
    isGuestOpen: true,
    isWeeklyGroup: false,
    useWeekKey: false,
    useTopic: false,
  },
  {
    id: 'podcast_review',
    slug: 'podcast_review',
    departmentSlug: 'young-adults',
    name: '복습 팟캐스트',
    description: '주일 천로역정 특강의 내용을 팟캐스트를 통해 복습합니다.',
    iconName: 'FileText',
    isVisible: true,
    order: 2,
    isGuestOpen: false,
    isWeeklyGroup: false,
    useWeekKey: false,
    useTopic: false,
  },
  {
    id: 'retreat_materials',
    slug: 'retreat_materials',
    departmentSlug: 'young-adults',
    name: '수련회 자료',
    description: '청년부 수련회 준비와 모임 자료를 모읍니다.',
    iconName: 'ClipboardList',
    isVisible: true,
    order: 3,
    isGuestOpen: false,
    isWeeklyGroup: false,
    useWeekKey: false,
    useTopic: false,
  },
];

export const DEFAULT_NEXT_GENERATION_INTRO_SECTIONS: NextGenerationIntroSection[] = [
  {
    id: 'elementary_intro_1',
    departmentSlug: 'elementary',
    title: '예배 중심 교육',
    sectionType: 'text',
    paragraphs: [
      '다음세대 교육의 중심은 전세대가 함께 드리는 언약 공동체의 예배입니다.',
      '주일 예배를 준비하며 말씀을 듣고 삶으로 이어가도록 돕습니다.',
    ],
    highlights: [],
    gallery: [],
    isVisible: true,
    order: 1,
  },
  {
    id: 'elementary_intro_2',
    departmentSlug: 'elementary',
    title: '가정과 동행',
    sectionType: 'highlights',
    paragraphs: [
      '교회와 가정이 분리되지 않고 한 흐름 안에서 자녀의 신앙을 세워갑니다.',
    ],
    highlights: [
      '주일 말씀을 가정에서 다시 나눌 수 있는 주간 자료 제공',
      '부모와 자녀가 함께 기도하고 실천할 수 있는 질문 제시',
    ],
    gallery: [],
    isVisible: true,
    order: 2,
  },
  {
    id: 'young_adults_intro_1',
    departmentSlug: 'young-adults',
    title: '말씀과 공동체',
    sectionType: 'text',
    paragraphs: [
      '청년부는 말씀 앞에서 질문하고 함께 분별하며 복음 안에서 성장합니다.',
      '특강, 복습, 수련회 자료를 통해 한 주의 신앙 여정을 이어갑니다.',
    ],
    highlights: [],
    gallery: [],
    isVisible: true,
    order: 1,
  },
];

export const seedNextGenerationCmsIfEmpty = async () => {
  const existing = await getDocs(query(collection(db, 'next_generation_departments'), limit(1)));
  if (!existing.empty) return false;

  const batch = writeBatch(db);
  const now = serverTimestamp();

  DEFAULT_NEXT_GENERATION_DEPARTMENTS.forEach((department) => {
    batch.set(doc(db, 'next_generation_departments', department.slug), {
      ...department,
      updatedAt: now,
      createdAt: now,
    });
  });

  DEFAULT_NEXT_GENERATION_TABS.forEach((tab) => {
    batch.set(doc(db, 'next_generation_resource_tabs', tab.slug), {
      ...tab,
      updatedAt: now,
      createdAt: now,
    });
  });

  DEFAULT_NEXT_GENERATION_INTRO_SECTIONS.forEach((section) => {
    batch.set(doc(db, 'next_generation_intro_sections', section.id), {
      ...section,
      updatedAt: now,
      createdAt: now,
    });
  });

  await batch.commit();
  return true;
};

interface NextGenerationCmsContextType {
  loading: boolean;
  departments: NextGenerationDepartment[];
  tabs: NextGenerationResourceTab[];
  introSections: NextGenerationIntroSection[];
}

const NextGenerationCmsContext = createContext<NextGenerationCmsContextType>({
  loading: true,
  departments: DEFAULT_NEXT_GENERATION_DEPARTMENTS,
  tabs: DEFAULT_NEXT_GENERATION_TABS,
  introSections: DEFAULT_NEXT_GENERATION_INTRO_SECTIONS,
});

export function NextGenerationCmsProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<NextGenerationDepartment[]>(DEFAULT_NEXT_GENERATION_DEPARTMENTS);
  const [tabs, setTabs] = useState<NextGenerationResourceTab[]>(DEFAULT_NEXT_GENERATION_TABS);
  const [introSections, setIntroSections] = useState<NextGenerationIntroSection[]>(DEFAULT_NEXT_GENERATION_INTRO_SECTIONS);

  useEffect(() => {
    const unsubs = [
      onSnapshot(
        query(collection(db, 'next_generation_departments'), orderBy('order', 'asc')),
        (snapshot) => {
          if (!snapshot.empty) {
            setDepartments(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as NextGenerationDepartment)));
          }
          setLoading(false);
        },
        () => setLoading(false)
      ),
      onSnapshot(query(collection(db, 'next_generation_resource_tabs'), orderBy('order', 'asc')), (snapshot) => {
        if (!snapshot.empty) {
          setTabs(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as NextGenerationResourceTab)));
        }
      }),
      onSnapshot(query(collection(db, 'next_generation_intro_sections'), orderBy('order', 'asc')), (snapshot) => {
        if (!snapshot.empty) {
          setIntroSections(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as NextGenerationIntroSection)));
        }
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, []);

  const value = useMemo(
    () => ({ loading, departments, tabs, introSections }),
    [loading, departments, tabs, introSections]
  );

  return <NextGenerationCmsContext.Provider value={value}>{children}</NextGenerationCmsContext.Provider>;
}

export const useNextGenerationCms = () => useContext(NextGenerationCmsContext);

export const normalizeCmsSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

export const upsertNextGenerationDepartment = async (
  slug: string,
  payload: Omit<NextGenerationDepartment, 'id' | 'slug'>
) => {
  await setDoc(
    doc(db, 'next_generation_departments', slug),
    {
      ...payload,
      slug,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const upsertNextGenerationTab = async (
  slug: string,
  payload: Omit<NextGenerationResourceTab, 'id' | 'slug'>
) => {
  await setDoc(
    doc(db, 'next_generation_resource_tabs', slug),
    {
      ...payload,
      slug,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const upsertNextGenerationIntroSection = async (
  id: string,
  payload: Omit<NextGenerationIntroSection, 'id'>
) => {
  await setDoc(
    doc(db, 'next_generation_intro_sections', id),
    {
      ...payload,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
};
