import { describe, expect, it } from 'vitest';
import {
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
    expect(getFamilyWorshipFamilyLabel('홍길동')).toBe('홍 가정');
    expect(getFamilyWorshipFamilyLabel('Grace Kim')).toBe('G 가정');
    expect(getFamilyWorshipFamilyLabel('')).toBe('한 가정');
  });
});
