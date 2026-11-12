import { describe, expect, it, vi } from 'vitest';
import { preparePostPublication } from '../scripts/prepare-post-publication.mjs';

const rows = [undefined, { booleanValue: false }, { booleanValue: true }, { stringValue: 'draft' }].map((value, i) => ({
  document: { name: `projects/test/databases/test/documents/posts/${i}`, updateTime: '2026-10-27T00:00:00Z', fields: value ? { isPublished: value } : {} },
}));

describe('legacy publication preparation', () => {
  it('audits without writing or returning post data', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(rows)));
    expect(await preparePostPublication('test', { request })).toEqual({ scanned: 4, missing: 1, draft: 1, published: 1, invalid: 1, updated: 0 });
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0][0]).toMatch(/:runQuery$/);
  });
  it('only sets absent flags and requires the original document version', async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(rows))).mockResolvedValueOnce(new Response('{}'));
    expect((await preparePostPublication('test', { apply: true, request })).updated).toBe(1);
    const commit = JSON.parse(request.mock.calls[1][1].body);
    expect(commit.writes).toEqual([{ update: { name: rows[0].document.name, fields: { isPublished: { booleanValue: true } } }, updateMask: { fieldPaths: ['isPublished'] }, currentDocument: { updateTime: rows[0].document.updateTime } }]);
  });
  it('stops on a concurrent edit instead of retrying and potentially publishing a new draft', async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(rows))).mockResolvedValueOnce(new Response('{}', { status: 409 }));
    await expect(preparePostPublication('test', { apply: true, request })).rejects.toThrow('409');
    expect(request).toHaveBeenCalledTimes(2);
  });
});
