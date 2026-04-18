import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import {
  ArrowLeft,
  BookMarked,
  CalendarDays,
  ClipboardList,
  Download,
  Edit3,
  FileText,
  GraduationCap,
  HeartHandshake,
  Loader2,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/utils';
import PdfCanvasViewer from '../components/PdfCanvasViewer';

const NEXT_GENERATION_CATEGORY = 'next_generation';

const introImage = '/next-generation-2026.png';
const elementaryImage = '/next-generation-2026.png';
const youngAdultsImage = '/young-adults-pilgrims-progress.png';

const elementaryResourceTabs = [
  {
    id: 'elementary_script',
    name: '이번주 강의원고',
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

const sectionTabs = [
  {
    id: 'elementary',
    name: '유초등부',
    path: '/next-generation/elementary',
    image: elementaryImage,
    copy: '말씀을 듣고, 질문하고, 삶으로 이어 가는 어린이 공동체입니다.',
    icon: Sparkles,
  },
  {
    id: 'young-adults',
    name: '청년부',
    path: '/next-generation/young-adults',
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

const getResourceLabel = (id?: string) => {
  return allResourceTabs.find((tab) => tab.id === id)?.name || '다음세대 자료';
};

const getResourceDepartmentPath = (id?: string) => {
  if (youngAdultResourceTabs.some((tab) => tab.id === id)) {
    return '/next-generation/young-adults';
  }

  return '/next-generation/elementary';
};

const getContentPreview = (content?: string) => {
  if (!content) return '함께 확인할 자료가 준비되어 있습니다.';
  return content.replace(/\s+/g, ' ').trim().slice(0, 110);
};

function NextGenerationHeader() {
  const location = useLocation();

  const navItems = [
    { name: '다음세대 소개', path: '/next-generation' },
    { name: '유초등부', path: '/next-generation/elementary' },
    { name: '청년부', path: '/next-generation/young-adults' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link to="/next-generation" className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-300 text-emerald-900 shadow-sm">
            <GraduationCap size={28} />
          </span>
          <span>
            <span className="block text-lg font-black tracking-normal text-emerald-950">함께 지어져가는 다음세대</span>
            <span className="block text-xs font-bold uppercase tracking-normal text-coral-700">Growing in the Word</span>
          </span>
        </Link>

        <nav className="flex gap-2 overflow-x-auto pb-1 lg:pb-0" aria-label="다음세대">
          {navItems.map((item) => {
            const isActive =
              item.path === '/next-generation'
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
  return (
    <div>
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-16">
          <div>
            <span className="mb-5 inline-flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm font-black text-emerald-950">
              <Sparkles size={18} />
              말씀 안에서 자라가는 다음 세대
            </span>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-normal text-emerald-950 sm:text-5xl">
              예배와 가정과 삶이 이어지는 다음세대 공동체
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
              다음세대 교육은 아이들이 하나님을 아는 기쁨을 배우고,
              말씀을 자기 언어로 붙들며, 교회와 가정 안에서 믿음의 걸음을 이어가도록 돕습니다.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {['말씀 중심', '예배의 기쁨', '가정과 연결'].map((item) => (
                <div key={item} className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-center text-sm font-black text-emerald-950">
                  {item}
                </div>
              ))}
            </div>
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

  const filteredPosts = useMemo(
    () => posts.filter((post) => post.subCategory === activeTab.id),
    [posts, activeTab.id]
  );

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
            </div>

            {isAdmin && (
              <Link
                to={`/create-post?type=${NEXT_GENERATION_CATEGORY}&subCategory=${activeTab.id}`}
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
              {filteredPosts.map((post, index) => (
                <motion.article
                  key={post.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.04, 0.25) }}
                  className="rounded-lg border border-sky-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <Link to={`/next-generation/post/${post.id}`} className="block">
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
                      {post.pdfUrl && (
                        <span className="inline-flex items-center gap-1 font-bold text-coral-700">
                          <Download size={16} />
                          PDF
                        </span>
                      )}
                    </div>
                  </Link>
                </motion.article>
              ))}
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
          navigate('/next-generation/elementary', { replace: true });
          return;
        }

        const data = { id: snapshot.id, ...snapshot.data() } as NextGenerationPost;
        if (data.category !== NEXT_GENERATION_CATEGORY) {
          navigate('/next-generation/elementary', { replace: true });
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
              to={`/edit-post/${post.id}`}
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

          {post.pdfUrl && (
            <div className="mt-10 border-t border-sky-100 pt-8">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="flex items-center text-xl font-black text-emerald-950">
                  <FileText className="mr-2 text-coral-700" />
                  첨부된 PDF 문서
                </h2>
                <a
                  href={post.pdfUrl}
                  download={post.pdfName || 'next-generation.pdf'}
                  className="inline-flex w-fit items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
                >
                  <Download size={16} className="mr-2" />
                  다운로드
                </a>
              </div>
              <div className="overflow-hidden rounded-lg border border-sky-100 bg-white">
                <PdfCanvasViewer url={post.pdfUrl} />
              </div>
            </div>
          )}
        </article>
      </div>
    </main>
  );
}

export default function NextGeneration() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const currentSection = pathParts[1];
  const postId = currentSection === 'post' ? pathParts[2] : null;

  let content = <IntroPage />;

  if (postId) {
    content = <NextGenerationPostDetail id={postId} />;
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
          <span>함께 지어져가는 다음세대</span>
          <span className="text-emerald-100">말씀을 배우고, 예배를 사랑하고, 삶으로 이어갑니다.</span>
        </div>
      </footer>
    </div>
  );
}
