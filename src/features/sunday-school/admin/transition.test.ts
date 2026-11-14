import { describe, expect, it } from 'vitest';
import { buildPreservationInventory, isElementaryPost, isSchoolTransitionPost } from './transition';

describe('preservation inventory', () => {
  const published = [
    { title: '십계명 1', subCategory: 'elementary_script', nextGenerationTopicId: 'ten-commandments' },
    { title: '사도신경 공과', subCategory: 'elementary_workbook', nextGenerationTabSlug: 'elementary_workbook' },
    { title: '여름', subCategory: 'summer_bible_school' },
    { title: '청년', subCategory: 'pilgrim_lecture' },
    { title: '가정예배', nextGenerationTabSlug: 'family_worship', nextGenerationDepartmentSlug: 'elementary' },
  ];
  const unpublished = [{ title: '자람반', nextGenerationTabSlug: 'workbook_jaram', nextGenerationDepartmentSlug: 'elementary' }];

  it('excludes young-adult posts and counts public/private per tab', () => {
    const result = buildPreservationInventory(published, unpublished);
    const row = (id: string) => result.tabs.find((item) => item.id === id)!;
    expect(result.total).toEqual({ published: 4, private: 1 });
    expect(row('elementary_script').published).toBe(1);
    expect(row('elementary_workbook')).toMatchObject({ published: 1, archived: true });
    expect(row('summer_bible_school')).toMatchObject({ published: 1, archived: true });
    expect(row('workbook_jaram')).toMatchObject({ published: 0, private: 1 });
    expect(result.tabs.find((item) => item.id === 'pilgrim_lecture')).toBeUndefined();
  });

  it('counts topics only for topic tabs, using the keyword fallback', () => {
    const result = buildPreservationInventory(published, unpublished);
    const topic = (id: string) => result.topics.find((item) => item.id === id)!;
    expect(topic('ten-commandments').published).toBe(1);
    expect(topic('apostles-creed').published).toBe(1);
    expect(topic('unassigned').published).toBe(0);
  });

  it('lists unknown elementary tabs so nothing is hidden', () => {
    const result = buildPreservationInventory([{ subCategory: 'custom_tab' }], []);
    expect(result.tabs.find((item) => item.id === 'custom_tab')).toMatchObject({ published: 1 });
  });

  it('treats a missing department as elementary unless the tab is a young-adult one', () => {
    expect(isElementaryPost({ subCategory: 'elementary_guide' })).toBe(true);
    expect(isElementaryPost({ subCategory: 'retreat_materials' })).toBe(false);
    expect(isElementaryPost({ subCategory: 'x', nextGenerationDepartmentSlug: 'young-adults' })).toBe(false);
  });
});

describe('bulk publish scope', () => {
  it('accepts school library tabs by tab slug or sub category', () => {
    expect(isSchoolTransitionPost({ tabSlug: 'workbook_jaram' })).toBe(true);
    expect(isSchoolTransitionPost({ nextGenerationTabSlug: 'family_worship' })).toBe(true);
    expect(isSchoolTransitionPost({ subCategory: 'elementary_script' })).toBe(true);
    expect(isSchoolTransitionPost({ nextGenerationTabSlug: 'parent_guide', subCategory: 'other' })).toBe(true);
  });

  it('keeps youth drafts, archived tabs and untagged posts out', () => {
    expect(isSchoolTransitionPost({ tabSlug: 'pilgrim_lecture' })).toBe(false);
    expect(isSchoolTransitionPost({ subCategory: 'retreat_materials' })).toBe(false);
    expect(isSchoolTransitionPost({ tabSlug: 'elementary_workbook' })).toBe(false);
    expect(isSchoolTransitionPost({ tabSlug: '' })).toBe(false);
    expect(isSchoolTransitionPost({})).toBe(false);
  });
});
