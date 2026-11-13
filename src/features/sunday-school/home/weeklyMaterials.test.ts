import { describe, expect, it } from 'vitest';
import { getWeeklyTabIds, groupWeeklyMaterials, parseClassFilter } from './weeklyMaterials';

const post = (id: string, tab: string, week?: string) => ({ id, nextGenerationTabSlug: tab, nextGenerationWeekKey: week });

describe('weeklyMaterials', () => {
  it('maps each class to its own tab after the common tabs', () => {
    expect(getWeeklyTabIds('seed')).toEqual(['elementary_script', 'family_column', 'family_worship', 'seed_songs_stories']);
    expect(getWeeklyTabIds('jaram').at(-1)).toBe('workbook_jaram');
    expect(getWeeklyTabIds('seum').at(-1)).toBe('workbook_seum');
    expect(getWeeklyTabIds('didim').at(-1)).toBe('workbook_didim');
  });

  it('includes all four class tabs for 전체', () => {
    expect(getWeeklyTabIds('all')).toEqual([
      'elementary_script',
      'family_column',
      'family_worship',
      'seed_songs_stories',
      'workbook_jaram',
      'workbook_seum',
      'workbook_didim',
    ]);
  });

  it('parses the class query value', () => {
    expect(parseClassFilter('seum')).toBe('seum');
    expect(parseClassFilter('x')).toBe('all');
    expect(parseClassFilter(null)).toBe('all');
  });

  it('keeps only posts of the requested week', () => {
    const posts = [
      post('a', 'elementary_script', '2027-01-10'),
      post('b', 'elementary_script', '2027-01-17'),
      post('c', 'workbook_jaram', '2027-01-10'),
      post('d', 'workbook_seum', '2027-01-10'),
      post('e', 'elementary_weekly', '2027-01-10'),
      post('f', 'family_column'),
    ];
    const groups = groupWeeklyMaterials({ posts, sundayKey: '2027-01-10', classFilter: 'jaram' });
    expect(groups.map((g) => g.tabId)).toEqual(['elementary_script', 'family_column', 'family_worship', 'workbook_jaram']);
    expect(groups.find((g) => g.tabId === 'elementary_script')?.posts.map((p) => p.id)).toEqual(['a']);
    expect(groups.find((g) => g.tabId === 'workbook_jaram')?.posts.map((p) => p.id)).toEqual(['c']);
    expect(groups.find((g) => g.tabId === 'family_column')?.posts).toEqual([]);
  });

  it('falls back to subCategory and honors the allowed list', () => {
    const posts = [{ id: 'x', subCategory: 'workbook_seum', nextGenerationWeekKey: '2027-01-10' }];
    const groups = groupWeeklyMaterials({
      posts,
      sundayKey: '2027-01-10',
      classFilter: 'all',
      allowedTabIds: ['workbook_seum', 'elementary_script'],
    });
    expect(groups.map((g) => g.tabId)).toEqual(['elementary_script', 'workbook_seum']);
    expect(groups[1].posts).toHaveLength(1);
  });
});
