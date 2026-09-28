import { describe, expect, it } from 'vitest';
import type { CommunionReview } from './api';
import { ALLOWED_TRANSITIONS, DEFAULT_REVIEW_FILTER, describePeriodProgress, filterReviews, transitionNeedsReason } from './workflow';

const review = (id: string, memberName: string, overrides: Partial<CommunionReview> = {}): CommunionReview => ({
  id,
  memberId: `m-${id}`,
  memberName,
  memberActive: true,
  status: 'not_started',
  rosterState: 'included',
  assigneeUid: 'uid',
  revision: 1,
  updatedAt: '2026-10-01T00:00:00Z',
  ...overrides,
});

const reviews = [
  review('1', '다 성도', { status: 'reviewed', updatedAt: '2026-10-03T00:00:00Z' }),
  review('2', '가 성도', { updatedAt: '2026-10-01T00:00:00Z' }),
  review('3', '나 성도', { rosterState: 'excluded', updatedAt: '2026-10-05T00:00:00Z' }),
];

describe('filterReviews', () => {
  it('hides excluded members by default and sorts by name', () => {
    expect(filterReviews(reviews, DEFAULT_REVIEW_FILTER).map((item) => item.id)).toEqual(['2', '1']);
  });

  it('can show the excluded history and sort by latest change', () => {
    const result = filterReviews(reviews, { ...DEFAULT_REVIEW_FILTER, showExcluded: true, sort: 'recent' });
    expect(result.map((item) => item.id)).toEqual(['3', '1', '2']);
  });

  it('filters by status and by name ignoring spaces', () => {
    expect(filterReviews(reviews, { ...DEFAULT_REVIEW_FILTER, status: 'reviewed' }).map((item) => item.id)).toEqual(['1']);
    expect(filterReviews(reviews, { ...DEFAULT_REVIEW_FILTER, query: '가성' }).map((item) => item.id)).toEqual(['2']);
  });
});

describe('describePeriodProgress', () => {
  it('reports pastoral progress as counts rather than a readiness rate', () => {
    const text = describePeriodProgress({
      included: 10,
      byStatus: { not_started: 1, scheduled: 1, in_progress: 0, reviewed: 8, closed_without_contact: 0 },
    });
    expect(text).toBe('목양 확인 8명 / 대상 10명');
    expect(text).not.toContain('%');
  });
});

describe('review transitions', () => {
  it('only reopens a confirmed review, and asks why', () => {
    expect(ALLOWED_TRANSITIONS.reviewed).toEqual(['in_progress']);
    expect(transitionNeedsReason('reviewed', 'in_progress')).toBe(true);
    expect(transitionNeedsReason('in_progress', 'closed_without_contact')).toBe(true);
    expect(transitionNeedsReason('not_started', 'scheduled')).toBe(false);
  });

  it('never offers a transition to the same status', () => {
    for (const [from, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
      expect(targets).not.toContain(from);
    }
  });
});
