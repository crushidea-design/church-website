import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ db: vi.fn(), notify: vi.fn(), generate: vi.fn() }));
vi.mock('../netlify/functions/_shared/firebase-admin.mjs', () => ({
  initializeFirebaseAdmin: () => true, getAppDb: mocks.db, createInAppNotifications: mocks.notify,
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));
vi.mock('@google/genai', () => ({ GoogleGenAI: class { models = { generateContent: mocks.generate }; } }));
import { runJob } from '../netlify/functions/word-fruit-auto-draft.mjs';

beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('GEMINI_API_KEY', 'test-only');
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-17T14:00:00Z'));
  mocks.generate.mockResolvedValue({ text: JSON.stringify({ title: 'Test draft', cards: [] }) });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('scheduled auto draft final write', () => {
  it.each(['unchanged', 'human-created', 'human-edited', 'published'] as const)('preserves %s state during AI generation', async (state) => {
    const version = { isEqual: (other: unknown) => other === version };
    const original = state === 'human-edited'
      ? { exists: true, updateTime: version, data: () => ({ status: 'draft', autoDraftedAt: { toMillis: () => 1 }, updatedAt: { toMillis: () => 1 } }) }
      : { exists: false, data: () => undefined };
    const current = state === 'unchanged' ? original : { exists: true, updateTime: {}, data: () => ({ status: state === 'published' ? 'published' : 'draft' }) };
    const fruitRef = { get: async () => original };
    const set = vi.fn();
    const query = (docs: unknown[]) => ({ where: () => query(docs), limit: () => query(docs), get: async () => ({ empty: docs.length === 0, docs }) });
    mocks.db.mockReturnValue({
      collection: (name: string) => {
        if (name === 'next_generation_word_fruits') return { doc: () => fruitRef };
        if (name === 'posts') return query([{ id: 'post-test', data: () => ({ title: '강의', content: '테스트 강의 내용입니다. '.repeat(5) }) }]);
        if (name === 'next_generation_members') return query([]);
        throw new Error('Unexpected collection');
      },
      runTransaction: async (work: (tx: unknown) => unknown) => work({ get: async () => current, set }),
    });
    const result = await (await runJob()).json();
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    if (state === 'unchanged') {
      expect(result.reason).toBe('SAVED');
      expect(set).toHaveBeenCalledWith(fruitRef, expect.objectContaining({ status: 'draft', weekId: '2026-W43' }), { merge: true });
    } else {
      expect(result.reason).toBe('HUMAN_EDITED'); expect(set).not.toHaveBeenCalled();
      expect(mocks.notify).not.toHaveBeenCalled();
    }
  });
});
