import { RaahMinistryScheduleItemType } from './managementApi';

export type GoogleCalendarEventDate = {
  date?: string;
  dateTime?: string;
};

export type GoogleCalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  start?: GoogleCalendarEventDate;
  end?: GoogleCalendarEventDate;
};

export type GoogleCalendarEventInput = {
  title: string;
  date: string;
  startsAt: string;
  endsAt?: string;
  memo?: string;
  timeZone: string;
};

export function addOneHour(time: string) {
  const [hour = '0', minute = '0'] = time.split(':');
  const nextHour = (Number(hour) + 1) % 24;
  return `${String(nextHour).padStart(2, '0')}:${String(Number(minute)).padStart(2, '0')}`;
}

export function buildGoogleCalendarEventPayload(input: GoogleCalendarEventInput) {
  const startsAt = input.startsAt || '09:00';
  const endsAt = input.endsAt || addOneHour(startsAt);
  return {
    summary: input.title,
    description: input.memo || '',
    start: { dateTime: `${input.date}T${startsAt}:00`, timeZone: input.timeZone },
    end: { dateTime: `${input.date}T${endsAt}:00`, timeZone: input.timeZone },
  };
}

export function normalizeGoogleEventTime(value?: GoogleCalendarEventDate) {
  if (!value) return { date: '', startsAt: '' };
  if (value.date) return { date: value.date, startsAt: '' };
  const dateTime = value.dateTime || '';
  return {
    date: dateTime.slice(0, 10),
    startsAt: dateTime.slice(11, 16),
  };
}

function inferScheduleType(title: string): RaahMinistryScheduleItemType {
  if (title.includes('심방')) return 'visitation';
  if (title.includes('상담')) return 'counseling';
  if (title.includes('회의') || title.includes('모임')) return 'meeting';
  return 'task';
}

export function mapGoogleEventToScheduleItem(event: GoogleCalendarEvent) {
  const start = normalizeGoogleEventTime(event.start);
  const end = normalizeGoogleEventTime(event.end);
  const title = event.summary || 'Google Calendar 일정';
  return {
    title,
    date: start.date,
    startsAt: start.startsAt,
    endsAt: end.startsAt,
    itemType: inferScheduleType(title),
    source: 'google_calendar' as const,
    externalId: event.id,
    memo: event.description || '',
  };
}
