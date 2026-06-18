export type NextGenerationDemoStepId =
  | 'signup'
  | 'bible-reading'
  | 'curriculum'
  | 'word-fruit'
  | 'qa'
  | 'family-worship';

export interface NextGenerationDemoStep {
  id: NextGenerationDemoStepId;
  title: string;
  shortTitle: string;
  description: string;
  mode: 'real' | 'demo';
}

export const DEMO_CURRICULUM_PATH = '/next/elementary?resource=elementary_workbook';
export const DEMO_CURRICULUM_FROM_DEMO_PATH = `${DEMO_CURRICULUM_PATH}&fromDemo=1`;
export const DEMO_PAGE_PATH = '/next/demo';
export const DEMO_BIBLE_READING_COMPLETED_BOOK_INDEXES = [0, 1, 17, 18, 35, 36, 48, 49, 64, 65];
export const DEMO_REAL_PAGE_LINKS = {
  bibleReading: '/next/me',
  curriculum: DEMO_CURRICULUM_FROM_DEMO_PATH,
  wordFruit: '/next/elementary?highlight=word-fruit',
  qa: '/next/elementary?highlight=qa',
  familyWorship: '/next/elementary?resource=family_worship&fromDemo=1',
};

export const NEXT_GENERATION_DEMO_STEPS: NextGenerationDemoStep[] = [
  {
    id: 'signup',
    title: 'QR로 접속하고 회원가입',
    shortTitle: '회원가입',
    description: '각자 휴대폰으로 접속해서 실제 다음세대 회원가입을 진행합니다.',
    mode: 'real',
  },
  {
    id: 'bible-reading',
    title: '말씀기록표 확인',
    shortTitle: '말씀기록표',
    description: '내 페이지에서 성경 읽기 기록표를 볼 수 있고, 기록은 목회자/관리자가 확인해 색칠합니다.',
    mode: 'demo',
  },
  {
    id: 'curriculum',
    title: '이번주 공과 보기',
    shortTitle: '공과',
    description: '실제 유초등부 공과 탭으로 이동해서 등록된 공과를 눌러 확인합니다.',
    mode: 'real',
  },
  {
    id: 'word-fruit',
    title: '말씀열매 맺기',
    shortTitle: '말씀열매',
    description: '말씀을 듣고 마음에 담는 과정을 열매가 자라는 장면으로 보여줍니다.',
    mode: 'demo',
  },
  {
    id: 'qa',
    title: '질문있습니다',
    shortTitle: '질문',
    description: '말씀과 신앙에 대한 질문을 남기고 선생님과 함께 답을 기다리는 흐름을 보여줍니다.',
    mode: 'demo',
  },
  {
    id: 'family-worship',
    title: '가정예배로 이어가기',
    shortTitle: '가정예배',
    description: '가정예배 자료, 나눔 기록, 인증샷 업로드 흐름을 안내합니다.',
    mode: 'demo',
  },
];

export function getDemoPageUrl(origin?: string) {
  const cleanOrigin = origin?.replace(/\/$/, '') || 'https://builttogether.church';
  return `${cleanOrigin}${DEMO_PAGE_PATH}`;
}

export function getLocalOnlyDemoStepIds() {
  return NEXT_GENERATION_DEMO_STEPS
    .filter((step) => step.mode === 'demo')
    .map((step) => step.id);
}
