import { describe, expect, it } from 'vitest';
import { getInitialSermonTab } from './sermonTabs';

const categories = [
  { id: 'nehemiah', name: '느헤미야 강해', order: 0 },
  { id: 'ezra', name: '에스라 강해', order: 1 },
];

describe('sermon tab selection', () => {
  it('defaults to the first visible sermon category instead of all', () => {
    expect(getInitialSermonTab(null, categories)).toBe('nehemiah');
  });

  it('ignores the old all tab param and uses the first visible category', () => {
    expect(getInitialSermonTab('all', categories)).toBe('nehemiah');
  });

  it('keeps a valid category tab param', () => {
    expect(getInitialSermonTab('ezra', categories)).toBe('ezra');
  });

  it('falls back to uncategorized when no visible categories exist', () => {
    expect(getInitialSermonTab(null, [])).toBe('uncategorized');
  });
});
