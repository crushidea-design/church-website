import { describe, expect, it, vi } from 'vitest';
import type { CommunionReview } from './api';
import {
  ALLOWED_TRANSITIONS,
  DEFAULT_REVIEW_FILTER,
  buildCloseConfirmMessage,
  buildClosedSummaryLine,
  buildReopenedLine,
  chunk,
  computeRosterChanges,
  describePeriodProgress,
  filterReviews,
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
