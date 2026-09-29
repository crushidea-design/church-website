import type { Config, Context } from '@netlify/functions';
import { createHmac } from 'crypto';
import { requireRaahAccess, type RaahAccess } from './_shared/raah-access.mjs';
import { RAAH_ENCRYPTION_VERSION, decryptJson, encryptJson, type EncryptedPayload } from './_shared/raah-crypto.mjs';
import {
  IDEMPOTENCY_KEY,
  UUID,
  cleanText,
  fail,
  getEnv,
  isCommunionEnabled,
  isValidDate,
  json,
  readJson,
  rpc,
  upstream,
} from './_shared/raah-rpc.mjs';

// Follow-up care tasks (plan 8.2, R08 / PR-9). Lists carry the neutral title,
// due date and status only. The optional detail is encrypted and returned only
// by the single-task endpoint, and only after its view has been audited.

type TaskStatus = 'open' | 'deferred' | 'done' | 'cancelled';
type SourceType = 'communion_review' | 'visitation_log' | 'manual';

const TASK_STATUSES: TaskStatus[] = ['open', 'deferred', 'done', 'cancelled'];
const SOURCE_TYPES: SourceType[] = ['communion_review', 'visitation_log', 'manual'];
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

type TaskRow = {
  id: string;
  member_id: string;
  source_type: SourceType;
  source_id: string | null;
  assignee_uid: string;
  title: string;
  due_on: string | null;
  status: TaskStatus;
  encrypted_detail: EncryptedPayload | null;
  revision: number;
  updated_at: string;
  raah_members?: { name: string } | null;
  raah_ministry_schedule_items?: { id: string; date: string; starts_at: string | null; status: string } | null;
};

const TASK_SELECT =
  'id,member_id,source_type,source_id,assignee_uid,title,due_on,status,encrypted_detail,revision,updated_at,' +
  'raah_members(name),raah_ministry_schedule_items(id,date,starts_at,status)';

const toTask = (row: TaskRow) => ({
  id: row.id,
  memberId: row.member_id,
  memberName: row.raah_members?.name || '',
  sourceType: row.source_type,
  sourceId: row.source_id,
  assigneeUid: row.assignee_uid,
  title: row.title,
  dueOn: row.due_on,
  status: row.status,
  hasDetail: Boolean(row.encrypted_detail),
  // The calendar slot is reported separately: its completion is not the care's completion.
  schedule: row.raah_ministry_schedule_items
    ? {
      id: row.raah_ministry_schedule_items.id,
      date: row.raah_ministry_schedule_items.date,
      startsAt: row.raah_ministry_schedule_items.starts_at || '',
      status: row.raah_ministry_schedule_items.status,
    }
    : null,
  revision: row.revision,
  updatedAt: row.updated_at,
});

async function listTasks(req: Request, access: RaahAccess) {
  const params = new URL(req.url).searchParams;
  const memberId = params.get('memberId');
  const scope = params.get('scope') || 'active';
  if ((memberId && !UUID.test(memberId)) || !['active', 'all'].includes(scope)) {
    return fail(422, '조회 조건을 확인해 주세요.', 'RAAH_INVALID_INPUT');
  }
  const query = new URLSearchParams({ select: TASK_SELECT, workspace_id: `eq.${access.workspaceId}`, order: 'due_on.asc.nullslast' });
  if (memberId) query.set('member_id', `eq.${memberId}`);
  if (scope === 'active') query.set('status', 'in.(open,deferred)');
  const result = await upstream(`raah_care_tasks?${query}`);
  if (result.response) return result.response;
  return json({ tasks: (result.data as TaskRow[]).map(toTask) });
}

async function getTask(access: RaahAccess, taskId: string) {
  const secret = getEnv('RAAH_ENCRYPTION_SECRET');
  if (!secret) return fail(503, 'RAAH encryption is not configured.', 'RAAH_ENCRYPTION_NOT_CONFIGURED');
  const query = new URLSearchParams({ select: TASK_SELECT, workspace_id: `eq.${access.workspaceId}`, id: `eq.${taskId}`, limit: '1' });
  const result = await upstream(`raah_care_tasks?${query}`);
  if (result.response) return result.response;
  const row = (result.data as TaskRow[])[0];
  if (!row) return fail(404, '대상을 찾을 수 없습니다.', 'RAAH_NOT_FOUND');

  let detail = '';
  if (row.encrypted_detail) {
    // Record the view before revealing it; no audit, no detail (plan 14.5).
    const audit = await upstream('raah_audit_events', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: access.workspaceId, actor_uid: access.user.uid, action: 'care_task.detail_view', target_type: 'care_task', target_id: row.id }),
    });
    if (audit.response) return fail(503, '열람 기록을 남기지 못해 내용을 표시하지 않았습니다.', 'RAAH_AUDIT_UNAVAILABLE');
    try {
      detail = decryptJson<{ detail: string }>(row.encrypted_detail, secret).detail || '';
    } catch {
      return fail(500, '내용을 복호화하지 못했습니다.', 'RAAH_DECRYPT_FAILED');
    }
  }
  return json({ task: { ...toTask(row), detail } });
}

async function createTask(req: Request, access: RaahAccess) {
  const idempotencyKey = req.headers.get('idempotency-key') || '';
  if (!IDEMPOTENCY_KEY.test(idempotencyKey)) return fail(422, 'Idempotency-Key 헤더가 필요합니다.', 'RAAH_IDEMPOTENCY_KEY_REQUIRED');
  const secret = getEnv('RAAH_ENCRYPTION_SECRET');
  if (!secret) return fail(503, 'RAAH encryption is not configured.', 'RAAH_ENCRYPTION_NOT_CONFIGURED');

  const body = await readJson(req);
  const memberId = body?.memberId;
  const sourceType = body?.sourceType as SourceType;
  const sourceId = body?.sourceId ?? null;
  const title = cleanText(body?.title);
  const dueOn = body?.dueOn || null;
  const detail = cleanText(body?.detail);
  const schedule = body?.schedule as { date?: unknown; startsAt?: unknown } | null | undefined;
  const scheduleDate = schedule?.date || null;
  const scheduleStartsAt = cleanText(schedule?.startsAt) || null;
  if (
    typeof memberId !== 'string' || !UUID.test(memberId) ||
    !SOURCE_TYPES.includes(sourceType) ||
    (sourceType === 'manual' ? sourceId !== null : typeof sourceId !== 'string' || !UUID.test(sourceId)) ||
    !title || title.length > 60 ||
    (dueOn !== null && !isValidDate(dueOn)) ||
    detail.length > 3000 ||
    (scheduleDate !== null && !isValidDate(scheduleDate)) ||
    (scheduleStartsAt !== null && (!scheduleDate || !TIME.test(scheduleStartsAt)))
  ) {
    return fail(422, '돌봄 제목과 날짜를 확인해 주세요.', 'RAAH_INVALID_INPUT');
  }

  const requestHash = createHmac('sha256', secret)
    .update(JSON.stringify({ memberId, sourceType, sourceId, title, dueOn, detail, scheduleDate, scheduleStartsAt }))
    .digest('hex');
  const result = await rpc('raah_rpc_create_care_task', {
    p_workspace: access.workspaceId,
    p_actor: access.user.uid,
    p_actor_name: access.user.name,
    p_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
    p_member_id: memberId,
    p_source_type: sourceType,
    p_source_id: sourceId,
    p_title: title,
    p_due_on: dueOn,
    p_encrypted_detail: detail ? encryptJson({ detail }, secret) : null,
    p_encryption_version: detail ? RAAH_ENCRYPTION_VERSION : null,
    p_schedule_date: scheduleDate,
    p_schedule_starts_at: scheduleStartsAt,
  });
  if (result.response) return result.response;
  return json(result.data, 201);
}

async function setTaskStatus(req: Request, access: RaahAccess, taskId: string) {
  const body = await readJson(req);
  const status = body?.status as TaskStatus;
  const expectedRevision = body?.expectedRevision;
  const dueOn = body?.dueOn || null;
  if (!TASK_STATUSES.includes(status) || !Number.isInteger(expectedRevision) || (expectedRevision as number) < 1 || (dueOn !== null && !isValidDate(dueOn))) {
    return fail(422, '변경할 상태와 기준 버전을 확인해 주세요.', 'RAAH_INVALID_INPUT');
  }
  const result = await rpc('raah_rpc_set_care_task_status', {
    p_workspace: access.workspaceId,
    p_actor: access.user.uid,
    p_task_id: taskId,
    p_expected_revision: expectedRevision,
    p_to_status: status,
    p_due_on: dueOn,
  });
  if (result.response) return result.response;
  return json({ id: taskId, status, revision: result.data });
}

export default async (req: Request, context: Context) => {
  if (!isCommunionEnabled()) return fail(404, 'Not found', 'RAAH_COMMUNION_DISABLED');

  const accessCheck = await requireRaahAccess(req, { requireGrant: true });
  if (accessCheck.response || !accessCheck.access) return accessCheck.response;
  const access = accessCheck.access;

  const id = context.params?.id;
  if (id !== undefined && !UUID.test(id)) return fail(404, '대상을 찾을 수 없습니다.', 'RAAH_NOT_FOUND');

  if (!id && req.method === 'GET') return listTasks(req, access);
  if (!id && req.method === 'POST') return createTask(req, access);
  if (id && req.method === 'GET') return getTask(access, id);
  if (id && req.method === 'PATCH') return setTaskStatus(req, access, id);
  return fail(405, 'Method not allowed', 'RAAH_METHOD_NOT_ALLOWED');
};

export const config: Config = {
  path: ['/api/raah/care-tasks', '/api/raah/care-tasks/:id'],
};
