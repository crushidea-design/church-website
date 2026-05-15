import { describe, expect, it } from 'vitest';
import {
  getNextGenerationTutorialSteps,
  markNextGenerationTutorialSeen,
  NEXT_GENERATION_TUTORIAL_STORAGE_KEY,
  shouldAutoOpenNextGenerationTutorial,
} from './nextGenerationTutorial';

describe('next generation tutorial steps', () => {
  it('introduces the young-adult app features in a parent-friendly order', () => {
    const steps = getNextGenerationTutorialSteps('young-adults');

    expect(steps.map((step) => step.id)).toEqual([
      'overview',
      'materials',
      'word',
      'qa',
      'notifications',
    ]);
    expect(steps[0].title).toContain('전용 공간');
    expect(steps.at(-1)?.body).toContain('알림');
  });

  it('uses department-specific steps so elementary users do not see young-adult-only guidance', () => {
    const elementarySteps = getNextGenerationTutorialSteps('elementary');
    const youngAdultSteps = getNextGenerationTutorialSteps('young-adults');

    expect(elementarySteps.map((step) => step.id)).toEqual([
      'overview',
      'materials',
      'wordFruit',
      'profileReading',
      'qa',
      'notifications',
    ]);
    expect(elementarySteps.some((step) => step.id === 'word')).toBe(false);
    expect(youngAdultSteps.some((step) => step.id === 'wordFruit')).toBe(false);
  });

  it('connects every step to a real screen target', () => {
    for (const department of ['elementary', 'young-adults'] as const) {
      for (const step of getNextGenerationTutorialSteps(department)) {
        expect(step.route).toMatch(/^\/next/);
        expect(step.target).toMatch(/^\[data-next-tour="/);
      }
    }
  });

  it('auto-opens only until the tutorial is marked as seen', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) || null,
      setItem: (key: string, value: string) => store.set(key, value),
    };

    expect(shouldAutoOpenNextGenerationTutorial(storage)).toBe(true);
    markNextGenerationTutorialSeen(storage);
    expect(store.get(NEXT_GENERATION_TUTORIAL_STORAGE_KEY)).toBe('true');
    expect(shouldAutoOpenNextGenerationTutorial(storage)).toBe(false);
  });
});
