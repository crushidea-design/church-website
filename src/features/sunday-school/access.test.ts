import { describe, expect, it } from 'vitest';
import { decideSchoolAccess, SCHOOL_REDIRECT_PATH } from './access';

const base = { flagEnabled: false, flagLoading: false, authLoading: false, isPastor: false };

describe('decideSchoolAccess', () => {
  it('waits while the flag or auth is loading', () => {
    expect(decideSchoolAccess({ ...base, flagLoading: true })).toBe('loading');
    expect(decideSchoolAccess({ ...base, authLoading: true, isPastor: true })).toBe('loading');
    expect(decideSchoolAccess({ ...base, flagEnabled: true, authLoading: true })).toBe('loading');
  });

  it('allows everyone when the flag is on', () => {
    expect(decideSchoolAccess({ ...base, flagEnabled: true })).toBe('allow');
  });

  it('allows only pastors when the flag is off', () => {
    expect(decideSchoolAccess({ ...base, isPastor: true })).toBe('allow');
    expect(decideSchoolAccess(base)).toBe('redirect');
  });

  it('redirects to the existing elementary page', () => {
    expect(SCHOOL_REDIRECT_PATH).toBe('/next/elementary');
  });
});
