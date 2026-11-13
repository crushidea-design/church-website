// Sunday school home for the 2027 renewal. Copy of the original
// ResourceLibraryPage, reworked: week hero, progress bar, class chips, this
// week's materials, then the tabbed library. The original stays untouched.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowDown01, ArrowUp10, CalendarDays, ChevronDown, Download, FileText, Loader2, Lock, Plus } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useNextGenerationAuth } from '../../lib/nextGenerationAuth';
import { hasDepartment } from '../../lib/nextGenerationRoles';
import {
  NEXT_GENERATION_PATH,
  getActiveSundayKey,
  getContentPreview,
  getResourceLabel,
} from '../../lib/nextGenerationResources';
import {
  getNextGenerationTopicLabel,
  inferNextGenerationTopicId,
  supportsNextGenerationTopic,
} from '../../lib/nextGenerationTopics';
import { useNextGenerationTopics } from '../../lib/nextGenerationCms';
import { getPostAttachments } from '../../lib/attachments';
import { formatDate } from '../../lib/utils';
import type { NextGenerationPost, ResourceTabItem } from '../next-generation/sharedConstants';
import { useSundaySchoolCatalog } from './api';
import { useSchoolIdentity } from './identity';
import { getHeidelbergProgress, getSchoolWeekStatus } from './schedule';
import { findWeekMemoryEntry } from './memory';
import ThisWeekMemory from './home/ThisWeekMemory';
import CurriculumProgress from './home/CurriculumProgress';
import ClassChips from './home/ClassChips';
import SchoolWeekHero from './home/SchoolWeekHero';
import ThisWeekMaterials, { UnpublishedBadge } from './home/ThisWeekMaterials';
import { buildWeekHeroModel } from './home/weekHero';
import {
  ARCHIVED_TAB_LINKS,
  SCHOOL_STUDENT_TAB_IDS,
  buildTopicChips,
  getSchoolTopics,
  selectSchoolLibraryTabs,
} from './home/libraryTabs';
import {
  GUEST_WEEKLY_TAB_IDS,
  getWeeklyTabIds,
  groupWeeklyMaterials,
  parseClassFilter,
} from './home/weeklyMaterials';
import { useSchoolPosts } from './home/useSchoolPosts';

const RESOURCE_PAGE_SIZE = 12;
const DATE_PARAM = /^\d{4}-\d{2}-\d{2}$/;

/** `?date=YYYY-MM-DD` -> the Sunday key of that week, or null when invalid. */
function sundayKeyFromDateParam(value: string | null): string | null {
  if (!value || !DATE_PARAM.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return getActiveSundayKey(date);
}

interface SchoolLibraryPageProps {
  /** Elementary tabs mapped by the page shell; hidden ones carry isVisible: false. */
  tabs: ResourceTabItem[];
  midSection?: React.ReactNode;
  guestPostLimit?: number;
}

export default function SchoolLibraryPage({ tabs, midSection, guestPostLimit }: SchoolLibraryPageProps) {
  const { role, loading: authLoading } = useAuth();
  const { user: ngUser, member, isPastor } = useNextGenerationAuth();
  const { identity } = useSchoolIdentity();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const catalog = useSundaySchoolCatalog();
  const cmsTopics = useNextGenerationTopics();

  const isAdmin = !authLoading && role === 'admin';
  const isGuest = !ngUser;
  const isRestricted = hasDepartment(member, '학생');

  // ---- week hero ----
  const defaultSundayKey = useMemo(() => getActiveSundayKey(), []);
  const overrideKey = isPastor ? sundayKeyFromDateParam(searchParams.get('date')) : null;
  const sundayKey = overrideKey || defaultSundayKey;
  const heroModel = useMemo(() => {
    const status = getSchoolWeekStatus({ terms: catalog.terms, curriculum: catalog.curriculum, sundayKey });
    return buildWeekHeroModel(status, { terms: catalog.terms }, sundayKey);
  }, [catalog.terms, catalog.curriculum, sundayKey]);
  const progress = useMemo(
    () => getHeidelbergProgress(catalog.curriculum, sundayKey),
    [catalog.curriculum, sundayKey],
  );

  const memoryEntry = useMemo(
    () => findWeekMemoryEntry(catalog.curriculum, sundayKey),
    [catalog.curriculum, sundayKey],
  );

  // ---- class chips ----
  const classFilter = parseClassFilter(searchParams.get('class'));
  const setClassFilter = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('class');
    else params.set('class', next);
    setSearchParams(params, { replace: true });
  };

  // ---- library tabs ----
  const schoolTabs = useMemo(() => selectSchoolLibraryTabs(tabs), [tabs]);
  const allowedTabs = useMemo(
    () => (isRestricted ? schoolTabs.filter((tab) => SCHOOL_STUDENT_TAB_IDS.includes(tab.id)) : schoolTabs),
    [isRestricted, schoolTabs],
  );
  const guestTabId = schoolTabs.find((tab) => tab.isGuestOpen)?.id;
  const requestedResource = searchParams.get('resource');
  const activeTab =
    allowedTabs.find((tab) => tab.id === requestedResource) ?? allowedTabs[0];
  const isActiveLocked = isGuest && !!activeTab && activeTab.id !== guestTabId;

  // ---- posts (one fetch serves the weekly section and the tab list) ----
  const fetchTabIds = useMemo(
    () => Array.from(new Set([...schoolTabs.map((tab) => tab.id), ...getWeeklyTabIds('all')])),
    [schoolTabs],
  );
  const { posts, loading, error } = useSchoolPosts(fetchTabIds, isAdmin, ngUser?.uid);

  const weeklyAllowed = isRestricted ? SCHOOL_STUDENT_TAB_IDS : isGuest ? GUEST_WEEKLY_TAB_IDS : undefined;
  const weeklyGroups = useMemo(() => {
    const groups = groupWeeklyMaterials({ posts, sundayKey, classFilter, allowedTabIds: weeklyAllowed });
    if (!isGuest || !guestPostLimit) return groups;
    let remaining = guestPostLimit;
    return groups.map((group) => {
      const slice = group.posts.slice(0, Math.max(0, remaining));
      remaining -= slice.length;
      return { ...group, posts: slice };
    });
  }, [posts, sundayKey, classFilter, weeklyAllowed, isGuest, guestPostLimit]);

  // ---- tab content ----
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const schoolTopics = useMemo(() => getSchoolTopics(cmsTopics), [cmsTopics]);
  const tabPosts = useMemo(
    () => (activeTab ? posts.filter((post) => (post.nextGenerationTabSlug || post.subCategory) === activeTab.id) : []),
    [posts, activeTab],
  );
  const usesTopicFolders = !!activeTab && (!!activeTab.useTopic || supportsNextGenerationTopic(activeTab.id));
  const topicChips = useMemo(
    () => (usesTopicFolders ? buildTopicChips(tabPosts, schoolTopics) : { current: [], past: [] }),
    [usesTopicFolders, tabPosts, schoolTopics],
  );
  const requestedTopic = searchParams.get('topic');
  const allChips = [...topicChips.current, ...topicChips.past];
  const activeTopicId = usesTopicFolders
    ? allChips.find((chip) => chip.id === requestedTopic)?.id ?? allChips[0]?.id ?? null
    : null;
  const filteredPosts = useMemo(() => {
    const byName = (a: NextGenerationPost, b: NextGenerationPost) => {
      const cmp = (a.title || '').trim().localeCompare((b.title || '').trim(), 'ko', { numeric: true, sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    };
    const base =
      usesTopicFolders && activeTopicId
        ? tabPosts.filter((post) => inferNextGenerationTopicId(post, schoolTopics) === activeTopicId)
        : tabPosts;
    return [...base].sort(byName);
  }, [tabPosts, usesTopicFolders, activeTopicId, schoolTopics, sortDir]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab?.id, activeTopicId, sortDir]);

  // Hash links from the hero (e.g. #school-library) scroll after the page renders.
  useEffect(() => {
    if (!location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [location.hash, loading]);

  const listPath = `${location.pathname}${location.search}`;
  const pastLinks = isRestricted
    ? ARCHIVED_TAB_LINKS.filter((link) => (SCHOOL_STUDENT_TAB_IDS as readonly string[]).includes(link.id))
    : ARCHIVED_TAB_LINKS;

  const selectTopic = (topicId: string) => {
    if (!activeTab) return;
    const next = new URLSearchParams(searchParams);
    next.set('resource', activeTab.id);
    next.set('topic', topicId);
    setSearchParams(next, { replace: true });
  };

  const renderChip = (chip: { id: string; name: string; count: number }) => {
    const isActive = chip.id === activeTopicId;
    return (
      <button
        key={chip.id}
        type="button"
        onClick={() => selectTopic(chip.id)}
        className={`shrink-0 rounded-lg border px-4 py-2.5 text-left text-sm font-black transition ${
          isActive
            ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
            : 'border-sky-100 bg-sky-50 text-emerald-950 hover:border-emerald-200 hover:bg-white'
        }`}
      >
        {chip.name}
        <span className={`ml-2 text-xs ${isActive ? 'text-emerald-50' : 'text-slate-500'}`}>{chip.count}</span>
      </button>
    );
  };

  const pageCount = Math.max(1, Math.ceil(filteredPosts.length / RESOURCE_PAGE_SIZE));
  const pagePosts = filteredPosts.slice((currentPage - 1) * RESOURCE_PAGE_SIZE, currentPage * RESOURCE_PAGE_SIZE);

  return (
    <div>
      <SchoolWeekHero model={heroModel} sundayKey={sundayKey} isOverride={!!overrideKey} schoolName={identity.name} schoolNameEn={identity.nameEn} />
      <CurriculumProgress progress={progress} />
      <ClassChips classes={catalog.classes} value={classFilter} onChange={setClassFilter} />
      <ThisWeekMemory entry={memoryEntry} classFilter={classFilter} />
      <ThisWeekMaterials
        groups={weeklyGroups}
        loading={loading}
        guestNotice={isGuest ? '로그인하면 더 많은 자료를 확인할 수 있습니다.' : null}
      />

      {midSection}

      <section id="school-library" className="bg-white py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {allowedTabs.length === 0 || !activeTab ? (
            <div className="rounded-lg border border-dashed border-sky-200 bg-sky-50 px-6 py-12 text-center">
              <Lock className="mx-auto mb-4 h-10 w-10 text-sky-500" />
              <h3 className="text-xl font-black text-emerald-950">열람 가능한 자료가 없습니다</h3>
            </div>
          ) : (
            <>
              <div className="relative mb-8">
                <div
                  className="flex gap-1.5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:gap-2 sm:overflow-visible"
                  data-next-tour="resource-tabs"
                >
                  {allowedTabs.map((tab) => {
                    const isActive = tab.id === activeTab.id;
                    const isTabLocked = isGuest && tab.id !== guestTabId;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          if (isTabLocked) {
                            setAccessNotice('로그인하시면 이 자료를 확인하실 수 있습니다.');
                            return;
                          }
                          setAccessNotice(null);
                          const next = new URLSearchParams(searchParams);
                          next.set('resource', tab.id);
                          next.delete('topic');
                          setSearchParams(next, { replace: true });
                        }}
                        title={isTabLocked ? '로그인 후 이용할 수 있습니다' : undefined}
                        className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-black transition sm:px-4 sm:py-3 ${
                          isActive
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : isTabLocked
                            ? 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            : 'bg-sky-50 text-emerald-950 hover:bg-sky-100'
                        }`}
                      >
                        {isTabLocked ? <Lock size={16} /> : <Icon size={16} />}
                        {tab.name}
                      </button>
                    );
                  })}
                </div>
                <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-white to-transparent sm:hidden" />
              </div>

              {accessNotice && (
                <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                  {accessNotice}
                </div>
              )}

              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="flex items-center gap-3 text-2xl font-black tracking-normal text-emerald-950">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-200 text-emerald-950">
                      <activeTab.icon size={22} />
                    </span>
                    {activeTab.name}
                  </h2>
                  {activeTab.description && (
                    <p className="mt-3 text-base leading-7 text-slate-700">{activeTab.description}</p>
                  )}
                </div>
                {!isActiveLocked && (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                      className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-white px-4 py-3 text-sm font-bold text-emerald-950 transition hover:bg-sky-50"
                    >
                      {sortDir === 'asc' ? <ArrowDown01 size={16} /> : <ArrowUp10 size={16} />}
                      {sortDir === 'asc' ? '이름 오름차순' : '이름 내림차순'}
                    </button>
                    {isAdmin && (
                      <Link
                        to={
                          usesTopicFolders && activeTopicId
                            ? `${NEXT_GENERATION_PATH}/create?resource=${activeTab.id}&topic=${activeTopicId}`
                            : `${NEXT_GENERATION_PATH}/create?resource=${activeTab.id}`
                        }
                        className="inline-flex items-center justify-center rounded-lg bg-coral-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-coral-700"
                      >
                        <Plus size={18} className="mr-2" />
                        자료 올리기
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {isActiveLocked ? (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-6 py-10 text-center">
                  <Lock className="mx-auto mb-3 h-8 w-8 text-sky-400" />
                  <p className="text-sm font-bold text-emerald-950">로그인하면 이 자료를 확인할 수 있습니다.</p>
                </div>
              ) : (
                <>
                  {usesTopicFolders && allChips.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-black text-emerald-950">주제</h3>
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-2">{topicChips.current.map(renderChip)}</div>
                      {topicChips.past.length > 0 && (
                        <>
                          <h3 className="mt-3 text-sm font-black text-slate-500">지난 주제</h3>
                          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">{topicChips.past.map(renderChip)}</div>
                        </>
                      )}
                    </div>
                  )}

                  {error && (
                    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm font-bold text-red-700">
                      {error}
                    </div>
                  )}

                  {loading ? (
                    <div className="flex min-h-64 items-center justify-center">
                      <Loader2 className="h-10 w-10 animate-spin text-emerald-700" />
                    </div>
                  ) : filteredPosts.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-sky-200 bg-sky-50 p-10 text-center">
                      <CalendarDays className="mx-auto mb-4 h-12 w-12 text-sky-500" />
                      <h3 className="text-xl font-black text-emerald-950">아직 등록된 자료가 없습니다</h3>
                      <p className="mt-3 text-slate-700">
                        {usesTopicFolders && activeTopicId
                          ? `${getNextGenerationTopicLabel(activeTopicId, schoolTopics)} 주제 자료가 준비되면 이곳에 올라옵니다.`
                          : '자료가 준비되면 이곳에 올라옵니다.'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                        {pagePosts.map((post) => {
                          const attachmentCount =
                            typeof post.attachmentCount === 'number' ? post.attachmentCount : getPostAttachments(post).length;
                          return (
                            <article
                              key={post.id}
                              className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                            >
                              <Link
                                to={`${NEXT_GENERATION_PATH}/post/${post.id}`}
                                state={{ nextGenerationBackPath: listPath }}
                                className="block"
                              >
                                <div className="mb-4 flex flex-wrap gap-2">
                                  <span className="inline-flex rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-black text-emerald-950">
                                    {getResourceLabel(post.nextGenerationTabSlug || post.subCategory, allowedTabs as any)}
                                  </span>
                                  {usesTopicFolders && (
                                    <span className="inline-flex rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-black text-emerald-950">
                                      {getNextGenerationTopicLabel(inferNextGenerationTopicId(post, schoolTopics), schoolTopics)}
                                    </span>
                                  )}
                                  {post.isPublished === false && <UnpublishedBadge />}
                                </div>
                                <h3 className="line-clamp-2 text-xl font-black leading-7 tracking-normal text-emerald-950">
                                  {post.title}
                                </h3>
                                <p className="mt-3 line-clamp-3 min-h-16 text-sm leading-6 text-slate-700">
                                  {getContentPreview(post.content)}
                                </p>
                                <div className="mt-5 flex items-center justify-between gap-3 border-t border-sky-50 pt-4 text-sm text-slate-600">
                                  <span>{formatDate(post.createdAt)}</span>
                                  {attachmentCount > 0 && (
                                    <span className="inline-flex items-center gap-1 font-bold text-coral-700">
                                      <Download size={16} />
                                      자료 {attachmentCount}
                                    </span>
                                  )}
                                </div>
                              </Link>
                            </article>
                          );
                        })}
                      </div>
                      {pageCount > 1 && (
                        <div className="mt-8 flex items-center justify-between gap-4">
                          <p className="text-sm font-bold text-slate-500">
                            전체 {filteredPosts.length}개 중 {(currentPage - 1) * RESOURCE_PAGE_SIZE + 1}–
                            {Math.min(currentPage * RESOURCE_PAGE_SIZE, filteredPosts.length)}번째
                          </p>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setCurrentPage((p) => p - 1)}
                              disabled={currentPage === 1}
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-100 bg-white text-sm font-bold text-emerald-950 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="이전 페이지"
                            >
                              ‹
                            </button>
                            <span className="px-2 text-sm font-bold text-slate-600">
                              {currentPage} / {pageCount}
                            </span>
                            <button
                              type="button"
                              onClick={() => setCurrentPage((p) => p + 1)}
                              disabled={currentPage === pageCount}
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-100 bg-white text-sm font-bold text-emerald-950 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="다음 페이지"
                            >
                              ›
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {pastLinks.length > 0 && (
            <details className="group mt-12 rounded-lg border border-slate-200 bg-slate-50">
              <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-black text-slate-700">
                지난 자료 (2025–26)
                <ChevronDown size={18} className="transition group-open:rotate-180" />
              </summary>
              <ul className="space-y-2 border-t border-slate-200 px-5 py-4">
                {pastLinks.map((link) => (
                  <li key={link.id}>
                    <Link
                      to={`${NEXT_GENERATION_PATH}/elementary?resource=${link.id}`}
                      className="inline-flex items-center gap-2 text-sm font-bold text-emerald-800 hover:underline"
                    >
                      <FileText size={15} />
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </section>
    </div>
  );
}
