import { getAuth } from 'firebase-admin/auth';
import { initializeApp } from 'firebase-admin/app';
import express from 'express';
import { createServer } from 'vite';
import { createFixtureRest } from './fixture-rest';

// Fail closed: this runner must never seed a real Firebase project.
for (const name of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST']) {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env[name] || '')) throw new Error(`Local emulator required: ${name}`);
}
process.env.GCLOUD_PROJECT = 'demo-church-review';
process.env.VITE_FIREBASE_EMULATORS = 'true';
process.env.SUPABASE_URL = 'http://127.0.0.1:54399';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-fixture';
process.env.RAAH_ENCRYPTION_SECRET = 'test-only-encryption-secret';
delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
delete process.env.GEMINI_API_KEY;
delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;

initializeApp({ projectId: 'demo-church-review', storageBucket: 'demo-church-review.appspot.com' });
const { getAppDb } = await import('../../netlify/functions/_shared/firebase-admin.mts');
const { registerLocalRoutes } = await import('../../netlify/functions/_shared/local-routes');
const db = getAppDb();
const roles = [
  { uid: 'test-admin', name: '테스트 관리자', role: 'admin', department: '교사', ngAdmin: true },
  { uid: 'test-member', name: '테스트 일반회원', role: 'regular', department: null, ngAdmin: false },
  { uid: 'test-teacher', name: '테스트 교사', role: 'regular', department: '교사', ngAdmin: false },
  { uid: 'test-parent', name: '테스트 학부모', role: 'regular', department: '학부모', ngAdmin: false },
];
for (const role of roles) {
  const email = `${role.uid}@example.test`;
  await getAuth().getUser(role.uid).catch(() => getAuth().createUser({ uid: role.uid, email, password: 'Test-only-2026!', displayName: role.name, emailVerified: true }));
  await db.doc(`users/${role.uid}`).set({ uid: role.uid, email, displayName: role.name, role: role.role, createdAt: new Date() });
  if (role.department) await db.doc(`next_generation_members/${role.uid}`).set({
    uid: role.uid, email, displayName: role.name, role: 'member', department: role.department,
    departments: [role.department], primaryDepartment: role.department, church: '테스트 교회', intro: '',
    provider: 'email', createdAt: new Date(), isNextGenerationAdmin: role.ngAdmin,
    groupIds: role.department === '교사' ? ['test-group'] : [], childIds: role.department === '학부모' ? ['test-child'] : [],
  });
}
await db.doc('next_generation_children/test-child').set({ kind: 'proxy', careType: 'parent_linked', displayName: '테스트 자녀', department: '유초등부', groupId: 'test-group', parentUids: ['test-parent'], assignedTeacherUids: ['test-teacher'], createdBy: 'test-parent', createdAt: new Date() });
await db.doc('next_generation_groups/test-group').set({ name: '테스트 반', label: '테스트 반', teacherUid: 'test-teacher', teacherUids: ['test-teacher'], department: '유초등부' });
await db.doc('posts/test-community').set({ title: '역할 검증용 게시글', content: '가상 데이터로 댓글과 첨부파일을 확인합니다.', category: 'community', authorId: 'test-admin', authorName: '테스트 관리자', createdAt: new Date(), commentCount: 0, isPublished: true });
const fixture = createFixtureRest();
fixture.tables.set('raah_members', [{ id: 'fixture-member', name: '테스트 성도', search_name: '테스트 성도', status: 'active', created_at: new Date().toISOString() }]);
const restServer = fixture.app.listen(54399, '127.0.0.1');
const app = express();
app.use(express.json());
registerLocalRoutes(app);
// Never forward unsupported APIs to production services during tests.
app.use('/api', (_req, res) => res.status(501).json({ error: 'External operation disabled in role preview' }));
const vite = await createServer({ envFile: false, server: { middlewareMode: true }, appType: 'spa' });
app.use(vite.middlewares);
const server = app.listen(3101, '127.0.0.1', () => console.info('Role preview ready: http://localhost:3101 (demo data only)'));
const shutdown = async () => { server.close(); restServer.close(); await vite.close(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
