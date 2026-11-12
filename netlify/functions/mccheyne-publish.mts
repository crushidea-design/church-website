import type { Config } from '@netlify/functions';
import { getEnv, jsonResponse } from './_shared/firebase-admin.mjs';
import { isAuthorized } from './_shared/mccheyne-publish-core.mjs';
import { publishGuide } from './_shared/mccheyne-publish-service.mjs';

export default async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  if (!isAuthorized(req.headers.get('authorization'), getEnv('MCCHEYNE_PUBLISH_KEY'))) {
    return jsonResponse({ ok: false, error: 'UNAUTHORIZED' }, 401);
  }
  const body: unknown = await req.json().catch(() => undefined);
  if (body === undefined) return jsonResponse({ ok: false, error: 'INVALID_JSON' }, 400);
  return publishGuide(body);
};

export const config: Config = { path: '/api/mccheyne/publish' };
