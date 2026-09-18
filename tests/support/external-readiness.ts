import { execFileSync } from 'node:child_process';
import { deleteApp, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { getAppDb, initializeFirebaseAdmin } from '../../netlify/functions/_shared/firebase-admin.mts';

// Explicit, read-only production connectivity check. Never run automatically in CI.
// Keep credentials in memory; never print command output, upstream errors or records.
if (!process.argv.includes('--read-only-production')) throw new Error('Pass --read-only-production explicitly.');
for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST']) {
  if (process.env[key]) throw new Error('Run outside the emulator environment.');
}
const siteId = '7753734e-e8d3-47ee-be3d-d3b00f217c4d';
let env: Record<string, string>;
try {
  env = JSON.parse(execFileSync('netlify', ['env:list', '--site', siteId, '--context', 'production', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }));
} catch { throw new Error('Unable to read Netlify production configuration.'); }

for (const key of ['FIREBASE_SERVICE_ACCOUNT_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RAAH_ENCRYPTION_SECRET']) {
  if (typeof env[key] !== 'string' || !env[key]) throw new Error(`Missing configuration: ${key}`);
  process.env[key] = env[key];
}
const results: Record<string, string> = {};
results.nodeBuildOverride = env.NODE_VERSION || 'not set; repository .nvmrc applies on next build';
results.nodeFunctionOverride = env.AWS_LAMBDA_JS_RUNTIME || 'not set; follows build runtime';
results.googleCalendar = env.GOOGLE_CALENDAR_CLIENT_ID && env.GOOGLE_CALENDAR_CLIENT_SECRET ? 'environment configuration present; OAuth not exercised' : 'environment configuration absent; Supabase settings fallback not checked';
const check = async (name: string, run: () => Promise<unknown>) => {
  try { await run(); results[name] = 'reachable'; }
  catch (error) {
    const code = (error as { code?: string | number; cause?: { code?: string } }).code ?? (error as { cause?: { code?: string } }).cause?.code;
    const safeCode = typeof code === 'number' || (typeof code === 'string' && /^[a-zA-Z0-9_/-]{1,60}$/.test(code)) ? String(code) : 'unknown';
    results[name] = `failed (${safeCode}; details suppressed)`;
    if (name === 'firestore') {
      const message = String((error as Error).message);
      results.firestoreDiagnostic = ['Invalid resource', 'project', 'database', 'credentials', 'permission', 'invalid_grant'].filter(word => message.toLowerCase().includes(word.toLowerCase())).join(', ') || 'unclassified';
    }
    process.exitCode = 1;
  }
};

try {
  if (!initializeFirebaseAdmin()) throw new Error('Admin initialization failed.');
  await check('firestore', async () => {
    // Missing sentinel document is sufficient; no pastoral/user data is fetched.
    await getAppDb().collection('settings').doc('codex-connectivity-probe-nonexistent').get();
  });
  await check('firebaseAuth', async () => {
    try { await getAuth().getUser('__connectivity_probe_nonexistent__'); }
    catch (error) { if ((error as { code?: string }).code !== 'auth/user-not-found') throw error; }
  });
  await check('storage', async () => { await getStorage().bucket(firebaseConfig.storageBucket).getMetadata(); });
  if (/\*{3}|redacted|hidden/i.test(env.SUPABASE_SERVICE_ROLE_KEY)) {
    results.supabase = 'not checked: Netlify returned a masked key; use the authenticated application to verify';
  } else await check('supabase', async () => {
    const base = new URL(env.SUPABASE_URL);
    if (base.protocol !== 'https:' || !base.hostname.endsWith('.supabase.co')) throw Object.assign(new Error('Unexpected Supabase endpoint.'), { code: 'ENDPOINT_MISMATCH' });
    const response = await fetch(new URL('/rest/v1/raah_notes?select=id&limit=1', base), {
      method: 'HEAD', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Object.assign(new Error('Supabase connection failed.'), { code: `HTTP_${response.status}` });
  });
  results.pushDelivery = 'not sent';
} finally {
  try { await deleteApp(getApp()); } catch { /* initialization may have failed */ }
  console.info(JSON.stringify(results, null, 2));
}
