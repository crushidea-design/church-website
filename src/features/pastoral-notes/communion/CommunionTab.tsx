// Communion care (plan 9.1–9.4). Owns its own loading state. Lists show
// progress metadata only; conversation bodies are written through the
// encrypted path and read back only via the existing visitation log view.
import React from 'react';
import type { User } from 'firebase/auth';
import { ArrowLeft, CalendarDays, Info, ListChecks, Plus, RefreshCw } from 'lucide-react';
import type { RaahAttendanceHistoryRecord, RaahMember, RaahVisitationLog } from '../managementApi';
import { shell } from '../adminShell';
import { toast } from 'sonner';
import { EmptyState, MiniCount, SyntheticBadge } from '../AdminPrimitives';
import { getErrorMessage } from '../adminHelpers';
import { REAL_MEMBERS_IN_PERIOD_MESSAGE, TEST_PERIOD_DELETE_CONFIRM, canDeleteTestPeriod } from '../syntheticCleanup';
import { formatDisplayDate } from '../utils';
import { closeCommunionPeriod, deleteCommunionPeriod, getCommunionPeriod, getCommunionReview, listCommunionPeriods, reopenCommunionPeriod, type CommunionPeriod, type CommunionReview } from './api';
import { OccasionList } from './OccasionList';
import { ConversationForm, LinkedLogs, ReviewStatusControl } from './ReviewWorkspace';
import { CreatePeriodForm, RosterEditor } from './PeriodSetup';
import { CareTasksSection, type SourceOption } from '../care-tasks/CareTasksSection';
import { confirmDiscardChanges } from '../hooks/useUnsavedChanges';
import {
  DEFAULT_REVIEW_FILTER,
  PROGRESS_DISCLAIMER,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_ORDER,
  REOPEN_REASON_MAX,
  buildCloseConfirmMessage,
  buildClosedSummaryLine,
  buildReopenedLine,
  carryOverRoster,
  describePeriodProgress,
  PARTICIPATION_HINT,
  PARTICIPATION_TITLE,
  describeParticipation,
  describePreviousReview,
  filterReviews,
  suggestNextPeriod,
  toSeoulDate,
  validateReopenReason,
  type PeriodDraft,
  type ReviewFilter,
} from './workflow';

type Load<T> = { state: 'loading' } | { state: 'ready'; data: T } | { state: 'error'; status?: number };

const PERIOD_STATUS_LABELS: Record<CommunionPeriod['status'], string> = { active: '진행 중', planned: '예정', closed: '마감' };

function errorMessage(status?: number) {
  if (status === 403) return '이 목양 주기를 볼 권한이 없습니다.';
  if (status === 404) return '목양 주기를 찾을 수 없습니다.';
  if (status === 503) return '저장소에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  return '성찬 목양 정보를 불러오지 못했습니다.';
}

function useLoad<T>(key: string | null, load: () => Promise<T>) {
  const [result, setResult] = React.useState<Load<T>>({ state: 'loading' });
  const [attempt, setAttempt] = React.useState(0);
  const loadedKey = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    // A refresh of the same thing keeps showing what is loaded, so forms below
    // (and their unsaved drafts) stay mounted. A different key starts clean.
    if (loadedKey.current !== key) setResult({ state: 'loading' });
    loadedKey.current = key;
    load()
      .then((data) => !cancelled && setResult({ state: 'ready', data }))
      .catch((error: { status?: number }) => !cancelled && setResult({ state: 'error', status: error?.status }));
    return () => {
      cancelled = true;
    };
    // `load` is recreated each render; `key` and `attempt` decide when to refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  return { result, reload: () => setAttempt((value) => value + 1) };
}

function LoadState({ result, onRetry }: { result: Load<unknown>; onRetry: () => void }) {
  if (result.state === 'loading') return <p className="p-6 text-sm text-[#607080]" role="status">불러오는 중…</p>;
  if (result.state === 'error') {
    return (
      <div className="flex flex-col items-start gap-3 p-6" role="alert">
        <p className="text-sm text-[#8a3b2a]">{errorMessage(result.status)}</p>
        <button type="button" onClick={onRetry} className={shell.ghostButton}>
          <RefreshCw size={14} />
          다시 시도
        </button>
      </div>
    );
  }
  return null;
}

export function CommunionTab({
  user,
  members,
  logs,
  attendanceHistory,
  onOpenLog,
  onDraftDirtyChange,
  onWorkspaceDataChanged,
  requestedPeriod,
}: {
  user: User;
  members: RaahMember[];
  logs: RaahVisitationLog[];
  attendanceHistory: RaahAttendanceHistoryRecord[];
  onOpenLog: (logId: string) => void;
  onDraftDirtyChange: (dirty: boolean) => void;
  /** New records and schedule slots made here live in the page's shared lists; reload them. */
  onWorkspaceDataChanged: () => void;
  /** Opens this period (e.g. from the home panel). A new nonce makes a repeated request for the same period work. */
  requestedPeriod?: { periodId: string; nonce: number } | null;
}) {
  const periods = useLoad('periods', () => listCommunionPeriods(user));
  // Unsaved work can sit in the person panel, the roster editor or the new-period form.
  const [dirtyParts, setDirtyParts] = React.useState({ panel: false, roster: false, create: false });
  const markDirty = React.useCallback((part: keyof typeof dirtyParts) => (dirty: boolean) => setDirtyParts((prev) => (prev[part] === dirty ? prev : { ...prev, [part]: dirty })), []);
  const setPanelDirty = React.useMemo(() => markDirty('panel'), [markDirty]);
  const setRosterDirty = React.useMemo(() => markDirty('roster'), [markDirty]);
  const setCreateDirty = React.useMemo(() => markDirty('create'), [markDirty]);
  const draftDirty = dirtyParts.panel || dirtyParts.roster || dirtyParts.create;
  React.useEffect(() => onDraftDirtyChange(draftDirty), [draftDirty, onDraftDirtyChange]);
  const [isCreating, setIsCreating] = React.useState(false);
  const [isEditingRoster, setIsEditingRoster] = React.useState(false);
  // "다음 주기 만들기": the suggested form values and the previous roster to preselect afterwards.
  const [nextSeed, setNextSeed] = React.useState<{ draft: PeriodDraft; memberIds: Set<string> } | null>(null);
  const [carryOver, setCarryOver] = React.useState<{ periodId: string; memberIds: Set<string> } | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = React.useState<string | null>(null);
  const detail = useLoad(selectedPeriodId, () => getCommunionPeriod(selectedPeriodId!, user));
  const [selectedReviewId, setSelectedReviewId] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<ReviewFilter>(DEFAULT_REVIEW_FILTER);
  const [isDeletingPeriod, setIsDeletingPeriod] = React.useState(false);
  const [isChangingPeriod, setIsChangingPeriod] = React.useState(false);
  // null = the reopen form is closed; a string (even empty) = it is open with that draft.
  const [reopenDraft, setReopenDraft] = React.useState<string | null>(null);

  const selectReview = (reviewId: string | null) => {
    if (reviewId === selectedReviewId || !confirmDiscardChanges(draftDirty)) return;
    setSelectedReviewId(reviewId);
  };

  const selectPeriod = (periodId: string | null) => {
    if (!confirmDiscardChanges(draftDirty)) return;
    setSelectedPeriodId(periodId);
    setSelectedReviewId(null);
    setFilter(DEFAULT_REVIEW_FILTER);
    setIsEditingRoster(false);
    setReopenDraft(null);
    setNextSeed(null);
    setCarryOver(null);
  };

  const handledRequestNonce = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!requestedPeriod || handledRequestNonce.current === requestedPeriod.nonce) return;
    handledRequestNonce.current = requestedPeriod.nonce;
    selectPeriod(requestedPeriod.periodId);
    // selectPeriod is recreated each render; the request's nonce decides when to act.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedPeriod]);

  const openCreatedPeriod = (periodId: string) => {
    setIsCreating(false);
    periods.reload();
    setCarryOver(nextSeed ? { periodId, memberIds: nextSeed.memberIds } : null);
    setNextSeed(null);
    setSelectedPeriodId(periodId);
    setSelectedReviewId(null);
    setFilter(DEFAULT_REVIEW_FILTER);
    // A fresh period has nobody on it yet; go straight to choosing the roster.
    setIsEditingRoster(true);
  };

  if (!selectedPeriodId) {
    return (
      <section className={shell.panel}>
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e6edf2] p-4">
          <div>
            <h2 className="text-lg font-semibold">성찬 목양</h2>
            <p className="mt-1 text-sm text-[#607080]">목양 주기를 선택하면 대상과 진행 상황을 봅니다.</p>
          </div>
          {!isCreating && (
            <button type="button" onClick={() => setIsCreating(true)} className={shell.button}>
              <Plus size={16} />새 목양 주기
            </button>
          )}
        </header>
        {isCreating && <CreatePeriodForm user={user} onCreated={openCreatedPeriod} onCancel={() => setIsCreating(false)} onDirtyChange={setCreateDirty} />}
        {periods.result.state !== 'ready' ? (
          <LoadState result={periods.result} onRetry={periods.reload} />
        ) : periods.result.data.length === 0 ? (
          <div className="p-4">
            <EmptyState>아직 만든 목양 주기가 없습니다. ‘새 목양 주기’로 시작하세요.</EmptyState>
          </div>
        ) : (
          <PeriodList periods={periods.result.data} onSelect={selectPeriod} />
        )}
      </section>
    );
  }

  if (detail.result.state !== 'ready') {
    return (
      <section className={shell.panel}>
        <BackToPeriods onBack={() => selectPeriod(null)} />
        <LoadState result={detail.result} onRetry={detail.reload} />
      </section>
    );
  }

  const { period, reviews } = detail.result.data;
  const visibleReviews = filterReviews(reviews, filter);
  const selectedReview = reviews.find((review) => review.id === selectedReviewId) || null;
  const syntheticIds = new Set(members.filter((member) => member.isSynthetic).map((member) => member.id));
  // The server checks again; this only decides whether to offer the button.
  const canDeletePeriod = canDeleteTestPeriod(reviews, members);

  const handleDeletePeriod = async () => {
    if (isDeletingPeriod || !window.confirm(TEST_PERIOD_DELETE_CONFIRM)) return;
    setIsDeletingPeriod(true);
    try {
      await deleteCommunionPeriod(period.id, user);
      toast.success('목양 주기를 삭제했습니다.');
      setDirtyParts({ panel: false, roster: false, create: false });
      setSelectedPeriodId(null);
      setSelectedReviewId(null);
      setFilter(DEFAULT_REVIEW_FILTER);
      setIsEditingRoster(false);
      periods.reload();
      onWorkspaceDataChanged();
    } catch (error) {
      toast.error((error as { status?: number })?.status === 409 ? REAL_MEMBERS_IN_PERIOD_MESSAGE : getErrorMessage(error, '목양 주기를 삭제하지 못했습니다.'));
    } finally {
      setIsDeletingPeriod(false);
    }
  };

  const handleClosePeriod = async () => {
    if (isChangingPeriod || !confirmDiscardChanges(draftDirty)) return;
    if (!window.confirm(buildCloseConfirmMessage(period.counts))) return;
    setIsChangingPeriod(true);
    try {
      await closeCommunionPeriod(period.id, period.revision, user);
      toast.success('주기를 마감했습니다.');
      onWorkspaceDataChanged();
      setDirtyParts({ panel: false, roster: false, create: false });
      setIsEditingRoster(false);
      setReopenDraft(null);
    } catch (error) {
      toast.error(
        (error as { status?: number })?.status === 409
          ? '다른 곳에서 먼저 변경되었습니다. 최신 내용을 다시 불러옵니다.'
          : getErrorMessage(error, '주기를 마감하지 못했습니다.')
      );
    } finally {
      // Reload on failure too, so a stale revision or state is replaced by what the server has.
      detail.reload();
      periods.reload();
      setIsChangingPeriod(false);
    }
  };

  const handleReopenPeriod = async () => {
    if (isChangingPeriod || reopenDraft === null) return;
    const problem = validateReopenReason(reopenDraft);
    if (problem) {
      toast.error(problem);
      return;
    }
    setIsChangingPeriod(true);
    try {
      await reopenCommunionPeriod(period.id, { expectedRevision: period.revision, reason: reopenDraft.trim() }, user);
      toast.success('주기를 다시 열었습니다.');
      onWorkspaceDataChanged();
      setReopenDraft(null);
    } catch (error) {
      toast.error(
        (error as { status?: number })?.status === 409
          ? '다른 곳에서 먼저 변경되었습니다. 최신 내용을 다시 불러옵니다.'
          : getErrorMessage(error, '주기를 다시 열지 못했습니다.')
      );
    } finally {
      detail.reload();
      periods.reload();
      setIsChangingPeriod(false);
    }
  };

  const isClosed = period.status === 'closed';
  const closedDate = formatDisplayDate(toSeoulDate(period.closedAt));

  return (
    <section className="space-y-3">
      <div className={shell.panel}>
        <BackToPeriods onBack={() => selectPeriod(null)} />
        <div className="flex flex-col gap-1 px-4 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{period.name}</h2>
            <span className={shell.badge}>{PERIOD_STATUS_LABELS[period.status]}</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {!nextSeed && (
                <button
                  type="button"
                  disabled={isChangingPeriod}
                  onClick={() => {
                    if (!confirmDiscardChanges(draftDirty)) return;
                    setSelectedReviewId(null);
                    setIsEditingRoster(false);
                    setNextSeed({ draft: suggestNextPeriod(period), memberIds: carryOverRoster(reviews, members) });
                  }}
                  className={shell.ghostButton + ' px-3 py-1.5 text-xs'}
                >
                  다음 주기 만들기
                </button>
              )}
              {isClosed ? (
                reopenDraft === null && (
                  <button type="button" disabled={isChangingPeriod} onClick={() => setReopenDraft('')} className={shell.ghostButton + ' px-3 py-1.5 text-xs'}>
                    다시 열기
                  </button>
                )
              ) : (
                <button type="button" disabled={isChangingPeriod} onClick={handleClosePeriod} className={shell.ghostButton + ' px-3 py-1.5 text-xs'}>
                  주기 마감
                </button>
              )}
              {canDeletePeriod && (
                <button type="button" disabled={isDeletingPeriod} onClick={handleDeletePeriod} className={shell.dangerGhostButton + ' px-3 py-1.5 text-xs'}>
                  주기 삭제
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-[#607080]">
            {formatDisplayDate(period.startsOn)} – {formatDisplayDate(period.endsOn)}
          </p>
          <OccasionList
            periodId={period.id}
            occasions={period.occasions}
            periodClosed={isClosed}
            user={user}
            onChanged={() => {
              detail.reload();
              periods.reload();
            }}
          />
          {isClosed && <p className="text-sm text-[#607080]">{buildClosedSummaryLine(closedDate, period.closingSummary)}</p>}
          {period.reopenReason && period.reopenedAt && (
            <p className="text-xs text-[#607080]">{buildReopenedLine(formatDisplayDate(toSeoulDate(period.reopenedAt)), period.reopenReason)}</p>
          )}
          {isClosed && reopenDraft !== null && (
            <form
              className="mt-2 flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void handleReopenPeriod();
              }}
            >
              <input
                aria-label="다시 여는 이유 (짧고 중립적으로)"
                placeholder="예: 마감 뒤 추가 면담"
                value={reopenDraft}
                maxLength={REOPEN_REASON_MAX}
                onChange={(event) => setReopenDraft(event.target.value)}
                className={shell.input + ' min-w-0 flex-1'}
              />
              <button type="submit" disabled={isChangingPeriod} className={shell.button + ' px-3 py-1.5 text-xs'}>
                확인
              </button>
              <button type="button" disabled={isChangingPeriod} onClick={() => setReopenDraft(null)} className={shell.ghostButton + ' px-3 py-1.5 text-xs'}>
                취소
              </button>
            </form>
          )}
        </div>
        {nextSeed && (
          <CreatePeriodForm
            user={user}
            initial={nextSeed.draft}
            onCreated={openCreatedPeriod}
            onCancel={() => setNextSeed(null)}
            onDirtyChange={setCreateDirty}
          />
        )}
        <div className="grid grid-cols-2 gap-2 border-t border-[#e6edf2] p-4 sm:grid-cols-3 lg:grid-cols-6">
          <MiniCount label="대상" value={period.counts.included} />
          {REVIEW_STATUS_ORDER.map((status) => (
            <MiniCount key={status} label={REVIEW_STATUS_LABELS[status]} value={period.counts.byStatus[status]} />
          ))}
        </div>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(400px,480px)]">
        <div className={`${shell.panel} min-w-0 p-4 ${selectedReview ? 'max-xl:hidden' : ''}`}>
          {isEditingRoster ? (
            <RosterEditor
              periodId={period.id}
              members={members}
              reviews={reviews}
              user={user}
              onSaved={detail.reload}
              onClose={() => setIsEditingRoster(false)}
              onDirtyChange={setRosterDirty}
              initialSelection={carryOver?.periodId === period.id ? carryOver.memberIds : undefined}
            />
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">명부</h3>
                {!isClosed && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedReviewId && !confirmDiscardChanges(dirtyParts.panel)) return;
                      setSelectedReviewId(null);
                      setIsEditingRoster(true);
                    }}
                    className={shell.ghostButton + ' px-3 py-1.5 text-xs'}
                  >
                    <ListChecks size={14} />
                    명부 편집
                  </button>
                )}
              </div>
              <ReviewFilters filter={filter} setFilter={setFilter} />
              {visibleReviews.length === 0 ? (
                <div className="mt-3">
                  <EmptyState>{reviews.length === 0 ? '명부에 등록된 성도가 없습니다. ‘명부 편집’에서 대상을 정해 주세요.' : '조건에 맞는 성도가 없습니다.'}</EmptyState>
                </div>
              ) : (
                <ReviewTable reviews={visibleReviews} logs={logs} syntheticIds={syntheticIds} selectedReviewId={selectedReviewId} onSelect={selectReview} />
              )}
            </>
          )}
        </div>
        {selectedReview && !isEditingRoster ? (
          <PersonPanel
            // Remounting per person drops the previous person's draft and detail at once.
            key={selectedReview.id}
            review={selectedReview}
            user={user}
            periodClosed={isClosed}
            logs={logs}
            attendanceHistory={attendanceHistory}
            onBack={() => selectReview(null)}
            onOpenLog={(logId) => {
              if (confirmDiscardChanges(draftDirty)) onOpenLog(logId);
            }}
            onChanged={detail.reload}
            onWorkspaceDataChanged={onWorkspaceDataChanged}
            onDraftDirtyChange={setPanelDirty}
          />
        ) : (
          <aside className={`${shell.mutedPanel} p-4 text-sm text-[#607080] max-xl:hidden`}>성도를 선택하면 목양 정보를 봅니다.</aside>
        )}
      </div>
    </section>
  );
}

function BackToPeriods({ onBack }: { onBack: () => void }) {
  return (
    <div className="p-3">
      <button type="button" onClick={onBack} className={shell.ghostButton + ' px-3 py-1.5 text-xs'}>
        <ArrowLeft size={14} />
        목양 주기 목록
      </button>
    </div>
  );
}

function PeriodList({ periods, onSelect }: { periods: CommunionPeriod[]; onSelect: (periodId: string) => void }) {
  const groups: Array<CommunionPeriod['status']> = ['active', 'planned', 'closed'];
  return (
    <div className="space-y-5 p-4">
      {groups.map((status) => {
        const items = periods.filter((period) => period.status === status);
        if (items.length === 0) return null;
        return (
          <div key={status}>
            <h3 className="text-sm font-semibold text-[#17202b]">{PERIOD_STATUS_LABELS[status]}</h3>
            <ul className="mt-2 grid gap-2 md:grid-cols-2">
              {items.map((period) => (
                <li key={period.id}>
                  <button type="button" onClick={() => onSelect(period.id)} className={`${shell.mutedPanel} w-full p-3 text-left transition hover:border-[#2e6b5f]`}>
                    <p className="font-semibold text-[#12345a]">{period.name}</p>
                    <p className="mt-1 text-xs text-[#607080]">
                      {formatDisplayDate(period.startsOn)} – {formatDisplayDate(period.endsOn)}
                    </p>
                    {period.occasions.some((occasion) => occasion.status !== 'cancelled') && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-[#607080]">
                        <CalendarDays size={12} />
                        성찬{' '}
                        {period.occasions
                          .filter((occasion) => occasion.status !== 'cancelled')
                          .map((occasion) => formatDisplayDate(occasion.serviceDate))
                          .join(', ')}
                      </p>
                    )}
                    <p className="mt-2 text-sm text-[#17202b]">{describePeriodProgress(period.counts)}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function ReviewFilters({ filter, setFilter }: { filter: ReviewFilter; setFilter: React.Dispatch<React.SetStateAction<ReviewFilter>> }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
      <input
        aria-label="성도 이름 검색"
        placeholder="이름 검색"
        value={filter.query}
        onChange={(event) => setFilter((prev) => ({ ...prev, query: event.target.value }))}
        className={shell.input}
      />
      <select
        aria-label="진행 상태"
        value={filter.status}
        onChange={(event) => setFilter((prev) => ({ ...prev, status: event.target.value as ReviewFilter['status'] }))}
        className={shell.input}
      >
        <option value="all">전체 상태</option>
        {REVIEW_STATUS_ORDER.map((status) => (
          <option key={status} value={status}>
            {REVIEW_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
      <select
        aria-label="정렬"
        value={filter.sort}
        onChange={(event) => setFilter((prev) => ({ ...prev, sort: event.target.value as ReviewFilter['sort'] }))}
        className={shell.input}
      >
        <option value="name">이름순</option>
        <option value="recent">최근 변경순</option>
      </select>
      <label className="flex items-center gap-2 text-xs text-[#607080] sm:col-span-3">
        <input type="checkbox" checked={filter.showExcluded} onChange={(event) => setFilter((prev) => ({ ...prev, showExcluded: event.target.checked }))} />
        명부에서 제외한 성도도 표시
      </label>
    </div>
  );
}

const latestLogFor = (logs: RaahVisitationLog[], memberId: string) =>
  logs.filter((log) => log.memberId === memberId).sort((a, b) => b.date.localeCompare(a.date))[0];

function ReviewTable({
  reviews,
  logs,
  syntheticIds,
  selectedReviewId,
  onSelect,
}: {
  reviews: CommunionReview[];
  logs: RaahVisitationLog[];
  syntheticIds: Set<string>;
  selectedReviewId: string | null;
  onSelect: (reviewId: string) => void;
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-[#dbe3e8]">
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead className="bg-[#eef3f6] text-left text-xs text-[#607080]">
          <tr>
            <th scope="col" className="px-3 py-2">성도</th>
            <th scope="col" className="px-3 py-2">이번 목양</th>
            <th scope="col" className="px-3 py-2">최근 심방</th>
          </tr>
        </thead>
        <tbody>
          {reviews.map((review) => {
            const latest = latestLogFor(logs, review.memberId);
            return (
              <tr key={review.id} className={`border-t border-[#e6edf2] ${selectedReviewId === review.id ? 'bg-[#e8f2ef]' : ''}`}>
                <th scope="row" className="px-3 py-2 text-left">
                  <button
                    type="button"
                    aria-pressed={selectedReviewId === review.id}
                    onClick={() => onSelect(review.id)}
                    className="font-semibold text-[#12345a] underline decoration-[#b8ccc8] underline-offset-4"
                  >
                    {review.memberName || '이름 없음'}
                  </button>
                  {syntheticIds.has(review.memberId) && <SyntheticBadge />}
                  {review.rosterState === 'excluded' && <span className="ml-2 text-xs font-normal text-[#607080]">명부 제외</span>}
                </th>
                <td className="px-3 py-2">{REVIEW_STATUS_LABELS[review.status]}</td>
                <td className="px-3 py-2 text-[#607080]">{latest ? formatDisplayDate(latest.date) : '기록 없음'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PersonPanel({
  review,
  user,
  periodClosed,
  logs,
  attendanceHistory,
  onBack,
  onOpenLog,
  onChanged,
  onWorkspaceDataChanged,
  onDraftDirtyChange,
}: {
  review: CommunionReview;
  user: User;
  periodClosed: boolean;
  logs: RaahVisitationLog[];
  attendanceHistory: RaahAttendanceHistoryRecord[];
  onBack: () => void;
  onOpenLog: (logId: string) => void;
  onChanged: () => void;
  onWorkspaceDataChanged: () => void;
  onDraftDirtyChange: (dirty: boolean) => void;
}) {
  const detail = useLoad(review.id, () => getCommunionReview(review.id, user));
  const refreshAll = () => {
    detail.reload();
    onChanged();
  };
  const editable = !periodClosed && review.rosterState === 'included';
  // Two drafts can be open at once (conversation, new task); either one counts as unsaved.
  const [dirtyDrafts, setDirtyDrafts] = React.useState({ conversation: false, task: false });
  const setConversationDirty = React.useCallback((dirty: boolean) => setDirtyDrafts((prev) => ({ ...prev, conversation: dirty })), []);
  const setTaskDirty = React.useCallback((dirty: boolean) => setDirtyDrafts((prev) => ({ ...prev, task: dirty })), []);
  const anyDraftDirty = dirtyDrafts.conversation || dirtyDrafts.task;
  React.useEffect(() => onDraftDirtyChange(anyDraftDirty), [anyDraftDirty, onDraftDirtyChange]);
  React.useEffect(() => () => onDraftDirtyChange(false), [onDraftDirtyChange]);
  const taskSources: SourceOption[] =
    detail.result.state === 'ready'
      ? [
        { value: 'review', label: '이번 성찬 목양', sourceType: 'communion_review', sourceId: review.id },
        ...detail.result.data.logs.map((log) => ({
          value: `log:${log.id}`,
          label: `기록 ${formatDisplayDate(log.date)} · ${log.logType}`,
          sourceType: 'visitation_log' as const,
          sourceId: log.id,
        })),
        { value: 'manual', label: '연결 없음', sourceType: 'manual', sourceId: null },
      ]
      : [];
  const memberLogs = logs.filter((log) => log.memberId === review.memberId).sort((a, b) => b.date.localeCompare(a.date));
  const sundays = attendanceHistory
    .filter((record) => record.memberId === review.memberId && (!record.eventType || record.eventType === 'sunday_morning'))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  return (
    <aside className={shell.panel + ' p-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:overscroll-contain'} aria-label={`${review.memberName} 목양 정보`}>
      <button type="button" onClick={onBack} className={shell.ghostButton + ' mb-3 px-3 py-1.5 text-xs xl:hidden'}>
        <ArrowLeft size={14} />
        명부로 돌아가기
      </button>
      <h3 className="text-lg font-semibold">{review.memberName || '이름 없음'}</h3>
      <p className="mt-2 flex items-start gap-1.5 rounded-md bg-[#f3f6f8] p-2 text-xs text-[#4b5d6d]">
        <Info size={14} className="mt-0.5 shrink-0" />
        {PROGRESS_DISCLAIMER}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-[#607080]">이번 목양</dt>
          <dd className="font-semibold">{REVIEW_STATUS_LABELS[detail.result.state === 'ready' ? detail.result.data.review.status : review.status]}</dd>
          {detail.result.state === 'ready' && detail.result.data.review.statusReason && (
            <dd className="text-xs text-[#607080]">사유: {detail.result.data.review.statusReason}</dd>
          )}
        </div>
        <div>
          <dt className="text-xs text-[#607080]">명부</dt>
          <dd className="font-semibold">{review.rosterState === 'included' ? '포함' : '제외'}</dd>
        </div>
      </dl>

      {detail.result.state !== 'ready' ? (
        <LoadState result={detail.result} onRetry={detail.reload} />
      ) : (
        <>
          <ReviewStatusControl detail={detail.result.data} user={user} disabled={!editable} onChanged={refreshAll} />
          <LinkedLogs
            detail={detail.result.data}
            memberLogs={memberLogs}
            user={user}
            disabled={!editable}
            onOpenLog={onOpenLog}
            onChanged={refreshAll}
          />
          <CareTasksSection memberId={review.memberId} sources={taskSources} user={user} disabled={!editable} onDirtyChange={setTaskDirty} onScheduleCreated={onWorkspaceDataChanged} />
        </>
      )}
      {!editable && <p className="mt-2 text-xs text-[#607080]">마감된 주기이거나 명부에서 제외된 성도라 변경할 수 없습니다.</p>}

      {detail.result.state === 'ready' && (detail.result.data.previousReviews ?? []).length > 0 && (
        <div className="mt-4 rounded-md bg-[#f3f6f8] p-2">
          <h4 className="text-xs font-semibold text-[#4b5d6d]">지난 주기</h4>
          <p className="text-xs text-[#607080]">참고용이며 이번 목양을 대신하지 않습니다.</p>
          <ul className="mt-1 space-y-0.5">
            {(detail.result.data.previousReviews ?? []).map((entry, index) => (
              <li key={index} className="text-xs text-[#4b5d6d]">
                {describePreviousReview(entry)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {detail.result.state === 'ready' && (detail.result.data.participation ?? []).length > 0 && (
        <div className="mt-4 rounded-md bg-[#f3f6f8] p-2">
          <h4 className="text-xs font-semibold text-[#4b5d6d]">{PARTICIPATION_TITLE}</h4>
          <p className="text-xs text-[#607080]">{PARTICIPATION_HINT}</p>
          <ul className="mt-1 space-y-0.5">
            {(detail.result.data.participation ?? []).map((entry) => (
              <li key={entry.serviceDate} className="text-xs text-[#4b5d6d]">
                {describeParticipation(entry)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h4 className="mt-4 text-sm font-semibold">최근 심방 기록</h4>
      {memberLogs.length === 0 ? (
        <p className="mt-1 text-sm text-[#607080]">연결된 성도의 심방 기록이 없습니다.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {memberLogs.slice(0, 5).map((log) => (
            <li key={log.id}>
              <button type="button" onClick={() => onOpenLog(log.id)} className="text-sm text-[#12345a] underline decoration-[#b8ccc8] underline-offset-4">
                {formatDisplayDate(log.date)} · {log.logType}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h4 className="mt-4 text-sm font-semibold">최근 주일 오전 출석</h4>
      <p className="text-xs text-[#607080]">불러온 출석 기록 기준 · 결석은 사정 확인이 필요할 뿐 판단 근거가 아닙니다.</p>
      {sundays.length === 0 ? (
        <p className="mt-1 text-sm text-[#607080]">조회된 기록이 없습니다.</p>
      ) : (
        <ul className="mt-1 flex flex-wrap gap-1.5">
          {sundays.map((record) => (
            <li key={record.date} className="rounded-md bg-[#f3f6f8] px-2 py-1 text-xs">
              {record.date.slice(5).replace('-', '.')} {record.attended ? '출석' : '결석'}
            </li>
          ))}
        </ul>
      )}

      {detail.result.state === 'ready' && editable && (
        // Conversations go on open care only; a confirmed or closed review is reopened first (with a reason).
        ['not_started', 'scheduled', 'in_progress'].includes(detail.result.data.review.status) ? (
          <ConversationForm
            detail={detail.result.data}
            user={user}
            disabled={!editable}
            onDirtyChange={setConversationDirty}
            onSaved={() => {
              refreshAll();
              onWorkspaceDataChanged();
            }}
          />
        ) : (
          <p className="mt-4 border-t border-[#e6edf2] pt-4 text-xs text-[#607080]">
            새 대화를 기록하려면 먼저 위에서 ‘대화 진행 중으로’ 다시 열고 사유를 남겨 주세요.
          </p>
        )
      )}
    </aside>
  );
}
