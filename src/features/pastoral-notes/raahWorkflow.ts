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
