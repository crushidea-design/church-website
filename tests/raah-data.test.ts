import { describe, expect, it } from 'vitest';
import { encryptPayload as encryptLog, decryptPayload as decryptLog } from '../netlify/functions/raah-management.mjs';
import { buildGoogleEventPayload } from '../netlify/functions/raah-calendar.mjs';

describe('pastoral record encryption compatibility', () => {
  it('round-trips visitation fields without changing the stored envelope', () => {
    const log = { innerNote: '테스트 기록', prayerTopics: '기도', nextSteps: '후속', privateRemarks: '비고' };
    expect(decryptLog(encryptLog(log, 'test-only-secret'), 'test-only-secret')).toEqual(log);
    expect(encryptLog(log, 'test-only-secret').iv).not.toEqual(encryptLog(log, 'test-only-secret').iv);
  });
  it('rejects modified ciphertext and wrong encryption keys', () => {
    const encrypted = encryptLog({ innerNote: '기록', prayerTopics: '기도', nextSteps: '', privateRemarks: '' }, 'test-only-secret');
    const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
    ciphertext[0] ^= 1;
    expect(() => decryptLog({ ...encrypted, ciphertext: ciphertext.toString('base64') }, 'test-only-secret')).toThrow();
    expect(() => decryptLog(encrypted, 'wrong-key')).toThrow();
  });
});

describe('calendar export privacy', () => {
  it('preserves ordinary schedule times but never sends the local memo', () => {
    const event = buildGoogleEventPayload({ title: '교사 모임', date: '2026-09-17', startsAt: '15:00', endsAt: '16:00', memo: 'PRIVATE_TEST_MARKER' });
    expect(event.summary).toBe('교사 모임');
    expect(event.start).toEqual({ dateTime: '2026-09-17T15:00:00', timeZone: 'Asia/Seoul' });
    expect(JSON.stringify(event)).not.toContain('PRIVATE_TEST_MARKER');
  });
  it('uses a neutral title for a schedule linked to a member', () => {
    const event = buildGoogleEventPayload({ title: 'PRIVATE_TEST_MARKER', memberId: 'member1', date: '2026-09-17', endDate: '2026-09-19', startsAt: '', endsAt: '' });
    expect(event.summary).toBe('목양 일정');
    expect(event.end).toEqual({ date: '2026-09-20' });
    expect(JSON.stringify(event)).not.toContain('PRIVATE_TEST_MARKER');
  });
});
