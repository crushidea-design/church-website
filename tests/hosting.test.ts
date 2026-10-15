import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import { isRaahSurface } from '../src/lib/appSurface';
import { prepareHosting } from '../scripts/prepare-hosting.mjs';

const root = new URL('../', import.meta.url);
const sourceHtml = await readFile(new URL('index.html', root), 'utf8');
const hosting = JSON.parse(await readFile(new URL('firebase.hosting.json', root), 'utf8')).hosting;
const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function metadata(hostname: string, pathname: string, surface?: string) {
  const values: Record<string, string> = {};
  const document = {
    title: '함께 지어져가는 교회',
    documentElement: { dataset: { appSurface: surface } },
    querySelector: () => null,
    getElementById: (id: string) => ({ setAttribute: (_key: string, value: string) => { values[id] = value; } }),
  };
  const script = sourceHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  expect(script).toBeTruthy();
  vm.runInNewContext(script!, { window: { location: { hostname, pathname } }, document });
  return { title: document.title, manifest: values['app-manifest'] };
}

describe('Hosting surface selection', () => {
  it('requires the RAAH build marker or exact production hostname', () => {
    expect(isRaahSurface('raah.builttogether.church')).toBe(true);
    expect(isRaahSurface('demo--preview.web.app', 'raah')).toBe(true);
    expect(isRaahSurface('demo--preview.web.app')).toBe(false);
    expect(isRaahSurface('raah.builttogether.church.example.com')).toBe(false);
    expect(isRaahSurface('localhost', '?surface=raah')).toBe(false);
  });

  it.each(['/', '/members', '/next', '/next-generation/example'])('keeps preview RAAH metadata at %s', (pathname) => {
    expect(metadata('preview.web.app', pathname, 'raah')).toEqual({ title: 'RAAH', manifest: '/raah.webmanifest' });
  });

  it('preserves church, next-generation and path-based RAAH metadata', () => {
    expect(metadata('preview.web.app', '/')).toEqual({ title: '함께 지어져가는 교회', manifest: undefined });
    expect(metadata('preview.web.app', '/next/children')).toEqual({ title: '한우리 다음세대', manifest: '/next.webmanifest' });
    expect(metadata('preview.web.app', '/raah')).toEqual({ title: 'RAAH', manifest: '/raah-path.webmanifest' });
    expect(metadata('raah.builttogether.church', '/')).toEqual({ title: 'RAAH', manifest: '/raah.webmanifest' });
  });
});

describe('Hosting build preparation', () => {
  it('isolates RAAH entry and manifest, retains assets, and is repeatable without changing the Netlify build', async () => {
    const dist = await mkdtemp(path.join(tmpdir(), 'church-hosting-'));
    temporary.push(dist);
    await mkdir(path.join(dist, 'assets'));
    await writeFile(path.join(dist, 'assets/app-hash.js'), 'built bundle');
    await writeFile(path.join(dist, 'index.html'), sourceHtml);
    await writeFile(path.join(dist, 'next.html'), '<html>next</html>');
    await writeFile(path.join(dist, '_redirects'), 'netlify-only');
    await writeFile(path.join(dist, '.env'), 'PRIVATE_BUILD_SETTING=synthetic');
    await writeFile(path.join(dist, 'firebase-debug.log'), 'emulator diagnostics');
    const original = '{"id":"https://raah.builttogether.church/","start_url":"https://raah.builttogether.church/","scope":"https://raah.builttogether.church/"}';
    await writeFile(path.join(dist, 'raah.webmanifest'), original);
    await prepareHosting(dist);
    await writeFile(path.join(dist, 'hosting/raah/stale.txt'), 'old');
    await prepareHosting(dist);
    expect(await readFile(path.join(dist, 'index.html'), 'utf8')).toBe(sourceHtml);
    expect(await readFile(path.join(dist, 'raah.webmanifest'), 'utf8')).toBe(original);
    for (const surface of ['church', 'raah']) {
      const target = path.join(dist, 'hosting', surface);
      expect(await readFile(path.join(target, 'assets/app-hash.js'), 'utf8')).toBe('built bundle');
      await expect(readFile(path.join(target, '_redirects'))).rejects.toThrow();
      await expect(readFile(path.join(target, '.env'))).rejects.toThrow();
      await expect(readFile(path.join(target, 'firebase-debug.log'))).rejects.toThrow();
      await expect(readFile(path.join(target, 'stale.txt'))).rejects.toThrow();
    }
    expect(await readFile(path.join(dist, 'hosting/church/index.html'), 'utf8')).toBe(sourceHtml);
    expect(await readFile(path.join(dist, 'hosting/raah/index.html'), 'utf8')).toContain('data-app-surface="raah"');
    await expect(readFile(path.join(dist, 'hosting/raah/next.html'))).rejects.toThrow();
    expect(JSON.parse(await readFile(path.join(dist, 'hosting/raah/raah.webmanifest'), 'utf8'))).toEqual({ id: '/', start_url: '/', scope: '/' });
  });
});

describe('Hosting function boundary', () => {
  it('routes RAAH and the legacy OAuth callback before the general API allowlist and SPA', () => {
    for (const site of hosting) {
      expect(site.rewrites.slice(0, 3)).toEqual([
        { source: '/.netlify/functions/raah-calendar-callback', function: { functionId: 'raahApi', region: 'asia-northeast1' } },
        { source: '/api/raah/**', function: { functionId: 'raahApi', region: 'asia-northeast1' } },
        { source: '/api/**', function: { functionId: 'siteApi', region: 'asia-northeast1' } },
      ]);
      expect(site.rewrites.at(-1)).toEqual({ source: '**', destination: '/index.html' });
      // No scheduled function may become an HTTP rewrite or a Hosting deploy dependency.
      expect(site.rewrites.filter((rule: { function?: unknown }) => rule.function)).toHaveLength(3);
    }
  });
});
