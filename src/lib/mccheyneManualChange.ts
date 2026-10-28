/** Fail closed before editing/deleting a guide, so automation cannot overwrite the user's work. */
export async function prepareMccheyneManualChange(user: { getIdToken(): Promise<string> }, postId: string, action: 'edit' | 'delete') {
  const response = await fetch('/api/mccheyne/sync', {
    method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: action === 'edit' ? 'manual-edit' : 'manual-delete', id: postId }),
  });
  if (!response.ok) throw new Error('자동 등록 연결을 안전하게 보류하지 못했습니다. 잠시 후 다시 시도해 주세요.');
}
