// Attendance-domain components extracted from AdminPastoralNotes.tsx.
// AttendanceSnapshot renders the dashboard summary; AttendanceTab is
// the full attendance check-in UI; AttendanceFlowPanel renders the
// long-form weekly grid. All take data and callbacks via props.
import React from 'react';
import { CheckSquare } from 'lucide-react';
import {
  RaahAttendanceEvent,
  RaahAttendanceEventType,
  RaahAttendanceHistoryRecord,
  RaahAttendanceRecord,
  RaahMember,
} from './managementApi';
import {
  RaahAttendanceFlowCell,
  RaahAttendanceFlowEvent,
  buildRaahAttendanceFlow,
} from './attendanceFlow';
import { formatDisplayDate } from './utils';
import { shell } from './adminShell';
import { BigToggle, EmptyState, MiniCount, TextArea, TextInput } from './AdminPrimitives';
import { ATTENDANCE_EVENT_OPTIONS, percent } from './adminHelpers';

export function AttendanceSnapshot({
  date,
  activeMemberCount,
  attendanceCount,
  communionCount,
  absentCount,
  attendanceRate,
  communionRate,
  flow,
  onOpenAttendance,
}: {
  date: string;
  activeMemberCount: number;
  attendanceCount: number;
  communionCount: number;
  absentCount: number;
  attendanceRate: number;
  communionRate: number;
  flow: ReturnType<typeof buildRaahAttendanceFlow>;
  onOpenAttendance: () => void;
}) {
  const latestWeek = flow.weeks[0];
  const eventSummaries = latestWeek?.events.map((event) => {
    const index = flow.events.findIndex((flowEvent) => flowEvent.key === event.key);
    const cells = index >= 0 ? flow.rows.map((row) => row.cells[index]).filter(Boolean) : [];
    const recorded = cells.filter((cell) => cell.attended !== null);
    const attended = cells.filter((cell) => cell.attended === true).length;
    const absent = cells.filter((cell) => cell.attended === false).length;
    return {
      event,
      attended,
      absent,
      recordedCount: recorded.length,
      rate: percent(attended, recorded.length),
    };
  }) || [];
  const latestEventIndex = flow.events.findIndex((event) => event.key === latestWeek?.events[0]?.key);
  const recentAbsentees = latestEventIndex >= 0
    ? flow.rows.filter((row) => row.cells[latestEventIndex]?.attended === false).slice(0, 4)
    : [];
  const contactTargets = flow.concernRows.slice(0, 4);

  return (
    <div className={shell.panel + ' p-4'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">주일 출석 현황</h2>
          <p className="mt-1 text-sm text-[#607080]">{formatDisplayDate(date)} 기준</p>
        </div>
        <button type="button" onClick={onOpenAttendance} className={shell.ghostButton}>
          출석 열기
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <ProgressMetric label="출석률" value={`${attendanceRate}%`} width={attendanceRate} helper={`출석 ${attendanceCount}명 / 활성 ${activeMemberCount}명`} />
        <ProgressMetric label="성찬 참여" value={`${communionRate}%`} width={communionRate} helper={attendanceCount ? `성찬 ${communionCount}명 / 출석 ${attendanceCount}명` : '아직 출석 체크가 없습니다.'} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniCount label="출석" value={attendanceCount} />
        <MiniCount label="성찬" value={communionCount} />
        <MiniCount label="미출석" value={absentCount} />
      </div>

      {eventSummaries.length > 0 && (
        <div className="mt-4 grid gap-2">
          {eventSummaries.map(({ event, attended, absent, recordedCount, rate }) => (
            <button key={event.key} type="button" onClick={onOpenAttendance} className="rounded-lg border border-[#dbe3e8] bg-[#f8fafb] p-3 text-left transition hover:border-[#2e6b5f] hover:bg-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#17202b]">{getAttendanceEventLabel(event)}</p>
                  <p className="mt-1 text-xs text-[#607080]">{event.date.slice(5).replace('-', '.')} · 출석 {attended}명 · 결석 {absent}명</p>
                </div>
                <span className="text-sm font-semibold text-[#2e6b5f]">{recordedCount ? `${rate}%` : '-'}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dbe3e8]">
                <div className="h-full rounded-full bg-[#2e6b5f]" style={{ width: `${rate}%` }} />
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <AttendancePeopleList title="최근 결석자" rows={recentAbsentees} empty="최근 결석 기록이 없습니다." />
        <AttendancePeopleList title="연락 대상자" rows={contactTargets} empty="우선 연락 대상자가 없습니다." />
      </div>
    </div>
  );
}

export function AttendancePeopleList({ title, rows, empty }: { title: string; rows: ReturnType<typeof buildRaahAttendanceFlow>['rows']; empty: string }) {
  return (
    <div className={shell.mutedPanel + ' p-3'}>
      <p className="text-xs font-semibold text-[#607080]">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-[#7a8b9a]">{empty}</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {rows.map((row) => (
            <div key={row.memberId} className="flex items-center justify-between gap-2 rounded-md bg-white px-2.5 py-2 text-xs">
              <span className="truncate font-semibold text-[#17202b]">{row.memberName}</span>
              <span className="shrink-0 text-[#607080]">주일 오전 {row.requiredAbsenceCount}회</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProgressMetric({ label, value, width, helper }: { label: string; value: string; width: number; helper: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-[#17202b]">{label}</span>
        <span className="font-semibold text-[#2e6b5f]">{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dbe3e8]">
        <div className="h-full rounded-full bg-[#12345a] transition-[width]" style={{ width: `${width}%` }} />
      </div>
      <p className="mt-1 text-xs text-[#607080]">{helper}</p>
    </div>
  );
}

export function StatusMetric({ label, value, tone, helper }: { label: string; value: string; tone: 'good' | 'alert' | 'neutral'; helper: string }) {
  const toneClass =
    tone === 'good'
      ? 'border-[#2e6b5f] bg-[#eef3ec] text-[#12345a]'
      : tone === 'alert'
        ? 'border-[#d8b7a6] bg-[#fff6ef] text-[#8a4b32]'
        : 'border-[#dbe3e8] bg-[#ffffff] text-[#607080]';

  return (
    <div className={shell.mutedPanel + ' p-4'}>
      <p className="text-xs font-semibold text-[#607080]">{label}</p>
      <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-sm font-semibold ${toneClass}`}>{value}</span>
      <p className="mt-2 text-xs text-[#607080]">{helper}</p>
    </div>
  );
}

export function AttendanceTab({
  attendance,
  attendanceEvents,
  activeEventType,
  onEventTypeChange,
  date,
  setDate,
  serviceType,
  setServiceType,
  includesCommunion,
  setIncludesCommunion,
  memo,
  setMemo,
  members,
  attendanceHistory,
  records,
  allRecords,
  setRecords,
  attendanceCount,
  communionCount,
  showAbsencesOnly,
  setShowAbsencesOnly,
  expandedNotes,
  setExpandedNotes,
  isSaving,
  disabled,
  onToggle,
  onSave,
}: {
  attendance: RaahAttendanceEvent | null;
  attendanceEvents: RaahAttendanceEvent[];
  activeEventType: RaahAttendanceEventType;
  onEventTypeChange: (eventType: RaahAttendanceEventType, dateOverride?: string) => void;
  date: string;
  setDate: (value: string) => void;
  serviceType: string;
  setServiceType: (value: string) => void;
  includesCommunion: boolean;
  setIncludesCommunion: (value: boolean) => void;
  memo: string;
  setMemo: (value: string) => void;
  members: RaahMember[];
  attendanceHistory: RaahAttendanceHistoryRecord[];
  records: RaahAttendanceRecord[];
  allRecords: RaahAttendanceRecord[];
  setRecords: React.Dispatch<React.SetStateAction<RaahAttendanceRecord[]>>;
  attendanceCount: number;
  communionCount: number;
  showAbsencesOnly: boolean;
  setShowAbsencesOnly: (value: boolean) => void;
  expandedNotes: boolean;
  setExpandedNotes: (value: boolean) => void;
  isSaving: boolean;
  disabled: boolean;
  onToggle: (memberId: string, field: 'attended' | 'communionParticipated') => void;
  onSave: () => void;
}) {
  const attendanceFlow = React.useMemo(
    () => buildRaahAttendanceFlow({ members, history: attendanceHistory, limit: 6 }),
    [attendanceHistory, members]
  );

  return (
    <section className="space-y-4">
      <AttendanceFlowPanel
        flow={attendanceFlow}
        onSelectEvent={(event) => {
          setDate(event.date);
          onEventTypeChange(event.eventType, event.date);
        }}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px),minmax(0,1fr)]">
        <div className={shell.panel + ' p-4'}>
        <h2 className="text-lg font-semibold">출석 설정</h2>
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {ATTENDANCE_EVENT_OPTIONS.map((option) => {
              const hasEvent = attendanceEvents.some((event) => (event.eventType || 'sunday_morning') === option.type);
              const active = activeEventType === option.type;
              return (
                <button key={option.type} type="button" onClick={() => onEventTypeChange(option.type)} className={active ? shell.button : shell.ghostButton}>
                  {option.label}
                  {hasEvent && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </button>
              );
            })}
          </div>
          <TextInput label="날짜" type="date" value={date} onChange={setDate} />
          <TextInput label="예배 유형" value={serviceType} onChange={setServiceType} placeholder="주일예배" />
          <label className="flex items-center justify-between rounded-md border border-[#d5dee5] bg-[#f8fafb] px-3 py-2.5 text-sm font-semibold text-[#28415b]">
            <span>성찬 체크 포함</span>
            <input
              type="checkbox"
              checked={includesCommunion}
              onChange={(event) => {
                setIncludesCommunion(event.target.checked);
                if (!event.target.checked) setRecords((prev) => prev.map((record) => ({ ...record, communionParticipated: false })));
              }}
              className="h-5 w-5 accent-[#12345a]"
            />
          </label>
          <TextArea label="예배 메모" value={memo} onChange={setMemo} rows={2} />
          <div className="grid grid-cols-2 gap-3">
            <MiniCount label="출석" value={attendanceCount} />
            <MiniCount label="성찬" value={communionCount} />
          </div>
          <button type="button" onClick={onSave} disabled={isSaving || disabled} className={shell.button + ' w-full'}>
            <CheckSquare size={16} />
            {isSaving ? '저장 중...' : '출석 저장'}
          </button>
          {attendance?.updatedAt && <p className="text-xs text-[#607080]">저장됨 · {new Date(attendance.updatedAt).toLocaleString('ko-KR')}</p>}
        </div>
      </div>

        <div className={shell.panel + ' p-4'}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold">주일 출석 및 성찬 체크</h2>
            <p className="mt-1 text-sm text-[#607080]">큰 버튼으로 빠르게 체크하고, 메모는 필요할 때만 펼칩니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setRecords((prev) => prev.map((record) => ({ ...record, attended: true })))} className={shell.ghostButton}>전체 출석</button>
            <button type="button" onClick={() => setRecords((prev) => prev.map((record) => ({ ...record, communionParticipated: includesCommunion ? record.attended : false })))} className={shell.ghostButton}>성찬 전체</button>
            <button type="button" onClick={() => setRecords((prev) => prev.map((record) => ({ ...record, attended: false, communionParticipated: false })))} className={shell.ghostButton}>전체 해제</button>
            <button type="button" onClick={() => setShowAbsencesOnly(!showAbsencesOnly)} className={showAbsencesOnly ? shell.button : shell.ghostButton}>미출석만</button>
            <button type="button" onClick={() => setExpandedNotes(!expandedNotes)} className={expandedNotes ? shell.button : shell.ghostButton}>메모</button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
          {records.length === 0 ? (
            <EmptyState>{allRecords.length === 0 ? '체크할 활성 성도가 없습니다.' : '조건에 맞는 성도가 없습니다.'}</EmptyState>
          ) : (
            records.map((record) => (
              <div key={record.memberId} className="rounded-lg border border-[#dbe3e8] bg-[#f8fafb] p-2.5">
                <div className="grid grid-cols-[minmax(0,1fr),54px,54px] items-center gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{record.memberName}</p>
                    <p className="mt-1 text-xs text-[#607080]">{record.attended ? '출석' : '미출석'}{record.communionParticipated ? ' · 성찬' : ''}</p>
                  </div>
                  <BigToggle active={record.attended} label={`${record.memberName} 출석`} onClick={() => onToggle(record.memberId, 'attended')} text="출석" />
                  <BigToggle disabled={!includesCommunion} active={record.communionParticipated} label={`${record.memberName} 성찬`} onClick={() => onToggle(record.memberId, 'communionParticipated')} text="성찬" accent />
                </div>
                {expandedNotes && (
                  <input
                    value={record.note || ''}
                    onChange={(event) => setRecords((prev) => prev.map((row) => (row.memberId === record.memberId ? { ...row, note: event.target.value } : row)))}
                    className={`${shell.input} mt-3`}
                    placeholder="메모"
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>
      </div>
    </section>
  );
}

export function AttendanceFlowPanel({
  flow,
  onSelectEvent,
}: {
  flow: ReturnType<typeof buildRaahAttendanceFlow>;
  onSelectEvent: (event: RaahAttendanceFlowEvent) => void;
}) {
  const visibleRows = flow.rows.slice(0, 12);
  const currentAbsences = flow.rows.filter((row) => row.currentAbsent).length;
  const repeatedAbsences = flow.rows.filter((row) => row.consecutiveAbsences >= 2 || row.requiredAbsenceCount >= 2).length;
  const steadyRows = flow.rows.filter((row) => row.requiredRecordedCount > 0 && row.requiredAbsenceCount === 0).length;

  return (
    <div className={shell.panel + ' p-4'}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">출석 흐름</h2>
          <p className="mt-1 text-sm text-[#607080]">주일 오전을 필수 출석 기준으로 보고, 다른 모임은 흐름 확인용으로 함께 봅니다.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 lg:min-w-[360px]">
          <MiniCount label="최근 결석" value={currentAbsences} />
          <MiniCount label="반복 결석" value={repeatedAbsences} />
          <MiniCount label="꾸준 출석" value={steadyRows} />
        </div>
      </div>

      {flow.events.length === 0 ? (
        <div className="mt-4">
          <EmptyState>아직 누적된 출석 기록이 없습니다.</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <div className="hidden overflow-x-auto rounded-xl border border-[#dbe3e8] lg:block">
              <table className="min-w-[980px] w-full border-collapse bg-white text-sm">
                <thead className="bg-[#f8fafb]">
                  <tr>
                    <th rowSpan={2} className="w-36 border-b border-r border-[#dbe3e8] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[#607080]">성도</th>
                    {flow.weeks.map((week) => (
                      <th key={week.key} colSpan={week.events.length} className="border-b border-r border-[#dbe3e8] px-3 py-2 text-center text-xs font-semibold text-[#28415b]">
                        {formatWeekLabel(week.weekStartDate)}
                      </th>
                    ))}
                    <th rowSpan={2} className="w-24 border-b border-[#dbe3e8] px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.08em] text-[#607080]">최근</th>
                  </tr>
                  <tr>
                    {flow.weeks.flatMap((week) =>
                      week.events.map((event) => (
                        <th key={event.key} className="border-b border-r border-[#e7edf1] px-2 py-2 text-center text-xs font-semibold text-[#607080]">
                          <button type="button" onClick={() => onSelectEvent(event)} className="rounded-md px-2 py-1 transition hover:bg-[#eef7f3] hover:text-[#2e6b5f]">
                            <span className="block">{getAttendanceEventLabel(event)}</span>
                            <span className="mt-0.5 block font-normal">{event.date.slice(5).replace('-', '.')}</span>
                          </button>
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.memberId} className="border-t border-[#eef2f5]">
                      <td className="border-r border-[#eef2f5] px-3 py-2 font-semibold text-[#17202b]">{row.memberName}</td>
                      {row.cells.map((cell) => (
                        <td key={cell.eventKey} className="border-r border-[#f0f3f5] px-2 py-2 text-center">
                          <AttendanceStatusPill cell={cell} />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center text-xs font-semibold text-[#28415b]">
                        {row.attendedCount}/{row.recordedCount || flow.events.length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:hidden">
            {visibleRows.map((row) => (
              <div key={row.memberId} className="rounded-lg border border-[#dbe3e8] bg-[#f8fafb] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{row.memberName}</p>
                  <span className="text-xs font-semibold text-[#607080]">{row.attendedCount}/{row.recordedCount || flow.events.length}</span>
                </div>
                <div className="mt-3 space-y-3">
                  {flow.weeks.slice(0, 3).map((week) => (
                    <div key={week.key} className="rounded-md border border-[#dbe3e8] bg-white p-2">
                      <p className="text-xs font-semibold text-[#28415b]">{formatWeekLabel(week.weekStartDate)}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {week.events.map((event) => {
                          const index = flow.events.findIndex((flowEvent) => flowEvent.key === event.key);
                          return (
                            <button key={event.key} type="button" onClick={() => onSelectEvent(event)} className="rounded-md border border-[#e3e9ee] p-2 text-left transition hover:border-[#2e6b5f] hover:bg-[#eef7f3]">
                              <span className="block text-[11px] font-semibold text-[#607080]">{getAttendanceEventLabel(event)}</span>
                              <span className="mt-1 flex items-center justify-between gap-2">
                                <span className="text-[11px] text-[#7a8b9a]">{event.date.slice(5).replace('-', '.')}</span>
                                <AttendanceStatusPill cell={row.cells[index]} compact />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function getAttendanceEventLabel(event: RaahAttendanceFlowEvent) {
  return ATTENDANCE_EVENT_OPTIONS.find((option) => option.type === event.eventType)?.label || event.serviceType || '기타';
}

export function formatWeekLabel(weekStartDate: string) {
  return `${weekStartDate.slice(5).replace('-', '.')} 주간`;
}

export function AttendanceStatusPill({ cell, compact }: { cell?: RaahAttendanceFlowCell; compact?: boolean }) {
  const base = compact ? 'min-w-10 px-2 py-1 text-[11px]' : 'min-w-12 px-2.5 py-1 text-xs';
  if (!cell || cell.attended === null) {
    return <span className={`inline-flex justify-center rounded-full border border-[#d5dee5] bg-[#f8fafb] font-semibold text-[#7a8b9a] ${base}`}>-</span>;
  }
  if (cell.attended) {
    return <span className={`inline-flex justify-center rounded-full border border-[#cfddd8] bg-[#eef7f3] font-semibold text-[#2e6b5f] ${base}`}>{cell.communionParticipated ? '성찬' : '출석'}</span>;
  }
  return <span className={`inline-flex justify-center rounded-full border border-[#e4c7b8] bg-[#fff6ef] font-semibold text-[#9a4b34] ${base}`}>결석</span>;
}
