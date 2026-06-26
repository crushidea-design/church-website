import { NextGenerationMember } from '../../lib/nextGenerationAuth';
import { hasDepartment } from '../../lib/nextGenerationRoles';

export function shouldShowParentOnboarding(
  member: NextGenerationMember | null,
  hasAccess: boolean,
  hasRegisteredProxyChildren = false,
) {
  if (!hasAccess || !hasDepartment(member, '학부모')) {
    return false;
  }

  const hasLinkedChildren = (member.childIds?.length ?? 0) > 0;
  const hasChildNames = (member.childNames?.length ?? 0) > 0;
  const hasProxyChildren = (member.proxyChildren?.length ?? 0) > 0;

  return !member.parentOnboardingCompleted && !hasLinkedChildren && !hasChildNames && !hasProxyChildren && !hasRegisteredProxyChildren;
}
