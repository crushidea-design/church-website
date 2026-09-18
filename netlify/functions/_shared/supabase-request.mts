/** Explicitly page legacy list endpoints so a server row cap cannot look like a complete list. */
export async function supabaseRequest(url: string, init: RequestInit): Promise<Response> {
  const target = new URL(url);
  if ((init.method || 'GET') !== 'GET' || target.searchParams.has('limit')) {
    return fetch(target, { ...init, signal: init.signal || AbortSignal.timeout(15000) });
  }
  // Stable tie-breaker for rows sharing a date/name. All RAAH tables have an id.
  const order = target.searchParams.getAll('order').join(',');
  target.searchParams.set('order', order ? `${order},id.asc` : 'id.asc');
  const rows: unknown[] = [];
  const pageSize = 200;
  for (let page = 0; page < 100; page += 1) {
    target.searchParams.set('offset', String(rows.length));
    target.searchParams.set('limit', String(pageSize));
    const response = await fetch(target, {
      ...init, signal: init.signal || AbortSignal.timeout(15000),
      headers: { ...init.headers, Prefer: 'count=exact' },
    });
    if (!response.ok) return response;
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('Invalid list response');
    rows.push(...batch);
    const totalText = response.headers.get('content-range')?.split('/')[1];
    const total = totalText && totalText !== '*' ? Number(totalText) : null;
    if ((total !== null && rows.length >= total) || (total === null && batch.length < pageSize)) {
      return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json' } });
    }
    if (batch.length === 0) throw new Error('Incomplete list response');
  }
  // Do not silently truncate a large church's records or return incorrect totals.
  throw new Error('List exceeds supported size; use a narrower query');
}
