import { describe, expect, it } from 'vitest';
import { mergeTabsWithRequiredDefaults, supportsNextGenerationYoutubeUrl } from './sharedConstants';

describe('next generation resource tabs', () => {
  it('keeps required new default tabs when CMS tabs already exist', () => {
    const tabs = mergeTabsWithRequiredDefaults([
      { id: 'family_column', slug: 'family_column', name: '예배를 잇는 가정' },
    ]);

    expect(tabs.map((tab: any) => tab.slug || tab.id)).toContain('family_column');
    expect(tabs.map((tab: any) => tab.slug || tab.id)).toContain('family_worship');
  });

  it('allows a dedicated YouTube URL field for family worship posts', () => {
    expect(supportsNextGenerationYoutubeUrl('family_worship')).toBe(true);
    expect(supportsNextGenerationYoutubeUrl('podcast_review')).toBe(true);
    expect(supportsNextGenerationYoutubeUrl('family_column')).toBe(false);
  });
});
