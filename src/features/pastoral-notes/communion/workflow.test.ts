import { describe, expect, it, vi } from 'vitest';
import type { CommunionPeriod, CommunionReview, CommunionReviewDetail } from './api';
import {
  ALLOWED_TRANSITIONS,
  applyOccasionPatch,
  applyPeriodClosed,
  applyPeriodReopened,
  applyReviewChange,
  applyReviewChangeToDetail,
  DEFAULT_REVIEW_FILTER,
  buildCloseConfirmMessage,
  buildClosedSummaryLine,
  buildReopenedLine,
  OCCASION_CANCEL_CONFIRM,
  chunk,
  describeOccasion,
  describeParticipation,
  formatLongDate,
  occasionActions,
  carryOverRoster,
  computeRosterChanges,
  describePreviousReview,
  describePeriodProgress,
  filterReviews,
  suggestNextPeriod,
  toSeoulDate,
  transitionNeedsReason,
  validateReopenReason,
  validatePeriodDraft,
} from './workflow';

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

describe('computeRosterChanges', () => {
  const roster = [
    { memberId: 'in', rosterState: 'included' as const },
    { memberId: 'out', rosterState: 'excluded' as const },
  ];

  it('sends nothing when the selection matches the roster', () => {
    expect(computeRosterChanges(roster, new Set(['in']))).toEqual([]);
  });

  it('adds new members, re-includes excluded ones and excludes unchecked ones', () => {
    expect(computeRosterChanges(roster, new Set(['new', 'out']))).toEqual([
      { memberId: 'new', included: true },
      { memberId: 'out', included: true },
      { memberId: 'in', included: false },
    ]);
  });
});

describe('chunk', () => {
  it('splits into batches of at most the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 200)).toEqual([]);
  });
});

describe('validatePeriodDraft', () => {
  const draft = { name: '가을 목양', startsOn: '2026-10-01', endsOn: '2026-10-25', serviceDate: '2026-10-25' };

  it('accepts a service date on the last day and no service date at all', () => {
    expect(validatePeriodDraft(draft)).toBeNull();
    expect(validatePeriodDraft({ ...draft, serviceDate: '' })).toBeNull();
  });

  it.each([
    [{ name: '  ' }, '주기 이름을 적어 주세요.'],
    [{ endsOn: '2026-09-30' }, '종료일은 시작일보다 빠를 수 없습니다.'],
    [{ serviceDate: '2026-11-01' }, '성찬 시행일은 주기 기간 안에 있어야 합니다.'],
  ])('rejects %o', (change, message) => {
    expect(validatePeriodDraft({ ...draft, ...change })).toBe(message);
  });
});

describe('availabilityFromProbeError', () => {
  it('hides the tab only when the feature is off or the account has no grant', async () => {
    const { availabilityFromProbeError } = await import('./api');
    expect(availabilityFromProbeError({ status: 404 })).toBe('hidden');
    expect(availabilityFromProbeError({ status: 403 })).toBe('hidden');
    expect(availabilityFromProbeError({ status: 503 })).toBe('available');
    expect(availabilityFromProbeError({ status: 502 })).toBe('available');
    expect(availabilityFromProbeError(new TypeError('Failed to fetch'))).toBe('available');
  });
});

describe('listCommunionPeriods', () => {
  it('treats an HTML page answer (function not deployed) as not available', async () => {
    const { listCommunionPeriods, probeCommunionAvailability } = await import('./api');
    const user = { getIdToken: async () => 'token' } as never;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('<!doctype html><html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }));
    try {
      await expect(listCommunionPeriods(user)).rejects.toMatchObject({ status: 404 });
      expect(await probeCommunionAvailability(user)).toBe('hidden');
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe('period close and reopen text', () => {
  const byStatus = { not_started: 2, scheduled: 1, in_progress: 1, reviewed: 8, closed_without_contact: 0 };

  it('states the counts and consequences before closing', () => {
    const message = buildCloseConfirmMessage({ included: 12, byStatus });
    expect(message).toContain('목양 확인 8명, 미확인 2명');
    expect(message).toContain('대상 12명');
    expect(message).toContain('명부와 진행 상태를 바꿀 수 없고');
    expect(message).toContain('후속 돌봄은 그대로 남습니다');
    expect(message).not.toMatch(/%|\d+점/);
  });

  it('builds the closed summary line from the snapshot, without percentages', () => {
    const line = buildClosedSummaryLine('2026년 10월 5일', { included: 12, excluded: 1, byStatus, openCareTasks: 3 });
    expect(line).toBe('마감 2026년 10월 5일 · 목양 확인 8명 / 대상 12명 · 미확인 2명 · 진행 중 후속 돌봄 3건');
    expect(line).not.toContain('%');
  });

  it('falls back to the date alone when no snapshot exists', () => {
    expect(buildClosedSummaryLine('2026년 10월 5일', null)).toBe('마감 2026년 10월 5일');
  });

  it('builds the reopened line', () => {
    expect(buildReopenedLine('2026년 10월 12일', '마감 뒤 추가 면담')).toBe('다시 엶: 2026년 10월 12일 · 마감 뒤 추가 면담');
  });

  it('validates the reopen reason', () => {
    expect(validateReopenReason('   ')).toBe('다시 여는 이유를 적어 주세요.');
    expect(validateReopenReason('가'.repeat(201))).toBe('다시 여는 이유는 200자까지 쓸 수 있습니다.');
    expect(validateReopenReason(' 마감 뒤 추가 면담 ')).toBeNull();
    expect(validateReopenReason('가'.repeat(200))).toBeNull();
  });

  it('converts a UTC timestamp to the Seoul calendar date', () => {
    expect(toSeoulDate('2026-10-05T16:00:00Z')).toBe('2026-10-06');
    expect(toSeoulDate('2026-10-05T14:59:00Z')).toBe('2026-10-05');
    expect(toSeoulDate(null)).toBe('');
    expect(toSeoulDate('nope')).toBe('');
  });
});

describe('next period suggestion', () => {
  const occasion = (serviceDate: string, status = 'held') => ({ serviceDate, status });

  it('adds two months and moves to the following Sunday', () => {
    // 2026-09-27 + 2 months = 2026-11-27 (Friday) -> Sunday 2026-11-29
    expect(suggestNextPeriod({ endsOn: '2026-09-27', occasions: [occasion('2026-09-27')] })).toEqual({
      name: '2026년 11월 성찬 목양',
      startsOn: '2026-11-08',
      endsOn: '2026-11-29',
      serviceDate: '2026-11-29',
    });
  });

  it('keeps a date that is already a Sunday', () => {
    // 2026-08-04 + 2 months = 2026-10-04, already a Sunday
    expect(suggestNextPeriod({ endsOn: '', occasions: [occasion('2026-08-04')] }).serviceDate).toBe('2026-10-04');
  });

  it('clamps at month end', () => {
    // 2026-12-31 + 2 months -> 2027-02-28 (Sunday)
    expect(suggestNextPeriod({ endsOn: '2026-12-31', occasions: [occasion('2026-12-31')] }).serviceDate).toBe('2027-02-28');
    // leap year: 2027-12-31 + 2 months -> 2028-02-29 (Tuesday) -> 2028-03-05
    expect(suggestNextPeriod({ endsOn: '', occasions: [occasion('2027-12-31')] }).serviceDate).toBe('2028-03-05');
  });

  it('rolls over the year', () => {
    const next = suggestNextPeriod({ endsOn: '', occasions: [occasion('2026-11-29')] });
    // 2027-01-29 (Friday) -> 2027-01-31
    expect(next).toMatchObject({ name: '2027년 1월 성찬 목양', serviceDate: '2027-01-31', startsOn: '2027-01-10', endsOn: '2027-01-31' });
  });

  it('ignores cancelled occasions and falls back to the end date without one', () => {
    expect(suggestNextPeriod({ endsOn: '2026-09-27', occasions: [occasion('2026-01-04', 'cancelled'), occasion('2026-09-27')] }).serviceDate).toBe('2026-11-29');
    expect(suggestNextPeriod({ endsOn: '2026-09-27', occasions: [] }).serviceDate).toBe('2026-11-29');
    expect(suggestNextPeriod({ endsOn: '2026-09-27', occasions: [occasion('2026-01-04', 'cancelled')] }).serviceDate).toBe('2026-11-29');
  });
});

describe('carry-over roster', () => {
  it('keeps included members that are still active', () => {
    const reviews = [
      { memberId: 'a', rosterState: 'included' as const },
      { memberId: 'b', rosterState: 'excluded' as const },
      { memberId: 'c', rosterState: 'included' as const },
      { memberId: 'gone', rosterState: 'included' as const },
    ];
    const members = [{ id: 'a', status: 'active' }, { id: 'b', status: 'active' }, { id: 'c', status: 'inactive' }];
    expect([...carryOverRoster(reviews, members)]).toEqual(['a']);
  });
});

describe('describePreviousReview', () => {
  it('shows the period, status label and Seoul date', () => {
    expect(describePreviousReview({ periodName: '2026년 10월 성찬 목양', status: 'reviewed', statusChangedAt: '2026-10-01T03:00:00Z' })).toBe(
      '2026년 10월 성찬 목양 · 목양 확인 (2026-10-01)'
    );
  });
});

describe('communion services', () => {
  it('formats the date and status without timezone drift', () => {
    expect(formatLongDate('2026-10-04')).toBe('2026년 10월 4일');
    expect(describeOccasion({ serviceDate: '2026-10-13', status: 'scheduled' })).toBe('2026년 10월 13일 · 예정');
    expect(describeOccasion({ serviceDate: '2026-10-13', status: 'held' })).toBe('2026년 10월 13일 · 시행됨');
    expect(describeOccasion({ serviceDate: '2026-10-13', status: 'cancelled' })).toBe('2026년 10월 13일 · 취소됨');
  });

  it('offers actions by status and none once the period is closed', () => {
    expect(occasionActions('scheduled', false)).toEqual(['held', 'move', 'cancel']);
    expect(occasionActions('held', false)).toEqual(['undo']);
    expect(occasionActions('cancelled', false)).toEqual(['undo']);
    for (const status of ['scheduled', 'held', 'cancelled'] as const) expect(occasionActions(status, true)).toEqual([]);
  });

  it('says that cancelling keeps pastoral records and follow-up care', () => {
    expect(OCCASION_CANCEL_CONFIRM).toContain('목양 기록과 후속 돌봄은 그대로 남습니다');
  });

  it('keeps the next-period suggestion on the first non-cancelled service', () => {
    const suggestion = suggestNextPeriod({
      endsOn: '2026-10-25',
      occasions: [
        { serviceDate: '2026-10-04', status: 'cancelled' },
        { serviceDate: '2026-10-25', status: 'scheduled' },
      ],
    });
    expect(suggestion.serviceDate).toBe('2026-12-27');
  });
});

describe('describeParticipation', () => {
  it('states the fact plainly, without judgement wording', () => {
    expect(describeParticipation({ serviceDate: '2026-10-13', fact: 'participated' })).toBe('10월 13일 · 참여');
    expect(describeParticipation({ serviceDate: '2026-10-13', fact: 'not_recorded' })).toBe('10월 13일 · 참여 기록 없음');
    expect(describeParticipation({ serviceDate: '2026-10-13', fact: 'no_attendance_event' })).toBe('10월 13일 · 그날 출석 기록이 없습니다');
    expect(describeParticipation({ serviceDate: '2026-10-13', fact: 'upcoming' })).toBe('10월 13일 · 예정');
    for (const fact of ['participated', 'not_recorded', 'no_attendance_event', 'upcoming'] as const) {
      expect(describeParticipation({ serviceDate: '2026-10-13', fact })).not.toMatch(/불참|결석|미참여|부적격/);
    }
  });
});

describe('showing a saved change at once', () => {
  const period = (overrides: Partial<CommunionPeriod> = {}): CommunionPeriod => ({
    id: 'p1', name: '가을', startsOn: '2026-09-01', endsOn: '2026-10-01', status: 'active', guideVersion: 'v1', ownerUid: 'u', revision: 3,
    closedAt: null, closingSummary: null, reopenedAt: null, reopenReason: null,
    occasions: [{ id: 'o2', serviceDate: '2026-10-04', status: 'scheduled', revision: 1 }],
    counts: { included: 2, byStatus: { not_started: 1, scheduled: 0, in_progress: 1, reviewed: 0, closed_without_contact: 0 } },
    ...overrides,
  });
  const data = (reviews: CommunionReview[] = [review('r1', 'A', { status: 'not_started', revision: 2 }), review('r2', 'B', { status: 'in_progress' })]) => ({ period: period(), reviews });

  it('moves a review between status counts and takes its new revision', () => {
    const next = applyReviewChange(data(), 'r1', { status: 'reviewed', revision: 3 }, '2026-09-29T00:00:00Z');
    expect(next.reviews[0]).toMatchObject({ status: 'reviewed', revision: 3, updatedAt: '2026-09-29T00:00:00Z' });
    expect(next.period.counts.byStatus).toMatchObject({ not_started: 0, reviewed: 1, in_progress: 1 });
    expect(next.period.counts.included).toBe(2);
  });

  it('does not count an excluded review and leaves counts alone when the status is the same', () => {
    const excluded = data([review('r1', 'A', { status: 'not_started', rosterState: 'excluded' })]);
    expect(applyReviewChange(excluded, 'r1', { status: 'reviewed', revision: 5 }, 'now').period.counts).toEqual(excluded.period.counts);
    const same = applyReviewChange(data(), 'r2', { status: 'in_progress', revision: 9 }, 'now');
    expect(same.period.counts).toEqual(data().period.counts);
    expect(same.reviews[1].revision).toBe(9);
  });

  it('ignores an unknown review and does not mutate its input', () => {
    const original = data();
    expect(applyReviewChange(original, 'missing', { status: 'reviewed', revision: 2 }, 'now')).toBe(original);
    applyReviewChange(original, 'r1', { status: 'reviewed', revision: 3 }, 'now');
    expect(original.reviews[0].status).toBe('not_started');
  });

  it('updates the person detail revision, status and reason', () => {
    const detail = { review: { ...review('r1', 'A'), statusReason: 'old' }, logs: [], previousReviews: [] } as CommunionReviewDetail;
    expect(applyReviewChangeToDetail(detail, { status: 'reviewed', revision: 4, statusReason: '' }).review).toMatchObject({ status: 'reviewed', revision: 4, statusReason: '' });
    expect(applyReviewChangeToDetail(detail, { revision: 5 }).review).toMatchObject({ status: detail.review.status, revision: 5, statusReason: 'old' });
  });

  it('applies close and reopen with the returned revision and summary', () => {
    const summary = { included: 2, excluded: 0, byStatus: data().period.counts.byStatus, openCareTasks: 1 };
    const closed = applyPeriodClosed(data(), { revision: 4, closingSummary: summary }, 'now');
    expect(closed.period).toMatchObject({ status: 'closed', revision: 4, closingSummary: summary, closedAt: 'now' });
    const reopened = applyPeriodReopened(closed, { revision: 5 }, '추가 면담', 'later');
    expect(reopened.period).toMatchObject({ status: 'active', revision: 5, closedAt: null, reopenedAt: 'later', reopenReason: '추가 면담', closingSummary: summary });
  });

  it('applies occasion changes keeping dates in order', () => {
    const added = applyOccasionPatch(data(), { kind: 'add', id: 'o1', serviceDate: '2026-09-27', revision: 1 });
    expect(added.period.occasions.map((occasion) => occasion.id)).toEqual(['o1', 'o2']);
    const moved = applyOccasionPatch(added, { kind: 'update', id: 'o1', revision: 2, serviceDate: '2026-10-11' });
    expect(moved.period.occasions.map((occasion) => occasion.id)).toEqual(['o2', 'o1']);
    const held = applyOccasionPatch(moved, { kind: 'update', id: 'o2', revision: 2, status: 'held' });
    expect(held.period.occasions.find((occasion) => occasion.id === 'o2')).toMatchObject({ status: 'held', revision: 2, serviceDate: '2026-10-04' });
  });
});
