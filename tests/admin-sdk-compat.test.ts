import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';

describe('Admin SDK upgrade compatibility', () => {
  it('initializes modular services without credentials or network calls', async () => {
    const app = initializeApp({ projectId: 'demo-church-review', storageBucket: 'demo-church-review.appspot.com' }, 'sdk-compat');
    try {
      expect(typeof getAuth(app).verifyIdToken).toBe('function');
      expect(typeof getMessaging(app).sendEachForMulticast).toBe('function');
      expect(getStorage(app).bucket().name).toBe('demo-church-review.appspot.com');
      expect(getFirestore(app, 'named-database').databaseId).toBe('named-database');
      expect(FieldValue.serverTimestamp()).toBeDefined();
    } finally { await deleteApp(app); }
  });

  it('preserves Storage multipart boundaries with the scoped uuid patch', async () => {
    const require = createRequire(import.meta.url);
    const storageRequire = createRequire(require.resolve('@google-cloud/storage'));
    const { Gaxios } = storageRequire('gaxios');
    let contentType = '';
    let body = '';
    await new Gaxios().request({
      url: 'https://example.invalid/upload', method: 'POST',
      multipart: [{ headers: { 'Content-Type': 'application/json' }, content: '{"name":"fixture.pdf"}' }, { headers: { 'Content-Type': 'application/pdf' }, content: 'fixture bytes' }],
      adapter: async (options: { headers: Record<string, string>; body: AsyncIterable<Uint8Array> }) => {
        contentType = options.headers['Content-Type'];
        for await (const chunk of options.body) body += Buffer.from(chunk).toString();
        return { status: 200, statusText: 'OK', data: {}, headers: {}, config: options };
      },
    });
    const boundary = contentType.split('boundary=')[1];
    expect(boundary).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(body).toContain(`--${boundary}`);
    expect(body).toContain('fixture.pdf');
    expect(body).toContain('fixture bytes');
    expect(body).toContain(`--${boundary}--`);
  });
});
