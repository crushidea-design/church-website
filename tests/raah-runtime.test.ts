import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const run = (code: string, typescript = false) => {
  const result = spawnSync(process.execPath, [
    '--no-experimental-require-module',
    ...(typescript ? ['--import', 'tsx'] : []),
    '--input-type=module', '--eval', code,
  ], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8', timeout: 15000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
};

it('loads real Firebase Auth and verifies JWKS with native Lambda module restrictions', () => {
  // No tsx/Vitest loader in this child: tsx can hide require(esm) failures.
  run(`
    import assert from 'node:assert/strict';
    import { generateKeyPairSync, sign, verify } from 'node:crypto';
    import { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    const { getAuth } = require('firebase-admin/auth');
    assert.equal(typeof getAuth, 'function');
    const adminRequire = createRequire(require.resolve('firebase-admin/app'));
    const jwksClient = adminRequire('jwks-rsa');
    globalThis.fetch = async () => { throw new Error('Unexpected network access'); };
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const options = {
      cache: false,
      jwksUri: 'https://example.invalid/jwks',
      fetcher: async () => ({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'fixture', use: 'sig', alg: 'RS256' }] }),
    };
    const client = jwksClient(options);
    const key = await client.getSigningKey('fixture');
    const payload = Buffer.from('local signing fixture');
    const signature = sign('RSA-SHA256', payload, privateKey);
    assert.equal(verify('RSA-SHA256', payload, key.getPublicKey(), signature), true);
    assert.equal(verify('RSA-SHA256', Buffer.from('tampered'), key.getPublicKey(), signature), false);
    await assert.rejects(client.getSigningKey('missing'), /Unable to find a signing key/);
    const provider = jwksClient.passportJwtSecret(options);
    const resolve = token => new Promise((res, rej) => provider({}, token, (err, value) => err ? rej(err) : res(value)));
    assert.equal(await resolve('invalid-token'), null);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fixture' })).toString('base64url');
    const claims = Buffer.from(JSON.stringify({ sub: 'fixture' })).toString('base64url');
    const tokenBody = header + '.' + claims;
    const token = tokenBody + '.' + sign('RSA-SHA256', Buffer.from(tokenBody), privateKey).toString('base64url');
    assert.equal(await resolve(token), key.getPublicKey());
  `);
}, 20000);

it('starts real RAAH handlers and rejects anonymous requests', () => {
  run(`
    import assert from 'node:assert/strict';
    globalThis.fetch = async () => { throw new Error('Unexpected network access'); };
    for (const [name, path] of [
      ['raah-management', '/api/raah/bootstrap'],
      ['raah-calendar', '/api/raah/calendar/status'],
    ]) {
      const { default: handler } = await import('./netlify/functions/' + name + '.mts');
      const response = await handler(new Request('https://example.invalid' + path), { params: {} });
      assert.equal(response.status, 401, name);
      assert.deepEqual(await response.json(), { error: 'Authentication required' }, name);
    }
  `, true);
}, 20000);
