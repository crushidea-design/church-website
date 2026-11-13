// Pure access rule for the preview-gated 2027 Sunday school pages.

export type SchoolAccessDecision = 'loading' | 'allow' | 'redirect';

/** Where viewers who may not see the new pages are sent (replace). */
export const SCHOOL_REDIRECT_PATH = '/next/elementary';

export function decideSchoolAccess({
  flagEnabled,
  flagLoading,
  authLoading,
  isPastor,
}: {
  flagEnabled: boolean;
  flagLoading: boolean;
  authLoading: boolean;
  isPastor: boolean;
}): SchoolAccessDecision {
  if (flagLoading || authLoading) return 'loading';
  if (flagEnabled) return 'allow';
  return isPastor ? 'allow' : 'redirect';
}
