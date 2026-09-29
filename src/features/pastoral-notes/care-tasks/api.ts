import type { User } from 'firebase/auth';
import { getAuthHeaders, readJsonResponse } from '../managementApi';

export type CareTaskStatus = 'open' | 'deferred' | 'done' | 'cancelled';
export type CareTaskSourceType = 'communion_review' | 'visitation_log' | 'manual';

export type CareTask = {
  id: string;
  memberId: string;
  memberName: string;
  sourceType: CareTaskSourceType;
  sourceId: string | null;
  assigneeUid: string;
  title: string;
  dueOn: string | null;
  status: CareTaskStatus;
  hasDetail: boolean;
  schedule: { id: string; date: string; startsAt: string; status: string } | null;
  revision: number;
  updatedAt: string;
};

export type CareTaskInput = {
  memberId: string;
  sourceType: CareTaskSourceType;
  sourceId: string | null;
  title: string;
  dueOn: string | null;
  detail: string;
  schedule: { date: string; startsAt: string } | null;
};

export async function listCareTasks(memberId: string, scope: 'active' | 'all', user: User) {
  const query = new URLSearchParams({ memberId, scope });
  const response = await fetch(`/api/raah/care-tasks?${query}`, { headers: await getAuthHeaders(user) });
  return (await readJsonResponse<{ tasks: CareTask[] }>(response)).tasks;
}

/** Active (open/deferred) tasks assigned to the signed-in user, across all members. Never carries the detail. */
export async function listMyActiveCareTasks(user: User) {
  const query = new URLSearchParams({ assignee: 'me', scope: 'active' });
  const response = await fetch(`/api/raah/care-tasks?${query}`, { headers: await getAuthHeaders(user) });
  const { tasks } = await readJsonResponse<{ tasks?: CareTask[] }>(response);
  if (!Array.isArray(tasks)) throw Object.assign(new Error('RAAH care task API is not available.'), { status: 404 });
  return tasks;
}

/** Returns the decrypted detail; the server audits each call. */
export async function getCareTask(taskId: string, user: User) {
  const response = await fetch(`/api/raah/care-tasks/${encodeURIComponent(taskId)}`, { headers: await getAuthHeaders(user) });
  return (await readJsonResponse<{ task: CareTask & { detail: string } }>(response)).task;
}

export async function createCareTask(input: CareTaskInput, idempotencyKey: string, user: User) {
  const response = await fetch('/api/raah/care-tasks', {
    method: 'POST',
    headers: { ...(await getAuthHeaders(user)), 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
  return readJsonResponse<{ taskId: string; scheduleItemId: string | null; revision: number }>(response);
}

export async function setCareTaskStatus(
  taskId: string,
  input: { status: CareTaskStatus; expectedRevision: number; dueOn?: string },
  user: User
) {
  const response = await fetch(`/api/raah/care-tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(input),
  });
  return readJsonResponse<{ id: string; status: CareTaskStatus; revision: number }>(response);
}

export const CARE_TASK_STATUS_LABELS: Record<CareTaskStatus, string> = {
  open: '진행 중',
  deferred: '연기됨',
  done: '완료',
  cancelled: '취소',
};
