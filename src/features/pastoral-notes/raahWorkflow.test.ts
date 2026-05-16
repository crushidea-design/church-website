import { describe, expect, it } from 'vitest';
import {
  buildAttendanceRecordsForEvent,
  buildFollowUpCandidateKey,
  filterResolvedFollowUps,
  groupMinistryScheduleItems,
  selectAttendanceEvent,
} from './raahWorkflow';
import { RaahAttendanceEvent, RaahMember, RaahMinistryScheduleItem, RaahVisitationLog } from './managementApi';

const member = (id: string, name: string, status: RaahMember['status'] = 'active'): RaahMember => ({
  id,
  name,
  searchName: name.toLocaleLowerCase('ko-KR'),
  status,
});

const log = (id: string, memberId: string, nextSteps = '연락 필요'): RaahVisitationLog => ({
  id,
  memberId,
  memberName: `성도 ${memberId}`,
  memberSearchName: memberId,
  date: '2026-05-10',
  logType: '심방',
  publicSummary: '요약',
  isEncrypted: true,
  encryptionVersion: 1,
  hasFollowUp: Boolean(nextSteps),
  innerNote: '',
  prayerTopics: '',
  nextSteps,
  privateRemarks: '',
});

describe('RAAH workflow helpers', () => {
  it('builds stable follow-up keys and filters resolved candidates', () => {
    const logs = [log('log-1', 'member-1'), log('log-2', 'member-2')];
    const resolved = [
      {
        id: 'resolution-1',
        sourceType: 'visitation' as const,
        sourceId: 'log-1',
        candidateKey: buildFollowUpCandidateKey('visitation', 'log-1'),
        completedAt: '2026-05-13T00:00:00.000Z',
        completedByName: 'Admin',
      },
    ];

    expect(buildFollowUpCandidateKey('visitation', 'log-1')).toBe('visitation:log-1');
    expect(filterResolvedFollowUps(logs, resolved).map((item) => item.id)).toEqual(['log-2']);
  });

  it('selects the requested attendance event and initializes active-member records', () => {
    const events: RaahAttendanceEvent[] = [
      {
        id: 'event-1',
        date: '2026-05-10',
        eventType: 'sunday_morning',
        serviceType: '주일 오전',
        includesCommunion: true,
        records: [{ memberId: 'member-1', memberName: '김민교', memberSearchName: '김민교', attended: true, communionParticipated: true }],
      },
    ];
    const selected = selectAttendanceEvent(events, 'sunday_morning');

    expect(selected?.id).toBe('event-1');
    expect(selectAttendanceEvent(events, 'young_adults')).toBeNull();
    expect(buildAttendanceRecordsForEvent([member('member-1', '김민교'), member('member-2', '김수진'), member('member-3', '휴면', 'inactive')], selected)).toEqual([
      { id: undefined, memberId: 'member-1', memberName: '김민교', memberSearchName: '김민교', attended: true, communionParticipated: true, note: '' },
      { id: undefined, memberId: 'member-2', memberName: '김수진', memberSearchName: '김수진', attended: false, communionParticipated: false, note: '' },
    ]);
  });

  it('groups open ministry schedule items into today and this week', () => {
    const items: RaahMinistryScheduleItem[] = [
      { id: 'today', title: '심방', date: '2026-05-13', itemType: 'visitation', status: 'open', source: 'manual' },
      { id: 'week', title: '양육 준비', date: '2026-05-16', itemType: 'task', status: 'open', source: 'manual' },
      { id: 'done', title: '완료됨', date: '2026-05-14', itemType: 'task', status: 'done', source: 'manual' },
      { id: 'next-week', title: '다음 주', date: '2026-05-18', itemType: 'meeting', status: 'open', source: 'manual' },
    ];

    expect(groupMinistryScheduleItems(items, '2026-05-13')).toEqual({
      today: [items[0]],
      thisWeek: [items[1]],
    });
  });
});
