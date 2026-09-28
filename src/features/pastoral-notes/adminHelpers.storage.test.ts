import { describe, expect, it } from 'vitest';
import { shouldUseLegacyFirestore } from './adminHelpers';

describe('shouldUseLegacyFirestore', () => {
  it('falls back only when Supabase was never configured', () => {
    expect(shouldUseLegacyFirestore({ status: 503, code: 'RAAH_SUPABASE_NOT_CONFIGURED' })).toBe(true);
  });

  it.each([
    ['an access-grant lookup outage', { status: 503, code: 'RAAH_ACCESS_UNAVAILABLE' }],
    ['a Firebase auth outage', { status: 503 }],
    ['a missing route', { status: 404 }],
    ['a denied grant', { status: 403, code: 'RAAH_ACCESS_NOT_GRANTED' }],
    ['a network error', new TypeError('Failed to fetch')],
    ['nothing', null],
  ])('fails closed on %s', (_label, error) => {
    expect(shouldUseLegacyFirestore(error)).toBe(false);
  });
});
