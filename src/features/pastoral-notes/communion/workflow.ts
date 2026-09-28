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
