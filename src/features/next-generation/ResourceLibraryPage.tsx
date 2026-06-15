// Resource library page extracted from NextGeneration.tsx. Renders a
// department's tabbed material list (weekly groups, downloads, topic
// filters). Receives department-specific config via props.
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import {
  ArrowDown01,
  ArrowUp10,
  CalendarDays,
  Download,
  FileText,
  Loader2,
  Lock,
  Plus,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../lib/auth';
import {
  STUDENT_ACCESSIBLE_TAB_SLUGS,
  isRestrictedDepartment,
  useNextGenerationAuth,
} from '../../lib/nextGenerationAuth';
import {
  NEXT_GENERATION_PATH,
  getContentPreview,
  getCurrentSundayKey,
  getPostWeekKey,
  getResourceDepartmentPath,
  getResourceLabel,
} from '../../lib/nextGenerationResources';
import {
  NEXT_GENERATION_TOPIC_OPTIONS,
  NEXT_GENERATION_UNASSIGNED_TOPIC_ID,
  getNextGenerationTopicLabel,
  inferNextGenerationTopicId,
  supportsNextGenerationTopic,
} from '../../lib/nextGenerationTopics';
import { getPostAttachments } from '../../lib/attachments';
import { fruitWeekIdFromSundayKey } from '../word-fruit/api';
import FamilyWorshipSharePanel from '../word-fruit/FamilyWorshipSharePanel';
import { formatDate } from '../../lib/utils';
import { NextGenerationPost, ResourceTabItem } from './sharedConstants';

const NEXT_GENERATION_CATEGORY = 'next_generation';
const RESOURCE_PAGE_SIZE = 12;

interface ResourceLibraryPageProps {
  departmentSlug: string;
  departmentName: string;
  image: string;
  imageAlt: string;
  badgeClassName: string;
  heroClassName: string;
  title: string;
  description: React.ReactNode;
  tabs: ResourceTabItem[];
  midSection?: React.ReactNode;
  weeklyResourceIds?: string[];
  /** If set, non-members only see this one tab */
  guestTabId?: string;
  /** If set, non-members only see this many posts */
  guestPostLimit?: number;
}

export default function ResourceLibraryPage({
  departmentSlug,
  departmentName,
  image,
  imageAlt,
  badgeClassName,
  heroClassName,
  title,
  description,
  tabs,
  midSection,
  weeklyResourceIds = [],
  guestTabId,
  guestPostLimit,
}: ResourceLibraryPageProps) {
  const { role, loading: authLoading } = useAuth();
  const { user: ngUser, member } = useNextGenerationAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  // Restricted departments (e.g. 학생) only see the workbook tab; other tabs are hidden entirely.
  const isRestricted = departmentSlug === 'elementary' && isRestrictedDepartment(member?.department);
  const allowedTabs = isRestricted
    ? tabs.filter((tab) => (STUDENT_ACCESSIBLE_TAB_SLUGS as readonly string[]).includes(tab.id))
    : tabs;
  const fallbackTab = allowedTabs[0] || tabs[0];
  const rawActiveResource = searchParams.get('resource') || fallbackTab?.id;
  // Tab/post restrictions apply only to unauthenticated visitors (pending/rejected users see everything)
  const isGuest = !ngUser;
  const restrictedActiveResource = isRestricted
    ? (allowedTabs.some((tab) => tab.id === rawActiveResource) ? rawActiveResource : fallbackTab?.id)
    : rawActiveResource;
  const activeResource = (isGuest && guestTabId) ? guestTabId : restrictedActiveResource;
  // Always show all tabs so guests can see what's behind login; non-free tabs are rendered as locked
  const visibleTabs = allowedTabs;
  const requestedTopic = searchParams.get('topic');
  const [posts, setPosts] = useState<NextGenerationPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  const isAdmin = !authLoading && role === 'admin';
  const activeTab = visibleTabs.find((tab) => tab.id === activeResource) || visibleTabs[0] || fallbackTab || {
    id: '',
    slug: '',
    name: '',
    description: '',
    icon: FileText,
    departmentSlug,
  };
  const isWeeklyTab = !!activeTab.isWeeklyGroup;
  const isFamilyWorshipTab = activeTab.id === 'family_worship';
  const usesTopicFolders = !isWeeklyTab && (!!activeTab.useTopic || supportsNextGenerationTopic(activeTab.id));
  const currentWeekKey = useMemo(() => getCurrentSundayKey(), []);
  const ActiveIcon = activeTab.icon;
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const listPath = `${location.pathname}${location.search}`;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab.id, sortDir]);

  useEffect(() => {
    const fetchPosts = async () => {
      if (!activeTab.id) {
        setPosts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const constraints = [where('category', '==', NEXT_GENERATION_CATEGORY)];
        const q = query(collection(db, 'posts'), ...constraints, orderBy('createdAt', 'desc'), limit(300));
        const snapshot = await getDocs(q);
        const raw = snapshot.docs
          .map((postDoc) => ({ id: postDoc.id, ...(postDoc.data() as object) }) as NextGenerationPost);
        const data = raw.filter((post) => {
          if (post.isArchived === true) return false;
          const postDepartmentSlug = post.nextGenerationDepartmentSlug || getResourceDepartmentPath(post.subCategory).replace(`${NEXT_GENERATION_PATH}/`, '');
          if (postDepartmentSlug !== departmentSlug) return false;
          const postTabSlug = post.nextGenerationTabSlug || post.subCategory;
          if (isWeeklyTab) {
            return weeklyResourceIds.includes(postTabSlug || '');
          }
          return postTabSlug === activeTab.id;
        });
        setPosts(data);
      } catch (err: any) {
        console.error('Error fetching next generation posts:', err);
        setError('자료를 불러오는 중 오류가 발생했습니다.');
        try {
          handleFirestoreError(err, OperationType.GET, 'posts');
        } catch (e) {}
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [activeTab.id, departmentSlug, isWeeklyTab, weeklyResourceIds]);

  const topicOptions = useMemo(() => {
    if (!usesTopicFolders) return [];

    const inferredTopics = new Set(posts.map((post) => inferNextGenerationTopicId(post)));
    const baseTopics = NEXT_GENERATION_TOPIC_OPTIONS.filter((topic) => inferredTopics.has(topic.id));
    const needsUnassigned = inferredTopics.has(NEXT_GENERATION_UNASSIGNED_TOPIC_ID);

    if (baseTopics.length === 0) {
      return NEXT_GENERATION_TOPIC_OPTIONS;
    }

    return needsUnassigned
      ? [...baseTopics, { id: NEXT_GENERATION_UNASSIGNED_TOPIC_ID, name: '기타', keywords: [] }]
      : baseTopics;
  }, [posts, usesTopicFolders]);

  const activeTopicId = useMemo(() => {
    if (!usesTopicFolders) return null;

    if (requestedTopic && topicOptions.some((topic) => topic.id === requestedTopic)) {
      return requestedTopic;
    }

    return topicOptions[0]?.id || NEXT_GENERATION_TOPIC_OPTIONS[0].id;
  }, [requestedTopic, topicOptions, usesTopicFolders]);

  const topicCounts = useMemo(() => {
    if (!usesTopicFolders) return new Map<string, number>();

    return posts.reduce((counts, post) => {
      const topicId = inferNextGenerationTopicId(post);
      counts.set(topicId, (counts.get(topicId) || 0) + 1);
      return counts;
    }, new Map<string, number>());
  }, [posts, usesTopicFolders]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTopicId]);

  const filteredPosts = useMemo(() => {
    const byName = (a: NextGenerationPost, b: NextGenerationPost) => {
      const titleA = (a.title || '').trim();
      const titleB = (b.title || '').trim();
      const cmp = titleA.localeCompare(titleB, 'ko', { numeric: true, sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    };

    if (isWeeklyTab) {
      return weeklyResourceIds.flatMap((resourceId) => {
        const resourcePosts = posts.filter((post) => (post.nextGenerationTabSlug || post.subCategory) === resourceId);
        const weeklyPosts = resourcePosts.filter((post) => getPostWeekKey(post) === currentWeekKey);

        return weeklyPosts.length > 0 ? weeklyPosts : resourcePosts.slice(0, 1);
      });
    }

    if (usesTopicFolders && activeTopicId) {
      return posts
        .filter((post) => inferNextGenerationTopicId(post) === activeTopicId)
        .sort(byName);
    }

    return [...posts].sort(byName);
  }, [posts, activeTopicId, currentWeekKey, isWeeklyTab, usesTopicFolders, sortDir, weeklyResourceIds]);

  if (visibleTabs.length === 0) {
    return (
      <div>
        <section className={heroClassName}>
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
            <img src={image} alt={imageAlt} className="h-72 w-full rounded-lg object-cover shadow-sm" />
            <div>
              <span className={`mb-4 inline-flex rounded-lg px-3 py-2 text-sm font-black ${badgeClassName}`}>{departmentName}</span>
              <h1 className="text-4xl font-black leading-tight tracking-normal text-emerald-950">{title}</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">{description}</p>
            </div>
          </div>
        </section>
        <section className="bg-white py-16">
          <div className="mx-auto max-w-3xl rounded-lg border border-dashed border-sky-200 bg-sky-50 px-6 py-12 text-center">
            <Lock className="mx-auto mb-4 h-10 w-10 text-sky-500" />
            <h3 className="text-xl font-black text-emerald-950">이 부서에는 열람 가능한 자료가 없습니다</h3>
            <p className="mt-3 text-sm font-bold text-slate-600">
              현재 회원 등급(학생)은 공과 자료만 확인할 수 있습니다. 유초등부 페이지에서 공과 자료를 확인해 주세요.
            </p>
            <Link to={`${NEXT_GENERATION_PATH}/elementary`} className="mt-5 inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">
              유초등부로 이동
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div>
      <section className={heroClassName}>
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
          <img
            src={image}
            alt={imageAlt}
            className="h-72 w-full rounded-lg object-cover shadow-sm"
          />
          <div>
            <span className={`mb-4 inline-flex rounded-lg px-3 py-2 text-sm font-black ${badgeClassName}`}>
              {departmentName}
            </span>
            <h1 className="text-4xl font-black leading-tight tracking-normal text-emerald-950">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
              {description}
            </p>
          </div>
        </div>
      </section>

      {midSection}

      <section className="bg-white py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative mb-8">
            <div
              className="flex gap-1.5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2"
              data-next-tour="resource-tabs"
            >
            {visibleTabs.map((tab) => {
              const isActive = tab.id === activeTab.id;
              const isTabLocked = isGuest && !!guestTabId && tab.id !== guestTabId;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (isTabLocked) {
                      setAccessNotice('\uB85C\uADF8\uC778\uD558\uC2DC\uBA74 \uC774 \uC790\uB8CC\uB97C \uD655\uC778\uD558\uC2E4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');
                      return;
                    }
                    setAccessNotice(null);
                    const next = new URLSearchParams(searchParams);
                    next.set('resource', tab.id);
                    next.delete('topic');
                    setSearchParams(next, { replace: true });
                  }}
                  title={isTabLocked ? '로그인 후 이용할 수 있습니다' : undefined}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-black transition min-h-[44px] sm:gap-2 sm:px-4 sm:py-3 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : isTabLocked
                      ? 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      : 'bg-sky-50 text-emerald-950 hover:bg-sky-100'
                  }`}
                >
                  {isTabLocked ? <Lock size={16} className="sm:hidden" /> : <Icon size={16} className="sm:hidden" />}
                  {isTabLocked ? <Lock size={18} className="hidden sm:block" /> : <Icon size={18} className="hidden sm:block" />}
                  {tab.name}
                </button>
              );
            })}
            </div>
            {/* 모바일에서 오른쪽 끝 스크롤 힌트 그라데이션 */}
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
                  <ActiveIcon size={22} />
                </span>
                {activeTab.name}
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-700">{activeTab.description}</p>
              {isWeeklyTab && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-emerald-700">
                    기준 주일: {currentWeekKey}
                  </p>
                  {departmentSlug === 'elementary' && currentWeekKey && (
                    <Link
                      to={`${NEXT_GENERATION_PATH}/elementary?highlight=word-fruit&wfWeekId=${fruitWeekIdFromSundayKey(currentWeekKey)}`}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                    >
                      <Sparkles size={12} /> 이번 주 말씀 열매 열기
                    </Link>
                  )}
                </div>
              )}
              {usesTopicFolders && activeTopicId && (
                <p className="mt-2 text-sm font-bold text-emerald-700">
                  선택한 주제: {getNextGenerationTopicLabel(activeTopicId)}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {!isWeeklyTab && (
                <button
                  type="button"
                  onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                  className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-white px-4 py-3 text-sm font-bold text-emerald-950 transition hover:bg-sky-50"
                >
                  {sortDir === 'asc' ? <ArrowDown01 size={16} /> : <ArrowUp10 size={16} />}
                  {sortDir === 'asc' ? '이름 오름차순' : '이름 내림차순'}
                </button>
              )}
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
          </div>

          {usesTopicFolders && topicOptions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-black text-emerald-950">주제 폴더</h3>
              <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                {topicOptions.map((topic) => {
                  const isActive = topic.id === activeTopicId;
                  const count = topicCounts.get(topic.id) || 0;

                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => {
                        const next = new URLSearchParams(searchParams);
                        next.set('resource', activeTab.id);
                        next.set('topic', topic.id);
                        setSearchParams(next, { replace: true });
                      }}
                      className={`min-w-[120px] rounded-lg border px-4 py-4 text-left transition sm:min-w-[150px] ${
                        isActive
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                          : 'border-sky-100 bg-sky-50 text-emerald-950 hover:border-emerald-200 hover:bg-white'
                      }`}
                    >
                      <div className="text-sm font-black">{topic.name}</div>
                      <div className={`mt-2 text-xs font-bold ${isActive ? 'text-emerald-50' : 'text-slate-500'}`}>
                        자료 {count}
                      </div>
                    </button>
                  );
                })}
              </div>
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
                  ? `${getNextGenerationTopicLabel(activeTopicId)} 주제 자료가 준비되면 이곳에 올라옵니다.`
                  : '이번 주 자료가 준비되면 이곳에 올라옵니다.'}
              </p>
            </div>
          ) : (
            <>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {((isGuest && guestPostLimit) ? filteredPosts.slice(0, guestPostLimit) : filteredPosts.slice((currentPage - 1) * RESOURCE_PAGE_SIZE, currentPage * RESOURCE_PAGE_SIZE)).map((post, index) => {
                // attachmentCount is the non-sensitive count stored on the post doc for new posts.
                // getPostAttachments(post) is the legacy fallback for posts that still have inline attachments.
                const attachmentCount = typeof post.attachmentCount === 'number'
                  ? post.attachmentCount
                  : getPostAttachments(post).length;

                return (
                  <motion.article
                    key={post.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.04, 0.25) }}
                    className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <Link
                      to={`${NEXT_GENERATION_PATH}/post/${post.id}`}
                      state={{ nextGenerationBackPath: listPath }}
                      className="block"
                    >
                      <div className="mb-4 flex flex-wrap gap-2">
                        <span className="inline-flex rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-black text-emerald-950">
                          {getResourceLabel(post.nextGenerationTabSlug || post.subCategory, visibleTabs as any)}
                        </span>
                        {supportsNextGenerationTopic(post.subCategory) && (
                          <span className="inline-flex rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-black text-emerald-950">
                            {getNextGenerationTopicLabel(inferNextGenerationTopicId(post))}
                          </span>
                        )}
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
                  </motion.article>
                );
              })}
            </div>
            {isGuest && guestPostLimit && filteredPosts.length > guestPostLimit && (
              <div className="mt-6 rounded-xl border border-sky-200 bg-sky-50 px-6 py-8 text-center">
                <Lock className="mx-auto mb-3 h-8 w-8 text-sky-400" />
                <p className="text-sm font-bold text-emerald-950">
                  {filteredPosts.length - guestPostLimit}개의 자료가 더 있습니다.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  로그인하면 전체 {filteredPosts.length}개 자료를 모두 열람할 수 있습니다.
                </p>
              </div>
            )}
            </>
          )}

          {!loading && (!isGuest || !guestPostLimit) && filteredPosts.length > RESOURCE_PAGE_SIZE && (() => {
            const totalPages = Math.ceil(filteredPosts.length / RESOURCE_PAGE_SIZE);
            const pageNumbers: (number | 'ellipsis')[] = [];

            if (totalPages <= 7) {
              for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
            } else {
              pageNumbers.push(1);
              if (currentPage > 3) pageNumbers.push('ellipsis');
              for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                pageNumbers.push(i);
              }
              if (currentPage < totalPages - 2) pageNumbers.push('ellipsis');
              pageNumbers.push(totalPages);
            }

            return (
              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-bold text-slate-500">
                  전체 {filteredPosts.length}개 중 {(currentPage - 1) * RESOURCE_PAGE_SIZE + 1}–{Math.min(currentPage * RESOURCE_PAGE_SIZE, filteredPosts.length)}번째
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
                  {pageNumbers.map((page, idx) =>
                    page === 'ellipsis' ? (
                      <span key={`ellipsis-${idx}`} className="flex h-9 w-9 items-center justify-center text-sm text-slate-400">
                        …
                      </span>
                    ) : (
                      <button
                        key={`page-${page}`}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-bold transition ${
                          page === currentPage
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-sky-100 bg-white text-emerald-950 hover:bg-sky-50'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={currentPage === totalPages}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-100 bg-white text-sm font-bold text-emerald-950 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="다음 페이지"
                  >
                    ›
                  </button>
                </div>
              </div>
            );
          })()}

          {!loading && isFamilyWorshipTab && (
            <FamilyWorshipSharePanel weekKey={currentWeekKey} />
          )}
        </div>
      </section>
    </div>
  );
}
