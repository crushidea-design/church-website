// Static copy for the 2027 intro page. CMS editing comes later.
// No head counts, no names of people, no approval wording (public page).

export const INTRO_HERO = {
  eyebrow: '2027 주일학교',
  title: '함께 지어져 가는 언약의 자녀들',
  lead: '2027년부터 유초등부와 중고등부가 하나의 주일학교로 모입니다.',
};

export const INTRO_PRINCIPLES: Array<{ title: string; body: string; gallery?: IntroGalleryKey }> = [
  { title: '배움의 자리', gallery: 'curriculum', body: '주일학교는 아이들이 말씀과 교리를 차근차근 배우는 자리입니다.' },
  { title: '함께 드리는 예배', gallery: 'worship', body: '배운 것을 품고 온 가족이 함께 공예배에 나아가, 같은 말씀을 듣고 함께 고백합니다.' },
  { title: '가정과 함께', gallery: 'family', body: '자녀의 신앙은 가정에서 가장 먼저 자랍니다. 교회는 부모님 곁에서 그 걸음을 함께 돕겠습니다.' },
  { title: '자라게 하시는 하나님', body: '아이들을 심고, 자라게 하고, 세우고, 굳게 서게 하시는 분은 하나님이십니다.' },
];

export const INTRO_MOTTO = {
  heading: '표어 · 골로새서 2:6-7',
  verse:
    '그러므로 너희가 그리스도 예수를 주로 받았으니 그 안에서 행하되 그 안에 뿌리를 박으며 세움을 받아 교훈을 받은 대로 믿음에 굳게 서서 감사함을 넘치게 하라 (골 2:6-7)',
  command: '그 안에서 행하라',
  steps: [
    { classId: 'seed', name: '씨앗', phrase: '받았으니' },
    { classId: 'jaram', name: '자람', phrase: '뿌리를 박으며' },
    { classId: 'seum', name: '세움', phrase: '세움을 받아' },
    { classId: 'didim', name: '디딤', phrase: '굳게 서서' },
  ],
  result: '감사함을 넘치게',
  explanation: [
    '뿌리를 내리고, 세워지고, 굳게 서는 일은 모두 하나님께서 하십니다. 우리는 그 은혜 안에서 걸어가며 감사로 응답합니다.',
    '아이들은 자라면서 다음 반으로 올라갑니다.',
  ],
};

export const INTRO_SCHEDULE = [
  { time: '10:00', title: '1교시', detail: '시편 찬송 미리 부르기 · 기도' },
  { time: '10:05', title: '공통 강해', detail: '' },
  { time: '10:35', title: '반별 공과 확인', detail: '' },
  { time: '11:00', title: '공예배', detail: '부모와 함께' },
  { time: '12:25', title: '2교시', detail: '반별 식사와 나눔' },
  { time: '13:00', title: '반별 활동', detail: '' },
  { time: '13:20', title: '마침', detail: '' },
];

export const INTRO_TERMS = {
  summary: '학기 20주 · 방학 6주 (개편 첫해 2027년 1학기는 1월 개강으로 26주)',
  body: '방학에는 공예배와 가정에서의 신앙교육에 더 마음을 모읍니다. 학기 중에는 교회가 가르치고 가정이 이어 가며, 방학에는 가정이 가르치고 교회가 곁에서 돕습니다.',
};

export const INTRO_CURRICULUM = {
  title: '하이델베르크 요리문답',
  subtitle: '위로의 교리문답',
  firstQuestion: '제1문 "살아서나 죽어서나 당신의 유일한 위로는 무엇입니까?"',
  years: [
    { label: '1년차 (2027)', range: '제1~24주일 (1~64문)', topics: '위로 · 비참 · 중보자 · 사도신경 · 칭의' },
    { label: '2년차 (2028)', range: '제25~52주일 (65~129문)', topics: '성례 · 천국 열쇠 · 감사(회심 · 십계명 · 주기도문)' },
  ],
};

export type IntroGalleryKey = 'worship' | 'family' | 'curriculum';

export interface IntroGalleryImage {
  src: string;
  alt: string;
}

// Reuses the existing 2025-26 images; files stay where they are.
export const INTRO_LOOKBACK: Array<{ key: IntroGalleryKey; title: string; caption: string; gallery: IntroGalleryImage[] }> = [
  {
    key: 'worship',
    title: '설교노트',
    caption: '공예배 설교를 듣고 아이들이 직접 적은 설교노트입니다.',
    gallery: [
      { src: '/next-generation/pillars/worship/worship-note-kindergarten-1.jpg', alt: '유치부 설교노트 예시 1' },
      { src: '/next-generation/pillars/worship/worship-note-kindergarten-2.jpg', alt: '유치부 설교노트 예시 2' },
      { src: '/next-generation/pillars/worship/worship-note-kindergarten-3.jpg', alt: '유치부 설교노트 예시 3' },
      { src: '/next-generation/pillars/worship/worship-note-elementary-1.jpg', alt: '초등부 설교노트 예시 1' },
      { src: '/next-generation/pillars/worship/worship-note-elementary-2.jpg', alt: '초등부 설교노트 예시 2' },
    ],
  },
  {
    key: 'family',
    title: '예배를 잇는 가정 · 가정예배지',
    caption: '주일 말씀을 가정에서 이어 가도록 돕는 부모 안내지와, 온 가족이 함께 드리는 가정예배지입니다.',
    gallery: [
      { src: '/next-generation/pillars/family/family-worship-guide-1-1.jpg', alt: '예배를 잇는 가정 1호 예시 1' },
      { src: '/next-generation/pillars/family/family-worship-sheet-1.jpg', alt: '가정예배지 「예수님의 장례」(눅 23:50-56)' },
      { src: '/next-generation/pillars/family/family-worship-sheet-2.jpg', alt: '가정예배지 「부활하신 예수님」(눅 24:1-12)' },
      { src: '/next-generation/pillars/family/family-worship-sheet-3.jpg', alt: '가정예배지 「의심의 자리에서 증인의 자리로」(눅 24:36-49)' },
      { src: '/next-generation/pillars/family/family-worship-guide-1-2.jpg', alt: '예배를 잇는 가정 1호 예시 2' },
      { src: '/next-generation/pillars/family/family-worship-guide-2-1.jpg', alt: '예배를 잇는 가정 2호 예시 1' },
      { src: '/next-generation/pillars/family/family-worship-guide-2-2.jpg', alt: '예배를 잇는 가정 2호 예시 2' },
    ],
  },
  {
    key: 'curriculum',
    title: '공과',
    caption: '성경과 교리를 함께 배운 2025–26 공과 자료입니다.',
    gallery: [
      { src: '/next-generation/pillars/curriculum/curriculum-benefit-of-scripture-1.jpg', alt: '공과 성경의 유익 예시 1' },
      { src: '/next-generation/pillars/curriculum/curriculum-benefit-of-scripture-2.jpg', alt: '공과 성경의 유익 예시 2' },
      { src: '/next-generation/pillars/curriculum/curriculum-before-god-1.jpg', alt: '공과 하나님 앞에서 예시 1' },
      { src: '/next-generation/pillars/curriculum/curriculum-before-god-2.jpg', alt: '공과 하나님 앞에서 예시 2' },
      { src: '/next-generation/pillars/curriculum/curriculum-power-of-scripture-1.jpg', alt: '공과 성경의 능력 예시 1' },
      { src: '/next-generation/pillars/curriculum/curriculum-power-of-scripture-2.jpg', alt: '공과 성경의 능력 예시 2' },
    ],
  },
];
