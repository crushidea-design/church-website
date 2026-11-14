import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { Firestore } from 'firebase/firestore';
import firebaseCompat from 'firebase/compat/app';
import 'firebase/compat/firestore';
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

  it('lets anyone read the Sunday school catalog but only next-generation pastors write it', async () => {
    const paths = ['next_generation_school_terms/t1', 'next_generation_school_curriculum/2027-01-03', 'next_generation_school_classes/seed'];
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      for (const path of paths) await db.doc(path).set({ name: 'seed' });
      await db.doc('next_generation_members/teacher').set({ role: 'member', department: '교사' });
      await db.doc('next_generation_members/pastor').set({ role: 'member', isNextGenerationAdmin: true });
    });
    const anon = env.unauthenticatedContext().firestore();
    const teacher = env.authenticatedContext('teacher').firestore();
    const pastor = env.authenticatedContext('pastor').firestore();
    const admin = env.authenticatedContext('admin', { email: 'crushidea@gmail.com', email_verified: true }).firestore();
    for (const path of paths) {
      await assertSucceeds(anon.doc(path).get());
      await assertFails(anon.doc(path).set({ name: 'x' }));
      await assertFails(teacher.doc(path).set({ name: 'x' }));
      await assertSucceeds(pastor.doc(path).set({ name: 'by-pastor' }));
      await assertSucceeds(admin.doc(path).set({ name: 'by-admin' }));
    }
  });

  it('hides attachments of private next-generation posts like the post itself', async () => {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      const post = { category: 'next_generation', title: 't', content: 'c', authorId: 'author' };
      await db.doc('posts/publicPost').set({ ...post, isPublished: true });
      await db.doc('posts/privatePost').set({ ...post, isPublished: false });
      await db.doc('next_generation_post_files/publicPost').set({ postId: 'publicPost', pdfUrl: 'https://example.com/a.pdf' });
      await db.doc('next_generation_post_files/privatePost').set({ postId: 'privatePost', pdfUrl: 'https://example.com/b.pdf' });
      await db.doc('next_generation_members/ngPastor').set({ role: 'member', isNextGenerationAdmin: true });
      await db.doc('next_generation_members/ngMember').set({ role: 'member', department: '학부모' });
    });
    const guest = env.unauthenticatedContext().firestore();
    const member = env.authenticatedContext('ngMember').firestore();
    const pastor = env.authenticatedContext('ngPastor').firestore();
    const author = env.authenticatedContext('author').firestore();

    await assertSucceeds(guest.doc('next_generation_post_files/publicPost').get());
    await assertFails(guest.doc('next_generation_post_files/privatePost').get());
    await assertFails(member.doc('next_generation_post_files/privatePost').get());
    await assertSucceeds(pastor.doc('next_generation_post_files/privatePost').get());
    await assertSucceeds(author.doc('next_generation_post_files/privatePost').get());
    await assertFails(guest.collection('next_generation_post_files').get());
  });

  it('lets a student request a class at sign-up but not assign one', async () => {
    const signup = (uid: string, extra: Record<string, unknown>) => ({
      uid, email: `${uid}@example.com`, displayName: '학생', role: 'pending',
      department: '학생', departments: ['학생'], primaryDepartment: '학생',
      church: '한우리교회', intro: '', provider: 'email', createdAt: new Date(), ...extra,
    });
    const requester = env.authenticatedContext('requester').firestore();
    const selfAssigner = env.authenticatedContext('selfAssigner').firestore();

    await assertSucceeds(requester.doc('next_generation_members/requester')
      .set(signup('requester', { roleProfiles: { student: { requestedGroupId: 'seum' } } })));
    await assertFails(selfAssigner.doc('next_generation_members/selfAssigner')
      .set(signup('selfAssigner', { groupId: 'seum' })));
  });

  it('lets teachers read only the student member docs of their own class', async () => {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await db.doc('next_generation_members/teacher').set({ role: 'member', department: '교사', departments: ['교사'], groupIds: ['seum'] });
      await db.doc('next_generation_members/noClassTeacher').set({ role: 'member', department: '교사', departments: ['교사'] });
      await db.doc('next_generation_members/student').set({ role: 'member', department: '학생', departments: ['학생'], groupId: 'seum' });
      await db.doc('next_generation_members/otherStudent').set({ role: 'member', department: '학생', departments: ['학생'], groupId: 'didim' });
      await db.doc('next_generation_members/unassigned').set({ role: 'member', department: '학생', departments: ['학생'] });
    });
    const teacher = env.authenticatedContext('teacher').firestore();
    const noClassTeacher = env.authenticatedContext('noClassTeacher').firestore();
    const student = env.authenticatedContext('student').firestore();

    await assertSucceeds(teacher.doc('next_generation_members/student').get());
    await assertSucceeds(teacher.collection('next_generation_members')
      .where('role', '==', 'member').where('departments', 'array-contains', '학생').where('groupId', 'in', ['seum']).get());
    await assertFails(teacher.doc('next_generation_members/otherStudent').get());
    await assertFails(teacher.doc('next_generation_members/unassigned').get());
    await assertFails(teacher.collection('next_generation_members').where('departments', 'array-contains', '학생').get());
    await assertFails(noClassTeacher.doc('next_generation_members/student').get());
    await assertFails(student.doc('next_generation_members/otherStudent').get());
  });

  it('lets a linked parent read the child member doc, and nobody else unlinked', async () => {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await db.doc('next_generation_members/kid').set({ role: 'member', department: '학생', departments: ['학생'], groupId: 'seum' });
      await db.doc('next_generation_members/linkedParent').set({ role: 'member', department: '학부모', departments: ['학부모'], childIds: ['kid'] });
      await db.doc('next_generation_members/unlinkedParent').set({ role: 'member', department: '학부모', departments: ['학부모'], childIds: ['someoneElse'] });
      await db.doc('next_generation_members/noChildrenParent').set({ role: 'member', department: '학부모', departments: ['학부모'] });
      await db.doc('next_generation_members/pendingParent').set({ role: 'pending', department: '학부모', departments: ['학부모'], childIds: ['kid'] });
    });
    await assertSucceeds(env.authenticatedContext('linkedParent').firestore().doc('next_generation_members/kid').get());
    await assertFails(env.authenticatedContext('unlinkedParent').firestore().doc('next_generation_members/kid').get());
    await assertFails(env.authenticatedContext('noChildrenParent').firestore().doc('next_generation_members/kid').get());
    await assertFails(env.authenticatedContext('pendingParent').firestore().doc('next_generation_members/kid').get());
    await assertFails(env.unauthenticatedContext().firestore().doc('next_generation_members/kid').get());
    // the link grants only that child's doc, not other members
    await assertFails(env.authenticatedContext('linkedParent').firestore().doc('next_generation_members/unlinkedParent').get());
  });

  it('keeps parent and student journey date checks from overwriting each other', async () => {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await db.doc('next_generation_members/student').set({ role: 'member', department: '학생', departments: ['학생'], groupId: 'seum' });
      await db.doc('next_generation_members/parent').set({ role: 'member', department: '학부모', departments: ['학부모'], childIds: ['student'] });
    });
    const { FieldValue } = firebaseCompat.firestore;
    const fields = (kind: 'worship' | 'practice', date: string, checked: boolean, by: string) => ({
      weekKey: '2027-03-14', studentUid: 'student', studentName: '학생', classId: 'seum',
      [kind === 'worship' ? 'familyWorshipDates' : 'practiceDates']: checked ? FieldValue.arrayUnion(date) : FieldValue.arrayRemove(date),
      [kind === 'worship' ? 'practiceDates' : 'familyWorshipDates']: FieldValue.arrayUnion(),
      updatedBy: by, updatedAt: new Date(),
    });
    const path = 'next_generation_school_journey/2027-03-14_student';
    const student = env.authenticatedContext('student').firestore();
    const parent = env.authenticatedContext('parent').firestore();
    // first write creates the document (merge), later writes touch only their own list
    await assertSucceeds(parent.doc(path).set(fields('worship', '2027-03-15', true, 'parent'), { merge: true }));
    await assertSucceeds(student.doc(path).set(fields('practice', '2027-03-16', true, 'student'), { merge: true }));
    await assertSucceeds(parent.doc(path).set(fields('worship', '2027-03-17', true, 'parent'), { merge: true }));
    await assertSucceeds(student.doc(path).set(fields('practice', '2027-03-16', false, 'student'), { merge: true }));
    const data = (await student.doc(path).get()).data()!;
    expect(data.familyWorshipDates).toEqual(['2027-03-15', '2027-03-17']);
    expect(data.practiceDates).toEqual([]);
  });

  it('lets class teachers write the Sunday school weekly record and limits who can read it', async () => {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await db.doc('next_generation_members/teacher').set({ role: 'member', department: '교사', departments: ['교사'], groupIds: ['seum'] });
      await db.doc('next_generation_members/otherTeacher').set({ role: 'member', department: '교사', departments: ['교사'], groupIds: ['didim'] });
      await db.doc('next_generation_members/student').set({ role: 'member', department: '학생', departments: ['학생'], groupId: 'seum' });
      await db.doc('next_generation_members/parent').set({ role: 'member', department: '학부모', departments: ['학부모'], childIds: ['student'] });
      await db.doc('next_generation_members/pastor').set({ role: 'member', isNextGenerationAdmin: true });
      await db.doc('next_generation_school_weekly/2027-03-07_student').set({
        weekKey: '2027-03-07', studentUid: 'student', studentName: '학생', classId: 'seum', promise: '기도하기', updatedBy: 'teacher', updatedAt: new Date(),
      });
    });
    const record = (overrides: Record<string, unknown> = {}) => ({
      weekKey: '2027-03-14', studentUid: 'student', studentName: '학생', classId: 'seum', promise: '아침에 동생에게 인사하기',
      memoryChecked: true, memoryQuestion: 3, updatedBy: 'teacher', updatedAt: new Date(), ...overrides,
    });
    const teacher = env.authenticatedContext('teacher').firestore();
    const otherTeacher = env.authenticatedContext('otherTeacher').firestore();
    const student = env.authenticatedContext('student').firestore();
    const parent = env.authenticatedContext('parent').firestore();
    const pastor = env.authenticatedContext('pastor').firestore();

    await assertSucceeds(teacher.doc('next_generation_school_weekly/2027-03-14_student').set(record()));
    await assertSucceeds(teacher.doc('next_generation_school_weekly/2027-03-14_student').get());
    await assertSucceeds(teacher.doc('next_generation_school_weekly/2027-03-14_student').set(record({ promise: '밤에 부모님께 감사하기' })));
    await assertSucceeds(pastor.doc('next_generation_school_weekly/2027-03-14_student').get());
    await assertSucceeds(student.doc('next_generation_school_weekly/2027-03-14_student').get());
    await assertSucceeds(parent.doc('next_generation_school_weekly/2027-03-14_student').get());

    await assertFails(otherTeacher.doc('next_generation_school_weekly/2027-03-14_student').get());
    await assertFails(otherTeacher.doc('next_generation_school_weekly/2027-03-21_student').set(record({ weekKey: '2027-03-21', updatedBy: 'otherTeacher' })));
    await assertFails(otherTeacher.doc('next_generation_school_weekly/2027-03-14_student').set(record({ updatedBy: 'otherTeacher' })));
    await assertFails(student.doc('next_generation_school_weekly/2027-03-14_student').set(record({ updatedBy: 'student' })));
    await assertFails(parent.doc('next_generation_school_weekly/2027-03-14_student').set(record({ updatedBy: 'parent' })));
    await assertFails(teacher.doc('next_generation_school_weekly/2027-03-21_student').set(record({ weekKey: '2027-03-21', extra: 'x' })));
    await assertFails(teacher.doc('next_generation_school_weekly/2027-03-21_student').set(record({ weekKey: '2027-03-21', promise: 'ㅇ'.repeat(201) })));
    await assertFails(teacher.doc('next_generation_school_weekly/2027-03-21_student').set(record({ weekKey: '2027-03-21', classId: 'other' })));
    await assertFails(teacher.doc('next_generation_school_weekly/2027-03-21_student').set(record({ weekKey: '2027-03-21', memoryChecked: 'yes' })));
    await assertFails(teacher.doc('next_generation_school_weekly/wrong-id').set(record({ weekKey: '2027-03-21' })));
    await assertSucceeds(teacher.doc('next_generation_school_weekly/2027-03-21_student').set(record({ weekKey: '2027-03-21', promise: 'ㅇ'.repeat(200) })));
    await assertFails(teacher.doc('next_generation_school_weekly/2027-03-21_student').delete());
    await assertSucceeds(pastor.doc('next_generation_school_weekly/2027-03-21_student').delete());
  });

  it('lets students and their parents write the Sunday school journey and limits who can read it', async () => {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await db.doc('next_generation_members/teacher').set({ role: 'member', department: '교사', departments: ['교사'], groupIds: ['seum'] });
      await db.doc('next_generation_members/otherTeacher').set({ role: 'member', department: '교사', departments: ['교사'], groupIds: ['didim'] });
      await db.doc('next_generation_members/student').set({ role: 'member', department: '학생', departments: ['학생'], groupId: 'seum' });
      await db.doc('next_generation_members/parent').set({ role: 'member', department: '학부모', departments: ['학부모'], childIds: ['student'] });
      await db.doc('next_generation_members/proxyParent').set({ role: 'member', department: '학부모', departments: ['학부모'] });
      await db.doc('next_generation_members/strangerParent').set({ role: 'member', department: '학부모', departments: ['학부모'], childIds: ['someoneElse'] });
      await db.doc('next_generation_members/pastor').set({ role: 'member', isNextGenerationAdmin: true });
      await db.doc('next_generation_children/proxyKid').set({ kind: 'proxy', displayName: '대리', groupId: 'seed', parentUids: ['proxyParent'] });
      await db.doc('next_generation_attendance/2027-03-14_proxyKid').set({
        weekKey: '2027-03-14', sundayDate: '2027-03-14', studentUid: 'proxyKid', studentName: '대리', groupId: 'seed', present: true, checkedBy: 'pastor',
      });
      await db.doc('next_generation_school_weekly/2027-03-14_proxyKid').set({
        weekKey: '2027-03-14', studentUid: 'proxyKid', studentName: '대리', classId: 'seed', updatedBy: 'pastor', updatedAt: new Date(),
      });
    });
    const journey = (overrides: Record<string, unknown> = {}) => ({
      weekKey: '2027-03-14', studentUid: 'student', studentName: '학생', classId: 'seum',
      familyWorshipDates: ['2027-03-15'], practiceDates: ['2027-03-15', '2027-03-16'], updatedBy: 'student', updatedAt: new Date(), ...overrides,
    });
    const path = 'next_generation_school_journey/2027-03-14_student';
    const student = env.authenticatedContext('student').firestore();
    const parent = env.authenticatedContext('parent').firestore();
    const proxyParent = env.authenticatedContext('proxyParent').firestore();
    const strangerParent = env.authenticatedContext('strangerParent').firestore();
    const teacher = env.authenticatedContext('teacher').firestore();
    const otherTeacher = env.authenticatedContext('otherTeacher').firestore();
    const pastor = env.authenticatedContext('pastor').firestore();
    const anon = env.unauthenticatedContext().firestore();

    // student and linked parent write; both update and read
    await assertSucceeds(student.doc(path).set(journey()));
    await assertSucceeds(parent.doc(path).set(journey({ updatedBy: 'parent', familyWorshipDates: ['2027-03-15', '2027-03-17'] })));
    await assertSucceeds(student.doc(path).get());
    await assertSucceeds(parent.doc(path).get());
    await assertSucceeds(pastor.doc(path).get());
    // teacher of the class reads (query by class and week), cannot write
    await assertSucceeds(teacher.doc(path).get());
    await assertSucceeds(teacher.collection('next_generation_school_journey').where('classId', '==', 'seum').where('weekKey', '==', '2027-03-14').get());
    await assertFails(teacher.doc(path).set(journey({ updatedBy: 'teacher' })));
    await assertFails(teacher.doc('next_generation_school_journey/2027-03-21_student').set(journey({ weekKey: '2027-03-21', updatedBy: 'teacher' })));
    // others cannot read or write
    await assertFails(otherTeacher.doc(path).get());
    await assertFails(strangerParent.doc(path).get());
    await assertFails(strangerParent.doc(path).set(journey({ updatedBy: 'strangerParent' })));
    await assertFails(proxyParent.doc(path).set(journey({ updatedBy: 'proxyParent' })));
    await assertFails(anon.doc(path).get());
    // shape checks
    const next = 'next_generation_school_journey/2027-03-21_student';
    await assertFails(student.doc(next).set(journey({ weekKey: '2027-03-21', extra: 'x' })));
    await assertFails(student.doc(next).set(journey({ weekKey: '2027-03-21', classId: 'other' })));
    await assertFails(student.doc(next).set(journey({ weekKey: '2027-03-21', updatedBy: 'parent' })));
    await assertFails(student.doc(next).set(journey({ weekKey: '2027-03-21', familyWorshipDates: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] })));
    await assertFails(student.doc(next).set(journey({ weekKey: '2027-03-21', practiceDates: 'x' })));
    await assertFails(student.doc(next).set(journey({ weekKey: 'not-a-date' })));
    await assertFails(student.doc('next_generation_school_journey/wrong-id').set(journey({ weekKey: '2027-03-21' })));
    await assertFails(student.doc(next).set(journey({ weekKey: '2027-03-21', studentUid: 'someoneElse' })));
    await assertFails(student.doc(path).set(journey({ weekKey: '2027-03-21' })));
    await assertSucceeds(student.doc(next).set(journey({ weekKey: '2027-03-21', familyWorshipDates: [], practiceDates: [] })));
    // delete: pastor only
    await assertFails(student.doc(next).delete());
    await assertFails(parent.doc(next).delete());
    await assertSucceeds(pastor.doc(next).delete());

    // proxy child: the parent listed in next_generation_children.parentUids writes and reads
    const proxyPath = 'next_generation_school_journey/2027-03-14_proxyKid';
    const proxyJourney = journey({ studentUid: 'proxyKid', studentName: '대리', classId: 'seed', updatedBy: 'proxyParent' });
    await assertSucceeds(proxyParent.doc(proxyPath).set(proxyJourney));
    await assertSucceeds(proxyParent.doc(proxyPath).get());
    await assertSucceeds(proxyParent.collection('next_generation_school_journey').where('studentUid', '==', 'proxyKid').where('weekKey', 'in', ['2027-03-14']).get());
    await assertFails(parent.doc(proxyPath).get());
    await assertFails(strangerParent.doc(proxyPath).set(proxyJourney));
    // proxy parent can also read that child's attendance and weekly record
    await assertSucceeds(proxyParent.collection('next_generation_attendance').where('studentUid', '==', 'proxyKid').get());
    await assertSucceeds(proxyParent.collection('next_generation_school_weekly').where('studentUid', '==', 'proxyKid').get());
    await assertFails(strangerParent.collection('next_generation_attendance').where('studentUid', '==', 'proxyKid').get());
  });

  it('lets students and parents write the yearly Bible reading and limits who can read it', async () => {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await db.doc('next_generation_members/teacher').set({ role: 'member', department: '교사', departments: ['교사'], groupIds: ['seum'] });
      await db.doc('next_generation_members/otherTeacher').set({ role: 'member', department: '교사', departments: ['교사'], groupIds: ['didim'] });
      await db.doc('next_generation_members/student').set({ role: 'member', department: '학생', departments: ['학생'], groupId: 'seum' });
      await db.doc('next_generation_members/parent').set({ role: 'member', department: '학부모', departments: ['학부모'], childIds: ['student'] });
      await db.doc('next_generation_members/proxyParent').set({ role: 'member', department: '학부모', departments: ['학부모'] });
      await db.doc('next_generation_members/strangerParent').set({ role: 'member', department: '학부모', departments: ['학부모'], childIds: ['someoneElse'] });
      await db.doc('next_generation_members/pastor').set({ role: 'member', isNextGenerationAdmin: true });
      await db.doc('next_generation_children/proxyKid').set({ kind: 'proxy', displayName: '대리', groupId: 'didim', parentUids: ['proxyParent'] });
    });
    const reading = (overrides: Record<string, unknown> = {}) => ({
      year: 2027, studentUid: 'student', studentName: '학생', classId: 'seum', chaptersRead: 26,
      log: [{ date: '2027-01-02', to: 26 }], updatedBy: 'student', updatedAt: new Date(), ...overrides,
    });
    const path = 'next_generation_bible_reading_year/2027_student';
    const student = env.authenticatedContext('student').firestore();
    const parent = env.authenticatedContext('parent').firestore();
    const proxyParent = env.authenticatedContext('proxyParent').firestore();
    const strangerParent = env.authenticatedContext('strangerParent').firestore();
    const teacher = env.authenticatedContext('teacher').firestore();
    const otherTeacher = env.authenticatedContext('otherTeacher').firestore();
    const pastor = env.authenticatedContext('pastor').firestore();
    const anon = env.unauthenticatedContext().firestore();

    // student and linked parent write; both read; pastor reads
    await assertSucceeds(student.doc(path).set(reading()));
    await assertSucceeds(parent.doc(path).set(reading({ updatedBy: 'parent', chaptersRead: 30, log: [{ date: '2027-01-02', to: 26 }, { date: '2027-01-03', to: 30 }] })));
    await assertSucceeds(student.doc(path).get());
    await assertSucceeds(parent.doc(path).get());
    await assertSucceeds(pastor.doc(path).get());
    await assertSucceeds(student.collection('next_generation_bible_reading_year').where('studentUid', '==', 'student').where('year', '==', 2027).get());
    // teacher of the class reads (query by class and year), cannot write
    await assertSucceeds(teacher.doc(path).get());
    await assertSucceeds(teacher.collection('next_generation_bible_reading_year').where('classId', '==', 'seum').where('year', '==', 2027).get());
    await assertFails(teacher.doc(path).set(reading({ updatedBy: 'teacher' })));
    // others cannot read or write
    await assertFails(otherTeacher.doc(path).get());
    await assertFails(strangerParent.doc(path).get());
    await assertFails(strangerParent.doc(path).set(reading({ updatedBy: 'strangerParent' })));
    await assertFails(proxyParent.doc(path).set(reading({ updatedBy: 'proxyParent' })));
    await assertFails(anon.doc(path).get());
    // shape checks
    const next = 'next_generation_bible_reading_year/2028_student';
    await assertFails(student.doc(next).set(reading({ year: 2028, extra: 'x' })));
    await assertFails(student.doc(next).set(reading({ year: 2028, classId: 'other' })));
    await assertFails(student.doc(next).set(reading({ year: 2028, updatedBy: 'parent' })));
    await assertFails(student.doc(next).set(reading({ year: 2028, chaptersRead: 1190 })));
    await assertFails(student.doc(next).set(reading({ year: 2028, chaptersRead: -1 })));
    await assertFails(student.doc(next).set(reading({ year: 2028, chaptersRead: 1.5 })));
    await assertFails(student.doc(next).set(reading({ year: 2028, chaptersRead: '26' })));
    await assertFails(student.doc(next).set(reading({ year: '2028' })));
    await assertFails(student.doc(next).set(reading({ year: 2028, log: 'x' })));
    await assertFails(student.doc(next).set(reading({ year: 2028, log: Array.from({ length: 401 }, () => ({ date: '2027-01-02', to: 1 })) })));
    await assertFails(student.doc('next_generation_bible_reading_year/wrong-id').set(reading({ year: 2028 })));
    await assertFails(student.doc(next).set(reading({ year: 2028, studentUid: 'someoneElse' })));
    await assertFails(student.doc(path).set(reading({ year: 2028 })));
    await assertSucceeds(student.doc(next).set(reading({ year: 2028, chaptersRead: 0, log: [] })));
    await assertSucceeds(student.doc(next).set(reading({ year: 2028, chaptersRead: 1189, log: Array.from({ length: 400 }, () => ({ date: '2028-01-02', to: 1189 })) })));
    // delete: pastor only
    await assertFails(student.doc(next).delete());
    await assertFails(parent.doc(next).delete());
    await assertSucceeds(pastor.doc(next).delete());

    // proxy child (디딤): the parent in next_generation_children.parentUids writes and reads
    const proxyPath = 'next_generation_bible_reading_year/2027_proxyKid';
    await assertSucceeds(proxyParent.doc(proxyPath).set(reading({ studentUid: 'proxyKid', studentName: '대리', classId: 'didim', updatedBy: 'proxyParent' })));
    await assertSucceeds(proxyParent.collection('next_generation_bible_reading_year').where('studentUid', '==', 'proxyKid').where('year', '==', 2027).get());
    await assertFails(parent.doc(proxyPath).get());
    await assertFails(strangerParent.doc(proxyPath).set(reading({ studentUid: 'proxyKid', updatedBy: 'strangerParent' })));
  });

  it('accepts only boolean period2 and publicWorship on attendance', async () => {
    await env.withSecurityRulesDisabled(async context => {
      await context.firestore().doc('next_generation_members/teacher').set({ role: 'member', department: '교사', departments: ['교사'], groupIds: ['seum'] });
    });
    const teacher = env.authenticatedContext('teacher').firestore();
    const attendance = (overrides: Record<string, unknown> = {}) => ({
      weekKey: '2027-03-14', sundayDate: '2027-03-14', studentUid: 'student', studentName: '학생', groupId: 'seum',
      present: true, checkedBy: 'teacher', checkedAt: new Date(), ...overrides,
    });
    await assertSucceeds(teacher.doc('next_generation_attendance/2027-03-14_student').set(attendance()));
    await assertSucceeds(teacher.doc('next_generation_attendance/2027-03-14_student').set(attendance({ period2: true, publicWorship: false })));
    await assertFails(teacher.doc('next_generation_attendance/2027-03-21_student').set(attendance({ weekKey: '2027-03-21', period2: 'yes' })));
    await assertFails(teacher.doc('next_generation_attendance/2027-03-21_student').set(attendance({ weekKey: '2027-03-21', publicWorship: 1 })));
    await assertFails(teacher.doc('next_generation_attendance/2027-03-21_student').set(attendance({ weekKey: '2027-03-21', unknown: true })));
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
