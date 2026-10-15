import type {
  CommunionClosingSummary,
  CommunionOccasionStatus,
  CommunionPeriod,
  CommunionReview,
  CommunionReviewDetail,
  CommunionReviewStatus,
  ParticipationFact,
} from './api';

// Screen names for pastoral progress (plan 8.1). These describe the care
// conversation only — never readiness or admission to the Lord's Supper.
export const REVIEW_STATUS_LABELS: Record<CommunionReviewStatus, string> = {
  not_started: '미확인',
  scheduled: '심방 예정',
  in_progress: '대화 진행 중',
  reviewed: '목양 확인',
  closed_without_contact: '연락 미성사로 종료',
};

export const REVIEW_STATUS_ORDER: CommunionReviewStatus[] = ['not_started', 'scheduled', 'in_progress', 'reviewed', 'closed_without_contact'];

export const PROGRESS_DISCLAIMER = '이 상태는 목양 진행 표시이며 성찬 참여 판정이 아닙니다.';

export type ReviewSort = 'name' | 'recent';

export type ReviewFilter = {
  query: string;
  status: CommunionReviewStatus | 'all';
  showExcluded: boolean;
  sort: ReviewSort;
};

export const DEFAULT_REVIEW_FILTER: ReviewFilter = { query: '', status: 'all', showExcluded: false, sort: 'name' };

// There is deliberately no "spiritual risk" ordering (plan 9.2).
export function filterReviews(reviews: CommunionReview[], filter: ReviewFilter) {
  const query = filter.query.replace(/\s/g, '').toLocaleLowerCase('ko-KR');
  return reviews
    .filter((review) => filter.showExcluded || review.rosterState === 'included')
    .filter((review) => filter.status === 'all' || review.status === filter.status)
    .filter((review) => !query || review.memberName.replace(/\s/g, '').toLocaleLowerCase('ko-KR').includes(query))
    .sort((a, b) =>
      filter.sort === 'recent'
        ? b.updatedAt.localeCompare(a.updatedAt) || a.memberName.localeCompare(b.memberName, 'ko')
        : a.memberName.localeCompare(b.memberName, 'ko')
    );
}

/** "목양 확인 8명 / 대상 10명" — progress, not a readiness percentage (plan 5.3). */
export function describePeriodProgress(counts: { included: number; byStatus: Record<CommunionReviewStatus, number> }) {
  return `목양 확인 ${counts.byStatus.reviewed}명 / 대상 ${counts.included}명`;
}

// Mirrors raah_rpc_transition_review (plan 8.1). The database remains the
// authority; this only decides which buttons to offer.
export const ALLOWED_TRANSITIONS: Record<CommunionReviewStatus, CommunionReviewStatus[]> = {
  not_started: ['scheduled', 'in_progress', 'reviewed', 'closed_without_contact'],
  scheduled: ['not_started', 'in_progress', 'reviewed', 'closed_without_contact'],
  in_progress: ['scheduled', 'reviewed', 'closed_without_contact'],
  reviewed: ['in_progress'],
  closed_without_contact: ['not_started', 'in_progress'],
};

/** Reopening a finished review or closing without contact needs a short reason. */
export function transitionNeedsReason(from: CommunionReviewStatus, to: CommunionReviewStatus) {
  return from === 'reviewed' || from === 'closed_without_contact' || to === 'closed_without_contact';
}

export const TRANSITION_ACTION_LABELS: Partial<Record<CommunionReviewStatus, string>> = {
  scheduled: '심방 예정으로',
  in_progress: '대화 진행 중으로',
  reviewed: '목양 확인',
  closed_without_contact: '연락 미성사로 종료',
  not_started: '미확인으로 되돌리기',
};

// ───── Period setup (plan 6.1–6.2) ─────

export const ROSTER_BATCH_SIZE = 200;

/**
 * Turns the editor's selection into roster changes. Newly checked members are
 * added (or re-included); unchecked members who were included are excluded,
 * which keeps their history. Untouched members produce no request.
 */
export function computeRosterChanges(reviews: Array<Pick<CommunionReview, 'memberId' | 'rosterState'>>, selected: Set<string>) {
  const current = new Map(reviews.map((review) => [review.memberId, review.rosterState]));
  const changes: Array<{ memberId: string; included: boolean }> = [];
  for (const memberId of selected) {
    if (current.get(memberId) !== 'included') changes.push({ memberId, included: true });
  }
  for (const [memberId, state] of current) {
    if (state === 'included' && !selected.has(memberId)) changes.push({ memberId, included: false });
  }
  return changes;
}

export function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

export type PeriodDraft = { name: string; startsOn: string; endsOn: string; serviceDate: string };

/** Returns a message for the first problem, or null. Dates are ISO strings, so text comparison is date order. */
export function validatePeriodDraft(draft: PeriodDraft) {
  if (!draft.name.trim()) return '주기 이름을 적어 주세요.';
  if (draft.name.trim().length > 80) return '주기 이름은 80자까지 쓸 수 있습니다.';
  if (!draft.startsOn || !draft.endsOn) return '시작일과 종료일을 골라 주세요.';
  if (draft.endsOn < draft.startsOn) return '종료일은 시작일보다 빠를 수 없습니다.';
  if (draft.serviceDate && (draft.serviceDate < draft.startsOn || draft.serviceDate > draft.endsOn)) {
    return '성찬 시행일은 주기 기간 안에 있어야 합니다.';
  }
  return null;
}

// ───── Closing and reopening a period ─────

export const REOPEN_REASON_MAX = 200;

/** Timestamps from the server are UTC; the church works in Seoul time. Returns YYYY-MM-DD, or '' if unreadable. */
export function toSeoulDate(timestamp: string | null | undefined) {
  if (!timestamp) return '';
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(parsed);
}

/** Shown before closing; counts come from the period as currently loaded. */
export function buildCloseConfirmMessage(counts: { included: number; byStatus: Record<CommunionReviewStatus, number> }) {
  return (
    `목양 확인 ${counts.byStatus.reviewed}명, 미확인 ${counts.byStatus.not_started}명 (대상 ${counts.included}명)으로 마감합니다. ` +
    '마감하면 명부와 진행 상태를 바꿀 수 없고, 진행 중인 후속 돌봄은 그대로 남습니다.'
  );
}

/** "마감 10월 5일 · 목양 확인 8명 / 대상 10명 · 미확인 2명 · 진행 중 후속 돌봄 3건" — counts only, no percentages. */
export function buildClosedSummaryLine(closedDate: string, summary: CommunionClosingSummary | null) {
  const head = `마감 ${closedDate}`;
  if (!summary) return head;
  return (
    `${head} · ${describePeriodProgress(summary)} · 미확인 ${summary.byStatus.not_started}명` +
    ` · 진행 중 후속 돌봄 ${summary.openCareTasks}건`
  );
}

export function buildReopenedLine(reopenedDate: string, reason: string) {
  return `다시 엶: ${reopenedDate} · ${reason}`;
}

/** Returns a message for the reopen reason's first problem, or null. */
export function validateReopenReason(reason: string) {
  const trimmed = reason.trim();
  if (!trimmed) return '다시 여는 이유를 적어 주세요.';
  if (trimmed.length > REOPEN_REASON_MAX) return `다시 여는 이유는 ${REOPEN_REASON_MAX}자까지 쓸 수 있습니다.`;
  return null;
}

// ───── Next period (plan 6, 7.6) ─────

const pad2 = (value: number) => String(value).padStart(2, '0');

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

/** Date-only arithmetic on YYYY-MM-DD strings (UTC), so no timezone drift. */
function addDays(value: string, days: number) {
  const { year, month, day } = parseIsoDate(value);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

/** Adds calendar months and clamps the day to the target month's end (12-31 + 2 → end of Feb). */
function addMonths(value: string, months: number) {
  const { year, month, day } = parseIsoDate(value);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = index % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${pad2(targetMonth + 1)}-${pad2(Math.min(day, lastDay))}`;
}

function onOrAfterSunday(value: string) {
  const { year, month, day } = parseIsoDate(value);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDays(value, (7 - weekday) % 7);
}

/**
 * The next communion is two months later, on a Sunday. Only a suggestion for
 * the form: the previous period's roster or statuses are not part of it.
 */
export function suggestNextPeriod(period: { endsOn: string; occasions: Array<{ serviceDate: string; status: string }> }): PeriodDraft {
  const occasion = [...period.occasions].filter((entry) => entry.status !== 'cancelled').sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))[0];
  const serviceDate = onOrAfterSunday(addMonths(occasion?.serviceDate ?? period.endsOn, 2));
  const { year, month } = parseIsoDate(serviceDate);
  return { name: `${year}년 ${month}월 성찬 목양`, startsOn: addDays(serviceDate, -21), endsOn: serviceDate, serviceDate };
}

/** Previous roster as a suggestion: included members who still exist and are active. Nothing is saved from this. */
export function carryOverRoster(
  previousReviews: Array<Pick<CommunionReview, 'memberId' | 'rosterState'>>,
  members: Array<{ id: string; status: string }>
) {
  const active = new Set(members.filter((member) => member.status === 'active').map((member) => member.id));
  return new Set(previousReviews.filter((review) => review.rosterState === 'included' && active.has(review.memberId)).map((review) => review.memberId));
}

/** "2026년 10월 성찬 목양 · 목양 확인 (2026-10-01)" — reference only, never completes the current review. */
export function describePreviousReview(entry: { periodName: string; status: CommunionReviewStatus; statusChangedAt: string }) {
  const date = toSeoulDate(entry.statusChangedAt);
  return `${entry.periodName} · ${REVIEW_STATUS_LABELS[entry.status]}${date ? ` (${date})` : ''}`;
}

// ───── Communion services and participation facts (plan 6, 7.6, 16.3) ─────

export const OCCASION_STATUS_LABELS: Record<CommunionOccasionStatus, string> = { scheduled: '예정', held: '시행됨', cancelled: '취소됨' };

export const OCCASION_CANCEL_CONFIRM = '이 성찬 시행을 취소합니다. 목양 기록과 후속 돌봄은 그대로 남습니다.';

/** "2026년 10월 13일" from YYYY-MM-DD, without a Date (no timezone drift). */
export function formatLongDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${Number(match[1])}년 ${Number(match[2])}월 ${Number(match[3])}일` : value;
}

/** "2026년 10월 13일 · 예정" */
export function describeOccasion(occasion: { serviceDate: string; status: CommunionOccasionStatus }) {
  return `${formatLongDate(occasion.serviceDate)} · ${OCCASION_STATUS_LABELS[occasion.status]}`;
}

/** Which actions to offer; the database decides what is allowed. Closed periods are read-only. */
export function occasionActions(status: CommunionOccasionStatus, periodClosed: boolean): Array<'held' | 'move' | 'cancel' | 'undo'> {
  if (periodClosed) return [];
  return status === 'scheduled' ? ['held', 'move', 'cancel'] : ['undo'];
}

export const PARTICIPATION_TITLE = '성찬 참여 (출석 기록 기준)';
export const PARTICIPATION_HINT =
  '사실 확인용이며 목양 진행 상태와 연결되지 않습니다. 참여 기록이 없어도 사정 확인이 필요할 뿐 판단 근거가 아닙니다.';

const PARTICIPATION_FACT_LABELS: Record<ParticipationFact, string> = {
  participated: '참여',
  not_recorded: '참여 기록 없음',
  no_attendance_event: '그날 출석 기록이 없습니다',
  upcoming: '예정',
};

/** "10월 13일 · 참여" */
export function describeParticipation(entry: { serviceDate: string; fact: ParticipationFact }) {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(entry.serviceDate);
  const day = match ? `${Number(match[1])}월 ${Number(match[2])}일` : entry.serviceDate;
  return `${day} · ${PARTICIPATION_FACT_LABELS[entry.fact]}`;
}

// ───── Showing a saved change at once ─────
// The server answers a change with the new revision (and status). These apply that
// answer to what is on screen so the next action already carries the new revision;
// a background reload then reconciles anything else. Counts mirror countReviews on
// the server: only included reviews are counted.

export type PeriodDetailData = { period: CommunionPeriod; reviews: CommunionReview[] };
export type ReviewChange = { status?: CommunionReviewStatus; revision: number; statusReason?: string };

export function applyReviewChange(data: PeriodDetailData, reviewId: string, change: ReviewChange, nowIso: string): PeriodDetailData {
  const target = data.reviews.find((review) => review.id === reviewId);
  if (!target) return data;
  const nextStatus = change.status ?? target.status;
  const counts = target.rosterState === 'included' && nextStatus !== target.status
    ? {
      ...data.period.counts,
      byStatus: {
        ...data.period.counts.byStatus,
        [target.status]: Math.max(0, data.period.counts.byStatus[target.status] - 1),
        [nextStatus]: data.period.counts.byStatus[nextStatus] + 1,
      },
    }
    : data.period.counts;
  return {
    period: { ...data.period, counts },
    reviews: data.reviews.map((review) => (review.id === reviewId ? { ...review, status: nextStatus, revision: change.revision, updatedAt: nowIso } : review)),
  };
}

export function applyReviewChangeToDetail(detail: CommunionReviewDetail, change: ReviewChange): CommunionReviewDetail {
  return {
    ...detail,
    review: {
      ...detail.review,
      status: change.status ?? detail.review.status,
      revision: change.revision,
      statusReason: change.statusReason ?? detail.review.statusReason,
    },
  };
}

export function applyPeriodClosed(
  data: PeriodDetailData,
  result: { revision: number; closingSummary: CommunionClosingSummary },
  nowIso: string
): PeriodDetailData {
  return { ...data, period: { ...data.period, status: 'closed', revision: result.revision, closingSummary: result.closingSummary, closedAt: nowIso } };
}

export function applyPeriodReopened(data: PeriodDetailData, result: { revision: number }, reason: string, nowIso: string): PeriodDetailData {
  return {
    ...data,
    period: { ...data.period, status: 'active', revision: result.revision, closedAt: null, reopenedAt: nowIso, reopenReason: reason },
  };
}

export type OccasionPatch =
  | { kind: 'add'; id: string; serviceDate: string; revision: number }
  | { kind: 'update'; id: string; revision: number; status?: CommunionOccasionStatus; serviceDate?: string };

export function applyOccasionPatch(data: PeriodDetailData, patch: OccasionPatch): PeriodDetailData {
  const occasions =
    patch.kind === 'add'
      ? [...data.period.occasions, { id: patch.id, serviceDate: patch.serviceDate, status: 'scheduled' as const, revision: patch.revision }]
      : data.period.occasions.map((occasion) =>
        occasion.id === patch.id
          ? { ...occasion, revision: patch.revision, status: patch.status ?? occasion.status, serviceDate: patch.serviceDate ?? occasion.serviceDate }
          : occasion
      );
  return { ...data, period: { ...data.period, occasions: [...occasions].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate)) } };
}
