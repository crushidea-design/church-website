import { describe, expect, it } from 'vitest';
import {
  DEMO_CURRICULUM_PATH,
  NEXT_GENERATION_DEMO_STEPS,
  getDemoPageUrl,
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
});
