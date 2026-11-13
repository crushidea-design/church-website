// Static copy for the 2027 intro page. CMS editing comes later.
// No head counts, no names of people, no approval wording (public page).

export const INTRO_HERO = {
  eyebrow: '2027 주일학교',
  title: '함께 지어져 가는 언약의 자녀들',
  lead: '2027년부터 유초등부와 중고등부가 하나의 주일학교로 모입니다.',
};

export const INTRO_PRINCIPLES = [
  { title: '교육의 장', body: '주일학교는 개별 예배가 아닌 교육의 자리이며, 공예배를 대신하지 않습니다.' },
  { title: '공예배 중심', body: '아이들이 공예배에서 말씀을 듣고 고백하도록 준비시키는 자리입니다.' },
  { title: '부모의 일차 책임', body: '자녀 신앙교육의 일차 책임은 부모에게 있으며, 교회는 가정을 돕습니다.' },
  { title: '은혜의 원리', body: '아이들을 심고, 자라게 하고, 세우고, 굳게 서게 하시는 분은 하나님이십니다.' },
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
    "본동사는 '행하라' 하나입니다. 뿌리 박음·세움·굳게 섬은 하나님이 하시는 일(수동)이며, 감사는 그 은혜에 대한 응답입니다.",
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
  body: '방학은 쉬는 기간이 아니라 공예배와 가정 신앙교육에 집중하는 기간입니다. 학기 중에는 교회가 가르치고 가정이 잇고, 방학 중에는 가정이 가르치고 교회가 돕습니다.',
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

export interface IntroGalleryImage {
  src: string;
  alt: string;
}

// Reuses the existing 2025-26 images; files stay where they are.
export const INTRO_LOOKBACK: Array<{ title: string; caption: string; gallery: IntroGalleryImage[] }> = [
  {
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
    title: '예배를 잇는 가정',
    caption: '주일 말씀을 가정에서 이어 가도록 돕는 부모 안내지입니다.',
    gallery: [
      { src: '/next-generation/pillars/family/family-worship-guide-1-1.jpg', alt: '예배를 잇는 가정 1호 예시 1' },
      { src: '/next-generation/pillars/family/family-worship-guide-1-2.jpg', alt: '예배를 잇는 가정 1호 예시 2' },
      { src: '/next-generation/pillars/family/family-worship-guide-2-1.jpg', alt: '예배를 잇는 가정 2호 예시 1' },
      { src: '/next-generation/pillars/family/family-worship-guide-2-2.jpg', alt: '예배를 잇는 가정 2호 예시 2' },
    ],
  },
  {
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
