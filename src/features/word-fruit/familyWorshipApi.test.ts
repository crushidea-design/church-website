import { describe, expect, it } from 'vitest';
import {
  canDeleteFamilyWorshipLog,
  getFamilyWorshipFamilyLabel,
  validateFamilyWorshipPhoto,
} from './familyWorshipApi';

describe('family worship sharing helpers', () => {
  it('accepts jpg and png worship photos only', () => {
    expect(validateFamilyWorshipPhoto(new File(['x'], 'worship.jpg', { type: 'image/jpeg' }))).toBeNull();
    expect(validateFamilyWorshipPhoto(new File(['x'], 'worship.png', { type: 'image/png' }))).toBeNull();
    expect(validateFamilyWorshipPhoto(new File(['x'], 'worship.gif', { type: 'image/gif' }))).toContain('JPG');
  });

  it('limits worship photos to 10MB', () => {
    const largePhoto = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' });

    expect(validateFamilyWorshipPhoto(largePhoto)).toContain('10MB');
  });

  it('shows public family labels without exposing full parent names', () => {
    expect(getFamilyWorshipFamilyLabel('관리자', ['이종이'])).toBe('이종이 가정');
    expect(getFamilyWorshipFamilyLabel('홍길동')).toBe('홍 가정');
    expect(getFamilyWorshipFamilyLabel('Grace Kim')).toBe('G 가정');
    expect(getFamilyWorshipFamilyLabel('')).toBe('한 가정');
  });

  it('allows owners and moderators to delete family worship logs', () => {
    const log = { id: 'log-1', parentUid: 'parent-1', weekKey: '2026-06-14', childUids: [] };

    expect(canDeleteFamilyWorshipLog(log, 'parent-1', false)).toBe(true);
    expect(canDeleteFamilyWorshipLog(log, 'teacher-1', true)).toBe(true);
    expect(canDeleteFamilyWorshipLog(log, 'other-1', false)).toBe(false);
  });
});
