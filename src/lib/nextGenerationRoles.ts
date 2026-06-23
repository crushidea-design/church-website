import type {
  Department,
  NextGenerationMember,
  NextGenerationRoleProfiles,
} from './nextGenerationAuth';

const ROLE_PRIORITY: Department[] = ['교사', '학부모', '청년', '학생'];
const VALID_DEPARTMENTS = new Set<Department>(['청년', '교사', '학부모', '학생']);

export function getMemberDepartments(member: Pick<NextGenerationMember, 'department' | 'departments'> | null | undefined): Department[] {
  if (!member) return [];

  const candidates = Array.isArray(member.departments) && member.departments.length > 0
    ? member.departments
    : [member.department];

  return candidates.reduce<Department[]>((list, department) => {
    if (VALID_DEPARTMENTS.has(department) && !list.includes(department)) {
      list.push(department);
    }
    return list;
  }, []);
}

export function hasDepartment(member: Pick<NextGenerationMember, 'department' | 'departments'> | null | undefined, department: Department) {
  return getMemberDepartments(member).includes(department);
}

export function getDefaultPrimaryDepartment(departments: Department[]) {
  const validDepartments = departments.filter((department) => VALID_DEPARTMENTS.has(department));
  return ROLE_PRIORITY.find((department) => validDepartments.includes(department)) || validDepartments[0] || '청년';
}

export function getPrimaryDepartment(
  member: Pick<NextGenerationMember, 'department' | 'departments' | 'primaryDepartment'> | null | undefined,
) {
  if (!member) return '청년';

  const departments = getMemberDepartments(member);
  if (member.primaryDepartment && departments.includes(member.primaryDepartment)) {
    return member.primaryDepartment;
  }

  return getDefaultPrimaryDepartment(departments);
}

export function buildMemberRoleFields(departments: Department[]) {
  const normalized = departments.reduce<Department[]>((list, department) => {
    if (VALID_DEPARTMENTS.has(department) && !list.includes(department)) {
      list.push(department);
    }
    return list;
  }, []);
  const safeDepartments: Department[] = normalized.length > 0 ? normalized : ['청년'];
  const primaryDepartment = getDefaultPrimaryDepartment(safeDepartments);
  const roleProfiles: NextGenerationRoleProfiles = {};

  if (safeDepartments.includes('교사')) {
    roleProfiles.teacher = { groupIds: [] };
  }
  if (safeDepartments.includes('학부모')) {
    roleProfiles.parent = { childIds: [] };
  }
  if (safeDepartments.includes('청년')) {
    roleProfiles.youngAdult = { enabled: true };
  }
  if (safeDepartments.includes('학생')) {
    roleProfiles.student = {};
  }

  return {
    department: primaryDepartment,
    departments: safeDepartments,
    primaryDepartment,
    roleProfiles,
  };
}
