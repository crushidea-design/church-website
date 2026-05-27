import { describe, expect, it } from 'vitest';
import { buildRaahAttendanceFlow } from './attendanceFlow';
import { RaahAttendanceHistoryRecord, RaahMember } from './managementApi';

const member = (id: string, name: string): RaahMember => ({
  id,
  name,
  searchName: name,
  status: 'active',
});

const history = (
  memberId: string,
  date: string,
  attended: boolean,
  eventType: RaahAttendanceHistoryRecord['eventType'] = 'sunday_morning'
): RaahAttendanceHistoryRecord => ({
  memberId,
  date,
  eventType,
  serviceType: eventType === 'sunday_morning' ? '주일 오전예배' : '청년부 모임',
  attended,
  communionParticipated: attended && eventType === 'sunday_morning',
});

describe('buildRaahAttendanceFlow', () => {
  it('builds recent weekly event columns and member rows sorted by attendance concern', () => {
    const result = buildRaahAttendanceFlow({
      members: [member('kim', '김가나'), member('park', '박다윗'), member('lee', '이소망')],
      history: [
        history('kim', '2026-05-24', true),
        history('kim', '2026-05-17', false),
        history('kim', '2026-05-10', true),
        history('park', '2026-05-24', false),
        history('park', '2026-05-17', false),
        history('park', '2026-05-10', true),
        history('lee', '2026-05-24', true),
        history('lee', '2026-05-17', true),
        history('lee', '2026-05-10', true),
      ],
      limit: 3,
    });

    expect(result.weeks.map((week) => week.weekStartDate)).toEqual(['2026-05-24', '2026-05-17', '2026-05-10']);
    expect(result.weeks[0].events.map((event) => event.eventType)).toEqual([
      'sunday_morning',
      'sunday_afternoon',
      'young_adults',
      'wednesday_prayer',
    ]);
    expect(result.rows.map((row) => row.memberName)).toEqual(['박다윗', '김가나', '이소망']);
    expect(result.rows[0]).toMatchObject({
      memberId: 'park',
      attendedCount: 1,
      absenceCount: 2,
      consecutiveAbsences: 1,
      currentAbsent: true,
    });
    expect(result.concernRows.map((row) => row.memberName)).toEqual(['박다윗']);
  });

  it('groups different event types on the same week under one week card', () => {
    const result = buildRaahAttendanceFlow({
      members: [member('kim', '김가나')],
      history: [
        history('kim', '2026-05-24', true, 'sunday_morning'),
        history('kim', '2026-05-24', false, 'young_adults'),
        history('kim', '2026-05-27', true, 'wednesday_prayer'),
      ],
      limit: 4,
    });

    expect(result.weeks).toHaveLength(1);
    expect(result.weeks[0].weekStartDate).toBe('2026-05-24');
    expect(result.weeks[0].events.map((event) => event.key)).toEqual([
      '2026-05-24:sunday_morning',
      '2026-05-24:sunday_afternoon',
      '2026-05-24:young_adults',
      '2026-05-27:wednesday_prayer',
    ]);
    expect(result.rows[0].cells.map((cell) => cell.attended)).toEqual([true, null, false, true]);
  });
});
