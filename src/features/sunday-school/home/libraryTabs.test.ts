import { describe, expect, it } from 'vitest';
import {
  SCHOOL_STUDENT_TAB_IDS,
  buildTopicChips,
  getSchoolTopics,
  selectSchoolLibraryTabs,
} from './libraryTabs';

const tab = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  departmentSlug: 'elementary',
  isVisible: true,
  ...extra,
});

describe('selectSchoolLibraryTabs', () => {
  const tabs = [
    tab('elementary_weekly'),
    tab('elementary_script', { name: '강의원고' }),
    tab('elementary_workbook'),
    tab('elementary_guide'),
    tab('family_column'),
    tab('family_worship'),
    tab('summer_bible_school'),
    tab('workbook_didim', { isVisible: false }),
    tab('workbook_jaram', { isVisible: false }),
    tab('workbook_seum', { isVisible: false }),
    tab('seed_songs_stories', { isVisible: false }),
    tab('parent_guide', { isVisible: false }),
    tab('school_events', { isVisible: false }),
    tab('custom_hidden', { isVisible: false }),
    tab('pilgrim_lecture', { departmentSlug: 'young-adults' }),
  ];

  it('excludes archived, replaced, hidden unknown and other-department tabs', () => {
    const ids = selectSchoolLibraryTabs(tabs).map((t) => t.id);
    expect(ids).not.toContain('elementary_workbook');
    expect(ids).not.toContain('summer_bible_school');
    expect(ids).not.toContain('elementary_weekly');
    expect(ids).not.toContain('custom_hidden');
    expect(ids).not.toContain('pilgrim_lecture');
  });

  it('includes preparation tabs even when hidden, in the required order', () => {
    expect(selectSchoolLibraryTabs(tabs).map((t) => t.id)).toEqual([
      'elementary_script',
      'workbook_jaram',
      'workbook_seum',
      'workbook_didim',
      'seed_songs_stories',
      'elementary_guide',
      'family_column',
      'family_worship',
      'parent_guide',
      'school_events',
    ]);
  });

  it('overrides the script tab name without touching others', () => {
    const result = selectSchoolLibraryTabs(tabs);
    expect(result[0].name).toBe('공통 강해 원고');
    expect(result.find((t) => t.id === 'family_column')?.name).toBe('family_column');
    expect(tabs[1].name).toBe('강의원고');
  });

  it('keeps visible unknown elementary tabs after the known ones', () => {
    const ids = selectSchoolLibraryTabs([tab('extra'), tab('family_column')]).map((t) => t.id);
    expect(ids).toEqual(['family_column', 'extra']);
  });

  it('lets students open the 2027 class workbooks and the script', () => {
    expect(SCHOOL_STUDENT_TAB_IDS).toEqual(
      expect.arrayContaining(['elementary_workbook', 'workbook_seum', 'workbook_didim', 'elementary_script']),
    );
    expect(SCHOOL_STUDENT_TAB_IDS).not.toContain('elementary_guide');
  });
});

describe('topic chips', () => {
  const topics = [
    { id: 'ten-commandments', name: '십계명', keywords: ['십계명'], departmentSlug: 'elementary', isVisible: true, order: 1 },
    { id: 'scripture', name: '성경', keywords: ['성경'], departmentSlug: 'elementary', isVisible: true, order: 2 },
    { id: 'heidelberg-ld-01', name: '하이델베르크 제1주일 (1문)', keywords: [], departmentSlug: 'elementary', isVisible: false, order: 1001 },
    { id: 'heidelberg-ld-02', name: '하이델베르크 제2주일 (3~5문)', keywords: [], departmentSlug: 'elementary', isVisible: false, order: 1002 },
    { id: 'other-dept', name: '타부서', keywords: [], departmentSlug: 'young-adults', isVisible: true, order: 3 },
    { id: 'hidden-old', name: '숨김', keywords: [], departmentSlug: 'elementary', isVisible: false, order: 4 },
  ];

  it('keeps hidden Heidelberg topics but not other departments or hidden old topics', () => {
    const ids = getSchoolTopics(topics).map((t) => t.id);
    expect(ids).toEqual(['ten-commandments', 'scripture', 'heidelberg-ld-01', 'heidelberg-ld-02']);
  });

  it('lists Heidelberg topics with posts first and old topics as past', () => {
    const schoolTopics = getSchoolTopics(topics);
    const posts = [
      { title: 'a', nextGenerationTopicId: 'heidelberg-ld-02' },
      { title: 'b', nextGenerationTopicId: 'heidelberg-ld-02' },
      { title: '십계명 공과' },
      { title: '아무 주제 아님' },
    ];
    const chips = buildTopicChips(posts, schoolTopics);
    expect(chips.current).toEqual([{ id: 'heidelberg-ld-02', name: '하이델베르크 제2주일 (3~5문)', count: 2 }]);
    expect(chips.past.map((c) => [c.id, c.count])).toEqual([
      ['ten-commandments', 1],
      ['unassigned', 1],
    ]);
  });
});
