import { getAuth } from 'firebase-admin/auth';
import { getAppDb, initializeFirebaseAdmin } from './firebase-admin.mjs';
import { timed } from './server-timing.mjs';
import { unverifiedUidHint } from './unverified-token.mjs';

export type RaahUser = { uid: string; email?: string; name: string };

const failure = (status: number, error: string) => ({
  response: new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  }),
});

/** Only Firebase-issued identities and server-managed roles authorize RAAH. */
export async function requireRaahAdmin(req: Request): Promise<{ user?: RaahUser; response?: Response }> {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return failure(401, 'Authentication required');

  try {
    if (!initializeFirebaseAdmin()) return failure(503, 'Authentication service unavailable');
  } catch {
    return failure(503, 'Authentication service unavailable');
  }

  // Start the role read while the token is being verified, using the uid the token
  // claims. It is only used if verification returns that same uid; otherwise it is
  // discarded and the role is read again for the verified uid. It never rejects.
  const readRole = (uid: string) => (async () => {
    try {
      const member = await timed('role', () => getAppDb().collection('users').doc(uid).get());
      return { ok: true as const, isAdmin: member.exists && member.data()?.role === 'admin' };
    } catch {
      return { ok: false as const };
    }
  })();
  const hint = unverifiedUidHint(req);
  const rolePrefetch = hint ? readRole(hint) : null;

  let decoded;
  try {
    // Revoked sessions and disabled accounts must not retain access to pastoral notes.
    decoded = await timed('auth', () => getAuth().verifyIdToken(token, true));
  } catch {
    return failure(401, 'Invalid or expired session');
  }

  const ownerEmail = decoded.email === 'crushidea@gmail.com' && decoded.email_verified === true;
  if (!ownerEmail) {
    const role = await (rolePrefetch && hint === decoded.uid ? rolePrefetch : readRole(decoded.uid));
    if (!role.ok) return failure(503, 'Permission service unavailable');
    if (!role.isAdmin) return failure(403, 'Admin permission required');
  }

  return { user: { uid: decoded.uid, email: decoded.email, name: decoded.name || decoded.email || 'Admin' } };
}
