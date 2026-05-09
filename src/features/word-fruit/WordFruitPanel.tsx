import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, Loader2, Sparkles, BookOpen, AlertCircle, Settings, History } from 'lucide-react';
import { useNextGenerationAuth } from '../../lib/nextGenerationAuth';
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
import WordFruitTree, { stageMessage } from './WordFruitTree';
import WordFruitAdmin from './WordFruitAdmin';

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

  const isParent = member?.department === '학부모';
  const isTeacher = member?.department === '교사' && member?.role === 'member';
  const childIds = useMemo(() => member?.childIds ?? [], [member?.childIds]);
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
    if (!isParent || childIds.length === 0) {
      setChildProgresses([]);
      return;
    }
    return subscribeProgressForUsers(selectedWeekId, childIds, setChildProgresses);
  }, [selectedWeekId, isParent, childIds]);

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
    if (!user || member?.department !== '학생') {
      setMyAllProgress([]);
      return;
    }
    return subscribeProgressForUser(user.uid, setMyAllProgress);
  }, [user, member?.department]);

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

  const isStudent = member?.department === '학생';
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
            ) : isParent ? (
              <ParentView fruit={fruit} childProgresses={childProgresses} childIds={childIds} />
            ) : isTeacher ? (
              <TeacherView allProgress={allProgress} />
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

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

function StudentTree({
  fruit,
  progress,
  stage,
  alreadyToday,
  canCheck,
  onCheck,
  myAllProgress,
}: {
  fruit: WeeklyWordFruit;
  progress: WordFruitProgress | null;
  stage: 0 | 1 | 2 | 3;
  alreadyToday: boolean;
  canCheck: boolean;
  onCheck: () => void;
  myAllProgress: WordFruitProgress[];
}) {
  const completed = !!progress?.completed;
  const monthly = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const monthPrefix = `${yyyy}-${mm}`;
    let monthRipened = 0;
    let totalRipened = 0;
    myAllProgress.forEach((p) => {
      if (!p.completed) return;
      totalRipened += 1;
      // A fruit is "this month" if any check landed in this calendar month.
      if ((p.checkedDates ?? []).some((d) => d.startsWith(monthPrefix))) {
        monthRipened += 1;
      }
    });
    return { monthRipened, totalRipened };
  }, [myAllProgress]);

  return (
    <div className="mt-5 rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50/60 to-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-black text-emerald-950">이번 주 나의 말씀 열매</h3>
        {(monthly.monthRipened > 0 || monthly.totalRipened > 0) && (
          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
            {monthly.monthRipened > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
                이번 달 익은 열매 {monthly.monthRipened}개 🌳
              </span>
            )}
            {monthly.totalRipened > monthly.monthRipened && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                지금까지 모은 열매 {monthly.totalRipened}개
              </span>
            )}
          </div>
        )}
      </div>

      {!progress ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          이번 주 나의 작은 순종이 아직 등록되지 않았어요. 선생님께 문의해 주세요.
        </p>
      ) : (
        <>
          <div className="mt-2 rounded-lg border border-emerald-100 bg-white p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">나의 작은 순종</p>
            <p className="mt-1 text-sm font-bold text-emerald-900">{progress.practice}</p>
          </div>

          <div className="mt-4">
            <WordFruitTree stage={stage} fruitName={fruit.fruitName} />
          </div>

          <p className="mt-2 text-center text-sm font-semibold text-emerald-800">
            {stageMessage(stage)}
          </p>
          <p className="mt-1 text-center text-xs text-emerald-700">
            이번 주 체크 {progress.checkCount}/3
          </p>

          {completed ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-900">
              하나님께서 이번 주에도 내 삶에 열매를 맺게 하셨어요.
            </div>
          ) : !canCheck ? (
            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4 text-center text-sm text-amber-800">
              {/* Sunday: new fruit day; Past week: read-only */}
              {new Date().getDay() === 0
                ? '주일은 새 말씀 열매를 받는 날이에요. 내일부터 다시 작은 순종을 실천해 보아요.'
                : '지난 주차는 기록을 보기만 할 수 있어요.'}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-emerald-100 bg-white p-4">
              <p className="text-center text-sm text-slate-700">
                오늘도 내가 정한 작은 순종을 실천했나요?
              </p>
              <button
                type="button"
                onClick={onCheck}
                disabled={alreadyToday}
                className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {alreadyToday ? '오늘은 이미 열매를 돌보았어요' : '오늘 실천했어요'}
              </button>
              {alreadyToday && (
                <p className="mt-2 text-center text-xs text-slate-500">
                  내일 다시 말씀을 기억하며 실천해 보아요.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CardModal({
  card,
  submitting,
  onConfirm,
  onCancel,
}: {
  card: WeeklyWordFruit['cards'][number];
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">
          {card.order}회차 카드
        </p>
        <h4 className="mt-1 text-lg font-black text-emerald-950">{card.title}</h4>
        {card.summary && (
          <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm leading-relaxed text-emerald-900">
            {card.summary}
          </p>
        )}
        {card.question && (
          <div className="mt-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">오늘의 질문</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-800">{card.question}</p>
          </div>
        )}
        {card.prayer && (
          <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">짧은 기도</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-900">{card.prayer}</p>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? '저장 중...' : '네, 오늘 실천했어요'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            아직 실천하지 못했어요
          </button>
          <p className="text-center text-xs text-slate-500">
            괜찮아요. 오늘 다시 말씀을 기억하며 작은 순종을 실천해 보아요.
          </p>
        </div>
      </div>
    </div>
  );
}

function ArchiveList({
  fruits,
  selectedWeekId,
  currentWeekId,
  onSelect,
  onResetToCurrent,
}: {
  fruits: WeeklyWordFruit[];
  selectedWeekId: string;
  currentWeekId: string;
  onSelect: (weekId: string) => void;
  onResetToCurrent: () => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, WeeklyWordFruit[]>();
    fruits.forEach((f) => {
      const key = (f.startDate || f.weekId).slice(0, 7) || '기타';
      const list = map.get(key) ?? [];
      list.push(f);
      map.set(key, list);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [fruits]);

  return (
    <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-emerald-900">지난 주 말씀 열매</p>
        {selectedWeekId !== currentWeekId && (
          <button
            type="button"
            onClick={onResetToCurrent}
            className="text-xs font-bold text-emerald-700 underline-offset-2 hover:underline"
          >
            이번 주로 돌아가기
          </button>
        )}
      </div>
      {fruits.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">아직 게시된 지난 말씀 열매가 없어요.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {grouped.map(([month, list]) => (
            <div key={month}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">{month}</p>
              <ul className="mt-1 space-y-1">
                {list.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(f.weekId)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                        selectedWeekId === f.weekId
                          ? 'border-emerald-400 bg-white'
                          : 'border-slate-200 bg-white/70 hover:border-emerald-300'
                      }`}
                    >
                      <p className="font-bold text-emerald-950">{f.title || '(제목 없음)'}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {f.weekId} · {f.passage || '-'} · {f.fruitName || '-'}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ParentView({
  fruit,
  childProgresses,
  childIds,
}: {
  fruit: WeeklyWordFruit;
  childProgresses: WordFruitProgress[];
  childIds: string[];
}) {
  if (childIds.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
        자녀 계정 연결이 아직 되어 있지 않아요. 관리자에게 연결을 요청해 주세요.
      </div>
    );
  }
  if (childProgresses.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        이번 주 자녀의 작은 순종이 아직 등록되지 않았어요.
      </div>
    );
  }
  return (
    <div className="mt-5 space-y-3">
      <h3 className="text-base font-black text-emerald-950">우리 아이 말씀 열매</h3>
      {childProgresses.map((p) => {
        const stage = (p.completed ? 3 : Math.min(p.checkCount, 3)) as 0 | 1 | 2 | 3;
        return (
          <div key={p.id} className="rounded-xl border border-emerald-100 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="font-bold text-emerald-950">{p.childName}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  p.completed
                    ? 'bg-emerald-100 text-emerald-800'
                    : p.checkCount > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {p.completed ? '완료' : p.checkCount > 0 ? '익어가는 중' : '자라는 중'}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{p.practice}</p>
            <p className="mt-1 text-xs text-slate-500">체크 {Math.min(p.checkCount, 3)}/3 · {stageMessage(stage)}</p>
          </div>
        );
      })}
      <p className="text-xs text-slate-400">{fruit.weekId} 기준</p>
    </div>
  );
}

function TeacherView({ allProgress }: { allProgress: WordFruitProgress[] }) {
  if (allProgress.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        이번 주 등록된 학생 진행이 없어요.
      </div>
    );
  }
  const completed = allProgress.filter((p) => p.completed).length;
  const notStarted = allProgress.filter((p) => p.checkCount === 0);
  const growing = allProgress.length - completed - notStarted.length;
  // After Tuesday with no check, surface a stronger nudge.
  const today = new Date();
  const weekday = today.getDay(); // 0=Sun..6=Sat
  const midweekOrLater = weekday === 0 || weekday >= 3;

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-black text-emerald-950">학생 진행 현황</h3>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
            완료 {completed}
          </span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
            진행 중 {growing}
          </span>
          <span className={`rounded-full px-2 py-0.5 ${
            notStarted.length > 0 && midweekOrLater
              ? 'bg-rose-100 text-rose-800'
              : 'bg-slate-100 text-slate-600'
          }`}>
            미시작 {notStarted.length}
          </span>
        </div>
      </div>

      {notStarted.length > 0 && midweekOrLater && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <div>
            이번 주 한 번도 체크하지 않은 학생이 {notStarted.length}명 있어요. 격려해 주세요.
            <p className="mt-1 font-bold">
              {notStarted.map((p) => p.childName).join(', ')}
            </p>
          </div>
        </div>
      )}

      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-bold">아이</th>
              <th className="px-3 py-2 text-left font-bold">작은 순종</th>
              <th className="px-3 py-2 text-left font-bold">체크</th>
              <th className="px-3 py-2 text-left font-bold">상태</th>
            </tr>
          </thead>
          <tbody>
            {allProgress.map((p) => {
              const isNotStarted = p.checkCount === 0;
              const rowHighlight = isNotStarted && midweekOrLater
                ? 'bg-rose-50/60'
                : '';
              return (
                <tr key={p.id} className={`border-t border-slate-100 ${rowHighlight}`}>
                  <td className="px-3 py-2 font-bold text-slate-800">{p.childName}</td>
                  <td className="px-3 py-2 text-slate-700">{p.practice}</td>
                  <td className="px-3 py-2 text-slate-700">{Math.min(p.checkCount, 3)}/3</td>
                  <td className="px-3 py-2 text-slate-500">
                    {p.completed
                      ? '완료'
                      : p.checkCount > 0
                        ? '익어가는 중'
                        : isNotStarted && midweekOrLater
                          ? <span className="font-bold text-rose-700">아직 미시작</span>
                          : '자라는 중'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CommunitySummary({ fruit }: { fruit: WeeklyWordFruit }) {
  const total = fruit.aggregateTotal ?? 0;
  const completed = fruit.aggregateCompleted ?? 0;
  const growing = fruit.aggregateGrowing ?? 0;
  const ratio = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
      <p className="text-xs font-bold text-amber-700">우리 유초등부 공동체 현황</p>
      <p className="mt-1 text-sm font-semibold text-amber-900">{fruit.aggregateMessage}</p>
      {total > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-amber-800">
          <span className="rounded-full bg-white/80 px-2 py-0.5">완료 {completed}</span>
          <span className="rounded-full bg-white/80 px-2 py-0.5">익어가는 중 {growing}</span>
          <span className="rounded-full bg-white/80 px-2 py-0.5">완료 비율 {ratio}%</span>
        </div>
      )}
    </div>
  );
}
