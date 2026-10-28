import { createHash } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';

// Verified against Firebase Auth and users/{uid}, 2026-10-27. Never accept an author from requests.
export const MCCHEYNE_AUTHOR_UID = '0BjZJ0BZ4FQhxkpgp7BwDMOPfBV2';
export const MCCHEYNE_AUTHOR_EMAIL = 'crushidea@gmail.com';
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export type SiteState = { version?: string; code?: string };
export function publicationFingerprint(post: Record<string, unknown> = {}, fullContent: string) {
  return digest([post.title ?? '', fullContent, post.dateKey ?? '', post.isPublished === true, post.category ?? '', post.authorId ?? '']);
}
export function siteState(mapping: Record<string, unknown> | undefined, post: Record<string, unknown> | undefined, fullContent: string): SiteState {
  if (!mapping?.postId) return {};
  const fingerprint = post ? publicationFingerprint(post, fullContent) : null;
  const code = !post ? 'SITE_POST_DELETED' : mapping.manualHold || mapping.publishedFingerprint !== fingerprint ? 'SITE_POST_EDITED' : undefined;
  return code ? { code, version: digest([mapping.postId, mapping.manualHold ?? null, fingerprint]) } : {};
}
export async function readSiteState(db: Firestore, sourceId: string, tx?: Transaction): Promise<SiteState> {
  const mappingRef = db.collection('mccheyne_publish_sources').doc(sourceId);
  const mapping = (await (tx ? tx.get(mappingRef) : mappingRef.get())).data();
  if (!mapping?.postId) return {};
  const ref = db.collection('posts').doc(mapping.postId);
  const post = (await (tx ? tx.get(ref) : ref.get())).data();
  let fullContent = post?.content ?? '';
  if (post?.isLongContent) {
    const query = db.collection('post_contents').where('postId', '==', mapping.postId);
    const chunks = await (tx ? tx.get(query) : query.get());
    fullContent = chunks.docs.map(d => d.data()).sort((a, b) => a.index - b.index).map(d => d.content).join('');
  }
  return siteState(mapping, post, fullContent);
}
