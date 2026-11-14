import { describe, expect, it } from 'vitest';
import { getGroupIdToApply, getRequestedSchoolClass, isSchoolClassId } from './signupClass';

describe('signupClass', () => {
  it('accepts only the four school classes', () => {
    expect(isSchoolClassId('seum')).toBe(true);
    expect(isSchoolClassId('elementary')).toBe(false);
    expect(isSchoolClassId(undefined)).toBe(false);
  });

  it('reads the requested class from the student profile', () => {
    expect(getRequestedSchoolClass({ roleProfiles: { student: { requestedGroupId: 'didim' } } })).toBe('didim');
    expect(getRequestedSchoolClass({ roleProfiles: { student: { requestedGroupId: 'bogus' } } })).toBeNull();
    expect(getRequestedSchoolClass({ roleProfiles: {} })).toBeNull();
    expect(getRequestedSchoolClass(null)).toBeNull();
  });

  it('applies the request only when no class is assigned yet', () => {
    const profiles = { student: { requestedGroupId: 'seum' } };
    expect(getGroupIdToApply({ roleProfiles: profiles })).toBe('seum');
    expect(getGroupIdToApply({ roleProfiles: profiles, groupId: 'didim' })).toBeNull();
    expect(getGroupIdToApply({ roleProfiles: {} })).toBeNull();
  });
});
