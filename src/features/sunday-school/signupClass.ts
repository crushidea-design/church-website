// Class a student picks at sign-up. It is only a request: the pastor
// confirms it on approval, which copies it into the member's `groupId`.
import type { NextGenerationMember } from '../../lib/nextGenerationAuth';
import type { SchoolClassId } from './types';

export const SCHOOL_CLASS_IDS: readonly SchoolClassId[] = ['seed', 'jaram', 'seum', 'didim'];

export const SCHOOL_CLASS_NAMES: Record<SchoolClassId, string> = {
  seed: '씨앗',
  jaram: '자람',
  seum: '세움',
  didim: '디딤',
};

export function isSchoolClassId(value: unknown): value is SchoolClassId {
  return typeof value === 'string' && (SCHOOL_CLASS_IDS as readonly string[]).includes(value);
}

/** The class a pending student asked for, or null. */
export function getRequestedSchoolClass(
  member: Pick<NextGenerationMember, 'roleProfiles'> | null | undefined,
): SchoolClassId | null {
  const requested = member?.roleProfiles?.student?.requestedGroupId;
  return isSchoolClassId(requested) ? requested : null;
}

/**
 * The `groupId` to set when approving this member, or null to leave it alone.
 * Never overwrites a class the pastor already assigned.
 */
export function getGroupIdToApply(
  member: Pick<NextGenerationMember, 'roleProfiles' | 'groupId'> | null | undefined,
): SchoolClassId | null {
  if (!member || member.groupId) return null;
  return getRequestedSchoolClass(member);
}
