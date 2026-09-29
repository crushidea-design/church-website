/**
 * Reads the subject of a Bearer token WITHOUT verifying it. The result is only a
 * hint for starting lookups early; it must never authorize anything. Callers must
 * compare it with the uid from real verification and discard the early result
 * when they differ.
 */
export function unverifiedUidHint(req: Request): string | null {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const payload = token.split('.')[1];
  if (!payload || token.split('.').length !== 3) return null;
  try {
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as Record<string, unknown>;
    const uid = json.user_id ?? json.sub;
    return typeof uid === 'string' && uid.length > 0 && uid.length <= 128 ? uid : null;
  } catch {
    return null;
  }
}
