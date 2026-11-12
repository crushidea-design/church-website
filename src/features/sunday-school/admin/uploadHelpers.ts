import type { NextGenerationTopicOption } from '../../../lib/nextGenerationTopics';
import { HEIDELBERG_LORDS_DAYS } from '../heidelberg';
import type { SchoolWeekStatus } from '../schedule';
import { heidelbergTopicId } from './preparationCatalog';
import { formatQuestionRange } from './scheduleAdmin';

/**
 * Admin-only topic list for the upload form: includes hidden topics (marked
 * " (숨김)"). Non-admins keep using getDepartmentTopics unchanged.
 */
export function getAdminDepartmentTopics<T extends NextGenerationTopicOption>(
  topics: T[],
  departmentSlug?: string,
): T[] {
  return topics
    .filter((topic) => !topic.departmentSlug || !departmentSlug || topic.departmentSlug === departmentSlug)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((topic) => (topic.isVisible === false ? { ...topic, name: `${topic.name} (숨김)` } : topic));
}

/** One-line description of what the school calendar says about a Sunday. */
export function describeSchoolWeek(status: SchoolWeekStatus): string {
  switch (status.mode) {
    case 'off':
      return '학사 일정에 없는 주일입니다.';
    case 'vacation':
      return `${status.term.name} ${status.weekIndex}주차 (방학, 총 ${status.totalWeeks}주)`;
    case 'unscheduled':
      return `${status.term.name} · 진도표 없음`;
    case 'holiday':
      return `${status.term.name} · 휴강 (${status.entry.title})`;
    case 'lesson': {
      const { term, entry } = status;
      const parts = [term.name];
      if (entry.session) parts.push(`${entry.session}회`);
      if (entry.lordsDay) {
        const range = formatQuestionRange(entry.questions);
        parts.push(`하이델베르크 제${entry.lordsDay}주일${range ? ` ${range}` : ''} 「${entry.title}」`);
      } else {
        parts.push(entry.title);
      }
      return parts.join(' · ');
    }
  }
}

/** Topic id to preselect for a Sunday, if its lesson has a Lord's Day and the topic exists. */
export function getSuggestedTopicId(status: SchoolWeekStatus, topicIds: Iterable<string>): string | null {
  if (status.mode !== 'lesson' || !status.entry.lordsDay) return null;
  if (!HEIDELBERG_LORDS_DAYS.some((item) => item.lordsDay === status.entry.lordsDay)) return null;
  const id = heidelbergTopicId(status.entry.lordsDay);
  return new Set(topicIds).has(id) ? id : null;
}
