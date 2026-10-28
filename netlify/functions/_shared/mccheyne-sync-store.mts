import { randomUUID } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { getAppDb } from './firebase-admin.mjs';
import { kstMidnight, validatePublishRequest } from './mccheyne-publish-core.mjs';
import { publishGuide } from './mccheyne-publish-service.mjs';
import { readSiteState } from './mccheyne-site-state.mjs';
import { SyncError, type Guide, type RecordState, type SyncStore } from './mccheyne-sync-core.mjs';

export const STATE_COLLECTION = '_mccheyne_sync_sources';
export const CONTROL_COLLECTION = '_mccheyne_sync_control';
const clean = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
export function storageError(error: unknown): SyncError {
  if (error instanceof SyncError) return error;
  const code = Number((error as { code?: number }).code);
  if ([7, 16].includes(code)) return new SyncError('STORAGE_AUTH_REQUIRED', false, true);
  if (code === 9) return new SyncError('INDEX_REQUIRED');
  return new SyncError('STORAGE_ERROR', [4, 8, 10, 13, 14].includes(code));
}

/** Conservatively holds legacy/manual candidates, including pre-dateKey posts and identical snippets. */
async function hasConflict(db: Firestore, input: Guide, mappedId?: string, tx?: Transaction): Promise<boolean> {
  const parsed = validatePublishRequest(input);
  if (!parsed.ok) throw new SyncError('INVALID_CONTENT');
  const body = parsed.value.content;
  const snippet = new TextEncoder().encode(body).length > 1400 ? body.slice(0, 400) : body;
  const start = kstMidnight(input.date);
  const end = new Date(start.getTime() + 86400_000);
  const posts = db.collection('posts').where('category', '==', 'today_word');
  const queries = [posts.where('dateKey', '==', input.date).limit(20),
    posts.where('createdAt', '>=', Timestamp.fromDate(start)).where('createdAt', '<', Timestamp.fromDate(end)).limit(20),
    posts.where('content', '==', snippet).limit(20)];
  for (const query of queries) {
    const found = await (tx ? tx.get(query) : query.get());
    if (found.docs.some(d => d.id !== mappedId)) return true;
  }
  return false;
}

export function createSyncStore(db: Firestore = getAppDb()): SyncStore {
  const control = db.collection(CONTROL_COLLECTION).doc('current');
  const ref = (id: string) => db.collection(STATE_COLLECTION).doc(id);
  const fence = async (tx: Transaction, lease: string, allowStopped = false) => {
    const current = (await tx.get(control)).data();
    if (current?.lease !== lease || current.expiresAt <= Date.now()) throw new SyncError('STALE_RUN');
    if (!allowStopped && current.stopped === true) throw new SyncError('STOPPED', false, true);
  };
  return {
    siteState: id => readSiteState(db, id),
    async control() {
      const data = (await control.get()).data();
      return { stopped: data?.stopped === true, cursor: typeof data?.cursor === 'string' ? data.cursor : undefined };
    },
    async stop(uid: string) {
      // Merge only the stop latch; never invalidate a worker lease or reset its cursor.
      await control.set({ stopped: true, stoppedBy: uid, stoppedAt: Date.now() }, { merge: true });
    },
    async beginItem(id, lease, advanceCursor = true) {
      await db.runTransaction(async tx => { await fence(tx, lease); if (advanceCursor) tx.set(control, { cursor: id }, { merge: true }); });
    },
    async acquire(durationMs) {
      const lease = randomUUID();
      return db.runTransaction(async tx => {
        const current = (await tx.get(control)).data();
        if (current?.stopped === true) throw new SyncError('STOPPED', false, true);
        if (current?.lease && current.expiresAt > Date.now()) return null;
        tx.set(control, { lease, expiresAt: Date.now() + durationMs }, { merge: true });
        return lease;
      });
    },
    async release(lease) {
      await db.runTransaction(async tx => {
        if ((await tx.get(control)).data()?.lease === lease) tx.set(control, { lease: null, expiresAt: 0 }, { merge: true });
      });
    },
    async load(id) { return (await ref(id).get()).data() as RecordState | undefined; },
    async save(state, lease) {
      await db.runTransaction(async tx => {
        await fence(tx, lease);
        const existing = (await tx.get(ref(state.id))).data() as RecordState | undefined;
        // A lost response after a committed publish must not erase the success receipt.
        if (existing?.status === 'success' && existing.publishedHash === state.sourceHash && state.status !== 'ready' && !['SITE_POST_EDITED', 'SITE_POST_DELETED'].includes(state.code)) return;
        tx.set(ref(state.id), clean(state));
      });
    },
    async conflict(guide) {
      try {
        const mapping = (await db.collection('mccheyne_publish_sources').doc(guide.source_id).get()).data();
        return await hasConflict(db, guide, mapping?.postId);
      } catch (e) { throw storageError(e); }
    },
    async publish(guide, state, lease) {
      try {
        const response = await publishGuide(guide, {
          approvedSiteVersion: state.approvedSiteVersion,
          async beforeWrites(tx, transactionDb, _input, mappedId) {
            await fence(tx, lease);
            const current = (await tx.get(ref(state.id))).data() as RecordState | undefined;
            if (current?.publishedHash === state.sourceHash && current.status === 'success') throw new SyncError('ALREADY_PUBLISHED');
            if (!state.sourceHash || current?.approvedHash !== state.sourceHash || current?.version !== state.version || current?.status !== 'ready') throw new SyncError('STALE_APPROVAL');
            if (await hasConflict(transactionDb, guide, mappedId, tx)) throw new SyncError('EXISTING_POST_REQUIRES_LINK');
          },
          afterWrites(tx, postId) {
            const { approvedSiteVersion: _siteVersion, ...publishedState } = state;
            tx.set(ref(state.id), clean({ ...publishedState, status: 'success', code: 'PUBLISHED', postId, publishedHash: state.sourceHash, updatedAt: Date.now() }));
          },
        });
        if (!response.ok) throw new SyncError('PUBLISH_VALIDATION_FAILED');
        return (await response.json()).id as string;
      } catch (error) {
        // Recover ambiguous transport outcomes by reading the atomic receipt before any retry.
        const receipt = (await ref(state.id).get()).data() as RecordState | undefined;
        if (receipt?.status === 'success' && receipt.publishedHash === state.sourceHash && receipt.postId && !(await readSiteState(db, state.id)).version) return receipt.postId;
        throw storageError(error);
      }
    },
    async summary(result, lease) {
      await db.runTransaction(async tx => { await fence(tx, lease, true); tx.set(control, { lastRun: result }, { merge: true }); });
    },
  };
}
