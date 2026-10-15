import { describe, expect, it } from 'vitest';
import { hasAttendanceDraftChanges, hasFormChanges, type AttendanceDraft } from './formChanges';

describe('hasFormChanges', () => {
  it('detects an edited field and ignores an untouched form', () => {
    const baseline = { memberName: '가상', innerNote: '', prayerTopics: '' };
    expect(hasFormChanges({ ...baseline }, baseline)).toBe(false);
    expect(hasFormChanges({ ...baseline, innerNote: '메모' }, baseline)).toBe(true);
  });

  it('treats missing and empty optional values as the same', () => {
    expect(hasFormChanges<{ phone?: string }>({ phone: '' }, {})).toBe(false);
  });
});

describe('hasAttendanceDraftChanges', () => {
  const record = (memberId: string, attended = false, communionParticipated = false, note = '') => ({
    memberId,
    memberName: memberId,
    memberSearchName: memberId,
    attended,
    communionParticipated,
    note,
  });
  const saved: AttendanceDraft = {
    records: [record('a', true), record('b')],
    serviceType: '주일예배',
    includesCommunion: true,
    memo: '',
  };

  it('is clean when the sheet matches what was saved', () => {
    expect(hasAttendanceDraftChanges({ ...saved, records: saved.records.map((item) => ({ ...item })) }, saved)).toBe(false);
  });

  it.each([
    ['a checkbox', { records: [record('a', true), record('b', true)] }],
    ['communion', { records: [record('a', true, true), record('b')] }],
    ['a member note', { records: [record('a', true), record('b', false, false, '병가')] }],
    ['the service memo', { memo: '연합예배' }],
    ['the communion setting', { includesCommunion: false }],
  ])('detects a change to %s', (_label, change) => {
    expect(hasAttendanceDraftChanges({ ...saved, ...change }, saved)).toBe(true);
  });
});
