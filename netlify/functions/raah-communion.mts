import type { Config, Context } from '@netlify/functions';
import { createHash, createHmac } from 'crypto';
import { requireRaahAccess, type RaahAccess } from './_shared/raah-access.mjs';
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
import { buildParticipation, seoulToday, type AttendanceEventInput, type AttendanceRecordInput } from './_shared/raah-participation.mjs';
// The one encryption contract for visitation bodies; reused, never re-implemented.
import { encryptPayload } from './raah-management.mjs';

// Communion care API (plan 13.1, PR-6). Every multi-row write is a single
// raah_rpc_* call so it runs in one transaction; the functions re-check the
// caller's grant. Responses carry progress metadata only — never log bodies.
// Conversation bodies are encrypted here and stored as ordinary visitation
// logs; reading them goes through the existing /api/raah/visitation-logs/:id.

type ReviewStatus = 'not_started' | 'scheduled' | 'in_progress' | 'reviewed' | 'closed_without_contact';

const REVIEW_STATUSES: ReviewStatus[] = ['not_started', 'scheduled', 'in_progress', 'reviewed', 'closed_without_contact'];
const MAX_ROSTER_BATCH = 200;
const ENCRYPTION_VERSION = 1;

// ───── DTOs ─────

type PeriodRow = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  status: string;
  guide_version: string;
  owner_uid: string;
  revision: number;
  closed_at: string | null;
  closing_summary: unknown;
  reopened_at: string | null;
  reopen_reason: string | null;
  raah_communion_occasions?: Array<{ id: string; service_date: string; status: string; revision: number }>;
  raah_communion_reviews?: Array<{ status: ReviewStatus; roster_state: string }>;
};

type ReviewRow = {
  id: string;
  member_id: string;
  status: ReviewStatus;
  roster_state: 'included' | 'excluded';
  assignee_uid: string;
  revision: number;
  updated_at: string;
  raah_members?: { name: string; status: string } | null;
};

const PERIOD_SELECT =
  'id,name,starts_on,ends_on,status,guide_version,owner_uid,revision,closed_at,closing_summary,reopened_at,reopen_reason,' +
  'raah_communion_occasions(id,service_date,status,revision)';

function countReviews(reviews: Array<{ status: ReviewStatus; roster_state: string }> = []) {
  const counts = Object.fromEntries(REVIEW_STATUSES.map((status) => [status, 0])) as Record<ReviewStatus, number>;
  let included = 0;
  for (const review of reviews) {
    if (review.roster_state !== 'included') continue;
    included += 1;
    counts[review.status] += 1;
  }
  return { included, byStatus: counts };
}

const toPeriod = (row: PeriodRow) => ({
  id: row.id,
  name: row.name,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  status: row.status,
  guideVersion: row.guide_version,
  ownerUid: row.owner_uid,
  revision: row.revision,
  closedAt: row.closed_at,
  closingSummary: row.closing_summary ?? null,
  reopenedAt: row.reopened_at,
  reopenReason: row.reopen_reason,
  occasions: (row.raah_communion_occasions || [])
    .map((occasion) => ({ id: occasion.id, serviceDate: occasion.service_date, status: occasion.status, revision: occasion.revision }))
    .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate)),
});

const toReview = (row: ReviewRow) => ({
  id: row.id,
  memberId: row.member_id,
  memberName: row.raah_members?.name || '',
  memberActive: row.raah_members?.status === 'active',
  status: row.status,
  rosterState: row.roster_state,
  assigneeUid: row.assignee_uid,
  revision: row.revision,
  updatedAt: row.updated_at,
});

// ───── Handlers ─────

async function listPeriods(access: RaahAccess) {
  const query = new URLSearchParams({
    select: `${PERIOD_SELECT},raah_communion_reviews(status,roster_state)`,
    workspace_id: `eq.${access.workspaceId}`,
    order: 'starts_on.desc',
  });
  const result = await upstream(`raah_communion_periods?${query}`);
  if (result.response) return result.response;
  const periods = (result.data as PeriodRow[]).map((row) => ({ ...toPeriod(row), counts: countReviews(row.raah_communion_reviews) }));
  return json({ periods });
}

async function getPeriod(access: RaahAccess, periodId: string) {
  const periodQuery = new URLSearchParams({ select: PERIOD_SELECT, workspace_id: `eq.${access.workspaceId}`, id: `eq.${periodId}`, limit: '1' });
  const reviewQuery = new URLSearchParams({
    select: 'id,member_id,status,roster_state,assignee_uid,revision,updated_at,raah_members(name,status)',
    workspace_id: `eq.${access.workspaceId}`,
    period_id: `eq.${periodId}`,
  });
  const [period, reviews] = await Promise.all([
    upstream(`raah_communion_periods?${periodQuery}`),
    upstream(`raah_communion_reviews?${reviewQuery}`),
  ]);
  if (period.response) return period.response;
  if (reviews.response) return reviews.response;
  const row = (period.data as PeriodRow[])[0];
  if (!row) return fail(404, '대상을 찾을 수 없습니다.', 'RAAH_NOT_FOUND');
  const reviewRows = reviews.data as ReviewRow[];
  return json({
    period: { ...toPeriod(row), counts: countReviews(reviewRows) },
    reviews: reviewRows.map(toReview).sort((a, b) => a.memberName.localeCompare(b.memberName, 'ko')),
  });
}

// Test periods only: the RPC refuses any period with a real member's review.
async function deletePeriod(access: RaahAccess, periodId: string) {
  const result = await rpc('raah_rpc_delete_test_period', {
    p_workspace: access.workspaceId,
    p_actor: access.user.uid,
    p_period_id: periodId,
  });
  if (result.response) return result.response;
  return json(result.data);
}

// Closing freezes roster, statuses and new conversations; care tasks are untouched.
async function closePeriod(req: Request, access: RaahAccess, periodId: string) {
  const body = await readJson(req);
  const expectedRevision = body?.expectedRevision;
  if (!Number.isInteger(expectedRevision) || (expectedRevision as number) < 1) {
    return fail(422, '기준 버전을 확인해 주세요.', 'RAAH_INVALID_INPUT');
  }
  const result = await rpc('raah_rpc_close_period', {
    p_workspace: access.workspaceId,
    p_actor: access.user.uid,
    p_period_id: periodId,
    p_expected_revision: expectedRevision,
  });
  if (result.response) return result.response;
  return json(result.data);
}

async function reopenPeriod(req: Request, access: RaahAccess, periodId: string) {
  const body = await readJson(req);
  const expectedRevision = body?.expectedRevision;
  const reason = cleanText(body?.reason);
  if (!Number.isInteger(expectedRevision) || (expectedRevision as number) < 1 || !reason || reason.length > 200) {
    return fail(422, '기준 버전과 다시 여는 이유(200자 이내)를 확인해 주세요.', 'RAAH_INVALID_INPUT');
  }
  const result = await rpc('raah_rpc_reopen_period', {
    p_workspace: access.workspaceId,
    p_actor: access.user.uid,
    p_period_id: periodId,
    p_expected_revision: expectedRevision,
    p_reason: reason,
  });
  if (result.response) return result.response;
  return json(result.data);
}

async function createPeriod(req: Request, access: RaahAccess) {
  const idempotencyKey = req.headers.get('idempotency-key') || '';
  if (!IDEMPOTENCY_KEY.test(idempotencyKey)) return fail(422, 'Idempotency-Key 헤더가 필요합니다.', 'RAAH_IDEMPOTENCY_KEY_REQUIRED');

  const body = await readJson(req);
  const name = cleanText(body?.name);
  const guideVersion = cleanText(body?.guideVersion);
  const { startsOn, endsOn } = body || {};
  const serviceDate = body?.serviceDate || null;
  const attendanceEventId = body?.attendanceEventId || null;
  if (
    !name || name.length > 80 ||
    !guideVersion || guideVersion.length > 40 ||
    !isValidDate(startsOn) || !isValidDate(endsOn) || endsOn < startsOn ||
    (serviceDate !== null && !isValidDate(serviceDate)) ||
    (attendanceEventId !== null && (typeof attendanceEventId !== 'string' || !UUID.test(attendanceEventId)))
  ) {
    return fail(422, '주기 이름, 기간, 안내문 버전을 확인해 주세요.', 'RAAH_INVALID_INPUT');
  }

  const normalized = { name, startsOn, endsOn, guideVersion, serviceDate, attendanceEventId };
  const requestHash = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  const result = await rpc('raah_rpc_create_communion_period', {
    p_workspace: access.workspaceId,
    p_actor: access.user.uid,
    p_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
    p_name: name,
    p_starts_on: startsOn,
    p_ends_on: endsOn,
    p_guide_version: guideVersion,
    p_service_date: serviceDate,
    p_attendance_event_id: attendanceEventId,
  });
  if (result.response) return result.response;
  return json({ id: result.data }, 201);
}

async function updateRoster(req: Request, access: RaahAccess, periodId: string) {
  const body = await readJson(req);
  const entries = Array.isArray(body?.entries) ? (body.entries as unknown[]) : null;
  const valid =
    entries &&
    entries.length > 0 &&
    entries.length <= MAX_ROSTER_BATCH &&
    entries.every((entry) => {
      const item = entry as { memberId?: unknown; included?: unknown };
      return typeof item?.memberId === 'string' && UUID.test(item.memberId) && typeof item.included === 'boolean';
    });
  if (!valid) return fail(422, `명부 변경은 1~${MAX_ROSTER_BATCH}명씩 보내 주세요.`, 'RAAH_INVALID_INPUT');

  // Each entry is its own transaction and safe to repeat, so a partial failure
  // is reported and the client can simply resend the same batch.
  const reviewIds: string[] = [];
  for (const entry of entries as Array<{ memberId: string; included: boolean }>) {
    const result = await rpc('raah_rpc_set_roster_entry', {
      p_workspace: access.workspaceId,
      p_actor: access.user.uid,
      p_period_id: periodId,
      p_member_id: entry.memberId,
      p_included: entry.included,
    });
    if (result.response) {
      const error = await result.response.json();
      return json({ ...error, applied: reviewIds.length }, result.response.status);
    }
    reviewIds.push(result.data as string);
  }
  return json({ applied: reviewIds.length, reviewIds });
}

// A period's services (plan 6, R11). Closed periods are frozen by the RPCs.
async function addOccasion(req: Request, access: RaahAccess, periodId: string) {
  const body = await readJson(req);
  if (!isValidDate(body?.serviceDate)) return fail(422, '성찬 시행일을 확인해 주세요.', 'RAAH_INVALID_INPUT');
  const result = await rpc('raah_rpc_add_occasion', {
    p_workspace: access.workspaceId,
    p_actor: access.user.uid,
    p_period_id: periodId,
    p_service_date: body.serviceDate,
  });
  if (result.response) return result.response;
  return json(result.data, 201);
}

const OCCASION_STATUSES = ['scheduled', 'held', 'cancelled'];

async function updateOccasion(req: Request, access: RaahAccess, occasionId: string) {
  const body = await readJson(req);
  const expectedRevision = body?.expectedRevision;
  const status = body?.status ?? null;
  const serviceDate = body?.serviceDate ?? null;
  if (
    !Number.isInteger(expectedRevision) || (expectedRevision as number) < 1 ||
    (status === null && serviceDate === null) ||
    (status !== null && (typeof status !== 'string' || !OCCASION_STATUSES.includes(status))) ||
    (serviceDate !== null && !isValidDate(serviceDate))
  ) {
    return fail(422, '변경할 내용과 기준 버전을 확인해 주세요.', 'RAAH_INVALID_INPUT');
  }
  const result = await rpc('raah_rpc_update_occasion', {
    p_workspace: access.workspaceId,
    p_actor: access.user.uid,
    p_occasion_id: occasionId,
    p_expected_revision: expectedRevision,
    p_status: status,
    p_service_date: serviceDate,
  });
  if (result.response) return result.response;
  return json(result.data);
}

async function transitionReview(req: Request, access: RaahAccess, reviewId: string) {
  const body = await readJson(req);
  const status = body?.status;
  const expectedRevision = body?.expectedRevision;
  const reason = body?.reason === undefined || body?.reason === null ? null : cleanText(body.reason);
  if (
    typeof status !== 'string' || !REVIEW_STATUSES.includes(status as ReviewStatus) ||
    !Number.isInteger(expectedRevision) || (expectedRevision as number) < 1 ||
    (reason !== null && reason.length > 200)
  ) {
    return fail(422, '변경할 상태와 기준 버전을 확인해 주세요.', 'RAAH_INVALID_INPUT');
  }
  const result = await rpc('raah_rpc_transition_review', {
    p_workspace: access.workspaceId,
    p_actor: access.user.uid,
    p_review_id: reviewId,
    p_expected_revision: expectedRevision,
    p_to_status: status,
    p_reason: reason,
  });
  if (result.response) return result.response;
  return json({ id: reviewId, status, revision: result.data });
}

type ReviewDetailRow = {
  id: string;
  member_id: string;
  status: ReviewStatus;
  roster_state: 'included' | 'excluded';
  status_reason: string | null;
  revision: number;
  updated_at: string;
  raah_members?: { name: string } | null;
  period_id: string;
  raah_communion_periods?: {
    starts_on: string;
    raah_communion_occasions?: Array<{ service_date: string; status: string; attendance_event_id: string | null }>;
  } | null;
  raah_communion_review_logs?: Array<{
    linked_at: string;
    raah_visitation_logs?: { id: string; date: string; log_type: string; public_summary: string | null } | null;
  }>;
};

type PreviousReviewRow = {
  status: ReviewStatus;
  updated_at: string;
  raah_communion_periods: {
    name: string;
    starts_on: string;
    raah_communion_occasions?: Array<{ service_date: string; status: string }>;
  } | null;
};

async function getReview(access: RaahAccess, reviewId: string) {
  const query = new URLSearchParams({
    select:
      'id,member_id,period_id,status,roster_state,status_reason,revision,updated_at,raah_members(name),raah_communion_periods(starts_on,raah_communion_occasions(service_date,status,attendance_event_id)),' +
      'raah_communion_review_logs(linked_at,raah_visitation_logs(id,date,log_type,public_summary))',
    workspace_id: `eq.${access.workspaceId}`,
    id: `eq.${reviewId}`,
    limit: '1',
  });
  const result = await upstream(`raah_communion_reviews?${query}`);
  if (result.response) return result.response;
  const row = (result.data as ReviewDetailRow[])[0];
  if (!row) return fail(404, '대상을 찾을 수 없습니다.', 'RAAH_NOT_FOUND');
  const logs = (row.raah_communion_review_logs || [])
    .filter((link) => link.raah_visitation_logs)
    .map((link) => ({
      id: link.raah_visitation_logs!.id,
      date: link.raah_visitation_logs!.date,
      logType: link.raah_visitation_logs!.log_type,
      publicSummary: link.raah_visitation_logs!.public_summary || '',
      linkedAt: link.linked_at,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Earlier periods for the same member, for reference only: status and time,
  // never conversation content or reasons. It does not affect this review.
  let previousReviews: Array<{ periodName: string; periodServiceDate: string | null; status: ReviewStatus; statusChangedAt: string }> = [];
  const startsOn = row.raah_communion_periods?.starts_on;
  if (startsOn) {
    const previousQuery = new URLSearchParams({
      select: 'status,updated_at,raah_communion_periods!inner(name,starts_on,raah_communion_occasions(service_date,status))',
      workspace_id: `eq.${access.workspaceId}`,
      member_id: `eq.${row.member_id}`,
      period_id: `neq.${row.period_id}`,
      roster_state: 'eq.included',
      'raah_communion_periods.starts_on': `lt.${startsOn}`,
    });
    const previous = await upstream(`raah_communion_reviews?${previousQuery}`);
    if (previous.response) return previous.response;
    previousReviews = (previous.data as PreviousReviewRow[])
      .filter((entry) => entry.raah_communion_periods)
      .sort((a, b) => b.raah_communion_periods!.starts_on.localeCompare(a.raah_communion_periods!.starts_on))
      .slice(0, 3)
      .map((entry) => {
        const occasions = (entry.raah_communion_periods!.raah_communion_occasions || [])
          .filter((occasion) => occasion.status !== 'cancelled')
          .sort((a, b) => a.service_date.localeCompare(b.service_date));
        return {
          periodName: entry.raah_communion_periods!.name,
          periodServiceDate: occasions[0]?.service_date ?? null,
          status: entry.status,
          statusChangedAt: entry.updated_at,
        };
      });
  }
  const participation = await loadParticipation(access, row.member_id, row.raah_communion_periods?.raah_communion_occasions || []);
  if ('response' in participation) return participation.response;
  return json({
    review: {
      id: row.id,
      memberId: row.member_id,
      memberName: row.raah_members?.name || '',
      status: row.status,
      rosterState: row.roster_state,
      statusReason: row.status_reason || '',
      revision: row.revision,
      updatedAt: row.updated_at,
    },
    logs,
    previousReviews,
    participation: participation.data,
  });
}

// Context only: derived from attendance at read time, enum facts only.
async function loadParticipation(access: RaahAccess, memberId: string, occasions: Array<{ service_date: string; status: string; attendance_event_id: string | null }>) {
  const open = occasions.filter((occasion) => occasion.status !== 'cancelled');
  if (open.length === 0) return { data: [] as ReturnType<typeof buildParticipation> };
  const dates = [...new Set(open.map((occasion) => occasion.service_date))];
  const linkedIds = [...new Set(open.map((occasion) => occasion.attendance_event_id).filter((value): value is string => Boolean(value)))];
  const filters = [`date.in.(${dates.join(',')})`, ...(linkedIds.length ? [`id.in.(${linkedIds.join(',')})`] : [])];
  const events = await upstream(`raah_attendance_events?${new URLSearchParams({ select: 'id,date,event_type,includes_communion', or: `(${filters.join(',')})` })}`);
  if (events.response) return { response: events.response };
  const eventRows = events.data as AttendanceEventInput[];
  let recordRows: AttendanceRecordInput[] = [];
  if (eventRows.length > 0) {
    const records = await upstream(
      `raah_attendance_records?${new URLSearchParams({
        select: 'event_id,communion_participated',
        member_id: `eq.${memberId}`,
        event_id: `in.(${eventRows.map((event) => event.id).join(',')})`,
      })}`
    );
    if (records.response) return { response: records.response };
    recordRows = records.data as AttendanceRecordInput[];
  }
  return { data: buildParticipation(open, eventRows, recordRows, seoulToday()) };
}

const textField = (value: unknown, max: number) => {
  const text = cleanText(value);
  return text.length <= max ? text : null;
};

// Records a conversation (new encrypted log) or links an existing log of the same member.
async function addReviewLog(req: Request, access: RaahAccess, reviewId: string) {
  const body = await readJson(req);
  if (typeof body?.visitationLogId === 'string') {
    if (!UUID.test(body.visitationLogId)) return fail(422, '연결할 기록을 확인해 주세요.', 'RAAH_INVALID_INPUT');
    const linked = await rpc('raah_rpc_link_review_log', {
      p_workspace: access.workspaceId,
      p_actor: access.user.uid,
      p_review_id: reviewId,
      p_visitation_log_id: body.visitationLogId,
    });
    if (linked.response) return linked.response;
    return json({ linked: linked.data === true });
  }

  const idempotencyKey = req.headers.get('idempotency-key') || '';
  if (!IDEMPOTENCY_KEY.test(idempotencyKey)) return fail(422, 'Idempotency-Key 헤더가 필요합니다.', 'RAAH_IDEMPOTENCY_KEY_REQUIRED');
  const secret = getEnv('RAAH_ENCRYPTION_SECRET');
  if (!secret) return fail(503, 'RAAH encryption is not configured.', 'RAAH_ENCRYPTION_NOT_CONFIGURED');

  const expectedRevision = body?.expectedRevision;
  const date = body?.date;
  const innerNote = textField(body?.innerNote, 5000);
  const prayerTopics = textField(body?.prayerTopics, 5000);
  const nextSteps = textField(body?.nextSteps, 3000);
  const privateRemarks = textField(body?.privateRemarks, 3000);
  const publicSummary = textField(body?.publicSummary, 200);
  if (
    !Number.isInteger(expectedRevision) || (expectedRevision as number) < 1 ||
    !isValidDate(date) ||
    !innerNote || prayerTopics === null || nextSteps === null || privateRemarks === null || publicSummary === null
  ) {
    return fail(422, '대화일과 대화·권면 기록을 확인해 주세요.', 'RAAH_INVALID_INPUT');
  }

  // Same four-field body as every visitation log, so the existing editor never drops fields.
  const payload = { innerNote, prayerTopics, nextSteps, privateRemarks };
  // Keyed hash: the idempotency table must not hold a guessable fingerprint of pastoral text.
  const requestHash = createHmac('sha256', secret)
    .update(JSON.stringify({ reviewId, expectedRevision, date, publicSummary, ...payload }))
    .digest('hex');
  const result = await rpc('raah_rpc_create_review_log', {
    p_workspace: access.workspaceId,
    p_actor: access.user.uid,
    p_actor_name: access.user.name,
    p_review_id: reviewId,
    p_expected_revision: expectedRevision,
    p_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
    p_date: date,
    p_public_summary: publicSummary,
    p_encrypted_payload: encryptPayload(payload, secret),
    p_encryption_version: ENCRYPTION_VERSION,
  });
  if (result.response) return result.response;
  return json(result.data, 201);
}

export default async (req: Request, context: Context) => {
  // Hidden until the pastoral guide and pilot are approved; see plan 16.1.
  if (!isCommunionEnabled()) return fail(404, 'Not found', 'RAAH_COMMUNION_DISABLED');

  const accessCheck = await requireRaahAccess(req, { requireGrant: true });
  if (accessCheck.response || !accessCheck.access) return accessCheck.response;
  const access = accessCheck.access;

  const { pathname } = new URL(req.url);
  const id = context.params?.id;
  if (id !== undefined && !UUID.test(id)) return fail(404, '대상을 찾을 수 없습니다.', 'RAAH_NOT_FOUND');

  if (pathname.endsWith('/logs') && id && req.method === 'POST') return addReviewLog(req, access, id);
  if (pathname.includes('/communion/reviews/') && id && !pathname.endsWith('/logs')) {
    if (req.method === 'GET') return getReview(access, id);
    if (req.method === 'PATCH') return transitionReview(req, access, id);
  }
  if (pathname.includes('/communion/occasions/') && id && req.method === 'PATCH') return updateOccasion(req, access, id);
  if (pathname.endsWith('/occasions') && id && req.method === 'POST') return addOccasion(req, access, id);
  if (pathname.endsWith('/roster') && id && req.method === 'POST') return updateRoster(req, access, id);
  if (pathname.endsWith('/close') && id && req.method === 'POST') return closePeriod(req, access, id);
  if (pathname.endsWith('/reopen') && id && req.method === 'POST') return reopenPeriod(req, access, id);
  if (pathname.includes('/communion/periods')) {
    if (!id && req.method === 'GET') return listPeriods(access);
    if (!id && req.method === 'POST') return createPeriod(req, access);
    const isPeriodItself = !/\/(roster|close|reopen|occasions)$/.test(pathname);
    if (id && req.method === 'GET' && isPeriodItself) return getPeriod(access, id);
    if (id && req.method === 'DELETE' && isPeriodItself) return deletePeriod(access, id);
  }
  return fail(405, 'Method not allowed', 'RAAH_METHOD_NOT_ALLOWED');
};

export const config: Config = {
  path: [
    '/api/raah/communion/periods',
    '/api/raah/communion/periods/:id',
    '/api/raah/communion/periods/:id/roster',
    '/api/raah/communion/periods/:id/close',
    '/api/raah/communion/periods/:id/reopen',
    '/api/raah/communion/periods/:id/occasions',
    '/api/raah/communion/occasions/:id',
    '/api/raah/communion/reviews/:id',
    '/api/raah/communion/reviews/:id/logs',
  ],
};
