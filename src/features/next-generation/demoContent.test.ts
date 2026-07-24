import { describe, expect, it } from 'vitest';
import {
  DEMO_CURRICULUM_PATH,
  DEMO_REAL_PAGE_LINKS,
  NEXT_GENERATION_DEMO_STEPS,
  NEXT_GENERATION_PARENT_QR_PATH,
  getDemoPageUrl,
  getGuideOnlyDemoStepIds,
  getNextGenerationHomeUrl,
} from './demoContent';

describe('next generation parent guide content', () => {
  it('orders the parent flow from sign-up through questions and notifications', () => {
    expect(NEXT_GENERATION_DEMO_STEPS.map((step) => step.id)).toEqual([
      'signup',
      'children',
      'curriculum',
      'word-fruit',
      'family-worship',
      'qa-notifications',
    ]);
  });

  it('links the curriculum step to the real elementary workbook tab', () => {
    expect(DEMO_CURRICULUM_PATH).toBe('/next/elementary?resource=elementary_workbook');
  });

  it('marks only explanatory and local interactions as guide-only', () => {
    expect(getGuideOnlyDemoStepIds()).toEqual([
      'children',
      'word-fruit',
      'family-worship',
      'qa-notifications',
    ]);
  });

  it('builds the parent guide URL from the current origin when available', () => {
    expect(getDemoPageUrl('https://builttogether.church')).toBe('https://builttogether.church/next/demo');
  });

  it('builds the real next-generation home URL for the parent QR', () => {
    expect(getNextGenerationHomeUrl('https://builttogether.church')).toBe('https://builttogether.church/next');
    expect(NEXT_GENERATION_PARENT_QR_PATH).toBe('/next-generation-parent-qr.png');
  });

  it('provides real-page links for every parent feature', () => {
    expect(DEMO_REAL_PAGE_LINKS).toEqual({
      myPage: '/next/me?fromDemo=1&scrollTop=1',
      curriculum: '/next/elementary?resource=elementary_workbook&fromDemo=1&scrollTop=1',
      wordFruit: '/next/elementary?highlight=word-fruit&fromDemo=1&scrollTop=1',
      familyWorship: '/next/elementary?resource=family_worship&fromDemo=1&scrollTop=1',
      qa: '/next/elementary?highlight=qa&fromDemo=1&scrollTop=1',
    });
  });

  it('uses parent-specific language in the first two steps', () => {
    expect(NEXT_GENERATION_DEMO_STEPS[0].description).toContain('학부모');
    expect(NEXT_GENERATION_DEMO_STEPS[1].description).toContain('부모 계정');
  });
});
