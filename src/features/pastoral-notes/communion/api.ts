import type { User } from 'firebase/auth';
import { getAuthHeaders, readJsonResponse } from '../managementApi';

export type CommunionReviewStatus = 'not_started' | 'scheduled' | 'in_progress' | 'reviewed' | 'closed_without_contact';

export type CommunionCounts = { included: number; byStatus: Record<CommunionReviewStatus, number> };

export type CommunionPeriod = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: 'planned' | 'active' | 'closed';
  guideVersion: string;
  ownerUid: string;
  revision: number;
  occasions: Array<{ id: string; serviceDate: string; status: 'scheduled' | 'held' | 'cancelled' }>;
  counts: CommunionCounts;
};

export type CommunionReview = {
  id: string;
  memberId: string;
  memberName: string;
  memberActive: boolean;
  status: CommunionReviewStatus;
  rosterState: 'included' | 'excluded';
  assigneeUid: string;
  revision: number;
  updatedAt: string;
};

export async function listCommunionPeriods(user: User) {
  const response = await fetch('/api/raah/communion/periods', { headers: await getAuthHeaders(user) });
  return (await readJsonResponse<{ periods: CommunionPeriod[] }>(response)).periods;
}

export async function getCommunionPeriod(periodId: string, user: User) {
  const response = await fetch(`/api/raah/communion/periods/${encodeURIComponent(periodId)}`, { headers: await getAuthHeaders(user) });
  return readJsonResponse<{ period: CommunionPeriod; reviews: CommunionReview[] }>(response);
}

export type CommunionAvailability = 'checking' | 'available' | 'hidden';

/**
 * 404 means the feature flag is off and 403 means this account has no RAAH
 * grant: both keep the menu hidden rather than empty or locked (plan 5.1).
 * Any other failure (outage, network) is temporary, so the tab stays and shows
 * its own error with a retry instead of vanishing for the session.
 */
export function availabilityFromProbeError(error: unknown): CommunionAvailability {
  const status = (error as { status?: number } | null)?.status;
  return status === 403 || status === 404 ? 'hidden' : 'available';
}

export async function probeCommunionAvailability(user: User): Promise<CommunionAvailability> {
  try {
    await listCommunionPeriods(user);
    return 'available';
  } catch (error) {
    return availabilityFromProbeError(error);
  }
}

export type CommunionReviewDetail = {
  review: CommunionReview & { statusReason: string };
  logs: Array<{ id: string; date: string; logType: string; publicSummary: string; linkedAt: string }>;
};

export async function getCommunionReview(reviewId: string, user: User) {
  const response = await fetch(`/api/raah/communion/reviews/${encodeURIComponent(reviewId)}`, { headers: await getAuthHeaders(user) });
  return readJsonResponse<CommunionReviewDetail>(response);
}

export async function transitionCommunionReview(
  reviewId: string,
  input: { status: CommunionReviewStatus; expectedRevision: number; reason?: string },
  user: User
) {
  const response = await fetch(`/api/raah/communion/reviews/${encodeURIComponent(reviewId)}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(input),
  });
  return readJsonResponse<{ id: string; status: CommunionReviewStatus; revision: number }>(response);
}

export type CommunionLogInput = {
  expectedRevision: number;
  date: string;
  publicSummary: string;
  innerNote: string;
  prayerTopics: string;
  nextSteps: string;
};

/** `idempotencyKey` stays the same for retries of one save so a timeout cannot create two records. */
export async function createCommunionLog(reviewId: string, input: CommunionLogInput, idempotencyKey: string, user: User) {
  const response = await fetch(`/api/raah/communion/reviews/${encodeURIComponent(reviewId)}/logs`, {
    method: 'POST',
    headers: { ...(await getAuthHeaders(user)), 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
  return readJsonResponse<{ logId: string; revision: number }>(response);
}

export async function linkCommunionLog(reviewId: string, visitationLogId: string, user: User) {
  const response = await fetch(`/api/raah/communion/reviews/${encodeURIComponent(reviewId)}/logs`, {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify({ visitationLogId }),
  });
  return readJsonResponse<{ linked: boolean }>(response);
}

export type CommunionPeriodInput = { name: string; startsOn: string; endsOn: string; guideVersion: string; serviceDate: string | null };

export async function createCommunionPeriod(input: CommunionPeriodInput, idempotencyKey: string, user: User) {
  const response = await fetch('/api/raah/communion/periods', {
    method: 'POST',
    headers: { ...(await getAuthHeaders(user)), 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
  return readJsonResponse<{ id: string }>(response);
}

export type RosterEntry = { memberId: string; included: boolean };

/** Each entry is applied in its own transaction and is safe to resend. */
export async function updateCommunionRoster(periodId: string, entries: RosterEntry[], user: User) {
  const response = await fetch(`/api/raah/communion/periods/${encodeURIComponent(periodId)}/roster`, {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify({ entries }),
  });
  return readJsonResponse<{ applied: number; reviewIds: string[] }>(response);
}
