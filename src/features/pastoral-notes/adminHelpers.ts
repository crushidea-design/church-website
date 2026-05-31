// Pure helpers and constants extracted from AdminPastoralNotes.tsx.
// Keep this file free of React or component state so it stays
// trivially testable and re-usable.
import { formatDisplayDate } from './utils';
import {
  RaahAttendanceEventType,
  RaahCalendarStatus,
  RaahDashboardSummary,
  RaahGoogleCalendarEventInput,
  RaahMember,
  RaahMemberInput,
  RaahMinistryScheduleItem,
  RaahMinistryScheduleItemInput,
  RaahVisitationLogInput,
} from './managementApi';

// ───── Schedule type constants ─────────────────────────────────────
export const SCHEDULE_TYPES: Array<{ value: RaahMinistryScheduleItemInput['itemType']; label: string }> = [
  { value: 'visitation', label: '심방' },
  { value: 'counseling', label: '상담' },
  { value: 'task', label: '할 일' },
  { value: 'meeting', label: '회의' },
  { value: 'other', label: '기타' },
];

export function getScheduleTypeLabel(value: RaahMinistryScheduleItemInput['itemType']) {
  return SCHEDULE_TYPES.find((type) => type.value === value)?.label || '기타';
}

export function getScheduleMemberLabel(item: Pick<RaahMinistryScheduleItem, 'itemType' | 'memberName'>) {
  if (item.itemType !== 'visitation' && item.itemType !== 'counseling') return '';
  return item.memberName || '';
}

// ───── Visitation log constants ────────────────────────────────────
export const LOG_TYPES = ['심방', '상담', '기도', '전화', '양육', '기타'];

// ───── Attendance constants ────────────────────────────────────────
export const ATTENDANCE_EVENT_OPTIONS: Array<{
  type: RaahAttendanceEventType;
  label: string;
  serviceType: string;
  includesCommunion: boolean;
}> = [
  { type: 'sunday_morning', label: '주일 오전', serviceType: '주일 오전예배', includesCommunion: true },
  { type: 'sunday_afternoon', label: '주일 오후', serviceType: '주일 오후예배', includesCommunion: false },
  { type: 'young_adults', label: '청년부', serviceType: '청년부 모임', includesCommunion: false },
  { type: 'wednesday_prayer', label: '수요', serviceType: '수요기도회', includesCommunion: false },
  { type: 'other', label: '기타', serviceType: '기타 모임', includesCommunion: false },
];

export function getAttendanceOption(type: RaahAttendanceEventType) {
  return ATTENDANCE_EVENT_OPTIONS.find((option) => option.type === type) || ATTENDANCE_EVENT_OPTIONS[0];
}

// ───── Date helpers (KST-anchored) ─────────────────────────────────
export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const WEEKDAY_LABELS = ['주일', '월', '화', '수', '목', '금', '토'];

export function getKoreanDateIso(date = new Date()) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function getLatestSunday() {
  const todayKst = new Date(Date.now() + KST_OFFSET_MS);
  const sundayKst = new Date(
    Date.UTC(todayKst.getUTCFullYear(), todayKst.getUTCMonth(), todayKst.getUTCDate() - todayKst.getUTCDay())
  );
  return sundayKst.toISOString().slice(0, 10);
}

export function getTodayIso() {
  return getKoreanDateIso();
}

export function parseIsoDateParts(dateIso: string) {
  const [year, month, day] = dateIso.split('-').map(Number);
  return { year, month, day };
}

export function addDaysIso(dateIso: string, days: number) {
  const { year, month, day } = parseIsoDateParts(dateIso);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function getDateSpanDays(startIso: string, endIso?: string) {
  if (!endIso || endIso < startIso) return 0;
  const start = parseIsoDateParts(startIso);
  const end = parseIsoDateParts(endIso);
  return Math.round(
    (Date.UTC(end.year, end.month - 1, end.day) - Date.UTC(start.year, start.month - 1, start.day)) / 86400000
  );
}

export function addMonthsIso(dateIso: string, monthsToAdd: number) {
  const { year, month } = parseIsoDateParts(dateIso);
  const date = new Date(Date.UTC(year, month - 1 + monthsToAdd, 1));
  return date.toISOString().slice(0, 10);
}

export function getWeekStartIso(dateIso: string) {
  const { year, month, day } = parseIsoDateParts(dateIso);
  const date = new Date(Date.UTC(year, month - 1, day));
  return addDaysIso(dateIso, -date.getUTCDay());
}

export function getMonthStartIso(dateIso: string) {
  const { year, month } = parseIsoDateParts(dateIso);
  return new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
}

export function getMonthRangeLabel(dateIso: string) {
  const { year, month } = parseIsoDateParts(dateIso);
  return `${year}.${String(month).padStart(2, '0')}`;
}

export function getDateForAttendanceEventType(dateIso: string, eventType: RaahAttendanceEventType) {
  const weekStart = getWeekStartIso(dateIso);
  if (eventType === 'wednesday_prayer') return addDaysIso(weekStart, 3);
  if (eventType === 'other') return dateIso;
  return weekStart;
}

// ───── Schedule item helpers ───────────────────────────────────────
export function isScheduleItemOnDate(item: RaahMinistryScheduleItem, dateIso: string) {
  const endDate = item.endDate || item.date;
  return item.date <= dateIso && dateIso <= endDate;
}

export function formatScheduleDateRange(item: Pick<RaahMinistryScheduleItem, 'date' | 'endDate'>) {
  if (!item.endDate || item.endDate === item.date) return formatDisplayDate(item.date);
  return `${formatDisplayDate(item.date)} - ${formatDisplayDate(item.endDate)}`;
}

export function getOpenScheduleItems(items: RaahMinistryScheduleItem[]) {
  return items
    .filter((item) => item.status === 'open')
    .sort((a, b) => `${a.date} ${a.startsAt || ''}`.localeCompare(`${b.date} ${b.startsAt || ''}`));
}

export function getWeekCalendarDays(
  anchorIso: string,
  items: RaahMinistryScheduleItem[],
  todayIso = getTodayIso()
) {
  const weekStart = getWeekStartIso(anchorIso);
  const openItems = getOpenScheduleItems(items);
  return WEEKDAY_LABELS.map((label, index) => {
    const dateIso = addDaysIso(weekStart, index);
    return {
      dateIso,
      label,
      items: openItems.filter((item) => isScheduleItemOnDate(item, dateIso)),
      isToday: dateIso === todayIso,
    };
  });
}

export function getMonthCalendarDays(
  anchorIso: string,
  items: RaahMinistryScheduleItem[],
  todayIso = getTodayIso()
) {
  const monthStart = getMonthStartIso(anchorIso);
  const gridStart = getWeekStartIso(monthStart);
  const { year: currentYear, month: currentMonth } = parseIsoDateParts(anchorIso);
  const openItems = getOpenScheduleItems(items);

  return Array.from({ length: 42 }, (_, index) => {
    const dateIso = addDaysIso(gridStart, index);
    const { year, month } = parseIsoDateParts(dateIso);
    return {
      dateIso,
      label: WEEKDAY_LABELS[index % 7],
      items: openItems.filter((item) => isScheduleItemOnDate(item, dateIso)),
      isToday: dateIso === todayIso,
      isCurrentMonth: year === currentYear && month === currentMonth,
    };
  });
}

// ───── Default form factories ──────────────────────────────────────
export const emptyScheduleForm = (): RaahMinistryScheduleItemInput => ({
  title: '',
  date: getTodayIso(),
  endDate: getTodayIso(),
  startsAt: '',
  endsAt: '',
  itemType: 'task',
  memberId: '',
  memberName: '',
  memo: '',
});

export const emptyCalendarEventForm = (): RaahGoogleCalendarEventInput => ({
  title: '',
  date: getTodayIso(),
  startsAt: '14:00',
  endsAt: '15:00',
  memberId: '',
  memberName: '',
  memo: '',
  sourceLogId: '',
});

export const emptyLogForm = (member?: RaahMember): RaahVisitationLogInput => ({
  memberId: member?.id || '',
  memberName: member?.name || '',
  date: new Date().toISOString().slice(0, 10),
  logType: LOG_TYPES[0],
  publicSummary: '',
  innerNote: '',
  prayerTopics: '',
  nextSteps: '',
  privateRemarks: '',
});

export const emptyMemberForm: RaahMemberInput = {
  name: '',
  birthDate: '',
  phone: '',
  address: '',
  position: '',
  district: '',
  registeredAt: new Date().toISOString().slice(0, 10),
  status: 'active',
  publicNote: '',
};

export const emptySummary: RaahDashboardSummary = {
  memberCount: 0,
  activeMemberCount: 0,
  logCount: 0,
  encryptedLogCount: 0,
  thisWeekLogCount: 0,
  thisWeekAttendanceCount: 0,
  thisWeekCommunionCount: 0,
};

// ───── Misc ────────────────────────────────────────────────────────
export function getCalendarDisplayName(status: RaahCalendarStatus | null) {
  const summary = status?.calendarSummary?.trim();
  if (summary && !summary.includes('@group.calendar.google.com')) {
    return summary;
  }
  return '라아 캘린더';
}

export function getDashboardSeason() {
  const today = new Date();
  const day = today.getDay();
  if (day <= 2) return 'attendance' as const;
  if (day <= 5) return 'follow-up' as const;
  return 'prepare' as const;
}

export function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object') return fallback;
  const typed = error as { message?: string; code?: string };
  return typed.message || typed.code || fallback;
}

export function isRaahSubdomain() {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'raah.builttogether.church';
}
