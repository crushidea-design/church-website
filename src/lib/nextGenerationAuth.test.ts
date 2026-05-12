import { describe, expect, it } from 'vitest';
import {
  isRestrictedDepartment,
  NEXT_GENERATION_DEPARTMENTS,
  STUDENT_ACCESSIBLE_TAB_SLUGS,
} from './nextGenerationAuth';

describe('next generation access helpers', () => {
  it('keeps student accounts restricted to the workbook tab allowlist', () => {
    expect(NEXT_GENERATION_DEPARTMENTS).toContain('학생');
    expect(isRestrictedDepartment('학생')).toBe(true);
    expect(STUDENT_ACCESSIBLE_TAB_SLUGS).toEqual(['elementary_workbook']);
  });

  it('does not restrict teachers, parents, or youth members', () => {
    expect(isRestrictedDepartment('교사')).toBe(false);
    expect(isRestrictedDepartment('학부모')).toBe(false);
    expect(isRestrictedDepartment('청년')).toBe(false);
    expect(isRestrictedDepartment(null)).toBe(false);
  });
});
