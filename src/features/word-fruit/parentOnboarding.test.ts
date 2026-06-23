import { describe, expect, it } from 'vitest';
import { NextGenerationMember } from '../../lib/nextGenerationAuth';
import { shouldShowParentOnboarding } from './parentOnboarding';

const parent = (overrides: Partial<NextGenerationMember> = {}): NextGenerationMember => ({
  uid: 'parent-1',
  email: 'parent@example.com',
  displayName: '학부모',
  role: 'member',
  department: '학부모',
  church: '한우리교회',
  intro: '',
  provider: 'email',
  createdAt: {} as NextGenerationMember['createdAt'],
  ...overrides,
});

describe('shouldShowParentOnboarding', () => {
  it('shows for an approved parent with no child setup', () => {
    expect(shouldShowParentOnboarding(parent(), true)).toBe(true);
  });

  it('shows for a teacher who also has the parent role', () => {
    expect(shouldShowParentOnboarding(parent({
      department: '교사',
      departments: ['교사', '학부모'],
      primaryDepartment: '교사',
    }), true)).toBe(true);
  });

  it('does not show after the parent completed onboarding', () => {
    expect(shouldShowParentOnboarding(parent({ parentOnboardingCompleted: true }), true)).toBe(false);
  });

  it('does not show when a child account is already linked', () => {
    expect(shouldShowParentOnboarding(parent({ childIds: ['child-1'] }), true)).toBe(false);
  });

  it('does not show when a proxy child already exists', () => {
    expect(shouldShowParentOnboarding(parent({
      proxyChildren: [{ id: 'proxy:parent-1:1', name: '아이', usesPhone: false }],
    }), true)).toBe(false);
  });

  it('does not show for non-parent members or inaccessible accounts', () => {
    expect(shouldShowParentOnboarding(parent({ department: '학생' }), true)).toBe(false);
    expect(shouldShowParentOnboarding(parent(), false)).toBe(false);
  });
});
