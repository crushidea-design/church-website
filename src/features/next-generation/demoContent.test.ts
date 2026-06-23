import { describe, expect, it } from 'vitest';
import {
  DEMO_BIBLE_READING_COMPLETED_BOOK_INDEXES,
  DEMO_CURRICULUM_PATH,
  DEMO_REAL_PAGE_LINKS,
  NEXT_GENERATION_DEMO_STEPS,
  getDemoPageUrl,
  getNextGenerationHomeUrl,
  getLocalOnlyDemoStepIds,
} from './demoContent';

describe('next generation demo content', () => {
  it('orders the presenter flow from sign-up through family worship', () => {
    expect(NEXT_GENERATION_DEMO_STEPS.map((step) => step.id)).toEqual([
      'signup',
      'bible-reading',
      'curriculum',
      'word-fruit',
      'qa',
      'family-worship',
    ]);
  });

  it('links the curriculum step to the real elementary workbook tab', () => {
    expect(DEMO_CURRICULUM_PATH).toBe('/next/elementary?resource=elementary_workbook');
  });

  it('marks only the safe local-only scenes as demo-only', () => {
    expect(getLocalOnlyDemoStepIds()).toEqual([
      'bible-reading',
      'word-fruit',
      'qa',
      'family-worship',
    ]);
  });

  it('builds the demo URL from the current origin when available', () => {
    expect(getDemoPageUrl('https://builttogether.church')).toBe('https://builttogether.church/next/demo');
  });

  it('builds the real next-generation home URL for the sign-up QR', () => {
    expect(getNextGenerationHomeUrl('https://builttogether.church')).toBe('https://builttogether.church/next');
  });

  it('uses a small fixed set of real bible chart book positions for the demo', () => {
    expect(DEMO_BIBLE_READING_COMPLETED_BOOK_INDEXES).toEqual([0, 1, 17, 18, 35, 36, 48, 49, 64, 65]);
  });

  it('provides real-page links for every demo feature after sign-up', () => {
    expect(DEMO_REAL_PAGE_LINKS).toEqual({
      bibleReading: '/next/me?fromDemo=1',
      curriculum: '/next/elementary?resource=elementary_workbook&fromDemo=1',
      wordFruit: '/next/elementary?highlight=word-fruit&fromDemo=1',
      qa: '/next/elementary?highlight=qa&fromDemo=1',
      familyWorship: '/next/elementary?resource=family_worship&fromDemo=1',
    });
  });
});
