import { RaahAttendanceEventType, RaahAttendanceHistoryRecord, RaahMember } from './managementApi';

const STANDARD_EVENT_TYPES: RaahAttendanceEventType[] = ['sunday_morning', 'sunday_afternoon', 'young_adults', 'wednesday_prayer'];
const EVENT_TYPE_ORDER: RaahAttendanceEventType[] = [...STANDARD_EVENT_TYPES, 'other'];

const EVENT_DAY_OFFSET: Partial<Record<RaahAttendanceEventType, number>> = {
  sunday_morning: 0,
  sunday_afternoon: 0,
  young_adults: 0,
  wednesday_prayer: 3,
};

export type RaahAttendanceFlowEvent = {
  key: string;
  date: string;
  eventType: RaahAttendanceEventType;
  serviceType: string;
  recorded: boolean;
};

export type RaahAttendanceFlowWeek = {
  key: string;
  weekStartDate: string;
  events: RaahAttendanceFlowEvent[];
};

export type RaahAttendanceFlowCell = {
  eventKey: string;
  attended: boolean | null;
  communionParticipated: boolean;
};

export type RaahAttendanceFlowRow = {
  memberId: string;
  memberName: string;
  searchName: string;
  cells: RaahAttendanceFlowCell[];
  attendedCount: number;
  absenceCount: number;
  recordedCount: number;
  requiredAttendedCount: number;
  requiredAbsenceCount: number;
  requiredRecordedCount: number;
  currentAbsent: boolean;
  consecutiveAbsences: number;
};

export type RaahAttendanceFlow = {
  events: RaahAttendanceFlowEvent[];
  weeks: RaahAttendanceFlowWeek[];
  rows: RaahAttendanceFlowRow[];
  concernRows: RaahAttendanceFlowRow[];
};

export function attendanceEventKey(date: string, eventType: RaahAttendanceEventType = 'sunday_morning') {
  return `${date}:${eventType}`;
}

function parseDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const next = parseDate(date);
  next.setUTCDate(next.getUTCDate() + days);
  return formatDate(next);
}

export function getAttendanceWeekStart(date: string) {
  const parsed = parseDate(date);
  parsed.setUTCDate(parsed.getUTCDate() - parsed.getUTCDay());
  return formatDate(parsed);
}

export function buildRaahAttendanceFlow({
  members,
  history,
  limit = 6,
}: {
  members: RaahMember[];
  history: RaahAttendanceHistoryRecord[];
  limit?: number;
}): RaahAttendanceFlow {
  const eventMap = new Map<string, RaahAttendanceFlowEvent>();
  history.forEach((record) => {
    const eventType = record.eventType || 'sunday_morning';
    const key = attendanceEventKey(record.date, eventType);
    if (!eventMap.has(key)) {
      eventMap.set(key, {
        key,
        date: record.date,
        eventType,
        serviceType: record.serviceType || eventType,
        recorded: true,
      });
    }
  });

  const observedEvents = [...eventMap.values()]
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return EVENT_TYPE_ORDER.indexOf(a.eventType) - EVENT_TYPE_ORDER.indexOf(b.eventType);
    });
  const weekKeys = [...new Set(observedEvents.map((event) => getAttendanceWeekStart(event.date)))]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit);
  const weeks = weekKeys.map((weekStartDate) => {
    const existingEvents = observedEvents.filter((event) => getAttendanceWeekStart(event.date) === weekStartDate);
    const existingStandardByType = new Map(
      existingEvents
        .filter((event) => STANDARD_EVENT_TYPES.includes(event.eventType))
        .map((event) => [event.eventType, event])
    );
    const standardEvents = STANDARD_EVENT_TYPES.map((eventType) => {
      const existing = existingStandardByType.get(eventType);
      if (existing) return existing;
      const date = addDays(weekStartDate, EVENT_DAY_OFFSET[eventType] || 0);
      return {
        key: attendanceEventKey(date, eventType),
        date,
        eventType,
        serviceType: eventType,
        recorded: false,
      };
    });
    const extraEvents = existingEvents.filter((event) => !STANDARD_EVENT_TYPES.includes(event.eventType));
    const events = [...standardEvents, ...extraEvents];
    return {
      key: weekStartDate,
      weekStartDate,
      events,
    };
  });
  const events = weeks.flatMap((week) => week.events);
  const eventKeys = new Set(events.map((event) => event.key));
  const recordMap = new Map<string, RaahAttendanceHistoryRecord>();
  history.forEach((record) => {
    const key = attendanceEventKey(record.date, record.eventType || 'sunday_morning');
    if (eventKeys.has(key)) recordMap.set(`${record.memberId}:${key}`, record);
  });

  const rows = members
    .filter((member) => member.status !== 'inactive')
    .map((member) => {
      const cells = events.map((event) => {
        const record = recordMap.get(`${member.id}:${event.key}`);
        return {
          eventKey: event.key,
          attended: record ? Boolean(record.attended) : null,
          communionParticipated: Boolean(record?.communionParticipated),
        };
      });
      const attendedCount = cells.filter((cell) => cell.attended === true).length;
      const absenceCount = cells.filter((cell) => cell.attended === false).length;
      const recordedCount = attendedCount + absenceCount;
      const requiredCells = cells.filter((cell, index) => events[index]?.eventType === 'sunday_morning');
      const requiredAttendedCount = requiredCells.filter((cell) => cell.attended === true).length;
      const requiredAbsenceCount = requiredCells.filter((cell) => cell.attended === false).length;
      const requiredRecordedCount = requiredAttendedCount + requiredAbsenceCount;
      const recordedRequiredCells = requiredCells.filter((cell) => cell.attended !== null);
      const recordedCells = cells.filter((cell) => cell.attended !== null);
      const absenceSignalCells = recordedRequiredCells.length > 0 ? recordedRequiredCells : recordedCells;
      const currentAbsent = absenceSignalCells[0]?.attended === false;
      let consecutiveAbsences = 0;
      for (const cell of absenceSignalCells) {
        if (cell.attended !== false) break;
        consecutiveAbsences += 1;
      }

      return {
        memberId: member.id,
        memberName: member.name,
        searchName: member.searchName,
        cells,
        attendedCount,
        absenceCount,
        recordedCount,
        requiredAttendedCount,
        requiredAbsenceCount,
        requiredRecordedCount,
        currentAbsent,
        consecutiveAbsences,
      };
    })
    .sort((a, b) => {
      if (b.consecutiveAbsences !== a.consecutiveAbsences) return b.consecutiveAbsences - a.consecutiveAbsences;
      if (b.requiredAbsenceCount !== a.requiredAbsenceCount) return b.requiredAbsenceCount - a.requiredAbsenceCount;
      return a.memberName.localeCompare(b.memberName, 'ko-KR');
    });

  return {
    events,
    weeks,
    rows,
    concernRows: rows.filter((row) => row.consecutiveAbsences >= 2 || row.requiredAbsenceCount >= 2 || row.currentAbsent).slice(0, 8),
  };
}
