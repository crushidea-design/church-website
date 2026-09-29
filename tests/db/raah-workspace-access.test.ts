import { describe, expect, it } from 'vitest';

// Runs only through `npm run test:db` against the local Supabase stack.
const url = process.env.RAAH_TEST_SUPABASE_URL;
const serviceKey = process.env.RAAH_TEST_SERVICE_ROLE_KEY;
const anonKey = process.env.RAAH_TEST_ANON_KEY;
const enabled = Boolean(url && serviceKey && anonKey);

function rest(path: string, key: string, init: RequestInit = {}) {
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...init.headers,
    },
  });
}

const insertGrant = (body: Record<string, unknown>, key = serviceKey!) =>
  rest('raah_workspace_access', key, { method: 'POST', body: JSON.stringify(body) });

describe.skipIf(!enabled)('raah_workspace_access (local Supabase only)', () => {
  it('lets the server role create a grant with safe defaults', async () => {
    const response = await insertGrant({ firebase_uid: 'uid-pastor', access_role: 'pastor' });
    expect(response.status).toBe(201);
    const [row] = await response.json();
    expect(row).toMatchObject({ workspace_id: 'default', active: true, revoked_at: null, expires_at: null });
  });

  it('allows one grant per user per workspace', async () => {
    expect((await insertGrant({ firebase_uid: 'uid-dup', access_role: 'elder' })).status).toBe(201);
    const duplicate = await insertGrant({ firebase_uid: 'uid-dup', access_role: 'pastor' });
    expect(duplicate.status).toBe(409);
  });

  it('rejects unknown roles and a revoked grant that is still active', async () => {
    expect((await insertGrant({ firebase_uid: 'uid-bad-role', access_role: 'admin' })).status).toBe(400);
    const revokedButActive = await insertGrant({
      firebase_uid: 'uid-bad-revoke',
      access_role: 'pastor',
      active: true,
      revoked_at: '2026-09-01T00:00:00Z',
    });
    expect(revokedButActive.status).toBe(400);
  });

  it('hides grants from browser keys and refuses browser writes', async () => {
    const read = await rest('raah_workspace_access?select=firebase_uid', anonKey!);
    expect(read.ok).toBe(false);
    const write = await insertGrant({ firebase_uid: 'uid-anon', access_role: 'pastor' }, anonKey!);
    expect(write.ok).toBe(false);
  });
});
