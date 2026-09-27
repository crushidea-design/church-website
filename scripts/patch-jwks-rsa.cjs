// jwks-rsa 4 synchronously requires ESM-only jose. Netlify's Lambda runtime
// disables require(esm), so load jose asynchronously at its two call sites.
// Remove when upstream resolves https://github.com/auth0/node-jwks-rsa/issues/507.
const { readFileSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const { createRequire } = require('node:module');

const adminRequire = createRequire(require.resolve('firebase-admin/app'));
const sourceDirectory = dirname(adminRequire.resolve('jwks-rsa'));
const originalImport = "const jose = require('jose');\n";
const patches = [
  {
    file: 'utils.js',
    before: 'async function retrieveSigningKeys(jwks) {',
    after: "async function retrieveSigningKeys(jwks) {\n  const jose = await import('jose');",
  },
  {
    file: 'integrations/passport.js',
    before: 'return function secretProvider(req, rawJwtToken, cb) {\n    let decoded;\n    try {',
    after: "return async function secretProvider(req, rawJwtToken, cb) {\n    let decoded;\n    try {\n      const jose = await import('jose');",
  },
];

// Validate every file before writing, and fail closed if upstream changed shape.
const changes = patches.map(({ file, before, after }) => {
  const path = join(sourceDirectory, file);
  const source = readFileSync(path, 'utf8');
  if (!source.includes(originalImport) && source.includes(after)) return null;
  if (!source.startsWith(originalImport) || !source.includes(before)) {
    throw new Error(`jwks-rsa ${file} changed; review the Lambda compatibility patch before deploying.`);
  }
  return { path, source: source.replace(originalImport, '').replace(before, after) };
});
for (const change of changes) {
  if (change) writeFileSync(change.path, change.source);
}
console.info('Applied/verified jwks-rsa Lambda compatibility patches.');
