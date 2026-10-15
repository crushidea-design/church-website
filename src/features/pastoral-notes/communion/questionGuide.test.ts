import { describe, expect, it } from 'vitest';
import { GUIDE_GENERAL_SOURCES, GUIDE_TOPICS, composeConversationNote, emptyConversationDraft, isConversationDraftEmpty, sourcesFor } from './questionGuide';

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

describe('GUIDE_TOPICS sources', () => {
  it('starts every prompt with Scripture and cites a linked confessional text', () => {
    for (const topic of GUIDE_TOPICS) {
      expect(topic.sources[0].scripture, topic.key).toBe(true);
      const confessional = topic.sources.filter((source) => !source.scripture && !source.polity);
      expect(confessional.length, topic.key).toBeGreaterThan(0);
      for (const source of confessional) expect(source.url).toMatch(/^https:\/\//);
      for (const source of topic.sources) {
        expect(source.label.trim()).not.toBe('');
        expect(source.summary.trim()).not.toBe('');
      }
    }
  });

  it('shows only the configured denomination\'s constitution', () => {
    for (const topic of GUIDE_TOPICS) {
      const hapdong = sourcesFor(topic.sources, 'hapdong');
      expect(hapdong.some((source) => source.polity === 'hapdong'), topic.key).toBe(true);
      expect(hapdong.some((source) => source.polity === 'kosin')).toBe(false);
      expect(sourcesFor(topic.sources, 'kosin').some((source) => source.polity === 'hapdong')).toBe(false);
    }
    expect(sourcesFor(GUIDE_GENERAL_SOURCES, 'kosin').map((source) => source.label)).toContain('고신 헌법 정치 제66조');
  });
});
