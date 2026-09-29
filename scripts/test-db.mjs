#!/usr/bin/env node
// Runs the RAAH database tests against the local Supabase stack only.
// Usage: npm run test:db            (resets the local DB, then runs tests)
//        npm run test:db -- --no-reset
import { execFileSync, spawnSync } from 'node:child_process';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const args = process.argv.slice(2);
const skipReset = args.includes('--no-reset');
const vitestArgs = args.filter((arg) => arg !== '--no-reset');

function readLocalStatus() {
  try {
    return JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch {
    console.error('로컬 Supabase가 실행 중이 아닙니다. OrbStack을 켜고 `supabase start`를 먼저 실행하세요.');
    process.exit(1);
  }
}

const status = readLocalStatus();
const apiUrl = new URL(status.API_URL);
if (!LOCAL_HOSTS.has(apiUrl.hostname)) {
  console.error(`로컬이 아닌 Supabase(${apiUrl.hostname})에는 DB 테스트를 실행하지 않습니다.`);
  process.exit(1);
}

if (!skipReset) {
  execFileSync('supabase', ['db', 'reset', '--local'], { stdio: 'inherit' });
}

const result = spawnSync('npx', ['vitest', 'run', 'tests/db', ...vitestArgs], {
  stdio: 'inherit',
  env: {
    ...process.env,
    RAAH_TEST_SUPABASE_URL: status.API_URL,
    RAAH_TEST_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    RAAH_TEST_ANON_KEY: status.ANON_KEY,
  },
});
process.exit(result.status ?? 1);
