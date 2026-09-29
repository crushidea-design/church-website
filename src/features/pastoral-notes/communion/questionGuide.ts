// Conversation guide for communion care (plan section 10). A pastoral draft,
// not a confessional text: the church's pastoral lead reviews the wording
// before real use. Nothing here is a pass/fail check of faith or repentance.
export const GUIDE_VERSION = 'draft-2026-09';

// Where each prompt comes from. The prompts are pastoral drafts written from
// these texts, not translations of them; the summaries are paraphrases.
export type GuideSource = { label: string; summary: string; url: string };

const WSC = 'https://opc.org/sc.html';
const WLC = 'https://opc.org/lc.html';
const WCF = 'https://opc.org/wcf.html';
const HC = 'https://canrc.org/heidelberg-catechism';
const URCNA_FORM = 'https://www.urcna.org/liturgical-forms-celebration-of-the-lords-supper-form-1';
const URCNA_ORDER = 'https://www.urcna.org/church-order';

export type GuideTopic = { key: string; title: string; prompt: string; hint: string; sources: GuideSource[] };

export const GUIDE_TOPICS: GuideTopic[] = [
  {
    key: 'gospel',
    title: '복음과 그리스도',
    prompt: '하나님 앞에 나아갈 때 무엇을 의지하고 계십니까?',
    hint: '이해한 복음, 함께 확인한 약속의 말씀',
    sources: [
      { label: '소요리문답 86문', summary: '믿음은 구원을 위해 그리스도만을 받아들이고 의지하는 것이다.', url: WSC },
      { label: '소요리문답 97문', summary: '성찬에 합당하게 나아가려면 주의 몸을 분별하는 지식과 그리스도를 먹고 사는 믿음을 살핀다.', url: WSC },
      { label: '하이델베르크 81문', summary: '성찬에 나아올 사람은 그리스도의 고난과 죽음으로 죄가 용서되었음을 신뢰하는 사람이다.', url: HC },
    ],
  },
  {
    key: 'repentance',
    title: '회개와 새 순종',
    prompt: '주님 앞에서 돌이키고 싶은 일과 도움이 필요한 일이 있습니까?',
    hint: '자발적으로 나눈 내용, 구체적인 권면',
    sources: [
      { label: '소요리문답 87문', summary: '생명에 이르는 회개는 죄에서 하나님께로 돌이켜 새 순종을 힘쓰는 것이다.', url: WSC },
      { label: '소요리문답 97문', summary: '자기 성찰의 항목으로 회개와 사랑과 새 순종을 든다.', url: WSC },
      { label: '하이델베르크 81문', summary: '죄를 슬퍼하고, 믿음이 굳세어지며 삶이 새로워지기를 바라는 사람을 성찬에 부른다.', url: HC },
    ],
  },
  {
    key: 'assurance',
    title: '연약함과 확신',
    prompt: '성찬에 나아가는 일을 두렵게 하거나 주저하게 하는 것이 있습니까?',
    hint: '낙심의 맥락과 복음의 위로',
    sources: [
      { label: '대요리문답 172문', summary: '그리스도 안에 있는지 의심하는 사람도 그 부족을 슬퍼하며 바란다면 성찬에 나아와 더 굳세어질 수 있다.', url: WLC },
      { label: 'URCNA 성찬 예식문 1', summary: '우리가 완전해서가 아니라 그리스도 안에서 생명을 구하기에 나아온다는 위로를 전한다.', url: URCNA_FORM },
    ],
  },
  {
    key: 'word',
    title: '말씀과 예배',
    prompt: '공예배와 말씀을 듣는 생활에 어떤 유익이나 어려움이 있습니까?',
    hint: '실제 장애물과 교회의 돌봄 필요',
    sources: [
      { label: '소요리문답 88–90문', summary: '말씀·성례·기도가 은혜의 방편이며, 말씀은 부지런함과 준비와 기도로 받을 때 효력이 있다.', url: WSC },
    ],
  },
  {
    key: 'love',
    title: '사랑과 화목',
    prompt: '교회나 이웃과의 관계에서 함께 기도하고 도울 일이 있습니까?',
    hint: '안전하게 다룰 관계 문제와 다음 행동',
    sources: [
      { label: '소요리문답 97문', summary: '성찬 전 자기 성찰의 항목에 사랑을 둔다.', url: WSC },
      { label: '대요리문답 171문', summary: '성찬 준비로 하나님과 형제에 대한 사랑, 모든 사람에 대한 자비, 잘못한 이를 용서함을 살핀다.', url: WLC },
    ],
  },
  {
    key: 'household',
    title: '가정과 교육',
    prompt: '가정에서 말씀과 기도를 나누는 데 어떤 도움이 필요합니까?',
    hint: '가정의 형편과 교육 지원',
    sources: [
      { label: '신앙고백 25.2, 28.4', summary: '가시적 교회에는 신자의 자녀가 속하며, 믿는 부모의 자녀는 세례를 받는다.', url: WCF },
      { label: 'URCNA 교회정치 14조', summary: '장로의 직무에 가정심방과 교리교육을 둔다.', url: URCNA_ORDER },
    ],
  },
  {
    key: 'suffering',
    title: '기도와 고난',
    prompt: '지금 함께 기도하며 곁에 있어야 할 어려움은 무엇입니까?',
    hint: '기도 제목과 실제 지원',
    sources: [
      { label: '소요리문답 88문', summary: '기도는 은혜의 방편의 하나다.', url: WSC },
      { label: '소요리문답 98문', summary: '기도는 우리의 소원을 그리스도의 이름으로 하나님께 아뢰는 것이다.', url: WSC },
    ],
  },
  {
    key: 'after',
    title: '성찬 후의 생활',
    prompt: '성찬을 통해 받은 위로와 계속 붙들고 싶은 말씀은 무엇입니까?',
    hint: '감사와 지속적인 돌봄',
    sources: [
      { label: '대요리문답 175문', summary: '성찬 후에는 어떻게 참여했는지 돌아보고, 받은 위로에 감사하며 그 지속을 구하고 다시 넘어지지 않도록 깨어 있는다.', url: WLC },
    ],
  },
];

export const GUIDE_SOURCE_NOTE = '질문은 아래 문서를 바탕으로 쓴 목양 대화 초안이며, 요약은 원문의 번역이 아닌 풀어쓴 설명입니다.';

/** Scope of the conversation only — never whether faith or repentance "passed". */
export type TopicCoverage = '' | 'covered' | 'deferred' | 'not_applicable';

export const COVERAGE_LABELS: Record<Exclude<TopicCoverage, ''>, string> = {
  covered: '이번 대화에서 다룸',
  deferred: '다음 대화로 남김',
  not_applicable: '이번 대화에서 해당 없음',
};

export type TopicEntry = { coverage: TopicCoverage; note: string };

export type ConversationDraft = {
  date: string;
  topics: Record<string, TopicEntry>;
  counsel: string;
  prayerTopics: string;
  nextSteps: string;
  publicSummary: string;
};

// A pastoral safety principle of this app (plan section 10), not a confessional text.
export const SAFETY_NOTICE =
  '화목을 권할 때도 피해를 입은 분에게 바로 만나 화해하라고 요구하지 않습니다. 폭력·학대처럼 안전이 걸린 일은 관계 회복과 따로 다루고, 필요하면 관련 기관이나 전문 상담으로 연결합니다.';

export function emptyConversationDraft(date: string): ConversationDraft {
  return {
    date,
    topics: Object.fromEntries(GUIDE_TOPICS.map((topic) => [topic.key, { coverage: '', note: '' }])),
    counsel: '',
    prayerTopics: '',
    nextSteps: '',
    publicSummary: '',
  };
}

/**
 * Builds the encrypted body's `innerNote` as plain structured text. Visitation
 * logs keep their four-field body so the existing editor can open and save
 * this record without dropping anything. Untouched topics are left out rather
 * than filled in.
 */
export function composeConversationNote(draft: ConversationDraft) {
  const sections = GUIDE_TOPICS.flatMap((topic) => {
    const entry = draft.topics[topic.key];
    const note = entry?.note.trim() || '';
    if (!entry?.coverage && !note) return [];
    const heading = `[${topic.title}]${entry.coverage ? ` ${COVERAGE_LABELS[entry.coverage]}` : ''}`;
    return [note ? `${heading}\n${note}` : heading];
  });
  const counsel = draft.counsel.trim();
  if (counsel) sections.push(`[전한 말씀과 권면]\n${counsel}`);
  return sections.join('\n\n');
}

export function isConversationDraftEmpty(draft: ConversationDraft) {
  return !composeConversationNote(draft) && !draft.prayerTopics.trim() && !draft.nextSteps.trim() && !draft.publicSummary.trim();
}
