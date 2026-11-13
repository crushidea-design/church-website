export type NextGenerationTutorialDepartment = 'elementary' | 'young-adults' | 'school';

export type NextGenerationTutorialStepId =
  | 'overview'
  | 'materials'
  | 'word'
  | 'wordFruit'
  | 'schoolWeek'
  | 'schoolClasses'
  | 'libraryTabs'
  | 'profileReading'
  | 'qa'
  | 'notifications';

export interface NextGenerationTutorialStep {
  id: NextGenerationTutorialStepId;
  title: string;
  eyebrow: string;
  body: string;
  action: string;
  route: string;
  target: string;
}

export const NEXT_GENERATION_TUTORIAL_STORAGE_KEY = 'next_generation_tutorial_seen_v1';

export function shouldAutoOpenNextGenerationTutorial(storage: Pick<Storage, 'getItem'> | null | undefined) {
  if (!storage) return false;
  return storage.getItem(NEXT_GENERATION_TUTORIAL_STORAGE_KEY) !== 'true';
}

export function markNextGenerationTutorialSeen(storage: Pick<Storage, 'setItem'> | null | undefined) {
  if (!storage) return;
  storage.setItem(NEXT_GENERATION_TUTORIAL_STORAGE_KEY, 'true');
}

const commonOverview: NextGenerationTutorialStep = {
  id: 'overview',
  eyebrow: '처음 이용 안내',
  title: '다음세대 전용 공간',
  body: '예배 자료, 질문, 알림을 한곳에서 이어 가는 다음세대 전용 앱입니다.',
  action: '먼저 내 부서에 맞는 자료와 안내를 둘러보세요.',
  route: '/next',
  target: '[data-next-tour="app-home"]',
};

const commonNotifications: NextGenerationTutorialStep = {
  id: 'notifications',
  eyebrow: '알림',
  title: '새 안내 놓치지 않기',
  body: '벨 아이콘에서 다음세대 알림을 확인하고, 새 자료나 답변 알림을 받을 수 있습니다.',
  action: '필요할 때 벨 아이콘과 이용 안내를 다시 확인하세요.',
  route: '/next',
  target: '[data-next-tour="guide-actions"]',
};

const elementarySteps: NextGenerationTutorialStep[] = [
  commonOverview,
  {
    id: 'materials',
    eyebrow: '유초등부 자료',
    title: '이번 주 자료 확인',
    body: '강의 원고, 공과, 공과 가이드, 가정 안내를 주간 흐름에 맞춰 확인합니다.',
    action: '자료 탭에서 이번 주일 자료를 열어 보세요.',
    route: '/next/elementary',
    target: '[data-next-tour="resource-tabs"]',
  },
  {
    id: 'wordFruit',
    eyebrow: '유초등부 말씀 실천',
    title: '이번 주 말씀 열매',
    body: '아이들이 배운 말씀을 한 주 동안 기억하고 실천하도록 말씀 열매 흐름을 확인합니다.',
    action: '말씀 열매 영역에서 이번 주 내용을 확인해 보세요.',
    route: '/next/elementary?highlight=word-fruit',
    target: '[data-next-tour="word-fruit"]',
  },
  {
    id: 'profileReading',
    eyebrow: '개별 프로필',
    title: '성경 읽기 기록표 확인',
    body: '유초등부 학생은 로그인 후 개인 프로필에서 성경 읽기 기록표를 확인할 수 있습니다.',
    action: '상단의 로그인 또는 내 프로필 버튼을 눌러 개인 기록으로 들어갑니다.',
    route: '/next',
    target: '[data-next-tour="profile-entry"]',
  },
  {
    id: 'qa',
    eyebrow: '신앙 대화',
    title: '질문하고 답변 확인',
    body: '아이들이 남긴 질문과 교사의 답변을 통해 예배 후 대화를 계속 이어 갑니다.',
    action: '궁금한 점은 Q&A에 남기고 답변을 확인하세요.',
    route: '/next/elementary?highlight=qa',
    target: '[data-next-tour="qa"]',
  },
  commonNotifications,
];

const youngAdultSteps: NextGenerationTutorialStep[] = [
  commonOverview,
  {
    id: 'materials',
    eyebrow: '청년부 자료',
    title: '강의와 복습 자료 확인',
    body: '천로역정 강의, 팟캐스트 복습, 수련회 자료를 한곳에서 확인합니다.',
    action: '자료 탭에서 필요한 청년부 자료를 열어 보세요.',
    route: '/next/young-adults',
    target: '[data-next-tour="resource-tabs"]',
  },
  {
    id: 'word',
    eyebrow: '청년부 말씀 흐름',
    title: '오늘의 말씀과 성경읽기',
    body: '청년부는 오늘의 말씀과 성경읽기 흐름을 통해 매일 말씀 묵상을 이어 갈 수 있습니다.',
    action: '오늘의 말씀 영역에서 본문과 묵상 흐름을 확인해 보세요.',
    route: '/next/young-adults?highlight=today',
    target: '[data-next-tour="today-word"]',
  },
  {
    id: 'qa',
    eyebrow: '신앙 대화',
    title: '질문하고 답변 확인',
    body: '강의와 말씀을 들으며 생긴 질문을 남기고 답변을 확인합니다.',
    action: 'Q&A 영역에서 질문을 남기거나 답변을 확인하세요.',
    route: '/next/young-adults?highlight=qa',
    target: '[data-next-tour="qa"]',
  },
  commonNotifications,
];

const SCHOOL_ROUTE = '/next/school';

const schoolSteps: NextGenerationTutorialStep[] = [
  {
    id: 'overview',
    eyebrow: '처음 이용 안내',
    title: '2027 주일학교',
    body: '유초등부와 중고등부가 하나의 주일학교로 모여 하이델베르크 요리문답을 함께 배웁니다. 이번 주 자료와 반별 공과, 알림을 한곳에서 확인할 수 있습니다.',
    action: '먼저 주일학교 첫 화면을 둘러보세요.',
    route: SCHOOL_ROUTE,
    target: '[data-next-tour="app-home"]',
  },
  {
    id: 'schoolWeek',
    eyebrow: '이번 주 자료',
    title: '이번 주 자료 확인',
    body: '이번 주일에 배우는 강의 원고와 공과 가이드, 가정에서 함께할 자료를 한곳에 모아 보여 드립니다.',
    action: '이번 주 자료에서 필요한 자료를 열어 보세요.',
    route: SCHOOL_ROUTE,
    target: '[data-next-tour="school-week"]',
  },
  {
    id: 'schoolClasses',
    eyebrow: '반별 공과',
    title: '우리 아이 반 고르기',
    body: '씨앗·자람·세움·디딤 중 우리 아이 반을 고르면 그 반 공과가 보입니다.',
    action: '반 이름을 눌러 해당 반의 안내와 공과를 확인하세요.',
    route: SCHOOL_ROUTE,
    target: '[data-next-tour="school-classes"]',
  },
  {
    id: 'libraryTabs',
    eyebrow: '자료실',
    title: '지난 자료까지 찾아보기',
    body: '자료 탭에서 강의 원고, 공과, 공과 가이드, 예배를 잇는 가정 자료를 종류별로 찾아볼 수 있습니다. 지난 자료도 보관되어 있습니다.',
    action: '자료 탭을 눌러 필요한 자료를 열어 보세요.',
    route: SCHOOL_ROUTE,
    target: '[data-next-tour="resource-tabs"]',
  },
  {
    id: 'profileReading',
    eyebrow: '개별 프로필',
    title: '내 프로필과 로그인',
    body: '로그인하면 더 많은 자료를 볼 수 있고, 개인 프로필에서 성경 읽기 기록표를 확인할 수 있습니다.',
    action: '상단의 로그인 또는 내 프로필 버튼을 눌러 들어갑니다.',
    route: SCHOOL_ROUTE,
    target: '[data-next-tour="profile-entry"]',
  },
  {
    id: 'qa',
    eyebrow: '신앙 대화',
    title: '질문하고 답변 확인',
    body: '궁금한 점을 질문으로 남기면 교사의 답변을 확인할 수 있습니다.',
    action: '질문 있습니다 영역에서 질문을 남기거나 답변을 확인하세요.',
    route: `${SCHOOL_ROUTE}?highlight=qa`,
    target: '[data-next-tour="qa"]',
  },
  { ...commonNotifications, route: SCHOOL_ROUTE },
];

export function getNextGenerationTutorialSteps(department: NextGenerationTutorialDepartment) {
  if (department === 'school') return schoolSteps;
  return department === 'elementary' ? elementarySteps : youngAdultSteps;
}
