import { describe, expect, it } from 'vitest';
import { translatePassage } from './mcheyneUtils';

describe('translatePassage', () => {
  it('keeps verse ranges in compact notation', () => {
    expect(translatePassage('Isaiah 10:5-34').text).toBe('이사야 10:5-34');
    expect(translatePassage('Isaiah 9:8-10:4').text).toBe('이사야 9:8-10:4');
  });

  it('adds Korean chapter suffix only for chapter-only readings', () => {
    expect(translatePassage('Numbers 21').text).toBe('민수기 21장');
    expect(translatePassage('Psalms 60-61').text).toBe('시편 60-61편');
  });
});
