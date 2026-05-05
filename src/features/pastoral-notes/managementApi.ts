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
  serviceType: string;
  includesCommunion: boolean;
  memo?: string;
  records: RaahAttendanceRecord[];
  createdAt?: string;
  updatedAt?: string;
};

export type RaahAttendanceInput = {
  date: string;
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
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
  sensitive?: RaahVisitationSensitiveFields;
};

type ApiAttendanceEvent = RaahAttendanceEvent;

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
