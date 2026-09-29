// Conversation guide for communion care (plan section 10). A pastoral draft,
// not a confessional text: the church's pastoral lead reviews the wording
// before real use. Nothing here is a pass/fail check of faith or repentance.
export const GUIDE_VERSION = 'draft-2026-09';

export type GuideTopic = { key: string; title: string; prompt: string; hint: string };

export const GUIDE_TOPICS: GuideTopic[] = [
  { key: 'gospel', title: '복음과 그리스도', prompt: '하나님 앞에 나아갈 때 무엇을 의지하고 계십니까?', hint: '이해한 복음, 함께 확인한 약속의 말씀' },
  { key: 'repentance', title: '회개와 새 순종', prompt: '주님 앞에서 돌이키고 싶은 일과 도움이 필요한 일이 있습니까?', hint: '자발적으로 나눈 내용, 구체적인 권면' },
  { key: 'assurance', title: '연약함과 확신', prompt: '성찬에 나아가는 일을 두렵게 하거나 주저하게 하는 것이 있습니까?', hint: '낙심의 맥락과 복음의 위로' },
  { key: 'word', title: '말씀과 예배', prompt: '공예배와 말씀을 듣는 생활에 어떤 유익이나 어려움이 있습니까?', hint: '실제 장애물과 교회의 돌봄 필요' },
  { key: 'love', title: '사랑과 화목', prompt: '교회나 이웃과의 관계에서 함께 기도하고 도울 일이 있습니까?', hint: '안전하게 다룰 관계 문제와 다음 행동' },
  { key: 'household', title: '가정과 교육', prompt: '가정에서 말씀과 기도를 나누는 데 어떤 도움이 필요합니까?', hint: '가정의 형편과 교육 지원' },
  { key: 'suffering', title: '기도와 고난', prompt: '지금 함께 기도하며 곁에 있어야 할 어려움은 무엇입니까?', hint: '기도 제목과 실제 지원' },
  { key: 'after', title: '성찬 후의 생활', prompt: '성찬을 통해 받은 위로와 계속 붙들고 싶은 말씀은 무엇입니까?', hint: '감사와 지속적인 돌봄' },
];

/** Scope of the conversation only — never whether faith or repentance "passed". */
export type TopicCoverage = '' | 'covered' | 'deferred' | 'not_applicable';

export const COVERAGE_LABELS: Record<Exclude<TopicCoverage, ''>, string> = {
  covered: '다룸',
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

export const SAFETY_NOTICE =
  '화목에 관한 대화로 피해자에게 즉시 대면을 요구하지 않습니다. 안전 문제가 있으면 일반 관계 회복과 별도로 다루고, 필요한 경우 관계 기관과 전문 상담 절차를 따릅니다.';

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
