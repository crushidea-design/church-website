import assert from 'node:assert/strict';
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const port = 5780;
if (process.argv.includes('--check')) {
  async function get(surface, pathname) {
    const response = await fetch(`http://127.0.0.1:${port + (surface === 'raah' ? 5 : 0)}${pathname}`, { redirect: 'manual' });
    assert.equal(response.status, 200, `${surface} ${pathname}`);
    return response;
  }
  for (const surface of ['church', 'raah']) {
    for (const pathname of ['/', '/community/example', '/next', '/next/children', '/next-generation/children']) {
      const response = await get(surface, pathname);
      assert.equal(response.headers.get('cache-control'), 'no-cache');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      const html = await response.text();
      assert.ok(html.includes('<div id="root"></div>'));
      assert.equal(html.includes('data-app-surface="raah"'), surface === 'raah');
      if (surface === 'church' && pathname.startsWith('/next')) assert.ok(html.includes('<title>한우리 다음세대</title>'));
    }
    const sw = await get(surface, '/firebase-messaging-sw.js');
    assert.equal(sw.headers.get('cache-control'), 'no-cache');
    assert.match(sw.headers.get('content-type'), /javascript/);
    // Firebase redirects run before static files; a broad legacy redirect would
    // incorrectly redirect these real public images. The client handles deep aliases.
    const asset = await get(surface, '/next-generation/pillars/worship/worship-note-elementary-1.jpg');
    assert.match(asset.headers.get('content-type'), /image\/jpeg/);
    const files = await readdir(`dist/hosting/${surface}/assets`);
    const bundle = await get(surface, `/assets/${files.find((name) => name.endsWith('.js'))}`);
    assert.match(bundle.headers.get('cache-control'), /max-age=31536000, immutable/);
  }
  const redirect = await fetch(`http://127.0.0.1:${port}/next-generation?from=legacy`, { redirect: 'manual' });
  assert.equal(redirect.status, 301);
  assert.equal(new URL(redirect.headers.get('location'), redirect.url).pathname, '/next');
  assert.equal(new URL(redirect.headers.get('location'), redirect.url).search, '?from=legacy');
  const raahNext = await get('raah', '/next.html');
  assert.ok((await raahNext.text()).includes('data-app-surface="raah"'));
  const manifest = await (await get('raah', '/raah.webmanifest')).json();
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  console.info('Hosting emulator: church/RAAH deep links, next aliases and assets, cache headers, service worker, PWA passed.');
} else {
  const config = JSON.parse(await readFile('firebase.hosting.json', 'utf8'));
  // Synthetic sites only: never resolve a real target or contact production APIs.
  config.hosting = config.hosting.map(({ target, predeploy: _predeploy, ...site }) => ({ ...site, site: `demo-${target}`, public: path.relative(path.resolve('dist'), path.resolve(site.public)) }));
  config.emulators = { hosting: { host: '127.0.0.1', port }, ui: { enabled: false }, singleProjectMode: true };
  const configPath = path.resolve('dist/hosting-emulator.json');
  await writeFile(configPath, JSON.stringify(config));
  try {
    const child = spawn('firebase', ['emulators:exec', '--config', configPath, '--project', 'demo-church-hosting', '--only', 'hosting', 'node scripts/test-hosting.mjs --check'], { stdio: 'inherit' });
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    });
    process.exitCode = code ?? 1;
  } finally {
    await rm(configPath, { force: true });
  }
}
