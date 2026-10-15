import { describe, expect, it } from 'vitest';
import { buildParticipation, deriveParticipationFact, pickAttendanceEvent, seoulToday } from './raah-participation.mjs';

const event = (id: string, date: string, overrides: Record<string, unknown> = {}) => ({
  id,
  date,
  event_type: 'sunday_morning',
  includes_communion: true,
  ...overrides,
});
const occasion = (service_date: string, overrides: Record<string, unknown> = {}) => ({ service_date, status: 'scheduled', attendance_event_id: null, ...overrides });

describe('pickAttendanceEvent', () => {
  it('uses the linked event when it exists', () => {
    const events = [event('e1', '2026-10-11'), event('e2', '2026-10-13', { event_type: 'other' })];
    expect(pickAttendanceEvent(occasion('2026-10-11', { attendance_event_id: 'e2' }), events)?.id).toBe('e2');
  });

  it('falls back to the morning service of that day when the link is missing or gone', () => {
    const events = [event('e1', '2026-10-11'), event('e3', '2026-10-11', { event_type: 'young_adults' })];
    expect(pickAttendanceEvent(occasion('2026-10-11', { attendance_event_id: 'deleted' }), events)?.id).toBe('e1');
    expect(pickAttendanceEvent(occasion('2026-10-11'), events)?.id).toBe('e1');
  });

  it('prefers a communion service when several morning events share the day', () => {
    const events = [event('a', '2026-10-11', { includes_communion: false }), event('b', '2026-10-11')];
    expect(pickAttendanceEvent(occasion('2026-10-11'), events)?.id).toBe('b');
  });

  it('finds nothing on a day without a morning event', () => {
    expect(pickAttendanceEvent(occasion('2026-10-18'), [event('e1', '2026-10-11'), event('e2', '2026-10-18', { event_type: 'wednesday_prayer' })])).toBeNull();
  });
});

describe('deriveParticipationFact', () => {
  const e1 = event('e1', '2026-10-11');
  it('reports participation from the record', () => {
    expect(deriveParticipationFact({ serviceDate: '2026-10-11', today: '2026-10-12', event: e1, records: [{ event_id: 'e1', communion_participated: true }] })).toBe('participated');
  });

  it('reports not_recorded for a missing record or no participation, including attended-only', () => {
    expect(deriveParticipationFact({ serviceDate: '2026-10-11', today: '2026-10-12', event: e1, records: [] })).toBe('not_recorded');
    expect(deriveParticipationFact({ serviceDate: '2026-10-11', today: '2026-10-12', event: e1, records: [{ event_id: 'e1', communion_participated: false }] })).toBe('not_recorded');
    expect(deriveParticipationFact({ serviceDate: '2026-10-11', today: '2026-10-12', event: e1, records: [{ event_id: 'other', communion_participated: true }] })).toBe('not_recorded');
  });

  it('separates a past day without an event from an upcoming one', () => {
    expect(deriveParticipationFact({ serviceDate: '2026-10-11', today: '2026-10-12', event: null, records: [] })).toBe('no_attendance_event');
    expect(deriveParticipationFact({ serviceDate: '2026-10-12', today: '2026-10-12', event: null, records: [] })).toBe('no_attendance_event');
    expect(deriveParticipationFact({ serviceDate: '2026-10-13', today: '2026-10-12', event: null, records: [] })).toBe('upcoming');
  });

  it('uses the event over the date when an event already exists for a future day', () => {
    expect(deriveParticipationFact({ serviceDate: '2026-10-13', today: '2026-10-12', event: event('e', '2026-10-13'), records: [] })).toBe('not_recorded');
  });
});

describe('buildParticipation', () => {
  it('skips cancelled services, keeps date order and exposes only the enum facts', () => {
    const result = buildParticipation(
      [occasion('2026-10-20'), occasion('2026-10-13', { status: 'held' }), occasion('2026-10-06', { status: 'cancelled' })],
      [event('e1', '2026-10-13')],
      [{ event_id: 'e1', communion_participated: true }],
      '2026-10-14'
    );
    expect(result).toEqual([
      { serviceDate: '2026-10-13', occasionStatus: 'held', fact: 'participated' },
      { serviceDate: '2026-10-20', occasionStatus: 'scheduled', fact: 'upcoming' },
    ]);
  });
});

describe('seoulToday', () => {
  it('uses Seoul time, not UTC', () => {
    expect(seoulToday(new Date('2026-10-12T16:00:00Z'))).toBe('2026-10-13');
    expect(seoulToday(new Date('2026-10-12T14:59:00Z'))).toBe('2026-10-12');
  });
});
