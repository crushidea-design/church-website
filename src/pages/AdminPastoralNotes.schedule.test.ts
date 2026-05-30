import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('RAAH dashboard schedule form wiring', () => {
  it('exposes ministry schedule as its own RAAH tab', () => {
    const source = readFileSync(new URL('./AdminPastoralNotes.tsx', import.meta.url), 'utf8');

    expect(source).toContain("type ActiveTab = 'dashboard' | 'members' | 'attendance' | 'schedule' | 'visitation' | 'legacy'");
    expect(source).toContain("schedule: '사역일정'");
    expect(source).toContain("{ id: 'schedule', label: TEXT.tabs.schedule");
    expect(source).toContain("activeTab === 'schedule'");
    expect(source).toContain('<ScheduleTab');
    expect(source).toContain('전체 일정 목록');
    expect(source).toContain('onSelectDate={(dateIso) => {');
    expect(source).toContain('onCopySchedule={(item) => {');
    expect(source).toContain('Google 동기화');
    expect(source).toContain('Google 설정 필요');
    expect(source).toContain('fixed left-1/2 top-[max(6rem,12vh)]');
    expect(source).toContain('w-[min(520px,calc(100vw-2rem))]');
    expect(source).toContain('onOpenNew(anchorDate)');
    expect(source).toContain('onWheel={handleCalendarWheel}');
    expect(source).toContain('endDate: scheduleForm.endDate || scheduleForm.date');
    expect(source).not.toContain('className="mt-4 grid gap-3 rounded-lg border border-[#dbe3e8] bg-[#f8fafb] p-3 lg:grid-cols-[minmax(160px,1fr),150px,110px,120px,minmax(160px,1fr),80px]"');
    expect(source).toContain("setAnchorDate((current) => (viewMode === 'week' ? addDaysIso(current, direction * 7) : addMonthsIso(current, direction)))");
    expect(source).toContain("memberId: scheduleForm.memberId || ''");
    expect(source).toContain("memberName: scheduleForm.memberName || ''");
    expect(source).not.toContain("selectedMember?.name || ''");
  });

  it('saves dashboard schedule items through the RAAH schedule API, not Google Calendar events', () => {
    const source = readFileSync(new URL('./AdminPastoralNotes.tsx', import.meta.url), 'utf8');
    const submitHandler = source.slice(
      source.indexOf('const handleCreateScheduleItem = async'),
      source.indexOf('const handleCompleteScheduleItem = async')
    );

    expect(submitHandler).toContain('createRaahMinistryScheduleItem(input, user)');
    expect(submitHandler).not.toContain('createRaahGoogleCalendarEvent(');
  });

  it('updates existing dashboard schedule items through the RAAH schedule API', () => {
    const source = readFileSync(new URL('./AdminPastoralNotes.tsx', import.meta.url), 'utf8');
    const managementApi = readFileSync(new URL('../features/pastoral-notes/managementApi.ts', import.meta.url), 'utf8');
    const server = readFileSync(new URL('../../netlify/functions/raah-management.mts', import.meta.url), 'utf8');
    const submitHandler = source.slice(
      source.indexOf('const handleCreateScheduleItem = async'),
      source.indexOf('const handleCompleteScheduleItem = async')
    );

    expect(source).toContain('editingScheduleItemId');
    expect(source).toContain('onEdit={openScheduleFormForEdit}');
    expect(submitHandler).toContain('editingScheduleItemId ? await updateRaahMinistryScheduleItem(editingScheduleItemId, input, user)');
    expect(managementApi).toContain('export async function updateRaahMinistryScheduleItem');
    expect(managementApi).toContain('endDate?: string;');
    expect(managementApi).toContain("method: 'PATCH'");
    expect(server).toContain('const handleUpdateScheduleItem = async');
    expect(server).toContain('end_date: input.endDate || input.date');
    expect(server).toContain("if (route === 'schedule' && req.method === 'PATCH' && id) return handleUpdateScheduleItem(req, id);");
  });

  it('syncs Google Calendar over a wider schedule window and exports unsynced RAAH items', () => {
    const calendarServer = readFileSync(new URL('../../netlify/functions/raah-calendar.mts', import.meta.url), 'utf8');
    const calendarClient = readFileSync(new URL('../features/pastoral-notes/raahCalendar.ts', import.meta.url), 'utf8');

    expect(calendarServer).toContain('const getCalendarSyncWindow = () =>');
    expect(calendarServer).toContain('source=eq.manual&external_id=is.null&status=eq.open');
    expect(calendarServer).toContain("body: JSON.stringify({ source: 'google_calendar', external_id: createdEvent.id })");
    expect(calendarServer).toContain('end_date: endDate < start.date ? start.date : endDate');
    expect(calendarClient).toContain('endDate?: string;');
    expect(calendarClient).toContain('endDate: endDate < start.date ? start.date : endDate');
  });
});

describe('RAAH record editing wiring', () => {
  it('updates existing visitation logs and legacy notes instead of only creating new records', () => {
    const source = readFileSync(new URL('./AdminPastoralNotes.tsx', import.meta.url), 'utf8');
    const noteApi = readFileSync(new URL('../features/pastoral-notes/api.ts', import.meta.url), 'utf8');
    const managementApi = readFileSync(new URL('../features/pastoral-notes/managementApi.ts', import.meta.url), 'utf8');
    const notesServer = readFileSync(new URL('../../netlify/functions/raah-notes.mts', import.meta.url), 'utf8');
    const managementServer = readFileSync(new URL('../../netlify/functions/raah-management.mts', import.meta.url), 'utf8');

    expect(source).toContain('editingLogId');
    expect(source).toContain('openLogFormForEdit');
    expect(source).toContain('editingLegacyNoteId');
    expect(source).toContain('openLegacyFormForEdit');
    expect(source).toContain('editingLogId ? await updateRaahVisitationLog(editingLogId, logForm, user)');
    expect(source).toContain('editingLegacyNoteId ? await updateRaahNote(editingLegacyNoteId, legacyForm, user)');
    expect(managementApi).toContain('export async function updateRaahVisitationLog');
    expect(noteApi).toContain('export async function updateRaahNote');
    expect(notesServer).toContain('const handleUpdate = async');
    expect(notesServer).toContain("if (req.method === 'PATCH' && noteId) return handleUpdate(req, noteId);");
    expect(managementServer).toContain('const handleUpdateLog = async');
    expect(managementServer).toContain("if (route === 'visitation-logs' && req.method === 'PATCH' && id) return handleUpdateLog(req, id);");
  });
});

describe('RAAH attendance date wiring', () => {
  it('keeps Wednesday prayer attendance on the Wednesday date for the selected week', () => {
    const source = readFileSync(new URL('./AdminPastoralNotes.tsx', import.meta.url), 'utf8');
    const helpers = readFileSync(new URL('../features/pastoral-notes/adminHelpers.ts', import.meta.url), 'utf8');

    expect(helpers).toContain("if (eventType === 'wednesday_prayer') return addDaysIso(weekStart, 3);");
    expect(source).toContain('const nextDate = getDateForAttendanceEventType(dateOverride || attendanceDate, eventType);');
    expect(source).toContain('setAttendanceDate(nextDate);');
    expect(source).toContain('date: getDateForAttendanceEventType(attendanceDate, activeAttendanceEventType),');
    expect(source).toContain('onEventTypeChange(event.eventType, event.date);');
  });
});
