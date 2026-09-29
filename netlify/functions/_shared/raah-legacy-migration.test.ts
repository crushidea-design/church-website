import { describe, expect, it } from 'vitest';
import { LOG_TYPES } from '../../../src/features/pastoral-notes/adminHelpers';
import { LEGACY_LOG_TYPES, LOG_LIMITS, findMatchingMemberId, mapLegacyNote } from './raah-legacy-migration.mjs';

const members = [
  { id: 'm-kim', name: '가상 김성도', is_synthetic: false },
  { id: 'm-dup-1', name: '가상 이성도', is_synthetic: false },
  { id: 'm-dup-2', name: '가상 이성도', is_synthetic: false },
  { id: 'm-test', name: '가상 시범', is_synthetic: true },
];

const payload = { currentSituation: '가상 현재 상황', encouragement: '', prayerTopics: '가상 기도', nextFollowUpDate: '', remarks: '' };
const note = (over: Partial<Parameters<typeof mapLegacyNote>[0]> = {}) => ({ memberName: '가상 김성도', meetingType: '심방', payload, ...over });

describe('mapLegacyNote', () => {
  it('keeps the server list of log types in step with the client', () => {
    expect([...LEGACY_LOG_TYPES]).toEqual(LOG_TYPES);
  });

  it('keeps a known meeting type as the log type without a prefix', () => {
    const mapped = mapLegacyNote(note({ meetingType: '상담' }), members);
    expect(mapped).toMatchObject({ ok: true, logType: '상담' });
    expect(mapped.ok && mapped.body.innerNote).toBe('가상 현재 상황');
  });

  it('files an unknown meeting type under 기타 and keeps the original as the first paragraph', () => {
    const mapped = mapLegacyNote(note({ meetingType: '가정 방문' }), members);
    expect(mapped).toMatchObject({ ok: true, logType: '기타' });
    expect(mapped.ok && mapped.body.innerNote).toBe('[만남 유형] 가정 방문\n\n가상 현재 상황');
  });

  it('appends a non-empty encouragement under a [권면] heading and skips an empty one', () => {
    const withEncouragement = mapLegacyNote(note({ payload: { ...payload, encouragement: '  가상 권면  ' } }), members);
    expect(withEncouragement.ok && withEncouragement.body.innerNote).toBe('가상 현재 상황\n\n[권면]\n가상 권면');
    const blank = mapLegacyNote(note({ payload: { ...payload, encouragement: '   ' } }), members);
    expect(blank.ok && blank.body.innerNote).toBe('가상 현재 상황');
  });

  it('combines an unknown type and an encouragement in order', () => {
    const mapped = mapLegacyNote(note({ meetingType: '식사', payload: { ...payload, encouragement: '가상 권면' } }), members);
    expect(mapped.ok && mapped.body.innerNote).toBe('[만남 유형] 식사\n\n가상 현재 상황\n\n[권면]\n가상 권면');
  });

  it('turns the follow-up date into nextSteps and copies remarks and prayer topics', () => {
    const mapped = mapLegacyNote(note({ payload: { ...payload, nextFollowUpDate: '2026-11-01', remarks: '  가상 비고 ' } }), members);
    expect(mapped.ok && mapped.body).toEqual({
      innerNote: '가상 현재 상황',
      prayerTopics: '가상 기도',
      nextSteps: '다음 확인일: 2026-11-01',
      privateRemarks: '가상 비고',
    });
  });

  it('leaves nextSteps and privateRemarks empty when the note has none', () => {
    const { payload: bare } = { payload: { currentSituation: '가상 현재 상황', encouragement: '', prayerTopics: '가상 기도' } };
    const mapped = mapLegacyNote(note({ payload: bare }), members);
    expect(mapped.ok && mapped.body).toMatchObject({ nextSteps: '', privateRemarks: '' });
  });

  it('produces exactly the four log fields', () => {
    const mapped = mapLegacyNote(note(), members);
    expect(mapped.ok && Object.keys(mapped.body).sort()).toEqual(['innerNote', 'nextSteps', 'prayerTopics', 'privateRemarks']);
  });

  it('links a member only when exactly one real member has that name', () => {
    expect(mapLegacyNote(note({ memberName: ' 가상 김성도 ' }), members)).toMatchObject({ memberId: 'm-kim' });
    expect(mapLegacyNote(note({ memberName: '가상 박성도' }), members)).toMatchObject({ memberId: null });
    expect(mapLegacyNote(note({ memberName: '가상 이성도' }), members)).toMatchObject({ memberId: null });
    expect(mapLegacyNote(note({ memberName: '가상 시범' }), members)).toMatchObject({ memberId: null });
    expect(findMatchingMemberId('가상  김성도', members)).toBeNull();
    expect(findMatchingMemberId('', members)).toBeNull();
  });

  it('skips a note whose mapped body exceeds a log limit instead of truncating it', () => {
    const tooLong = (field: string, length: number) => mapLegacyNote(note({ payload: { ...payload, [field]: 'ㄱ'.repeat(length) } }), members);
    expect(tooLong('currentSituation', LOG_LIMITS.innerNote + 1)).toEqual({ ok: false, reason: 'too_long' });
    expect(tooLong('prayerTopics', LOG_LIMITS.prayerTopics + 1)).toEqual({ ok: false, reason: 'too_long' });
    expect(tooLong('remarks', LOG_LIMITS.privateRemarks + 1)).toEqual({ ok: false, reason: 'too_long' });
    expect(tooLong('currentSituation', LOG_LIMITS.innerNote)).toMatchObject({ ok: true });
  });

  it('counts the added [권면] and [만남 유형] text toward the innerNote limit', () => {
    const almostFull = 'ㄱ'.repeat(LOG_LIMITS.innerNote - 3);
    const mapped = mapLegacyNote(note({ payload: { ...payload, currentSituation: almostFull, encouragement: '가상' } }), members);
    expect(mapped).toEqual({ ok: false, reason: 'too_long' });
  });

  it('rejects a body the log editor could not save again', () => {
    expect(mapLegacyNote(note({ payload: { ...payload, currentSituation: '', encouragement: '' } }), members)).toEqual({ ok: false, reason: 'invalid' });
    expect(mapLegacyNote(note({ payload: { ...payload, prayerTopics: '  ' } }), members)).toEqual({ ok: false, reason: 'invalid' });
  });
});
