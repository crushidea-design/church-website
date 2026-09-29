import { describe, expect, it } from 'vitest';
import { composeConversationNote, emptyConversationDraft, isConversationDraftEmpty } from './questionGuide';

describe('composeConversationNote', () => {
  it('writes only the topics that were touched, with their scope label', () => {
    const draft = emptyConversationDraft('2026-12-06');
    draft.topics.gospel = { coverage: 'covered', note: '  약속의 말씀을 함께 확인함 ' };
    draft.topics.assurance = { coverage: 'deferred', note: '' };
    draft.counsel = '요한복음 6:37';

    expect(composeConversationNote(draft)).toBe(
      '[복음과 그리스도] 이번 대화에서 다룸\n약속의 말씀을 함께 확인함\n\n[연약함과 확신] 다음 대화로 남김\n\n[전한 말씀과 권면]\n요한복음 6:37'
    );
  });

  it('keeps a note even when no scope was chosen', () => {
    const draft = emptyConversationDraft('2026-12-06');
    draft.topics.word = { coverage: '', note: '주일 오후 근무' };
    expect(composeConversationNote(draft)).toBe('[말씀과 예배]\n주일 오후 근무');
  });

  it('does not invent content for an untouched guide', () => {
    const draft = emptyConversationDraft('2026-12-06');
    expect(composeConversationNote(draft)).toBe('');
    expect(isConversationDraftEmpty(draft)).toBe(true);
    draft.nextSteps = '다음 주 연락';
    expect(isConversationDraftEmpty(draft)).toBe(false);
  });
});
