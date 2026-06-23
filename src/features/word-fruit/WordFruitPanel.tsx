import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, Loader2, Sparkles, BookOpen, AlertCircle, Settings, History } from 'lucide-react';
import { useNextGenerationAuth } from '../../lib/nextGenerationAuth';
import { hasDepartment } from '../../lib/nextGenerationRoles';
import {
  checkInToday,
  fruitStageOf,
  getTodayKey,
  getWeekId,
  isCheckAllowedDay,
  subscribeAllProgress,
  subscribeMyProgress,
  subscribeProgressForGroups,
  subscribeProgressForUser,
  subscribeProgressForUsers,
  subscribePublishedFruits,
  subscribeWeeklyWordFruit,
} from './api';
import { GUIDE_MESSAGE_DEFAULT, TOP_MESSAGE_DEFAULT, WeeklyWordFruit, WordFruitProgress } from './types';
import WordFruitAdmin from './WordFruitAdmin';
import { TeacherView } from './WordFruitTeacherView';
import ParentView from './WordFruitParentView';
import {
  ArchiveList,
  CardModal,
  CommunitySummary,
  InfoTile,
  StudentTree,
} from './WordFruitDisplayParts';

export default function WordFruitPanel() {
  const { user, member, isPastor } = useNextGenerationAuth();
  const currentWeekId = useMemo(() => getWeekId(), []);
  const [searchParams] = useSearchParams();
  const requestedWeekId = searchParams.get('wfWeekId') || '';
  const [selectedWeekId, setSelectedWeekId] = useState(requestedWeekId || currentWeekId);
  const isCurrentWeek = selectedWeekId === currentWeekId;

  // Honor URL changes to wfWeekId (e.g. from the weekly curriculum page)
  useEffect(() => {
    if (requestedWeekId && requestedWeekId !== selectedWeekId) {
      setSelectedWeekId(requestedWeekId);
    }
    // selectedWeekId is intentionally not a dep — only react to URL changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedWeekId]);
  const [fruit, setFruit] = useState<WeeklyWordFruit | null>(null);
  const [fruitLoading, setFruitLoading] = useState(true);
  const [progress, setProgress] = useState<WordFruitProgress | null>(null);
  const [myAllProgress, setMyAllProgress] = useState<WordFruitProgress[]>([]);
  const [childProgresses, setChildProgresses] = useState<WordFruitProgress[]>([]);
  const [allProgress, setAllProgress] = useState<WordFruitProgress[]>([]);
  const [pastFruits, setPastFruits] = useState<WeeklyWordFruit[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [cardModal, setCardModal] = useState<null | { cardOrder: 1 | 2 | 3 }>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isParent = hasDepartment(member, '학부모');
  const isTeacher = hasDepartment(member, '교사') && member?.role === 'member';
  const childIds = useMemo(() => member?.childIds ?? [], [member?.childIds]);
  const proxyChildren = useMemo(() => member?.proxyChildren ?? [], [member?.proxyChildren]);
  const combinedChildUserIds = useMemo(
    () => [...childIds, ...proxyChildren.map((p) => p.id)],
    [childIds, proxyChildren],
  );
  const teacherGroupIds = useMemo(() => member?.groupIds ?? [], [member?.groupIds]);
  const teacherIsScoped = isTeacher && teacherGroupIds.length > 0;

  useEffect(() => {
    setFruitLoading(true);
    return subscribeWeeklyWordFruit(selectedWeekId, (f) => {
      setFruit(f);
      setFruitLoading(false);
    }, () => setFruitLoading(false));
  }, [selectedWeekId]);

  useEffect(() => {
    return subscribePublishedFruits(setPastFruits, () => setPastFruits([]));
  }, []);

  useEffect(() => {
    if (!isParent || combinedChildUserIds.length === 0) {
      setChildProgresses([]);
      return;
    }
    return subscribeProgressForUsers(selectedWeekId, combinedChildUserIds, setChildProgresses);
  }, [selectedWeekId, isParent, combinedChildUserIds]);

  useEffect(() => {
    if (!user) {
      setProgress(null);
      return;
    }
    return subscribeMyProgress(selectedWeekId, user.uid, setProgress);
  }, [selectedWeekId, user]);

  // Pull every progress doc owned by the current user so we can show a
  // monthly recap on the student tree. Only meaningful for student accounts.
  useEffect(() => {
    if (!user || !hasDepartment(member, '학생')) {
      setMyAllProgress([]);
      return;
    }
    return subscribeProgressForUser(user.uid, setMyAllProgress);
  }, [user, member]);

  useEffect(() => {
    if (isPastor) {
      return subscribeAllProgress(selectedWeekId, setAllProgress);
    }
    if (isTeacher) {
      if (teacherIsScoped) {
        return subscribeProgressForGroups(selectedWeekId, teacherGroupIds, setAllProgress);
      }
      return subscribeAllProgress(selectedWeekId, setAllProgress);
    }
    setAllProgress([]);
    return;
  }, [selectedWeekId, isPastor, isTeacher, teacherIsScoped, teacherGroupIds]);

  const isStudent = hasDepartment(member, '학생');
  const todayKey = getTodayKey();
  const isAllowedDay = isCheckAllowedDay();
  const canCheckToday = isCurrentWeek && isAllowedDay;
  const alreadyToday = !!progress && progress.checkedDates.includes(todayKey);
  const stage = (progress ? fruitStageOf(progress.checkCount) : 0) as 0 | 1 | 2 | 3;
  const nextCardOrder: 1 | 2 | 3 = ((progress?.checkCount ?? 0) >= 2 ? 3 : (progress?.checkCount ?? 0) === 1 ? 2 : 1);

  const handleCheckClick = () => {
    if (!progress || alreadyToday) return;
    setError('');
    setCardModal({ cardOrder: nextCardOrder });
  };

  const confirmCheck = async () => {
    if (!progress) return;
    setSubmitting(true);
    setError('');
    try {
      await checkInToday(progress);
      setCardModal(null);
    } catch (e: any) {
      const code = e?.message;
      const serverMsg = e?.serverMessage;
      if (code === 'ALREADY_CHECKED_TODAY') {
        setError(serverMsg || '오늘은 이미 열매를 돌보았어요.');
      } else if (code === 'CHECK_NOT_ALLOWED_SUNDAY') {
        setError(serverMsg || '주일은 새 말씀 열매를 받는 날이에요.');
      } else if (code === 'PROGRESS_NOT_FOUND') {
        setError(serverMsg || '이번 주 작은 순종이 등록되지 않았어요.');
      } else {
        setError(serverMsg || '체크 중 오류가 발생했어요. 다시 시도해 주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderHeader = () => (
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
        <Sparkles size={24} />
      </div>
      <div className="flex-1">
        <h2 className="text-2xl font-black tracking-normal text-emerald-950">이번 주 말씀 열매</h2>
        <p className="mt-1 text-sm font-semibold text-emerald-700">{fruit?.topMessage || TOP_MESSAGE_DEFAULT}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{fruit?.guideMessage || GUIDE_MESSAGE_DEFAULT}</p>
        {!isCurrentWeek && fruit && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
            지난 주차 보기 ({fruit.startDate} ~ {fruit.endDate})
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setShowArchive((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
        >
          <History size={14} /> {showArchive ? '닫기' : '지난주'}
        </button>
        {isPastor && (
          <button
            type="button"
            onClick={() => setShowAdmin((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
          >
            <Settings size={14} /> {showAdmin ? '닫기' : '관리'}
          </button>
        )}
      </div>
    </div>
  );

  const renderCommonInfo = () => (
    <div className="grid gap-3 sm:grid-cols-2">
      <InfoTile label="이번 주 강의" value={fruit?.title || '준비 중'} />
      <InfoTile label="성경 본문" value={fruit?.passage || '-'} />
    </div>
  );

  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
      {renderHeader()}

      {showArchive && (
        <ArchiveList
          fruits={pastFruits}
          selectedWeekId={selectedWeekId}
          onSelect={(weekId) => {
            setSelectedWeekId(weekId);
            setShowArchive(false);
          }}
          onResetToCurrent={() => {
            setSelectedWeekId(currentWeekId);
            setShowArchive(false);
          }}
          currentWeekId={currentWeekId}
        />
      )}

      <div className="mt-5">
        {fruitLoading ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 className="mr-2 animate-spin" size={16} /> 불러오는 중...
          </div>
        ) : !fruit || fruit.status !== 'published' ? (
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-800">
            {isPastor
              ? '이번 주 말씀 열매가 아직 게시되지 않았습니다. 우측 상단의 “관리” 버튼으로 등록해 주세요.'
              : '이번 주 말씀 열매가 아직 준비되고 있어요. 곧 다시 만나요.'}
          </div>
        ) : (
          <>
            {renderCommonInfo()}

            {fruit.memoryVerse && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <BookOpen size={18} className="mt-0.5 shrink-0 text-emerald-700" />
                <div>
                  <p className="text-xs font-bold text-emerald-700">이번 주 말씀</p>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-emerald-900">
                    “{fruit.memoryVerse}”
                  </p>
                </div>
              </div>
            )}

            {/* Anonymous community summary (public) */}
            {fruit.aggregateMessage && (
              <CommunitySummary fruit={fruit} />
            )}

            {/* Personal area */}
            {!user ? (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                <div className="flex items-center gap-2 font-bold text-slate-700">
                  <Lock size={16} /> 내 말씀 열매 나무
                </div>
                <p className="mt-2 leading-relaxed">
                  내 말씀 열매 나무는 로그인 후 확인할 수 있어요.
                </p>
              </div>
            ) : isStudent ? (
              <StudentTree
                fruit={fruit}
                progress={progress}
                stage={stage}
                alreadyToday={alreadyToday}
                canCheck={canCheckToday}
                onCheck={handleCheckClick}
                myAllProgress={myAllProgress}
              />
            ) : isTeacher ? (
              <TeacherView
                weekId={selectedWeekId}
                allProgress={allProgress}
                teacherGroupIds={teacherGroupIds}
                canEdit={isCurrentWeek}
              />
            ) : isParent ? (
              <ParentView
                fruit={fruit}
                weekId={selectedWeekId}
                childProgresses={childProgresses}
                childIds={childIds}
                proxyChildren={member?.proxyChildren ?? []}
                canEdit={isCurrentWeek}
              />
            ) : isPastor ? (
              <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm text-emerald-800">
                관리자 계정입니다. 위의 “관리” 버튼으로 이번 주 말씀 열매를 등록하고 아이별 작은 순종을 입력해 주세요.
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                자녀(학생) 또는 학부모 계정으로 로그인하면 자기 나무를 확인할 수 있어요.
              </div>
            )}

            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle size={14} /> {error}
              </div>
            )}
          </>
        )}
      </div>

      {/* Card confirmation modal */}
      {cardModal && fruit && progress && (
        <CardModal
          card={fruit.cards.find((c) => c.order === cardModal.cardOrder) ?? fruit.cards[0]}
          submitting={submitting}
          onConfirm={confirmCheck}
          onCancel={() => setCardModal(null)}
        />
      )}

      {showAdmin && isPastor && (
        <div className="mt-6 border-t border-emerald-100 pt-6">
          <WordFruitAdmin
            weekId={selectedWeekId}
            existingFruit={fruit}
            allProgress={allProgress}
          />
        </div>
      )}
    </div>
  );
}
