import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Netlify deploys every top-level file in netlify/functions as a function, so a
// test file there breaks the deploy (it tries to bundle Vitest). Keep tests in
// tests/ or netlify/functions/_shared/.
describe('netlify/functions layout', () => {
  it('has no test files at the top level', () => {
    const entries = readdirSync(new URL('../netlify/functions/', import.meta.url), { withFileTypes: true });
    const tests = entries.filter((entry) => entry.isFile() && /\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name)).map((entry) => entry.name);
    expect(tests).toEqual([]);
  });
});
