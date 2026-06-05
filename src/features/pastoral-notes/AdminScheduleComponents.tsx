// Schedule-domain components extracted from AdminPastoralNotes.tsx.
// MinistrySchedulePanel owns local calendar view state; all other
// pieces are stateless and receive data/callbacks via props.
import React from 'react';
import {
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Plus,
} from 'lucide-react';
import {
  RaahCalendarStatus,
  RaahMinistryScheduleItem,
  RaahMinistryScheduleItemInput,
} from './managementApi';
import { formatDisplayDate } from './utils';
import { shell } from './adminShell';
import { EmptyState, MiniCount, TextInput } from './AdminPrimitives';
import {
  SCHEDULE_TYPES,
  WEEKDAY_LABELS,
  addDaysIso,
  addMonthsIso,
  formatScheduleDateRange,
  getCalendarDisplayName,
  getMonthCalendarDays,
  getMonthRangeLabel,
  getOpenScheduleItems,
  getScheduleMemberLabel,
  getScheduleTypeLabel,
  getTodayIso,
  getWeekCalendarDays,
} from './adminHelpers';

type ScheduleViewMode = 'week' | 'month';

export function ScheduleTab({
  scheduleItems,
  scheduleForm,
  setScheduleForm,
  editingScheduleItemId,
  isScheduleFormOpen,
  onOpenNewSchedule,
  onCloseScheduleForm,
  onEdit,
  calendarStatus,
  isSaving,
  onCreateScheduleItem,
  onCompleteScheduleItem,
  onConnectCalendar,
  onSyncCalendar,
  copiedScheduleItem,
  onCopySchedule,
  onSelectDate,
}: {
  scheduleItems: RaahMinistryScheduleItem[];
  scheduleForm: RaahMinistryScheduleItemInput;
  setScheduleForm: React.Dispatch<React.SetStateAction<RaahMinistryScheduleItemInput>>;
  editingScheduleItemId: string | null;
  isScheduleFormOpen: boolean;
  onOpenNewSchedule: (dateIso?: string) => void;
  onCloseScheduleForm: () => void;
  onEdit: (item: RaahMinistryScheduleItem) => void;
  calendarStatus: RaahCalendarStatus | null;
  isSaving: boolean;
  onCreateScheduleItem: (event: React.FormEvent<HTMLFormElement>) => void;
  onCompleteScheduleItem: (itemId: string) => void;
  onConnectCalendar: () => void;
  onSyncCalendar: () => void;
  copiedScheduleItem: RaahMinistryScheduleItem | null;
  onCopySchedule: (item: RaahMinistryScheduleItem) => void;
  onSelectDate: (dateIso: string) => void;
}) {
  const todayIso = getTodayIso();
  const openItems = getOpenScheduleItems(scheduleItems);
  const overdueItems = openItems.filter((item) => item.date < todayIso);
  const upcomingItems = openItems.filter((item) => item.date >= todayIso);
  const doneItems = scheduleItems
    .filter((item) => item.status === 'done')
    .sort((a, b) => `${b.date} ${b.startsAt || ''}`.localeCompare(`${a.date} ${a.startsAt || ''}`));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-[#dbe3e8] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#607080]">Ministry Schedule</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#17202b]">사역 일정</h2>
          <p className="mt-1 text-sm text-[#607080]">심방, 상담, 회의, 준비할 일을 따로 모아 확인하고 등록합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!calendarStatus?.configured ? (
            <button type="button" disabled className={shell.ghostButton + ' shrink-0 opacity-60'} title="Google Calendar OAuth 환경 변수가 필요합니다.">
              <CalendarDays size={16} />
              Google 설정 필요
            </button>
          ) : calendarStatus.connected ? (
            <button type="button" onClick={onSyncCalendar} disabled={isSaving} className={shell.ghostButton + ' shrink-0'}>
              <CalendarDays size={16} />
              Google 동기화
            </button>
          ) : (
            <button type="button" onClick={onConnectCalendar} disabled={isSaving} className={shell.ghostButton + ' shrink-0'}>
              <CalendarDays size={16} />
              Google 연결
            </button>
          )}
          {copiedScheduleItem && <span className={shell.badge}>복사됨 · {copiedScheduleItem.title}</span>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MiniCount label="미완료" value={openItems.length} />
        <MiniCount label="지나간 일정" value={overdueItems.length} />
        <MiniCount label="완료" value={doneItems.length} />
      </div>

      <MinistrySchedulePanel
        items={scheduleItems}
        form={scheduleForm}
        setForm={setScheduleForm}
        editingItemId={editingScheduleItemId}
        isOpen={isScheduleFormOpen}
        onOpenNew={onOpenNewSchedule}
        onClose={onCloseScheduleForm}
        onEdit={onEdit}
        calendarStatus={calendarStatus}
        isSaving={isSaving}
        onSubmit={onCreateScheduleItem}
        onComplete={onCompleteScheduleItem}
        onConnectCalendar={onConnectCalendar}
        onSyncCalendar={onSyncCalendar}
        copiedItem={copiedScheduleItem}
        onCopyItem={onCopySchedule}
        onSelectDate={onSelectDate}
      />

      <ScheduleDetailList
        overdueItems={overdueItems}
        upcomingItems={upcomingItems}
        doneItems={doneItems}
        isSaving={isSaving}
        onEdit={onEdit}
        onCopy={onCopySchedule}
        onComplete={onCompleteScheduleItem}
      />
    </div>
  );
}

export function ScheduleDetailList({
  overdueItems,
  upcomingItems,
  doneItems,
  isSaving,
  onEdit,
  onCopy,
  onComplete,
}: {
  overdueItems: RaahMinistryScheduleItem[];
  upcomingItems: RaahMinistryScheduleItem[];
  doneItems: RaahMinistryScheduleItem[];
  isSaving: boolean;
  onEdit: (item: RaahMinistryScheduleItem) => void;
  onCopy: (item: RaahMinistryScheduleItem) => void;
  onComplete: (itemId: string) => void;
}) {
  return (
    <div className={shell.panel + ' p-5'}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">전체 일정 목록</h2>
          <p className="mt-1 text-sm text-[#607080]">달력에서 놓치기 쉬운 일정을 상태별로 다시 봅니다.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ScheduleListColumn title="지나간 미완료" items={overdueItems} empty="지나간 미완료 일정이 없습니다." isSaving={isSaving} onEdit={onEdit} onCopy={onCopy} onComplete={onComplete} />
        <ScheduleListColumn title="예정" items={upcomingItems} empty="예정된 일정이 없습니다." isSaving={isSaving} onEdit={onEdit} onCopy={onCopy} onComplete={onComplete} />
        <ScheduleListColumn title="완료" items={doneItems.slice(0, 8)} empty="완료된 일정이 없습니다." isSaving={isSaving} onEdit={onEdit} onCopy={onCopy} onComplete={onComplete} done />
      </div>
    </div>
  );
}

export function ScheduleListColumn({
  title,
  items,
  empty,
  isSaving,
  onEdit,
  onCopy,
  onComplete,
  done,
}: {
  title: string;
  items: RaahMinistryScheduleItem[];
  empty: string;
  isSaving: boolean;
  onEdit: (item: RaahMinistryScheduleItem) => void;
  onCopy: (item: RaahMinistryScheduleItem) => void;
  onComplete: (itemId: string) => void;
  done?: boolean;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-[#17202b]">{title}</p>
      <div className="mt-2 space-y-2">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#dbe3e8] bg-[#f8fafb] p-3 text-sm text-[#607080]">{empty}</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-lg border border-[#dbe3e8] bg-[#f8fafb] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#17202b]">{item.title}</p>
                  <p className="mt-1 text-xs text-[#607080]">
                    {formatScheduleDateRange(item)}
                    {item.startsAt ? ` · ${item.startsAt}` : ''}
                    {getScheduleMemberLabel(item) ? ` · ${getScheduleMemberLabel(item)}` : ''}
                  </p>
                </div>
                <span className={shell.badge}>{getScheduleTypeLabel(item.itemType)}</span>
              </div>
              {item.memo && <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#607080]">{item.memo}</p>}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => onEdit(item)} className={shell.ghostButton + ' min-h-9 px-2 text-xs'}>
                  수정
                </button>
                <button type="button" onClick={() => onCopy(item)} className={shell.ghostButton + ' min-h-9 px-2 text-xs'}>
                  복사
                </button>
                <button type="button" disabled={isSaving || done} onClick={() => onComplete(item.id)} className={shell.button + ' min-h-9 px-2 text-xs'}>
                  {done ? '완료됨' : '완료'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function MinistrySchedulePanel({
  items,
  form,
  setForm,
  editingItemId,
  isOpen,
  onOpenNew,
  onClose,
  onEdit,
  calendarStatus,
  isSaving,
  onSubmit,
  onComplete,
  onConnectCalendar,
  onSyncCalendar,
  copiedItem,
  onCopyItem,
  onSelectDate,
}: {
  items: RaahMinistryScheduleItem[];
  form: RaahMinistryScheduleItemInput;
  setForm: React.Dispatch<React.SetStateAction<RaahMinistryScheduleItemInput>>;
  editingItemId: string | null;
  isOpen: boolean;
  onOpenNew: (dateIso?: string) => void;
  onClose: () => void;
  onEdit: (item: RaahMinistryScheduleItem) => void;
  calendarStatus: RaahCalendarStatus | null;
  isSaving: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onComplete: (itemId: string) => void;
  onConnectCalendar: () => void;
  onSyncCalendar: () => void;
  copiedItem?: RaahMinistryScheduleItem | null;
  onCopyItem?: (item: RaahMinistryScheduleItem) => void;
  onSelectDate?: (dateIso: string) => void;
}) {
  const [viewMode, setViewMode] = React.useState<ScheduleViewMode>('week');
  const todayIso = getTodayIso();
  const [anchorDate, setAnchorDate] = React.useState(todayIso);
  const weekDays = getWeekCalendarDays(anchorDate, items, todayIso);
  const monthDays = getMonthCalendarDays(anchorDate, items, todayIso);
  const weekRange = `${formatDisplayDate(weekDays[0]?.dateIso || todayIso)} - ${formatDisplayDate(weekDays[6]?.dateIso || todayIso)}`;
  const monthRange = getMonthRangeLabel(anchorDate);
  const hasOpenItems = items.some((item) => item.status === 'open');
  const [selectedFormDate, setSelectedFormDate] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!isOpen || !editingItemId || !form.date) return;
    setSelectedFormDate(form.date);
    setAnchorDate(form.date);
  }, [editingItemId, form.date, isOpen]);
  const shiftCalendar = (direction: -1 | 1) => {
    setAnchorDate((current) => (viewMode === 'week' ? addDaysIso(current, direction * 7) : addMonthsIso(current, direction)));
  };
  const resetCalendar = () => setAnchorDate(todayIso);
  const openFormForDate = (dateIso: string) => {
    setSelectedFormDate(dateIso);
    onSelectDate?.(dateIso);
  };
  const openFormForEdit = (item: RaahMinistryScheduleItem) => {
    setSelectedFormDate(item.date);
    onEdit(item);
  };
  const openHeaderForm = () => {
    if (isOpen) {
      setSelectedFormDate(null);
      onClose();
      return;
    }
    setSelectedFormDate(anchorDate);
    onOpenNew(anchorDate);
  };
  const calendarControls = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-[#d5dee5] bg-white p-1">
        {(['week', 'month'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={`min-h-9 rounded-md px-3 text-xs font-semibold transition ${
              viewMode === mode ? 'bg-[#12345a] text-white shadow-sm' : 'text-[#607080] hover:bg-[#f1f5f8] hover:text-[#17202b]'
            }`}
          >
            {mode === 'week' ? '주간' : '월간'}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-[#d5dee5] bg-white p-1">
        <button type="button" onClick={() => shiftCalendar(-1)} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#28415b] transition hover:bg-[#eef7f3]" aria-label={viewMode === 'week' ? '이전 주' : '이전 달'}>
          <ChevronLeft size={16} />
        </button>
        <button type="button" onClick={resetCalendar} className="min-h-9 rounded-md px-2 text-xs font-semibold text-[#607080] transition hover:bg-[#f1f5f8] hover:text-[#17202b]">
          오늘
        </button>
        <button type="button" onClick={() => shiftCalendar(1)} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#28415b] transition hover:bg-[#eef7f3]" aria-label={viewMode === 'week' ? '다음 주' : '다음 달'}>
          <ChevronRight size={16} />
        </button>
      </div>
      <button type="button" onClick={openHeaderForm} className={isOpen ? shell.button : shell.ghostButton}>
        <Plus size={16} />
        {isOpen ? '닫기' : '일정'}
      </button>
    </div>
  );
  return (
    <div className={shell.panel + ' p-5'}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">사역 일정판</h2>
          <p className="mt-1 text-sm text-[#607080]">날짜를 누르면 그 날짜로 일정을 등록합니다.</p>
        </div>
        <div className="w-full rounded-lg border border-[#dbe3e8] bg-[#f8fafb] p-3 sm:w-auto sm:min-w-[320px] sm:max-w-[520px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={shell.badge + ' text-[11px]'}>
                  <CalendarDays size={12} />
                  Google Calendar
                </span>
                {calendarStatus?.connected && <span className="text-[11px] font-semibold text-[#2e6b5f]">연결됨</span>}
              </div>
              <p className="mt-1 truncate text-xs leading-5 text-[#607080]">
                {!calendarStatus?.configured
                  ? 'OAuth 환경 변수를 설정하면 RAAH 전용 캘린더를 연결할 수 있습니다.'
                  : calendarStatus.connected
                    ? `${getCalendarDisplayName(calendarStatus)}에서 오늘/이번 주 사역 일정을 읽어옵니다.`
                    : '심방 일정과 사역 할 일을 Google Calendar에서 함께 관리할 수 있습니다.'}
              </p>
            </div>
            {!calendarStatus?.configured ? (
              <button type="button" disabled className={shell.ghostButton + ' shrink-0 px-3 py-1.5 text-xs opacity-60'} title="Google Calendar OAuth 환경 변수가 필요합니다.">
                설정 필요
              </button>
            ) : calendarStatus.connected ? (
              <button type="button" onClick={onSyncCalendar} disabled={isSaving} className={shell.ghostButton + ' shrink-0 px-3 py-1.5 text-xs'}>
                동기화
              </button>
            ) : (
              <button type="button" onClick={onConnectCalendar} disabled={isSaving} className={shell.button + ' shrink-0 px-3 py-1.5 text-xs'}>
                연결
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        {viewMode === 'week' ? (
          <WeekScheduleGrid
            days={weekDays}
            rangeLabel={weekRange}
            controls={calendarControls}
            form={form}
            setForm={setForm}
            formDate={isOpen ? selectedFormDate : null}
            editingItemId={editingItemId}
            isSaving={isSaving}
            copiedItem={copiedItem}
            onDateSelect={openFormForDate}
            onCloseForm={() => {
              setSelectedFormDate(null);
              onClose();
            }}
            onSubmit={onSubmit}
            onCopy={onCopyItem}
            onComplete={onComplete}
            onEdit={openFormForEdit}
          />
        ) : (
          <MonthScheduleGrid
            days={monthDays}
            rangeLabel={monthRange}
            controls={calendarControls}
            form={form}
            setForm={setForm}
            formDate={isOpen ? selectedFormDate : null}
            editingItemId={editingItemId}
            isSaving={isSaving}
            copiedItem={copiedItem}
            onDateSelect={openFormForDate}
            onCloseForm={() => {
              setSelectedFormDate(null);
              onClose();
            }}
            onSubmit={onSubmit}
            onCopy={onCopyItem}
            onComplete={onComplete}
            onEdit={openFormForEdit}
          />
        )}
      </div>
      {!hasOpenItems && <EmptyState>등록된 사역 일정이 없습니다.</EmptyState>}
    </div>
  );
}

export function SchedulePopupForm({
  form,
  setForm,
  editingItemId,
  isSaving,
  onSubmit,
  onClose,
}: {
  form: RaahMinistryScheduleItemInput;
  setForm: React.Dispatch<React.SetStateAction<RaahMinistryScheduleItemInput>>;
  editingItemId: string | null;
  isSaving: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <form
      data-schedule-popup="true"
      onSubmit={onSubmit}
      className="fixed left-1/2 top-[max(6rem,12vh)] z-[80] max-h-[78vh] w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto rounded-2xl border border-[#cbd8df] bg-white p-4 text-left shadow-[0_22px_58px_rgba(21,38,57,0.22)]"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#607080]">{form.date}</p>
          <h4 className="mt-0.5 text-sm font-semibold text-[#17202b]">{editingItemId ? '일정 수정' : '일정 등록'}</h4>
        </div>
        <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-xs font-semibold text-[#607080] transition hover:bg-[#f1f5f8] hover:text-[#17202b]">
          닫기
        </button>
      </div>
      <div className="grid gap-2">
        <TextInput label="제목" value={form.title} onChange={(value) => setForm((prev) => ({ ...prev, title: value }))} placeholder="심방, 연락, 설교 준비" />
        <div className="grid grid-cols-[minmax(0,1fr),112px] gap-2">
          <TextInput label="날짜" type="date" value={form.date} onChange={(value) => setForm((prev) => ({ ...prev, date: value }))} />
          <TextInput label="시간" type="time" value={form.startsAt || ''} onChange={(value) => setForm((prev) => ({ ...prev, startsAt: value }))} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <TextInput label="종료일" type="date" value={form.endDate || form.date} onChange={(value) => setForm((prev) => ({ ...prev, endDate: value || prev.date }))} />
          <TextInput label="종료 시간" type="time" value={form.endsAt || ''} onChange={(value) => setForm((prev) => ({ ...prev, endsAt: value }))} />
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#607080]">유형</span>
          <select value={form.itemType} onChange={(event) => setForm((prev) => ({ ...prev, itemType: event.target.value as RaahMinistryScheduleItemInput['itemType'] }))} className={shell.input}>
            {SCHEDULE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <TextInput label="메모" value={form.memo || ''} onChange={(value) => setForm((prev) => ({ ...prev, memo: value }))} placeholder="장소나 준비물" />
        <button type="submit" disabled={isSaving} className={shell.button + ' mt-1 w-full'}>
          {editingItemId ? '수정 저장' : '일정 저장'}
        </button>
      </div>
    </form>
  );
}

export function WeekScheduleGrid({
  days,
  rangeLabel,
  controls,
  form,
  setForm,
  formDate,
  editingItemId,
  isSaving,
  copiedItem,
  onDateSelect,
  onCloseForm,
  onSubmit,
  onCopy,
  onComplete,
  onEdit,
}: {
  days: ReturnType<typeof getWeekCalendarDays>;
  rangeLabel: string;
  controls: React.ReactNode;
  form: RaahMinistryScheduleItemInput;
  setForm: React.Dispatch<React.SetStateAction<RaahMinistryScheduleItemInput>>;
  formDate: string | null;
  editingItemId: string | null;
  isSaving: boolean;
  copiedItem?: RaahMinistryScheduleItem | null;
  onDateSelect?: (dateIso: string) => void;
  onCloseForm: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCopy?: (item: RaahMinistryScheduleItem) => void;
  onComplete: (itemId: string) => void;
  onEdit: (item: RaahMinistryScheduleItem) => void;
}) {
  return (
    <div className="mt-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#607080]">Weekly Care Calendar</p>
          <h3 className="mt-1 text-base font-semibold text-[#17202b]">이번 주 사역 일정</h3>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <p className="text-xl font-semibold tracking-tight text-[#17202b] sm:text-2xl">{rangeLabel}</p>
          {controls}
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-7">
        {days.map((day) => (
          <div
            key={day.dateIso}
            className={`relative min-h-[150px] overflow-visible rounded-xl border p-3 transition ${
              day.isToday ? 'border-[#2e6b5f] bg-[#eef7f3] shadow-[inset_0_0_0_1px_rgba(46,107,95,0.16)]' : 'border-[#dbe3e8] bg-[#f8fafb]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => onDateSelect?.(day.dateIso)} className="rounded-md px-1 text-left transition hover:bg-white/70" title={copiedItem ? `${copiedItem.title} 붙여넣기` : '이 날짜에 일정 등록'}>
                <p className={`text-sm font-semibold ${day.isToday ? 'text-[#245b51]' : 'text-[#17202b]'}`}>{day.label}</p>
                <p className="mt-0.5 text-xs text-[#607080]">{day.dateIso.slice(5).replace('-', '.')}</p>
              </button>
              {day.isToday && <span className="rounded-full bg-[#2e6b5f] px-2 py-0.5 text-[11px] font-semibold text-white">오늘</span>}
            </div>
            {copiedItem && onDateSelect && (
              <button type="button" onClick={() => onDateSelect(day.dateIso)} className="mt-2 w-full rounded-md border border-dashed border-[#8bcfb9] bg-white/70 px-2 py-1 text-[11px] font-semibold text-[#2e6b5f]">
                복사한 일정 붙여넣기
              </button>
            )}
            {formDate === day.dateIso && (
              <SchedulePopupForm
                form={form}
                setForm={setForm}
                editingItemId={editingItemId}
                isSaving={isSaving}
                onSubmit={onSubmit}
                onClose={onCloseForm}
              />
            )}
            <div className="mt-3 space-y-2">
              {day.items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#ccd7df] bg-white/70 px-2 py-2 text-xs text-[#7a8b9a]">일정 없음</p>
              ) : (
                day.items.map((item) => (
                  <div key={item.id} className="group relative rounded-lg border border-[#dbe3e8] bg-white p-2 shadow-[0_4px_14px_rgba(21,38,57,0.04)]">
                    <div>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-xs font-semibold leading-4 text-[#17202b]">{item.title}</p>
                        <p className="mt-1 text-[11px] leading-4 text-[#607080]">
                          {item.startsAt || '시간 미정'}
                          {getScheduleMemberLabel(item) ? ` · ${getScheduleMemberLabel(item)}` : ''}
                        </p>
                      </div>
                      <div className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-white/95 p-0.5 opacity-35 shadow-sm transition group-hover:opacity-100 group-focus-within:opacity-100">
                      {onCopy && (
                        <button type="button" disabled={isSaving} onClick={() => onCopy(item)} title="복사" aria-label={`${item.title} 복사`} className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#d5dee5] text-[0px] text-[#2e6b5f] transition hover:bg-[#eef7f3] disabled:opacity-50">
                          <Copy size={11} strokeWidth={2.4} />
                          복사
                        </button>
                      )}
                      <button type="button" disabled={isSaving} onClick={() => onEdit(item)} title="수정" aria-label={`${item.title} 수정`} className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#d5dee5] text-[0px] text-[#2e6b5f] transition hover:bg-[#eef7f3] disabled:opacity-50">
                        <FileText size={11} strokeWidth={2.4} />
                        수정
                      </button>
                      <button type="button" disabled={isSaving} onClick={() => onComplete(item.id)} title="완료" aria-label={`${item.title} 완료`} className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#d5dee5] text-[0px] text-[#2e6b5f] transition hover:bg-[#eef7f3] disabled:opacity-50">
                        <CheckSquare size={11} strokeWidth={2.4} />
                        완료
                      </button>
                      </div>
                    </div>
                    {item.memo && <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#607080]">{item.memo}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonthScheduleGrid({
  days,
  rangeLabel,
  controls,
  form,
  setForm,
  formDate,
  editingItemId,
  isSaving,
  copiedItem,
  onDateSelect,
  onCloseForm,
  onSubmit,
  onCopy,
  onComplete,
  onEdit,
}: {
  days: ReturnType<typeof getMonthCalendarDays>;
  rangeLabel: string;
  controls: React.ReactNode;
  form: RaahMinistryScheduleItemInput;
  setForm: React.Dispatch<React.SetStateAction<RaahMinistryScheduleItemInput>>;
  formDate: string | null;
  editingItemId: string | null;
  isSaving: boolean;
  copiedItem?: RaahMinistryScheduleItem | null;
  onDateSelect?: (dateIso: string) => void;
  onCloseForm: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCopy?: (item: RaahMinistryScheduleItem) => void;
  onComplete: (itemId: string) => void;
  onEdit: (item: RaahMinistryScheduleItem) => void;
}) {
  return (
    <div className="mt-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#607080]">Monthly Care Calendar</p>
          <h3 className="mt-1 text-base font-semibold text-[#17202b]">이번 달 사역 일정</h3>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <p className="text-xl font-semibold tracking-tight text-[#17202b] sm:text-2xl">{rangeLabel}</p>
          {controls}
        </div>
      </div>
      <div className="mt-3 overflow-x-auto pb-1">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 gap-2">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="rounded-lg bg-[#edf2f5] px-3 py-2 text-center text-xs font-semibold text-[#607080]">
                {label}
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {days.map((day) => (
              <div
                key={day.dateIso}
                className={`relative min-h-[128px] overflow-visible rounded-xl border p-2 transition ${
                  day.isToday
                    ? 'border-[#2e6b5f] bg-[#eef7f3] shadow-[inset_0_0_0_1px_rgba(46,107,95,0.16)]'
                    : day.isCurrentMonth
                      ? 'border-[#dbe3e8] bg-[#f8fafb]'
                      : 'border-[#e3e9ee] bg-[#f5f7f9] opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => onDateSelect?.(day.dateIso)} className={`rounded-md px-1 py-0.5 text-xs font-semibold transition hover:bg-white/70 ${day.isToday ? 'text-[#245b51]' : 'text-[#17202b]'}`} title={copiedItem ? `${copiedItem.title} 붙여넣기` : '이 날짜에 일정 등록'}>
                    {Number(day.dateIso.slice(8, 10))}
                  </button>
                  {day.isToday && <span className="rounded-full bg-[#2e6b5f] px-1.5 py-0.5 text-[10px] font-semibold text-white">오늘</span>}
                </div>
                {copiedItem && onDateSelect && (
                  <button type="button" onClick={() => onDateSelect(day.dateIso)} className="mt-1 w-full rounded-md border border-dashed border-[#8bcfb9] bg-white/70 px-1.5 py-1 text-[10px] font-semibold text-[#2e6b5f]">
                    붙여넣기
                  </button>
                )}
                {formDate === day.dateIso && (
                  <SchedulePopupForm
                    form={form}
                    setForm={setForm}
                    editingItemId={editingItemId}
                    isSaving={isSaving}
                    onSubmit={onSubmit}
                    onClose={onCloseForm}
                  />
                )}
                <div className="mt-2 space-y-1.5">
                  {day.items.slice(0, 3).map((item) => (
                    <div key={item.id} className="group relative rounded-lg border border-[#dbe3e8] bg-white p-2 shadow-[0_4px_12px_rgba(21,38,57,0.04)]">
                      <div>
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-[11px] font-semibold leading-4 text-[#17202b]">{item.title}</p>
                          <p className="mt-0.5 truncate text-[10px] leading-4 text-[#607080]">
                            {item.startsAt || '시간 미정'}
                            {getScheduleMemberLabel(item) ? ` · ${getScheduleMemberLabel(item)}` : ''}
                          </p>
                        </div>
                        <div className="absolute right-1 top-1 flex items-center gap-0.5 rounded-full bg-white/95 p-0.5 opacity-30 shadow-sm transition group-hover:opacity-100 group-focus-within:opacity-100">
                        {onCopy && (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => onCopy(item)}
                            title="복사"
                            aria-label={`${item.title} 복사`}
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#d5dee5] text-[0px] text-[#2e6b5f] transition hover:bg-[#eef7f3] disabled:opacity-50"
                          >
                            <Copy size={9} strokeWidth={2.4} />
                            복사
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => onEdit(item)}
                          title="수정"
                          aria-label={`${item.title} 수정`}
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#d5dee5] text-[0px] text-[#2e6b5f] transition hover:bg-[#eef7f3] disabled:opacity-50"
                        >
                          <FileText size={9} strokeWidth={2.4} />
                          수정
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => onComplete(item.id)}
                          title="완료"
                          aria-label={`${item.title} 완료`}
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#d5dee5] text-[0px] text-[#2e6b5f] transition hover:bg-[#eef7f3] disabled:opacity-50"
                        >
                          <CheckSquare size={9} strokeWidth={2.4} />
                          완료
                        </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {day.items.length > 3 && <p className="px-1 text-[10px] font-semibold text-[#607080]">+{day.items.length - 3}개 더</p>}
                  {day.items.length === 0 && day.isCurrentMonth && <p className="rounded-lg border border-dashed border-[#ccd7df] bg-white/70 px-2 py-2 text-[11px] text-[#7a8b9a]">일정 없음</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScheduleColumn({ title, items, isSaving, onComplete }: { title: string; items: RaahMinistryScheduleItem[]; isSaving: boolean; onComplete: (itemId: string) => void }) {
  return (
    <div>
      <p className="text-sm font-semibold text-[#17202b]">{title}</p>
      <div className="mt-2 space-y-2">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#dbe3e8] bg-[#f8fafb] p-3 text-sm text-[#607080]">일정 없음</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="grid grid-cols-[minmax(0,1fr),72px] gap-2 rounded-lg border border-[#dbe3e8] bg-[#f8fafb] p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-xs text-[#607080]">
                  {formatScheduleDateRange(item)}
                  {item.startsAt ? ` · ${item.startsAt}` : ''}
                  {getScheduleMemberLabel(item) ? ` · ${getScheduleMemberLabel(item)}` : ''}
                </p>
                {item.memo && <p className="mt-1 line-clamp-2 text-xs text-[#607080]">{item.memo}</p>}
              </div>
              <button type="button" disabled={isSaving} onClick={() => onComplete(item.id)} className={shell.ghostButton + ' px-2 py-1 text-xs'}>
                완료
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
