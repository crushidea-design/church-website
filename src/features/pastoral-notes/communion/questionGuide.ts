// Conversation guide for communion care (plan section 10). A pastoral draft,
// not a confessional text: the church's pastoral lead reviews the wording
// before real use. Nothing here is a pass/fail check of faith or repentance.
export const GUIDE_VERSION = 'draft-2026-09';

// Where each prompt comes from. The prompts are pastoral drafts written from
// these texts, not translations of them; the summaries are paraphrases.
// Order of authority: Scripture first, then the confession and catechisms,
// then the church's own denominational constitution. Scripture and
// constitution entries carry no link; Scripture summaries paraphrase 개역개정.
export type ChurchPolity = 'hapdong' | 'kosin';
export type GuideSource = { label: string; summary: string; url?: string; polity?: ChurchPolity; scripture?: boolean };

/** The denomination whose constitution is cited. This church is 합동; a 고신 church changes only this. */
export const CHURCH_POLITY: ChurchPolity = 'hapdong';

const WSC = 'https://opc.org/sc.html';
const WLC = 'https://opc.org/lc.html';
const WCF = 'https://opc.org/wcf.html';
const HC = 'https://canrc.org/heidelberg-catechism';

export type GuideTopic = { key: string; title: string; prompt: string; hint: string; sources: GuideSource[] };

/** Why elders and pastors hold these conversations at all (visitation duties). */
export const GUIDE_GENERAL_SOURCES: GuideSource[] = [
  { label: '베드로전서 5:2', summary: '너희 중에 있는 하나님의 양 무리를 억지로가 아니라 자원함으로 치라.', scripture: true },
  { label: '합동 헌법 정치 제5장 제4조', summary: '장로는 교우를 심방하여 위로하고 가르치며, 교인의 신앙을 살피고 위하여 기도한다.', polity: 'hapdong' },
  { label: '고신 헌법 정치 제66조', summary: '장로는 교회의 영적 상태를 살피고, 교인을 심방·위로·교훈하며 권면한다.', polity: 'kosin' },
  { label: '고신 헌법 정치 제41조', summary: '목사의 직무에 교인을 심방하는 일이 있다.', polity: 'kosin' },
];

export const GUIDE_TOPICS: GuideTopic[] = [
  {
    key: 'gospel',
    title: '복음과 그리스도',
    prompt: '하나님 앞에 나아갈 때 무엇을 의지하고 계십니까?',
    hint: '이해한 복음, 함께 확인한 약속의 말씀',
    sources: [
      { label: '요한복음 6:35', summary: '예수께서 자신을 생명의 떡이라 하시며, 그에게 오고 그를 믿는 자는 주리거나 목마르지 않는다고 하신다.', scripture: true },
      { label: '소요리문답 86문', summary: '믿음은 구원을 위해 그리스도만을 받아들이고 의지하는 것이다.', url: WSC },
      { label: '소요리문답 97문', summary: '성찬에 합당하게 나아가려면 주의 몸을 분별하는 지식과 그리스도를 먹고 사는 믿음을 살핀다.', url: WSC },
      { label: '하이델베르크 81문', summary: '성찬에 나아올 사람은 그리스도의 고난과 죽음으로 죄가 용서되었음을 신뢰하는 사람이다.', url: HC },
      { label: '합동 헌법 예배모범 제11장 3–4항', summary: '성찬을 미리 알려 그 뜻을 깨닫고 예비하게 하며, 그리스도의 구속을 의지하고 주의 몸을 분별하는 자를 참여하게 한다.', polity: 'hapdong' },
    ],
  },
  {
    key: 'repentance',
    title: '회개와 새 순종',
    prompt: '주님 앞에서 돌이키고 싶은 일과 도움이 필요한 일이 있습니까?',
    hint: '자발적으로 나눈 내용, 구체적인 권면',
    sources: [
      { label: '고린도전서 11:28', summary: '사람은 자기를 살핀 뒤에 떡을 먹고 잔을 마신다.', scripture: true },
      { label: '요한일서 1:9', summary: '우리가 죄를 자백하면 하나님은 미쁘시고 의로우셔서 죄를 사하시고 깨끗하게 하신다.', scripture: true },
      { label: '소요리문답 87문', summary: '생명에 이르는 회개는 죄에서 하나님께로 돌이켜 새 순종을 힘쓰는 것이다.', url: WSC },
      { label: '소요리문답 97문', summary: '자기 성찰의 항목으로 회개와 사랑과 새 순종을 든다.', url: WSC },
      { label: '하이델베르크 81문', summary: '죄를 슬퍼하고, 믿음이 굳세어지며 삶이 새로워지기를 바라는 사람을 성찬에 부른다.', url: HC },
      { label: '합동 헌법 예배모범 제11장 4항', summary: '죄를 끊어 버리고 거룩하고 경건하게 살기로 작정한 자를 성찬에 참여하게 한다.', polity: 'hapdong' },
      { label: '고신 헌법 예배 제27조 2항', summary: '성찬을 한 주일 전에 알려 참여자가 자기 죄를 고백함으로 준비하게 한다.', polity: 'kosin' },
    ],
  },
  {
    key: 'assurance',
    title: '연약함과 확신',
    prompt: '성찬에 나아가는 일을 두렵게 하거나 주저하게 하는 것이 있습니까?',
    hint: '낙심의 맥락과 복음의 위로',
    sources: [
      { label: '이사야 42:3', summary: '주의 종은 상한 갈대를 꺾지 않고 꺼져 가는 등불을 끄지 않으신다.', scripture: true },
      { label: '요한복음 6:37', summary: '주께 오는 자를 결코 내쫓지 않으신다.', scripture: true },
      { label: '대요리문답 172문', summary: '그리스도 안에 있는지 의심하는 사람도 그 부족을 슬퍼하며 바란다면 성찬에 나아와 더 굳세어질 수 있다.', url: WLC },
      { label: '합동 헌법 예배모범 제11장 4항', summary: '스스로 죄에서 헤어날 수 없음을 깨닫고 그리스도를 의지하는 자를 부르며, 성찬은 양심의 평안과 소망을 굳게 한다.', polity: 'hapdong' },
    ],
  },
  {
    key: 'word',
    title: '말씀과 예배',
    prompt: '공예배와 말씀을 듣는 생활에 어떤 유익이나 어려움이 있습니까?',
    hint: '실제 장애물과 교회의 돌봄 필요',
    sources: [
      { label: '로마서 10:17', summary: '믿음은 들음에서 나고, 들음은 그리스도의 말씀으로 말미암는다.', scripture: true },
      { label: '히브리서 10:24–25', summary: '서로 돌아보아 사랑과 선행을 격려하고, 모이기를 폐하지 말라.', scripture: true },
      { label: '소요리문답 88–90문', summary: '말씀·성례·기도가 은혜의 방편이며, 말씀은 부지런함과 준비와 기도로 받을 때 효력이 있다.', url: WSC },
      { label: '합동 헌법 정치 제5장 제4조 4항', summary: '장로는 교인 중에 설교(강도)의 결과를 찾아본다.', polity: 'hapdong' },
      { label: '고신 헌법 정치 제66조 5항', summary: '장로는 교인들이 설교대로 신앙생활을 하는지 살핀다.', polity: 'kosin' },
    ],
  },
  {
    key: 'love',
    title: '사랑과 화목',
    prompt: '교회나 이웃과의 관계에서 함께 기도하고 도울 일이 있습니까?',
    hint: '안전하게 다룰 관계 문제와 다음 행동',
    sources: [
      { label: '고린도전서 10:17', summary: '떡이 하나이니 한 떡에 참여하는 우리는 많아도 한 몸이다.', scripture: true },
      { label: '골로새서 3:13', summary: '주께서 용서하신 것 같이 서로 용납하고 용서하라.', scripture: true },
      { label: '소요리문답 97문', summary: '성찬 전 자기 성찰의 항목에 사랑을 둔다.', url: WSC },
      { label: '대요리문답 171문', summary: '성찬 준비로 하나님과 형제에 대한 사랑, 모든 사람에 대한 자비, 잘못한 이를 용서함을 살핀다.', url: WLC },
      { label: '합동 헌법 예배모범 제11장 4항', summary: '성찬은 사랑과 열심으로 신자를 강하게 한다.', polity: 'hapdong' },
      { label: '고신 헌법 예배 제27조', summary: '성찬은 한 몸의 지체로서 서로 나누는 사랑과 교제를 증거하고 새롭게 한다.', polity: 'kosin' },
    ],
  },
  {
    key: 'household',
    title: '가정과 교육',
    prompt: '가정에서 말씀과 기도를 나누는 데 어떤 도움이 필요합니까?',
    hint: '가정의 형편과 교육 지원',
    sources: [
      { label: '신명기 6:6–7', summary: '말씀을 마음에 새기고 자녀에게 부지런히 가르치며 일상 가운데 이야기하라.', scripture: true },
      { label: '에베소서 6:4', summary: '자녀를 노엽게 하지 말고 주의 교훈과 훈계로 양육하라.', scripture: true },
      { label: '신앙고백 25.2, 28.4', summary: '가시적 교회에는 신자의 자녀가 속하며, 믿는 부모의 자녀는 세례를 받는다.', url: WCF },
      { label: '합동 헌법 예배모범 제15장 3·5항', summary: '가정예배는 집집마다 아침저녁으로 드리고, 인도하는 이는 자녀와 집안 사람을 기독교의 원리로 가르친다.', polity: 'hapdong' },
      { label: '고신 헌법 정치 제66조 6항', summary: '장로는 언약의 자녀들을 양육한다.', polity: 'kosin' },
      { label: '고신 헌법 예배 제35조 1항', summary: '가정기도회는 자녀의 신앙교육에 적합하니 가정마다 모이기에 힘쓴다.', polity: 'kosin' },
    ],
  },
  {
    key: 'suffering',
    title: '기도와 고난',
    prompt: '지금 함께 기도하며 곁에 있어야 할 어려움은 무엇입니까?',
    hint: '기도 제목과 실제 지원',
    sources: [
      { label: '빌립보서 4:6–7', summary: '모든 일에 기도와 간구로 감사함으로 아뢰면 하나님의 평강이 마음과 생각을 지키신다.', scripture: true },
      { label: '로마서 12:15', summary: '즐거워하는 자와 함께 즐거워하고 우는 자와 함께 울라.', scripture: true },
      { label: '소요리문답 88문', summary: '기도는 은혜의 방편의 하나다.', url: WSC },
      { label: '소요리문답 98문', summary: '기도는 우리의 소원을 그리스도의 이름으로 하나님께 아뢰는 것이다.', url: WSC },
      { label: '합동 헌법 정치 제5장 제4조 3·5항', summary: '장로는 병자와 슬픔 당한 자를 위로하고, 특별히 돌봐야 할 이를 목사에게 알린다.', polity: 'hapdong' },
      { label: '고신 헌법 예배 제34조', summary: '개인의 은밀한 기도와 가족이 함께하는 기도는 성도의 당연한 의무다.', polity: 'kosin' },
    ],
  },
  {
    key: 'after',
    title: '성찬 후의 생활',
    prompt: '성찬을 통해 받은 위로와 계속 붙들고 싶은 말씀은 무엇입니까?',
    hint: '감사와 지속적인 돌봄',
    sources: [
      { label: '고린도전서 11:26', summary: '떡을 먹고 잔을 마실 때마다 주의 죽으심을 그가 오실 때까지 전한다.', scripture: true },
      { label: '골로새서 2:6–7', summary: '그리스도를 주로 받았으니 그 안에서 행하며 믿음에 굳게 서서 감사를 넘치게 하라.', scripture: true },
      { label: '대요리문답 175문', summary: '성찬 후에는 어떻게 참여했는지 돌아보고, 받은 위로에 감사하며 그 지속을 구하고 다시 넘어지지 않도록 깨어 있는다.', url: WLC },
      { label: '합동 헌법 예배모범 제11장 7항', summary: '목사는 성찬에서 받은 은혜와 그에 따른 의무를 권면하고, 그리스도 안에서 선을 행하도록 권한다.', polity: 'hapdong' },
      { label: '고신 헌법 예배 제27조', summary: '성찬으로 은혜 가운데 자라며 주님과의 연합을 확신하고 감사와 헌신을 새롭게 한다.', polity: 'kosin' },
    ],
  },
];

/** Confessional sources plus only this church's denominational articles. */
export function sourcesFor(sources: GuideSource[], polity: ChurchPolity = CHURCH_POLITY) {
  return sources.filter((source) => !source.polity || source.polity === polity);
}

export const GUIDE_SOURCE_NOTE = '질문은 위 문서를 바탕으로 쓴 목양 대화 초안이며, 요약은 원문의 번역이 아닌 풀어쓴 설명입니다.';

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
