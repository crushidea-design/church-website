export interface SermonTabCategory {
  id: string;
  name: string;
  order: number;
}

export const UNCATEGORIZED_SERMON_TAB = 'uncategorized';

export function getInitialSermonTab(tabParam: string | null, visibleCategories: SermonTabCategory[]) {
  if (tabParam && tabParam !== 'all') {
    if (
      visibleCategories.some((category) => category.id === tabParam) ||
      tabParam === 'pilgrims_progress' ||
      tabParam === UNCATEGORIZED_SERMON_TAB
    ) {
      return tabParam;
    }
  }

  return visibleCategories[0]?.id || UNCATEGORIZED_SERMON_TAB;
}
