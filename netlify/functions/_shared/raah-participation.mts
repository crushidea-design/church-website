// Communion participation as a fact for context (plan 7.6, 16.3). It is derived
// at read time from attendance and never stored, never changes a review's
// status, and is never a judgement: only these four enum values leave the
// server, no attendance notes or names.

export type ParticipationFact = 'participated' | 'not_recorded' | 'no_attendance_event' | 'upcoming';

export type OccasionInput = { service_date: string; status: string; attendance_event_id: string | null };
export type AttendanceEventInput = { id: string; date: string; event_type: string; includes_communion: boolean };
export type AttendanceRecordInput = { event_id: string; communion_participated: boolean };

/** Today in Seoul as YYYY-MM-DD (the church works in Seoul time). */
export const seoulToday = (now: Date = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now);

/**
 * The event of the service day: the linked one if it still exists, otherwise
 * the morning service that day (preferring one that includes communion).
 */
export function pickAttendanceEvent(occasion: OccasionInput, events: AttendanceEventInput[]) {
  if (occasion.attendance_event_id) {
    const linked = events.find((event) => event.id === occasion.attendance_event_id);
    if (linked) return linked;
  }
  const sameDay = events.filter((event) => event.date === occasion.service_date && event.event_type === 'sunday_morning');
  return sameDay.find((event) => event.includes_communion) ?? sameDay[0] ?? null;
}

export function deriveParticipationFact(input: {
  serviceDate: string;
  today: string;
  event: AttendanceEventInput | null;
  records: AttendanceRecordInput[];
}): ParticipationFact {
  if (!input.event) return input.serviceDate > input.today ? 'upcoming' : 'no_attendance_event';
  const record = input.records.find((entry) => entry.event_id === input.event!.id);
  return record?.communion_participated ? 'participated' : 'not_recorded';
}

/** One entry per non-cancelled occasion, in date order. `records` are this member's only. */
export function buildParticipation(
  occasions: OccasionInput[],
  events: AttendanceEventInput[],
  records: AttendanceRecordInput[],
  today: string
) {
  return occasions
    .filter((occasion) => occasion.status !== 'cancelled')
    .sort((a, b) => a.service_date.localeCompare(b.service_date))
    .map((occasion) => ({
      serviceDate: occasion.service_date,
      occasionStatus: occasion.status,
      fact: deriveParticipationFact({ serviceDate: occasion.service_date, today, event: pickAttendanceEvent(occasion, events), records }),
    }));
}
