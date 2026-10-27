import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Ref = { path: string; id: string; collection: string };

const state = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  writes: [] as Array<{ op: string; path: string; data?: Record<string, unknown> }>,
  getFirestore: undefined as unknown,
  summaryFails: false,
}));

vi.mock('firebase-admin/app', () => ({
  getApps: () => [{}], getApp: () => ({ options: {} }),
  initializeApp: vi.fn(), applicationDefault: vi.fn(), cert: vi.fn(),
}));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }));
vi.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({}) }));
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: (...args: unknown[]) => (state.getFirestore as (...a: unknown[]) => unknown)(...args),
  FieldValue: { serverTimestamp: () => 'SERVER_TS', delete: () => 'DELETE_FIELD' },
  Timestamp: { fromDate: (d: Date) => ({ ts: d.toISOString() }) },
}));

import handler from '../netlify/functions/mccheyne-publish.mts';
import {
  buildGuideTitle, isAuthorized, kstMidnight, markdownToGuideText, postUrl, PUBLIC_ORIGIN, validatePublishRequest,
} from '../netlify/functions/_shared/mccheyne-publish-core.mts';

const KEY = 'test-key-not-a-secret';
const SOURCE = 'drive_file_ID-1234567890';

const valid = {
  date: '2026-10-27', passage: '열왕기하 8장', title: '항상 등불을 주겠다고 말씀하셨음이라',
  content: '첫 문단입니다.\n\n둘째 문단입니다.', source_id: SOURCE,
};

describe('isAuthorized', () => {
  it('rejects missing header, wrong scheme, wrong key, unset env, empty token', () => {
    expect(isAuthorized(null, KEY)).toBe(false);
    expect(isAuthorized(`Basic ${KEY}`, KEY)).toBe(false);
    expect(isAuthorized(KEY, KEY)).toBe(false);
    expect(isAuthorized('Bearer wrong', KEY)).toBe(false);
    expect(isAuthorized(`Bearer ${KEY}`, undefined)).toBe(false);
    expect(isAuthorized('Bearer ', '')).toBe(false);
    expect(isAuthorized('Bearer ', KEY)).toBe(false);
    expect(isAuthorized(`bearer ${KEY}`, KEY)).toBe(false);
  });
  it('accepts the correct key', () => {
    expect(isAuthorized(`Bearer ${KEY}`, KEY)).toBe(true);
  });
});

const errs = (r: ReturnType<typeof validatePublishRequest>): Record<string, string> => ('errors' in r ? r.errors : {});

describe('validatePublishRequest', () => {
  it('accepts a valid request, defaults status, ignores unknown fields', () => {
    const r = validatePublishRequest({ ...valid, extra: 1 });
    expect(r).toMatchObject({ ok: true, value: { date: '2026-10-27', status: 'published', sourceId: SOURCE } });
    expect(r.ok && r.value.content).toBe('  첫 문단입니다.\n\n  둘째 문단입니다.');
  });
  it('accepts draft and rejects other statuses', () => {
    expect(validatePublishRequest({ ...valid, status: 'draft' })).toMatchObject({ ok: true });
    expect(validatePublishRequest({ ...valid, status: 'live' })).toMatchObject({ ok: false, errors: { status: expect.any(String) } });
  });
  it.each(['body', 'array', 'null'])('rejects non-object body (%s)', (kind) => {
    const bad = kind === 'body' ? 'x' : kind === 'array' ? [] : null;
    expect(validatePublishRequest(bad)).toMatchObject({ ok: false });
  });
  it.each(['date', 'passage', 'title', 'content', 'source_id'])('reports missing %s', (field) => {
    const body: Record<string, unknown> = { ...valid };
    delete body[field];
    const r = validatePublishRequest(body);
    expect(r.ok).toBe(false);
    expect(Object.keys(errs(r))).toEqual([field]);
  });
  it('rejects bad formats and limits', () => {
    const bad = (patch: Record<string, unknown>) => {
      const r = validatePublishRequest({ ...valid, ...patch });
      return Object.keys(errs(r));
    };
    expect(bad({ date: '2026-02-30' })).toEqual(['date']);
    expect(bad({ date: '2026-2-3' })).toEqual(['date']);
    expect(bad({ passage: '   ' })).toEqual(['passage']);
    expect(bad({ passage: 'a'.repeat(101) })).toEqual(['passage']);
    expect(bad({ title: 'a'.repeat(151) })).toEqual(['title']);
    expect(bad({ content: 'a'.repeat(50001) })).toEqual(['content']);
    expect(bad({ content: '[^1]: only a footnote' })).toEqual(['content']);
    expect(bad({ source_id: 'short' })).toEqual(['source_id']);
    expect(bad({ source_id: 'has space in id!' })).toEqual(['source_id']);
    expect(bad({ passage: 5 })).toEqual(['passage']);
  });
  it('reports multiple errors together', () => {
    const r = validatePublishRequest({ date: 'nope', title: '', source_id: 1 });
    expect(Object.keys(errs(r)).sort()).toEqual(['content', 'date', 'passage', 'source_id', 'title']);
  });
});

describe('markdownToGuideText', () => {
  it('drops footnote references and multi-line definitions', () => {
    const md = '말씀이다 [^1].\n\n다음 문단[^note].\n\n[^1]: 각주 하나\n    이어지는 줄\n\n    또 이어지는 단락\n[^note]: 두 번째\n\n마지막 문단.';
    expect(markdownToGuideText(md)).toBe('  말씀이다.\n\n  다음 문단.\n\n  마지막 문단.');
  });
  it.each([' ', '  ', '   ', '\t'])('removes indented definitions and continuations (%j)', (indent) => {
    const md = `본문입니다.[^1]\r\n\r\n${indent}[^1]: 검수 각주\r\n    이어지는 설명\r\n\r\n\t다음 각주 문단\r\n\r\n보존할 본문.`;
    expect(markdownToGuideText(md)).toBe('  본문입니다.\n\n  보존할 본문.');
  });

  it('strips headings, emphasis, links, images, code, quotes, rules, html', () => {
    const md = '# 제목\n\n**굵게**와 *기울임*과 __밑줄__ 그리고 snake_case_word.\n\n[링크](http://x.y)와 ![그림](a.png) `코드`\n\n> 인용문\n\n---\n\n<b>태그</b> 문단\n\n\\*별표\\*';
    expect(markdownToGuideText(md)).toBe(
      '  제목\n\n  굵게와 기울임과 밑줄 그리고 snake_case_word.\n\n  링크와  코드\n\n  인용문\n\n  태그 문단\n\n  *별표*',
    );
  });
  it('joins soft-wrapped lines but keeps list items on their own lines', () => {
    const md = '줄 하나\n줄 둘\r\n줄 셋\n\n- 가\n* 나\n+ 다\n\n1. 첫째\n2. 둘째';
    expect(markdownToGuideText(md)).toBe('  줄 하나 줄 둘 줄 셋\n\n  • 가\n  • 나\n  • 다\n\n  1. 첫째\n  2. 둘째');
  });
  it('cannot emit tag-like markup from script text', () => {
    for (const input of ['<script>alert(1)</script>본문', '본문 <script', '<img src=x onerror=alert(1)>본문', '\\<script\\>x']) {
      expect(markdownToGuideText(input)).not.toMatch(/<[A-Za-z/!?]/);
    }
    expect(markdownToGuideText('<script>alert(1)</script>본문')).toBe('  alert(1)본문');
  });
});

describe('title and date helpers', () => {
  it('builds titles', () => {
    expect(buildGuideTitle('2026-10-27', '열왕기하 8장', '등불')).toBe('10월 27일 열왕기하 8장 등불');
    expect(buildGuideTitle('2026-01-05', '창세기 5장', '1월 5일 창세기 5장 이미 완성')).toBe('1월 5일 창세기 5장 이미 완성');
    expect(buildGuideTitle('2026-01-05', '창세기 5장', '창세기 5장 제목')).toBe('1월 5일 창세기 5장 제목');
    expect(buildGuideTitle('2026-01-05', '창세기 5장', '1월 5일 창세기 5장 제목')).not.toContain('1월 5일 1월 5일');
  });
  it('computes KST midnight and URLs', () => {
    expect(kstMidnight('2026-10-27').toISOString()).toBe('2026-10-26T15:00:00.000Z');
    expect(PUBLIC_ORIGIN).toBe('https://builttogether.church');
    expect(postUrl('abc')).toBe('https://builttogether.church/post/abc');
  });
});

// ------------------------------------------------------------------ handler

const makeDb = () => {
  const ref = (collection: string, id: string): Ref => ({ path: `${collection}/${id}`, id, collection });
  const collection = (name: string) => ({
    doc: (id = 'new_post_id') => ref(name, id),
    where: (field: string, _op: string, value: string) => ({ kind: 'where', name, field, value,
      orderBy: () => ({ limit: () => ({ kind: 'template' }) }) }),
    set: undefined,
  });
  const snapFor = (path: string) => {
    const data = state.docs.get(path);
    return { exists: Boolean(data), data: () => data, ref: { path } };
  };
  const tx = {
    get: vi.fn(async (target: Ref | { kind: string; value?: string }) => {
      if ('path' in target) return snapFor(target.path);
      if (target.kind === 'template') {
        const posts = [...state.docs.entries()].filter(([p, d]) => p.startsWith('posts/') && d.category === 'today_word');
        return { empty: posts.length === 0, docs: posts.slice(0, 1).map(([, d]) => ({ data: () => d })) };
      }
      const chunks = [...state.docs.entries()].filter(([p, d]) => p.startsWith('post_contents/') && d.postId === target.value);
      return { empty: !chunks.length, docs: chunks.map(([p, d]) => ({ data: () => d, ref: ref('post_contents', p.split('/')[1]) })) };
    }),
    set: vi.fn((r: Ref, data: Record<string, unknown>) => { state.writes.push({ op: 'set', path: r.path, data }); }),
    update: vi.fn((r: Ref, data: Record<string, unknown>) => { state.writes.push({ op: 'update', path: r.path, data }); }),
    delete: vi.fn((r: Ref) => { state.writes.push({ op: 'delete', path: r.path }); }),
  };
  return {
    tx,
    db: {
      collection: (name: string) => ({
        ...collection(name),
        doc: (id = 'new_post_id') => ({
          ...ref(name, id),
          set: async (data: Record<string, unknown>) => {
            if (state.summaryFails) throw new Error('summary down');
            state.writes.push({ op: 'summary', path: `${name}/${id}`, data });
          },
        }),
      }),
      runTransaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
    },
  };
};

const post = (body: unknown, key: string | null = KEY) => handler(new Request('https://x.test/api/mccheyne/publish', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
  body: typeof body === 'string' ? body : JSON.stringify(body),
}));

const template = { category: 'today_word', authorId: 'pastor-uid', authorName: '목사님', createdAt: 'old' };
let getFirestore: ReturnType<typeof vi.fn>;

beforeEach(() => {
  state.docs.clear();
  state.writes = [];
  state.summaryFails = false;
  vi.stubEnv('MCCHEYNE_PUBLISH_KEY', KEY);
  const { db } = makeDb();
  getFirestore = vi.fn(() => db);
  state.getFirestore = getFirestore;
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('POST /api/mccheyne/publish', () => {
  it('rejects non-POST with 405', async () => {
    const res = await handler(new Request('https://x.test/api/mccheyne/publish', { method: 'GET' }));
    expect(res.status).toBe(405);
    expect(await res.json()).toEqual({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  });

  it.each([['no header', null], ['wrong key', 'nope']])('rejects %s with 401 without touching Firestore', async (_n, key) => {
    const res = await post(valid, key);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: 'UNAUTHORIZED' });
    expect(getFirestore).not.toHaveBeenCalled();
  });

  it('rejects everything when the key env is unset', async () => {
    vi.stubEnv('MCCHEYNE_PUBLISH_KEY', '');
    expect((await post(valid, '')).status).toBe(401);
    expect(getFirestore).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON and for validation failures naming the fields', async () => {
    const bad = await post('{not json');
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe('INVALID_JSON');
    const res = await post({ ...valid, date: '2026-02-30', title: '' });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, error: 'VALIDATION_FAILED', message: 'Invalid fields: date, title' });
    expect(Object.keys(json.fields).sort()).toEqual(['date', 'title']);
    expect(getFirestore).not.toHaveBeenCalled();
  });

  it('returns NO_TEMPLATE_POST when no guide exists yet', async () => {
    const res = await post(valid);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'NO_TEMPLATE_POST' });
    expect(state.writes).toEqual([]);
  });

  it('creates a short post with exactly the admin field set, mapping and summary', async () => {
    state.docs.set('posts/tpl', template);
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: 'new_post_id', url: 'https://builttogether.church/post/new_post_id', action: 'created' });

    const created = state.writes.find((w) => w.path === 'posts/new_post_id')!;
    expect(created.op).toBe('set');
    expect(Object.keys(created.data!).sort()).toEqual([
      'authorId', 'authorName', 'category', 'commentCount', 'content', 'createdAt', 'dateKey',
      'isPublished', 'sortOrder', 'subCategory', 'title', 'updatedAt', 'viewCount',
    ]);
    expect(created.data).toMatchObject({
      title: '10월 27일 열왕기하 8장 항상 등불을 주겠다고 말씀하셨음이라',
      content: '  첫 문단입니다.\n\n  둘째 문단입니다.',
      category: 'today_word', subCategory: 'general', authorId: 'pastor-uid', authorName: '목사님',
      commentCount: 0, viewCount: 0, isPublished: true, dateKey: '2026-10-27',
      createdAt: { ts: '2026-10-26T15:00:00.000Z' }, updatedAt: 'SERVER_TS', sortOrder: expect.any(Number),
    });
    expect(state.writes.some((w) => w.path.startsWith('post_contents/'))).toBe(false);

    const mapping = state.writes.find((w) => w.path === `mccheyne_publish_sources/${SOURCE}`)!;
    expect(mapping.data).toMatchObject({ postId: 'new_post_id', dateKey: '2026-10-27', passage: '열왕기하 8장', createdAt: 'SERVER_TS' });

    const summary = state.writes.find((w) => w.op === 'summary')!;
    expect(summary.path).toBe('settings/latest_posts_summary');
    expect(summary.data).toMatchObject({ today_word: { id: 'new_post_id', category: 'today_word', authorName: '목사님', sermonCategoryId: null } });
  });

  it('stores long content as a snippet plus 10000-char chunks', async () => {
    state.docs.set('posts/tpl', template);
    const paragraph = '가'.repeat(1800);
    const content = Array.from({ length: 7 }, () => paragraph).join('\n\n');
    const res = await post({ ...valid, content });
    expect(res.status).toBe(200);
    const converted = markdownToGuideText(content);
    const created = state.writes.find((w) => w.path === 'posts/new_post_id')!.data!;
    expect(created).toMatchObject({ isLongContent: true, fullContentLength: converted.length });
    expect(created.content).toBe(converted.substring(0, 400));
    const chunks = state.writes.filter((w) => w.path.startsWith('post_contents/'));
    expect(chunks.map((c) => c.path)).toEqual(['post_contents/new_post_id_0', 'post_contents/new_post_id_1']);
    expect(chunks.map((c) => (c.data!.content as string)).join('')).toBe(converted);
    expect(chunks[0].data).toMatchObject({ postId: 'new_post_id', index: 0, createdAt: 'SERVER_TS' });
    expect(Object.keys(chunks[0].data!).sort()).toEqual(['content', 'createdAt', 'index', 'postId']);
  });

  it('does not touch the home summary for drafts', async () => {
    state.docs.set('posts/tpl', template);
    const res = await post({ ...valid, status: 'draft' });
    expect(res.status).toBe(200);
    expect(state.writes.find((w) => w.path === 'posts/new_post_id')!.data).toMatchObject({ isPublished: false });
    expect(state.writes.some((w) => w.op === 'summary')).toBe(false);
  });

  it('atomically retracts a published guide from the home summary on downgrade', async () => {
    state.docs.set('posts/existing1', { ...template, isPublished: true });
    state.docs.set(`mccheyne_publish_sources/${SOURCE}`, { postId: 'existing1' });
    state.docs.set('settings/latest_posts_summary', { today_word: { id: 'existing1', content: 'old public text' } });
    expect((await post({ ...valid, status: 'draft' })).status).toBe(200);
    expect(state.writes).toContainEqual(expect.objectContaining({ op: 'update', path: 'posts/existing1', data: expect.objectContaining({ isPublished: false }) }));
    expect(state.writes).toContainEqual({ op: 'update', path: 'settings/latest_posts_summary', data: { today_word: 'DELETE_FIELD', updatedAt: 'SERVER_TS' } });
    expect(state.writes.some(w => w.op === 'summary')).toBe(false);
  });

  it('still succeeds when the home summary update fails', async () => {
    state.docs.set('posts/tpl', template);
    state.summaryFails = true;
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await post(valid)).status).toBe(200);
    err.mockRestore();
  });

  it('updates the existing post for the same source_id, preserving identity and deleting stale chunks', async () => {
    state.docs.set('posts/tpl', template);
    state.docs.set('posts/existing1', { ...template, authorId: 'original', createdAt: 'orig-created', commentCount: 3, viewCount: 9 });
    state.docs.set(`mccheyne_publish_sources/${SOURCE}`, { postId: 'existing1', createdAt: 'map-created' });
    state.docs.set('post_contents/existing1_0', { postId: 'existing1', index: 0 });
    state.docs.set('post_contents/existing1_1', { postId: 'existing1', index: 1 });
    state.docs.set('post_contents/existing1_2', { postId: 'existing1', index: 2 });
    const content = Array.from({ length: 7 }, () => '나'.repeat(1800)).join('\n\n'); // 2 chunks

    const res = await post({ ...valid, content });
    expect(await res.json()).toEqual({ ok: true, id: 'existing1', url: 'https://builttogether.church/post/existing1', action: 'updated' });

    const update = state.writes.find((w) => w.op === 'update' && w.path === 'posts/existing1')!;
    expect(Object.keys(update.data!).sort()).toEqual([
      'content', 'dateKey', 'fullContentLength', 'isLongContent', 'isPublished', 'sortOrder', 'title', 'updatedAt',
    ]);
    for (const preserved of ['authorId', 'authorName', 'createdAt', 'commentCount', 'viewCount', 'category']) {
      expect(update.data).not.toHaveProperty(preserved);
    }
    expect(state.writes.some((w) => w.op === 'set' && w.path === 'posts/existing1')).toBe(false);
    expect(state.writes.filter((w) => w.op === 'delete').map((w) => w.path)).toEqual(['post_contents/existing1_2']);
    expect(state.writes.filter((w) => w.op === 'set' && w.path.startsWith('post_contents/')).map((w) => w.path))
      .toEqual(['post_contents/existing1_0', 'post_contents/existing1_1']);
    const mapping = state.writes.find((w) => w.path === `mccheyne_publish_sources/${SOURCE}`)!;
    expect(mapping.data).toMatchObject({ postId: 'existing1', createdAt: 'map-created', updatedAt: 'SERVER_TS' });
  });

  it('removes all chunks and long-content fields when an update becomes short', async () => {
    state.docs.set('posts/existing1', { ...template });
    state.docs.set(`mccheyne_publish_sources/${SOURCE}`, { postId: 'existing1', createdAt: 'map-created' });
    state.docs.set('post_contents/existing1_0', { postId: 'existing1', index: 0 });
    expect((await post(valid)).status).toBe(200);
    const update = state.writes.find((w) => w.op === 'update')!;
    expect(update.data).toMatchObject({ isLongContent: 'DELETE_FIELD', fullContentLength: 'DELETE_FIELD' });
    expect(state.writes.filter((w) => w.op === 'delete').map((w) => w.path)).toEqual(['post_contents/existing1_0']);
  });
});
