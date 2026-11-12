import { describe, expect, it } from 'vitest';
import {
  HEIDELBERG_LORDS_DAYS,
  HEIDELBERG_PART_LABELS,
  HEIDELBERG_TOTAL_LORDS_DAYS,
  HEIDELBERG_TOTAL_QUESTIONS,
  getHeidelbergPart,
} from './heidelberg';

describe('heidelberg catalog', () => {
  it('has 52 Lord\'s Days covering questions 1..129 contiguously', () => {
    expect(HEIDELBERG_LORDS_DAYS).toHaveLength(HEIDELBERG_TOTAL_LORDS_DAYS);
    let expected = 1;
    HEIDELBERG_LORDS_DAYS.forEach((item, index) => {
      expect(item.lordsDay).toBe(index + 1);
      expect(item.questions[0]).toBe(expected);
      expect(item.questions[1]).toBeGreaterThanOrEqual(item.questions[0]);
      expected = item.questions[1] + 1;
    });
    expect(expected - 1).toBe(HEIDELBERG_TOTAL_QUESTIONS);
  });

  it('splits LD24 and LD25 at question 64/65', () => {
    expect(HEIDELBERG_LORDS_DAYS[23].questions[1]).toBe(64);
    expect(HEIDELBERG_LORDS_DAYS[24].questions[0]).toBe(65);
  });

  it('maps part boundaries', () => {
    expect(getHeidelbergPart(1)).toBe('comfort');
    expect(getHeidelbergPart(2)).toBe('misery');
    expect(getHeidelbergPart(4)).toBe('misery');
    expect(getHeidelbergPart(5)).toBe('deliverance');
    expect(getHeidelbergPart(31)).toBe('deliverance');
    expect(getHeidelbergPart(32)).toBe('gratitude');
    expect(getHeidelbergPart(52)).toBe('gratitude');
    expect(HEIDELBERG_PART_LABELS.misery).toBe('비참');
  });
});
