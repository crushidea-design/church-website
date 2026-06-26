import type { NextGenerationMember } from '../../lib/nextGenerationAuth';

export interface VirtualChildProfile {
  id: string;
  displayName: string;
  department?: string;
  groupId?: string;
  parentUids?: string[];
  assignedTeacherUids?: string[];
  careType?: string;
  createdByAdmin?: boolean;
  parentName?: string;
}

export function getVirtualChildrenForMember(
  children: VirtualChildProfile[],
  member: Pick<NextGenerationMember, 'uid'>,
): VirtualChildProfile[] {
  return children.filter((child) =>
    (child.parentUids ?? []).includes(member.uid) ||
    (child.assignedTeacherUids ?? []).includes(member.uid),
  );
}

export function summarizeVirtualChildOwners(
  child: VirtualChildProfile,
  members: Array<Pick<NextGenerationMember, 'uid' | 'displayName'>>,
) {
  const memberNameByUid = new Map(members.map((member) => [member.uid, member.displayName]));
  const parentNames = (child.parentUids ?? []).map((uid) => memberNameByUid.get(uid) ?? uid);
  const teacherNames = (child.assignedTeacherUids ?? []).map((uid) => memberNameByUid.get(uid) ?? uid);

  return { parentNames, teacherNames };
}
