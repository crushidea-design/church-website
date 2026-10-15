import { describe, expect, it } from 'vitest';
import {
  BAPTISM_LABELS,
  COMMUNICANT_LABELS,
  EMPTY_ECCLESIAL_PROFILE,
  PROFESSION_LABELS,
  SOURCE_MAX_LENGTH,
  communicantBadge,
  communicantStatusById,
  draftFromProfile,
  hasRecordedFact,
  passesCommunicantFilter,
  validateEcclesialDraft,
} from './helpers';

const unknown = draftFromProfile(EMPTY_ECCLESIAL_PROFILE);

describe('ecclesial labels', () => {
  it('uses the agreed Korean labels', () => {
    expect(BAPTISM_LABELS).toEqual({ unknown: '미확인', not_baptized: '받지 않음', baptized: '받음' });
    expect(PROFESSION_LABELS).toEqual({ unknown: '미확인', preparing: '준비 중', confirmed: '입교함' });
    expect(COMMUNICANT_LABELS).toEqual({ unknown: '미확인', not_registered: '등록 안 됨', registered: '등록됨' });
  });

  it('defaults to unknown everywhere with revision 0', () => {
    expect(EMPTY_ECCLESIAL_PROFILE).toMatchObject({ baptismStatus: 'unknown', professionStatus: 'unknown', communicantStatus: 'unknown', revision: 0 });
  });
});

describe('validateEcclesialDraft', () => {
  it('lets an all-unknown draft save without a source', () => {
    expect(hasRecordedFact(unknown)).toBe(false);
    expect(validateEcclesialDraft(unknown)).toBeNull();
  });

  it('requires a source whenever any status is recorded', () => {
    expect(validateEcclesialDraft({ ...unknown, baptismStatus: 'baptized' })).toMatch(/출처/);
    expect(validateEcclesialDraft({ ...unknown, communicantStatus: 'not_registered', sourceLabel: '   ' })).toMatch(/출처/);
    expect(validateEcclesialDraft({ ...unknown, professionStatus: 'preparing', sourceLabel: '교적부 2026' })).toBeNull();
  });

  it('refuses an over-long source', () => {
    expect(validateEcclesialDraft({ ...unknown, sourceLabel: 'ㄱ'.repeat(SOURCE_MAX_LENGTH + 1) })).toMatch(/이내/);
    expect(validateEcclesialDraft({ ...unknown, baptismStatus: 'baptized', sourceLabel: 'ㄱ'.repeat(SOURCE_MAX_LENGTH) })).toBeNull();
  });
});

describe('communicant badge and filter', () => {
  it('labels each status, treating a missing one as unknown', () => {
    expect(communicantBadge('registered').label).toBe('성찬회원');
    expect(communicantBadge('not_registered').label).toBe('등록 안 됨');
    expect(communicantBadge('unknown').label).toBe('미확인');
    expect(communicantBadge(undefined).label).toBe('미확인');
  });

  it('shows everyone by default and only registered members (plus the current roster) when filtered', () => {
    const statuses = communicantStatusById([
      { memberId: 'a', baptismStatus: 'baptized', professionStatus: 'confirmed', communicantStatus: 'registered' },
      { memberId: 'b', baptismStatus: 'unknown', professionStatus: 'unknown', communicantStatus: 'not_registered' },
    ]);
    const onRoster = new Set(['b']);
    expect(passesCommunicantFilter('c', statuses, false, onRoster)).toBe(true);
    expect(passesCommunicantFilter('a', statuses, true, onRoster)).toBe(true);
    expect(passesCommunicantFilter('c', statuses, true, onRoster)).toBe(false);
    expect(passesCommunicantFilter('b', statuses, true, onRoster)).toBe(true); // already on the roster
    expect(passesCommunicantFilter('b', statuses, true, new Set())).toBe(false);
  });
});
