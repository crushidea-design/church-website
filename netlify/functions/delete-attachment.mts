import { getApp } from 'firebase-admin/app';
import type { Config } from '@netlify/functions';
import { getStorage } from 'firebase-admin/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { getAppDb, initializeFirebaseAdmin, jsonResponse, verifyRequestUser } from './_shared/firebase-admin.mjs';

export default async (req: Request) => {
  if (req.method !== 'DELETE') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    if (!initializeFirebaseAdmin()) return jsonResponse({ error: 'Service unavailable' }, 503);
    const user = await verifyRequestUser(req).catch(() => null);
    if (!user) return jsonResponse({ error: 'Authentication required' }, 401);
    const data = await req.json().catch(() => null);
    const path = data?.path;
    if (typeof path !== 'string' || path.length > 1500 || !/^(pdfs|materials|sermons)\/.+/.test(path)) {
      return jsonResponse({ error: 'Invalid attachment path' }, 400);
    }
    const profile = await getAppDb().collection('users').doc(user.uid).get();
    const isAdmin = profile.data()?.role === 'admin' || (user.email === 'crushidea@gmail.com' && user.email_verified === true);
    const file = getStorage().bucket(getApp().options.storageBucket || firebaseConfig.storageBucket).file(path);
    const [metadata] = await file.getMetadata().catch((error) => {
      if (error.code === 404) return [null];
      throw error;
    });
    if (!metadata) return jsonResponse({ deleted: true });
    if (!isAdmin && metadata.metadata?.ownerUid !== user.uid) {
      // Legacy files lack trustworthy ownership. Preserve them; do not infer ownership
      // from a client-editable post URL, which could point at another person's file.
      return jsonResponse({ deleted: false, code: 'ATTACHMENT_OWNER_UNVERIFIED' }, 403);
    }
    await file.delete({ ignoreNotFound: true });
    return jsonResponse({ deleted: true });
  } catch {
    return jsonResponse({ error: 'Attachment deletion failed' }, 500);
  }
};

export const config: Config = { path: '/api/attachments' };
