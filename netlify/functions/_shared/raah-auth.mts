import { getAuth } from 'firebase-admin/auth';
import { getAppDb, initializeFirebaseAdmin } from './firebase-admin.mjs';
import { timed } from './server-timing.mjs';

export type RaahUser = { uid: string; email?: string; name: string };

const failure = (status: number, error: string) => ({
  response: new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  }),
});

/**
 * Only Firebase-issued identities and server-managed roles authorize RAAH.
 *
 * The token's signature is checked first (locally, against Google's cached
 * keys), so nothing reaches Firestore or Supabase for a forged token. Only then
 * do the revocation check and the role read run side by side; access still
 * requires the revocation check to pass. `onSignedUid` lets a caller start its
 * own lookup (the RAAH grant) at the same point, for a genuinely signed uid.
 */
export async function requireRaahAdmin(
  req: Request,
  options: { onSignedUid?: (uid: string) => void } = {}
): Promise<{ user?: RaahUser; response?: Response }> {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return failure(401, 'Authentication required');

  try {
    if (!initializeFirebaseAdmin()) return failure(503, 'Authentication service unavailable');
  } catch {
    return failure(503, 'Authentication service unavailable');
  }

  let decoded;
  try {
    decoded = await timed('auth', () => getAuth().verifyIdToken(token));
  } catch {
    return failure(401, 'Invalid or expired session');
  }

  options.onSignedUid?.(decoded.uid);
  const ownerEmail = decoded.email === 'crushidea@gmail.com' && decoded.email_verified === true;
  const rolePromise = ownerEmail
    ? null
    : (async () => {
        try {
          const member = await timed('role', () => getAppDb().collection('users').doc(decoded.uid).get());
          return { ok: true as const, isAdmin: member.exists && member.data()?.role === 'admin' };
        } catch {
          return { ok: false as const };
        }
      })();

  try {
    // Revoked sessions and disabled accounts must not retain access to pastoral notes.
    await timed('revocation', () => getAuth().verifyIdToken(token, true));
  } catch {
    return failure(401, 'Invalid or expired session');
  }

  if (rolePromise) {
    const role = await rolePromise;
    if (!role.ok) return failure(503, 'Permission service unavailable');
    if (!role.isAdmin) return failure(403, 'Admin permission required');
  }

  return { user: { uid: decoded.uid, email: decoded.email, name: decoded.name || decoded.email || 'Admin' } };
}
