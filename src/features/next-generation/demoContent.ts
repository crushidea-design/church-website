export type NextGenerationDemoStepId =
  | 'signup'
  | 'children'
  | 'curriculum'
  | 'word-fruit'
  | 'family-worship'
  | 'qa-notifications';

export interface NextGenerationDemoStep {
  id: NextGenerationDemoStepId;
  title: string;
  shortTitle: string;
  description: string;
  mode: 'real' | 'guide';
}

export const DEMO_CURRICULUM_PATH = '/next/elementary?resource=elementary_workbook';
export const DEMO_CURRICULUM_FROM_DEMO_PATH = `${DEMO_CURRICULUM_PATH}&fromDemo=1&scrollTop=1`;
export const DEMO_PAGE_PATH = '/next/demo';
export const NEXT_GENERATION_HOME_PATH = '/next';
export const NEXT_GENERATION_PARENT_QR_PATH = '/next-generation-parent-qr.png';
export const DEMO_REAL_PAGE_LINKS = {
  myPage: '/next/me?fromDemo=1&scrollTop=1',
  curriculum: DEMO_CURRICULUM_FROM_DEMO_PATH,
  wordFruit: '/next/elementary?highlight=word-fruit&fromDemo=1&scrollTop=1',
  familyWorship: '/next/elementary?resource=family_worship&fromDemo=1&scrollTop=1',
  qa: '/next/elementary?highlight=qa&fromDemo=1&scrollTop=1',
};

export const NEXT_GENERATION_DEMO_STEPS: NextGenerationDemoStep[] = [
  {
    id: 'signup',
    title: '학부모로 가입하기',
    shortTitle: '가입',
    description: 'QR로 접속한 뒤 Google 또는 이메일로 가입하고, 역할에서 “학부모”를 선택합니다.',
    mode: 'real',
  },
  {
    id: 'children',
    title: '우리 아이 연결하기',
    shortTitle: '자녀 연결',
    description: '아이의 휴대폰 사용 여부에 따라 학생 계정을 연결하거나 부모 계정에서 직접 아이를 등록합니다.',
    mode: 'guide',
  },
  {
    id: 'curriculum',
    title: '이번 주 공과 확인하기',
    shortTitle: '공과',
    description: '주일 전후로 이번 주 말씀과 공과 자료를 열어 보고, 가정에서 나눌 내용을 준비합니다.',
    mode: 'real',
  },
  {
    id: 'word-fruit',
    title: '우리 아이 말씀열매 돕기',
    shortTitle: '말씀열매',
    description: '내 페이지에서 자녀별 말씀열매 진행을 보고, 부모님이 그날의 실천을 함께 확인할 수 있습니다.',
    mode: 'guide',
  },
  {
    id: 'family-worship',
    title: '가정예배로 이어가기',
    shortTitle: '가정예배',
    description: '가정예배 자료를 보고 나눔, 기도제목, 사진을 기록하며 공개 여부도 직접 선택합니다.',
    mode: 'guide',
  },
  {
    id: 'qa-notifications',
    title: '질문하고 알림 받기',
    shortTitle: '질문·알림',
    description: '신앙 질문을 공개 또는 비공개로 남기고, 새 자료와 답변 알림을 확인합니다.',
    mode: 'guide',
  },
];

export function getDemoPageUrl(origin?: string) {
  const cleanOrigin = origin?.replace(/\/$/, '') || 'https://builttogether.church';
  return `${cleanOrigin}${DEMO_PAGE_PATH}`;
}

export function getNextGenerationHomeUrl(origin?: string) {
  const cleanOrigin = origin?.replace(/\/$/, '') || 'https://builttogether.church';
  return `${cleanOrigin}${NEXT_GENERATION_HOME_PATH}`;
}

export function getGuideOnlyDemoStepIds() {
  return NEXT_GENERATION_DEMO_STEPS
    .filter((step) => step.mode === 'guide')
    .map((step) => step.id);
}
