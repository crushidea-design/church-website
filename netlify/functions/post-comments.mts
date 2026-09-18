import type { Config } from '@netlify/functions';
import { FieldValue } from 'firebase-admin/firestore';
import { getAppDb, initializeFirebaseAdmin, jsonResponse, verifyRequestUser } from './_shared/firebase-admin.mjs';

class RequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export default async (req: Request) => {
  if (!['POST', 'DELETE'].includes(req.method)) return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    if (!initializeFirebaseAdmin()) return jsonResponse({ error: 'Authentication service unavailable' }, 503);
    const user = await verifyRequestUser(req).catch(() => null);
    if (!user) return jsonResponse({ error: '로그인이 필요합니다.' }, 401);
    const input = await req.json().catch(() => null);
    const postId = input?.postId;
    const commentId = input?.commentId;
    const content = typeof input?.content === 'string' ? input.content.trim() : '';
    if (![postId, commentId].every((id) => typeof id === 'string' && /^[\w-]{1,128}$/.test(id)) ||
      (req.method === 'POST' && (!content || content.length >= 5000))) {
      return jsonResponse({ error: '댓글 내용을 확인해 주세요.' }, 400);
    }
    const db = getAppDb();
    const postRef = db.collection('posts').doc(postId);
    const commentRef = db.collection('comments').doc(commentId);
    const result = await db.runTransaction(async (tx) => {
      const [profile, post, comment] = await Promise.all([
        tx.get(db.collection('users').doc(user.uid)), tx.get(postRef), tx.get(commentRef),
      ]);
      const role = profile.data()?.role;
      const isAdmin = (user.email === 'crushidea@gmail.com' && user.email_verified === true) || role === 'admin';
      const postData = post.data();
      if (!postData) throw new RequestError(404, '게시글을 찾을 수 없습니다.');
      if (postData.category === 'sermon' && !isAdmin && role !== 'regular' && postData.authorId !== user.uid) {
        throw new RequestError(403, '게시글 접근 권한이 없습니다.');
      }
      const count = Math.max(0, Number(postData.commentCount) || 0);
      if (req.method === 'POST') {
        // Client retains this ID across retries, so a lost response never duplicates a comment.
        if (comment.exists) {
          const previous = comment.data();
          if (previous?.authorId !== user.uid || previous?.postId !== postId || previous?.content !== content) {
            throw new RequestError(409, '댓글 요청이 충돌했습니다. 다시 시도해 주세요.');
          }
          return { commentCount: count, comment: { id: commentId, ...previous, createdAt: previous.createdAt?.toDate?.().toISOString() } };
        }
        const data = {
          postId, postCategory: postData.category, content, authorId: user.uid,
          authorName: String(user.name || '익명').slice(0, 99), createdAt: FieldValue.serverTimestamp(),
        };
        tx.create(commentRef, data);
        tx.update(postRef, { commentCount: count + 1, updatedAt: FieldValue.serverTimestamp() });
        return { commentCount: count + 1, comment: { id: commentId, ...data, createdAt: new Date().toISOString() } };
      }
      if (!comment.exists) return { commentCount: count };
      const previous = comment.data();
      if (previous?.postId !== postId || (!isAdmin && previous?.authorId !== user.uid)) {
        throw new RequestError(403, '댓글 삭제 권한이 없습니다.');
      }
      tx.delete(commentRef);
      tx.update(postRef, { commentCount: Math.max(0, count - 1), updatedAt: FieldValue.serverTimestamp() });
      return { commentCount: Math.max(0, count - 1) };
    });
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ error: error instanceof RequestError ? error.message : '댓글 처리에 실패했습니다. 다시 시도해 주세요.' }, error instanceof RequestError ? error.status : 500);
  }
};

export const config: Config = { path: '/api/post-comments' };
