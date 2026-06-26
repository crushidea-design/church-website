// My page (profile, notifications, bible reading) + YoungAdultsPage
// wrapper extracted from NextGeneration.tsx.
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  CheckCircle,
  HelpCircle,
  Loader2,
  Lock,
  MessageSquare,
  Plus,
  Users,
} from 'lucide-react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  NEXT_GENERATION_DEPARTMENTS,
  NextGenerationMember,
  useNextGenerationAuth,
} from '../../lib/nextGenerationAuth';
import {
  NEXT_GENERATION_PATH,
  formatShortDate,
} from '../../lib/nextGenerationResources';
import {
  getMemberDepartments,
  getPrimaryDepartment,
  hasDepartment,
} from '../../lib/nextGenerationRoles';
import BibleReadingChart from '../../pages/BibleReadingChart';
import NextGenerationHighlightBand from '../../components/NextGenerationHighlightBand';
import NextGenerationQA from '../../pages/NextGenerationQA';
import NextGenerationTodayWord from '../../pages/NextGenerationTodayWord';
import { ParentRoleCards, TeacherRoleCards } from '../word-fruit/MyPageRoleCards';
import ParentOnboardingModal from '../word-fruit/ParentOnboardingModal';
import ResourceLibraryPage from './ResourceLibraryPage';
import { youngAdultResourceTabs, youngAdultsImage } from './sharedConstants';

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

function ParentChildrenCard({
  member,
  onOpen,
}: {
  member: NextGenerationMember | null;
  onOpen: () => void;
}) {
  const proxyChildren = member?.proxyChildren ?? [];
  const proxyNames = new Set(proxyChildren.map((child) => child.name.replace(/\s+/g, '').trim()).filter(Boolean));
  const childNames = (member?.childNames ?? [])
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && !proxyNames.has(name.replace(/\s+/g, '').trim()));
  const linkedCount = member?.childIds?.length ?? 0;

  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-emerald-950">우리 아이</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">자녀 등록과 수정은 여기에서 할 수 있어요.</p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700"
        >
          <Plus size={13} />
          추가/수정
        </button>
      </div>

      {proxyChildren.length === 0 && childNames.length === 0 && linkedCount === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-slate-500">
          아직 등록된 자녀가 없어요. 버튼을 눌러 자녀를 추가해 주세요.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {proxyChildren.map((child) => (
            <div key={child.id} className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
              <p className="text-sm font-black text-emerald-950">{child.name}</p>
              <p className="mt-0.5 text-xs font-bold text-emerald-700">부모 계정에서 관리</p>
            </div>
          ))}
          {childNames.map((name) => (
            <div key={name} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2">
              <p className="text-sm font-black text-emerald-950">{name}</p>
              <p className="mt-0.5 text-xs font-bold text-sky-700">학생 계정 가입/연결 대기</p>
            </div>
          ))}
          {linkedCount > 0 && (
            <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
              학생 계정으로 연결된 자녀 {linkedCount}명
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function NextGenerationMyPage() {
  const [searchParams] = useSearchParams();
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
  const [showParentChildrenModal, setShowParentChildrenModal] = useState(false);
  const isFromDemo = searchParams.get('fromDemo') === '1';
  const demoReturnBanner = isFromDemo ? (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-emerald-900">실제 말씀기록표 화면을 시연 중입니다</p>
          <p className="mt-1 text-sm font-bold text-slate-600">
            내 페이지에서 말씀기록표를 확인한 뒤 다시 시연 코스로 돌아갈 수 있습니다.
          </p>
        </div>
        <Link
          to={`${NEXT_GENERATION_PATH}/demo`}
          className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700"
        >
          시연 코스로 돌아가기
        </Link>
      </div>
    </div>
  ) : null;

  const memberDepartments = getMemberDepartments(member);
  const primaryDepartment = getPrimaryDepartment(member);
  const roleLabel = memberDepartments.length > 1
    ? `${primaryDepartment} · ${memberDepartments.filter((department) => department !== primaryDepartment).join(', ')}`
    : member?.department || (isPastor ? '관리자' : '다음세대');
  const isStudentRole = hasDepartment(member, NEXT_GENERATION_DEPARTMENTS[3]);
  const isTeacherRole = hasDepartment(member, NEXT_GENERATION_DEPARTMENTS[1]);
  const isParentRole = hasDepartment(member, NEXT_GENERATION_DEPARTMENTS[2]);
  const isYoungAdultRole = hasDepartment(member, NEXT_GENERATION_DEPARTMENTS[0]);

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
        {demoReturnBanner}
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

      {demoReturnBanner}

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

          {isTeacherRole && <TeacherRoleCards />}

          {!isStudentRole && !isYoungAdultRole && !isTeacherRole && (
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
          {isParentRole && (
            <>
              <ParentChildrenCard member={member} onOpen={() => setShowParentChildrenModal(true)} />
              <ParentRoleCards />
            </>
          )}

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
      {showParentChildrenModal && (
        <ParentOnboardingModal onClose={() => setShowParentChildrenModal(false)} />
      )}
    </div>
  );
}

export function YoungAdultsPage() {
  return (
    <ResourceLibraryPage
      departmentSlug="young-adults"
      departmentName="청년부"
      image={youngAdultsImage}
      imageAlt="천로역정 특강 청년부 자료"
      badgeClassName="bg-sky-100 text-emerald-950"
      heroClassName="bg-white"
      title="복음 안에서 함께 걸어갑니다"
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
          ]}
        />
      }
    />
  );
}
