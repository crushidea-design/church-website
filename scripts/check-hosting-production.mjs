import { pathToFileURL } from 'node:url';

const endpoints = [
  ['POST', '/api/post-comments'], ['DELETE', '/api/attachments'],
  ['POST', '/api/notifications/subscribe'], ['POST', '/api/notifications/send'],
  ['GET', '/api/notifications/health'], ['POST', '/api/word-fruit/check'],
  ['POST', '/api/word-fruit/generate-cards'], ['POST', '/api/word-fruit/notify-publish'],
  ['GET', '/api/raah/bootstrap'],
];

export const productionChecks = ['builttogether.church', 'raah.builttogether.church'].flatMap(host => [
  ...endpoints.map(([method, path]) => ({ host, method, path, status: 401, kind: 'api' })),
  { host, method: 'GET', path: '/', status: 200, kind: host.startsWith('raah.') ? 'raah' : 'church' },
  { host, method: 'GET', path: '/.netlify/functions/raah-calendar-callback?state=invalid.signature', status: 400, kind: 'api' },
]).concat([
  { host: 'builttogether.church', method: 'GET', path: '/next', status: 200, kind: 'page' },
  { host: 'www.builttogether.church', method: 'GET', path: '/', status: 301, kind: 'redirect' },
]);

export async function checkProductionRoute(check, request = fetch) {
  const response = await request(`https://${check.host}${check.path}`, {
    method: check.method,
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json' },
    ...(check.method === 'GET' ? {} : { body: JSON.stringify({ token: 'nonexistent-smoke-device' }) }),
    signal: AbortSignal.timeout(30_000),
  });
  const label = `${check.host}${check.path.split('?')[0]}`;
  if (response.status !== check.status) throw new Error(`${label}: expected ${check.status}, got ${response.status}.`);
  if (check.kind === 'api' && response.headers.get('cache-control') !== 'no-store') {
    throw new Error(`${label}: missing no-store.`);
  }
  if (check.kind === 'redirect' && response.headers.get('location') !== 'https://builttogether.church/') {
    throw new Error(`${label}: wrong www redirect.`);
  }
  if (check.kind === 'church' || check.kind === 'raah') {
    const html = await response.text();
    const isRaah = /<html\b[^>]*\bdata-app-surface="raah"/.test(html);
    if (isRaah !== (check.kind === 'raah')) throw new Error(`${label}: wrong app entry point.`);
  } else {
    // Do not print or persist API response bodies.
    await response.body?.cancel();
  }
}

export async function checkHostingProduction() {
  for (const check of productionChecks) {
    for (let attempt = 0; ; attempt++) {
      try { await checkProductionRoute(check); break; }
      catch (error) {
        if (attempt === 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 2_000));
      }
    }
  }
  console.log(`Production HTTPS and routing checks passed (${productionChecks.length}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkHostingProduction().catch(error => { console.error(error.message); process.exitCode = 1; });
}
