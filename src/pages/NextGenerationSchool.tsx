// Preview-gated shell for the 2027 Sunday school pages (/next/school/*).
// Copy of the NextGeneration.tsx structure; the original keeps serving the
// public site until the sunday_school_2027 flag is switched on.
import React, { useEffect, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Apple, FileText, HeartHandshake, HelpCircle, Loader2 } from 'lucide-react';
import { NextGenerationAuthProvider, useNextGenerationAuth } from '../lib/nextGenerationAuth';
import { NextGenerationCmsProvider, useNextGenerationCms } from '../lib/nextGenerationCms';
import { getCurrentSundayKey, NEXT_GENERATION_PATH } from '../lib/nextGenerationResources';
import { supportsNextGenerationTopic } from '../lib/nextGenerationTopics';
import NextGenerationQA from './NextGenerationQA';
import NextGenerationHighlightBand, { HighlightEntry } from '../components/NextGenerationHighlightBand';
import WordFruitPanel from '../features/word-fruit/WordFruitPanel';
import FamilyWorshipSharePanel from '../features/word-fruit/FamilyWorshipSharePanel';
import {
  ResourceTabItem,
  iconMap,
  isElementaryWeeklyResource,
  mergeTabsWithRequiredDefaults,
  youngAdultResourceTabs,
} from '../features/next-generation/sharedConstants';
import { useNextGenerationAppBadge, useNextGenerationHead } from './NextGeneration';
import SchoolHeader from '../features/sunday-school/SchoolHeader';
import SchoolLibraryPage from '../features/sunday-school/SchoolLibraryPage';
import SchoolIntroPage from '../features/sunday-school/SchoolIntroPage';
import { SCHOOL_REDIRECT_PATH, decideSchoolAccess } from '../features/sunday-school/access';
import { useSundaySchool2027Flag } from '../features/sunday-school/flags';

const SCHOOL_PATH = `${NEXT_GENERATION_PATH}/school`;

function PreviewBanner() {
  return (
    <div className="bg-amber-100 px-4 py-1.5 text-center text-xs font-black text-amber-900">
      개편 미리보기 — 다음세대 교역자에게만 보입니다. 성도 화면은 아직 기존 유초등부입니다.
    </div>
  );
}

function SchoolInner({ flagEnabled }: { flagEnabled: boolean }) {
  useNextGenerationHead();
  useNextGenerationAppBadge();

  const location = useLocation();
  const { isPastor } = useNextGenerationAuth();
  const { tabs: cmsTabs } = useNextGenerationCms();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('scrollTop') !== '1') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search]);

  // Hidden preparation tabs are kept (isVisible: false); the library page decides what to show.
  const mappedTabs: ResourceTabItem[] = useMemo(
    () =>
      mergeTabsWithRequiredDefaults(cmsTabs as any)
        .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
        .map((tab: any) => ({
          id: tab.slug || tab.id,
          slug: tab.slug || tab.id,
          name: tab.name,
          description: tab.description || '',
          icon: iconMap[tab.iconName] || tab.icon || FileText,
          departmentSlug:
            tab.departmentSlug ||
            (youngAdultResourceTabs.some((item) => item.id === (tab.id || tab.slug)) ? 'young-adults' : 'elementary'),
          isGuestOpen: tab.isGuestOpen || tab.id === 'pilgrim_lecture',
          isVisible: tab.isVisible !== false,
          isWeeklyGroup: tab.isWeeklyGroup || tab.id === 'elementary_weekly',
          useWeekKey: tab.useWeekKey || isElementaryWeeklyResource(tab.id || tab.slug),
          useTopic: tab.useTopic || supportsNextGenerationTopic(tab.id || tab.slug),
        })),
    [cmsTabs]
  );

  const currentSundayKey = useMemo(() => getCurrentSundayKey(), []);
  const section = location.pathname.split('/').filter(Boolean)[2];

  const midSection = (() => {
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
  })();

  let content: React.ReactNode;
  if (section === undefined) {
    content = <SchoolLibraryPage tabs={mappedTabs.filter((tab) => tab.departmentSlug === 'elementary')} midSection={midSection} />;
  } else if (section === 'intro') {
    content = <SchoolIntroPage />;
  } else {
    content = <Navigate to={SCHOOL_PATH} replace />;
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {!flagEnabled && isPastor && <PreviewBanner />}
      <SchoolHeader />
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

function SchoolGate() {
  const { enabled, loading: flagLoading } = useSundaySchool2027Flag();
  const { loading: authLoading, isPastor } = useNextGenerationAuth();
  const decision = decideSchoolAccess({ flagEnabled: enabled, flagLoading, authLoading, isPastor });

  if (decision === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-700" />
      </div>
    );
  }
  if (decision === 'redirect') return <Navigate to={SCHOOL_REDIRECT_PATH} replace />;
  return (
    <NextGenerationCmsProvider>
      <SchoolInner flagEnabled={enabled} />
    </NextGenerationCmsProvider>
  );
}

export default function NextGenerationSchool() {
  return (
    <NextGenerationAuthProvider>
      <SchoolGate />
    </NextGenerationAuthProvider>
  );
}
