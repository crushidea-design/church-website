import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import {
  ArrowDown01,
  ArrowLeft,
  ArrowUp10,
  Bell,
  BookMarked,
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Edit3,
  FileText,
  HeartHandshake,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  MessageSquare,
  Plus,
  Settings,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { db, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { isRestrictedDepartment, NextGenerationAuthProvider, NEXT_GENERATION_DEPARTMENTS, STUDENT_ACCESSIBLE_TAB_SLUGS, useNextGenerationAuth } from '../lib/nextGenerationAuth';
import NextGenerationLoginModal from './NextGenerationLoginModal';
import NextGenerationAdmin from './NextGenerationAdmin';
import NextGenerationContact from './NextGenerationContact';
import NextGenerationQA from './NextGenerationQA';
import BibleReadingChart from './BibleReadingChart';
import NextGenerationTodayWord from './NextGenerationTodayWord';
import NextGenerationHighlightBand, { HighlightEntry } from '../components/NextGenerationHighlightBand';
import { BookOpen, HelpCircle, Library } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { generateSortOrder } from '../lib/sortUtils';
import {
  getNextGenerationTopicLabel,
  inferNextGenerationTopicId,
  NEXT_GENERATION_TOPIC_OPTIONS,
  NEXT_GENERATION_UNASSIGNED_TOPIC_ID,
  supportsNextGenerationTopic,
} from '../lib/nextGenerationTopics';
import PdfCanvasViewer from '../components/PdfCanvasViewer';
import EditPost from './EditPost';
import {
  formatFileSize,
  getFirstPdfAttachment,
  getMaterialAttachmentLabel,
  getPostAttachments,
  MATERIAL_FILE_ACCEPT,
  MaterialAttachment,
  serializeMaterialAttachments,
  uploadMaterialFiles,
  validateMaterialFiles,
} from '../lib/attachments';
import {
  NextGenerationCmsProvider,
  NextGenerationDepartment,
  NextGenerationIntroSection,
  NextGenerationResourceTab,
  useNextGenerationCms,
} from '../lib/nextGenerationCms';
import { initializeNextGenerationBadgeSync, setNextGenerationBadgeCount } from '../services/appBadgeService';
import {
  NEXT_GENERATION_NOTIFICATION_TOPIC,
  onMessageListener,
  requestNotificationPermission,
} from '../services/notificationService';

const NEXT_GENERATION_CATEGORY = 'next_generation';
const NEXT_GENERATION_PATH = '/next';
const RESOURCE_PAGE_SIZE = 12;

const introImage = '/elementary-intro.png';
const elementaryImage = '/next-generation-2026.png';
const youngAdultsIntroImage = '/young-adults-intro.png';
const youngAdultsImage = '/young-adults-pilgrims-progress.png';

const elementaryWeeklyResourceIds = [
  'elementary_script',
  'elementary_workbook',
  'elementary_guide',
  'family_column',
];

const elementaryResourceTabs = [
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
    id: 'summer_bible_school',
    name: '여름성경학교',
    description: '여름성경학교 준비와 진행 자료를 함께 모읍니다.',
    icon: Sparkles,
  },
];

const youngAdultResourceTabs = [
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

const allResourceTabs = [...elementaryResourceTabs, ...youngAdultResourceTabs];
const elementaryWeeklyResourceTabs = elementaryResourceTabs.filter((tab) => elementaryWeeklyResourceIds.includes(tab.id));

const isElementaryWeeklyResource = (id?: string) => {
  return !!id && elementaryWeeklyResourceIds.includes(id);
};

const sectionTabs = [
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

interface NextGenerationPost {
  id: string;
  title?: string;
  content?: string;
  subCategory?: string;
  nextGenerationTopicId?: string;
  authorName?: string;
  createdAt?: any;
  updatedAt?: any;
  pdfUrl?: string;
  pdfName?: string;
  attachments?: MaterialAttachment[];
  category?: string;
  [key: string]: any;
}

interface ResourceTabItem {
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

interface DepartmentCardItem {
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

const iconMap: Record<string, React.ComponentType<any>> = {
  CalendarDays,
  FileText,
  BookMarked,
  ClipboardList,
  HeartHandshake,
  Sparkles,
  Users,
};

const getYouTubeVideoId = (url: string): string | null => {
  const match = url.match(/(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([^&\n?#]+)/);
  return match ? match[1] : null;
};

const getCreatedAtTime = (value: any) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getSundayDate = (baseDate = new Date()) => {
  const date = new Date(baseDate);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + ((7 - date.getDay()) % 7));
  return date;
};

const getCurrentSundayKey = () => toLocalDateKey(getSundayDate());

const getPostWeekKey = (post: NextGenerationPost) => {
  if (typeof post.nextGenerationWeekKey === 'string' && post.nextGenerationWeekKey) {
    return post.nextGenerationWeekKey;
  }

  const createdAtTime = getCreatedAtTime(post.createdAt);
  if (!createdAtTime) return '';
  return toLocalDateKey(getSundayDate(new Date(createdAtTime)));
};

const getRejectedNoticeVersion = (member: any) => {
  if (!member) return '';
  if (typeof member.rejectedAt?.toMillis === 'function') {
    return String(member.rejectedAt.toMillis());
  }
  if (member.rejectionReason) {
    return String(member.rejectionReason);
  }
  return 'rejected';
};

const getPostPrimarySortTime = (post: NextGenerationPost): number => {
  if (typeof post.nextGenerationWeekKey === 'string' && post.nextGenerationWeekKey) {
    return new Date(post.nextGenerationWeekKey).getTime();
  }
  return getCreatedAtTime(post.createdAt);
};

const getResourceLabel = (id?: string, tabs: ResourceTabItem[] = allResourceTabs as any) => {
  return tabs.find((tab) => tab.id === id || tab.slug === id)?.name || '다음세대 자료';
};

const getResourceDepartmentPath = (
  id?: string,
  tabs: ResourceTabItem[] = allResourceTabs as any,
  departments: DepartmentCardItem[] = sectionTabs as any
) => {
  const foundTab = tabs.find((tab) => tab.id === id || tab.slug === id);
  const fallbackSlug = youngAdultResourceTabs.some((tab) => (tab as any).id === id) ? 'young-adults' : 'elementary';
  const departmentSlug = foundTab?.departmentSlug || fallbackSlug || departments[0]?.slug || 'elementary';
  return `${NEXT_GENERATION_PATH}/${departmentSlug}`;
};

const getResourceTab = (id?: string, tabs: ResourceTabItem[] = allResourceTabs as any) => {
  return tabs.find((tab) => tab.id === id || tab.slug === id) || tabs[0] || (elementaryResourceTabs[0] as any);
};

const getContentPreview = (content?: string) => {
  if (!content) return '함께 확인할 자료가 준비되어 있습니다.';
  return content.replace(/\s+/g, ' ').trim().slice(0, 110);
};

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

function NextGenerationHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user, member, loading: authLoading, isPastor, isMember, isPending, isRejected,
    hasAccess, needsSignUp, notifications, unreadCount, markNotificationRead, signOut,
  } = useNextGenerationAuth();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');
  const [enablingNotifications, setEnablingNotifications] = useState(false);

  // 종 버튼: 최초 1회 권한 요청, 이후에는 알림함 토글
  // 토픽 구독은 정식 회원(hasAccess)일 때만, 반려/대기는 토큰만 등록
  const handleBellClick = async () => {
    if (!user) return;

    if (notificationPermission === 'default') {
      setEnablingNotifications(true);
      try {
        const token = await requestNotificationPermission(
          user.uid,
          hasAccess ? { topic: NEXT_GENERATION_NOTIFICATION_TOPIC } : undefined
        );
        const currentPermission =
          typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
        setNotificationPermission(currentPermission as 'default' | 'granted' | 'denied' | 'unsupported');
        if (!token && currentPermission === 'denied') {
          window.alert('브라우저 설정에서 알림 권한을 허용해 주세요.');
        }
      } finally {
        setEnablingNotifications(false);
      }
      return;
    }

    setShowNotifications(v => !v);
    notifications.filter(n => !n.isRead).forEach(n => markNotificationRead(n.id));
  };

  const navItems = [
    { name: '다음세대 소개', path: NEXT_GENERATION_PATH },
    { name: '유초등부', path: `${NEXT_GENERATION_PATH}/elementary` },
    { name: '청년부', path: `${NEXT_GENERATION_PATH}/young-adults` },
    { name: '문의하기', path: `${NEXT_GENERATION_PATH}/contact` },
  ];

  // Show login modal when needsSignUp triggers (Google sign-in new user)
  useEffect(() => {
    if (needsSignUp) setShowLoginModal(true);
  }, [needsSignUp]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }

    setNotificationPermission(Notification.permission);
  }, [user]);

  useEffect(() => {
    if (!isRejected || !user) {
      return;
    }

    const rejectedVersion = getRejectedNoticeVersion(member);
    const storageKey = `next_generation_rejected_notice_seen_${user.uid}`;

    try {
      const alreadySeenVersion = localStorage.getItem(storageKey);
      if (alreadySeenVersion === rejectedVersion) {
        return;
      }

      localStorage.setItem(storageKey, rejectedVersion);
      setShowLoginModal(true);
    } catch (error) {
      console.warn('Unable to persist rejected notice state:', error);
      setShowLoginModal(true);
    }
  }, [isRejected, member, user]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:px-6 sm:gap-3 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-4">
          <div className="flex items-center justify-between gap-4">
            <Link to={NEXT_GENERATION_PATH} className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-amber-100 shadow-sm">
                <img src="/next-generation-favicon.svg" alt="" className="h-12 w-12" />
              </span>
              <span className="flex w-[160px] flex-col sm:w-[198px]">
                <span className="flex justify-between text-lg font-black leading-tight tracking-normal text-emerald-950">
                  {Array.from('한우리교회 다음세대').map((char, index) => (
                    <span key={`${char}-${index}`} className={char === ' ' ? 'w-2' : ''}>
                      {char}
                    </span>
                  ))}
                </span>
                <span className="mt-1 flex justify-between text-[10px] font-bold uppercase leading-none text-coral-700 sm:hidden">
                  <span>GROWING</span>
                  <span>IN</span>
                  <span>THE</span>
                  <span>COVENANT</span>
                </span>
                <span className="mt-1 hidden justify-between text-xs font-bold uppercase leading-none tracking-normal text-coral-700 sm:flex">
                  {Array.from('GROWING IN THE COVENANT').map((char, index) => (
                    <span key={`${char}-${index}`} className={char === ' ' ? 'w-1.5' : ''}>
                      {char}
                    </span>
                  ))}
                </span>
              </span>
            </Link>

            {/* Auth controls (mobile: inline with logo) */}
            <div className="flex items-center gap-2 lg:hidden">
              {!authLoading && !user && (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-bold text-white hover:bg-amber-600 transition"
                >
                  <LogIn size={15} /> 로그인
                </button>
              )}
              {!authLoading && isPastor && (
                <>
                  <button
                    onClick={() => setShowAdminModal(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-800 hover:bg-amber-200 transition"
                  >
                    <Settings size={14} />
                  </button>
                  <button
                    onClick={() => signOut()}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                  >
                    <LogOut size={14} />
                  </button>
                </>
              )}
              {!authLoading && user && !isPastor && (
                <>
                  <button
                    onClick={() => navigate(`${NEXT_GENERATION_PATH}/me`)}
                    className="relative flex h-9 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-xs font-black text-emerald-900 hover:bg-emerald-100 transition"
                  >
                    <span>{member?.department || '내 역할'}</span>
                    <Bell size={14} />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => signOut()}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                  >
                    <LogOut size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <nav className="flex gap-2 overflow-x-auto pb-1 lg:pb-0" aria-label="다음세대">
              {navItems.map((item) => {
                const isActive =
                  item.path === NEXT_GENERATION_PATH
                    ? location.pathname === item.path
                    : location.pathname.startsWith(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold transition ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Auth controls (desktop) */}
            <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
              {!authLoading && !user && (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-white hover:bg-amber-600 transition"
                >
                  <LogIn size={15} /> 로그인
                </button>
              )}
              {!authLoading && isPastor && (
                <>
                  <button
                    onClick={() => setShowAdminModal(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-2 text-sm font-bold text-amber-800 hover:bg-amber-200 transition"
                  >
                    <Settings size={14} /> 관리
                  </button>
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition"
                  >
                    <LogOut size={14} />
                  </button>
                </>
              )}
              {!authLoading && user && !isPastor && (
                <>
                  <button
                    onClick={() => navigate(`${NEXT_GENERATION_PATH}/me`)}
                    className="relative flex h-9 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-sm font-black text-emerald-900 hover:bg-emerald-100 transition"
                  >
                    <span>{member?.department || '내 역할'}</span>
                    <Bell size={15} />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  {member && (
                    <span className="text-xs font-bold text-gray-600 max-w-[80px] truncate">
                      {member.displayName}
                      {isPending && <span className="ml-1 text-amber-500">(대기)</span>}
                    </span>
                  )}
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 transition"
                  >
                    <LogOut size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Shared notification dropdown — rendered outside breakpoint blocks so it works on mobile too */}
      {showNotifications && user && !isPastor && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setShowNotifications(false)}
        >
          <div
            className="absolute right-4 top-20 z-40 w-72 rounded-xl border border-gray-200 bg-white shadow-xl sm:right-6 lg:right-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <p className="text-sm font-bold text-gray-900">알림</p>
              <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">알림이 없습니다.</p>
            ) : (
              <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                {notifications.map(n => (
                  <li
                    key={n.id}
                    onClick={() => markNotificationRead(n.id)}
                    className={`cursor-pointer px-4 py-3 text-sm transition hover:bg-gray-50 ${!n.isRead ? 'bg-amber-50' : ''}`}
                  >
                    <p className={`font-medium ${
                      n.type === 'approved' ? 'text-emerald-700'
                      : n.type === 'answered' ? 'text-amber-600'
                      : n.type === 'announcement' ? 'text-blue-700'
                      : 'text-red-600'
                    }`}>
                      {n.type === 'approved' && '✓ 가입 승인됨'}
                      {n.type === 'rejected' && '✗ 가입 반려됨'}
                      {n.type === 'answered' && '💬 질문 답변 도착'}
                      {n.type === 'announcement' && '📢 공지'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                    {n.rejectionReason && (
                      <p className="text-xs text-red-500 mt-0.5">사유: {n.rejectionReason}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {showLoginModal && (
        <NextGenerationLoginModal
          onClose={() => setShowLoginModal(false)}
          initialView={isRejected ? 'rejected' : isPending ? 'pending' : needsSignUp ? 'complete_google' : 'login'}
        />
      )}
      {showAdminModal && <NextGenerationAdmin onClose={() => setShowAdminModal(false)} />}
    </>
  );
}

function IntroPage({
  sections,
  departments,
}: {
  sections?: NextGenerationIntroSection[];
  departments?: DepartmentCardItem[];
}) {
  const departmentCards = (departments && departments.length > 0) ? departments : (sectionTabs as any);
  const cmsIntroSections = (sections || [])
    .filter((section) => section.isVisible)
    .sort((a, b) => a.order - b.order);
  const introPillars = [
    {
      title: '예배 중심 교육',
      paragraphs: [
        '다음세대 교육의 중심은 전세대가 함께 드리는 언약 공동체의 예배입니다. 주일 오전 10시에 모여 11시 공예배로 자연스럽게 이어지도록 구성하며, 이 시간은 단순한 사전 모임이 아니라 예배를 준비하고 연결하는 교육의 자리입니다. 모임 가운데서는 예배에서 부를 시편 찬송을 미리 배우고, 말씀을 들을 마음을 준비하며 예배자로 서는 훈련을 합니다.',
        '아이들은 공예배 설교를 듣고 설교노트를 작성하며, 교역자의 확인과 코멘트를 통해 말씀을 더 정확히 이해하도록 돕습니다. 유치부는 본문을 반영한 색칠 도안을 활용하고, “말씀 중 특정 단어가 나오면 표시하기”, “정해진 시간 집중해서 듣기”와 같은 예배 미션을 통해 예배에 능동적으로 참여합니다. 이를 통해 아이들은 예배를 단순히 버티는 시간이 아니라, 하나님 앞에 서는 예배자로 훈련받는 시간으로 경험하게 됩니다.',
      ],
      gallery: [
        { src: '/next-generation/pillars/worship/worship-note-kindergarten-1.jpg', alt: '유치부 설교노트 예시 1' },
        { src: '/next-generation/pillars/worship/worship-note-kindergarten-2.jpg', alt: '유치부 설교노트 예시 2' },
        { src: '/next-generation/pillars/worship/worship-note-kindergarten-3.jpg', alt: '유치부 설교노트 예시 3' },
        { src: '/next-generation/pillars/worship/worship-note-elementary-1.jpg', alt: '초등부 설교노트 예시 1' },
        { src: '/next-generation/pillars/worship/worship-note-elementary-2.jpg', alt: '초등부 설교노트 예시 2' },
      ],
    },
    {
      title: '가정과 동행',
      paragraphs: [
        '교회는 가정을 대신하지 않고, 부모와 함께 다음세대의 신앙을 세워가는 동역자로 서고자 합니다. 주일에 배우는 말씀은 교회에서 끝나지 않고 가정으로 이어지도록 구성되어, 부모와 자녀가 한 주간 동일한 말씀 안에서 대화하고 실천할 수 있도록 돕습니다.',
        '이를 위해 매주 ‘예배를 잇는 가정’ 자료를 제공하여, 강의의 핵심을 가정에서 다시 나누고 적용할 수 있도록 안내합니다. 부모가 자녀에게 말씀을 설명하고 함께 기도할 수 있도록 돕는 질문과 실천 과제가 포함되며, 추후 가정예배가 자연스럽게 이루어지도록 돕습니다.',
        '우리는 부모가 신앙교육의 첫 번째 책임자라는 성경적 원리를 따라, 교회 교육이 가정을 지원하고 세워가는 구조를 지향합니다. 이를 통해 아이들은 교회와 가정이 분리되지 않고 하나의 흐름 안에서 하나님을 배우며 자라가게 됩니다.',
      ],
      gallery: [
        { src: '/next-generation/pillars/family/family-worship-guide-1-1.jpg', alt: '예배를 잇는 가정 1호 예시 1' },
        { src: '/next-generation/pillars/family/family-worship-guide-1-2.jpg', alt: '예배를 잇는 가정 1호 예시 2' },
        { src: '/next-generation/pillars/family/family-worship-guide-2-1.jpg', alt: '예배를 잇는 가정 2호 예시 1' },
        { src: '/next-generation/pillars/family/family-worship-guide-2-2.jpg', alt: '예배를 잇는 가정 2호 예시 2' },
      ],
    },
    {
      title: '성경과 교리',
      paragraphs: [
        '성경은 하나님께서 주신 말씀으로, 우리를 가르치고 바르게 하며 하나님 앞에서 살아가도록 이끕니다. 한우리교회 다음세대는 이 말씀 위에 굳게 서도록 돕고, 그 내용을 체계적으로 정리한 교리 교육을 통해 무엇을 믿어야 하는지 분명히 배우게 합니다. 단편적인 성경 지식이 아니라, 말씀 전체를 바르게 이해하고 삶에 적용할 수 있는 신앙의 틀을 세우는 것이 목표입니다.',
        '이를 위해 성경과 교리를 함께 배우는 커리큘럼을 구성하여, 아이들이 자연스럽게 신앙의 내용을 쌓아가도록 합니다.',
        '이 과정을 통해 아이들은 성경 위에 서고, 교리를 통해 정리하며, 삶으로 이어지는 신앙을 갖게 됩니다.',
        '지금은 2025년 여름부터 예배에 대한 주제를 살피는 가운데 사도신경을 지나 십계명을 공부하고 있습니다.',
      ],
      highlights: [
        '성경: 성경 전체의 흐름을 따라 주요 본문을 배우며, 하나님의 구속사를 이해합니다.',
        '교리: 웨스트민스터 소요리문답을 중심으로, 믿어야 할 내용을 체계적으로 익힙니다.',
        '예배 이해: 공예배의 순서와 의미를 배우며, 하나님 중심의 예배를 익힙니다.',
        '삶의 적용: 배운 말씀과 교리를 실제 삶 속에서 어떻게 살아낼지 구체적으로 나눕니다.',
      ],
      gallery: [
        { src: '/next-generation/pillars/curriculum/curriculum-benefit-of-scripture-1.jpg', alt: '공과 성경의 유익 예시 1' },
        { src: '/next-generation/pillars/curriculum/curriculum-benefit-of-scripture-2.jpg', alt: '공과 성경의 유익 예시 2' },
        { src: '/next-generation/pillars/curriculum/curriculum-before-god-1.jpg', alt: '공과 하나님 앞에서 예시 1' },
        { src: '/next-generation/pillars/curriculum/curriculum-before-god-2.jpg', alt: '공과 하나님 앞에서 예시 2' },
        { src: '/next-generation/pillars/curriculum/curriculum-power-of-scripture-1.jpg', alt: '공과 성경의 능력 예시 1' },
        { src: '/next-generation/pillars/curriculum/curriculum-power-of-scripture-2.jpg', alt: '공과 성경의 능력 예시 2' },
      ],
    },
  ];
  const [activePillar, setActivePillar] = useState<string | null>(null);
  const selectedPillar = introPillars.find((pillar) => pillar.title === activePillar);
  const youngAdultIntroPillars = [
    {
      title: '교리 교육',
      paragraphs: [
        '청년 1부는 천로역정을 중심으로 교리 교육을 진행합니다.',
        '주인공의 여정을 따라가며 성도의 삶에서 마주하는 죄, 유혹, 고난, 그리고 은혜를 배우고, 교리를 단순한 지식이 아니라 삶 속에서 적용되는 진리로 익혀 갑니다.',
      ],
      gallery: [
        { src: '/next-generation/young-adults/doctrine/doctrine-1.jpg', alt: '교리 교육 자료 예시 1' },
        { src: '/next-generation/young-adults/doctrine/doctrine-2.jpg', alt: '교리 교육 자료 예시 2' },
        { src: '/next-generation/young-adults/doctrine/doctrine-3.png', alt: '교리 교육 자료 예시 3' },
        { src: '/next-generation/young-adults/doctrine/doctrine-4.png', alt: '교리 교육 자료 예시 4' },
      ],
    },
    {
      title: '삶의 적용',
      paragraphs: [
        '청년 1부는 주일 말씀을 한 번 듣고 끝내지 않습니다.',
        '주중에 제공되는 복습 팟캐스트를 통해 설교 내용을 다시 정리하고, 삶에 어떻게 적용할지를 구체적으로 고민합니다.',
        '또한 매달 첫째 주일에는 천로역정 공부를 잠시 내려놓고 말씀 나눔의 시간을 가집니다.',
        '오전 예배에서 선포되는 말씀과 오후 예배에서 베풀어지는 교리 강설을 중심으로, 준비된 나눔지를 통해 함께 복습하고 적용을 나눕니다.',
        '이 과정을 통해 말씀을 삶으로 잇는 실제적인 훈련을 지속해 나가고 있습니다.',
      ],
      gallery: [
        { src: '/next-generation/young-adults/application/application-1.jpg', alt: '삶의 적용 자료 예시 1' },
        { src: '/next-generation/young-adults/application/application-2.png', alt: '삶의 적용 자료 예시 2' },
        { src: '/next-generation/young-adults/application/application-3.jpg', alt: '삶의 적용 자료 예시 3' },
        { src: '/next-generation/young-adults/application/application-4.jpg', alt: '삶의 적용 자료 예시 4' },
      ],
    },
    {
      title: '말씀생활',
      paragraphs: [
        '청년 1부는 맥체인 성경읽기표를 따라 매일 성경을 읽고, QT를 통해 말씀을 묵상합니다.',
        '하루의 시작과 마무리를 말씀으로 채우며, 말씀이 삶의 중심이 되도록 훈련합니다.',
        '같은 말씀을 함께 읽고 나누며, 개인의 경건을 넘어 공동체 전체가 말씀 위에 세워져 가고 있습니다.',
      ],
      gallery: [
        { src: '/next-generation/young-adults/word-life/word-life-1.jpg', alt: '말씀생활 자료 예시 1' },
        { src: '/next-generation/young-adults/word-life/word-life-2.jpg', alt: '말씀생활 자료 예시 2' },
        { src: '/next-generation/young-adults/word-life/word-life-3.jpg', alt: '말씀생활 자료 예시 3' },
      ],
    },
  ];
  const [activeYoungAdultPillar, setActiveYoungAdultPillar] = useState<string | null>(null);
  const selectedYoungAdultPillar = youngAdultIntroPillars.find((pillar) => pillar.title === activeYoungAdultPillar);

  const [lightboxGallery, setLightboxGallery] = useState<{ src: string; alt: string }[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (gallery: { src: string; alt: string }[], index: number) => {
    setLightboxGallery(gallery);
    setLightboxIndex(index);
  };

  const closeLightbox = () => setLightboxGallery(null);

  useEffect(() => {
    if (!selectedPillar && !selectedYoungAdultPillar) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActivePillar(null);
        setActiveYoungAdultPillar(null);
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [selectedPillar]);

  useEffect(() => {
    if (!lightboxGallery) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowLeft') setLightboxIndex((i) => (i - 1 + lightboxGallery.length) % lightboxGallery.length);
      if (event.key === 'ArrowRight') setLightboxIndex((i) => (i + 1) % lightboxGallery.length);
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [lightboxGallery]);

  return (
    <div>
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-16">
          <div>
            <span className="mb-5 inline-flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm font-black text-emerald-950">
              <Sparkles size={18} />
              언약 안에서 예배하는 유초등부
            </span>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-normal text-emerald-950 sm:text-5xl">
              예배하는 유초등부
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
              한우리교회 유초등부는 언약 안에서 자라가는 아이들이 말씀과 예배 가운데 하나님을 바르게 배우도록 돕는 공동체입니다.
              우리는 예배 중심의 신앙교육을 지향하며, 교회 교육이 가정과 이어지도록 힘씁니다.
              성경과 교리 위에 다음세대를 세워, 하나님을 알고 사랑하며 순종하는 삶으로 자라가게 하는 것이 우리의 목표입니다.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {introPillars.map((pillar) => (
                <button
                  key={pillar.title}
                  type="button"
                  onClick={() => setActivePillar(pillar.title)}
                  aria-expanded={activePillar === pillar.title}
                  className={`rounded-lg border p-4 text-center text-sm font-black transition ${
                    activePillar === pillar.title
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                      : 'border-emerald-100 bg-emerald-50 text-emerald-950 hover:border-emerald-300 hover:bg-emerald-100'
                  }`}
                >
                  {pillar.title}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-sky-100 shadow-sm">
            <img
              src={introImage}
              alt="밝은 교실에서 함께 배우는 아이들"
              className="h-[220px] w-full object-cover sm:h-[340px] md:h-[420px]"
            />
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-2 pb-12 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8 lg:pb-16">
          <div className="order-2 overflow-hidden rounded-lg border border-sky-100 shadow-sm lg:order-1">
            <img
              src={youngAdultsIntroImage}
              alt="청년부 자료실에 사용되는 천로역정 이미지"
              className="h-[220px] w-full object-cover sm:h-[340px] md:h-[420px]"
            />
          </div>

          <div className="order-1 lg:order-2">
            <span className="mb-5 inline-flex items-center gap-2 rounded-lg bg-sky-100 px-3 py-2 text-sm font-black text-emerald-950">
              <Users size={18} />
              언약 안에 살아가는 청년 1부
            </span>
            <h2 className="max-w-3xl text-4xl font-black leading-tight tracking-normal text-emerald-950 sm:text-5xl">
              살아내는 청년 1부
            </h2>
            <div className="mt-6 max-w-2xl space-y-4 text-lg leading-8 text-slate-700">
              <p>청년 1부는 말씀을 배우는 데서 멈추지 않고, 삶으로 살아내는 공동체입니다.</p>
              <p>
                주일에 선포되는 말씀과 교리의 강설을 중심으로, 진리를 바르게 이해하고 실제 삶 속에서 적용하는
                것을 목표로 합니다.
              </p>
              <p>
                특별히 고전 신앙서인 천로역정을 통해 성도의 삶의 여정을 배우며, 교리를 지식이 아닌 실제적인
                믿음의 길로 익혀 갑니다. 또한 주중에는 말씀을 반복하고 적용하도록 돕는 다양한 나눔과 자료를
                통해, 신앙이 일상 속에 뿌리내리도록 돕고 있습니다.
              </p>
              <p>
                청년 1부는 &ldquo;듣고 끝나는 신앙&rdquo;이 아니라, &ldquo;삶으로 이어지는 신앙&rdquo;을 함께
                세워가는 공동체입니다.
              </p>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {youngAdultIntroPillars.map((pillar) => (
                <button
                  key={pillar.title}
                  type="button"
                  onClick={() => setActiveYoungAdultPillar(pillar.title)}
                  aria-expanded={activeYoungAdultPillar === pillar.title}
                  className={`rounded-lg border p-4 text-center text-sm font-black transition ${
                    activeYoungAdultPillar === pillar.title
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                      : 'border-sky-100 bg-sky-50 text-emerald-950 hover:border-sky-300 hover:bg-sky-100'
                  }`}
                >
                  {pillar.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {selectedPillar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="next-generation-pillar-title"
          onClick={() => setActivePillar(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto overscroll-contain rounded-lg border border-emerald-100 bg-white p-6 shadow-xl sm:max-h-[85vh] sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-5 flex items-start justify-between gap-4 border-b border-emerald-100 bg-white px-6 py-4 sm:-mx-8 sm:-mt-8 sm:px-8">
              <h2 id="next-generation-pillar-title" className="text-2xl font-black tracking-normal text-emerald-950">
                {selectedPillar.title}
              </h2>
              <button
                type="button"
                onClick={() => setActivePillar(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-950 transition hover:bg-emerald-100"
                aria-label="설명 닫기"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4 text-base leading-8 text-slate-700">
              {selectedPillar.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            {selectedPillar.highlights && (
              <div className="mt-6 rounded-lg bg-emerald-50 p-5">
                <h3 className="text-lg font-black text-emerald-950">교육 커리큘럼</h3>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-700 sm:text-base">
                  {selectedPillar.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-6">
              <h3 className="text-lg font-black text-emerald-950">교육 자료 미리보기</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {selectedPillar.gallery.map((image, idx) => (
                  <button
                    key={image.src}
                    type="button"
                    onClick={() => openLightbox(selectedPillar.gallery, idx)}
                    className="overflow-hidden rounded-lg border border-emerald-100 bg-slate-50 text-left transition hover:border-emerald-300"
                  >
                    <img src={image.src} alt={image.alt} className="aspect-[4/3] w-full object-cover" />
                    <div className="border-t border-emerald-100 bg-white px-3 py-2 text-sm font-bold text-emerald-950">
                      {image.alt}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedYoungAdultPillar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="young-adult-pillar-title"
          onClick={() => setActiveYoungAdultPillar(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto overscroll-contain rounded-lg border border-sky-100 bg-white p-6 shadow-xl sm:max-h-[85vh] sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-5 flex items-start justify-between gap-4 border-b border-sky-100 bg-white px-6 py-4 sm:-mx-8 sm:-mt-8 sm:px-8">
              <h2 id="young-adult-pillar-title" className="text-2xl font-black tracking-normal text-emerald-950">
                {selectedYoungAdultPillar.title}
              </h2>
              <button
                type="button"
                onClick={() => setActiveYoungAdultPillar(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-emerald-950 transition hover:bg-sky-100"
                aria-label="설명 닫기"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4 text-base leading-8 text-slate-700">
              {selectedYoungAdultPillar.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            {selectedYoungAdultPillar.gallery && (
              <div className="mt-6">
                <h3 className="text-lg font-black text-emerald-950">교육 자료 미리보기</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedYoungAdultPillar.gallery.map((image, idx) => (
                    <button
                      key={image.src}
                      type="button"
                      onClick={() => openLightbox(selectedYoungAdultPillar.gallery, idx)}
                      className="overflow-hidden rounded-lg border border-sky-100 bg-slate-50 text-left transition hover:border-sky-300"
                    >
                      <img src={image.src} alt={image.alt} className="aspect-[4/3] w-full object-cover" />
                      <div className="border-t border-sky-100 bg-white px-3 py-2 text-sm font-bold text-emerald-950">
                        {image.alt}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {lightboxGallery && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 px-4 py-8"
          onClick={closeLightbox}
        >
          <div className="relative flex w-full max-w-4xl flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute -top-10 right-0 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/25"
              aria-label="닫기"
            >
              <X size={20} />
            </button>

            <div className="relative flex h-[70vh] w-full items-center justify-center">
              <img
                key={lightboxGallery[lightboxIndex].src}
                src={lightboxGallery[lightboxIndex].src}
                alt={lightboxGallery[lightboxIndex].alt}
                className="h-full w-full rounded-lg object-contain shadow-2xl"
              />

              {lightboxGallery.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setLightboxIndex((i) => (i - 1 + lightboxGallery.length) % lightboxGallery.length)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg bg-black/40 text-white transition hover:bg-black/60"
                    aria-label="이전 사진"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxIndex((i) => (i + 1) % lightboxGallery.length)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg bg-black/40 text-white transition hover:bg-black/60"
                    aria-label="다음 사진"
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}
            </div>

            <div className="mt-4 text-center">
              <p className="text-sm font-bold text-white/90">{lightboxGallery[lightboxIndex].alt}</p>
              <p className="mt-1 text-xs text-white/50">{lightboxIndex + 1} / {lightboxGallery.length}</p>
            </div>
          </div>
        </div>
      )}

      {false && cmsIntroSections.length > 0 && (
        <section className="bg-white py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 md:grid-cols-2">
              {cmsIntroSections.map((section) => (
                <article key={section.id} className="rounded-lg border border-sky-100 bg-sky-50 p-6 shadow-sm">
                  <h3 className="text-xl font-black text-emerald-950">{section.title}</h3>
                  <div className="mt-3 space-y-3">
                    {section.paragraphs.map((paragraph, idx) => (
                      <p key={`${section.id}-p-${idx}`} className="text-sm leading-7 text-slate-700">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                  {section.highlights.length > 0 && (
                    <ul className="mt-4 space-y-1 rounded-lg border border-sky-100 bg-white p-4">
                      {section.highlights.map((item, idx) => (
                        <li key={`${section.id}-h-${idx}`} className="text-xs font-bold text-emerald-900">
                          · {item}
                        </li>
                      ))}
                    </ul>
                  )}
                  {section.gallery.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {section.gallery.map((image, idx) => (
                        <img key={`${section.id}-g-${idx}`} src={image.src} alt={image.alt} className="h-24 w-full rounded-lg object-cover" />
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-sky-50 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-normal text-emerald-950">부서별 자료실</h2>
              <p className="mt-3 text-base leading-7 text-slate-700">
                교사와 리더가 함께 준비하고 나누는 다음세대 교육 자료를 모읍니다.
              </p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {departmentCards.map((section) => (
              <Link
                key={section.id}
                to={section.path}
                className="group overflow-hidden rounded-lg border border-white bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <img src={section.image} alt={`${section.name} 자료실`} className="h-52 w-full object-cover" />
                <div className="p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-coral-100 text-coral-800">
                      <section.icon size={24} />
                    </span>
                    <h3 className="text-2xl font-black tracking-normal text-emerald-950">{section.name}</h3>
                  </div>
                  <p className="text-base leading-7 text-slate-700">{section.copy}</p>
                  <span className="mt-6 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition group-hover:bg-emerald-700">
                    자료실 열기
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

interface MyQAItem {
  id: string;
  title?: string;
  content?: string;
  department?: 'elementary' | 'young-adults';
  createdAt?: any;
  isAnswered?: boolean;
  answer?: string;
}

interface MyReadingItem {
  id: string;
  date?: string;
  progress?: boolean[];
  meditation?: string;
  updatedAt?: any;
}

const toDateOrNull = (value: any): Date | null => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatShortDate = (value: any) => {
  const date = toDateOrNull(value);
  if (!date) return '';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};

function NextGenerationMyPage() {
  const {
    user,
    member,
    loading,
    hasAccess,
    isPastor,
    notifications,
    markNotificationRead,
  } = useNextGenerationAuth();
  const [myQuestions, setMyQuestions] = useState<MyQAItem[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [readings, setReadings] = useState<MyReadingItem[]>([]);
  const [readingsLoading, setReadingsLoading] = useState(false);

  const roleLabel = member?.department || (isPastor ? '관리자' : '다음세대');
  const isStudentRole = member?.department === NEXT_GENERATION_DEPARTMENTS[3];
  const isYoungAdultRole = member?.department === NEXT_GENERATION_DEPARTMENTS[0];

  useEffect(() => {
    if (!user || !hasAccess) {
      setMyQuestions([]);
      return;
    }

    setQuestionsLoading(true);
    const load = async () => {
      try {
        const q = query(
          collection(db, 'next_generation_qa'),
          where('authorId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(8),
        );
        const snap = await getDocs(q);
        setMyQuestions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as MyQAItem)));
      } catch (error) {
        console.error('Error loading my next-generation questions:', error);
        setMyQuestions([]);
      } finally {
        setQuestionsLoading(false);
      }
    };
    load();
  }, [hasAccess, user]);

  useEffect(() => {
    if (!user || !hasAccess || !isYoungAdultRole) {
      setReadings([]);
      return;
    }

    setReadingsLoading(true);
    const load = async () => {
      try {
        const q = query(
          collection(db, 'users', user.uid, 'readings'),
          orderBy('date', 'desc'),
          limit(7),
        );
        const snap = await getDocs(q);
        setReadings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as MyReadingItem)));
      } catch (error) {
        console.error('Error loading my reading progress:', error);
        setReadings([]);
      } finally {
        setReadingsLoading(false);
      }
    };
    load();
  }, [hasAccess, isYoungAdultRole, user]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-700" />
      </div>
    );
  }

  if (!user || !hasAccess) {
    return (
      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Lock className="mx-auto mb-4 h-10 w-10 text-amber-500" />
          <h1 className="text-3xl font-black tracking-normal text-emerald-950">내 역할 페이지</h1>
          <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
            다음세대 회원으로 로그인하고 승인되면 내 활동을 확인할 수 있습니다.
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="bg-slate-50">
      <section className="border-b border-emerald-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Link to={NEXT_GENERATION_PATH} className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-900">
            <ArrowLeft size={16} /> 다음세대
          </Link>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-800">
                <Users size={16} /> {roleLabel}
              </span>
              <h1 className="mt-4 text-4xl font-black tracking-normal text-emerald-950">
                {member?.displayName || user.displayName || '내'} 활동
              </h1>
              <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-slate-600">
                내가 남긴 질문, 알림, 역할별 기록을 한곳에서 확인합니다.
              </p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
              읽지 않은 알림 {notifications.filter((item) => !item.isRead).length}개
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.25fr_0.75fr] lg:px-8">
        <div className="space-y-6">
          {isStudentRole && <BibleReadingChart enableBrowse />}

          {isYoungAdultRole && (
            <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                  <BookOpen size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-normal text-emerald-950">말씀 읽기와 묵상</h2>
                  <p className="mt-1 text-sm font-medium text-slate-600">최근 저장한 말씀 읽기 체크와 묵상 한줄입니다.</p>
                </div>
              </div>
              {readingsLoading ? (
                <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                  <Loader2 size={16} className="animate-spin" /> 불러오는 중
                </div>
              ) : readings.length === 0 ? (
                <p className="rounded-xl border border-dashed border-sky-200 bg-sky-50 p-5 text-sm font-bold text-slate-500">
                  아직 저장된 말씀 읽기 기록이 없습니다.
                </p>
              ) : (
                <div className="space-y-3">
                  {readings.map((item) => {
                    const checked = item.progress?.filter(Boolean).length || 0;
                    const total = item.progress?.length || 0;
                    return (
                      <div key={item.id} className="rounded-xl border border-sky-100 bg-sky-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-black text-emerald-950">{item.date || item.id}</p>
                          <span className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-sky-700">
                            {checked}/{total}
                          </span>
                        </div>
                        {item.meditation && (
                          <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm leading-6 text-slate-700">
                            {item.meditation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!isStudentRole && !isYoungAdultRole && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black tracking-normal text-emerald-950">{roleLabel} 활동</h2>
              <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
                아직 이 역할에 연결된 전용 활동은 없습니다. 지금은 알림과 내가 남긴 질문을 확인할 수 있습니다.
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <MessageSquare size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-normal text-emerald-950">내가 작성한 질문</h2>
                <p className="mt-1 text-sm font-medium text-slate-600">유초등부와 청년부에 남긴 질문을 모아봅니다.</p>
              </div>
            </div>
            {questionsLoading ? (
              <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                <Loader2 size={16} className="animate-spin" /> 불러오는 중
              </div>
            ) : myQuestions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50 p-5 text-sm font-bold text-slate-500">
                아직 작성한 질문이 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {myQuestions.map((item) => (
                  <div key={item.id} className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-amber-700">
                        {item.department === 'elementary' ? '유초등부' : '청년부'}
                      </span>
                      {item.isAnswered && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">
                          <CheckCircle size={12} /> 답변 완료
                        </span>
                      )}
                      <span className="text-xs font-bold text-slate-500">{formatShortDate(item.createdAt)}</span>
                    </div>
                    <h3 className="mt-3 text-base font-black text-emerald-950">{item.title}</h3>
                    {item.answer && <p className="mt-2 text-sm leading-6 text-slate-700">{item.answer}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Bell size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-normal text-emerald-950">알림</h2>
                <p className="mt-1 text-sm font-medium text-slate-600">내게 온 다음세대 알림입니다.</p>
              </div>
            </div>
            {notifications.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
                아직 알림이 없습니다.
              </p>
            ) : (
              <div className="space-y-2">
                {notifications.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => markNotificationRead(item.id)}
                    className={`w-full rounded-xl border px-3 py-3 text-left text-sm transition ${
                      item.isRead
                        ? 'border-slate-100 bg-slate-50 text-slate-600'
                        : 'border-amber-200 bg-amber-50 text-emerald-950'
                    }`}
                  >
                    <span className="block font-black">{item.message}</span>
                    {item.rejectionReason && (
                      <span className="mt-1 block text-xs font-bold text-red-600">{item.rejectionReason}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

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

function ResourceLibraryPage({
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
  const { hasAccess: ngAccess, user: ngUser, member } = useNextGenerationAuth();
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
  const usesTopicFolders = !isWeeklyTab && (!!activeTab.useTopic || supportsNextGenerationTopic(activeTab.id));
  const currentWeekKey = useMemo(() => getCurrentSundayKey(), []);
  const ActiveIcon = activeTab.icon;
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

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
    const byDate = (a: NextGenerationPost, b: NextGenerationPost) =>
      sortDir === 'desc'
        ? getPostPrimarySortTime(b) - getPostPrimarySortTime(a)
        : getPostPrimarySortTime(a) - getPostPrimarySortTime(b);

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
        .sort(byDate);
    }

    return [...posts].sort(byDate);
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
          <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
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
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-3 text-sm font-black transition ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : isTabLocked
                      ? 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      : 'bg-sky-50 text-emerald-950 hover:bg-sky-100'
                  }`}
                >
                  {isTabLocked ? <Lock size={16} /> : <Icon size={18} />}
                  {tab.name}
                </button>
              );
            })}
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
                <p className="mt-2 text-sm font-bold text-emerald-700">
                  기준 주일: {currentWeekKey}
                </p>
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
                  {sortDir === 'desc' ? <ArrowDown01 size={16} /> : <ArrowUp10 size={16} />}
                  {sortDir === 'desc' ? '최신순' : '오래된순'}
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
                    <Link to={`${NEXT_GENERATION_PATH}/post/${post.id}`} className="block">
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
        </div>
      </section>
    </div>
  );
}

function YoungAdultsPage() {
  return (
    <ResourceLibraryPage
      departmentSlug="young-adults"
      departmentName="청년부"
      image={youngAdultsImage}
      imageAlt="천로역정 특강 청년부 자료"
      badgeClassName="bg-sky-100 text-emerald-950"
      heroClassName="bg-white"
      title="복음 안에서 함께 질문하고 함께 걸어갑니다"
      description="천로역정 특강과 수련회 자료를 한곳에서 확인합니다. 청년들이 말씀 앞에서 질문하고, 공동체 안에서 믿음의 길을 함께 걸어갑니다."
      tabs={youngAdultResourceTabs as any}
      guestTabId="pilgrim_lecture"
      guestPostLimit={4}
      midSection={
        <NextGenerationHighlightBand
          themeBg="bg-gradient-to-b from-sky-50 to-white border-y border-sky-100"
          activeRing="border-emerald-400 bg-emerald-50"
          entries={[
            {
              id: 'qa',
              icon: <HelpCircle size={18} />,
              label: '질문 있습니다',
              summary: '말씀과 신앙의 질문을 자유롭게 남겨 보세요',
              content: <NextGenerationQA compact department="young-adults" />,
            },
            {
              id: 'today',
              icon: <BookOpen size={18} />,
              label: '오늘의 말씀',
              summary: '맥체인 성경 읽기와 묵상 가이드',
              content: <NextGenerationTodayWord compact />,
            },
          ]}
        />
      }
    />
  );
}

function NextGenerationCreatePost() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { tabs: cmsTabs } = useNextGenerationCms();
  const [searchParams] = useSearchParams();
  const mergedTabs: ResourceTabItem[] = useMemo(
    () =>
      (cmsTabs.length > 0 ? cmsTabs : (allResourceTabs as any)).map((tab: any) => ({
        id: tab.slug || tab.id,
        slug: tab.slug || tab.id,
        name: tab.name,
        description: tab.description || '',
        icon: iconMap[tab.iconName] || tab.icon || FileText,
        departmentSlug: tab.departmentSlug || (youngAdultResourceTabs.some((item) => item.id === (tab.id || tab.slug)) ? 'young-adults' : 'elementary'),
        isGuestOpen: tab.isGuestOpen,
        isWeeklyGroup: tab.isWeeklyGroup || (tab.id === 'elementary_weekly'),
        useWeekKey: tab.useWeekKey || isElementaryWeeklyResource(tab.id || tab.slug),
        useTopic: tab.useTopic || supportsNextGenerationTopic(tab.id || tab.slug),
      })),
    [cmsTabs]
  );
  const activeTab = getResourceTab(searchParams.get('resource') || undefined, mergedTabs);
  const requestedTopic = searchParams.get('topic');
  const isWeeklyCreate = !!activeTab.isWeeklyGroup;
  const weeklyTabsInDepartment = mergedTabs.filter((tab) => tab.departmentSlug === activeTab.departmentSlug && tab.useWeekKey && !tab.isWeeklyGroup);
  const [selectedResourceId, setSelectedResourceId] = useState(
    isWeeklyCreate ? (weeklyTabsInDepartment[0]?.id || activeTab.id) : activeTab.id
  );
  const [selectedTopicId, setSelectedTopicId] = useState(
    NEXT_GENERATION_TOPIC_OPTIONS.some((topic) => topic.id === requestedTopic)
      ? requestedTopic!
      : NEXT_GENERATION_TOPIC_OPTIONS[0].id
  );
  const [weekKey, setWeekKey] = useState(getCurrentSundayKey());
  const backPath = requestedTopic
    ? `${getResourceDepartmentPath(activeTab.id, mergedTabs)}?resource=${activeTab.id}&topic=${requestedTopic}`
    : `${getResourceDepartmentPath(activeTab.id, mergedTabs)}?resource=${activeTab.id}`;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [materialFiles, setMaterialFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successPostId, setSuccessPostId] = useState<string | null>(null);
  const selectedTab = mergedTabs.find((tab) => tab.id === selectedResourceId);
  const usesWeekKey = isWeeklyCreate || !!selectedTab?.useWeekKey;
  const usesTopic = !!selectedTab?.useTopic;

  useEffect(() => {
    setSelectedResourceId(isWeeklyCreate ? (weeklyTabsInDepartment[0]?.id || activeTab.id) : activeTab.id);
  }, [activeTab.id, isWeeklyCreate, weeklyTabsInDepartment]);

  useEffect(() => {
    if (!usesTopic) {
      setSelectedTopicId(NEXT_GENERATION_TOPIC_OPTIONS[0].id);
    }
  }, [usesTopic]);

  useEffect(() => {
    if (
      requestedTopic &&
      NEXT_GENERATION_TOPIC_OPTIONS.some((topic) => topic.id === requestedTopic) &&
      usesTopic
    ) {
      setSelectedTopicId(requestedTopic);
    }
  }, [requestedTopic, selectedResourceId, usesTopic]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const validationError = validateMaterialFiles(files, materialFiles.length);
    if (validationError) {
      setError(validationError);
      event.target.value = '';
      return;
    }

    setMaterialFiles((currentFiles) => [...currentFiles, ...files]);
    setError(null);
    event.target.value = '';
  };

  const removeMaterialFile = (indexToRemove: number) => {
    setMaterialFiles((currentFiles) => currentFiles.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !title.trim() || !content.trim() || submitting) return;

    setSubmitting(true);
    setUploadProgress(0);
    setError(null);

    try {
      const attachments = await uploadMaterialFiles(storage, materialFiles, setUploadProgress);
      const firstPdfAttachment = getFirstPdfAttachment(attachments);

      const postData: any = {
        title: title.trim(),
        content: content.trim(),
        category: NEXT_GENERATION_CATEGORY,
        subCategory: selectedResourceId,
        nextGenerationTabSlug: selectedResourceId,
        nextGenerationDepartmentSlug: selectedTab?.departmentSlug || activeTab.departmentSlug,
        isArchived: false,
        sortOrder: generateSortOrder(title.trim()),
        authorId: user.uid,
        authorName: user.displayName || '익명',
        commentCount: 0,
        viewCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isPublished: true,
      };

      if (usesWeekKey) {
        postData.nextGenerationWeekKey = weekKey;
      }

      if (usesTopic) {
        postData.nextGenerationTopicId = selectedTopicId;
      }

      if (youtubeUrl.trim()) {
        postData.youtubeUrl = youtubeUrl.trim();
      }

      // Security (Option B): Do NOT store download URLs in the public post doc.
      // We only keep a non-sensitive count here so guests/non-members can see
      // "자료 N개" badge without being able to extract URLs via direct Firestore read.
      if (attachments.length > 0) {
        postData.attachmentCount = attachments.length;
      }

      const isLongContent = new TextEncoder().encode(content).length > 1400;
      if (isLongContent) {
        postData.content = content.substring(0, 400);
        postData.isLongContent = true;
        postData.fullContentLength = content.length;
      }

      let docRef;
      try {
        docRef = await addDoc(collection(db, 'posts'), postData);
      } catch (postError: any) {
        const shouldRetryWithoutTopic =
          postError?.code === 'permission-denied' && 'nextGenerationTopicId' in postData;

        if (!shouldRetryWithoutTopic) {
          throw postError;
        }

        const fallbackPostData = { ...postData };
        delete fallbackPostData.nextGenerationTopicId;
        docRef = await addDoc(collection(db, 'posts'), fallbackPostData);
      }

      if (isLongContent) {
        const chunkSize = 10000;
        const chunks = [];
        for (let i = 0; i < content.length; i += chunkSize) {
          chunks.push(content.substring(i, i + chunkSize));
        }

        for (let i = 0; i < chunks.length; i++) {
          await setDoc(doc(db, 'post_contents', `${docRef.id}_${i}`), {
            postId: docRef.id,
            index: i,
            content: chunks[i],
            createdAt: serverTimestamp(),
          });
        }
      }

      // Write downloadable file metadata to a restricted subcollection
      // that only approved members (and pastor) can read.
      if (attachments.length > 0) {
        const fileData: any = {
          postId: docRef.id,
          updatedAt: serverTimestamp(),
          pdfBase64: serializeMaterialAttachments(attachments),
        };
        if (firstPdfAttachment) {
          fileData.pdfUrl = firstPdfAttachment.url;
          fileData.pdfName = firstPdfAttachment.name;
        }
        await setDoc(doc(db, 'next_generation_post_files', docRef.id), fileData);
      }

      setSuccessPostId(docRef.id);
      setTitle('');
      setContent('');
      setYoutubeUrl('');
      setMaterialFiles([]);
      setUploadProgress(0);
    } catch (err: any) {
      console.error('Error creating next generation post:', err);
      setError(err.message || '자료 등록 중 오류가 발생했습니다.');
      try {
        handleFirestoreError(err, OperationType.CREATE, 'posts');
      } catch (e) {}
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-sky-50">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-700" />
      </div>
    );
  }

  if (!user) {
    return (
      <main className="bg-sky-50 py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate(backPath)}
            className="mb-6 inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-bold text-emerald-950 shadow-sm transition hover:bg-emerald-50"
          >
            <ArrowLeft size={16} className="mr-2" />
            자료실로 돌아가기
          </button>
          <div className="rounded-lg border border-sky-100 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-black text-emerald-950">로그인이 필요합니다</h1>
            <p className="mt-3 text-slate-700">자료를 올리려면 먼저 관리자 계정으로 로그인해 주세요.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-sky-50 py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(backPath)}
          className="mb-6 inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-bold text-emerald-950 shadow-sm transition hover:bg-emerald-50"
        >
          <ArrowLeft size={16} className="mr-2" />
          자료실로 돌아가기
        </button>

        <section className="rounded-lg border border-white bg-white p-4 shadow-sm sm:p-6 lg:p-10">
          <span className="mb-4 inline-flex rounded-lg bg-amber-100 px-3 py-2 text-sm font-black text-emerald-950">
            {activeTab.name}
          </span>
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-normal text-emerald-950">다음세대 자료 등록</h1>
              <p className="mt-3 text-base leading-7 text-slate-700">{activeTab.description}</p>
            </div>
            <button
              type="submit"
              form="next-generation-create-form"
              disabled={submitting || !title.trim() || !content.trim()}
              className="inline-flex items-center justify-center rounded-lg bg-coral-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-coral-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? '등록 중...' : '등록하기'}
            </button>
          </div>

          {successPostId && (
            <div className="mb-6 flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-emerald-700">자료가 성공적으로 등록되었습니다.</p>
              <div className="flex shrink-0 gap-2">
                <Link
                  to={`${NEXT_GENERATION_PATH}/post/${successPostId}`}
                  className="inline-flex items-center rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                >
                  등록된 자료 보기
                </Link>
                <button
                  type="button"
                  onClick={() => setSuccessPostId(null)}
                  className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
                >
                  자료 추가 등록
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          <form id="next-generation-create-form" onSubmit={handleSubmit} className="space-y-6">
            {isWeeklyCreate && (
              <div>
                <label htmlFor="next-generation-resource-type" className="mb-2 block text-sm font-black text-emerald-950">
                  세부 탭
                </label>
                <select
                  id="next-generation-resource-type"
                  value={selectedResourceId}
                  onChange={(event) => setSelectedResourceId(event.target.value)}
                  className="block w-full rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                >
                  {weeklyTabsInDepartment.map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs font-bold text-slate-500">
                  선택한 세부 탭에도 같은 자료가 자동으로 모입니다.
                </p>
              </div>
            )}

            {usesWeekKey && (
              <div>
                <label htmlFor="next-generation-week" className="mb-2 block text-sm font-black text-emerald-950">
                  해당 주일
                </label>
                <input
                  id="next-generation-week"
                  type="date"
                  value={weekKey}
                  onChange={(event) => setWeekKey(event.target.value)}
                  className="block w-full rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                  required
                />
                <p className="mt-2 text-xs font-bold text-slate-500">
                  이번주 강의자료 탭은 이 날짜가 이번 주일과 같은 자료를 모아 보여줍니다.
                </p>
              </div>
            )}

            {usesTopic && (
              <div>
                <label htmlFor="next-generation-topic" className="mb-2 block text-sm font-black text-emerald-950">
                  주제 폴더
                </label>
                <select
                  id="next-generation-topic"
                  value={selectedTopicId}
                  onChange={(event) => setSelectedTopicId(event.target.value)}
                  className="block w-full rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                >
                  {NEXT_GENERATION_TOPIC_OPTIONS.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs font-bold text-slate-500">
                  같은 세부 탭 안에서도 시리즈 주제별로 자료를 묶어 보여줍니다.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="next-generation-title" className="mb-2 block text-sm font-black text-emerald-950">
                제목
              </label>
              <input
                id="next-generation-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="block w-full rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                placeholder="제목을 입력하세요"
                required
                maxLength={200}
              />
            </div>

            {selectedResourceId === 'podcast_review' && (
              <div>
                <label htmlFor="next-generation-youtube-url" className="mb-2 block text-sm font-black text-emerald-950">
                  유튜브 링크
                </label>
                <input
                  id="next-generation-youtube-url"
                  type="url"
                  value={youtubeUrl}
                  onChange={(event) => setYoutubeUrl(event.target.value)}
                  className="block w-full rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                  placeholder="https://www.youtube.com/watch?v=..."
                  maxLength={500}
                />
                {youtubeUrl && !getYouTubeVideoId(youtubeUrl) && (
                  <p className="mt-2 text-xs font-bold text-red-600">유효한 유튜브 링크를 입력하세요.</p>
                )}
                {youtubeUrl && getYouTubeVideoId(youtubeUrl) && (
                  <p className="mt-2 text-xs font-bold text-emerald-700">유효한 유튜브 링크입니다.</p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="next-generation-content" className="mb-2 block text-sm font-black text-emerald-950">
                {selectedResourceId === 'podcast_review' ? '설명' : '내용'}
              </label>
              <textarea
                id="next-generation-content"
                rows={14}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="block w-full rounded-lg border border-sky-100 bg-sky-50 p-4 text-sm leading-7 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                placeholder={selectedResourceId === 'podcast_review' ? '팟캐스트 설명을 입력하세요' : '자료 안내와 함께 나눌 내용을 입력하세요'}
                required
                maxLength={50000}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-black text-emerald-950">
                자료 파일 첨부
              </label>
              <div className="rounded-lg border-2 border-dashed border-sky-200 bg-sky-50 p-6 transition hover:bg-sky-100">
                <div className="text-center">
                  <FileText className="mx-auto mb-3 h-10 w-10 text-sky-500" />
                  <label htmlFor="next-generation-file" className="cursor-pointer text-sm font-black text-emerald-800 hover:text-emerald-950">
                    PDF/PPT 파일 선택
                  </label>
                  <p className="mt-2 text-xs font-bold text-slate-500">
                    여러 파일 선택 가능, 파일당 최대 20MB
                  </p>
                  <input
                    id="next-generation-file"
                    type="file"
                    accept={MATERIAL_FILE_ACCEPT}
                    multiple
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                </div>

                {materialFiles.length > 0 && (
                  <ul className="mt-5 space-y-2">
                    {materialFiles.map((file, index) => (
                      <li
                        key={`${file.name}-${file.lastModified}-${index}`}
                        className="flex flex-col gap-3 rounded-lg bg-white p-3 text-left shadow-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="flex items-center gap-3 text-sm font-bold text-emerald-950">
                          <FileText className="h-5 w-5 shrink-0 text-emerald-700" />
                          <span>
                            {file.name}
                            <span className="ml-2 text-xs text-slate-500">{formatFileSize(file.size)}</span>
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeMaterialFile(index)}
                          className="inline-flex w-fit items-center rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-red-50 hover:text-red-700"
                        >
                          <X size={14} className="mr-1" />
                          제거
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {submitting && uploadProgress > 0 && uploadProgress < 100 && (
              <div>
                <div className="h-2.5 w-full rounded-full bg-sky-100">
                  <div className="h-2.5 rounded-full bg-emerald-600 transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="mt-2 text-right text-xs font-bold text-slate-500">자료 업로드 중... {uploadProgress}%</p>
              </div>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}

function NextGenerationPostDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { hasAccess: ngAccess, user: ngUser, member, isPending, isRejected } = useNextGenerationAuth();
  const isRestricted = isRestrictedDepartment(member?.department);
  const { tabs: cmsTabs, departments: cmsDepartments } = useNextGenerationCms();
  const [post, setPost] = useState<NextGenerationPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  const isAdmin = role === 'admin';
  const downloadBlockedNotice = (ngUser && (isPending || isRejected))
    ? '\uB2E4\uC6B4\uB85C\uB4DC\uB294 \uC815\uD68C\uC6D0\uB9CC \uAC00\uB2A5\uD569\uB2C8\uB2E4. \uBAA9\uC0AC\uB2D8\uAED8 \uBB38\uC758\uB97C \uB0A8\uACA8\uC8FC\uC138\uC694.'
    : '\uB85C\uADF8\uC778\uD558\uC2DC\uBA74 \uB2E4\uC6B4\uB85C\uB4DC \uAE30\uB2A5\uC744 \uC774\uC6A9\uD558\uC2E4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.';

  useEffect(() => {
    const fetchPost = async () => {
      setLoading(true);

      try {
        const postRef = doc(db, 'posts', id);
        const snapshot = await getDoc(postRef);

        if (!snapshot.exists()) {
          navigate(`${NEXT_GENERATION_PATH}/elementary`, { replace: true });
          return;
        }

        const data = { id: snapshot.id, ...snapshot.data() } as NextGenerationPost;
        if (data.category !== NEXT_GENERATION_CATEGORY) {
          navigate(`${NEXT_GENERATION_PATH}/elementary`, { replace: true });
          return;
        }

        if (isRestricted && !isAdmin) {
          const postTabSlug = data.nextGenerationTabSlug || data.subCategory || '';
          if (!(STUDENT_ACCESSIBLE_TAB_SLUGS as readonly string[]).includes(postTabSlug)) {
            navigate(`${NEXT_GENERATION_PATH}/elementary?resource=elementary_workbook`, { replace: true });
            return;
          }
        }

        if (data.isLongContent) {
          const chunksQuery = query(
            collection(db, 'post_contents'),
            where('postId', '==', id),
            orderBy('index', 'asc')
          );
          const chunksSnap = await getDocs(chunksQuery);
          if (!chunksSnap.empty) {
            data.content = chunksSnap.docs.map((chunkDoc) => chunkDoc.data().content).join('');
          }
        }

        // Load restricted download file metadata only if the user is an approved
        // member or pastor. Firestore rules block this read for others, so we
        // guard here to avoid surfacing a permission error in the console.
        if (true) {
          try {
            const fileSnap = await getDoc(doc(db, 'next_generation_post_files', id));
            if (fileSnap.exists()) {
              const fileData = fileSnap.data() as any;
              if (fileData.pdfUrl) (data as any).pdfUrl = fileData.pdfUrl;
              if (fileData.pdfName) (data as any).pdfName = fileData.pdfName;
              if (fileData.pdfBase64) (data as any).pdfBase64 = fileData.pdfBase64;
              if (fileData.attachments) (data as any).attachments = fileData.attachments;
            }
          } catch (e) {
            // Silent — rule may block for pending/rejected; badge still reflects count
          }
        }

        setPost(data);
      } catch (err: any) {
        console.error('Error fetching next generation post:', err);
        try {
          handleFirestoreError(err, OperationType.GET, `posts/${id}`);
        } catch (e) {}
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [id, navigate, ngAccess, isRestricted, isAdmin]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-sky-50">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-700" />
      </div>
    );
  }

  if (!post) return null;

  const mergedTabs: ResourceTabItem[] = (cmsTabs.length > 0 ? cmsTabs : (allResourceTabs as any)).map((tab: any) => ({
    id: tab.slug || tab.id,
    slug: tab.slug || tab.id,
    name: tab.name,
    description: tab.description || '',
    icon: iconMap[tab.iconName] || tab.icon || FileText,
    departmentSlug: tab.departmentSlug || (youngAdultResourceTabs.some((item) => item.id === (tab.id || tab.slug)) ? 'young-adults' : 'elementary'),
    isGuestOpen: tab.isGuestOpen,
    isWeeklyGroup: tab.isWeeklyGroup || (tab.id === 'elementary_weekly'),
    useWeekKey: tab.useWeekKey || isElementaryWeeklyResource(tab.id || tab.slug),
    useTopic: tab.useTopic || supportsNextGenerationTopic(tab.id || tab.slug),
  }));
  const mergedDepartments: DepartmentCardItem[] = (cmsDepartments.length > 0 ? cmsDepartments : (sectionTabs as any)).map((department: any) => ({
    id: department.slug || department.id,
    slug: department.slug || department.id,
    name: department.name,
    path: `${NEXT_GENERATION_PATH}/${department.slug || department.id}`,
    image: department.image || elementaryImage,
    copy: department.description || department.copy || '',
    icon: iconMap.Sparkles,
  }));
  const inferredTopicId = inferNextGenerationTopicId(post);
  const postTabSlug = post.nextGenerationTabSlug || post.subCategory;
  const backPath = supportsNextGenerationTopic(postTabSlug)
    ? `${getResourceDepartmentPath(postTabSlug, mergedTabs, mergedDepartments)}?resource=${postTabSlug || mergedTabs[0]?.id || elementaryResourceTabs[0].id}&topic=${inferredTopicId}`
    : `${getResourceDepartmentPath(postTabSlug, mergedTabs, mergedDepartments)}?resource=${postTabSlug || mergedTabs[0]?.id || elementaryResourceTabs[0].id}`;
  const attachments = getPostAttachments(post);

  return (
    <main className="bg-sky-50 py-10">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => navigate(backPath)}
            className="inline-flex w-fit items-center rounded-lg bg-white px-4 py-2 text-sm font-bold text-emerald-950 shadow-sm transition hover:bg-emerald-50"
          >
            <ArrowLeft size={16} className="mr-2" />
            자료 목록으로
          </button>

          {isAdmin && (
            <Link
              to={`${NEXT_GENERATION_PATH}/edit/${post.id}`}
              className="inline-flex w-fit items-center rounded-lg bg-coral-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-coral-700"
            >
              <Edit3 size={16} className="mr-2" />
              수정하기
            </Link>
          )}
        </div>

        <article className="rounded-lg border border-white bg-white p-6 shadow-sm sm:p-8 lg:p-10">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
                <span className="inline-flex w-fit rounded-lg bg-amber-100 px-3 py-2 text-sm font-black text-emerald-950">
                  {getResourceLabel(postTabSlug, mergedTabs)}
                </span>
              {supportsNextGenerationTopic(postTabSlug) && (
                <span className="inline-flex w-fit rounded-lg bg-sky-50 px-3 py-2 text-sm font-black text-emerald-950">
                  {getNextGenerationTopicLabel(inferredTopicId)}
                </span>
              )}
            </div>
            <span className="text-sm font-bold text-slate-500">{formatDate(post.createdAt, 'yyyy.MM.dd HH:mm')}</span>
          </div>

          <h1 className="text-3xl font-black leading-tight tracking-normal text-emerald-950 sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-3 text-sm font-bold text-slate-500">{post.authorName}</p>

          <>
          {post.youtubeUrl && getYouTubeVideoId(post.youtubeUrl) && (
            <div className="mt-8 overflow-hidden rounded-lg border border-sky-100">
              <div className="relative aspect-video">
                <iframe
                  src={`https://www.youtube.com/embed/${getYouTubeVideoId(post.youtubeUrl)}`}
                  title={post.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            </div>
          )}

          <div className="mt-8 whitespace-pre-wrap text-base leading-8 text-slate-800">
            {post.content}
          </div>

          {attachments.length > 0 && (
            <div className="mt-10 border-t border-sky-100 pt-8">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="flex items-center text-xl font-black text-emerald-950">
                  <FileText className="mr-2 text-coral-700" />
                  첨부된 자료
                </h2>
              </div>

              {accessNotice && (
                <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                  {accessNotice}
                </div>
              )}

              <div className="space-y-4">
                {attachments.map((attachment, index) => (
                  <div key={`${attachment.url}-${index}`} className="rounded-lg border border-sky-100 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <span className="mb-2 inline-flex rounded-lg bg-sky-50 px-2 py-1 text-xs font-black text-emerald-950">
                          {getMaterialAttachmentLabel(attachment)}
                        </span>
                        <p className="break-all text-sm font-bold text-emerald-950">{attachment.name}</p>
                        {attachment.size && (
                          <p className="mt-1 text-xs font-bold text-slate-500">{formatFileSize(attachment.size)}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {ngAccess ? (
                          <>
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-lg bg-sky-50 px-3 py-2 text-xs font-bold text-emerald-950 transition hover:bg-sky-100"
                            >
                              새 창에서 열기
                            </a>
                            <a
                              href={attachment.url}
                              download={attachment.name}
                              className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
                            >
                              <Download size={14} className="mr-1" />
                              다운로드
                            </a>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setAccessNotice(downloadBlockedNotice)
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-500 transition hover:bg-gray-200"
                            title={'\uB85C\uADF8\uC778 \uD6C4 \uB2E4\uC6B4\uB85C\uB4DC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4'}
                          >
                            <Download size={14} className="mr-1" />
                            {'\uB2E4\uC6B4\uB85C\uB4DC'}
                          </button>
                        )}
                      </div>
                    </div>

                    {attachment.type === 'pdf' && (
                      <div className="mt-4 overflow-hidden rounded-lg border border-sky-100 bg-white">
                        <PdfCanvasViewer
                          url={attachment.url}
                          onDownload={
                            ngAccess
                              ? () => window.open(attachment.url, '_blank', 'noopener,noreferrer')
                              : () =>
                                  setAccessNotice(downloadBlockedNotice)
                          }
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          </>
        </article>
      </div>
    </main>
  );
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
      (cmsTabs.length > 0 ? cmsTabs : (allResourceTabs as any))
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
  const currentSection = pathParts[1];
  const postId = currentSection === 'post' ? pathParts[2] : null;
  const editId = currentSection === 'edit' ? pathParts[2] : null;
  const currentDepartment = mappedDepartments.find((department) => department.slug === currentSection);

  let content: React.ReactNode = <IntroPage sections={introSections} departments={mappedDepartments} />;

  if (postId) {
    content = <NextGenerationPostDetail id={postId} />;
  } else if (editId) {
    content = <EditPost postId={editId} nextGenerationMode />;
  } else if (currentSection === 'me') {
    content = <NextGenerationMyPage />;
  } else if (currentSection === 'create') {
    content = <NextGenerationCreatePost />;
  } else if (currentDepartment) {
    const departmentTabs = mappedTabs.filter((tab) => tab.departmentSlug === currentDepartment.slug);
    const weeklyResourceIds = departmentTabs.filter((tab) => tab.useWeekKey && !tab.isWeeklyGroup).map((tab) => tab.id);
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
                summary: '말씀과 신앙의 질문을 자유롭게 남겨 보세요',
                content: <NextGenerationQA compact department="young-adults" />,
              },
              {
                id: 'today',
                icon: <BookOpen size={18} />,
                label: '오늘의 말씀',
                summary: '맥체인 성경 읽기와 묵상 가이드',
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
                content: <NextGenerationQA compact department="elementary" />,
              },
              {
                id: 'bible',
                icon: <Library size={18} />,
                label: '성경 읽기 기록표',
                summary: '한 권씩 읽을 때마다 책장에 색이 채워져요',
                content: <BibleReadingChart />,
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
