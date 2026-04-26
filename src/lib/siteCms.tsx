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

export type SiteCmsSectionPlacement = 'top' | 'bottom';

export const PROTECTED_SITE_CMS_SLUGS = ['home', 'introduction', 'archive', 'community'] as const;

export interface SiteCmsPage {
  id: string;
  slug: string;
  routeSlug: string;
  title: string;
  label: string;
  targetPath: string;
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
  placement?: SiteCmsSectionPlacement;
}

export interface SiteCmsToolState {
  id: string;
  key: string;
  value: string;
  updatedAt?: unknown;
}

export const DEFAULT_SITE_CMS_PAGES: SiteCmsPage[] = [
  { id: 'home', slug: 'home', routeSlug: 'home', title: '메인 홈', label: '홈', targetPath: '/', order: 1, visible: true },
  { id: 'introduction', slug: 'introduction', routeSlug: 'intro', title: '교회 소개', label: '소개', targetPath: '/intro', order: 2, visible: true },
  { id: 'archive', slug: 'archive', routeSlug: 'archive', title: '말씀 아카이브', label: '말씀 아카이브', targetPath: '/archive', order: 3, visible: true },
  { id: 'community', slug: 'community', routeSlug: 'community', title: '소통 게시판', label: '소통 게시판', targetPath: '/community', order: 4, visible: true },
];

export const DEFAULT_SITE_CMS_SECTIONS: SiteCmsSection[] = [
  {
    id: 'home_example_banner',
    pageSlug: 'home',
    type: 'text',
    title: '(예시) 홈 상단 공지 배너',
    content: '관리자 페이지에서 이 섹션을 수정·삭제하거나 새 공지를 추가할 수 있습니다.',
    highlights: [],
    media: [],
    order: 1,
    visible: false,
    placement: 'top',
  },
  {
    id: 'introduction_example_notice',
    pageSlug: 'introduction',
    type: 'text',
    title: '(예시) 소개 페이지 보조 안내',
    content: '교회 소개 본문 외에 임시 공지나 이벤트 안내가 있을 때 사용합니다.',
    highlights: [],
    media: [],
    order: 1,
    visible: false,
    placement: 'bottom',
  },
  {
    id: 'archive_example_notice',
    pageSlug: 'archive',
    type: 'text',
    title: '(예시) 아카이브 보조 안내',
    content: '말씀 아카이브 상단에 노출할 임시 안내 영역입니다.',
    highlights: [],
    media: [],
    order: 1,
    visible: false,
    placement: 'top',
  },
  {
    id: 'community_example_notice',
    pageSlug: 'community',
    type: 'text',
    title: '(예시) 소통 게시판 보조 안내',
    content: '게시판 운영 정책이나 일시 공지 등을 띄울 수 있는 영역입니다.',
    highlights: [],
    media: [],
    order: 1,
    visible: false,
    placement: 'top',
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
            setPages(
              snapshot.docs.map((d) => {
                const data = d.data() as any;
                const inferredTargetPath =
                  data?.targetPath ||
                  (data?.slug === 'home' ? '/' : data?.slug === 'introduction' ? '/intro' : data?.slug === 'archive' ? '/archive' : data?.slug === 'community' ? '/community' : '/');
                const inferredRouteSlug =
                  data?.routeSlug ||
                  (inferredTargetPath === '/' ? 'home' : String(inferredTargetPath).replace(/^\/+/, '')) ||
                  data?.slug ||
                  'home';
                return {
                  id: d.id,
                  ...data,
                  routeSlug: inferredRouteSlug,
                  targetPath: inferredTargetPath,
                } as SiteCmsPage;
              })
            );
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
