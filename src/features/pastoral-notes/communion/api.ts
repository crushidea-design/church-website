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
