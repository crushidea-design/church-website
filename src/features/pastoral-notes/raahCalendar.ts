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
  endDate?: string;
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

function addDaysToDateIso(dateIso: string, days: number) {
  const [year, month, day] = dateIso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function subtractDaysFromDateIso(dateIso: string, days: number) {
  return addDaysToDateIso(dateIso, -days);
}

export function buildGoogleCalendarEventPayload(input: GoogleCalendarEventInput) {
  const endDate = input.endDate || input.date;
  if (!input.startsAt && !input.endsAt && endDate !== input.date) {
    return {
      summary: input.title,
      description: input.memo || '',
      start: { date: input.date },
      end: { date: addDaysToDateIso(endDate, 1) },
    };
  }
  const startsAt = input.startsAt || '09:00';
  const endsAt = input.endsAt || addOneHour(startsAt);
  return {
    summary: input.title,
    description: input.memo || '',
    start: { dateTime: `${input.date}T${startsAt}:00`, timeZone: input.timeZone },
    end: { dateTime: `${endDate}T${endsAt}:00`, timeZone: input.timeZone },
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
  const endDate = event.end?.date ? subtractDaysFromDateIso(event.end.date, 1) : end.date || start.date;
  const title = event.summary || 'Google Calendar 일정';
  return {
    title,
    date: start.date,
    endDate: endDate < start.date ? start.date : endDate,
    startsAt: start.startsAt,
    endsAt: end.startsAt,
    itemType: inferScheduleType(title),
    source: 'google_calendar' as const,
    externalId: event.id,
    memo: event.description || '',
  };
}
