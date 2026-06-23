import { describe, expect, it } from 'vitest';
import {
  buildMemberRoleFields,
  getDefaultPrimaryDepartment,
  getMemberDepartments,
  getPrimaryDepartment,
  hasDepartment,
} from './nextGenerationRoles';
import { NextGenerationMember } from './nextGenerationAuth';

const member = (patch: Partial<NextGenerationMember>): NextGenerationMember => ({
  uid: 'uid-1',
  email: 'user@example.com',
  displayName: '사용자',
  role: 'member',
  department: '청년',
  church: '한우리교회',
  intro: '',
  provider: 'google',
  createdAt: {} as any,
  ...patch,
});

describe('next generation role helpers', () => {
  it('falls back to the legacy department when departments is missing', () => {
    const target = member({ department: '학부모' });

    expect(getMemberDepartments(target)).toEqual(['학부모']);
    expect(hasDepartment(target, '학부모')).toBe(true);
    expect(hasDepartment(target, '교사')).toBe(false);
  });

  it('deduplicates departments and keeps valid departments only', () => {
    const target = member({
      department: '청년',
      departments: ['교사', '학부모', '교사', '청년'],
    });

    expect(getMemberDepartments(target)).toEqual(['교사', '학부모', '청년']);
  });

  it('uses teacher as the default primary role when a member is both teacher and parent', () => {
    expect(getDefaultPrimaryDepartment(['학부모', '교사'])).toBe('교사');
  });

  it('honors a valid stored primary department', () => {
    const target = member({
      department: '교사',
      departments: ['교사', '학부모'],
      primaryDepartment: '학부모',
    });

    expect(getPrimaryDepartment(target)).toBe('학부모');
  });

  it('builds compatibility fields and role profiles for signup writes', () => {
    expect(buildMemberRoleFields(['교사', '학부모'])).toEqual({
      department: '교사',
      departments: ['교사', '학부모'],
      primaryDepartment: '교사',
      roleProfiles: {
        teacher: { groupIds: [] },
        parent: { childIds: [] },
      },
    });
  });

  it('uses an admin-selected primary role when it is one of the member roles', () => {
    expect(buildMemberRoleFields(['교사', '학부모'], '학부모')).toMatchObject({
      department: '학부모',
      departments: ['교사', '학부모'],
      primaryDepartment: '학부모',
    });
  });
});
