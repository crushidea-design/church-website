import type { SchoolWeekStatus } from '../schedule';
import type { CurriculumEntry, SchoolTerm } from '../types';

export interface WeekHeroLink {
  label: string;
  to: string;
}

export interface WeekHeroModel {
  tone: 'lesson' | 'holiday' | 'vacation' | 'unscheduled' | 'off';
  title: string;
  subtitle: string;
  badges: string[];
  /** e.g. "토 1/9 개강 수련회" */
  eventLine?: string;
  links: WeekHeroLink[];
}

const KIND_LABELS: Partial<Record<CurriculumEntry['kind'], string>> = {
  opening: '개강',
  special: '특강',
  review: '복습',
  closing: '종강',
};

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const parseKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
};

const formatQuestions = (questions: [number, number]) =>
  questions[0] === questions[1] ? `${questions[0]}문` : `${questions[0]}~${questions[1]}문`;

const formatEvent = (event: CurriculumEntry) => {
  const { year, month, day } = parseKey(event.date);
  const dow = DAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${dow} ${month}/${day} ${event.note || event.title}`;
};

export function buildWeekHeroModel(
  status: SchoolWeekStatus,
  catalog: { terms: SchoolTerm[] },
  sundayKey: string,
): WeekHeroModel {
  switch (status.mode) {
    case 'lesson': {
      const { entry, term, events } = status;
      const badges: string[] = [term.name];
      if (entry.session) badges.push(`${entry.session}회`);
      if (entry.isCommunionSunday) badges.push('성찬 주일 · 2교시 단축');
      const kindLabel = KIND_LABELS[entry.kind];
      if (kindLabel) badges.push(kindLabel);

      const hasLordsDay = !!entry.lordsDay;
      const title = hasLordsDay
        ? `하이델베르크 제${entry.lordsDay}주일${entry.questions ? ` · ${formatQuestions(entry.questions)}` : ''}`
        : entry.title;
      const subtitle = hasLordsDay ? entry.title : entry.note || '';
      return {
        tone: 'lesson',
        title,
        subtitle,
        badges,
        eventLine: events.length > 0 ? events.map(formatEvent).join(' · ') : undefined,
        links: [],
      };
    }
    case 'holiday':
      return {
        tone: 'holiday',
        title: '이번 주일은 주일학교 수업이 없습니다',
        subtitle: `${status.entry.title}. 공예배는 부모님과 함께 드립니다.`,
        badges: [status.term.name],
        links: [],
      };
    case 'vacation':
      return {
        tone: 'vacation',
        title: `${status.term.name} ${status.weekIndex}주차 (${status.totalWeeks}주 중)`,
        subtitle: '공예배와 가정 신앙교육 집중 기간입니다.',
        badges: [],
        links: [
          { label: '이번 주 예배를 잇는 가정', to: '/next/school?resource=family_column#school-library' },
          { label: '이번 주 가정예배', to: '/next/school?resource=family_worship#school-library' },
        ],
      };
    case 'unscheduled':
      return {
        tone: 'unscheduled',
        title: status.term.name,
        subtitle: '이번 주 진도는 준비 중입니다.',
        badges: [],
        links: [],
      };
    case 'off': {
      const nextTerm = [...catalog.terms]
        .filter((term) => term.kind === 'term' && term.startDate > sundayKey)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
      if (nextTerm) {
        const { month, day } = parseKey(nextTerm.startDate);
        return {
          tone: 'off',
          title: `${nextTerm.name} 개강 ${month}월 ${day}일`,
          subtitle: '새 주일학교가 곧 시작합니다.',
          badges: [],
          links: [],
        };
      }
      return { tone: 'off', title: '학사 일정 준비 중', subtitle: '', badges: [], links: [] };
    }
  }
}
