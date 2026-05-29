import { User } from 'firebase/auth';

export type RaahMemberStatus = 'active' | 'inactive';

export type RaahMember = {
  id: string;
  name: string;
  searchName: string;
  birthDate?: string;
  phone?: string;
  address?: string;
  position?: string;
  district?: string;
  registeredAt?: string;
  status: RaahMemberStatus;
  publicNote?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type RaahMemberInput = {
  name: string;
  birthDate?: string;
  phone?: string;
  address?: string;
  position?: string;
  district?: string;
  registeredAt?: string;
  status: RaahMemberStatus;
  publicNote?: string;
};

export type RaahVisitationSensitiveFields = {
  innerNote: string;
  prayerTopics: string;
  nextSteps?: string;
  privateRemarks?: string;
};

export type RaahVisitationLog = RaahVisitationSensitiveFields & {
  id: string;
  memberId?: string;
  memberName: string;
  memberSearchName: string;
  date: string;
  logType: string;
  publicSummary?: string;
  isEncrypted: boolean;
  encryptionVersion: number;
  hasFollowUp?: boolean;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type RaahVisitationLogInput = RaahVisitationSensitiveFields & {
  memberId?: string;
  memberName: string;
  date: string;
  logType: string;
  publicSummary?: string;
};

export type RaahDashboardSummary = {
  memberCount: number;
  activeMemberCount: number;
  logCount: number;
  encryptedLogCount: number;
  thisWeekLogCount: number;
  thisWeekAttendanceCount: number;
  thisWeekCommunionCount: number;
};

export type RaahAttendanceEventType = 'sunday_morning' | 'sunday_afternoon' | 'young_adults' | 'wednesday_prayer' | 'other';

export type RaahAttendanceRecord = {
  id?: string;
  memberId: string;
  memberName: string;
  memberSearchName: string;
  attended: boolean;
  communionParticipated: boolean;
  note?: string;
};

export type RaahAttendanceEvent = {
  id: string;
  date: string;
  eventType?: RaahAttendanceEventType;
  serviceType: string;
  includesCommunion: boolean;
  memo?: string;
  records: RaahAttendanceRecord[];
  createdAt?: string;
  updatedAt?: string;
};

export type RaahAttendanceHistoryRecord = {
  memberId: string;
  date: string;
  eventType?: RaahAttendanceEventType;
  serviceType?: string;
  attended: boolean;
  communionParticipated: boolean;
};

export type RaahAttendanceInput = {
  date: string;
  eventType?: RaahAttendanceEventType;
  serviceType: string;
  includesCommunion: boolean;
  memo?: string;
  records: Array<{
    memberId: string;
    memberName: string;
    attended: boolean;
    communionParticipated: boolean;
    note?: string;
  }>;
};

export type RaahFollowUpResolution = {
  id: string;
  sourceType: 'visitation';
  sourceId: string;
  candidateKey: string;
  memberId?: string;
  memberName?: string;
  memo?: string;
  completedAt: string;
  completedByName?: string;
};

export type RaahMinistryScheduleItemType = 'visitation' | 'counseling' | 'task' | 'meeting' | 'other';

export type RaahMinistryScheduleItem = {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  startsAt?: string;
  endsAt?: string;
  itemType: RaahMinistryScheduleItemType;
  memberId?: string;
  memberName?: string;
  status: 'open' | 'done';
  source: 'manual' | 'google_calendar';
  externalId?: string;
  memo?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type RaahMinistryScheduleItemInput = {
  title: string;
  date: string;
  endDate?: string;
  startsAt?: string;
  endsAt?: string;
  itemType: RaahMinistryScheduleItemType;
  memberId?: string;
  memberName?: string;
  memo?: string;
};

export type RaahFollowUpResolutionInput = {
  sourceType: 'visitation';
  sourceId: string;
  memberId?: string;
  memberName?: string;
  memo?: string;
};

export type RaahCalendarStatus = {
  configured: boolean;
  connected: boolean;
  calendarId?: string;
  calendarSummary?: string;
  googleAccountEmail?: string;
  connectedAt?: string;
  message?: string;
};

export type RaahGoogleCalendarEventInput = {
  title: string;
  date: string;
  endDate?: string;
  startsAt: string;
  endsAt?: string;
  memberId?: string;
  memberName?: string;
  memo?: string;
  sourceLogId?: string;
};

type ApiMember = {
  id: string;
  name: string;
  searchName: string;
  birthDate?: string;
  phone?: string;
  address?: string;
  position?: string;
  district?: string;
  registeredAt?: string;
  status: RaahMemberStatus;
  publicNote?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ApiLog = {
  id: string;
  memberId?: string;
  memberName: string;
  memberSearchName: string;
  date: string;
  logType: string;
  publicSummary?: string;
  isEncrypted: boolean;
  encryptionVersion: number;
  hasFollowUp?: boolean;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
  sensitive?: RaahVisitationSensitiveFields;
};

type ApiAttendanceEvent = RaahAttendanceEvent;
type ApiFollowUpResolution = RaahFollowUpResolution;
type ApiScheduleItem = RaahMinistryScheduleItem;

type ApiBootstrap = {
  summary: RaahDashboardSummary;
  members: ApiMember[];
  logs: ApiLog[];
  attendance: ApiAttendanceEvent | null;
  attendanceEvents?: ApiAttendanceEvent[];
  attendanceHistory?: RaahAttendanceHistoryRecord[];
  followUpResolutions?: ApiFollowUpResolution[];
  ministryScheduleItems?: ApiScheduleItem[];
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
    const message = typeof data?.error === 'string' ? data.error : 'RAAH API request failed.';
    const error = new Error(message) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = typeof data?.code === 'string' ? data.code : undefined;
    throw error;
  }

  return data as T;
}

function toMember(member: ApiMember): RaahMember {
  return member;
}

function toLog(log: ApiLog): RaahVisitationLog {
  return {
    id: log.id,
    memberId: log.memberId,
    memberName: log.memberName,
    memberSearchName: log.memberSearchName,
    date: log.date,
    logType: log.logType,
    publicSummary: log.publicSummary,
    isEncrypted: log.isEncrypted,
    encryptionVersion: log.encryptionVersion,
    hasFollowUp: log.hasFollowUp,
    createdByName: log.createdByName,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
    innerNote: log.sensitive?.innerNote || '',
    prayerTopics: log.sensitive?.prayerTopics || '',
    nextSteps: log.sensitive?.nextSteps || '',
    privateRemarks: log.sensitive?.privateRemarks || '',
  };
}

export async function getRaahDashboardSummary(user: User) {
  const response = await fetch('/api/raah/summary', {
    headers: await getAuthHeaders(user),
  });
  const data = await readJsonResponse<{ summary: RaahDashboardSummary }>(response);
  return data.summary;
}

export async function getRaahBootstrap(date: string, user: User) {
  const response = await fetch(`/api/raah/bootstrap?date=${encodeURIComponent(date)}`, {
    headers: await getAuthHeaders(user),
  });
  const data = await readJsonResponse<ApiBootstrap>(response);
  return {
    summary: data.summary,
    members: data.members.map(toMember),
    logs: data.logs.map(toLog),
    attendance: data.attendance,
    attendanceEvents: data.attendanceEvents || (data.attendance ? [data.attendance] : []),
    attendanceHistory: data.attendanceHistory || [],
    followUpResolutions: data.followUpResolutions || [],
    ministryScheduleItems: data.ministryScheduleItems || [],
  };
}

export async function listRaahMembers(user: User) {
  const response = await fetch('/api/raah/members', {
    headers: await getAuthHeaders(user),
  });
  const data = await readJsonResponse<{ members: ApiMember[] }>(response);
  return data.members.map(toMember);
}

export async function createRaahMember(input: RaahMemberInput, user: User) {
  const response = await fetch('/api/raah/members', {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(input),
  });
  const data = await readJsonResponse<{ member: ApiMember }>(response);
  return toMember(data.member);
}

export async function updateRaahMember(memberId: string, input: RaahMemberInput, user: User) {
  const response = await fetch(`/api/raah/members/${encodeURIComponent(memberId)}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(input),
  });
  const data = await readJsonResponse<{ member: ApiMember }>(response);
  return toMember(data.member);
}

export async function listRaahVisitationLogs(user: User) {
  const response = await fetch('/api/raah/visitation-logs', {
    headers: await getAuthHeaders(user),
  });
  const data = await readJsonResponse<{ logs: ApiLog[] }>(response);
  return data.logs.map(toLog);
}

export async function getRaahVisitationLogDetail(logId: string, user: User) {
  const response = await fetch(`/api/raah/visitation-logs/${encodeURIComponent(logId)}`, {
    headers: await getAuthHeaders(user),
  });
  const data = await readJsonResponse<{ log: ApiLog }>(response);
  return toLog(data.log);
}

export async function createRaahVisitationLog(input: RaahVisitationLogInput, user: User) {
  const response = await fetch('/api/raah/visitation-logs', {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(input),
  });
  const data = await readJsonResponse<{ log: ApiLog }>(response);
  return toLog(data.log);
}

export async function updateRaahVisitationLog(logId: string, input: RaahVisitationLogInput, user: User) {
  const response = await fetch(`/api/raah/visitation-logs/${encodeURIComponent(logId)}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(input),
  });
  const data = await readJsonResponse<{ log: ApiLog }>(response);
  return toLog(data.log);
}

export async function getRaahAttendance(date: string, user: User) {
  const response = await fetch(`/api/raah/attendance?date=${encodeURIComponent(date)}`, {
    headers: await getAuthHeaders(user),
  });
  const data = await readJsonResponse<{ attendance: ApiAttendanceEvent | null }>(response);
  return data.attendance;
}

export async function saveRaahAttendance(input: RaahAttendanceInput, user: User) {
  const response = await fetch('/api/raah/attendance', {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(input),
  });
  const data = await readJsonResponse<{ attendance: ApiAttendanceEvent }>(response);
  return data.attendance;
}

export async function resolveRaahFollowUp(input: RaahFollowUpResolutionInput, user: User) {
  const response = await fetch('/api/raah/follow-ups/resolve', {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(input),
  });
  const data = await readJsonResponse<{ resolution: ApiFollowUpResolution }>(response);
  return data.resolution;
}

export async function createRaahMinistryScheduleItem(input: RaahMinistryScheduleItemInput, user: User) {
  const response = await fetch('/api/raah/schedule', {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(input),
  });
  const data = await readJsonResponse<{ item: ApiScheduleItem }>(response);
  return data.item;
}

export async function updateRaahMinistryScheduleItem(itemId: string, input: RaahMinistryScheduleItemInput, user: User) {
  const response = await fetch(`/api/raah/schedule/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(input),
  });
  const data = await readJsonResponse<{ item: ApiScheduleItem }>(response);
  return data.item;
}

export async function completeRaahMinistryScheduleItem(itemId: string, user: User) {
  const response = await fetch(`/api/raah/schedule/${encodeURIComponent(itemId)}/complete`, {
    method: 'POST',
    headers: await getAuthHeaders(user),
  });
  const data = await readJsonResponse<{ item: ApiScheduleItem }>(response);
  return data.item;
}

export async function getRaahCalendarStatus(user: User) {
  const response = await fetch('/api/raah/calendar/status', {
    headers: await getAuthHeaders(user),
  });
  return readJsonResponse<RaahCalendarStatus>(response);
}

export async function getRaahCalendarAuthUrl(user: User) {
  const response = await fetch('/api/raah/calendar/auth-url', {
    headers: await getAuthHeaders(user),
  });
  return readJsonResponse<{ url: string }>(response);
}

export async function syncRaahGoogleCalendar(user: User) {
  const response = await fetch('/api/raah/calendar/sync', {
    method: 'POST',
    headers: await getAuthHeaders(user),
  });
  const data = await readJsonResponse<{ items: ApiScheduleItem[] }>(response);
  return data.items;
}

export async function createRaahGoogleCalendarEvent(input: RaahGoogleCalendarEventInput, user: User) {
  const response = await fetch('/api/raah/calendar/events', {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(input),
  });
  const data = await readJsonResponse<{ item: ApiScheduleItem }>(response);
  return data.item;
}
