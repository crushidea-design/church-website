import type { User } from 'firebase/auth';
import { getAuthHeaders, readJsonResponse } from '../managementApi';
import type { EcclesialDraft, EcclesialSummary, MemberEcclesialProfile } from './helpers';

export async function getMemberEcclesialProfile(memberId: string, user: User) {
  const response = await fetch(`/api/raah/communion/members/${encodeURIComponent(memberId)}/profile`, { headers: await getAuthHeaders(user) });
  const { profile } = await readJsonResponse<{ profile?: MemberEcclesialProfile }>(response);
  if (!profile) throw Object.assign(new Error('RAAH communion API is not available.'), { status: 404 });
  return profile;
}

/** `expectedRevision` is 0 when nothing has been recorded for this member yet. */
export async function setMemberEcclesialProfile(memberId: string, input: EcclesialDraft & { expectedRevision: number }, user: User) {
  const response = await fetch(`/api/raah/communion/members/${encodeURIComponent(memberId)}/profile`, {
    method: 'PUT',
    headers: await getAuthHeaders(user),
    body: JSON.stringify({ ...input, sourceLabel: input.sourceLabel.trim() }),
  });
  return readJsonResponse<{ revision: number }>(response);
}

/** Statuses only (no source, no verifier). Members without a row are unknown. */
export async function listEcclesialSummaries(user: User) {
  const response = await fetch('/api/raah/communion/profiles', { headers: await getAuthHeaders(user) });
  const { profiles } = await readJsonResponse<{ profiles?: EcclesialSummary[] }>(response);
  if (!Array.isArray(profiles)) throw Object.assign(new Error('RAAH communion API is not available.'), { status: 404 });
  return profiles;
}
