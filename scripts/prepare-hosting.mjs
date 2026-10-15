import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep both artifacts inside the ignored Vite output. Copy the build entries
// individually so a previous hosting/ directory can never copy into itself.
export async function prepareHosting(dist = path.resolve('dist')) {
  const index = await readFile(path.join(dist, 'index.html'), 'utf8');
  await readFile(path.join(dist, 'next.html'), 'utf8');
  if (!index.includes('<html lang="ko">')) throw new Error('Unexpected index.html root');
  const entries = (await readdir(dist)).filter((name) =>
    !name.startsWith('.') && !name.endsWith('.log') &&
    !['hosting', 'hosting-emulator.json', '_redirects', '_headers'].includes(name));
  const output = path.join(dist, 'hosting');
  await rm(output, { recursive: true, force: true });
  for (const surface of ['church', 'raah']) {
    const target = path.join(output, surface);
    await mkdir(target, { recursive: true });
    for (const entry of entries) {
      // RAAH owns every client route, including /next.html; let it use index.
      if (surface === 'raah' && entry === 'next.html') continue;
      await cp(path.join(dist, entry), path.join(target, entry), { recursive: true });
    }
    if (surface === 'raah') {
      await writeFile(path.join(target, 'index.html'), index.replace('<html lang="ko">', '<html lang="ko" data-app-surface="raah">'));
      const manifestPath = path.join(target, 'raah.webmanifest');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      // Preview installations must stay on their own origin. On the custom
      // domain these resolve to the same URLs as the existing production PWA.
      Object.assign(manifest, { id: '/', start_url: '/', scope: '/' });
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prepareHosting();
  console.info('Prepared dist/hosting/church and dist/hosting/raah');
}
