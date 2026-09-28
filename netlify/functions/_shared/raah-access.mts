import { requireRaahAdmin, type RaahUser } from './raah-auth.mjs';

export type RaahAccessRole = 'pastor' | 'elder' | 'clerk';

export type RaahAccess = {
  user: RaahUser;
  workspaceId: string;
  /** null while enforcement is off: the caller passed only the legacy admin check. */
  accessRole: RaahAccessRole | null;
};

// Single-church scope chosen by the server; never taken from the request.
export const RAAH_WORKSPACE_ID = 'default';

const getEnv = (key: string) => {
  const netlifyValue = typeof Netlify !== 'undefined' ? Netlify.env.get(key) : undefined;
  return netlifyValue || process.env[key];
};

const failure = (status: number, error: string, code?: string) => ({
  response: new Response(JSON.stringify(code ? { error, code } : { error }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  }),
});

export const isRaahAccessEnforced = () => getEnv('RAAH_ACCESS_ENFORCED') === 'true';

type AccessRow = { access_role: RaahAccessRole; active: boolean; expires_at: string | null; revoked_at: string | null };

async function findActiveGrant(uid: string): Promise<AccessRow | null | 'unavailable'> {
  const url = getEnv('SUPABASE_URL')?.replace(/\/$/, '');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return 'unavailable';

  const query = new URLSearchParams({
    select: 'access_role,active,expires_at,revoked_at',
    workspace_id: `eq.${RAAH_WORKSPACE_ID}`,
    firebase_uid: `eq.${uid}`,
    limit: '1',
  });
  try {
    const response = await fetch(`${url}/rest/v1/raah_workspace_access?${query}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return 'unavailable';
    const rows = (await response.json()) as AccessRow[];
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch {
    return 'unavailable';
  }
}

const isGrantUsable = (row: AccessRow, now: number) =>
  row.active && !row.revoked_at && (!row.expires_at || Date.parse(row.expires_at) > now);

/**
 * RAAH access = Firebase identity + homepage admin role (legacy check) and,
 * when RAAH_ACCESS_ENFORCED=true, an active grant in raah_workspace_access.
 * The grant is re-read on every request so revocation applies immediately.
 */
export async function requireRaahAccess(req: Request): Promise<{ access?: RaahAccess; response?: Response }> {
  const adminCheck = await requireRaahAdmin(req);
  if (adminCheck.response || !adminCheck.user) return { response: adminCheck.response };
  const user = adminCheck.user;

  if (!isRaahAccessEnforced()) {
    return { access: { user, workspaceId: RAAH_WORKSPACE_ID, accessRole: null } };
  }

  const grant = await findActiveGrant(user.uid);
  if (grant === 'unavailable') return failure(503, 'Access service unavailable');
  if (!grant || !isGrantUsable(grant, Date.now())) {
    return failure(403, '라아 목양 접근 권한이 없습니다. 관리자에게 접근 승인을 요청해 주세요.', 'RAAH_ACCESS_NOT_GRANTED');
  }
  return { access: { user, workspaceId: RAAH_WORKSPACE_ID, accessRole: grant.access_role } };
}
