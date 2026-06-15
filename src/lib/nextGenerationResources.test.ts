import { describe, expect, it } from 'vitest';
import {
  formatShortDate,
  getContentPreview,
  getCurrentSundayKey,
  getPostPrimarySortTime,
  getPostWeekKey,
  getNextGenerationPostBackPath,
  getResourceDepartmentPath,
  getResourceLabel,
  getResourceTab,
  getSundayDate,
  isFamilyWorshipPost,
  toLocalDateKey,
} from './nextGenerationResources';

const tabs = [
  { id: 'elementary_script', slug: 'script', name: 'Script', departmentSlug: 'elementary' },
  { id: 'podcast_review', slug: 'podcast', name: 'Podcast', departmentSlug: 'young-adults' },
];

const departments = [
  { slug: 'elementary' },
  { slug: 'young-adults' },
];

describe('next generation resource helpers', () => {
  it('maps any day to the next Sunday key at local noon', () => {
    expect(toLocalDateKey(getSundayDate(new Date('2026-05-12T09:00:00+09:00')))).toBe('2026-05-17');
    expect(toLocalDateKey(getSundayDate(new Date('2026-05-17T03:00:00+09:00')))).toBe('2026-05-17');
  });

  it('derives post week keys from explicit week keys before createdAt', () => {
    expect(getPostWeekKey({ nextGenerationWeekKey: '2026-05-10', createdAt: new Date('2026-05-12') })).toBe('2026-05-10');
    expect(getPostWeekKey({ createdAt: new Date('2026-05-12T09:00:00+09:00') })).toBe('2026-05-17');
  });

  it('uses explicit week key as primary sort anchor', () => {
    expect(getPostPrimarySortTime({ nextGenerationWeekKey: '2026-05-10', createdAt: new Date('2026-05-12') })).toBe(
      new Date('2026-05-10').getTime()
    );
  });

  it('resolves resource labels, tabs, and department paths from id or slug', () => {
    expect(getResourceLabel('podcast', tabs)).toBe('Podcast');
    expect(getResourceTab('script', tabs)).toEqual(tabs[0]);
    expect(getResourceDepartmentPath('podcast_review', tabs, departments)).toBe('/next/young-adults');
  });

  it('falls back to elementary department and default copy safely', () => {
    expect(getResourceLabel('missing', tabs)).toBe('다음세대 자료');
    expect(getResourceDepartmentPath('missing', tabs, departments)).toBe('/next/elementary');
    expect(getContentPreview('')).toBe('함께 확인할 자료가 준비되어 있습니다.');
  });

  it('keeps legacy young-adult tab ids under the young-adults department without CMS data', () => {
    expect(getResourceDepartmentPath('podcast_review')).toBe('/next/young-adults');
    expect(getResourceDepartmentPath('pilgrim_lecture')).toBe('/next/young-adults');
  });

  it('returns to the source resource list when a post was opened from a grouped tab', () => {
    expect(
      getNextGenerationPostBackPath('elementary_script', tabs, departments, 'elementary_weekly', {
        sourcePath: '/next/elementary?resource=elementary_weekly',
        topicId: 'faith',
        includeTopic: true,
      })
    ).toBe('/next/elementary?resource=elementary_weekly');
  });

  it('falls back to the post resource tab when no safe source list is available', () => {
    expect(
      getNextGenerationPostBackPath('elementary_script', tabs, departments, 'elementary_weekly', {
        sourcePath: 'https://example.com/next/elementary?resource=elementary_weekly',
        topicId: 'faith',
        includeTopic: true,
      })
    ).toBe('/next/elementary?resource=elementary_script&topic=faith');
  });

  it('formats Firestore-like timestamps for compact activity lists', () => {
    expect(formatShortDate({ toDate: () => new Date('2026-05-12T09:00:00+09:00') })).toBe('2026.05.12');
    expect(formatShortDate(null)).toBe('');
  });

  it('returns the current Sunday key in YYYY-MM-DD shape', () => {
    expect(getCurrentSundayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('identifies family worship posts for compact hymn playback', () => {
    expect(isFamilyWorshipPost({ nextGenerationTabSlug: 'family_worship' })).toBe(true);
    expect(isFamilyWorshipPost({ subCategory: 'family_worship' })).toBe(true);
    expect(isFamilyWorshipPost({ subCategory: 'elementary_script' })).toBe(false);
  });
});
