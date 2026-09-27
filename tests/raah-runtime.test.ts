import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('starts real RAAH handlers and verifies signing keys with Lambda require(esm) disabled', () => {
  // A fresh process exercises the real firebase-admin -> jwks-rsa -> jose chain.
  // Match Lambda's disabling flag instead of relying on local Node defaults.
  const result = spawnSync(process.execPath, [
    '--no-experimental-require-module', '--import', 'tsx', '--input-type=module', '--eval',
    `
      import assert from 'node:assert/strict';
      import { generateKeyPairSync, sign, verify } from 'node:crypto';
      import { createRequire } from 'node:module';
      const require = createRequire(import.meta.url);
      const adminRequire = createRequire(require.resolve('firebase-admin/app'));
      const jwksClient = adminRequire('jwks-rsa');
      globalThis.fetch = async () => { throw new Error('Unexpected network access'); };
      const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
      const client = jwksClient({
        cache: false,
        fetcher: async () => ({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'fixture', use: 'sig', alg: 'RS256' }] }),
      });
      const key = await client.getSigningKey('fixture');
      const payload = Buffer.from('local signing fixture');
      const signature = sign('RSA-SHA256', payload, privateKey);
      assert.equal(verify('RSA-SHA256', payload, key.getPublicKey(), signature), true);
      assert.equal(verify('RSA-SHA256', Buffer.from('tampered'), key.getPublicKey(), signature), false);
      await assert.rejects(client.getSigningKey('missing'), /Unable to find a signing key/);
      const routes = [
        ['raah-management', '/api/raah/bootstrap'],
        ['raah-notes', '/api/raah/notes'],
        ['raah-calendar', '/api/raah/calendar/status'],
      ];
      for (const [name, path] of routes) {
        const { default: handler } = await import('./netlify/functions/' + name + '.mts');
        const response = await handler(new Request('https://example.invalid' + path), { params: {} });
        assert.equal(response.status, 401, name);
        assert.deepEqual(await response.json(), { error: 'Authentication required' }, name);
      }
    `,
  ], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8',
    timeout: 15000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
}, 20000);
