import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { PublishInput } from './mccheyne-publish-core.mjs';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { generateSortOrder } from '../../../src/lib/sortUtils.ts';
import { MCCHEYNE_AUTHOR_UID, MCCHEYNE_AUTHOR_EMAIL, publicationFingerprint, siteState } from './mccheyne-site-state.mjs';
import { SyncError } from './mccheyne-sync-core.mjs';
import { getAppDb, initializeFirebaseAdmin, jsonResponse } from './firebase-admin.mjs';
import {
  buildGuideTitle,
  kstMidnight,
  postUrl,
  validatePublishRequest,
} from './mccheyne-publish-core.mjs';

const LONG_BYTES = 1400;
const SNIPPET_CHARS = 400;
const CHUNK_SIZE = 10000;

export type PublishGuard = {
  approvedSiteVersion?: string;
  beforeWrites(tx: Transaction, db: Firestore, input: PublishInput, mappedPostId?: string): Promise<void>;
  afterWrites(tx: Transaction, postId: string): void;
};

/** Internal service. Entry points must authenticate before calling. */
export async function publishGuide(body: unknown, guard?: PublishGuard): Promise<Response> {
  const parsed = validatePublishRequest(body);
  if ('errors' in parsed) {
    return jsonResponse({
      ok: false,
      error: 'VALIDATION_FAILED',
      fields: parsed.errors,
      message: `Invalid fields: ${Object.keys(parsed.errors).join(', ')}`,
    }, 400);
  }
  const { date, passage, content, sourceId, status } = parsed.value;
  const title = buildGuideTitle(date, passage, parsed.value.title);
  // firestore.rules caps post titles at 200; a longer one would block later admin edits.
  if (title.length > 200) {
    return jsonResponse({
      ok: false,
      error: 'VALIDATION_FAILED',
      fields: { title: 'title with the date and passage prefix must be at most 200 characters' },
      message: 'Invalid fields: title',
    }, 400);
  }

  try {
    if (!initializeFirebaseAdmin()) return jsonResponse({ ok: false, error: 'PUBLISH_FAILED' }, 500);
    const db = getAppDb();

    const isLong = new TextEncoder().encode(content).length > LONG_BYTES;
    const chunks: string[] = [];
    if (isLong) for (let i = 0; i < content.length; i += CHUNK_SIZE) chunks.push(content.substring(i, i + CHUNK_SIZE));
    const isPublished = status === 'published';
    const sortOrder = generateSortOrder(title);

    const mappingRef = db.collection('mccheyne_publish_sources').doc(sourceId);

    const result = await db.runTransaction(async (tx) => {
      // ---- reads
      const mappingSnap = await tx.get(mappingRef);
      const mapping = mappingSnap.exists ? mappingSnap.data() : undefined;
      const existingRef = mapping?.postId ? db.collection('posts').doc(mapping.postId) : undefined;
      const existingSnap = existingRef ? await tx.get(existingRef) : undefined;
      const updating = Boolean(existingRef && existingSnap?.exists);

      let staleChunks: Array<{ ref: unknown; index: number; content: string }> = [];
      const author = (await tx.get(db.collection('users').doc(MCCHEYNE_AUTHOR_UID))).data();
      if (author?.uid !== MCCHEYNE_AUTHOR_UID || author.email !== MCCHEYNE_AUTHOR_EMAIL || author.role !== 'admin' || typeof author.displayName !== 'string' || !author.displayName.trim()) throw new SyncError('AUTHOR_NOT_CONFIGURED', false, true);
      if (updating && existingRef) {
        const chunkSnap = await tx.get(db.collection('post_contents').where('postId', '==', existingRef.id));
        staleChunks = chunkSnap.docs.map((d) => ({ ref: d.ref, index: Number(d.data().index), content: d.data().content ?? '' }));
      }
      const existingPost = existingSnap?.data();
      const oldContent = existingPost?.isLongContent ? [...staleChunks].sort((a, b) => a.index - b.index).map(c => c.content).join('') : existingPost?.content ?? '';
      const site = siteState(mapping, existingPost, oldContent);
      if (site.version && guard?.approvedSiteVersion !== site.version) throw new SyncError(site.code!);
      if (guard?.approvedSiteVersion && guard.approvedSiteVersion !== site.version) throw new SyncError('SITE_CHANGED');

      const summaryRef = db.collection('settings').doc('latest_posts_summary');
      const summarySnap = !isPublished ? await tx.get(summaryRef) : undefined;

      await guard?.beforeWrites(tx, db, parsed.value, mapping?.postId);

      // ---- writes
      const postRef = updating && existingRef ? existingRef : db.collection('posts').doc();
      const bodyFields = {
        title,
        content: isLong ? content.substring(0, SNIPPET_CHARS) : content,
        sortOrder,
        dateKey: date,
        isPublished,
      };

      if (updating) {
        tx.update(postRef, {
          ...bodyFields,
          isLongContent: isLong ? true : FieldValue.delete(),
          fullContentLength: isLong ? content.length : FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        for (const stale of staleChunks) {
          if (!isLong || stale.index >= chunks.length || !Number.isInteger(stale.index)) tx.delete(stale.ref as never);
        }
      } else {
        tx.set(postRef, {
          ...bodyFields,
          category: 'today_word',
          subCategory: 'general',
          authorId: MCCHEYNE_AUTHOR_UID,
          authorName: author.displayName.trim(),
          commentCount: 0,
          viewCount: 0,
          createdAt: Timestamp.fromDate(kstMidnight(date)),
          updatedAt: FieldValue.serverTimestamp(),
          ...(isLong ? { isLongContent: true, fullContentLength: content.length } : {}),
        });
      }

      // Retract a formerly published snippet in the same transaction as the draft.
      if (summarySnap?.data()?.today_word?.id === postRef.id) {
        tx.update(summaryRef, { today_word: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
      }

      chunks.forEach((chunk, index) => {
        tx.set(db.collection('post_contents').doc(`${postRef.id}_${index}`), {
          postId: postRef.id,
          index,
          content: chunk,
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      tx.set(mappingRef, {
        postId: postRef.id,
        dateKey: date,
        passage,
        title,
        createdAt: mapping?.createdAt ?? FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        publishedFingerprint: publicationFingerprint({ title, dateKey: date, isPublished, category: updating ? existingPost?.category : 'today_word', authorId: updating ? existingPost?.authorId : MCCHEYNE_AUTHOR_UID }, content),
      });

      guard?.afterWrites(tx, postRef.id);
      return {
        id: postRef.id,
        action: updating ? ('updated' as const) : ('created' as const),
        authorName: updating ? (existingSnap?.data() as { authorName?: string }).authorName : author.displayName.trim(),
      };
    });

    if (isPublished) {
      // Best effort, like the admin page: the home summary must not fail the publish.
      try {
        await db.collection('settings').doc('latest_posts_summary').set({
          today_word: {
            id: result.id,
            title,
            content: content.substring(0, 500),
            category: 'today_word',
            subCategory: 'general',
            sermonCategoryId: null,
            researchCategoryId: null,
            createdAt: new Date().toISOString(),
            authorName: result.authorName ?? '익명',
          },
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (summaryError) {
        console.error('mccheyne-publish summary update failed:', summaryError instanceof Error ? summaryError.name : 'Error');
      }
    }

    return jsonResponse({ ok: true, id: result.id, url: postUrl(result.id), action: result.action });
  } catch (error) {
    if (guard) throw error;
    if (error instanceof SyncError) return jsonResponse({ ok: false, error: error.code }, error.global ? 503 : 409);
    console.error('mccheyne-publish failed:', error instanceof Error ? error.name : 'Error');
    return jsonResponse({ ok: false, error: 'PUBLISH_FAILED' }, 500);
  }
}
