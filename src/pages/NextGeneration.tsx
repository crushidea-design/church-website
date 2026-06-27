import React, { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { NextGenerationAuthProvider, useNextGenerationAuth } from '../lib/nextGenerationAuth';
import NextGenerationContact from './NextGenerationContact';
import NextGenerationQA from './NextGenerationQA';
import NextGenerationTodayWord from './NextGenerationTodayWord';
import NextGenerationHighlightBand, { HighlightEntry } from '../components/NextGenerationHighlightBand';
import { Apple, BookOpen, HeartHandshake, HelpCircle } from 'lucide-react';
import WordFruitPanel from '../features/word-fruit/WordFruitPanel';
import FamilyWorshipSharePanel from '../features/word-fruit/FamilyWorshipSharePanel';
import {
  getCurrentSundayKey,
  NEXT_GENERATION_PATH,
} from '../lib/nextGenerationResources';
import { supportsNextGenerationTopic } from '../lib/nextGenerationTopics';
import EditPost from './EditPost';
import {
  NextGenerationCmsProvider,
  useNextGenerationCms,
} from '../lib/nextGenerationCms';
import { initializeNextGenerationBadgeSync, setNextGenerationBadgeCount } from '../services/appBadgeService';
import {
  NEXT_GENERATION_NOTIFICATION_TOPIC,
  onMessageListener,
  requestNotificationPermission,
} from '../services/notificationService';
import NextGenerationCreatePost from '../features/next-generation/NextGenerationCreatePost';
import NextGenerationPostDetail from '../features/next-generation/NextGenerationPostDetail';
import ResourceLibraryPage from '../features/next-generation/ResourceLibraryPage';
import IntroPage from '../features/next-generation/IntroPage';
import NextGenerationHeader from '../features/next-generation/NextGenerationHeader';
import NextGenerationMyPage from '../features/next-generation/NextGenerationMyPage';
import NextGenerationDemoPage from '../features/next-generation/NextGenerationDemoPage';
import {
  DepartmentCardItem,
  ResourceTabItem,
  elementaryImage,
  iconMap,
  isElementaryWeeklyResource,
  mergeTabsWithRequiredDefaults,
  sectionTabs,
  youngAdultResourceTabs,
} from '../features/next-generation/sharedConstants';

const NEXT_GENERATION_CATEGORY = 'next_generation';
const RESOURCE_PAGE_SIZE = 12;


function useNextGenerationHead() {
  useEffect(() => {
    const previousTitle = document.title;
    const previousLinks = Array.from(
      document.head.querySelectorAll<HTMLLinkElement>('link[rel*="icon"], link[rel="manifest"]')
    ).map((link) => link.cloneNode(true) as HTMLLinkElement);
    const previousAppleTitle = document.head.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')?.content;
    const previousThemeColor = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content;
    const hadAppleTitle = document.head.querySelector('meta[name="apple-mobile-web-app-title"]') !== null;
    const hadThemeColor = document.head.querySelector('meta[name="theme-color"]') !== null;

    document.head
      .querySelectorAll<HTMLLinkElement>('link[rel*="icon"], link[rel="manifest"]')
      .forEach((link) => link.remove());

    const addHeadLink = (attributes: Record<string, string>) => {
      const link = document.createElement('link');
      Object.entries(attributes).forEach(([key, value]) => link.setAttribute(key, value));
      link.dataset.nextGenerationHead = 'true';
      document.head.appendChild(link);
    };

    const ensureMeta = (name: string) => {
      let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = name;
        meta.dataset.nextGenerationHead = 'true';
        document.head.appendChild(meta);
      }
      return meta;
    };

    document.title = '한우리 다음세대';
    ensureMeta('apple-mobile-web-app-title').content = '한우리 다음세대';
    ensureMeta('theme-color').content = '#16a34a';

    addHeadLink({ rel: 'icon', type: 'image/svg+xml', href: '/next-generation-favicon.svg' });
    addHeadLink({ rel: 'icon', type: 'image/png', sizes: '48x48', href: '/next-generation-icon-48.png' });
    addHeadLink({ rel: 'icon', type: 'image/png', sizes: '192x192', href: '/next-generation-icon-192.png' });
    addHeadLink({ rel: 'icon', type: 'image/png', sizes: '512x512', href: '/next-generation-icon-512.png' });
    addHeadLink({ rel: 'apple-touch-icon', sizes: '180x180', href: '/next-generation-apple-touch-icon.png' });
    addHeadLink({ rel: 'manifest', href: '/next.webmanifest' });

    return () => {
      document.title = previousTitle;
      document.head
        .querySelectorAll<HTMLLinkElement>('link[data-next-generation-head="true"]')
        .forEach((link) => link.remove());

      previousLinks.forEach((link) => document.head.appendChild(link));

      const appleTitle = document.head.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
      if (appleTitle) {
        if (hadAppleTitle && previousAppleTitle !== undefined) {
          appleTitle.content = previousAppleTitle;
        } else {
          appleTitle.remove();
        }
      }

      const themeColor = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (themeColor) {
        if (hadThemeColor && previousThemeColor !== undefined) {
          themeColor.content = previousThemeColor;
        } else {
          themeColor.remove();
        }
      }
    };
  }, []);
}







function useNextGenerationAppBadge() {
  const { user, hasAccess, unreadCount, loading } = useNextGenerationAuth();

  useEffect(() => {
    return initializeNextGenerationBadgeSync();
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!hasAccess) {
      void setNextGenerationBadgeCount(0);
      return;
    }

    void setNextGenerationBadgeCount(unreadCount);
  }, [hasAccess, loading, unreadCount]);

  useEffect(() => {
    if (!hasAccess) {
      return;
    }

    const unsubscribe = onMessageListener(() => {});
    return () => {
      unsubscribe();
    };
  }, [hasAccess]);

  useEffect(() => {
    if (!user || !hasAccess || typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (!isStandalone || Notification.permission !== 'granted') {
      return;
    }

    void requestNotificationPermission(user.uid, { topic: NEXT_GENERATION_NOTIFICATION_TOPIC });
  }, [user, hasAccess]);
}

function NextGenerationInner() {
  useNextGenerationHead();
  useNextGenerationAppBadge();

  const location = useLocation();
  const { hasAccess, isPastor, loading: authLoading } = useNextGenerationAuth();
  const { departments: cmsDepartments, tabs: cmsTabs, introSections } = useNextGenerationCms();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('scrollTop') !== '1') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search]);

  const mappedDepartments: DepartmentCardItem[] = useMemo(
    () =>
      (cmsDepartments.length > 0 ? cmsDepartments : (sectionTabs as any))
        .filter((department: any) => department.isVisible !== false)
        .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
        .map((department: any) => ({
          id: department.slug || department.id,
          slug: department.slug || department.id,
          name: department.name,
          path: `${NEXT_GENERATION_PATH}/${department.slug || department.id}`,
          image: department.image || elementaryImage,
          copy: department.description || department.copy || '',
          heroTitle: department.heroTitle,
          heroDescription: department.heroDescription,
          heroClassName: department.heroClassName,
          badgeClassName: department.badgeClassName,
          guestPostLimit: department.guestPostLimit,
          icon: iconMap.Sparkles,
        })),
    [cmsDepartments]
  );
  const mappedTabs: ResourceTabItem[] = useMemo(
    () =>
      mergeTabsWithRequiredDefaults(cmsTabs as any)
        .filter((tab: any) => tab.isVisible !== false)
        .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
        .map((tab: any) => ({
          id: tab.slug || tab.id,
          slug: tab.slug || tab.id,
          name: tab.name,
          description: tab.description || '',
          icon: iconMap[tab.iconName] || tab.icon || FileText,
          departmentSlug: tab.departmentSlug || (youngAdultResourceTabs.some((item) => item.id === (tab.id || tab.slug)) ? 'young-adults' : 'elementary'),
          isGuestOpen: tab.isGuestOpen || tab.id === 'elementary_weekly' || tab.id === 'pilgrim_lecture',
          isWeeklyGroup: tab.isWeeklyGroup || tab.id === 'elementary_weekly',
          useWeekKey: tab.useWeekKey || isElementaryWeeklyResource(tab.id || tab.slug),
          useTopic: tab.useTopic || supportsNextGenerationTopic(tab.id || tab.slug),
        })),
    [cmsTabs]
  );
  const pathParts = location.pathname.split('/').filter(Boolean);
  const currentSundayKey = useMemo(() => getCurrentSundayKey(), []);
  const currentSection = pathParts[1];
  const postId = currentSection === 'post' ? pathParts[2] : null;
  const editId = currentSection === 'edit' ? pathParts[2] : null;
  const currentDepartment = mappedDepartments.find((department) => department.slug === currentSection);

  let content: React.ReactNode = <IntroPage sections={introSections} departments={mappedDepartments} />;

  if (postId) {
    content = <NextGenerationPostDetail id={postId} />;
  } else if (editId) {
    content = <EditPost postId={editId} nextGenerationMode />;
  } else if (currentSection === 'demo') {
    content = <NextGenerationDemoPage />;
  } else if (currentSection === 'me') {
    content = <NextGenerationMyPage />;
  } else if (currentSection === 'create') {
    content = <NextGenerationCreatePost />;
  } else if (currentDepartment) {
    const departmentTabs = mappedTabs.filter((tab) => tab.departmentSlug === currentDepartment.slug);
    const weeklyResourceIds = departmentTabs
      .filter((tab) => tab.useWeekKey && !tab.isWeeklyGroup && tab.id !== 'family_worship')
      .map((tab) => tab.id);
    const guestTabId = departmentTabs.find((tab) => tab.isGuestOpen)?.id;
    content = (
      <ResourceLibraryPage
        departmentSlug={currentDepartment.slug}
        departmentName={currentDepartment.name}
        image={currentDepartment.image}
        imageAlt={`${currentDepartment.name} 자료`}
        badgeClassName={currentDepartment.badgeClassName || 'bg-white text-coral-800'}
        heroClassName={currentDepartment.heroClassName || 'bg-white'}
        title={currentDepartment.heroTitle || `${currentDepartment.name} 자료실`}
        description={currentDepartment.heroDescription || `${currentDepartment.name} 자료를 확인합니다.`}
        tabs={departmentTabs}
        guestTabId={guestTabId}
        guestPostLimit={currentDepartment.guestPostLimit}
        weeklyResourceIds={weeklyResourceIds}
        midSection={(() => {
          if (currentDepartment.slug === 'young-adults') {
            const entries: HighlightEntry[] = [
              {
                id: 'qa',
                icon: <HelpCircle size={18} />,
                label: '질문 있습니다',
                summary: '신앙의 질문을 자유롭게 남겨 보세요',
                tourTarget: 'qa',
                content: <NextGenerationQA compact department="young-adults" />,
              },
              {
                id: 'today',
                icon: <BookOpen size={18} />,
                label: '오늘의 말씀',
                summary: '맥체인 성경 읽기와 묵상 가이드',
                tourTarget: 'today-word',
                content: <NextGenerationTodayWord compact />,
              },
            ];
            return (
              <NextGenerationHighlightBand
                themeBg="bg-gradient-to-b from-sky-50 to-white border-y border-sky-100"
                activeRing="border-emerald-400 bg-emerald-50"
                entries={entries}
              />
            );
          }
          if (currentDepartment.slug === 'elementary') {
            const entries: HighlightEntry[] = [
              {
                id: 'qa',
                icon: <HelpCircle size={18} />,
                label: '질문 있습니다',
                summary: '신앙의 질문을 자유롭게 남겨 보세요',
                tourTarget: 'qa',
                content: <NextGenerationQA compact department="elementary" />,
              },
              {
                id: 'word-fruit',
                icon: <Apple size={18} />,
                label: '이번 주 말씀 열매',
                summary: '작은 순종으로 열매가 익어가요',
                tourTarget: 'word-fruit',
                content: <WordFruitPanel />,
              },
              {
                id: 'family-worship',
                icon: <HeartHandshake size={18} />,
                label: '이번주 가정예배',
                summary: '가정예배 기록과 나눔을 남겨요',
                tourTarget: 'family-worship',
                content: <FamilyWorshipSharePanel weekKey={currentSundayKey} className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]" />,
              },
            ];
            return (
              <NextGenerationHighlightBand
                themeBg="bg-gradient-to-b from-amber-50 to-white border-y border-amber-100"
                activeRing="border-amber-400 bg-amber-50"
                entries={entries}
              />
            );
          }
          return undefined;
        })()}
      />
    );
  } else if (currentSection === 'contact') {
    content = (
      <div className="min-h-[60vh] bg-white py-10">
        <NextGenerationContact />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <NextGenerationHeader />
      {content}
      <footer className="border-t border-emerald-100 bg-emerald-700 py-8 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 text-sm font-bold sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <span>한우리교회 다음세대</span>
          <span className="text-emerald-100">예배를 중심으로 가정과 동행하며 성경과 교리를 가르칩니다.</span>
        </div>
      </footer>
    </div>
  );
}

export default function NextGeneration() {
  return (
    <NextGenerationAuthProvider>
      <NextGenerationCmsProvider>
        <NextGenerationInner />
      </NextGenerationCmsProvider>
    </NextGenerationAuthProvider>
  );
}
