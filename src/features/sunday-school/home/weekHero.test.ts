import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHOOL_CURRICULUM as curriculum, DEFAULT_SCHOOL_TERMS as terms } from '../seedData';
import { getSchoolWeekStatus } from '../schedule';
import { buildWeekHeroModel } from './weekHero';

const model = (sundayKey: string) =>
  buildWeekHeroModel(getSchoolWeekStatus({ terms, curriculum, sundayKey }), { terms }, sundayKey);

describe('buildWeekHeroModel', () => {
  it('builds a lesson with communion', () => {
    const m = model('2027-02-28');
    expect(m.tone).toBe('lesson');
    expect(m.title).toBe('하이델베르크 제6주일 · 16~17문');
    expect(m.subtitle).toBe('참 사람이시며 참 하나님이신 중보자');
    expect(m.badges).toEqual(['2027 1학기', '7회', '성찬 주일 · 2교시 단축']);
    expect(m.eventLine).toBeUndefined();
  });

  it('adds the Saturday retreat event line', () => {
    const m = model('2027-01-10');
    expect(m.title).toBe('하이델베르크 제1주일 · 1문');
    expect(m.eventLine).toBe('토 1/9 개강 수련회');
    expect(m.badges).toContain('1회');
  });

  it('labels the opening Sunday', () => {
    const m = model('2027-01-03');
    expect(m.badges).toContain('개강');
    expect(m.title).toContain('개강 주일');
  });

  it('labels special lessons', () => {
    const m = model('2027-03-28');
    expect(m.title).toBe('하이델베르크 제17주일 · 45문');
    expect(m.badges).toContain('특강');
  });

  it('handles holidays', () => {
    const m = model('2027-02-07');
    expect(m.tone).toBe('holiday');
    expect(m.title).toBe('이번 주일은 주일학교 수업이 없습니다');
    expect(m.subtitle).toBe('설 연휴 휴강. 공예배는 부모님과 함께 드립니다.');
  });

  it('handles vacation weeks with family links', () => {
    const m = model('2027-07-18');
    expect(m.tone).toBe('vacation');
    expect(m.title).toBe('2027 여름방학 3주차 (6주 중)');
    expect(m.subtitle).toBe('공예배와 가정 신앙교육 집중 기간입니다.');
    expect(m.links.map((l) => l.to)).toEqual([
      '/next/school?resource=family_column#school-library',
      '/next/school?resource=family_worship#school-library',
    ]);
  });

  it('handles a term without a schedule', () => {
    const m = model('2027-08-22');
    expect(m.tone).toBe('unscheduled');
    expect(m.title).toBe('2027 2학기');
    expect(m.subtitle).toBe('이번 주 진도는 준비 중입니다.');
  });

  it('announces the next term before the school year starts', () => {
    const m = model('2026-11-15');
    expect(m.tone).toBe('off');
    expect(m.title).toBe('2027 1학기 개강 1월 3일');
    expect(m.subtitle).toBe('새 주일학교가 곧 시작합니다.');
  });

  it('falls back when no later term exists', () => {
    const m = buildWeekHeroModel({ mode: 'off' }, { terms }, '2030-01-06');
    expect(m.title).toBe('학사 일정 준비 중');
  });
});
