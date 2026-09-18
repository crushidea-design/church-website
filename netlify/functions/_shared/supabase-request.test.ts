import { afterEach, describe, expect, it, vi } from 'vitest';
import { supabaseRequest } from './supabase-request.mjs';

afterEach(() => vi.restoreAllMocks());
describe('RAAH paged lists', () => {
  it('reads every row even when the upstream cap is smaller than a requested page', async () => {
    const source = Array.from({ length: 251 }, (_, id) => ({ id }));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const parsed = new URL(String(url));
      const offset = Number(parsed.searchParams.get('offset'));
      expect(parsed.searchParams.get('order')).toBe('date.desc,id.asc');
      const rows = source.slice(offset, offset + 100);
      return new Response(JSON.stringify(rows), { headers: { 'content-range': `${offset}-${offset + rows.length - 1}/251` } });
    });
    const result = await supabaseRequest('https://db.example/rest/v1/notes?order=date.desc', {});
    expect(await result.json()).toEqual(source);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('does not report a partial list as success when a later page fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(Array.from({ length: 200 }, (_, id) => ({ id })))))
      .mockResolvedValueOnce(new Response('Unavailable', { status: 503 }));
    expect((await supabaseRequest('https://db.example/rest/v1/notes', {})).status).toBe(503);
  });
  it('preserves explicit detail limits and write requests', async () => {
    const mock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]'));
    await supabaseRequest('https://db.example/rest/v1/notes?limit=1', {});
    expect(String(mock.mock.calls[0][0])).toContain('limit=1');
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
