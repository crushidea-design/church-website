// Checks that a production backup restored into the LOCAL Supabase can still be
// decrypted with the production RAAH_ENCRYPTION_SECRET (rollout step 4.1).
//
//   npx tsx scripts/verify-backup-decrypt.ts
//
// The secret is typed at a hidden prompt (never an argument or env var, so it
// stays out of shell history). Only counts are printed; no names, bodies or
// tokens. Refuses to run against anything but the local stack.
import { execFileSync } from 'node:child_process';
import { createDecipheriv, createHash } from 'node:crypto';
import { stdin, stdout } from 'node:process';

type Encrypted = { iv: string; tag: string; ciphertext: string };

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

// Same scheme as raah-management / raah-notes / raah-calendar (AES-256-GCM, SHA-256 key).
function canDecrypt(payload: Encrypted | string | null, secret: string) {
  try {
    const encrypted = typeof payload === 'string' ? (JSON.parse(payload) as Encrypted) : payload;
    if (!encrypted?.iv || !encrypted.tag || !encrypted.ciphertext) return false;
    const key = createHash('sha256').update(secret).digest();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encrypted.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
    JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, 'base64')), decipher.final()]).toString('utf8'));
    return true;
  } catch {
    return false;
  }
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    stdout.write(question);
    stdin.setRawMode?.(true);
    stdin.resume();
    let value = '';
    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') process.exit(130);
        if (char === '\u007f') value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  const api = new URL(status.API_URL);
  if (!LOCAL_HOSTS.has(api.hostname)) throw new Error(`Refusing to run against ${api.hostname}; this check is for the local restore only.`);
  const key = status.SERVICE_ROLE_KEY as string;

  const secret = await askHidden('운영 RAAH_ENCRYPTION_SECRET 입력(화면에 표시되지 않음): ');
  if (!secret) throw new Error('No secret entered.');

  const tables: Array<{ table: string; column: string; label: string }> = [
    { table: 'raah_visitation_logs', column: 'encrypted_payload', label: '심방·상담 기록' },
    { table: 'raah_notes', column: 'encrypted_payload', label: '이전 RAAH 기록' },
    { table: 'raah_calendar_connections', column: 'encrypted_token', label: 'Google 캘린더 연결 토큰' },
  ];

  let failures = 0;
  let total = 0;
  for (const { table, column, label } of tables) {
    const rows: Array<Record<string, unknown>> = [];
    for (let offset = 0; ; offset += 500) {
      const response = await fetch(`${status.API_URL}/rest/v1/${table}?select=id,${column}&order=id.asc&limit=500&offset=${offset}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (!response.ok) throw new Error(`${table}: HTTP ${response.status}`);
      const batch = (await response.json()) as Array<Record<string, unknown>>;
      rows.push(...batch);
      if (batch.length < 500) break;
    }
    const failedIds = rows.filter((row) => !canDecrypt(row[column] as Encrypted | string | null, secret)).map((row) => String(row.id));
    failures += failedIds.length;
    total += rows.length;
    console.log(`${label} (${table}): ${rows.length}건 중 복호화 성공 ${rows.length - failedIds.length}건, 실패 ${failedIds.length}건`);
    if (failedIds.length) console.log(`  실패한 행 id: ${failedIds.slice(0, 20).join(', ')}${failedIds.length > 20 ? ' …' : ''}`);
  }

  // An empty restore proves nothing: treat it as a failure, not a pass.
  if (total === 0) {
    console.log('\n결과: 확인 불가 — 암호화된 기록이 한 건도 없습니다. 백업을 로컬에 복원했는지 확인해 주세요.');
    process.exitCode = 1;
    return;
  }
  console.log(failures === 0 ? '\n결과: 통과 — 복원한 기록을 이 키로 모두 복호화할 수 있습니다.' : '\n결과: 실패 — 위 행을 복호화하지 못했습니다. 키가 다르거나 자료가 손상되었을 수 있습니다.');
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
