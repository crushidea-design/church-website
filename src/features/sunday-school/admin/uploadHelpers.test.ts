import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHOOL_CURRICULUM as curriculum, DEFAULT_SCHOOL_TERMS as terms } from '../seedData';
import { getSchoolWeekStatus } from '../schedule';
import { describeSchoolWeek, getAdminDepartmentTopics, getSuggestedTopicId } from './uploadHelpers';

const status = (sundayKey: string) => getSchoolWeekStatus({ terms, curriculum, sundayKey });

describe('getAdminDepartmentTopics', () => {
  const topics = [
    { id: 'b', name: '숨김 주제', keywords: [], departmentSlug: 'elementary', isVisible: false, order: 2 },
    { id: 'a', name: '공개 주제', keywords: [], departmentSlug: 'elementary', isVisible: true, order: 1 },
    { id: 'c', name: '다른 부서', keywords: [], departmentSlug: 'young-adults', isVisible: true, order: 3 },
  ];

  it('includes hidden topics with a suffix and keeps order and department filter', () => {
    const result = getAdminDepartmentTopics(topics, 'elementary');
    expect(result.map((topic) => topic.name)).toEqual(['공개 주제', '숨김 주제 (숨김)']);
    expect(result.map((topic) => topic.id)).toEqual(['a', 'b']);
  });
});

describe('describeSchoolWeek', () => {
  it('describes a lesson with its Lord\'s Day', () => {
    expect(describeSchoolWeek(status('2027-02-28'))).toBe(
      '2027 1학기 · 7회 · 하이델베르크 제6주일 16~17문 「참 사람이시며 참 하나님이신 중보자」',
    );
  });

  it('describes holiday, vacation, off and unscheduled weeks', () => {
    expect(describeSchoolWeek(status('2027-02-07'))).toContain('휴강');
    expect(describeSchoolWeek(status('2027-07-11'))).toContain('방학');
    expect(describeSchoolWeek(status('2026-12-27'))).toContain('없는');
    expect(describeSchoolWeek({ mode: 'unscheduled', term: terms[0] })).toContain('진도표 없음');
  });

  it('describes an opening without a Lord\'s Day by title', () => {
    expect(describeSchoolWeek(status('2027-01-03'))).toContain('개강 주일');
  });
});

describe('getSuggestedTopicId', () => {
  it('suggests the matching Heidelberg topic only when it exists', () => {
    expect(getSuggestedTopicId(status('2027-02-28'), ['heidelberg-ld-06'])).toBe('heidelberg-ld-06');
    expect(getSuggestedTopicId(status('2027-02-28'), ['ten-commandments'])).toBeNull();
    expect(getSuggestedTopicId(status('2027-02-07'), ['heidelberg-ld-06'])).toBeNull();
    expect(getSuggestedTopicId(status('2027-01-03'), ['heidelberg-ld-06'])).toBeNull();
  });
});
