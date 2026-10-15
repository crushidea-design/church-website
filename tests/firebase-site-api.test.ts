import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  verifyIdToken: vi.fn(), getFirestore: vi.fn(), collection: vi.fn(), bucket: vi.fn(),
  subscribeToTopic: vi.fn(), unsubscribeFromTopic: vi.fn(), send: vi.fn(),
  sendEachForMulticast: vi.fn(), generateContent: vi.fn(),
}));
vi.mock('firebase-admin/app', () => ({
  getApps: () => [{}], getApp: () => ({ options: {} }),
  initializeApp: vi.fn(), applicationDefault: vi.fn(), cert: vi.fn(),
}));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: sdk.verifyIdToken }) }));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: sdk.getFirestore, FieldValue: { serverTimestamp: () => 'server-timestamp' },
}));
vi.mock('firebase-admin/storage', () => ({ getStorage: () => ({ bucket: sdk.bucket }) }));
vi.mock('firebase-admin/messaging', () => ({ getMessaging: () => sdk }));
vi.mock('@google/genai', () => ({ GoogleGenAI: class { models = { generateContent: sdk.generateContent }; } }));
import { handleSiteRequest, siteModules, siteRoutes } from '../firebase-functions/src/site-api';
import { matchRoute, type OutgoingLike } from '../firebase-functions/src/adapter';

const endpoints = [
  ['POST', '/api/post-comments'], ['DELETE', '/api/attachments'],
  ['POST', '/api/notifications/subscribe'], ['POST', '/api/notifications/send'],
  ['GET', '/api/notifications/health'], ['POST', '/api/word-fruit/check'],
  ['POST', '/api/word-fruit/generate-cards'], ['POST', '/api/word-fruit/notify-publish'],
] as const;

const call = async (method: string, path: string, body: unknown = {}, token?: string) => {
  const headers = new Map<string, string | string[]>();
  let payload = '';
  const res: OutgoingLike = {
    statusCode: 0,
    setHeader: (name, value) => headers.set(name.toLowerCase(), value),
    end: (chunk) => { payload = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk); },
  };
  await handleSiteRequest({
    method, originalUrl: path,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    rawBody: new TextEncoder().encode(JSON.stringify(body)),
  }, res);
  return { status: res.statusCode, headers, body: JSON.parse(payload) };
};

beforeEach(() => {
  vi.resetAllMocks();
  sdk.getFirestore.mockReturnValue({ collection: sdk.collection });
  sdk.verifyIdToken.mockResolvedValue({ uid: 'member', name: 'Member', email: 'member@example.com', email_verified: true });
  sdk.collection.mockReturnValue({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ role: 'regular' }) }) }) });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('general API routing and authentication', () => {
  it('registers exactly the eight existing HTTP handlers', () => {
    expect(siteModules).toHaveLength(8);
    expect(siteRoutes.map((r) => r.pattern).sort()).toEqual(endpoints.map(([, path]) => path).sort());
    for (const [, path] of endpoints) expect(matchRoute(siteRoutes, path)).not.toBeNull();
  });

  it.each(endpoints)('rejects unauthenticated %s %s before SDK effects', async (method, path) => {
    // subscribe validates its shape before checking authentication.
    const response = await call(method, `/siteApi${path}`, { token: 'test-device' });
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(sdk.verifyIdToken).not.toHaveBeenCalled();
    expect(sdk.collection).not.toHaveBeenCalled();
    expect(sdk.bucket).not.toHaveBeenCalled();
    expect(sdk.send).not.toHaveBeenCalled();
    expect(sdk.generateContent).not.toHaveBeenCalled();
  });

  it.each(['/api/raah/bootstrap', '/api/word-fruit/auto-draft', '/.netlify/functions/notifications-send', '/siteApiX/api/notifications/send'])('does not expose %s', async (path) => {
    expect((await call('POST', path)).status).toBe(404);
    expect(sdk.verifyIdToken).not.toHaveBeenCalled();
  });

  it.each(['/api/notifications/send', '/api/notifications/health', '/api/word-fruit/generate-cards', '/api/word-fruit/notify-publish'])('keeps permission checks for %s', async (path) => {
    const response = await call(path.endsWith('/health') ? 'GET' : 'POST', path, {}, 'member-token');
    expect(response.status).toBe(403);
    expect(sdk.verifyIdToken).toHaveBeenCalledWith('member-token', true);
    expect(sdk.send).not.toHaveBeenCalled();
    expect(sdk.generateContent).not.toHaveBeenCalled();
  });

  it('rejects revoked or invalid tokens', async () => {
    sdk.verifyIdToken.mockRejectedValue(new Error('revoked'));
    expect((await call('DELETE', '/api/attachments', { path: 'pdfs/one.pdf' }, 'revoked-token')).status).toBe(401);
    expect(sdk.bucket).not.toHaveBeenCalled();
  });

  it('retains topic subscription behavior with the original request body', async () => {
    const response = await call('POST', '/siteApi/api/notifications/subscribe', { token: 'device', topic: 'next_members', action: 'unsubscribe' }, 'member-token');
    expect(response.status).toBe(200);
    expect(sdk.unsubscribeFromTopic).toHaveBeenCalledWith('device', 'next_members');
    expect(sdk.subscribeToTopic).not.toHaveBeenCalled();
  });

  it('allows an administrator to send the requested topic notification', async () => {
    sdk.verifyIdToken.mockResolvedValue({ uid: 'admin', email: 'crushidea@gmail.com', email_verified: true });
    sdk.send.mockResolvedValue('message-test');
    const response = await call('POST', '/api/notifications/send', { title: '제목', body: '본문', useTopic: 'next_members' }, 'admin-token');
    expect(response.status).toBe(200);
    expect(sdk.send).toHaveBeenCalledWith(expect.objectContaining({ topic: 'next_members', notification: { title: '제목', body: '본문' } }));
  });

  it('does not treat an unverified administrator email as privileged', async () => {
    sdk.verifyIdToken.mockResolvedValue({ uid: 'member', email: 'crushidea@gmail.com', email_verified: false });
    expect((await call('POST', '/api/notifications/send', {}, 'member-token')).status).toBe(403);
    expect(sdk.send).not.toHaveBeenCalled();
  });

  it('keeps attachment ownership checks and the configured storage bucket', async () => {
    const remove = vi.fn();
    const file = { getMetadata: vi.fn().mockResolvedValue([{ metadata: { ownerUid: 'other' } }]), delete: remove };
    sdk.bucket.mockReturnValue({ file: () => file });
    expect((await call('DELETE', '/api/attachments', { path: 'pdfs/one.pdf' }, 'member-token')).status).toBe(403);
    expect(remove).not.toHaveBeenCalled();
    file.getMetadata.mockResolvedValue([{ metadata: { ownerUid: 'member' } }]);
    expect((await call('DELETE', '/api/attachments', { path: 'pdfs/one.pdf' }, 'member-token')).status).toBe(200);
    expect(sdk.bucket).toHaveBeenCalledWith('gen-lang-client-0036445484.firebasestorage.app');
    expect(remove).toHaveBeenCalledWith({ ignoreNotFound: true });
  });

  it('keeps comment creation and foreign-author deletion inside their transaction checks', async () => {
    const docs: Record<string, Record<string, unknown>> = {
      'users/member': { role: 'regular' },
      'posts/post1': { category: 'community', authorId: 'member', commentCount: 0 },
    };
    const tx = {
      get: vi.fn(async (ref: { path: string }) => ({ exists: Boolean(docs[ref.path]), data: () => docs[ref.path] })),
      create: vi.fn((ref: { path: string }, data: Record<string, unknown>) => { docs[ref.path] = data; }),
      update: vi.fn((ref: { path: string }, data: Record<string, unknown>) => { Object.assign(docs[ref.path], data); }),
      delete: vi.fn(),
    };
    sdk.getFirestore.mockReturnValue({
      collection: (name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}` }) }),
      runTransaction: async (work: (transaction: typeof tx) => unknown) => work(tx),
    });
    const body = { postId: 'post1', commentId: 'comment1', content: '댓글 내용' };
    expect((await call('POST', '/api/post-comments', body, 'member-token')).status).toBe(200);
    expect(docs['posts/post1'].commentCount).toBe(1);
    expect((await call('POST', '/api/post-comments', body, 'member-token')).status).toBe(200);
    expect(tx.create).toHaveBeenCalledTimes(1);
    sdk.verifyIdToken.mockResolvedValue({ uid: 'other', email: 'other@example.com' });
    expect((await call('DELETE', '/api/post-comments', body, 'other-token')).status).toBe(403);
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it.each([false, true])('finishes parent notification work before responding (delivery failure: %s)', async (fail) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T03:00:00Z'));
    let release!: (value: { docs: [] }) => void;
    let reject!: (reason: Error) => void;
    const parents = new Promise<{ docs: [] }>((resolve, rejectPromise) => { release = resolve; reject = rejectPromise; });
    const readParents = vi.fn(() => parents);
    const query = { where: () => query, get: readParents };
    sdk.getFirestore.mockReturnValue({
      collection: (name: string) => name === 'next_generation_members' ? query : { doc: () => ({}) },
      runTransaction: async () => ({ count: 1, dates: ['2026-10-15'], childName: 'Test child' }),
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    let returned = false;
    const pending = call('POST', '/api/word-fruit/check', { weekId: 'week-test' }, 'member-token').then((result) => { returned = true; return result; });
    try {
      await vi.waitFor(() => expect(readParents).toHaveBeenCalledTimes(1));
      expect(returned).toBe(false);
      if (fail) reject(new Error('test delivery failure'));
      else release({ docs: [] });
      expect((await pending).status).toBe(200);
    } finally { log.mockRestore(); }
  });

  it('uses the named application Firestore database', async () => {
    await call('GET', '/api/notifications/health', {}, 'member-token');
    expect(sdk.getFirestore).toHaveBeenCalledWith('ai-studio-718ae15e-9471-4be1-ad56-c48181aa8613');
  });

  it('allows pastor-only card generation with the server key', async () => {
    sdk.verifyIdToken.mockResolvedValue({ uid: 'admin', email: 'crushidea@gmail.com', email_verified: true });
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    sdk.generateContent.mockResolvedValue({ text: JSON.stringify({ cards: [{ order: 1 }] }) });
    const response = await call('POST', '/api/word-fruit/generate-cards', { manuscript: '테스트용 강의 원고입니다. '.repeat(5) }, 'admin-token');
    expect(response.status).toBe(200);
    expect(response.body.data.cards).toEqual([{ order: 1 }]);
    expect(sdk.generateContent).toHaveBeenCalledTimes(1);
  });
});
