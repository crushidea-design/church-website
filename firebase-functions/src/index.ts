import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { handleRequest, buildRouteTable, type HandlerModule } from './adapter.js';
import * as management from '../../netlify/functions/raah-management.mjs';
import * as communion from '../../netlify/functions/raah-communion.mjs';
import * as careTasks from '../../netlify/functions/raah-care-tasks.mjs';
import * as calendar from '../../netlify/functions/raah-calendar.mjs';
import * as aiAssist from '../../netlify/functions/raah-ai-assist.mjs';

const secrets = [
  defineSecret('RAAH_ENCRYPTION_SECRET'),
  defineSecret('SUPABASE_URL'),
  defineSecret('SUPABASE_SERVICE_ROLE_KEY'),
];
// Google Calendar OAuth settings are not secrets here: production keeps them in
// raah_calendar_oauth_settings, which raah-calendar reads when the env is unset.

// Non-secret feature flags. No default on purpose: a deploy without a value
// prompts (or fails in CI) instead of silently turning access enforcement off.
const accessEnforced = defineString('RAAH_ACCESS_ENFORCED');
const communionEnabled = defineString('RAAH_COMMUNION_ENABLED');

// The address users reach RAAH at; the function is only ever called on its behalf.
const PUBLIC_ORIGIN = 'https://raah.builttogether.church';

const routes = buildRouteTable([management, communion, careTasks, calendar, aiAssist] as unknown as HandlerModule[]);

export const raahApi = onRequest(
  {
    region: 'asia-northeast1',
    secrets,
    memory: '512MiB',
    timeoutSeconds: 60,
    invoker: 'public',
    // Normally reached same-origin through the Netlify proxy. The RAAH origin is
    // allowed so the pastor's own page can reach it directly (auth is the bearer
    // token, not cookies, so this adds no ambient authority).
    cors: ['https://raah.builttogether.church'],
  },
  async (req, res) => {
    // The handlers read settings from process.env (getEnv fallback); secrets are
    // already injected there, params from .env files/prompts are copied here.
    process.env.RAAH_ACCESS_ENFORCED = accessEnforced.value();
    process.env.RAAH_COMMUNION_ENABLED = communionEnabled.value();
    await handleRequest(routes, req, res, PUBLIC_ORIGIN);
  },
);
