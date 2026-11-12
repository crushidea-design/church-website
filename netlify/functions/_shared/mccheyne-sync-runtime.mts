import { getAppDb, getEnv, initializeFirebaseAdmin } from './firebase-admin.mjs';
import { createDriveReader } from './mccheyne-drive.mjs';
import { createSyncStore, CONTROL_COLLECTION, STATE_COLLECTION } from './mccheyne-sync-store.mjs';
import { createReadOnlySyncStore } from './mccheyne-read-only-store.mjs';
import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { APPROVED_FOLDER_YEARS, approvedLocation, assertSingleTarget, parseGuide, runSync, SyncError, type RecordState, type SingleTarget } from './mccheyne-sync-core.mjs';

export function syncMode(): 'off' | 'dry_run' | 'publish' {
  const mode = getEnv('MCCHEYNE_SYNC_MODE');
  return mode === 'dry_run' || mode === 'publish' ? mode : 'off';
}
export async function executeSync(budgetMs = 40_000, cursor?: string, target?: SingleTarget) {
  if (target) assertSingleTarget(target);
  const mode = syncMode();
  if (mode === 'off') return { code: 'DISABLED', mode };
  if (!initializeFirebaseAdmin()) throw new SyncError('STORAGE_NOT_CONFIGURED', false, true);
  const store = createSyncStore();
  if (mode === 'dry_run') {
    const trial = createReadOnlySyncStore(store);
    const result = await runSync(createDriveReader(), trial.store, mode, { budgetMs, cursor, target });
    return { ...result, records: trial.records() };
  }
  return runSync(createDriveReader(), store, mode, { budgetMs, target });
}
export async function stopSync(uid: string) {
  // A read-only trial never writes control state either. Its bounded reads may finish.
  if (syncMode() === 'dry_run') throw new SyncError('READ_ONLY_MODE');
  if (syncMode() === 'off') return { code: 'DISABLED' };
  await createSyncStore().stop(uid);
  return { code: 'STOPPED' };
}
export async function syncStatus() {
  const db = getAppDb();
  const [rows, control] = await Promise.all([
    db.collection(STATE_COLLECTION).orderBy('updatedAt', 'desc').limit(200).get(),
    db.collection(CONTROL_COLLECTION).doc('current').get(),
  ]);
  // Explicit projection: never send stored authorization internals to the client.
  const stopped = control.data()?.stopped === true;
  return { mode: stopped ? 'off' : syncMode(), stopped, folderYears: APPROVED_FOLDER_YEARS, lastRun: control.data()?.lastRun ?? null,
    busy: Boolean(control.data()?.lease && control.data()!.expiresAt > Date.now()),
    records: rows.docs.map(d => { const s = d.data() as RecordState; return { id: d.id, name: s.name, status: s.status, code: s.code, date: s.approvedDate ?? null, postId: s.postId ?? null, updatedAt: s.updatedAt }; }),
  };
}
export async function previewSource(id: string, date?: string) {
  if (syncMode() === 'off') throw new SyncError('DISABLED');
  const reader = createDriveReader();
  const snapshot = await reader.snapshot(id);
  const guide = parseGuide(snapshot, date);
  const site = await createSyncStore().siteState(id);
  return { id, name: snapshot.meta.name, sourceHash: snapshot.sourceHash, text: snapshot.text,
    date: guide.date, conflict: await createSyncStore().conflict(guide), siteVersion: site.version ?? null, siteCode: site.code ?? null };
}
export async function approveSource(id: string, sourceHash: string, date: string, uid: string, siteVersion?: string) {
  if (syncMode() === 'off') throw new SyncError('DISABLED');
  if (syncMode() === 'dry_run') throw new SyncError('READ_ONLY_MODE');
  const store = createSyncStore();
  const lease = await store.acquire(60_000);
  if (!lease) throw new SyncError('BUSY');
  try {
    const reader = createDriveReader();
    const snapshot = await reader.snapshot(id);
    if (snapshot.sourceHash !== sourceHash) throw new SyncError('SOURCE_CHANGED');
    const guide = parseGuide(snapshot, date);
    const site = await store.siteState(id);
    if (site.version !== siteVersion) throw new SyncError('SITE_CHANGED');
    if (await store.conflict(guide)) throw new SyncError('EXISTING_POST_REQUIRES_LINK');
    if (!await reader.unchanged(snapshot.meta)) throw new SyncError('SOURCE_CHANGED');
    const previous = await store.load(id);
    await store.save({ ...previous, id, name: snapshot.meta.name, version: snapshot.meta.version, folderId: approvedLocation(snapshot.meta).folderId, sourceHash,
      approvedHash: sourceHash, approvedDate: guide.date, approvedBy: uid, approvedSiteVersion: siteVersion, status: 'ready', code: 'APPROVED', attempts: 0, nextAttemptAt: 0, updatedAt: Date.now() }, lease);
    return { code: 'APPROVED' };
  } finally { await store.release(lease); }
}

/** Called by the existing editor/delete UI before its writes. A failed edit stays held safely. */
export async function holdSitePost(postId: string, action: 'edit' | 'delete', uid: string) {
  const db = getAppDb();
  return db.runTransaction(async tx => {
    const mappings = await tx.get(db.collection('mccheyne_publish_sources').where('postId', '==', postId).limit(2));
    if (mappings.empty) return { managed: false };
    if (mappings.size !== 1) throw new SyncError('AMBIGUOUS_SOURCE');
    const mapping = mappings.docs[0];
    const stateRef = db.collection(STATE_COLLECTION).doc(mapping.id);
    const state = await tx.get(stateRef);
    const code = action === 'delete' ? 'SITE_POST_DELETED' : 'SITE_POST_EDITED';
    tx.update(mapping.ref, { manualHold: `${action}:${randomUUID()}`, manualBy: uid, manualAt: Date.now() });
    if (state.exists) tx.update(stateRef, { status: 'held', code, approvedSiteVersion: FieldValue.delete(), updatedAt: Date.now() });
    return { managed: true, code };
  });
}
