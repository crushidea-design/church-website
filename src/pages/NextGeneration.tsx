import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import {
  ArrowLeft,
  BookMarked,
  CalendarDays,
  ClipboardList,
  Download,
  Edit3,
  FileText,
  HeartHandshake,
  Loader2,
  Plus,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { db, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { generateSortOrder } from '../lib/sortUtils';
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

const NEXT_GENERATION_CATEGORY = 'next_generation';
const NEXT_GENERATION_PATH = '/next';

const introImage = '/next-generation-2026.png';
const elementaryImage = '/next-generation-2026.png';
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
    description: '이번 주 말씀 흐름과 교사의 진행 메모를 함께 봅니다.',
    icon: FileText,
  },
  {
    id: 'elementary_workbook',
    name: '공과',
    description: '아이들과 함께 나눌 질문과 활동지를 확인합니다.',
    icon: BookMarked,
  },
  {
    id: 'elementary_guide',
    name: '공과 가이드',
    description: '반별 상황에 맞게 공과를 이끌어 갈 안내를 담습니다.',
    icon: ClipboardList,
  },
  {
    id: 'family_column',
    name: '예배를 잇는 가정',
    description: '부모님과 가정에서 이어 갈 묵상과 대화를 나눕니다.',
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
  authorName?: string;
  createdAt?: any;
  updatedAt?: any;
  pdfUrl?: string;
  pdfName?: string;
  attachments?: MaterialAttachment[];
  category?: string;
  [key: string]: any;
}

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

const getResourceLabel = (id?: string) => {
  return allResourceTabs.find((tab) => tab.id === id)?.name || '다음세대 자료';
};

const getResourceDepartmentPath = (id?: string) => {
  if (youngAdultResourceTabs.some((tab) => tab.id === id)) {
    return `${NEXT_GENERATION_PATH}/young-adults`;
  }

  return `${NEXT_GENERATION_PATH}/elementary`;
};

const getResourceTab = (id?: string) => {
  return allResourceTabs.find((tab) => tab.id === id) || elementaryResourceTabs[0];
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

  const navItems = [
    { name: '다음세대 소개', path: NEXT_GENERATION_PATH },
    { name: '유초등부', path: `${NEXT_GENERATION_PATH}/elementary` },
    { name: '청년부', path: `${NEXT_GENERATION_PATH}/young-adults` },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link to={NEXT_GENERATION_PATH} className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-amber-100 shadow-sm">
            <img src="/next-generation-favicon.svg" alt="" className="h-12 w-12" />
          </span>
          <span className="flex w-[198px] flex-col">
            <span className="flex justify-between text-lg font-black leading-tight tracking-normal text-emerald-950">
              {Array.from('한우리교회 다음세대').map((char, index) => (
                <span key={`${char}-${index}`} className={char === ' ' ? 'w-2' : ''}>
                  {char}
                </span>
              ))}
            </span>
            <span className="mt-1 flex justify-between text-xs font-bold uppercase leading-none tracking-normal text-coral-700">
              {Array.from('GROWING IN THE COVENANT').map((char, index) => (
                <span key={`${char}-${index}`} className={char === ' ' ? 'w-1.5' : ''}>
                  {char}
                </span>
              ))}
            </span>
          </span>
        </Link>

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
      </div>
    </header>
  );
}

function IntroPage() {
  const introPillars = [
    {
      title: '예배 중심 교육',
      description:
        '다음세대 교육의 중심은 전세대가 함께 드리는 언약 공동체의 예배입니다. 아이들은 따로 떨어진 교육이 아니라, 온 교회가 함께 하나님 앞에 서는 예배 가운데 배우고 자라갑니다.',
    },
    {
      title: '가정과 동행',
      description:
        '교회는 가정을 대신하지 않고 함께 걸어갑니다. 배운 말씀이 가정에서도 이어져, 부모와 자녀가 함께 신앙 안에서 자라가도록 돕습니다.',
    },
    {
      title: '성경과 교리',
      description:
        '성경은 하나님께서 주신 말씀으로, 우리를 가르치고 바르게 하며 의로운 삶으로 자라가게 합니다. 우리는 이 말씀 위에 아이들이 서도록 돕고, 동시에 그 내용을 체계적으로 정리한 교리 교육을 통해 흔들리지 않는 신앙으로 자라가게 합니다.',
    },
  ];
  const [activePillar, setActivePillar] = useState<string | null>(null);
  const selectedPillar = introPillars.find((pillar) => pillar.title === activePillar);

  return (
    <div>
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-16">
          <div>
            <span className="mb-5 inline-flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm font-black text-emerald-950">
              <Sparkles size={18} />
              언약 안에서 자라가는 다음세대
            </span>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-normal text-emerald-950 sm:text-5xl">
              언약 안에서 이어지는 믿음의 세대
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
              한우리교회 다음세대는 언약 안에서 자라가는 아이들이 말씀과 예배 가운데 하나님을 바르게 배우도록 돕는 공동체입니다.
              우리는 예배 중심의 신앙교육을 지향하며, 교회 교육이 가정과 이어지도록 힘씁니다.
              성경과 교리 위에 다음세대를 세워, 하나님을 알고 사랑하며 순종하는 삶으로 자라가게 하는 것이 우리의 목표입니다.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {introPillars.map((pillar) => (
                <button
                  key={pillar.title}
                  type="button"
                  onClick={() => setActivePillar((current) => (current === pillar.title ? null : pillar.title))}
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
            {selectedPillar && (
              <div className="mt-4 rounded-lg border border-emerald-100 bg-white p-5 text-base leading-8 text-slate-700 shadow-sm">
                <h2 className="text-lg font-black text-emerald-950">{selectedPillar.title}</h2>
                <p className="mt-2">{selectedPillar.description}</p>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-sky-100 shadow-sm">
            <img
              src={introImage}
              alt="밝은 교실에서 함께 배우는 아이들"
              className="h-[340px] w-full object-cover sm:h-[420px]"
            />
          </div>
        </div>
      </section>

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

          <div className="grid gap-6 md:grid-cols-2">
            {sectionTabs.map((section) => (
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

interface ResourceLibraryPageProps {
  departmentName: string;
  image: string;
  imageAlt: string;
  badgeClassName: string;
  heroClassName: string;
  title: string;
  description: React.ReactNode;
  tabs: typeof elementaryResourceTabs;
}

function ResourceLibraryPage({
  departmentName,
  image,
  imageAlt,
  badgeClassName,
  heroClassName,
  title,
  description,
  tabs,
}: ResourceLibraryPageProps) {
  const { role, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeResource = searchParams.get('resource') || tabs[0].id;
  const [posts, setPosts] = useState<NextGenerationPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = !authLoading && role === 'admin';
  const activeTab = tabs.find((tab) => tab.id === activeResource) || tabs[0];
  const isWeeklyTab = activeTab.id === 'elementary_weekly';
  const currentWeekKey = useMemo(() => getCurrentSundayKey(), []);
  const ActiveIcon = activeTab.icon;

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      setError(null);

      try {
        const q = query(
          collection(db, 'posts'),
          where('category', '==', NEXT_GENERATION_CATEGORY),
          limit(200)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs
          .map((postDoc) => ({ id: postDoc.id, ...(postDoc.data() as object) }) as NextGenerationPost)
          .sort((a, b) => getCreatedAtTime(b.createdAt) - getCreatedAtTime(a.createdAt));

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
  }, []);

  const filteredPosts = useMemo(() => {
    if (isWeeklyTab) {
      return posts.filter((post) => (
        isElementaryWeeklyResource(post.subCategory) &&
        getPostWeekKey(post) === currentWeekKey
      ));
    }

    return posts.filter((post) => post.subCategory === activeTab.id);
  }, [posts, activeTab.id, currentWeekKey, isWeeklyTab]);

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

      <section className="bg-white py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  onClick={() => setSearchParams({ resource: tab.id })}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-3 text-sm font-black transition ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-sky-50 text-emerald-950 hover:bg-sky-100'
                  }`}
                >
                  <Icon size={18} />
                  {tab.name}
                </button>
              );
            })}
          </div>

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
            </div>

            {isAdmin && (
              <Link
                to={`${NEXT_GENERATION_PATH}/create?resource=${activeTab.id}`}
                className="inline-flex items-center justify-center rounded-lg bg-coral-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-coral-700"
              >
                <Plus size={18} className="mr-2" />
                자료 올리기
              </Link>
            )}
          </div>

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
              <p className="mt-3 text-slate-700">이번 주 자료가 준비되면 이곳에 올라옵니다.</p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredPosts.map((post, index) => {
                const attachments = getPostAttachments(post);

                return (
                  <motion.article
                    key={post.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.04, 0.25) }}
                    className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <Link to={`${NEXT_GENERATION_PATH}/post/${post.id}`} className="block">
                      <span className="mb-4 inline-flex rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-black text-emerald-950">
                        {getResourceLabel(post.subCategory)}
                      </span>
                      <h3 className="line-clamp-2 text-xl font-black leading-7 tracking-normal text-emerald-950">
                        {post.title}
                      </h3>
                      <p className="mt-3 line-clamp-3 min-h-16 text-sm leading-6 text-slate-700">
                        {getContentPreview(post.content)}
                      </p>
                      <div className="mt-5 flex items-center justify-between gap-3 border-t border-sky-50 pt-4 text-sm text-slate-600">
                        <span>{formatDate(post.createdAt)}</span>
                        {attachments.length > 0 && (
                          <span className="inline-flex items-center gap-1 font-bold text-coral-700">
                            <Download size={16} />
                            자료 {attachments.length}
                          </span>
                        )}
                      </div>
                    </Link>
                  </motion.article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function YoungAdultsPage() {
  return (
    <ResourceLibraryPage
      departmentName="청년부"
      image={youngAdultsImage}
      imageAlt="천로역정 특강 청년부 자료"
      badgeClassName="bg-sky-100 text-emerald-950"
      heroClassName="bg-white"
      title="복음 안에서 함께 질문하고 함께 걸어갑니다"
      description="천로역정 특강과 수련회 자료를 한곳에서 확인합니다. 청년들이 말씀 앞에서 질문하고, 공동체 안에서 믿음의 길을 함께 걸어갑니다."
      tabs={youngAdultResourceTabs}
    />
  );
}

function NextGenerationCreatePost() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const activeTab = getResourceTab(searchParams.get('resource') || undefined);
  const isWeeklyCreate = activeTab.id === 'elementary_weekly';
  const [selectedResourceId, setSelectedResourceId] = useState(
    isWeeklyCreate ? elementaryWeeklyResourceTabs[0].id : activeTab.id
  );
  const [weekKey, setWeekKey] = useState(getCurrentSundayKey());
  const backPath = `${getResourceDepartmentPath(activeTab.id)}?resource=${activeTab.id}`;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [materialFiles, setMaterialFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const usesWeekKey = isWeeklyCreate || isElementaryWeeklyResource(selectedResourceId);

  useEffect(() => {
    setSelectedResourceId(isWeeklyCreate ? elementaryWeeklyResourceTabs[0].id : activeTab.id);
  }, [activeTab.id, isWeeklyCreate]);

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

      if (attachments.length > 0) {
        postData.pdfBase64 = serializeMaterialAttachments(attachments);
      }

      if (firstPdfAttachment) {
        postData.pdfUrl = firstPdfAttachment.url;
        postData.pdfName = firstPdfAttachment.name;
      }

      const isLongContent = new TextEncoder().encode(content).length > 1400;
      if (isLongContent) {
        postData.content = content.substring(0, 400);
        postData.isLongContent = true;
        postData.fullContentLength = content.length;
      }

      const docRef = await addDoc(collection(db, 'posts'), postData);

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

      navigate(`${NEXT_GENERATION_PATH}/post/${docRef.id}`);
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

        <section className="rounded-lg border border-white bg-white p-6 shadow-sm sm:p-8 lg:p-10">
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
                  {elementaryWeeklyResourceTabs.map((tab) => (
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

            <div>
              <label htmlFor="next-generation-content" className="mb-2 block text-sm font-black text-emerald-950">
                내용
              </label>
              <textarea
                id="next-generation-content"
                rows={14}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="block w-full rounded-lg border border-sky-100 bg-sky-50 p-4 text-sm leading-7 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                placeholder="자료 안내와 함께 나눌 내용을 입력하세요"
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
  const [post, setPost] = useState<NextGenerationPost | null>(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = role === 'admin';

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
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-sky-50">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-700" />
      </div>
    );
  }

  if (!post) return null;

  const backPath = `${getResourceDepartmentPath(post.subCategory)}?resource=${post.subCategory || elementaryResourceTabs[0].id}`;
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
            <span className="inline-flex w-fit rounded-lg bg-amber-100 px-3 py-2 text-sm font-black text-emerald-950">
              {getResourceLabel(post.subCategory)}
            </span>
            <span className="text-sm font-bold text-slate-500">{formatDate(post.createdAt, 'yyyy.MM.dd HH:mm')}</span>
          </div>

          <h1 className="text-3xl font-black leading-tight tracking-normal text-emerald-950 sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-3 text-sm font-bold text-slate-500">{post.authorName}</p>

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
                      </div>
                    </div>

                    {attachment.type === 'pdf' && (
                      <div className="mt-4 overflow-hidden rounded-lg border border-sky-100 bg-white">
                        <PdfCanvasViewer url={attachment.url} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>
    </main>
  );
}

export default function NextGeneration() {
  useNextGenerationHead();

  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const currentSection = pathParts[1];
  const postId = currentSection === 'post' ? pathParts[2] : null;
  const editId = currentSection === 'edit' ? pathParts[2] : null;

  let content = <IntroPage />;

  if (postId) {
    content = <NextGenerationPostDetail id={postId} />;
  } else if (editId) {
    content = <EditPost postId={editId} nextGenerationMode />;
  } else if (currentSection === 'create') {
    content = <NextGenerationCreatePost />;
  } else if (currentSection === 'elementary') {
    content = (
      <ResourceLibraryPage
        departmentName="유초등부"
        image={elementaryImage}
        imageAlt="함께 배우는 유초등부"
        badgeClassName="bg-white text-coral-800"
        heroClassName="bg-amber-50"
        title="아이들의 예배가 한 주의 삶으로 이어지도록"
        description={
          <>
            이번 주 말씀, 공과, 교사용 가이드, 부모 칼럼을 한곳에서 확인합니다.
            교사는 예배를 준비하고, 가정은 들은 말씀을 다시 이어 갑니다.
          </>
        }
        tabs={elementaryResourceTabs}
      />
    );
  } else if (currentSection === 'young-adults') {
    content = <YoungAdultsPage />;
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
