import { describe, expect, it } from 'vitest';
import { decryptJson, encryptJson } from './raah-crypto.mjs';
import { decryptPayload, encryptPayload } from '../raah-management.mjs';

const secret = 'crypto-contract-test-secret';
const body = { innerNote: '가상 기록', prayerTopics: '가상 기도', nextSteps: '', privateRemarks: '' };

describe('raah-crypto contract', () => {
  it('reads what the visitation-log encryption writes, and vice versa', () => {
    expect(decryptJson(encryptPayload(body, secret), secret)).toEqual(body);
    expect(decryptPayload(encryptJson(body, secret), secret)).toEqual(body);
  });

  it('uses a fresh IV each time and rejects a wrong key or tampered ciphertext', () => {
    const first = encryptJson({ detail: '가상' }, secret);
    const second = encryptJson({ detail: '가상' }, secret);
    expect(first.iv).not.toBe(second.iv);
    expect(() => decryptJson(first, 'another-secret')).toThrow();
    const tampered = { ...first, ciphertext: Buffer.from('changed').toString('base64') };
    expect(() => decryptJson(tampered, secret)).toThrow();
  });
});
