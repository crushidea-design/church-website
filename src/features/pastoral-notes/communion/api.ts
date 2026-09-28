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
 * The menu appears only when the API answers: 404 means the feature flag is
 * off and 403 means this account has no RAAH grant — both keep it hidden
 * rather than showing an empty or locked menu (plan 5.1).
 */
export async function probeCommunionAvailability(user: User): Promise<CommunionAvailability> {
  try {
    await listCommunionPeriods(user);
    return 'available';
  } catch {
    return 'hidden';
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
