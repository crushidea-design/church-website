import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareMccheyneManualChange } from '../src/lib/mccheyneManualChange';
afterEach(() => vi.unstubAllGlobals());
describe('website edit/delete automation hold', () => {
  it('authenticates the hold and fails closed before caller writes when the API denies it', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 403 })); vi.stubGlobal('fetch', fetcher);
    const write = vi.fn();
    await expect((async () => { await prepareMccheyneManualChange({ getIdToken: async () => 'test-token' }, 'post_12345678', 'delete'); write(); })()).rejects.toThrow('보류하지 못했습니다');
    expect(write).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledWith('/api/mccheyne/sync', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }), body: JSON.stringify({ action: 'manual-delete', id: 'post_12345678' }) }));
  });
});
