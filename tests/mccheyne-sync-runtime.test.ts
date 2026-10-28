import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ mode: 'dry_run', createStore: vi.fn(), createReader: vi.fn() }));
vi.mock('../netlify/functions/_shared/firebase-admin.mjs', () => ({ initializeFirebaseAdmin: () => true, getEnv: () => mocks.mode, getAppDb: vi.fn() }));
vi.mock('../netlify/functions/_shared/mccheyne-sync-store.mjs', () => ({ createSyncStore: mocks.createStore, CONTROL_COLLECTION: '_mccheyne_sync_control', STATE_COLLECTION: '_mccheyne_sync_sources' }));
vi.mock('../netlify/functions/_shared/mccheyne-drive.mjs', () => ({ createDriveReader: mocks.createReader }));
import { APPROVED_FOLDER, DOC_MIME, type RecordState } from '../netlify/functions/_shared/mccheyne-sync-core.mts';
import { approveSource, executeSync, stopSync } from '../netlify/functions/_shared/mccheyne-sync-runtime.mts';
import { createReadOnlySyncStore } from '../netlify/functions/_shared/mccheyne-read-only-store.mts';
const meta = { id: 'document_12345', name: 'fixture', parents: [APPROVED_FOLDER], mimeType: DOC_MIME, version: '1', modifiedTime: '2026-10-27T00:00:00Z' };
beforeEach(() => { vi.clearAllMocks(); mocks.mode = 'dry_run'; });
describe('write-free runtime trial', () => {
  it('runs the real processing path without any persistent lease, approval, receipt, summary, or publication writes', async () => {
    const store = { siteState: vi.fn(async () => ({})), control: vi.fn(async () => ({ stopped: false })), beginItem: vi.fn(), stop: vi.fn(), load: vi.fn(async () => undefined), conflict: vi.fn(async () => false), acquire: vi.fn(), save: vi.fn(), publish: vi.fn(), release: vi.fn(), summary: vi.fn() };
    mocks.createStore.mockReturnValue(store);
    mocks.createReader.mockReturnValue({ list: async () => [meta], snapshot: async () => ({ meta, sourceHash: 'a'.repeat(64), text: '10월 23일 열왕기하 4장 시험\n\n시험 본문' }), approvedMove: async () => true, unchanged: async () => true });
    const result = await executeSync();
    expect(result).toMatchObject({ mode: 'dry_run', success: 1, records: [{ id: meta.id, status: 'dry_run', code: 'WOULD_PUBLISH', date: '2026-10-23' }] });
    for (const action of [store.acquire, store.save, store.publish, store.release, store.summary, store.beginItem, store.stop]) expect(action).not.toHaveBeenCalled();
    expect(store.load).toHaveBeenCalled(); expect(store.conflict).toHaveBeenCalled();
    expect(JSON.stringify(result).includes('시험 본문')).toBe(false); expect(JSON.stringify(result).includes('approvedHash')).toBe(false);
  });
  it('rejects approval writes in dry-run mode before opening any store or source reader', async () => {
    await expect(approveSource(meta.id, 'a'.repeat(64), '2026-10-23', 'admin')).rejects.toThrow('READ_ONLY_MODE');
    expect(mocks.createStore).not.toHaveBeenCalled(); expect(mocks.createReader).not.toHaveBeenCalled();
  });
  it('does nothing when off and prevents accidental publication even through the read-only adapter', async () => {
    mocks.mode = 'off'; expect(await executeSync()).toEqual({ code: 'DISABLED', mode: 'off' }); expect(mocks.createStore).not.toHaveBeenCalled();
    const state: RecordState = { id: meta.id, name: meta.name, version: '1', status: 'held', code: 'HOLD', updatedAt: 0 };
    const base = { siteState: async () => ({}), control: async () => ({ stopped: false }), load: async () => state, conflict: async () => false };
    const trial = createReadOnlySyncStore(base); const loaded = (await trial.store.load(meta.id))!; loaded.status = 'ready';
    expect(state.status).toBe('held');
    await expect(trial.store.publish({ source_id: meta.id, date: '2026-10-23', passage: '열왕기하 4장', title: '시험', content: '시험 본문', status: 'published' }, state, 'unused')).rejects.toThrow('READ_ONLY_MODE');
  });
  it('writes the stop latch only for active publishing and never changes dry-run/off state', async () => {
    await expect(stopSync('admin')).rejects.toThrow('READ_ONLY_MODE');
    mocks.mode = 'off'; expect(await stopSync('admin')).toEqual({ code: 'DISABLED' });
    expect(mocks.createStore).not.toHaveBeenCalled();
    const stop = vi.fn(async () => {}); mocks.createStore.mockReturnValue({ stop }); mocks.mode = 'publish';
    expect(await stopSync('verified-admin')).toEqual({ code: 'STOPPED' }); expect(stop).toHaveBeenCalledWith('verified-admin');
  });
  it('requires the exact website version from preview before approving replacement or recreation', async () => {
    mocks.mode = 'publish';
    const store = { acquire: vi.fn(async () => 'lease'), release: vi.fn(), siteState: vi.fn(async () => ({ code: 'SITE_POST_DELETED', version: 'b'.repeat(64) })), conflict: vi.fn(async () => false), load: vi.fn(async () => undefined), save: vi.fn() };
    mocks.createStore.mockReturnValue(store);
    mocks.createReader.mockReturnValue({ snapshot: async () => ({ meta, sourceHash: 'a'.repeat(64), text: '10월 23일 열왕기하 4장 시험\n\n시험 본문' }), unchanged: async () => true });
    await expect(approveSource(meta.id, 'a'.repeat(64), '2026-10-23', 'admin')).rejects.toThrow('SITE_CHANGED');
    expect(store.save).not.toHaveBeenCalled(); expect(store.release).toHaveBeenCalledWith('lease');
    expect(await approveSource(meta.id, 'a'.repeat(64), '2026-10-23', 'admin', 'b'.repeat(64))).toEqual({ code: 'APPROVED' });
    expect(store.save).toHaveBeenCalledWith(expect.objectContaining({ approvedSiteVersion: 'b'.repeat(64), approvedBy: 'admin', status: 'ready' }), 'lease');
  });
  it('continues a read-only multi-page trial without persisting the cursor', async () => {
    const files = Array.from({ length: 23 }, (_, i) => ({ ...meta, id: `document_${10000 + i}` }));
    const store = { siteState: async () => ({}), control: async () => ({ stopped: false }), load: async () => undefined, conflict: async () => false, beginItem: vi.fn(), save: vi.fn() };
    mocks.createStore.mockReturnValue(store);
    mocks.createReader.mockReturnValue({ list: async () => files, snapshot: async (id: string) => ({ meta: files.find(f => f.id === id), sourceHash: 'a'.repeat(64), text: '10월 23일 열왕기하 4장 시험\n\n시험 본문' }), approvedMove: async () => true, unchanged: async () => true });
    const first = await executeSync(); expect(first).toMatchObject({ scanned: 20, pending: 3 });
    const second = await executeSync(undefined, 'cursor' in first ? first.cursor : undefined);
    expect(second).toMatchObject({ scanned: 3, pending: 0, success: 3 });
    expect(store.save).not.toHaveBeenCalled(); expect(store.beginItem).not.toHaveBeenCalled();
  });
});
