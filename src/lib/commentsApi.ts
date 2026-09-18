import type { User } from 'firebase/auth';

export async function writeComment(user: User, method: 'POST' | 'DELETE', input: { postId: string; commentId: string; content?: string }) {
  const response = await fetch('/api/post-comments', {
    method,
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error || '댓글 처리에 실패했습니다. 다시 시도해 주세요.');
  return data as { commentCount: number; comment?: { id: string; content: string; authorId: string; authorName: string; createdAt: string } };
}
