// jwks-rsa 4 synchronously requires ESM-only jose. Netlify's Lambda runtime
// disables require(esm), so load jose inside the existing async key converter.
// Remove when upstream resolves https://github.com/auth0/node-jwks-rsa/issues/507.
const { readFileSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const { createRequire } = require('node:module');

const adminRequire = createRequire(require.resolve('firebase-admin/app'));
const utilsPath = join(dirname(adminRequire.resolve('jwks-rsa')), 'utils.js');
const source = readFileSync(utilsPath, 'utf8');
const originalImport = "const jose = require('jose');";
const originalFunction = 'async function retrieveSigningKeys(jwks) {';
const patchedFunction = `${originalFunction}\n  const jose = await import('jose');`;

if (!source.includes(originalImport) && source.includes(patchedFunction)) {
  console.info('jwks-rsa Lambda compatibility patch already applied.');
} else if (source.startsWith(originalImport) && source.includes(originalFunction)) {
  writeFileSync(utilsPath, source.replace(`${originalImport}\n`, '').replace(originalFunction, patchedFunction));
  console.info('Applied jwks-rsa Lambda compatibility patch.');
} else {
  throw new Error('jwks-rsa source changed; review the Lambda compatibility patch before deploying.');
}
