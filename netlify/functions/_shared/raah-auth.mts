import { getAuth } from 'firebase-admin/auth';
import { getAppDb, initializeFirebaseAdmin } from './firebase-admin.mjs';

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

  let decoded;
  try {
    // Revoked sessions and disabled accounts must not retain access to pastoral notes.
    decoded = await getAuth().verifyIdToken(token, true);
  } catch {
    return failure(401, 'Invalid or expired session');
  }

  const ownerEmail = decoded.email === 'crushidea@gmail.com' && decoded.email_verified === true;
  if (!ownerEmail) {
    try {
      const member = await getAppDb().collection('users').doc(decoded.uid).get();
      if (!member.exists || member.data()?.role !== 'admin') return failure(403, 'Admin permission required');
    } catch {
      return failure(503, 'Permission service unavailable');
    }
  }

  return { user: { uid: decoded.uid, email: decoded.email, name: decoded.name || decoded.email || 'Admin' } };
}
