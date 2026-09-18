import assert from 'node:assert/strict';
import { ensureUserProfile } from '../../src/lib/userProfile';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFirestoreEmulator, collection, query, where, getDocs, doc, getDoc, getFirestore, updateDoc } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, ref, uploadBytes } from 'firebase/storage';

// Requires npm run test:roles. All addresses and accounts are local fixtures.
const sessions = await Promise.all(['admin', 'member', 'teacher', 'parent'].map(async (role) => {
  const app = initializeApp({ apiKey: 'demo-only-key', projectId: 'demo-church-review', storageBucket: 'demo-church-review.appspot.com' }, role);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8180);
  const storage = getStorage(app);
  connectStorageEmulator(storage, '127.0.0.1', 9299);
  const { user } = await signInWithEmailAndPassword(auth, `test-${role}@example.test`, 'Test-only-2026!');
  const token = await user.getIdToken();
  const api = (path: string, method = 'GET', body?: unknown) => fetch(`http://127.0.0.1:3101/api/${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { app, role, db, storage, api, user };
}));

try {
  const [admin, member, teacher, parent] = sessions;
  assert.equal((await fetch('http://127.0.0.1:3101/api/raah/notes')).status, 401);
  for (const session of sessions) {
    const profileRef = doc(session.db, `users/test-${session.role}`);
    const before = (await getDoc(profileRef)).data();
    await ensureUserProfile(session.db, session.user);
    assert.deepEqual((await getDoc(profileRef)).data(), before);
    assert.equal((await session.api('raah/notes')).status, session.role === 'admin' ? 200 : 403);
    assert.equal((await session.api('raah/bootstrap')).status, session.role === 'admin' ? 200 : 403);
    if (session.role !== 'admin') await assert.rejects(updateDoc(doc(session.db, `users/test-${session.role}`), { role: 'admin' }));
  }
  for (const session of [admin, teacher, parent]) assert.equal((await getDoc(doc(session.db, 'next_generation_children/test-child'))).exists(), true);
  await assert.rejects(getDoc(doc(member.db, 'next_generation_children/test-child')));
  assert.equal((await getDocs(query(collection(teacher.db, 'next_generation_children'), where('groupId', 'in', ['test-group'])))).size, 1);
  console.info('PASS: four roles, RAAH access, child access, self-promotion denied');

  const commentId = `smoke-${Date.now()}`;
  const comment = { postId: 'test-community', commentId, content: '가상 댓글 검증' };
  for (const response of await Promise.all([member.api('post-comments', 'POST', comment), member.api('post-comments', 'POST', comment)])) assert.equal(response.status, 200);
  assert.equal((await getDoc(doc(member.db, 'posts/test-community'))).data()?.commentCount, 1);
  assert.equal((await teacher.api('post-comments', 'DELETE', comment)).status, 403);
  assert.equal((await member.api('post-comments', 'DELETE', comment)).status, 200);
  assert.equal((await getDoc(doc(member.db, 'posts/test-community'))).data()?.commentCount, 0);
  console.info('PASS: authenticated comment create/retry/delete and counter');

  const path = `pdfs/smoke-${Date.now()}.pdf`;
  await uploadBytes(ref(member.storage, path), new Uint8Array([1]), { contentType: 'application/pdf', customMetadata: { ownerUid: 'test-member' } });
  assert.equal((await parent.api('attachments', 'DELETE', { path })).status, 403);
  assert.equal((await member.api('attachments', 'DELETE', { path })).status, 200);
  console.info('PASS: authenticated attachment upload and owner-only deletion');

  const note = { memberName: '가상 성도', date: '2026-09-17', meetingType: '방문', currentSituation: '가상 기록', encouragement: '가상 권면', prayerTopics: '가상 기도' };
  const created = await admin.api('raah/notes', 'POST', note);
  assert.equal(created.status, 201);
  const { note: saved } = await created.json();
  const detail = await admin.api(`raah/notes/${saved.id}`);
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).note.sensitive.currentSituation, note.currentSituation);
  assert.equal((await admin.api(`raah/notes/${saved.id}`, 'PATCH', { ...note, currentSituation: '수정한 가상 기록' })).status, 200);
  assert.equal((await admin.api(`raah/notes/${saved.id}`, 'DELETE')).status, 200);
  assert.equal((await admin.api('raah/ai-assist', 'POST', {})).status, 410);
  console.info('PASS: RAAH encrypted note CRUD through fixture REST, external AI disabled');
} finally {
  await Promise.all(sessions.map(({ app }) => deleteApp(app)));
}
