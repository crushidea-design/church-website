import type { CommunionReview, CommunionReviewStatus } from './api';

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
