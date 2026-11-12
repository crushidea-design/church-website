import { describe, expect, it } from 'vitest';
import { buildHeidelbergTopics, buildPreparationTabs, pickMissing } from './preparationCatalog';

describe('buildHeidelbergTopics', () => {
  const topics = buildHeidelbergTopics();

  it('builds 52 hidden topics with unique ids', () => {
    expect(topics).toHaveLength(52);
    expect(new Set(topics.map((topic) => topic.slug)).size).toBe(52);
    expect(topics.every((topic) => topic.isVisible === false)).toBe(true);
    expect(topics[0].slug).toBe('heidelberg-ld-01');
    expect(topics[51].slug).toBe('heidelberg-ld-52');
  });

  it('names topics with the Lord\'s Day and question range', () => {
    expect(topics[5].name).toBe('하이델베르크 제6주일 (16~19문)');
    expect(topics.every((topic) => topic.keywords.length === 0)).toBe(true);
    expect(topics[5].order).toBe(1006);
    expect(topics[8].name).toBe('하이델베르크 제9주일 (26문)');
    expect(topics[0].departmentSlug).toBe('elementary');
  });

  it('uses slugs accepted by the post topic id rule', () => {
    expect(topics.every((topic) => /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/.test(topic.slug))).toBe(true);
  });
});

describe('buildPreparationTabs', () => {
  const tabs = buildPreparationTabs();

  it('builds six hidden elementary tabs ordered from 101', () => {
    expect(tabs.map((tab) => tab.slug)).toEqual([
      'workbook_jaram',
      'workbook_seum',
      'workbook_didim',
      'seed_songs_stories',
      'parent_guide',
      'school_events',
    ]);
    expect(tabs.map((tab) => tab.order)).toEqual([101, 102, 103, 104, 105, 106]);
    expect(tabs.every((tab) => !tab.isVisible && !tab.isGuestOpen && !tab.isWeeklyGroup)).toBe(true);
    expect(tabs.every((tab) => tab.departmentSlug === 'elementary')).toBe(true);
  });

  it('only the guide and events tabs skip week key and topic', () => {
    const bySlug = Object.fromEntries(tabs.map((tab) => [tab.slug, tab]));
    expect(bySlug.parent_guide).toMatchObject({ useWeekKey: false, useTopic: false, iconName: 'HeartHandshake' });
    expect(bySlug.school_events).toMatchObject({ useWeekKey: false, useTopic: false, iconName: 'CalendarDays' });
    expect(bySlug.workbook_jaram).toMatchObject({ useWeekKey: true, useTopic: true, iconName: 'BookMarked' });
    expect(bySlug.seed_songs_stories).toMatchObject({ useWeekKey: true, useTopic: true, iconName: 'Sparkles' });
  });
});

describe('pickMissing', () => {
  it('never returns documents that already exist', () => {
    const topics = buildHeidelbergTopics();
    const missing = pickMissing(['heidelberg-ld-01', 'heidelberg-ld-52', 'other'], topics);
    expect(missing).toHaveLength(50);
    expect(missing.some((topic) => topic.slug === 'heidelberg-ld-01')).toBe(false);
  });

  it('returns everything when nothing exists and nothing when all exist', () => {
    const tabs = buildPreparationTabs();
    expect(pickMissing([], tabs)).toHaveLength(6);
    expect(pickMissing(tabs.map((tab) => tab.slug), tabs)).toHaveLength(0);
  });
});
