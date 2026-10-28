import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createSyncStore, CONTROL_COLLECTION, STATE_COLLECTION } from '../netlify/functions/_shared/mccheyne-sync-store.mts';
import type { Guide, RecordState } from '../netlify/functions/_shared/mccheyne-sync-core.mts';
import { APPROVED_FOLDER, DOC_MIME, runSync } from '../netlify/functions/_shared/mccheyne-sync-core.mts';
import { createReadOnlySyncStore } from '../netlify/functions/_shared/mccheyne-read-only-store.mts';
import { MCCHEYNE_AUTHOR_UID, MCCHEYNE_AUTHOR_EMAIL } from '../netlify/functions/_shared/mccheyne-site-state.mts';
import { holdSitePost } from '../netlify/functions/_shared/mccheyne-sync-runtime.mts';

vi.mock('../netlify/functions/_shared/firebase-admin.mjs', async () => {
  const { getApp } = await import('firebase-admin/app'); const { getFirestore } = await import('firebase-admin/firestore');
  return { initializeFirebaseAdmin: () => true, getAppDb: () => getFirestore(getApp('sync-integration')), getEnv: () => undefined,
    jsonResponse: (data: unknown, status = 200) => new Response(JSON.stringify(data), { status }) };
});
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
describe.skipIf(!enabled)('sync transaction contracts (demo emulator only)', () => {
  let env: RulesTestEnvironment;
  let app: ReturnType<typeof initializeApp>;
  let db: ReturnType<typeof getFirestore>;
  let store: ReturnType<typeof createSyncStore>;
  const guide: Guide = { date: '2027-12-03', passage: '역대하 2장', title: '시험', content: '시험 문단', source_id: 'document_12345', status: 'published' };
  const ready: RecordState = { id: guide.source_id, name: 'fixture', version: '1', sourceHash: 'a'.repeat(64), approvedHash: 'a'.repeat(64), approvedDate: guide.date, status: 'ready', code: 'APPROVED', updatedAt: 1 };
  beforeAll(async () => {
    if (!/^127\.0\.0\.1:|^localhost:/.test(process.env.FIRESTORE_EMULATOR_HOST!)) throw new Error('Local emulator required');
    env = await initializeTestEnvironment({ projectId: 'demo-mccheyne-sync', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
    app = initializeApp({ projectId: 'demo-mccheyne-sync' }, 'sync-integration'); db = getFirestore(app); store = createSyncStore(db);
  });
  beforeEach(async () => {
    await env.clearFirestore();
    await db.doc(`users/${MCCHEYNE_AUTHOR_UID}`).set({ uid: MCCHEYNE_AUTHOR_UID, email: MCCHEYNE_AUTHOR_EMAIL, displayName: '이종구', role: 'admin', createdAt: Timestamp.now() });
    await db.doc('posts/template').set({ category: 'today_word', dateKey: '2000-01-01', createdAt: Timestamp.fromDate(new Date('2000-01-01')), authorId: 'fixture-admin', authorName: 'Fixture', content: '다른 본문' });
  });
  afterAll(async () => { await db?.terminate(); if (app) await deleteApp(app); await env?.cleanup(); });
  it('permits only one competing lease and fences expired owners', async () => {
    const leases = await Promise.all([store.acquire(60_000), store.acquire(60_000)]);
    expect(leases.filter(Boolean)).toHaveLength(1); const old = leases.find(Boolean)!;
    await db.collection(CONTROL_COLLECTION).doc('current').update({ expiresAt: 0 });
    const fresh = await store.acquire(60_000); expect(fresh).toBeTruthy();
    await expect(store.save(ready, old)).rejects.toThrow('STALE_RUN');
    await store.release(old); expect(await store.acquire(60_000)).toBeNull(); await store.release(fresh!);
  });
  it('leaves the real emulator database unchanged during a read-only trial', async () => {
    const trial = createReadOnlySyncStore(store);
    const meta = { id: guide.source_id, name: 'fixture', version: '1', parents: [APPROVED_FOLDER], mimeType: DOC_MIME, modifiedTime: '2026-10-27T00:00:00Z' };
    const reader = { list: async () => [meta], snapshot: async () => ({ meta, text: '12월 3일 역대하 2장 시험\n\n시험 문단', sourceHash: 'a'.repeat(64) }), unchanged: async () => true, approvedMove: async () => true };
    expect((await runSync(reader, trial.store, 'dry_run')).success).toBe(1);
    for (const collection of [STATE_COLLECTION, CONTROL_COLLECTION, 'mccheyne_publish_sources', 'post_contents', 'settings']) expect((await db.collection(collection).get()).size).toBe(0);
    expect((await db.collection('posts').get()).size).toBe(1);
  });
  it('persists the cursor under the lease and stop wins over new work or publication', async () => {
    const lease = (await store.acquire(60_000))!;
    await store.beginItem(ready.id, lease); await store.save(ready, lease);
    await store.stop('verified-admin');
    expect(await store.control()).toEqual({ stopped: true, cursor: ready.id });
    await expect(store.beginItem('document_67890', lease)).rejects.toThrow('STOPPED');
    await expect(store.acquire(60_000)).rejects.toThrow('STOPPED');
    await expect(store.publish(guide, ready, lease)).rejects.toThrow('STOPPED');
    expect((await db.collection('posts').get()).size).toBe(1);
    await store.summary({ mode: 'publish', scanned: 1, success: 0, held: 0, failed: 0, skipped: 0, pending: 1, code: 'STOPPED', finishedAt: Date.now() }, lease);
    await store.release(lease);
    const control = (await db.collection(CONTROL_COLLECTION).doc('current').get()).data()!;
    expect(control).toMatchObject({ stopped: true, stoppedBy: 'verified-admin', cursor: ready.id, lease: null });
  });
  it('does not let a racing worker clear the stop latch or change cursor with a stale lease', async () => {
    const old = (await store.acquire(60_000))!;
    await db.collection(CONTROL_COLLECTION).doc('current').update({ expiresAt: 0 });
    const fresh = (await store.acquire(60_000))!;
    await expect(store.beginItem('document_67890', old)).rejects.toThrow('STALE_RUN');
    await Promise.allSettled([store.beginItem(ready.id, fresh), store.stop('verified-admin')]);
    expect((await store.control()).stopped).toBe(true);
    await expect(store.beginItem('document_67890', fresh)).rejects.toThrow('STOPPED');
  });
  it('atomically publishes with source mapping and success receipt; replay cannot duplicate or erase it', async () => {
    const lease = (await store.acquire(60_000))!; await store.save(ready, lease);
    const id = await store.publish(guide, ready, lease);
    expect((await store.load(ready.id))?.publishedHash).toBe(ready.sourceHash);
    expect((await db.doc(`posts/${id}`).get()).data()).toMatchObject({ dateKey: guide.date, isPublished: true });
    expect((await db.doc(`mccheyne_publish_sources/${ready.id}`).get()).data()?.postId).toBe(id);
    expect(await store.publish(guide, ready, lease)).toBe(id);
    await store.save({ ...ready, status: 'failed', code: 'LOST_RESPONSE' }, lease);
    expect((await store.load(ready.id))?.status).toBe('success'); expect((await db.collection('posts').get()).size).toBe(2);
  });
  it('rejects an old retry after a newer approval and preserves the public post', async () => {
    const lease = (await store.acquire(60_000))!; await store.save(ready, lease); const id = await store.publish(guide, ready, lease);
    const newer = { ...ready, version: '2', sourceHash: 'b'.repeat(64), approvedHash: 'b'.repeat(64) };
    await store.save(newer, lease);
    await expect(store.publish({ ...guide, content: '오래된 재시도' }, ready, lease)).rejects.toThrow('STALE_APPROVAL');
    expect((await db.doc(`posts/${id}`).get()).data()?.content).toContain('시험 문단');
  });
  it('detects both dateKey and legacy createdAt collisions and repeats checks inside publication', async () => {
    const lease = (await store.acquire(60_000))!; await store.save(ready, lease); expect(await store.conflict(guide)).toBe(false);
    await db.doc('posts/manual').set({ category: 'today_word', dateKey: guide.date, content: '수동 글' });
    expect(await store.conflict(guide)).toBe(true);
    await expect(store.publish(guide, ready, lease)).rejects.toThrow('EXISTING_POST_REQUIRES_LINK');
    expect((await db.doc(`mccheyne_publish_sources/${ready.id}`).get()).exists).toBe(false);
    await db.doc('posts/manual').set({ category: 'today_word', createdAt: Timestamp.fromDate(new Date('2027-12-02T15:00:00Z')), content: '수동 글' });
    expect(await store.conflict(guide)).toBe(true);
  });
  it('denies direct client access to approvals and leases, including admin clients', async () => {
    for (const context of [env.unauthenticatedContext(), env.authenticatedContext('fixture-admin', { email: 'crushidea@gmail.com', email_verified: true })]) {
      for (const collection of [STATE_COLLECTION, CONTROL_COLLECTION]) {
        await assertFails(context.firestore().doc(`${collection}/probe`).get());
        await assertFails(context.firestore().doc(`${collection}/probe`).set({ approvedHash: 'forged' }));
      }
    }
  });
  it('appears under the verified author and permits the existing client edit/delete flow with chunk cleanup', async () => {
    const lease = (await store.acquire(60_000))!; await store.save(ready, lease);
    const longGuide = { ...guide, content: '긴 본문 '.repeat(1000) };
    const id = await store.publish(longGuide, ready, lease);
    const client = env.authenticatedContext(MCCHEYNE_AUTHOR_UID, { email: MCCHEYNE_AUTHOR_EMAIL, email_verified: true }).firestore();
    const mine = await client.collection('posts').where('isPublished', '==', true).where('authorId', '==', MCCHEYNE_AUTHOR_UID).orderBy('createdAt', 'desc').limit(20).get();
    expect(mine.docs.map(d => d.id)).toContain(id);
    expect((await client.doc(`posts/${id}`).get()).data()?.authorName).toBe('이종구');
    await holdSitePost(id, 'edit', MCCHEYNE_AUTHOR_UID);
    await client.doc(`posts/${id}`).update({ title: '홈페이지 수정', content: '직접 수정한 본문', isLongContent: false, fullContentLength: 0 });
    const chunks = await client.collection('post_contents').where('postId', '==', id).get();
    expect(chunks.size).toBeGreaterThan(0); for (const c of chunks.docs) await c.ref.delete();
    await expect(store.publish(longGuide, ready, lease)).rejects.toThrow('SITE_POST_EDITED');
    expect((await db.doc(`posts/${id}`).get()).data()?.content).toBe('직접 수정한 본문');
    expect((await store.siteState(ready.id)).code).toBe('SITE_POST_EDITED');
    await holdSitePost(id, 'delete', MCCHEYNE_AUTHOR_UID); await client.doc(`posts/${id}`).delete();
    await expect(store.publish(longGuide, ready, lease)).rejects.toThrow('SITE_POST_DELETED');
    expect((await db.doc(`posts/${id}`).get()).exists).toBe(false);
    expect((await db.collection('post_contents').where('postId', '==', id).get()).empty).toBe(true);
    expect((await db.doc(`mccheyne_publish_sources/${ready.id}`).get()).exists).toBe(true);
  });
  it('holds out-of-band edits/deletion and requires a fresh site version for explicit reapproval', async () => {
    const lease = (await store.acquire(60_000))!; await store.save(ready, lease);
    const id = await store.publish(guide, ready, lease);
    await db.doc(`posts/${id}`).update({ content: '수동 변경 1' });
    const first = await store.siteState(ready.id); expect(first.code).toBe('SITE_POST_EDITED');
    const approved = { ...ready, approvedSiteVersion: first.version };
    await store.save(approved, lease);
    await db.doc(`posts/${id}`).update({ content: '미리보기 후 변경 2' });
    await expect(store.publish(guide, approved, lease)).rejects.toThrow('SITE_POST_EDITED');
    await db.doc(`posts/${id}`).delete();
    const deleted = await store.siteState(ready.id); expect(deleted.code).toBe('SITE_POST_DELETED');
    const reapproved = { ...ready, approvedSiteVersion: deleted.version };
    await store.save(reapproved, lease); const replacement = await store.publish(guide, reapproved, lease);
    expect(replacement).not.toBe(id); expect((await db.doc(`posts/${replacement}`).get()).exists).toBe(true);
    expect(await store.siteState(ready.id)).toEqual({});
    expect((await store.load(ready.id))?.approvedSiteVersion).toBeUndefined();
  });
  it('manual holds remain effective when racing an automatic publish and do not affect unrelated manual posts', async () => {
    const lease = (await store.acquire(60_000))!; await store.save(ready, lease);
    const id = await store.publish(guide, ready, lease);
    const newer = { ...ready, version: '2', sourceHash: 'b'.repeat(64), approvedHash: 'b'.repeat(64) };
    await store.save(newer, lease);
    await Promise.allSettled([store.publish({ ...guide, content: '새 자동 내용' }, newer, lease), holdSitePost(id, 'edit', MCCHEYNE_AUTHOR_UID)]);
    expect((await store.siteState(ready.id)).code).toBe('SITE_POST_EDITED');
    await expect(store.publish(guide, newer, lease)).rejects.toThrow('SITE_POST_EDITED');
    expect(await holdSitePost('template', 'delete', MCCHEYNE_AUTHOR_UID)).toEqual({ managed: false });
  });
});
