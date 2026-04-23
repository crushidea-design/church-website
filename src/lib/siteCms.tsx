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

export type SiteCmsPageSlug = 'home' | 'introduction' | 'archive' | 'community';

export type SiteCmsSectionType = 'text' | 'highlights' | 'gallery' | 'hero';

export interface SiteCmsPage {
  id: string;
  slug: string;
  title: string;
  label: string;
  order: number;
  visible: boolean;
}

export interface SiteCmsSection {
  id: string;
  pageSlug: string;
  type: SiteCmsSectionType;
  title: string;
  content: string;
  highlights: string[];
  media: Array<{ src: string; alt: string }>;
  order: number;
  visible: boolean;
}

export interface SiteCmsToolState {
  id: string;
  key: string;
  value: string;
  updatedAt?: unknown;
}

export const DEFAULT_SITE_CMS_PAGES: SiteCmsPage[] = [
  { id: 'home', slug: 'home', title: '메인 홈', label: '홈', order: 1, visible: true },
  { id: 'introduction', slug: 'introduction', title: '교회 소개', label: '소개', order: 2, visible: true },
  { id: 'archive', slug: 'archive', title: '말씀 아카이브', label: '말씀 아카이브', order: 3, visible: true },
  { id: 'community', slug: 'community', title: '소통 게시판', label: '소통 게시판', order: 4, visible: true },
];

export const DEFAULT_SITE_CMS_SECTIONS: SiteCmsSection[] = [
  {
    id: 'home_hero_1',
    pageSlug: 'home',
    type: 'hero',
    title: '함께 지어져 가는 교회',
    content: '말씀과 예배, 교제와 기도를 통해 함께 자라가는 공동체를 지향합니다.',
    highlights: ['예배 중심', '말씀 중심', '공동체 중심'],
    media: [],
    order: 1,
    visible: true,
  },
  {
    id: 'introduction_top_1',
    pageSlug: 'introduction',
    type: 'text',
    title: '교회 소개',
    content: '우리 교회는 오직 성경의 토대 위에서 함께 지어져 가는 공동체를 지향합니다.',
    highlights: [],
    media: [],
    order: 1,
    visible: true,
  },
  {
    id: 'archive_top_1',
    pageSlug: 'archive',
    type: 'text',
    title: '말씀 아카이브',
    content: '말씀 콘텐츠를 카테고리별로 정리하여 필요한 자료를 빠르게 찾을 수 있습니다.',
    highlights: [],
    media: [],
    order: 1,
    visible: true,
  },
  {
    id: 'community_top_1',
    pageSlug: 'community',
    type: 'text',
    title: '소통 게시판',
    content: '교회 소식과 나눔을 자유롭게 공유하는 커뮤니티 공간입니다.',
    highlights: [],
    media: [],
    order: 1,
    visible: true,
  },
];

export const normalizeSiteCmsSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

export const seedSiteCmsIfEmpty = async () => {
  const existing = await getDocs(query(collection(db, 'site_cms_pages'), limit(1)));
  if (!existing.empty) return false;

  const batch = writeBatch(db);
  const now = serverTimestamp();

  DEFAULT_SITE_CMS_PAGES.forEach((page) => {
    batch.set(doc(db, 'site_cms_pages', page.slug), {
      ...page,
      updatedAt: now,
      createdAt: now,
    });
  });

  DEFAULT_SITE_CMS_SECTIONS.forEach((section) => {
    batch.set(doc(db, 'site_cms_sections', section.id), {
      ...section,
      updatedAt: now,
      createdAt: now,
    });
  });

  await batch.commit();
  return true;
};

interface SiteCmsContextType {
  loading: boolean;
  pages: SiteCmsPage[];
  sections: SiteCmsSection[];
}

const SiteCmsContext = createContext<SiteCmsContextType>({
  loading: true,
  pages: DEFAULT_SITE_CMS_PAGES,
  sections: DEFAULT_SITE_CMS_SECTIONS,
});

export function SiteCmsProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<SiteCmsPage[]>(DEFAULT_SITE_CMS_PAGES);
  const [sections, setSections] = useState<SiteCmsSection[]>(DEFAULT_SITE_CMS_SECTIONS);

  useEffect(() => {
    const unsubs = [
      onSnapshot(
        query(collection(db, 'site_cms_pages'), orderBy('order', 'asc')),
        (snapshot) => {
          if (!snapshot.empty) {
            setPages(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as SiteCmsPage)));
          }
          setLoading(false);
        },
        () => setLoading(false)
      ),
      onSnapshot(query(collection(db, 'site_cms_sections'), orderBy('order', 'asc')), (snapshot) => {
        if (!snapshot.empty) {
          setSections(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as SiteCmsSection)));
        }
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, []);

  const value = useMemo(() => ({ loading, pages, sections }), [loading, pages, sections]);

  return <SiteCmsContext.Provider value={value}>{children}</SiteCmsContext.Provider>;
}

export const useSiteCms = () => useContext(SiteCmsContext);

export const upsertSiteCmsPage = async (slug: string, payload: Omit<SiteCmsPage, 'id' | 'slug'>) => {
  await setDoc(
    doc(db, 'site_cms_pages', slug),
    {
      ...payload,
      slug,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const upsertSiteCmsSection = async (id: string, payload: Omit<SiteCmsSection, 'id'>) => {
  await setDoc(
    doc(db, 'site_cms_sections', id),
    {
      ...payload,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const upsertSiteCmsToolState = async (key: string, value: string) => {
  await setDoc(
    doc(db, 'site_cms_tools_state', key),
    {
      key,
      value,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
};
