import { createHash } from 'node:crypto';
import { validatePublishRequest } from './mccheyne-publish-core.mjs';
import type { SiteState } from './mccheyne-site-state.mjs';

export const APPROVED_FOLDER = '1XxgBRwigRQmgGgk_mvXQBVUqen51iARX';
export const SOURCE_FOLDER = '1VWRtAD--dJVIsZOh7VNsDSPLO6UQYZMC';
// Only confirmed IDs belong here; never discover approval scopes by folder name.
export const APPROVED_FOLDER_YEARS: Readonly<Record<string, number>> = Object.freeze({
  [APPROVED_FOLDER]: 2026,
  '1RvlAR2viTF6gq8_tvYk2iCX_oFs1v18k': 2026,
  '1bk7elOmPgB6Yyk6om2VQ4oowQoOP59xt': 2027,
  '1DkgpaDyIjtZ9Qc_GkQYMwhq4xIKakju_': 2028,
});
export const DOC_MIME = 'application/vnd.google-apps.document';
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export class SyncError extends Error {
  constructor(public code: string, public transient = false, public global = false) { super(code); this.name = 'SyncError'; }
}
export const safeError = (error: unknown) => error instanceof SyncError ? error : new SyncError('INTERNAL_ERROR');
export type FileMeta = { id: string; name: string; mimeType: string; parents: string[]; version: string; modifiedTime: string; trashed?: boolean };
export type Snapshot = { meta: FileMeta; sourceHash: string; text: string };
export type Guide = { date: string; passage: string; title: string; content: string; source_id: string; status: 'published' };
export type RecordState = {
  id: string; name: string; version: string; folderId?: string; sourceHash?: string; status: 'held' | 'ready' | 'success' | 'failed' | 'dry_run';
  code: string; updatedAt: number; approvedHash?: string; approvedDate?: string; approvedBy?: string;
  publishedHash?: string; postId?: string; attempts?: number; nextAttemptAt?: number; approvedSiteVersion?: string;
};
export function approvedLocation(meta: FileMeta): { folderId: string; year: number } {
  const folderId = Array.isArray(meta?.parents) && meta.parents.length === 1 && typeof meta.parents[0] === 'string' ? meta.parents[0] : '';
  const year = APPROVED_FOLDER_YEARS[folderId];
  if (!year) throw new SyncError('OUTSIDE_APPROVED_FOLDER');
  return { folderId, year };
}
export function assertApprovedFile(meta: FileMeta) {
  approvedLocation(meta);
  if (typeof meta.id !== 'string' || !/^[A-Za-z0-9_-]{10,200}$/.test(meta.id) ||
    (Object.hasOwn(meta, 'trashed') && meta.trashed !== false)) throw new SyncError('OUTSIDE_APPROVED_FOLDER');
  if (meta.mimeType !== DOC_MIME) throw new SyncError('UNSUPPORTED_FILE');
  if (typeof meta.version !== 'string' || !meta.version || typeof meta.modifiedTime !== 'string' || !Number.isFinite(Date.parse(meta.modifiedTime))) throw new SyncError('MISSING_VERSION');
}

// Read only body paragraphs. Never descend into footnotes, headers, comments or suggestions.
// Ambiguous multi-tab/image/table documents are held instead of silently losing content.
export function extractSnapshot(meta: FileMeta, document: any): Snapshot {
  assertApprovedFile(meta);
  if (document.documentId !== meta.id) throw new SyncError('MISSING_VERSION');
  const tabs: any[] = [];
  const visit = (items: any[]) => { for (const tab of items) { if (tab.documentTab) tabs.push(tab.documentTab); visit(tab.childTabs || []); } };
  visit(document.tabs || []);
  if (tabs.length > 1) throw new SyncError('MULTIPLE_TABS');
  const body = tabs[0]?.body ?? document.body;
  const paragraphs: string[] = [];
  for (const element of body?.content || []) {
    if (element.table || element.tableOfContents) throw new SyncError('UNSUPPORTED_STRUCTURE');
    if (!element.paragraph) continue;
    if (Object.keys(element.paragraph).some(k => k.startsWith('suggested'))) throw new SyncError('UNRESOLVED_SUGGESTIONS');
    let line = '';
    for (const run of element.paragraph.elements || []) {
      if (Object.keys(run).some(k => k.startsWith('suggested')) || Object.keys(run.textRun || {}).some(k => k.startsWith('suggested'))) throw new SyncError('UNRESOLVED_SUGGESTIONS');
      if (run.footnoteReference) continue;
      if (run.inlineObjectElement || run.person || run.richLink) throw new SyncError('UNSUPPORTED_STRUCTURE');
      if (run.textRun) line += run.textRun.content;
    }
    if (line.trim()) paragraphs.push(line.trim());
  }
  const text = paragraphs.join('\n\n').replace(/^\uFEFF/, '');
  if (!text || text.length > 50000) throw new SyncError('INVALID_CONTENT');
  return { meta, text, sourceHash: hash(JSON.stringify([meta.id, meta.version, approvedLocation(meta), text])) };
}

const BOOKS = new Set('창세기 출애굽기 레위기 민수기 신명기 여호수아 사사기 룻기 사무엘상 사무엘하 열왕기상 열왕기하 역대상 역대하 에스라 느헤미야 에스더 욥기 시편 잠언 전도서 아가 이사야 예레미야 예레미야애가 에스겔 다니엘 호세아 요엘 아모스 오바댜 요나 미가 나훔 하박국 스바냐 학개 스가랴 말라기 마태복음 마가복음 누가복음 요한복음 사도행전 로마서 고린도전서 고린도후서 갈라디아서 에베소서 빌립보서 골로새서 데살로니가전서 데살로니가후서 디모데전서 디모데후서 디도서 빌레몬서 히브리서 야고보서 베드로전서 베드로후서 요한일서 요한이서 요한삼서 유다서 요한계시록'.split(' '));
export function parseGuide(snapshot: Snapshot, explicitDate?: string): Guide {
  const [heading, ...body] = snapshot.text.split('\n\n');
  const m = /^(?:(\d{4})년\s*)?(\d{1,2})월\s*(\d{1,2})일\s+([가-힣]+)\s+(\d+(?:\s*[-~–]\s*\d+)?(?:장|편))\s+(.+)$/.exec(heading);
  if (!m || !BOOKS.has(m[4])) throw new SyncError('INVALID_HEADING');
  const { year } = approvedLocation(snapshot.meta);
  if (m[1] && Number(m[1]) !== year) throw new SyncError('YEAR_FOLDER_MISMATCH');
  if (explicitDate && Number(explicitDate.slice(0, 4)) !== year) throw new SyncError('YEAR_FOLDER_MISMATCH');
  const monthDay = `${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const date = `${year}-${monthDay}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.slice(5) !== monthDay || (explicitDate && date !== explicitDate)) throw new SyncError('DATE_MISMATCH');
  const input: Guide = { date, passage: `${m[4]} ${m[5]}`, title: m[6], content: body.join('\n\n'), source_id: snapshot.meta.id, status: 'published' };
  if (!validatePublishRequest(input).ok) throw new SyncError('INVALID_CONTENT');
  return input;
}

export interface SourceReader {
  list(): Promise<FileMeta[]>;
  snapshot(id: string): Promise<Snapshot>;
  unchanged(meta: FileMeta): Promise<boolean>;
  approvedMove(meta: FileMeta): Promise<boolean>;
}
export interface SyncStore {
  siteState(id: string): Promise<SiteState>;
  stop(uid: string): Promise<void>;
  control(): Promise<{ stopped: boolean; cursor?: string }>;
  beginItem(id: string, lease: string): Promise<void>;
  acquire(durationMs: number): Promise<string | null>;
  release(lease: string): Promise<void>;
  load(id: string): Promise<RecordState | undefined>;
  save(state: RecordState, lease: string): Promise<void>;
  publish(guide: Guide, state: RecordState, lease: string): Promise<string>;
  conflict(guide: Guide): Promise<boolean>;
  summary(result: RunResult, lease: string): Promise<void>;
}
export const MAX_DOCUMENTS_PER_RUN = 20;
export type RunResult = { mode: 'dry_run' | 'publish'; scanned: number; success: number; skipped: number; held: number; failed: number; pending: number; code: string; finishedAt: number; cursor?: string };
export async function runSync(reader: SourceReader, store: SyncStore, mode: 'dry_run' | 'publish', options: { budgetMs?: number; now?: () => number; sleep?: (ms: number) => Promise<void>; cursor?: string } = {}): Promise<RunResult> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const budget = options.budgetMs ?? 40_000;
  const deadline = now() + budget;
  const result: RunResult = { mode, scanned: 0, success: 0, skipped: 0, held: 0, failed: 0, pending: 0, code: 'COMPLETE', finishedAt: 0 };
  let lease: string | null;
  try {
    if ((await store.control()).stopped) return { ...result, code: 'STOPPED', finishedAt: now() };
    lease = await store.acquire(budget + 60_000);
  } catch (error) { return { ...result, code: safeError(error).code, finishedAt: now() }; }
  if (!lease) return { ...result, code: 'BUSY', finishedAt: now() };
  try {
    const control = await store.control();
    if (control.stopped) throw new SyncError('STOPPED', false, true);
    const listed = await reader.list();
    // Stable round-robin order survives renamed/deleted cursor documents. Persist before
    // starting work so a crashing or failing first document cannot monopolize every run.
    const sorted = [...new Map(listed.map(file => [file.id, file])).values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const cursor = mode === 'dry_run' ? options.cursor ?? control.cursor : control.cursor;
    const next = cursor ? sorted.findIndex(file => file.id > cursor) : 0;
    const start = next < 0 ? 0 : next;
    // Finish the current sweep at the end; the following run starts a new sweep.
    const files = sorted.slice(start);
    for (let index = 0; index < files.length; index++) {
      result.pending = files.length - index;
      if (now() >= deadline || result.scanned >= MAX_DOCUMENTS_PER_RUN) { result.code = 'MORE_PENDING'; break; }
      const meta = files[index];
      // Atomic stop check + fencing + cursor advance, before any document body read.
      await store.beginItem(meta.id, lease);
      result.cursor = meta.id;
      result.scanned++;
      result.pending--;
      let state = await store.load(meta.id);
      let snapshot: Snapshot | undefined;
      let attemptedPublish = false;
      try {
        assertApprovedFile(meta);
        const site = await store.siteState(meta.id);
        if (site.version && state?.approvedSiteVersion !== site.version) throw new SyncError(site.code!);
        if (state?.version === meta.version && state.folderId === approvedLocation(meta).folderId && (state.status === 'success' || (mode === 'dry_run' && state.status === 'dry_run'))) { result.skipped++; continue; }
        if (state?.version === meta.version && state.folderId === approvedLocation(meta).folderId && state.status === 'held') { result.held++; continue; }
        if (state?.version === meta.version && state.folderId === approvedLocation(meta).folderId && state.status === 'failed' && ((state.attempts ?? 0) >= 3 || (state.nextAttemptAt ?? 0) > now())) { result.failed++; continue; }
        snapshot = await reader.snapshot(meta.id);
        if (state?.version !== snapshot.meta.version || state.folderId !== approvedLocation(snapshot.meta).folderId) state = { ...state, id: meta.id, name: meta.name, version: snapshot.meta.version, folderId: approvedLocation(snapshot.meta).folderId, sourceHash: snapshot.sourceHash, status: 'held', code: 'UNAPPROVED', attempts: 0, updatedAt: now() };
        state ??= { id: meta.id, name: meta.name, version: snapshot.meta.version, folderId: approvedLocation(snapshot.meta).folderId, sourceHash: snapshot.sourceHash, status: 'held', code: 'UNAPPROVED', attempts: 0, updatedAt: now() };
        const explicitlyApproved = state.approvedHash === snapshot.sourceHash;
        const guide = parseGuide(snapshot, explicitlyApproved ? state.approvedDate : undefined);
        if (!explicitlyApproved) {
          if (state.publishedHash) throw new SyncError('REAPPROVAL_REQUIRED');
          if (!await reader.approvedMove(snapshot.meta)) throw new SyncError('APPROVAL_EVIDENCE_REQUIRED', true);
        }
        state = { ...state, sourceHash: snapshot.sourceHash, approvedHash: snapshot.sourceHash, approvedDate: guide.date, approvedBy: explicitlyApproved ? state.approvedBy : 'verified_folder_move', status: 'ready', code: 'READY', updatedAt: now() };
        await store.save(state, lease);
        if (await store.conflict(guide)) throw new SyncError('EXISTING_POST_REQUIRES_LINK');
        if (!await reader.unchanged(snapshot.meta)) throw new SyncError('SOURCE_CHANGED');
        if (mode === 'dry_run') {
          await store.save({ ...state, status: 'dry_run', code: 'WOULD_PUBLISH', updatedAt: now() }, lease);
          result.success++; continue;
        }
        let saved = false;
        while (!saved) {
          state.attempts = (state.attempts ?? 0) + 1;
          await store.save(state, lease);
          try {
            if (!await reader.unchanged(snapshot.meta)) throw new SyncError('SOURCE_CHANGED');
            attemptedPublish = true;
            await store.publish(guide, state, lease); // atomic publication + receipt, with fencing inside transaction
            saved = true; result.success++;
          } catch (error) {
            const failure = safeError(error);
            if (!failure.transient || failure.global || state.attempts >= 3 || now() + 2000 >= deadline) throw failure;
            await sleep(250 * 2 ** (state.attempts - 1));
          }
        }
      } catch (error) {
        const failure = safeError(error);
        if (failure.global || failure.code === 'STALE_RUN') { result.code = failure.code; break; }
        const base = state ?? { id: meta.id, name: meta.name, version: meta.version, updatedAt: now() };
        await store.save({ ...base, ...(snapshot ? { sourceHash: snapshot.sourceHash, version: snapshot.meta.version } : {}), status: failure.transient ? 'failed' : 'held', code: failure.code, attempts: Math.max((state?.attempts ?? 0) + (attemptedPublish ? 0 : 1), 1), nextAttemptAt: now() + 60_000, updatedAt: now() }, lease);
        if (failure.transient) result.failed++; else result.held++;
      }
    }
  } catch (error) { result.code = safeError(error).code; }
  finally {
    result.finishedAt = now();
    try { await store.summary(result, lease); } finally { await store.release(lease); }
  }
  return result;
}
