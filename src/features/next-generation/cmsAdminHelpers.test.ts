import { describe, expect, it } from 'vitest';
import { isPostInNextGenerationTab } from './cmsAdminHelpers';

describe('next generation post placement', () => {
  it('uses the legacy subcategory when no canonical tab slug is stored', () => {
    expect(isPostInNextGenerationTab({ subCategory: 'old-tab' }, 'old-tab')).toBe(true);
  });

  it('uses nextGenerationTabSlug before the legacy subcategory', () => {
    expect(
      isPostInNextGenerationTab(
        { subCategory: 'old-tab', nextGenerationTabSlug: 'current-tab' },
        'old-tab'
      )
    ).toBe(false);
    expect(
      isPostInNextGenerationTab(
        { subCategory: 'stale-tab', nextGenerationTabSlug: 'old-tab' },
        'old-tab'
      )
    ).toBe(true);
  });
});
