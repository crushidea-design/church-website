import { getSundayDate, toLocalDateKey } from '../../lib/nextGenerationResources';
import type { CurriculumEntry, SchoolClass, SchoolTerm } from './types';

export const DEFAULT_SCHOOL_TERMS: SchoolTerm[] = [
  { id: '2027-1', kind: 'term', name: '2027 1학기', startDate: '2027-01-03', endDate: '2027-06-27', order: 1 },
  { id: '2027-summer', kind: 'vacation', name: '2027 여름방학', startDate: '2027-07-04', endDate: '2027-08-08', order: 2 },
  { id: '2027-2', kind: 'term', name: '2027 2학기', startDate: '2027-08-15', endDate: '2027-12-26', order: 3 },
  { id: '2027-winter', kind: 'vacation', name: '2027 겨울방학', startDate: '2028-01-02', endDate: '2028-02-06', order: 4 },
  { id: '2028-1', kind: 'term', name: '2028 1학기', startDate: '2028-02-13', endDate: '2028-06-25', order: 5 },
  { id: '2028-summer', kind: 'vacation', name: '2028 여름방학', startDate: '2028-07-02', endDate: '2028-08-06', order: 6 },
  { id: '2028-2', kind: 'term', name: '2028 2학기', startDate: '2028-08-13', endDate: '2028-12-24', order: 7 },
];

type Row = Omit<CurriculumEntry, 'id' | 'sundayKey' | 'termId'>;

const sundayKeyOf = (date: string) => toLocalDateKey(getSundayDate(new Date(`${date}T12:00:00`)));

const FIRST_TERM_ROWS: Row[] = [
  { date: '2027-01-03', kind: 'opening', title: '개강 주일: 표어 골 2:6-7, 새 주일학교 소개', note: '신년주일' },
  { date: '2027-01-09', kind: 'retreat', lordsDay: 1, questions: [1, 1], title: '살아서나 죽어서나 유일한 위로', note: '개강 수련회' },
  { date: '2027-01-10', kind: 'class', session: 1, lordsDay: 1, questions: [1, 1], title: '유일한 위로 정리', note: '수련회 마무리, 공예배로' },
  { date: '2027-01-17', kind: 'class', session: 2, lordsDay: 1, questions: [2, 2], title: '알아야 할 세 가지: 비참 · 구원 · 감사', note: '전체 구조' },
  { date: '2027-01-24', kind: 'class', session: 3, lordsDay: 2, questions: [3, 5], title: '율법으로 아는 나의 비참', note: '제1부 비참' },
  { date: '2027-01-31', kind: 'class', session: 4, lordsDay: 3, questions: [6, 8], title: '사람의 창조와 타락, 부패' },
  { date: '2027-02-07', kind: 'holiday', title: '설 연휴 휴강', note: '휴강' },
  { date: '2027-02-14', kind: 'class', session: 5, lordsDay: 4, questions: [9, 11], title: '하나님의 공의와 자비' },
  { date: '2027-02-21', kind: 'class', session: 6, lordsDay: 5, questions: [12, 15], title: '우리에게 필요한 중보자', note: '제2부 구원' },
  { date: '2027-02-28', kind: 'class', session: 7, lordsDay: 6, questions: [16, 17], title: '참 사람이시며 참 하나님이신 중보자', note: '성찬 주일', isCommunionSunday: true },
  { date: '2027-03-07', kind: 'class', session: 8, lordsDay: 6, questions: [18, 19], title: '그 중보자는 예수 그리스도, 복음으로 앎' },
  { date: '2027-03-14', kind: 'class', session: 9, lordsDay: 7, questions: [20, 21], title: '참 믿음이란 무엇인가' },
  { date: '2027-03-21', kind: 'class', session: 10, lordsDay: 7, questions: [22, 23], title: '믿어야 할 것: 사도신경', note: '종려주일' },
  { date: '2027-03-28', kind: 'special', session: 11, lordsDay: 17, questions: [45, 45], title: '그리스도의 부활이 주는 유익', note: '부활절 특강' },
  { date: '2027-04-04', kind: 'class', session: 12, lordsDay: 8, questions: [24, 25], title: '사도신경의 구조와 삼위일체' },
  { date: '2027-04-11', kind: 'class', session: 13, lordsDay: 9, questions: [26, 26], title: '창조주 아버지 하나님' },
  { date: '2027-04-18', kind: 'class', session: 14, lordsDay: 10, questions: [27, 27], title: '하나님의 섭리' },
  { date: '2027-04-25', kind: 'class', session: 15, lordsDay: 10, questions: [28, 28], title: '섭리를 아는 유익: 인내 · 감사 · 신뢰', note: '성찬 주일', isCommunionSunday: true },
  { date: '2027-05-02', kind: 'class', session: 16, lordsDay: 11, questions: [29, 30], title: '예수, 유일한 구주', note: '어린이주일' },
  { date: '2027-05-09', kind: 'class', session: 17, lordsDay: 12, questions: [31, 31], title: '그리스도: 선지자 · 제사장 · 왕', note: '어버이주일' },
  { date: '2027-05-16', kind: 'holiday', title: '전교인 야유회 휴강', note: '휴강 (날짜 확정 시 이동)' },
  { date: '2027-05-23', kind: 'class', session: 18, lordsDay: 12, questions: [32, 32], title: '나는 왜 그리스도인이라 불리는가' },
  { date: '2027-05-30', kind: 'class', session: 19, lordsDay: 13, questions: [33, 33], title: '하나님의 독생자' },
  { date: '2027-06-06', kind: 'class', session: 20, lordsDay: 13, questions: [34, 34], title: '우리 주' },
  { date: '2027-06-13', kind: 'class', session: 21, lordsDay: 14, questions: [35, 36], title: '성령으로 잉태, 동정녀 탄생과 그 유익' },
  { date: '2027-06-20', kind: 'review', session: 22, questions: [1, 36], title: '1학기 총복습' },
  { date: '2027-06-27', kind: 'closing', session: 23, title: '종강: 암송 확인, 감사 나눔, 방학 안내', note: '전반기 감사주일 · 성찬 주일', isCommunionSunday: true },
];

export const DEFAULT_SCHOOL_CURRICULUM: CurriculumEntry[] = FIRST_TERM_ROWS.map((row) => ({
  ...row,
  id: row.date,
  sundayKey: sundayKeyOf(row.date),
  termId: '2027-1',
}));

// No head counts or member composition on purpose (public data).
export const DEFAULT_SCHOOL_CLASSES: SchoolClass[] = [
  { id: 'seed', name: '씨앗반', ageRule: '영아 (4세 이하)', verseRef: '골 2:6', verseText: '그리스도 예수를 주로 받았으니', emphasis: '그리스도를 받음', room: '1층 자모실', mode: 'parent', order: 1, isVisible: true },
  { id: 'jaram', name: '자람반', ageRule: '유치(5~7세) ~ 초등생', verseRef: '골 2:7', verseText: '그 안에 뿌리를 박으며', emphasis: '뿌리 내림', room: '1층 자모실', mode: 'class', order: 2, isVisible: true },
  { id: 'seum', name: '세움반', ageRule: '중학생', verseRef: '골 2:7', verseText: '세움을 받아', emphasis: '세움 받음', room: '2층 중고등부실', mode: 'class', order: 3, isVisible: true },
  { id: 'didim', name: '디딤반', ageRule: '고등학생', verseRef: '골 2:7', verseText: '믿음에 굳게 서서', emphasis: '굳게 섬', room: '2층 중고등부실', mode: 'class', order: 4, isVisible: true },
];
