import React from 'react';

export const DISCARD_CHANGES_MESSAGE = '저장하지 않은 내용이 있습니다. 저장하지 않고 계속할까요?';

/** Asks before discarding unsaved input. Returns true when it is safe to continue. */
export function confirmDiscardChanges(hasUnsavedChanges: boolean) {
  return !hasUnsavedChanges || window.confirm(DISCARD_CHANGES_MESSAGE);
}

/** Shows the browser's leave-page prompt while unsaved input exists. Nothing is stored locally. */
export function useBeforeUnloadWarning(hasUnsavedChanges: boolean) {
  React.useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedChanges]);
}
