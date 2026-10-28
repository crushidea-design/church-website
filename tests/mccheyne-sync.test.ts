import { describe, expect, it, vi } from 'vitest';
import { APPROVED_FOLDER, APPROVED_FOLDER_YEARS, SOURCE_FOLDER, DOC_MIME, SyncError, extractSnapshot, parseGuide, runSync, type FileMeta, type RecordState, type SourceReader, type SyncStore } from '../netlify/functions/_shared/mccheyne-sync-core.mts';
import { createDriveReader } from '../netlify/functions/_shared/mccheyne-drive.mts';

const meta = (id = 'document_12345', version = '1'): FileMeta => ({ id, name: 'guide', version, parents: [APPROVED_FOLDER], mimeType: DOC_MIME, modifiedTime: '2026-10-27T00:00:00Z' });
const native = (id: string, heading = '2026년 12월 3일 역대하 2장 제목') => ({ documentId: id, revisionId: 'r1', tabs: [{ documentTab: {
  body: { content: [{ paragraph: { elements: [{ textRun: { content: heading } }] } },
    { paragraph: { elements: [{ textRun: { content: '본문' } }, { footnoteReference: { footnoteId: 'f1' } }, { textRun: { content: ' 끝' } }] } }] },
  footnotes: { f1: { content: [{ paragraph: { elements: [{ textRun: { content: '검수 각주 절대 게시 금지' } }] } }] } },
} }] });
function setup(headings = ['2026년 12월 3일 역대하 2장 제목']) {
  let time = 1_000_000;
  const files = headings.map((_, i) => meta(`document_${10000 + i}`));
  const states = new Map<string, RecordState>();
  let lock: string | null = null;
  let serial = 0;
  const control: { stopped: boolean; cursor?: string } = { stopped: false };
  const reader: SourceReader = {
    list: vi.fn(async () => files), snapshot: vi.fn(async id => { const i = files.findIndex(f => f.id === id); return extractSnapshot(files[i], native(id, headings[i])); }),
    unchanged: vi.fn(async () => true), approvedMove: vi.fn(async () => true),
  };
  const store: SyncStore = {
    siteState: vi.fn(async () => ({})),
    stop: vi.fn(async () => { control.stopped = true; }),
    control: vi.fn(async () => ({ ...control })),
    beginItem: vi.fn(async (id, lease, advanceCursor = true) => { if (lease !== lock) throw new SyncError('STALE_RUN'); if (control.stopped) throw new SyncError('STOPPED', false, true); if (advanceCursor) control.cursor = id; }),
    acquire: vi.fn(async () => { if (lock) return null; lock = `run${++serial}`; return lock; }),
    release: vi.fn(async lease => { if (lease === lock) lock = null; }),
    load: vi.fn(async id => states.get(id)),
    save: vi.fn(async (s, lease) => { if (lease !== lock) throw new SyncError('STALE_RUN'); states.set(s.id, structuredClone(s)); }),
    publish: vi.fn(async (g, s, lease) => { if (lease !== lock) throw new SyncError('STALE_RUN'); states.set(s.id, { ...s, status: 'success', publishedHash: s.sourceHash, postId: `post-${g.source_id}` }); return `post-${g.source_id}`; }),
    conflict: vi.fn(async () => false), summary: vi.fn(async () => {}),
  };
  const run = (mode: 'publish' | 'dry_run' = 'publish') => runSync(reader, store, mode, { now: () => time, sleep: async () => {} });
  return { files, states, reader, store, control, run, tick: () => { time += 120_000; } };
}
describe('approved document extraction', () => {
  it('excludes native footnote references and footnote bodies', () => {
    const s = extractSnapshot(meta(), native(meta().id));
    expect(s.text).toContain('본문 끝'); expect(s.text).not.toContain('검수 각주');
    expect(parseGuide(s)).toMatchObject({ date: '2026-12-03', passage: '역대하 2장', title: '제목', status: 'published', content: '본문 끝' });
  });
  it('uses the confirmed fixed root year, not the clock or an administrator override', () => {
    const s = extractSnapshot(meta(), native(meta().id, '12월 3일 역대하 2장 제목'));
    expect(parseGuide(s).date).toBe('2026-12-03');
    expect(() => parseGuide(s, '2027-12-03')).toThrow('YEAR_FOLDER_MISMATCH');
    expect(() => parseGuide(s, '2026-12-04')).toThrow('DATE_MISMATCH');
  });
  it('works with Viewer documents that omit editor-only revisionId', () => {
    const d = native(meta().id); const viewerDoc = { ...d }; Reflect.deleteProperty(viewerDoc, 'revisionId');
    expect(extractSnapshot(meta(), viewerDoc).sourceHash).toBe(extractSnapshot(meta(), d).sourceHash);
  });
  it('rejects nonexistent dates and non-approval folders', () => {
    expect(() => parseGuide(extractSnapshot(meta(), native(meta().id, '2026년 2월 30일 역대하 2장 제목')))).toThrow('INVALID_CONTENT');
    expect(() => extractSnapshot({ ...meta(), parents: ['draft-folder'] }, native(meta().id))).toThrow('OUTSIDE_APPROVED_FOLDER');
  });
  it('holds multiple tabs and unresolved suggestions', () => {
    const d = native(meta().id); d.tabs.push(d.tabs[0]);
    expect(() => extractSnapshot(meta(), d)).toThrow('MULTIPLE_TABS');
    const suggestion = native(meta().id); Object.assign(suggestion.tabs[0].documentTab.body.content[0].paragraph.elements[0], { suggestedInsertionIds: ['x'] });
    expect(() => extractSnapshot(meta(), suggestion)).toThrow('UNRESOLVED_SUGGESTIONS');
  });
});
describe('batch processing and approval boundaries', () => {
  it('publishes only the exact ID/date and preserves the batch cursor and other source states', async () => {
    const x = setup(['10월 28일 열왕기하 9장 이전', '10월 29일 열왕기하 10장 대상', '10월 30일 열왕기하 11장 다음']);
    x.control.cursor = x.files[2].id;
    const target = { id: x.files[1].id, date: '2026-10-29' };
    const result = await runSync(x.reader, x.store, 'publish', { target });
    expect(result).toMatchObject({ code: 'COMPLETE', scanned: 1, success: 1, pending: 0 });
    expect(result.cursor).toBeUndefined(); expect(x.control.cursor).toBe(x.files[2].id);
    expect([...x.states.keys()]).toEqual([target.id]);
    expect(x.reader.snapshot).toHaveBeenCalledExactlyOnceWith(target.id);
    expect(x.store.publish).toHaveBeenCalledOnce();
    expect(vi.mocked(x.store.publish).mock.calls[0][0]).toMatchObject({ source_id: target.id, date: target.date });
    expect(await runSync(x.reader, x.store, 'publish', { target })).toMatchObject({ skipped: 1, success: 0 });
    expect(x.store.publish).toHaveBeenCalledOnce();
  });
  it('never substitutes a different document when the selected ID is absent or duplicated', async () => {
    for (const duplicate of [false, true]) {
      const x = setup(); const id = duplicate ? x.files[0].id : 'missing_document';
      if (duplicate) x.files.push(x.files[0]);
      expect(await runSync(x.reader, x.store, 'publish', { target: { id, date: '2026-12-03' } })).toMatchObject({ scanned: 0, success: 0, code: duplicate ? 'AMBIGUOUS_SINGLE_TARGET' : 'SINGLE_TARGET_NOT_FOUND' });
      expect(x.reader.snapshot).not.toHaveBeenCalled(); expect(x.store.save).not.toHaveBeenCalled(); expect(x.store.beginItem).not.toHaveBeenCalled();
    }
  });
  it('rejects malformed single targets before storage or Drive access', async () => {
    const x = setup();
    for (const target of [{ id: '../outside', date: '2026-10-29' }, { id: x.files[0].id, date: '2026-02-30' }]) {
      await expect(runSync(x.reader, x.store, 'publish', { target })).rejects.toThrow('INVALID_SINGLE_TARGET');
    }
    expect(x.store.acquire).not.toHaveBeenCalled(); expect(x.reader.list).not.toHaveBeenCalled();
  });
  it('holds date/ID mismatches, unsafe folders, absent approval, and manual conflicts without falling through', async () => {
    for (const reason of ['date', 'id', 'folder', 'approval', 'conflict', 'edited']) {
      const x = setup(['10월 29일 열왕기하 10장 대상', '10월 30일 열왕기하 11장 다른 문서']);
      if (reason === 'folder') x.files[0].parents = ['unapproved_folder'];
      if (reason === 'approval') vi.mocked(x.reader.approvedMove).mockResolvedValue(false);
      if (reason === 'conflict') vi.mocked(x.store.conflict).mockResolvedValue(true);
      if (reason === 'edited') vi.mocked(x.store.siteState).mockResolvedValue({ code: 'SITE_POST_EDITED', version: 'manual' });
      if (reason === 'id') vi.mocked(x.reader.snapshot).mockResolvedValue(extractSnapshot(x.files[1], native(x.files[1].id, '10월 29일 열왕기하 10장 다른 ID')));
      const result = await runSync(x.reader, x.store, 'publish', { target: { id: x.files[0].id, date: reason === 'date' ? '2026-10-30' : '2026-10-29' } });
      expect(result.success).toBe(0); expect(result.scanned).toBe(1); expect(result.held + result.failed).toBe(1);
      expect(x.store.publish).not.toHaveBeenCalled(); expect([...x.states.keys()]).toEqual([x.files[0].id]); expect(x.control.cursor).toBeUndefined();
    }
  });
  it('checks website changes before skipping an unchanged Drive version', async () => {
    const x = setup(); await x.run();
    vi.mocked(x.store.siteState).mockResolvedValue({ code: 'SITE_POST_DELETED', version: 'deleted-version' });
    expect(await x.run()).toMatchObject({ held: 1, success: 0 });
    expect(x.store.publish).toHaveBeenCalledTimes(1); expect(x.reader.snapshot).toHaveBeenCalledTimes(1);
    expect(x.states.get(x.files[0].id)?.code).toBe('SITE_POST_DELETED');
  });
  it('caps each run at 20 documents and fairly resumes past a repeatedly failing first item', async () => {
    const x = setup(Array.from({ length: 45 }, (_, i) => i === 0 ? '잘못된 제목' : '12월 3일 역대하 2장 제목'));
    expect(await x.run()).toMatchObject({ scanned: 20, success: 19, held: 1, pending: 25, code: 'MORE_PENDING' });
    expect(await x.run()).toMatchObject({ scanned: 20, success: 20, pending: 5 });
    expect(await x.run()).toMatchObject({ scanned: 5, success: 5, pending: 0, code: 'COMPLETE' });
    expect(x.store.publish).toHaveBeenCalledTimes(44);
    expect(x.reader.snapshot).toHaveBeenCalledTimes(45);
  });
  it('continues after a deleted cursor and does not depend on listing order or duplicate entries', async () => {
    const x = setup(Array(22).fill('12월 3일 역대하 2장 제목'));
    await x.run();
    const deleted = x.control.cursor;
    x.files.splice(x.files.findIndex(f => f.id === deleted), 1);
    x.files.reverse(); x.files.push(x.files[0]);
    expect((await x.run()).success).toBe(2);
    expect(x.store.publish).toHaveBeenCalledTimes(22);
  });
  it('blocks new work when stopped, and checks again between documents', async () => {
    const x = setup(Array(3).fill('12월 3일 역대하 2장 제목'));
    x.control.stopped = true;
    expect((await x.run()).code).toBe('STOPPED'); expect(x.reader.list).not.toHaveBeenCalled();
    x.control.stopped = false;
    const publish = x.store.publish;
    vi.mocked(x.store.publish).mockImplementationOnce(async (...args) => { x.control.stopped = true; return `post-${args[0].source_id}`; });
    expect(await x.run()).toMatchObject({ code: 'STOPPED', scanned: 1, success: 1, pending: 2 });
    expect(x.reader.snapshot).toHaveBeenCalledTimes(1); expect(publish).toHaveBeenCalledTimes(1);
  });
  it('advances the cursor before a global failure so the same item cannot monopolize future runs', async () => {
    const x = setup(Array(2).fill('12월 3일 역대하 2장 제목'));
    vi.mocked(x.reader.snapshot).mockRejectedValueOnce(new SyncError('DRIVE_AUTH_REQUIRED', false, true));
    expect((await x.run()).code).toBe('DRIVE_AUTH_REQUIRED');
    expect(x.control.cursor).toBe(x.files[0].id);
    expect((await x.run()).success).toBe(1);
    expect((await x.run()).success).toBe(1);
    expect(vi.mocked(x.reader.snapshot).mock.calls.map(c => c[0])).toEqual([x.files[0].id, x.files[1].id, x.files[0].id]);
  });
  it('applies fixed folder years and holds explicitly conflicting document years', async () => {
    const x = setup(['12월 1일 역대하 1장 루트', '12월 2일 역대하 2장 둘째', '2028년 12월 3일 역대하 3장 충돌']);
    x.files[1].parents = ['1bk7elOmPgB6Yyk6om2VQ4oowQoOP59xt'];
    x.files[2].parents = ['1bk7elOmPgB6Yyk6om2VQ4oowQoOP59xt'];
    expect(await x.run()).toMatchObject({ held: 1, success: 2 });
    expect(vi.mocked(x.store.publish).mock.calls.map(c => c[0].date)).toEqual(['2026-12-01', '2027-12-02']);
    expect(x.states.get(x.files[2].id)?.code).toBe('YEAR_FOLDER_MISMATCH');
  });
  it('binds approval to the exact folder even if a move returned the same version', async () => {
    const x = setup(['12월 3일 역대하 2장 제목']); await x.run();
    x.files[0].parents = ['1bk7elOmPgB6Yyk6om2VQ4oowQoOP59xt'];
    expect((await x.run()).held).toBe(1); expect(x.store.publish).toHaveBeenCalledTimes(1);
    expect(x.states.get(x.files[0].id)?.code).toBe('REAPPROVAL_REQUIRED');
  });
  it('publishes multiple past/today/future documents without date windows', async () => {
    const x = setup(['2026년 1월 1일 창세기 1장 과거', '2026년 10월 27일 열왕기하 8장 오늘', '2026년 12월 3일 역대하 2장 미래']);
    expect((await x.run()).success).toBe(3);
    expect(vi.mocked(x.store.publish).mock.calls.map(c => c[0].date)).toEqual(['2026-01-01', '2026-10-27', '2026-12-03']);
  });
  it('does not reread unchanged successful documents or call publication again', async () => {
    const x = setup(); await x.run(); expect((await x.run()).skipped).toBe(1);
    expect(x.reader.snapshot).toHaveBeenCalledTimes(1); expect(x.store.publish).toHaveBeenCalledTimes(1);
  });
  it('dry run validates but never publishes, then can publish the same version', async () => {
    const x = setup(); await x.run('dry_run'); await x.run('dry_run');
    expect(x.store.publish).not.toHaveBeenCalled(); expect(x.reader.snapshot).toHaveBeenCalledTimes(1);
    expect((await x.run()).success).toBe(1);
  });
  it('isolates malformed files and continues with valid files', async () => {
    const x = setup(['날짜가 불분명한 제목', '2026년 12월 3일 역대하 2장 정상']);
    expect(await x.run()).toMatchObject({ held: 1, success: 1 });
  });
  it('holds legacy/manual collisions without overwriting or creating', async () => {
    const x = setup(); vi.mocked(x.store.conflict).mockResolvedValue(true);
    expect((await x.run()).held).toBe(1); expect(x.store.publish).not.toHaveBeenCalled();
    expect(x.states.get(x.files[0].id)?.code).toBe('EXISTING_POST_REQUIRES_LINK');
  });
  it('keeps published content when the source changes until the exact new version is approved', async () => {
    const x = setup(); await x.run(); x.files[0].version = '2';
    expect((await x.run()).held).toBe(1); expect(x.store.publish).toHaveBeenCalledTimes(1);
    const state = x.states.get(x.files[0].id)!;
    expect(state.code).toBe('REAPPROVAL_REQUIRED'); expect(state.postId).toBeDefined();
    state.approvedHash = state.sourceHash; state.status = 'ready'; state.attempts = 0;
    expect((await x.run()).success).toBe(1); expect(x.store.publish).toHaveBeenCalledTimes(2);
  });
  it('does not treat mere folder membership as version approval', async () => {
    const x = setup(); vi.mocked(x.reader.approvedMove).mockResolvedValue(false);
    expect((await x.run()).failed).toBe(1); expect(x.states.get(x.files[0].id)?.code).toBe('APPROVAL_EVIDENCE_REQUIRED');
    x.tick(); vi.mocked(x.reader.approvedMove).mockResolvedValue(true);
    expect((await x.run()).success).toBe(1);
  });
  it('bounds missing movement evidence rechecks without publishing or rereading forever', async () => {
    const x = setup(); vi.mocked(x.reader.approvedMove).mockResolvedValue(false);
    for (let i = 0; i < 4; i++) { await x.run(); x.tick(); }
    expect(x.reader.snapshot).toHaveBeenCalledTimes(3); expect(x.store.publish).not.toHaveBeenCalled();
    expect(x.states.get(x.files[0].id)?.attempts).toBe(3);
  });
  it('blocks a change after preview and documents outside the folder', async () => {
    const x = setup(); vi.mocked(x.reader.unchanged).mockResolvedValue(false);
    expect((await x.run()).held).toBe(1); expect(x.store.publish).not.toHaveBeenCalled();
    const y = setup(); y.files[0].parents = ['draft']; expect((await y.run()).held).toBe(1); expect(y.store.publish).not.toHaveBeenCalled();
  });
  it('returns BUSY for concurrent runs', async () => {
    const x = setup(); let release!: () => void;
    vi.mocked(x.reader.list).mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(x.files); }));
    const first = x.run(); await Promise.resolve(); await Promise.resolve();
    expect((await x.run()).code).toBe('BUSY'); release(); await first;
    expect(x.store.publish).toHaveBeenCalledTimes(1);
  });
  it('bounds transient publication retries and permits the next document to succeed', async () => {
    const x = setup(['2026년 12월 2일 역대하 1장 첫글', '2026년 12월 3일 역대하 2장 둘째']);
    vi.mocked(x.store.publish).mockImplementation(async (g, s, l) => { if (g.source_id === x.files[0].id) throw new SyncError('TEMPORARY', true); return `ok-${l}-${s.id}`; });
    expect(await x.run()).toMatchObject({ failed: 1, success: 1 }); expect(x.store.publish).toHaveBeenCalledTimes(4);
    x.tick(); await x.run(); expect(x.states.get(x.files[0].id)?.attempts).toBe(3);
  });
  it('recovers from a transient failure using the same source identity', async () => {
    const x = setup(); vi.mocked(x.store.publish).mockRejectedValueOnce(new SyncError('TEMPORARY', true));
    expect((await x.run()).success).toBe(1);
    expect(vi.mocked(x.store.publish).mock.calls.map(c => c[0].source_id)).toEqual([x.files[0].id, x.files[0].id]);
  });
  it('stops on global authentication failures and does not leak error text into status or logs', async () => {
    const x = setup(['2026년 12월 2일 역대하 1장 첫글', '2026년 12월 3일 역대하 2장 둘째']);
    vi.mocked(x.reader.snapshot).mockRejectedValueOnce(new SyncError('DRIVE_AUTH_REQUIRED', false, true));
    expect((await x.run()).code).toBe('DRIVE_AUTH_REQUIRED'); expect(x.reader.snapshot).toHaveBeenCalledTimes(1);
    const y = setup(); vi.mocked(y.reader.snapshot).mockRejectedValue(new Error('secret-key-full-document'));
    const log = vi.spyOn(console, 'error'); const result = await y.run();
    expect(JSON.stringify([result, [...y.states.values()]])).not.toContain('secret-key-full-document'); expect(log).not.toHaveBeenCalled(); log.mockRestore();
  });
});

describe('read-only Drive adapter', () => {
  it('treats a missing configured approver as a global setup issue, not per-document failure', async () => {
    vi.stubEnv('MCCHEYNE_APPROVER_PERSON', ''); const request = vi.fn();
    await expect(createDriveReader(request).approvedMove(meta())).rejects.toMatchObject({ code: 'APPROVER_NOT_CONFIGURED', global: true });
    expect(request).not.toHaveBeenCalled(); vi.unstubAllEnvs();
  });
  const folderMeta = (id: string, parent = id === APPROVED_FOLDER ? SOURCE_FOLDER : APPROVED_FOLDER) => ({ id, name: String(APPROVED_FOLDER_YEARS[id]), parents: [parent], mimeType: 'application/vnd.google-apps.folder' });
  it('lists only the four exact scopes without discovering folders by name or recursing', async () => {
    const folders = Object.keys(APPROVED_FOLDER_YEARS);
    const request = vi.fn(async (url: string) => {
      const u = new URL(url);
      if (u.pathname === '/drive/v3/files') {
        const id = u.searchParams.get('q')!.split("'")[1];
        expect(folders).toContain(id);
        return { files: [{ ...meta(`document_${folders.indexOf(id)}_12345`), parents: [id] }, folderMeta('unapproved_folder_2027')] };
      }
      return folderMeta(u.pathname.split('/').pop()!);
    });
    const files = await createDriveReader(request).list();
    expect(files).toHaveLength(4);
    expect(files.map(f => parseGuide(extractSnapshot(f, native(f.id, '12월 3일 역대하 2장 제목'))).date)).toEqual(['2026-12-03', '2026-12-03', '2027-12-03', '2028-12-03']);
    expect(request.mock.calls.filter(c => new URL(c[0]).pathname === '/drive/v3/files')).toHaveLength(4);
  });
  it('rejects a known year folder if its actual parent is outside the approved root', async () => {
    const id = '1bk7elOmPgB6Yyk6om2VQ4oowQoOP59xt';
    const file = { ...meta(), parents: [id] };
    const request = vi.fn(async (url: string) => {
      const requested = new URL(url).pathname.split('/').pop();
      return requested === file.id ? file : requested === APPROVED_FOLDER ? folderMeta(APPROVED_FOLDER) : folderMeta(id, 'outside_parent');
    });
    await expect(createDriveReader(request).snapshot(file.id)).rejects.toThrow('APPROVAL_FOLDER_CHANGED');
    expect(request.mock.calls.some(c => c[0].includes('docs.googleapis.com'))).toBe(false);
  });
  it('rejects same-named external folders, deeper descendants, and shortcuts without reading target bodies', async () => {
    for (const file of [{ ...meta(), parents: ['same_name_2027'] }, { ...meta(), parents: ['nested_inside_year'] }, { ...meta(), mimeType: 'application/vnd.google-apps.shortcut', shortcutDetails: { targetId: 'outside_document' } }]) {
      const request = vi.fn().mockResolvedValue(file);
      await expect(createDriveReader(request).snapshot(file.id)).rejects.toThrow(); expect(request).toHaveBeenCalledTimes(1);
    }
  });
  it('requires movement into the exact current year folder, not an older root approval', async () => {
    vi.stubEnv('MCCHEYNE_APPROVER_PERSON', 'people/approved');
    const year = '1bk7elOmPgB6Yyk6om2VQ4oowQoOP59xt';
    const file = { ...meta(), parents: [year] };
    const action = { timestamp: '2026-10-27T00:00:01Z', target: { driveItem: { name: `items/${file.id}` } }, actor: { user: { knownUser: { personName: 'people/approved' } } }, detail: { move: { addedParents: [{ driveItem: { name: `items/${APPROVED_FOLDER}` } }] } } };
    const reader = createDriveReader(vi.fn(async () => ({ activities: [{ actions: [action] }] })));
    expect(await reader.approvedMove(file)).toBe(false);
    action.detail.move.addedParents[0].driveItem.name = `items/${year}`;
    expect(await reader.approvedMove(file)).toBe(true);
    expect(await reader.approvedMove({ ...file, modifiedTime: action.timestamp })).toBe(false);
    vi.unstubAllEnvs();
  });
  it('rejects a changed snapshot and never accepts an outside file', async () => {
    const root = { id: APPROVED_FOLDER, parents: [SOURCE_FOLDER], mimeType: 'application/vnd.google-apps.folder' };
    const request = vi.fn().mockResolvedValueOnce(meta()).mockResolvedValueOnce(root).mockResolvedValueOnce(native(meta().id)).mockResolvedValueOnce(meta(meta().id, '2')).mockResolvedValueOnce(root);
    await expect(createDriveReader(request).snapshot(meta().id)).rejects.toThrow('SOURCE_CHANGED');
    const outside = vi.fn().mockResolvedValue({ ...meta(), parents: ['draft'] });
    await expect(createDriveReader(outside).snapshot(meta().id)).rejects.toThrow('OUTSIDE_APPROVED_FOLDER'); expect(outside).toHaveBeenCalledTimes(1);
  });
  it('requires precise approval movement evidence and rejects edits after the move', async () => {
    vi.stubEnv('MCCHEYNE_APPROVER_PERSON', 'people/approved');
    const activity = { activities: [{ actions: [{ timestamp: '2026-10-27T00:00:01Z', target: { driveItem: { name: `items/${meta().id}` } }, actor: { user: { knownUser: { personName: 'people/approved' } } }, detail: { move: { addedParents: [{ driveItem: { name: `items/${APPROVED_FOLDER}` } }] } } }] }] };
    const reader = createDriveReader(vi.fn().mockResolvedValue(activity));
    expect(await reader.approvedMove(meta())).toBe(true);
    expect(await reader.approvedMove({ ...meta(), modifiedTime: '2026-10-27T00:00:02Z' })).toBe(false);
    vi.unstubAllEnvs();
  });
});
