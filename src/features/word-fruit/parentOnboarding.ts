import { NextGenerationMember } from '../../lib/nextGenerationAuth';

export function shouldShowParentOnboarding(member: NextGenerationMember | null, hasAccess: boolean) {
  if (!hasAccess || member?.department !== '학부모') {
    return false;
  }

  const hasLinkedChildren = (member.childIds?.length ?? 0) > 0;
  const hasProxyChildren = (member.proxyChildren?.length ?? 0) > 0;

  return !member.parentOnboardingCompleted && !hasLinkedChildren && !hasProxyChildren;
}
