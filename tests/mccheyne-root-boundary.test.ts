import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Socket } from 'node:net';
import { createDriveReader } from '../netlify/functions/_shared/mccheyne-drive.mts';
import { APPROVED_FOLDER, APPROVED_FOLDER_YEARS, SOURCE_FOLDER, assertApprovedFile, type FileMeta } from '../netlify/functions/_shared/mccheyne-sync-core.mts';

let networkAttempts = 0;
beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn(() => { networkAttempts++; throw new Error('NETWORK_FORBIDDEN'); }));
  vi.spyOn(Socket.prototype, 'connect').mockImplementation(() => { networkAttempts++; throw new Error('NETWORK_FORBIDDEN'); });
});
afterAll(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); expect(networkAttempts).toBe(0); });
const folder = (id: string, parent = id === APPROVED_FOLDER ? SOURCE_FOLDER : APPROVED_FOLDER) => ({ id, mimeType: 'application/vnd.google-apps.folder', trashed: false, parents: [parent] });
const hiddenRoot = { id: APPROVED_FOLDER, mimeType: 'application/vnd.google-apps.folder', trashed: false };
const document: FileMeta = { id: 'document_12345', mimeType: 'application/vnd.google-apps.document', trashed: false, parents: [APPROVED_FOLDER], name: 'synthetic', version: '1', modifiedTime: '2026-10-27T00:00:00Z' };
function fixture(root: unknown = hiddenRoot, yearOverride?: unknown, listed?: unknown) {
  const request = vi.fn(async (url: string) => {
    const u = new URL(url);
    if (u.pathname === '/drive/v3/files') {
      const parent = u.searchParams.get('q')!.split("'")[1];
      return { files: listed === undefined ? [{ ...document, id: 'document_' + parent, parents: [parent] }] : [listed] };
    }
    const id = u.pathname.split('/').pop()!;
    expect(id).not.toBe(SOURCE_FOLDER);
    return id === APPROVED_FOLDER ? root : yearOverride === undefined ? folder(id) : yearOverride;
  });
  return { request, reader: createDriveReader(request) };
}
describe('fixed approved root with hidden outer-parent metadata', () => {
  it('accepts the observed root shape while retaining all four exact scopes', async () => {
    const x = fixture(); const files = await x.reader.list();
    expect(files.map(f => f.parents[0])).toEqual(Object.keys(APPROVED_FOLDER_YEARS));
    expect(x.request.mock.calls).toHaveLength(8);
    expect(x.request.mock.calls.some(([url]) => url.includes('/files/' + SOURCE_FOLDER))).toBe(false);
  });
  it('still accepts a visible correct root parent', async () => {
    expect(await fixture(folder(APPROVED_FOLDER)).reader.list()).toHaveLength(4);
  });
  it.each([
    ['empty parents', { ...hiddenRoot, parents: [] }],
    ['different parent', folder(APPROVED_FOLDER, 'outside_parent')],
    ['multiple parents', { ...hiddenRoot, parents: [SOURCE_FOLDER, 'outside_parent'] }],
    ['null parents', { ...hiddenRoot, parents: null }],
    ['undefined parents property', { ...hiddenRoot, parents: undefined }],
    ['string parents', { ...hiddenRoot, parents: SOURCE_FOLDER }],
    ['array-like parents', { ...hiddenRoot, parents: { 0: SOURCE_FOLDER, length: 1 } }],
    ['wrong ID', { ...hiddenRoot, id: 'wrong_root_id' }],
    ['wrong type', { ...hiddenRoot, mimeType: 'text/plain' }],
    ['shortcut', { ...hiddenRoot, mimeType: 'application/vnd.google-apps.shortcut' }],
    ['trashed', { ...hiddenRoot, trashed: true }],
    ['malformed trash value', { ...hiddenRoot, trashed: 0 }],
    ['null metadata', null],
    ['array metadata', []],
    ['empty metadata', {}],
  ])('rejects root %s without making another request', async (_name, root) => {
    const x = fixture(root);
    await expect(x.reader.list()).rejects.toMatchObject({ code: 'APPROVAL_FOLDER_CHANGED' });
    expect(x.request).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['missing', {}], ['empty', { parents: [] }], ['different', { parents: ['outside_parent'] }],
    ['malformed', { parents: { 0: APPROVED_FOLDER, length: 1 } }],
  ])('does not grant the root exception to a year folder with %s parents', async (_name, props) => {
    const id = Object.keys(APPROVED_FOLDER_YEARS)[1];
    const x = fixture(hiddenRoot, { id, mimeType: 'application/vnd.google-apps.folder', trashed: false, ...props });
    await expect(x.reader.list()).rejects.toMatchObject({ code: 'APPROVAL_FOLDER_CHANGED' });
    expect(x.request.mock.calls.some(([url]) => url.includes('docs.googleapis.com'))).toBe(false);
  });
  it.each([
    ['missing', undefined], ['empty', []], ['different', ['outside_parent']],
    ['nested', ['unapproved_nested_folder']], ['array-like', { 0: APPROVED_FOLDER, length: 1 }],
  ])('rejects a listed document with %s parents', async (_name, parents) => {
    const x = fixture(hiddenRoot, undefined, { ...document, parents });
    await expect(x.reader.list()).rejects.toMatchObject({ code: 'APPROVAL_FOLDER_CHANGED' });
  });
  it('keeps direct source validation strict for omitted/malformed parents, shortcuts and versions', () => {
    for (const candidate of [
      { ...document, parents: undefined }, { ...document, parents: [] },
      { ...document, parents: { 0: APPROVED_FOLDER, length: 1 } },
      { ...document, parents: ['unapproved_nested_folder'] },
      { ...document, mimeType: 'application/vnd.google-apps.shortcut' },
      { ...document, id: 1234567890123 }, { ...document, version: 1 },
      { ...document, modifiedTime: 1793068800000 }, { ...document, trashed: '' },
    ]) expect(() => assertApprovedFile(candidate as unknown as FileMeta)).toThrow();
  });
});
