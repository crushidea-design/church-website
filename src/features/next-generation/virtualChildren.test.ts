import { describe, expect, it } from 'vitest';
import {
  getVirtualChildrenForMember,
  summarizeVirtualChildOwners,
  VirtualChildProfile,
} from './virtualChildren';
import type { NextGenerationMember } from '../../lib/nextGenerationAuth';

const member = (overrides: Partial<NextGenerationMember>): NextGenerationMember => ({
  uid: 'member-1',
  email: 'member@example.com',
  displayName: '멤버',
  role: 'member',
  department: '청년',
  church: '한우리교회',
  intro: '',
  provider: 'email',
  createdAt: {} as NextGenerationMember['createdAt'],
  ...overrides,
});

const child = (overrides: Partial<VirtualChildProfile>): VirtualChildProfile => ({
  id: 'proxy:parent-1:1',
  displayName: '이하임',
  department: '유초등부',
  groupId: 'class-a',
  parentUids: ['parent-1'],
  assignedTeacherUids: [],
  createdByAdmin: false,
  ...overrides,
});

describe('virtual child helpers', () => {
  it('finds the virtual children assigned to a parent or teacher member', () => {
    const children = [
      child({ id: 'proxy:parent-1:1', parentUids: ['parent-1'], assignedTeacherUids: [] }),
      child({ id: 'teacher-child:teacher-1:1', parentUids: [], assignedTeacherUids: ['teacher-1'] }),
      child({ id: 'teacher-child:teacher-2:1', parentUids: [], assignedTeacherUids: ['teacher-2'] }),
    ];

    expect(getVirtualChildrenForMember(children, member({ uid: 'parent-1' })).map((item) => item.id)).toEqual([
      'proxy:parent-1:1',
    ]);
    expect(getVirtualChildrenForMember(children, member({ uid: 'teacher-1' })).map((item) => item.id)).toEqual([
      'teacher-child:teacher-1:1',
    ]);
  });

  it('summarizes parent and teacher assignments by display name', () => {
    const owners = summarizeVirtualChildOwners(
      child({
        parentUids: ['parent-1'],
        assignedTeacherUids: ['teacher-1'],
      }),
      [
        member({ uid: 'parent-1', displayName: '이부모' }),
        member({ uid: 'teacher-1', displayName: '이교사' }),
      ],
    );

    expect(owners.parentNames).toEqual(['이부모']);
    expect(owners.teacherNames).toEqual(['이교사']);
  });
});
