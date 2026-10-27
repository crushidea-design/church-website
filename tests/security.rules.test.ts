import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { Firestore } from 'firebase/firestore';
import { ensureUserProfile } from '../src/lib/userProfile';

vi.mock('../netlify/functions/_shared/firebase-admin.mjs', async () => {
  const { initializeApp, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = getApps().find((app) => app.name === 'rules-integration') || initializeApp({ projectId: 'demo-church-review' }, 'rules-integration');
  return {
    initializeFirebaseAdmin: () => true,
    getAppDb: () => getFirestore(app),
    verifyRequestUser: async (req: Request) => ({ uid: req.headers.get('x-test-user') || 'owner', name: 'Test Member' }),
    jsonResponse: (data: unknown, status = 200) => new Response(JSON.stringify(data), { status }),
  };
});
import commentHandler from '../netlify/functions/post-comments.mts';
import { runScheduledJob } from '../netlify/functions/_shared/scheduled-job.mjs';
import { getAppDb } from '../netlify/functions/_shared/firebase-admin.mjs';
import { claimNotification } from '../netlify/functions/_shared/notification-claim.mjs';

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_STORAGE_EMULATOR_HOST);
describe.skipIf(!enabled)('deployed security rule contracts (emulators only)', () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-church-review',
      firestore: { rules: readFileSync('firestore.rules', 'utf8') },
      storage: { rules: readFileSync('storage.rules', 'utf8') },
    });
  });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.clearStorage();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      for (const uid of ['owner', 'other']) await db.doc(`users/${uid}`).set({ uid, email: `${uid}@example.com`, displayName: uid, role: 'regular', createdAt: new Date() });
      await db.doc('posts/post1').set({ title: 'Post', content: 'Body', category: 'community', isPublished: true, authorId: 'owner', authorName: 'Owner', createdAt: new Date(), commentCount: 0 });
      await context.storage().ref('pdfs/legacy.pdf').put(new Uint8Array([1]), { contentType: 'application/pdf' });
    });
  });
  afterAll(async () => { await env?.cleanup(); });

  it('keeps non-sermon drafts and their full content admin-only, including after unpublishing', async () => {
    const admin = env.authenticatedContext('admin', { email: 'crushidea@gmail.com', email_verified: true }).firestore();
    const readers = [env.unauthenticatedContext(), env.authenticatedContext('owner'), env.authenticatedContext('other')];
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await db.doc('posts/draft').set({ category: 'today_word', authorId: 'owner', isPublished: false });
      await db.doc('posts/published').set({ category: 'today_word', authorId: 'owner', isPublished: true });
      await db.doc('post_contents/draft_0').set({ postId: 'draft', index: 0, content: 'private draft' });
      await db.doc('post_contents/published_0').set({ postId: 'published', index: 0, content: 'published body' });
    });
    for (const context of readers) {
      const db = context.firestore();
      await assertFails(db.doc('posts/draft').get());
      await assertFails(db.doc('post_contents/draft_0').get());
      await assertFails(db.collection('post_contents').where('postId', '==', 'draft').get());
      await assertFails(db.collection('posts').where('category', '==', 'today_word').get());
      const publicPosts = await assertSucceeds(db.collection('posts').where('category', '==', 'today_word').where('isPublished', '==', true).get());
      expect(publicPosts.docs.map(doc => doc.id)).toEqual(['published']);
      await assertSucceeds(db.doc('post_contents/published_0').get());
    }
    await assertSucceeds(admin.doc('posts/draft').get());
    await assertSucceeds(admin.doc('post_contents/draft_0').get());
    await env.withSecurityRulesDisabled(context => context.firestore().doc('posts/published').update({ isPublished: false }));
    for (const context of readers) {
      await assertFails(context.firestore().doc('posts/published').get());
      await assertFails(context.firestore().doc('post_contents/published_0').get());
    }
    await assertSucceeds(admin.doc('posts/published').get());
  });

  it('requires legacy backfill and retains existing sermon membership restrictions', async () => {
    await env.withSecurityRulesDisabled(async context => {
      await context.firestore().doc('posts/legacy').set({ category: 'today_word', authorId: 'owner' });
      await context.firestore().doc('posts/sermon').set({ category: 'sermon', authorId: 'owner', isPublished: true });
    });
    await assertFails(env.unauthenticatedContext().firestore().doc('posts/legacy').get());
    await env.withSecurityRulesDisabled(context => context.firestore().doc('posts/legacy').update({ isPublished: true }));
    await assertSucceeds(env.unauthenticatedContext().firestore().doc('posts/legacy').get());
    await assertFails(env.unauthenticatedContext().firestore().doc('posts/sermon').get());
    await assertSucceeds(env.authenticatedContext('other').firestore().doc('posts/sermon').get());
  });

  it('denies stale summary snippets to public readers while retaining other public settings', async () => {
    await env.withSecurityRulesDisabled(async context => {
      await context.firestore().doc('settings/latest_posts_summary').set({ today_word: { id: 'draft', content: 'stale snippet' } });
      await context.firestore().doc('settings/church_info').set({ name: 'church' });
    });
    for (const context of [env.unauthenticatedContext(), env.authenticatedContext('other')]) {
      await assertFails(context.firestore().doc('settings/latest_posts_summary').get());
      await assertSucceeds(context.firestore().doc('settings/church_info').get());
    }
    await assertSucceeds(env.authenticatedContext('admin', { email: 'crushidea@gmail.com', email_verified: true }).firestore().doc('settings/latest_posts_summary').get());
  });

  it('allows uploads with the authenticated owner and blocks forged metadata', async () => {
    const owner = env.authenticatedContext('owner').storage();
    await assertSucceeds(Promise.resolve(owner.ref('pdfs/owned.pdf').put(new Uint8Array([1]), { contentType: 'application/pdf', customMetadata: { ownerUid: 'owner' } })));
    await assertFails(Promise.resolve(owner.ref('pdfs/forged.pdf').put(new Uint8Array([1]), { contentType: 'application/pdf', customMetadata: { ownerUid: 'other' } })));
    const other = env.authenticatedContext('other').storage();
    await assertFails(Promise.resolve(other.ref('pdfs/owned.pdf').put(new Uint8Array([2]), { contentType: 'application/pdf', customMetadata: { ownerUid: 'other' } })));
    await assertFails(other.ref('pdfs/owned.pdf').delete());
    await assertSucceeds(owner.ref('pdfs/owned.pdf').delete());
  });
  it('preserves old attachment reads but prevents arbitrary legacy deletion', async () => {
    await assertSucceeds(env.unauthenticatedContext().storage().ref('pdfs/legacy.pdf').getDownloadURL());
    await assertFails(env.authenticatedContext('other').storage().ref('pdfs/legacy.pdf').delete());
    await assertSucceeds(env.authenticatedContext('admin', { email: 'crushidea@gmail.com', email_verified: true }).storage().ref('pdfs/legacy.pdf').delete());
  });
  it('allows post editing but blocks independent counter manipulation and direct comment creation', async () => {
    const owner = env.authenticatedContext('owner').firestore();
    await assertSucceeds(owner.doc('posts/post1').update({ title: 'Edited' }));
    await assertFails(owner.doc('posts/post1').update({ commentCount: 1 }));
    await assertFails(env.authenticatedContext('other').firestore().doc('posts/post1').update({ commentCount: 1 }));
    await assertFails(owner.doc('comments/comment1').set({ postId: 'post1', authorId: 'owner', authorName: 'Owner', content: 'Comment', createdAt: new Date() }));
  });
  it('does not allow a member to promote their own role', async () => {
    await assertFails(env.authenticatedContext('other').firestore().doc('users/other').update({ role: 'admin' }));
    const unverified = env.authenticatedContext('other', { email: 'crushidea@gmail.com', email_verified: false }).firestore();
    await assertFails(unverified.doc('users/other').update({ role: 'admin' }));
    await assertFails(unverified.doc('settings/church_info').set({ introTitle1: 'Forged' }));
  });

  it('preserves existing membership on email login and creates a new profile once', async () => {
    const existing = env.authenticatedContext('owner').firestore();
    const before = (await existing.doc('users/owner').get()).data();
    await ensureUserProfile(existing as unknown as Firestore, { uid: 'owner', email: 'owner@example.com', displayName: 'Changed' });
    expect((await existing.doc('users/owner').get()).data()).toEqual(before);
    const fresh = env.authenticatedContext('fresh').firestore();
    const user = { uid: 'fresh', email: 'fresh@example.com', displayName: 'New Member' };
    await Promise.all([ensureUserProfile(fresh as unknown as Firestore, user), ensureUserProfile(fresh as unknown as Firestore, user)]);
    expect((await fresh.doc('users/fresh').get()).data()).toMatchObject({ uid: 'fresh', role: 'user', displayName: 'New Member' });
  });

  it('gives only one concurrent worker permission to send a scheduled notification', async () => {
    const db = getAppDb();
    const ref = db.collection('scheduled_notifications').doc('one');
    await ref.set({ status: 'pending', scheduledAt: new Date(0) });
    const claims = await Promise.all([claimNotification(db, ref), claimNotification(db, ref)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect((await ref.get()).data()?.status).toBe('processing');
    expect(await claimNotification(db, ref)).toBeNull();
  }, 15000); // Admin SDK initialization and transaction contention can exceed 5s locally.

  it('denies client access to scheduler ownership and run records, including admin clients', async () => {
    for (const context of [env.authenticatedContext('owner'), env.authenticatedContext('admin', { email: 'crushidea@gmail.com', email_verified: true })]) {
      const db = context.firestore();
      await assertFails(db.doc('_scheduler_control/jobs').set({ owners: { wordFruitAutoDraft: 'firebase' } }));
      await assertFails(db.doc('_scheduled_job_runs/test').set({ status: 'completed' }));
      await assertFails(db.doc('_scheduler_control/jobs').get());
      await assertFails(db.collection('_scheduled_job_runs').get());
    }
  });

  it('claims a scheduler slot once across concurrent providers and ownership changes', async () => {
    const db = getAppDb();
    const control = db.collection('_scheduler_control').doc('jobs');
    await control.set({ owners: { wordFruitAutoDraft: 'firebase' } });
    let calls = 0;
    const work = async () => { calls += 1; return Response.json({ ok: true }); };
    await Promise.all(Array.from({ length: 5 }, () => runScheduledJob('wordFruitAutoDraft', 'firebase', work)));
    await control.set({ owners: { wordFruitAutoDraft: 'netlify' } });
    await runScheduledJob('wordFruitAutoDraft', 'netlify', work);
    expect(calls).toBe(1);
    const records = await db.collection('_scheduled_job_runs').get();
    expect(records.size).toBe(1);
    expect(records.docs[0].data().status).toBe('completed');
  }, 15000);

  it('keeps comments and counts atomic across duplicate and concurrent requests', async () => {
    const call = (method: string, commentId: string, uid = 'owner') => commentHandler(new Request('https://example.test/api/post-comments', {
      method, headers: { 'x-test-user': uid }, body: JSON.stringify({ postId: 'post1', commentId, content: 'A comment' }),
    }));
    const responses = await Promise.all([call('POST', 'one'), call('POST', 'one'), call('POST', 'two')]);
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
    const db = env.authenticatedContext('owner').firestore();
    expect((await db.doc('posts/post1').get()).data()?.commentCount).toBe(2);
    expect((await db.collection('comments').where('authorId', '==', 'owner').get()).size).toBe(2);
    expect((await call('DELETE', 'one', 'other')).status).toBe(403);
    expect((await call('DELETE', 'one')).status).toBe(200);
    expect((await call('DELETE', 'one')).status).toBe(200);
    expect((await db.doc('posts/post1').get()).data()?.commentCount).toBe(1);
    expect((await db.collection('comments').where('authorId', '==', 'owner').get()).size).toBe(1);
  }, 15000);
});
