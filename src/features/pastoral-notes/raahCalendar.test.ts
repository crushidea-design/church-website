import { describe, expect, it } from 'vitest';
import { buildGoogleCalendarEventPayload, mapGoogleEventToScheduleItem, normalizeGoogleEventTime } from './raahCalendar';

describe('RAAH Google Calendar helpers', () => {
  it('builds a Google Calendar event payload from visitation schedule input', () => {
    expect(
      buildGoogleCalendarEventPayload({
        title: '심방 - 김민교',
        date: '2026-05-13',
        startsAt: '14:00',
        endsAt: '15:30',
        memo: '카페에서 만남',
        timeZone: 'Asia/Seoul',
      })
    ).toEqual({
      summary: '심방 - 김민교',
      description: '카페에서 만남',
      start: { dateTime: '2026-05-13T14:00:00', timeZone: 'Asia/Seoul' },
      end: { dateTime: '2026-05-13T15:30:00', timeZone: 'Asia/Seoul' },
    });
  });

  it('defaults event end time to one hour after start', () => {
    expect(
      buildGoogleCalendarEventPayload({
        title: '심방 - 김민교',
        date: '2026-05-13',
        startsAt: '14:00',
        memo: '',
        timeZone: 'Asia/Seoul',
      }).end
    ).toEqual({ dateTime: '2026-05-13T15:00:00', timeZone: 'Asia/Seoul' });
  });

  it('normalizes Google all-day and timed event values', () => {
    expect(normalizeGoogleEventTime({ date: '2026-05-13' })).toEqual({ date: '2026-05-13', startsAt: '' });
    expect(normalizeGoogleEventTime({ dateTime: '2026-05-13T14:30:00+09:00' })).toEqual({ date: '2026-05-13', startsAt: '14:30' });
  });

  it('maps Google events into RAAH schedule items', () => {
    expect(
      mapGoogleEventToScheduleItem({
        id: 'google-event-1',
        summary: '심방 - 김민교',
        description: '카페에서 만남',
        start: { dateTime: '2026-05-13T14:00:00+09:00' },
        end: { dateTime: '2026-05-13T15:00:00+09:00' },
      })
    ).toEqual({
      title: '심방 - 김민교',
      date: '2026-05-13',
      startsAt: '14:00',
      endsAt: '15:00',
      itemType: 'visitation',
      source: 'google_calendar',
      externalId: 'google-event-1',
      memo: '카페에서 만남',
    });
  });
});
