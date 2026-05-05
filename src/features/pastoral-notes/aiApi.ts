import { User } from 'firebase/auth';

export type RaahAiDraft = {
  publicSummary: string;
  innerNote: string;
  prayerTopics: string;
  nextSteps: string;
  privateRemarks: string;
  recommendedAction: string;
};

export type RaahAiDraftInput = {
  rawMemo: string;
  memberName?: string;
  logType?: string;
  date?: string;
};

async function getAuthHeaders(user: User) {
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : 'RAAH AI request failed.';
    const error = new Error(message) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = typeof data?.code === 'string' ? data.code : undefined;
    throw error;
  }

  return data as T;
}

export async function generateRaahVisitationDraft(input: RaahAiDraftInput, user: User) {
  const response = await fetch('/api/raah/ai-assist', {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(input),
  });
  const data = await readJsonResponse<{ draft: RaahAiDraft; model: string }>(response);
  return data.draft;
}
