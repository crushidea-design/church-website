import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/firebase', () => ({ db: {} }));

import { DEFAULT_SCHOOL_IDENTITY, normalizeSchoolIdentity } from './identity';

describe('normalizeSchoolIdentity', () => {
  it('uses the defaults when nothing is stored', () => {
    expect(normalizeSchoolIdentity(undefined)).toEqual(DEFAULT_SCHOOL_IDENTITY);
    expect(normalizeSchoolIdentity(null)).toEqual(DEFAULT_SCHOOL_IDENTITY);
  });

  it('keeps stored non-empty strings and trims them', () => {
    const result = normalizeSchoolIdentity({ name: '  새 이름 주일학교 ', period: '2029–2030' });
    expect(result.name).toBe('새 이름 주일학교');
    expect(result.period).toBe('2029–2030');
    expect(result.nameEn).toBe(DEFAULT_SCHOOL_IDENTITY.nameEn);
  });

  it('ignores blank and non-string values', () => {
    const result = normalizeSchoolIdentity({ name: '   ', nameEn: 3, extra: 'x' });
    expect(result).toEqual(DEFAULT_SCHOOL_IDENTITY);
  });

  it('defaults to 그안에 주일학교 / In Him', () => {
    expect(DEFAULT_SCHOOL_IDENTITY.name).toBe('그안에 주일학교');
    expect(DEFAULT_SCHOOL_IDENTITY.nameEn).toBe('In Him Sunday School');
  });
});
