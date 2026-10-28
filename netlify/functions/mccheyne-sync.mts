import type { Config } from '@netlify/functions';
import { initializeFirebaseAdmin, requireAdmin, jsonResponse } from './_shared/firebase-admin.mjs';
import { safeError } from './_shared/mccheyne-sync-core.mjs';
import { approveSource, executeSync, holdSitePost, previewSource, stopSync, syncStatus } from './_shared/mccheyne-sync-runtime.mjs';

export default async (req: Request) => {
  const respond = (body: unknown, status = 200) => { const r = jsonResponse(body, status); r.headers.set('Cache-Control', 'no-store'); return r; };
  if (!['GET', 'POST'].includes(req.method)) return respond({ code: 'METHOD_NOT_ALLOWED' }, 405);
  if (!req.headers.get('authorization')?.startsWith('Bearer ')) return respond({ code: 'AUTH_REQUIRED' }, 401);
  try {
    if (!initializeFirebaseAdmin()) return respond({ code: 'STORAGE_NOT_CONFIGURED' }, 503);
    let access;
    try { access = await requireAdmin(req); } catch { return respond({ code: 'AUTH_REQUIRED' }, 401); }
    if ('response' in access) { access.response.headers.set('Cache-Control', 'no-store'); return access.response; }
    if (req.method === 'GET') return respond(await syncStatus());
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return respond({ code: 'INVALID_REQUEST' }, 400);
    if (body.action === 'stop') return respond(await stopSync(access.decoded.uid));
    if (body.action === 'run') {
      if (body.cursor !== undefined && (typeof body.cursor !== 'string' || !/^[A-Za-z0-9_-]{10,200}$/.test(body.cursor))) return respond({ code: 'INVALID_REQUEST' }, 400);
      return respond(await executeSync(undefined, body.cursor));
    }
    if (typeof body.id !== 'string' || !/^[A-Za-z0-9_-]{10,200}$/.test(body.id)) return respond({ code: 'INVALID_ID' }, 400);
    if (body.action === 'manual-edit' || body.action === 'manual-delete') return respond(await holdSitePost(body.id, body.action === 'manual-edit' ? 'edit' : 'delete', access.decoded.uid));
    if (body.action === 'preview') return respond(await previewSource(body.id, typeof body.date === 'string' ? body.date : undefined));
    if (body.action === 'approve' && typeof body.sourceHash === 'string' && /^[a-f0-9]{64}$/.test(body.sourceHash) && typeof body.date === 'string') {
      if (body.siteVersion !== undefined && (typeof body.siteVersion !== 'string' || !/^[a-f0-9]{64}$/.test(body.siteVersion))) return respond({ code: 'INVALID_REQUEST' }, 400);
      return respond(await approveSource(body.id, body.sourceHash, body.date, access.decoded.uid, body.siteVersion));
    }
    return respond({ code: 'INVALID_REQUEST' }, 400);
  } catch (error) {
    const failure = safeError(error);
    return respond({ code: failure.code }, failure.global ? 503 : ['BUSY', 'SOURCE_CHANGED', 'EXISTING_POST_REQUIRES_LINK'].includes(failure.code) ? 409 : 400);
  }
};
export const config: Config = { path: '/api/mccheyne/sync' };
