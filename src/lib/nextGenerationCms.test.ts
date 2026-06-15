import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NEXT_GENERATION_TABS,
  getMissingDefaultNextGenerationTabs,
} from './nextGenerationCms';

describe('next generation CMS defaults', () => {
  it('finds default tabs missing from an existing CMS collection', () => {
    const existingTabs = DEFAULT_NEXT_GENERATION_TABS.filter((tab) => tab.slug !== 'family_worship');

    const missing = getMissingDefaultNextGenerationTabs(existingTabs);

    expect(missing.map((tab) => tab.slug)).toEqual(['family_worship']);
  });

  it('does not duplicate default tabs already present in CMS', () => {
    const missing = getMissingDefaultNextGenerationTabs(DEFAULT_NEXT_GENERATION_TABS);

    expect(missing).toEqual([]);
  });
});
