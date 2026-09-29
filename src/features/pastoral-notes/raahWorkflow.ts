import {
  RaahAttendanceEvent,
  RaahAttendanceEventType,
  RaahAttendanceRecord,
  RaahFollowUpResolution,
  RaahMember,
  RaahMinistryScheduleItem,
  RaahVisitationLog,
} from './managementApi';

export function buildFollowUpCandidateKey(sourceType: RaahFollowUpResolution['sourceType'], sourceId: string) {
  return `${sourceType}:${sourceId}`;
}

export function filterResolvedFollowUps(logs: RaahVisitationLog[], resolutions: RaahFollowUpResolution[]) {
  const resolvedKeys = new Set(resolutions.map((resolution) => resolution.candidateKey));
  return logs.filter((log) => {
    const hasFollowUp = Boolean(log.hasFollowUp || log.nextSteps?.trim());
    return hasFollowUp && !resolvedKeys.has(buildFollowUpCandidateKey('visitation', log.id));
  });
}

export function selectAttendanceEvent(events: RaahAttendanceEvent[], eventType: RaahAttendanceEventType) {
  return events.find((event) => (event.eventType || 'sunday_morning') === eventType) || null;
}

export function buildAttendanceRecordsForEvent(members: RaahMember[], event: RaahAttendanceEvent | null): RaahAttendanceRecord[] {
  const existingRecords = new Map((event?.records || []).map((record) => [record.memberId, record]));
  return members
    .filter((member) => member.status === 'active')
    .map((member) => {
      const existing = existingRecords.get(member.id);
      return {
        id: existing?.id || undefined,
        memberId: member.id,
        memberName: member.name,
        memberSearchName: member.searchName,
        attended: existing?.attended || false,
        communionParticipated: existing?.communionParticipated || false,
        note: existing?.note || '',
      };
    });
}

export type RaahDataStatus = 'loading' | 'ready' | 'legacy' | 'error';

export type RaahAttendanceSummary =
  | { status: 'loading' | 'legacy' | 'error' }
  | { status: 'not_recorded'; activeMemberCount: number }
  | {
      status: 'recorded';
      activeMemberCount: number;
      attendedCount: number;
      absentCount: number;
      unrecordedCount: number;
      communionCount: number | null;
    };

// Summarises the saved attendance event only. Members without a saved row
// (e.g. registered after the check) are counted as unrecorded, never absent,
// and a missing event or failed load never turns into zero or absences.
export function summarizeSavedAttendance(
  dataStatus: RaahDataStatus,
  members: RaahMember[],
  event: RaahAttendanceEvent | null
): RaahAttendanceSummary {
  if (dataStatus !== 'ready') return { status: dataStatus };
  const activeMembers = members.filter((member) => member.status === 'active');
  if (!event) return { status: 'not_recorded', activeMemberCount: activeMembers.length };

  const savedRecords = new Map((event.records || []).map((record) => [record.memberId, record]));
  let attendedCount = 0;
  let absentCount = 0;
  let unrecordedCount = 0;
  let communionCount = 0;
  for (const member of activeMembers) {
    const record = savedRecords.get(member.id);
    if (!record) unrecordedCount += 1;
    else if (record.attended) {
      attendedCount += 1;
      if (record.communionParticipated) communionCount += 1;
    } else absentCount += 1;
  }

  return {
    status: 'recorded',
    activeMemberCount: activeMembers.length,
    attendedCount,
    absentCount,
    unrecordedCount,
    communionCount: event.includesCommunion ? communionCount : null,
  };
}

function toLocalDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function getWeekEnd(today: Date) {
  const end = new Date(today);
  end.setDate(today.getDate() + (6 - today.getDay()));
  return end;
}

export function groupMinistryScheduleItems(items: RaahMinistryScheduleItem[], todayIso: string) {
  const today = toLocalDate(todayIso);
  const weekEnd = getWeekEnd(today);
  const openItems = items
    .filter((item) => item.status === 'open')
    .sort((a, b) => `${a.date} ${a.startsAt || ''}`.localeCompare(`${b.date} ${b.startsAt || ''}`));

  return {
    today: openItems.filter((item) => item.date === todayIso),
    thisWeek: openItems.filter((item) => {
      const itemDate = toLocalDate(item.date);
      return item.date !== todayIso && itemDate > today && itemDate <= weekEnd;
    }),
  };
}
