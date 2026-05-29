import React from 'react';
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  ClipboardList,
  Copy,
  FileText,
  Lock,
  LogIn,
  LogOut,
  Plus,
  Search,
  Sparkles,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { generateRaahVisitationDraft } from '../features/pastoral-notes/aiApi';
import { createRaahNote, getRaahNoteDetail, listRaahNotes, updateRaahNote } from '../features/pastoral-notes/api';
import {
  completeRaahMinistryScheduleItem,
  createRaahGoogleCalendarEvent,
  createRaahMember,
  createRaahMinistryScheduleItem,
  createRaahVisitationLog,
  getRaahBootstrap,
  getRaahCalendarAuthUrl,
  getRaahCalendarStatus,
  getRaahVisitationLogDetail,
  RaahAttendanceEvent,
  RaahAttendanceEventType,
  RaahFollowUpResolution,
  RaahAttendanceHistoryRecord,
  RaahAttendanceInput,
  RaahAttendanceRecord,
  RaahCalendarStatus,
  RaahDashboardSummary,
  RaahGoogleCalendarEventInput,
  RaahMember,
  RaahMemberInput,
  RaahMinistryScheduleItem,
  RaahMinistryScheduleItemInput,
  RaahVisitationLog,
  RaahVisitationLogInput,
  resolveRaahFollowUp,
  saveRaahAttendance,
  syncRaahGoogleCalendar,
  updateRaahMember,
  updateRaahMinistryScheduleItem,
  updateRaahVisitationLog,
} from '../features/pastoral-notes/managementApi';
import { buildAttendanceRecordsForEvent, filterResolvedFollowUps, selectAttendanceEvent } from '../features/pastoral-notes/raahWorkflow';
import { buildRaahAttendanceFlow, RaahAttendanceFlowCell, RaahAttendanceFlowEvent } from '../features/pastoral-notes/attendanceFlow';
import { createPastoralNote, subscribePastoralNotes } from '../features/pastoral-notes/firestore';
import { PASTORAL_MEETING_TYPES, PastoralNote, PastoralNoteInput } from '../features/pastoral-notes/types';
import { createEmptyPastoralNoteInput, formatDisplayDate, normalizeMemberName, sortNotesByDate } from '../features/pastoral-notes/utils';
import { useAuth } from '../lib/auth';
import { logout, signInWithGoogle } from '../lib/firebase';

type StorageMode = 'loading' | 'supabase' | 'firestore';
type ActiveTab = 'dashboard' | 'members' | 'attendance' | 'schedule' | 'visitation' | 'legacy';
type ScheduleViewMode = 'week' | 'month';

const LOG_TYPES = ['심방', '상담', '기도', '전화', '양육', '기타'];
const ATTENDANCE_EVENT_OPTIONS: Array<{ type: RaahAttendanceEventType; label: string; serviceType: string; includesCommunion: boolean }> = [
  { type: 'sunday_morning', label: '주일 오전', serviceType: '주일 오전예배', includesCommunion: true },
  { type: 'sunday_afternoon', label: '주일 오후', serviceType: '주일 오후예배', includesCommunion: false },
  { type: 'young_adults', label: '청년부', serviceType: '청년부 모임', includesCommunion: false },
  { type: 'wednesday_prayer', label: '수요', serviceType: '수요기도회', includesCommunion: false },
  { type: 'other', label: '기타', serviceType: '기타 모임', includesCommunion: false },
];

const SCHEDULE_TYPES: Array<{ value: RaahMinistryScheduleItemInput['itemType']; label: string }> = [
  { value: 'visitation', label: '심방' },
  { value: 'counseling', label: '상담' },
  { value: 'task', label: '할 일' },
  { value: 'meeting', label: '회의' },
  { value: 'other', label: '기타' },
];

function getScheduleTypeLabel(value: RaahMinistryScheduleItemInput['itemType']) {
  return SCHEDULE_TYPES.find((type) => type.value === value)?.label || '기타';
}

function getScheduleMemberLabel(item: Pick<RaahMinistryScheduleItem, 'itemType' | 'memberName'>) {
  if (item.itemType !== 'visitation' && item.itemType !== 'counseling') return '';
  return item.memberName || '';
}

const TEXT = {
  tabs: {
    dashboard: '홈',
    members: '성도',
    attendance: '출석',
    schedule: '사역일정',
    visitation: '기록',
    legacy: '이전',
  },
  search: {
    dashboard: '성도, 기록, 구역 검색',
    members: '이름, 구역, 직분, 연락처 검색',
    attendance: '출석 체크할 성도 검색',
    schedule: '일정 제목, 성도, 메모 검색',
    visitation: '성도, 기록 유형, 요약 검색',
    legacy: '기존 기록 성도 검색',
  },
};

const emptySummary: RaahDashboardSummary = {
  memberCount: 0,
  activeMemberCount: 0,
  logCount: 0,
  encryptedLogCount: 0,
  thisWeekLogCount: 0,
  thisWeekAttendanceCount: 0,
  thisWeekCommunionCount: 0,
};

const emptyMemberForm: RaahMemberInput = {
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

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getKoreanDateIso(date = new Date()) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function getLatestSunday() {
  const todayKst = new Date(Date.now() + KST_OFFSET_MS);
  const sundayKst = new Date(Date.UTC(todayKst.getUTCFullYear(), todayKst.getUTCMonth(), todayKst.getUTCDate() - todayKst.getUTCDay()));
  return sundayKst.toISOString().slice(0, 10);
}

function getTodayIso() {
  return getKoreanDateIso();
}

function getCalendarDisplayName(status: RaahCalendarStatus | null) {
  const summary = status?.calendarSummary?.trim();
  if (summary && !summary.includes('@group.calendar.google.com')) {
    return summary;
  }
  return '라아 캘린더';
}

const WEEKDAY_LABELS = ['주일', '월', '화', '수', '목', '금', '토'];

function parseIsoDateParts(dateIso: string) {
  const [year, month, day] = dateIso.split('-').map(Number);
  return { year, month, day };
}

function addDaysIso(dateIso: string, days: number) {
  const { year, month, day } = parseIsoDateParts(dateIso);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function getDateSpanDays(startIso: string, endIso?: string) {
  if (!endIso || endIso < startIso) return 0;
  const start = parseIsoDateParts(startIso);
  const end = parseIsoDateParts(endIso);
  return Math.round((Date.UTC(end.year, end.month - 1, end.day) - Date.UTC(start.year, start.month - 1, start.day)) / 86400000);
}

function addMonthsIso(dateIso: string, monthsToAdd: number) {
  const { year, month } = parseIsoDateParts(dateIso);
  const date = new Date(Date.UTC(year, month - 1 + monthsToAdd, 1));
  return date.toISOString().slice(0, 10);
}

function getWeekStartIso(dateIso: string) {
  const { year, month, day } = parseIsoDateParts(dateIso);
  const date = new Date(Date.UTC(year, month - 1, day));
  return addDaysIso(dateIso, -date.getUTCDay());
}

function getWeekCalendarDays(anchorIso: string, items: RaahMinistryScheduleItem[], todayIso = getTodayIso()) {
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

function getMonthStartIso(dateIso: string) {
  const { year, month } = parseIsoDateParts(dateIso);
  return new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
}

function getMonthCalendarDays(anchorIso: string, items: RaahMinistryScheduleItem[], todayIso = getTodayIso()) {
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

function isScheduleItemOnDate(item: RaahMinistryScheduleItem, dateIso: string) {
  const endDate = item.endDate || item.date;
  return item.date <= dateIso && dateIso <= endDate;
}

function formatScheduleDateRange(item: Pick<RaahMinistryScheduleItem, 'date' | 'endDate'>) {
  if (!item.endDate || item.endDate === item.date) return formatDisplayDate(item.date);
  return `${formatDisplayDate(item.date)} - ${formatDisplayDate(item.endDate)}`;
}

function getMonthRangeLabel(dateIso: string) {
  const { year, month } = parseIsoDateParts(dateIso);
  return `${year}.${String(month).padStart(2, '0')}`;
}

function getOpenScheduleItems(items: RaahMinistryScheduleItem[]) {
  return items
    .filter((item) => item.status === 'open')
    .sort((a, b) => `${a.date} ${a.startsAt || ''}`.localeCompare(`${b.date} ${b.startsAt || ''}`));
}

function getAttendanceOption(type: RaahAttendanceEventType) {
  return ATTENDANCE_EVENT_OPTIONS.find((option) => option.type === type) || ATTENDANCE_EVENT_OPTIONS[0];
}

function getDateForAttendanceEventType(dateIso: string, eventType: RaahAttendanceEventType) {
  const weekStart = getWeekStartIso(dateIso);
  if (eventType === 'wednesday_prayer') return addDaysIso(weekStart, 3);
  if (eventType === 'other') return dateIso;
  return weekStart;
}

const emptyScheduleForm = (): RaahMinistryScheduleItemInput => ({
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

const emptyCalendarEventForm = (): RaahGoogleCalendarEventInput => ({
  title: '',
  date: getTodayIso(),
  startsAt: '14:00',
  endsAt: '15:00',
  memberId: '',
  memberName: '',
  memo: '',
  sourceLogId: '',
});

function getDashboardSeason() {
  const today = new Date();
  const day = today.getDay();
  if (day <= 2) return 'attendance' as const;
  if (day <= 5) return 'follow-up' as const;
  return 'prepare' as const;
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

const emptyLogForm = (member?: RaahMember): RaahVisitationLogInput => ({
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

const shell = {
  page: 'min-h-screen bg-[#f3f6f8] text-[#17202b]',
  panel: 'rounded-xl border border-[#dbe3e8] bg-white shadow-[0_12px_28px_rgba(21,38,57,0.06)]',
  mutedPanel: 'rounded-xl border border-[#dbe3e8] bg-[#f7faf9]',
  input:
    'w-full rounded-lg border border-[#d5dee5] bg-white px-3 py-2.5 text-sm text-[#17202b] outline-none transition placeholder:text-[#8a97a3] focus:border-[#2e6b5f] focus:ring-2 focus:ring-[#2e6b5f]/15',
  button:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-[#12345a] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0c2745] disabled:cursor-not-allowed disabled:opacity-60',
  ghostButton:
    'inline-flex items-center justify-center gap-2 rounded-lg border border-[#d5dee5] bg-white px-4 py-2.5 text-sm font-semibold text-[#28415b] transition hover:border-[#b7c6d2] hover:bg-[#f7faf9]',
  badge: 'inline-flex items-center gap-1.5 rounded-full border border-[#cfddd8] bg-[#eef7f3] px-2.5 py-1 text-xs font-semibold text-[#2e6b5f]',
};

function getErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object') return fallback;
  const typed = error as { message?: string; code?: string };
  return typed.message || typed.code || fallback;
}

function isRaahSubdomain() {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'raah.builttogether.church';
}

export default function AdminPastoralNotes() {
  const { role, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const subdomainMode = isRaahSubdomain();

  const [activeTab, setActiveTab] = React.useState<ActiveTab>('dashboard');
  const [storageMode, setStorageMode] = React.useState<StorageMode>('loading');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [summary, setSummary] = React.useState<RaahDashboardSummary>(emptySummary);
  const [members, setMembers] = React.useState<RaahMember[]>([]);
  const [logs, setLogs] = React.useState<RaahVisitationLog[]>([]);
  const [attendance, setAttendance] = React.useState<RaahAttendanceEvent | null>(null);
  const [attendanceEvents, setAttendanceEvents] = React.useState<RaahAttendanceEvent[]>([]);
  const [activeAttendanceEventType, setActiveAttendanceEventType] = React.useState<RaahAttendanceEventType>('sunday_morning');
  const [attendanceHistory, setAttendanceHistory] = React.useState<RaahAttendanceHistoryRecord[]>([]);
  const [followUpResolutions, setFollowUpResolutions] = React.useState<RaahFollowUpResolution[]>([]);
  const [ministryScheduleItems, setMinistryScheduleItems] = React.useState<RaahMinistryScheduleItem[]>([]);
  const [legacyNotes, setLegacyNotes] = React.useState<PastoralNote[]>([]);
  const [legacyLoaded, setLegacyLoaded] = React.useState(false);
  const [isLegacyLoading, setIsLegacyLoading] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  const [selectedMemberId, setSelectedMemberId] = React.useState<string | null>(null);
  const [memberForm, setMemberForm] = React.useState<RaahMemberInput>(emptyMemberForm);
  const [editingMemberId, setEditingMemberId] = React.useState<string | null>(null);
  const [isMemberFormOpen, setIsMemberFormOpen] = React.useState(false);

  const [logForm, setLogForm] = React.useState<RaahVisitationLogInput>(emptyLogForm());
  const [selectedLogId, setSelectedLogId] = React.useState<string | null>(null);
  const [editingLogId, setEditingLogId] = React.useState<string | null>(null);
  const [decryptedLog, setDecryptedLog] = React.useState<RaahVisitationLog | null>(null);
  const [isLogFormOpen, setIsLogFormOpen] = React.useState(false);
  const [isDetailLoading, setIsDetailLoading] = React.useState(false);
  const [rawAiMemo, setRawAiMemo] = React.useState('');
  const [aiSuggestion, setAiSuggestion] = React.useState('');
  const [isAiDrafting, setIsAiDrafting] = React.useState(false);

  const [attendanceDate, setAttendanceDate] = React.useState(getLatestSunday);
  const [attendanceServiceType, setAttendanceServiceType] = React.useState('주일예배');
  const [attendanceIncludesCommunion, setAttendanceIncludesCommunion] = React.useState(true);
  const [attendanceMemo, setAttendanceMemo] = React.useState('');
  const [attendanceRecords, setAttendanceRecords] = React.useState<RaahAttendanceRecord[]>([]);
  const [showAbsencesOnly, setShowAbsencesOnly] = React.useState(false);
  const [expandedAttendanceNotes, setExpandedAttendanceNotes] = React.useState(false);
  const [scheduleForm, setScheduleForm] = React.useState<RaahMinistryScheduleItemInput>(emptyScheduleForm);
  const [editingScheduleItemId, setEditingScheduleItemId] = React.useState<string | null>(null);
  const [isScheduleFormOpen, setIsScheduleFormOpen] = React.useState(false);
  const [copiedScheduleItem, setCopiedScheduleItem] = React.useState<RaahMinistryScheduleItem | null>(null);
  const [calendarStatus, setCalendarStatus] = React.useState<RaahCalendarStatus | null>(null);
  const [calendarEventForm, setCalendarEventForm] = React.useState<RaahGoogleCalendarEventInput>(emptyCalendarEventForm);
  const [isCalendarEventFormOpen, setIsCalendarEventFormOpen] = React.useState(false);

  const [legacyForm, setLegacyForm] = React.useState<PastoralNoteInput>(createEmptyPastoralNoteInput);
  const [selectedLegacyNoteId, setSelectedLegacyNoteId] = React.useState<string | null>(null);
  const [editingLegacyNoteId, setEditingLegacyNoteId] = React.useState<string | null>(null);
  const [decryptedLegacyNote, setDecryptedLegacyNote] = React.useState<PastoralNote | null>(null);
  const [isLegacyFormOpen, setIsLegacyFormOpen] = React.useState(false);

  const loadManagementData = React.useCallback(async () => {
    if (!user) return;
    const {
      summary: nextSummary,
      members: nextMembers,
      logs: nextLogs,
      attendanceEvents: nextAttendanceEvents,
      attendanceHistory: nextAttendanceHistory,
      followUpResolutions: nextFollowUpResolutions,
      ministryScheduleItems: nextScheduleItems,
    } = await getRaahBootstrap(attendanceDate, user);
    const nextAttendance = selectAttendanceEvent(nextAttendanceEvents, activeAttendanceEventType);
    const attendanceOption = getAttendanceOption(activeAttendanceEventType);
    setSummary(nextSummary);
    setMembers(nextMembers);
    setLogs(nextLogs);
    setAttendanceEvents(nextAttendanceEvents);
    setAttendance(nextAttendance);
    setAttendanceHistory(nextAttendanceHistory);
    setFollowUpResolutions(nextFollowUpResolutions);
    setMinistryScheduleItems(nextScheduleItems);
    setAttendanceServiceType(nextAttendance?.serviceType || attendanceOption.serviceType);
    setAttendanceIncludesCommunion(nextAttendance?.includesCommunion ?? attendanceOption.includesCommunion);
    setAttendanceMemo(nextAttendance?.memo || '');
    setAttendanceRecords(buildAttendanceRecordsForEvent(nextMembers, nextAttendance));
    setSelectedMemberId((currentId) => (currentId && nextMembers.some((member) => member.id === currentId) ? currentId : nextMembers[0]?.id ?? null));
    setSelectedLogId((currentId) => (currentId && nextLogs.some((log) => log.id === currentId) ? currentId : null));
  }, [activeAttendanceEventType, attendanceDate, user]);

  const loadCalendarStatus = React.useCallback(async () => {
    if (!user) return;
    try {
      const nextStatus = await getRaahCalendarStatus(user);
      setCalendarStatus(nextStatus);
    } catch (error) {
      console.warn('Unable to load RAAH calendar status:', error);
      setCalendarStatus(null);
    }
  }, [user]);

  const loadLegacyNotes = React.useCallback(async () => {
    if (!user) return [];
    setIsLegacyLoading(true);
    try {
      const nextNotes = sortNotesByDate(await listRaahNotes(user));
      setLegacyNotes(nextNotes);
      setSelectedLegacyNoteId((currentId) => (currentId && nextNotes.some((note) => note.id === currentId) ? currentId : null));
      setLegacyLoaded(true);
      return nextNotes;
    } finally {
      setIsLegacyLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (authLoading) return;
    if (role !== 'admin' || !user) {
      setIsLoading(false);
      setStorageMode('loading');
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const start = async () => {
      setIsLoading(true);
      setStorageMode('loading');
      try {
        await loadManagementData();
        await loadCalendarStatus();
        if (!cancelled) setStorageMode('supabase');
      } catch (error) {
        const apiError = error as { status?: number; code?: string };
        if (apiError.status === 503 || apiError.status === 404 || apiError.code === 'RAAH_SUPABASE_NOT_CONFIGURED') {
          setStorageMode('firestore');
          setLegacyLoaded(true);
          toast.info('Supabase 설정 전입니다. 기존 Firestore 호환 모드로 기록을 불러옵니다.');
          unsubscribe = subscribePastoralNotes(
            (nextNotes) => {
              if (cancelled) return;
              const sorted = sortNotesByDate(nextNotes);
              setLegacyNotes(sorted);
              setSelectedLegacyNoteId((currentId) => (currentId && sorted.some((note) => note.id === currentId) ? currentId : null));
            },
            (firestoreError) => {
              console.error('Error loading pastoral notes:', firestoreError);
              toast.error(getErrorMessage(firestoreError, '기존 RAAH 기록을 불러오지 못했습니다.'));
            }
          );
        } else {
          console.error('Error loading RAAH data:', error);
          toast.error(getErrorMessage(error, 'RAAH 데이터를 불러오지 못했습니다.'));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    start();

    return () => {
      cancelled = true;
      unsubscribe?.();
      setDecryptedLog(null);
      setDecryptedLegacyNote(null);
    };
  }, [authLoading, loadCalendarStatus, loadManagementData, role, user]);

  React.useEffect(() => {
    if (activeTab !== 'legacy' || legacyLoaded || isLegacyLoading || storageMode !== 'supabase') return;
    loadLegacyNotes().catch((error) => {
      toast.error(getErrorMessage(error, '기존 RAAH 기록을 불러오지 못했습니다.'));
    });
  }, [activeTab, isLegacyLoading, legacyLoaded, loadLegacyNotes, storageMode]);

  React.useEffect(() => {
    if (!selectedLogId || !user || storageMode !== 'supabase') return;

    let cancelled = false;
    setDecryptedLog(null);
    setIsDetailLoading(true);
    getRaahVisitationLogDetail(selectedLogId, user)
      .then((log) => {
        if (!cancelled) setDecryptedLog(log);
      })
      .catch((error) => {
        if (!cancelled) toast.error(getErrorMessage(error, '선택한 기록을 복호화하지 못했습니다.'));
      })
      .finally(() => {
        if (!cancelled) setIsDetailLoading(false);
      });

    return () => {
      cancelled = true;
      setDecryptedLog(null);
    };
  }, [selectedLogId, storageMode, user]);

  React.useEffect(() => {
    if (!selectedLegacyNoteId || !user || storageMode !== 'supabase') return;

    let cancelled = false;
    setDecryptedLegacyNote(null);
    getRaahNoteDetail(selectedLegacyNoteId, user)
      .then((note) => {
        if (!cancelled) setDecryptedLegacyNote(note);
      })
      .catch((error) => {
        if (!cancelled) toast.error(getErrorMessage(error, '기존 기록을 복호화하지 못했습니다.'));
      });

    return () => {
      cancelled = true;
      setDecryptedLegacyNote(null);
    };
  }, [selectedLegacyNoteId, storageMode, user]);

  React.useEffect(() => () => {
    setDecryptedLog(null);
    setDecryptedLegacyNote(null);
  }, []);

  const normalizedSearch = normalizeMemberName(searchTerm);
  const selectedMember = members.find((member) => member.id === selectedMemberId) || null;
  const selectedMemberLogs = selectedMember ? logs.filter((log) => log.memberId === selectedMember.id || log.memberSearchName === selectedMember.searchName) : [];
  const selectedMemberAttendance = selectedMember ? attendanceRecords.find((record) => record.memberId === selectedMember.id) : null;
  const selectedMemberAttendanceHistory = selectedMember
    ? attendanceHistory
      .filter((record) => record.memberId === selectedMember.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6)
    : [];
  const attendanceCount = attendanceRecords.filter((record) => record.attended).length;
  const communionCount = attendanceRecords.filter((record) => record.communionParticipated).length;
  const pendingFollowUps = filterResolvedFollowUps(logs, followUpResolutions).slice(0, 5);

  const filteredMembers = members.filter((member) => {
    const text = [member.searchName, member.position, member.district, member.phone].join(' ').toLocaleLowerCase('ko-KR');
    return !normalizedSearch || text.includes(normalizedSearch);
  });
  const filteredLogs = logs.filter((log) => {
    const text = [log.memberSearchName, log.logType, log.publicSummary].join(' ').toLocaleLowerCase('ko-KR');
    return !normalizedSearch || text.includes(normalizedSearch);
  });
  const filteredAttendanceRecords = attendanceRecords
    .filter((record) => !showAbsencesOnly || !record.attended)
    .filter((record) => {
      const text = [record.memberSearchName, record.memberName, record.note].join(' ').toLocaleLowerCase('ko-KR');
      return !normalizedSearch || text.includes(normalizedSearch);
    });
  const filteredScheduleItems = ministryScheduleItems.filter((item) => {
    const text = [item.title, getScheduleMemberLabel(item), item.memo, item.itemType, item.date, item.endDate].join(' ').toLocaleLowerCase('ko-KR');
    return !normalizedSearch || text.includes(normalizedSearch);
  });
  const filteredLegacyNotes = legacyNotes.filter((note) => !normalizedSearch || note.memberSearchName.includes(normalizedSearch));
  const selectedLog = selectedLogId ? (decryptedLog?.id === selectedLogId ? decryptedLog : logs.find((log) => log.id === selectedLogId) ?? null) : null;
  const selectedLegacyNote =
    selectedLegacyNoteId ? (decryptedLegacyNote?.id === selectedLegacyNoteId ? decryptedLegacyNote : legacyNotes.find((note) => note.id === selectedLegacyNoteId) ?? null) : null;

  const refreshSupabase = async () => {
    if (!user || storageMode !== 'supabase') return;
    await Promise.all([loadManagementData(), legacyLoaded || activeTab === 'legacy' ? loadLegacyNotes() : Promise.resolve([])]);
  };

  const handleConnectCalendar = async () => {
    if (!user || isSaving) return;
    setIsSaving(true);
    try {
      const { url } = await getRaahCalendarAuthUrl(user);
      window.location.href = url;
    } catch (error) {
      toast.error(getErrorMessage(error, 'Google Calendar 연결을 시작하지 못했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncCalendar = async () => {
    if (!user || isSaving) return;
    setIsSaving(true);
    try {
      const items = await syncRaahGoogleCalendar(user);
      setMinistryScheduleItems((prev) => {
        const withoutSynced = prev.filter((item) => item.source !== 'google_calendar');
        return [...withoutSynced, ...items];
      });
      await loadCalendarStatus();
      toast.success(`Google Calendar에서 ${items.length}개의 일정을 불러왔습니다.`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Google Calendar 일정을 동기화하지 못했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  const openCalendarEventForm = (log: RaahVisitationLog) => {
    setCalendarEventForm({
      title: `심방 - ${log.memberName}`,
      date: log.date || getTodayIso(),
      startsAt: '14:00',
      endsAt: '15:00',
      memberId: log.memberId || '',
      memberName: log.memberName,
      memo: log.nextSteps || log.publicSummary || '',
      sourceLogId: log.id,
    });
    setIsCalendarEventFormOpen(true);
  };

  const handleCreateCalendarEvent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || isSaving) return;
    if (!calendarStatus?.connected) {
      toast.error('먼저 Google Calendar를 연결해 주세요.');
      return;
    }
    if (!calendarEventForm.title.trim() || !calendarEventForm.date || !calendarEventForm.startsAt) {
      toast.error('일정 제목, 날짜, 시작 시간을 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const item = await createRaahGoogleCalendarEvent(
        {
          ...calendarEventForm,
          title: calendarEventForm.title.trim(),
        },
        user
      );
      setMinistryScheduleItems((prev) => [...prev.filter((current) => current.externalId !== item.externalId), item]);
      setCalendarEventForm(emptyCalendarEventForm());
      setIsCalendarEventFormOpen(false);
      toast.success('심방 일정을 Google Calendar에 만들었습니다.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Google Calendar 일정을 만들지 못했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  const openMemberForm = (member?: RaahMember) => {
    if (member) {
      setEditingMemberId(member.id);
      setMemberForm({
        name: member.name,
        birthDate: member.birthDate || '',
        phone: member.phone || '',
        address: member.address || '',
        position: member.position || '',
        district: member.district || '',
        registeredAt: member.registeredAt || '',
        status: member.status,
        publicNote: member.publicNote || '',
      });
    } else {
      setEditingMemberId(null);
      setMemberForm(emptyMemberForm);
    }
    setIsMemberFormOpen(true);
    setActiveTab('members');
  };

  const openLogForm = (member?: RaahMember) => {
    setEditingLogId(null);
    setDecryptedLog(null);
    setLogForm(emptyLogForm(member));
    setRawAiMemo('');
    setAiSuggestion('');
    setIsLogFormOpen(true);
    setActiveTab('visitation');
  };

  const openLogFormForEdit = (log: RaahVisitationLog) => {
    setEditingLogId(log.id);
    setDecryptedLog(log);
    setLogForm({
      memberId: log.memberId || '',
      memberName: log.memberName,
      date: log.date,
      logType: log.logType,
      publicSummary: log.publicSummary || '',
      innerNote: log.innerNote || '',
      prayerTopics: log.prayerTopics || '',
      nextSteps: log.nextSteps || '',
      privateRemarks: log.privateRemarks || '',
    });
    setRawAiMemo('');
    setAiSuggestion('');
    setIsLogFormOpen(true);
    setActiveTab('visitation');
  };

  const openScheduleFormForEdit = (item: RaahMinistryScheduleItem) => {
    setEditingScheduleItemId(item.id);
    setScheduleForm({
      title: item.title,
      date: item.date,
      endDate: item.endDate || item.date,
      startsAt: item.startsAt || '',
      endsAt: item.endsAt || '',
      itemType: item.itemType,
      memberId: item.memberId || '',
      memberName: item.memberName || '',
      memo: item.memo || '',
    });
    setIsScheduleFormOpen(true);
  };

  const openNewScheduleForm = (dateIso?: string, template?: RaahMinistryScheduleItem | null) => {
    setEditingScheduleItemId(null);
    const baseDate = dateIso || template?.date || getTodayIso();
    const templateSpanDays = template ? getDateSpanDays(template.date, template.endDate) : 0;
    setScheduleForm(
      template
        ? {
          title: template.title,
          date: baseDate,
          endDate: addDaysIso(baseDate, templateSpanDays),
          startsAt: template.startsAt || '',
          endsAt: template.endsAt || '',
          itemType: template.itemType,
          memberId: '',
          memberName: '',
          memo: template.memo || '',
        }
        : { ...emptyScheduleForm(), date: baseDate, endDate: baseDate }
    );
    setIsScheduleFormOpen(true);
  };

  const closeScheduleForm = () => {
    setEditingScheduleItemId(null);
    setScheduleForm(emptyScheduleForm());
    setIsScheduleFormOpen(false);
  };

  const openLegacyFormForEdit = (note: PastoralNote) => {
    setEditingLegacyNoteId(note.id);
    setLegacyForm({
      memberName: note.memberName,
      date: note.date,
      meetingType: note.meetingType,
      currentSituation: note.currentSituation || '',
      encouragement: note.encouragement || '',
      prayerTopics: note.prayerTopics || '',
      nextFollowUpDate: note.nextFollowUpDate || '',
      remarks: note.remarks || '',
    });
    setIsLegacyFormOpen(true);
    setActiveTab('legacy');
  };

  const openNewLegacyForm = () => {
    setEditingLegacyNoteId(null);
    setLegacyForm(createEmptyPastoralNoteInput());
    setIsLegacyFormOpen(true);
  };

  const handleGenerateAiDraft = async () => {
    if (!user || isAiDrafting) return;
    if (!rawAiMemo.trim() || rawAiMemo.trim().length < 10) {
      toast.error('AI로 정리할 긴 메모를 먼저 입력해 주세요.');
      return;
    }

    setIsAiDrafting(true);
    try {
      const draft = await generateRaahVisitationDraft(
        {
          rawMemo: rawAiMemo,
          memberName: logForm.memberName,
          logType: logForm.logType,
          date: logForm.date,
        },
        user
      );
      setLogForm((prev) => ({
        ...prev,
        publicSummary: draft.publicSummary || prev.publicSummary,
        innerNote: draft.innerNote || prev.innerNote,
        prayerTopics: draft.prayerTopics || prev.prayerTopics,
        nextSteps: draft.nextSteps || prev.nextSteps,
        privateRemarks: draft.privateRemarks || prev.privateRemarks,
      }));
      setAiSuggestion(draft.recommendedAction);
      toast.success('AI가 기록 초안을 정리했습니다. 저장 전 내용을 확인해 주세요.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'AI 기록 정리에 실패했습니다.'));
    } finally {
      setIsAiDrafting(false);
    }
  };

  const handleMemberSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || isSaving) return;
    if (!memberForm.name.trim()) {
      toast.error('성도 이름을 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const saved = editingMemberId ? await updateRaahMember(editingMemberId, memberForm, user) : await createRaahMember(memberForm, user);
      setSelectedMemberId(saved.id);
      setIsMemberFormOpen(false);
      setEditingMemberId(null);
      setMemberForm(emptyMemberForm);
      toast.success(editingMemberId ? '성도 정보를 수정했습니다.' : '성도 명부에 등록했습니다.');
      await refreshSupabase();
    } catch (error) {
      toast.error(getErrorMessage(error, '성도 정보를 저장하지 못했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleMemberSelectForLog = (memberId: string) => {
    const member = members.find((item) => item.id === memberId);
    setLogForm((prev) => ({ ...prev, memberId, memberName: member?.name || prev.memberName }));
  };

  const handleLogSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || isSaving) return;
    if (!logForm.memberName.trim() || !logForm.date || !logForm.innerNote.trim() || !logForm.prayerTopics.trim()) {
      toast.error('성도 이름, 날짜, 내밀한 목양 기록, 기도 제목을 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const created = editingLogId ? await updateRaahVisitationLog(editingLogId, logForm, user) : await createRaahVisitationLog(logForm, user);
      setIsLogFormOpen(false);
      setEditingLogId(null);
      setSelectedLogId(created.id);
      setDecryptedLog(created);
      setLogForm(emptyLogForm());
      setRawAiMemo('');
      setAiSuggestion('');
      toast.success(editingLogId ? '심방/상담 기록을 수정했습니다.' : '심방/상담 기록을 암호화해 저장했습니다.');
      await refreshSupabase();
    } catch (error) {
      toast.error(getErrorMessage(error, '심방/상담 기록을 저장하지 못했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAttendance = (memberId: string, field: 'attended' | 'communionParticipated') => {
    setAttendanceRecords((prev) =>
      prev.map((record) => {
        if (record.memberId !== memberId) return record;
        const nextValue = !record[field];
        return {
          ...record,
          [field]: nextValue,
          attended: field === 'communionParticipated' && nextValue ? true : field === 'attended' ? nextValue : record.attended,
          communionParticipated: field === 'attended' && !nextValue ? false : field === 'communionParticipated' ? nextValue : record.communionParticipated,
        };
      })
    );
  };

  const switchAttendanceEventType = (eventType: RaahAttendanceEventType, dateOverride?: string) => {
    const nextDate = getDateForAttendanceEventType(dateOverride || attendanceDate, eventType);
    const nextAttendance = selectAttendanceEvent(attendanceEvents, eventType);
    const option = getAttendanceOption(eventType);
    setActiveAttendanceEventType(eventType);
    setAttendanceDate(nextDate);
    setAttendance(nextAttendance);
    setAttendanceServiceType(nextAttendance?.serviceType || option.serviceType);
    setAttendanceIncludesCommunion(nextAttendance?.includesCommunion ?? option.includesCommunion);
    setAttendanceMemo(nextAttendance?.memo || '');
    setAttendanceRecords(buildAttendanceRecordsForEvent(members, nextAttendance));
  };

  const handleSaveAttendance = async () => {
    if (!user || isSaving) return;
    if (!attendanceDate || !attendanceServiceType.trim()) {
      toast.error('출석 날짜와 예배 유형을 입력해 주세요.');
      return;
    }

    const input: RaahAttendanceInput = {
      date: getDateForAttendanceEventType(attendanceDate, activeAttendanceEventType),
      eventType: activeAttendanceEventType,
      serviceType: attendanceServiceType.trim(),
      includesCommunion: attendanceIncludesCommunion,
      memo: attendanceMemo,
      records: attendanceRecords.map((record) => ({
        memberId: record.memberId,
        memberName: record.memberName,
        attended: record.attended,
        communionParticipated: attendanceIncludesCommunion ? record.communionParticipated : false,
        note: record.note || '',
      })),
    };

    setIsSaving(true);
    try {
      const saved = await saveRaahAttendance(input, user);
      setAttendance(saved);
      setAttendanceEvents((prev) => {
        const withoutCurrent = prev.filter((event) => (event.eventType || 'sunday_morning') !== (saved.eventType || activeAttendanceEventType));
        return [...withoutCurrent, saved];
      });
      setAttendanceRecords(buildAttendanceRecordsForEvent(members, saved));
      toast.success('출석 체크를 저장했습니다.');
      await loadManagementData();
    } catch (error) {
      toast.error(getErrorMessage(error, '출석 체크를 저장하지 못했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleResolveFollowUp = async (log: RaahVisitationLog) => {
    if (!user || isSaving) return;
    setIsSaving(true);
    try {
      const resolution = await resolveRaahFollowUp(
        {
          sourceType: 'visitation',
          sourceId: log.id,
          memberId: log.memberId || '',
          memberName: log.memberName,
        },
        user
      );
      setFollowUpResolutions((prev) => [resolution, ...prev.filter((item) => item.candidateKey !== resolution.candidateKey)]);
      toast.success('후속 확인을 완료 처리했습니다.');
    } catch (error) {
      toast.error(getErrorMessage(error, '후속 확인을 완료 처리하지 못했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateScheduleItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || isSaving) return;
    if (!scheduleForm.title.trim() || !scheduleForm.date) {
      toast.error('일정 제목과 날짜를 입력해 주세요.');
      return;
    }
    setIsSaving(true);
    try {
      if ((scheduleForm.endDate || scheduleForm.date) < scheduleForm.date) {
        toast.error('종료일은 시작일보다 빠를 수 없습니다.');
        return;
      }
      const input = {
        ...scheduleForm,
        title: scheduleForm.title.trim(),
        endDate: scheduleForm.endDate || scheduleForm.date,
        memberId: scheduleForm.memberId || '',
        memberName: scheduleForm.memberName || '',
      };
      const item = editingScheduleItemId ? await updateRaahMinistryScheduleItem(editingScheduleItemId, input, user) : await createRaahMinistryScheduleItem(input, user);
      setMinistryScheduleItems((prev) => (editingScheduleItemId ? prev.map((current) => (current.id === item.id ? item : current)) : [...prev, item]));
      closeScheduleForm();
      toast.success(editingScheduleItemId ? '사역 일정을 수정했습니다.' : '사역 일정을 추가했습니다.');
    } catch (error) {
      toast.error(getErrorMessage(error, '사역 일정을 저장하지 못했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompleteScheduleItem = async (itemId: string) => {
    if (!user || isSaving) return;
    setIsSaving(true);
    try {
      const item = await completeRaahMinistryScheduleItem(itemId, user);
      setMinistryScheduleItems((prev) => prev.map((current) => (current.id === item.id ? item : current)));
      toast.success('사역 일정을 완료했습니다.');
    } catch (error) {
      toast.error(getErrorMessage(error, '사역 일정을 완료하지 못했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleLegacySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || isSaving) return;
    if (!legacyForm.memberName.trim() || !legacyForm.date || !legacyForm.currentSituation.trim() || !legacyForm.encouragement.trim() || !legacyForm.prayerTopics.trim()) {
      toast.error('성도 이름, 날짜, 현재 상황, 권면 내용, 기도 제목을 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    try {
      if (storageMode === 'firestore') {
        const created = await createPastoralNote(legacyForm, user);
        setSelectedLegacyNoteId(created.id);
        toast.success('기존 Firestore 호환 모드로 저장했습니다.');
      } else {
        const created = editingLegacyNoteId ? await updateRaahNote(editingLegacyNoteId, legacyForm, user) : await createRaahNote(legacyForm, user);
        setSelectedLegacyNoteId(created.id);
        setDecryptedLegacyNote(created);
        toast.success(editingLegacyNoteId ? '기존 RAAH 기록을 수정했습니다.' : '기존 RAAH 기록을 Supabase에 암호화해 저장했습니다.');
        await loadLegacyNotes();
      }
      setIsLegacyFormOpen(false);
      setEditingLegacyNoteId(null);
      setLegacyForm(createEmptyPastoralNoteInput());
    } catch (error) {
      toast.error(getErrorMessage(error, '기존 RAAH 기록을 저장하지 못했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8]">
        <p className="text-sm text-[#607080]">관리자 권한을 확인하는 중입니다.</p>
      </div>
    );
  }

  if (role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f6f8] px-4">
        <div className="w-full max-w-md rounded-lg border border-[#dbe3e8] bg-[#ffffff] p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#12345a] text-white">
            <Lock size={22} />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-[#17202b]">RAAH 관리자 전용</h2>
          <p className="mt-3 text-sm leading-6 text-[#607080]">목양 기록은 관리자 계정으로 로그인한 경우에만 열람할 수 있습니다.</p>
          <div className="mt-6 flex flex-col gap-3">
            {!user && (
              <button type="button" onClick={() => signInWithGoogle().catch(() => undefined)} className={shell.button}>
                <LogIn size={16} />
                Google로 로그인
              </button>
            )}
            <button type="button" onClick={() => navigate('/')} className={shell.ghostButton}>
              홈페이지로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: ActiveTab; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: TEXT.tabs.dashboard, icon: <BarChart3 size={18} /> },
    { id: 'members', label: TEXT.tabs.members, icon: <Users size={18} /> },
    { id: 'attendance', label: TEXT.tabs.attendance, icon: <CheckSquare size={18} /> },
    { id: 'schedule', label: TEXT.tabs.schedule, icon: <CalendarDays size={18} /> },
    { id: 'visitation', label: TEXT.tabs.visitation, icon: <ClipboardList size={18} /> },
    { id: 'legacy', label: TEXT.tabs.legacy, icon: <FileText size={18} /> },
  ];

  const switchTab = (tabId: ActiveTab) => {
    setActiveTab(tabId);
    setSearchTerm('');
    setDecryptedLog(null);
    setDecryptedLegacyNote(null);
  };

  return (
    <div className={shell.page}>
      <div className="min-h-screen lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <header className="hidden">
          <div className="flex min-h-20 items-center gap-4 px-6 xl:px-8">
            <div className="flex shrink-0 items-center gap-3 pr-2">
              <img src="/raah-icon-48.png" alt="" className="h-11 w-11 rounded-lg" />
              <div>
                <p className="text-lg font-semibold tracking-[0.16em]">RAAH</p>
                <p className="text-xs text-white/60">Pastoral Care</p>
              </div>
            </div>

            <nav className="flex min-w-0 flex-1 items-center gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => switchTab(tab.id)}
                  className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                    activeTab === tab.id ? 'bg-[#f3f6f8] text-[#17202b]' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>

            <label className="relative w-64 shrink-0 xl:w-80">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2e6b5f]" />
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={TEXT.search[activeTab]} className={`${shell.input} h-10 bg-[#ffffff] pl-9`} />
            </label>

            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/80">
              <Lock size={12} />
              {storageMode === 'supabase' ? '암호화 저장' : storageMode === 'firestore' ? 'Firestore 호환' : '저장소 확인 중'}
            </span>

            {!subdomainMode && (
              <button type="button" onClick={() => navigate('/admin')} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/15 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="관리자 대시보드로 돌아가기">
                <ArrowLeft size={18} />
              </button>
            )}
            <button type="button" onClick={() => logout()} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/15 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="로그아웃">
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <aside className="hidden border-r border-[#dbe3e8] bg-[#0f2742] text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
            <img src="/raah-icon-48.png" alt="" className="h-11 w-11 rounded-xl border border-white/10 bg-white/10" />
            <div>
              <p className="text-lg font-semibold tracking-[0.14em]">RAAH</p>
              <p className="text-xs font-medium text-[#adcacd]">Pastoral Care CRM</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5">
            <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#adcacd]">Secure Workspace</p>
              <p className="mt-2 text-sm leading-5 text-white/75">목양 돌봄 기록과 후속 계획을 한 곳에서 관리합니다.</p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/80">
                <Lock size={12} />
                {storageMode === 'supabase' ? '암호화 저장' : storageMode === 'firestore' ? 'Firestore 호환' : '저장소 확인 중'}
              </span>
            </div>

            <nav className="mt-6 space-y-1.5">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => switchTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    activeTab === tab.id ? 'bg-white text-[#12345a] shadow-sm' : 'text-white/72 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${activeTab === tab.id ? 'bg-[#eef7f3] text-[#2e6b5f]' : 'bg-white/10 text-[#adcacd]'}`}>
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="border-t border-white/10 p-4">
            <label className="relative block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#adcacd]" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={TEXT.search[activeTab]}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/10 px-3 pl-9 text-sm text-white outline-none placeholder:text-white/45 transition focus:border-[#adcacd] focus:ring-2 focus:ring-[#adcacd]/20"
              />
            </label>
            <div className="mt-3 flex items-center gap-2">
              {!subdomainMode && (
                <button type="button" onClick={() => navigate('/admin')} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white">
                  <ArrowLeft size={16} />
                  Admin
                </button>
              )}
              <button type="button" onClick={() => logout()} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white">
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:min-h-screen lg:pb-0">
          <header className="sticky top-0 z-20 border-b border-[#dbe3e8] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                {!subdomainMode && (
                  <button type="button" onClick={() => navigate('/admin')} className="rounded-md border border-[#d5dee5] bg-[#ffffff] p-2 text-[#28415b]" aria-label="관리자 대시보드로 돌아가기">
                    <ArrowLeft size={18} />
                  </button>
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold tracking-tight text-[#17202b] sm:text-2xl">RAAH 목양 관리</h1>
                    <span className={shell.badge}>
                      <Lock size={12} />
                      {storageMode === 'supabase' ? '암호화 저장' : storageMode === 'firestore' ? 'Firestore 호환' : '저장소 확인 중'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#607080]">찾고, 체크하고, 기록하는 목양 관리 앱</p>
                </div>
              </div>
              <label className="relative w-full xl:w-80">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2e6b5f]" />
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={TEXT.search[activeTab]} className={`${shell.input} pl-9`} />
              </label>
            </div>
          </header>

          <header className="hidden border-b border-[#dbe3e8] bg-white/82 px-8 py-5 backdrop-blur lg:block">
            <div className="mx-auto flex max-w-[1540px] items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-[#17202b]">RAAH 목양 관리</h1>
                  <span className={shell.badge}>
                    <ShieldCheck size={13} />
                    Privacy-first CRM
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#607080]">성도 돌봄, 심방 일정, 목양 노트, 후속 계획을 전문적으로 관리합니다.</p>
              </div>
              <label className="relative w-[360px] shrink-0">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a8b9a]" />
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={TEXT.search[activeTab]} className={`${shell.input} h-11 pl-9`} />
              </label>
            </div>
          </header>

          <div className="mx-auto max-w-[1540px] space-y-5 px-4 py-5 lg:px-8 lg:py-8">
            {activeTab === 'dashboard' && (
              <DashboardTab
                isLoading={isLoading}
                summary={summary}
                members={members}
                logs={logs}
                attendanceDate={attendanceDate}
                attendanceCount={attendanceCount}
                communionCount={communionCount}
                attendanceHistory={attendanceHistory}
                pendingFollowUps={pendingFollowUps}
                scheduleItems={ministryScheduleItems}
                scheduleForm={scheduleForm}
                setScheduleForm={setScheduleForm}
                editingScheduleItemId={editingScheduleItemId}
                isScheduleFormOpen={isScheduleFormOpen}
                onOpenNewSchedule={openNewScheduleForm}
                onCloseScheduleForm={closeScheduleForm}
                onEdit={openScheduleFormForEdit}
                calendarStatus={calendarStatus}
                isSaving={isSaving}
                onOpenAttendance={() => setActiveTab('attendance')}
                onOpenLog={(logId) => {
                  setSelectedLogId(logId);
                  setActiveTab('visitation');
                }}
                onResolveFollowUp={handleResolveFollowUp}
                onNewLog={() => openLogForm(selectedMember || undefined)}
                onNewLogForMember={(member) => openLogForm(member)}
                onCreateScheduleItem={handleCreateScheduleItem}
                onCompleteScheduleItem={handleCompleteScheduleItem}
                onConnectCalendar={handleConnectCalendar}
                onSyncCalendar={handleSyncCalendar}
              />
            )}

            {activeTab === 'members' && (
              <MembersTab
                members={filteredMembers}
                selectedMember={selectedMember}
                selectedMemberLogs={selectedMemberLogs}
                selectedMemberAttendance={selectedMemberAttendance}
                selectedMemberAttendanceHistory={selectedMemberAttendanceHistory}
                attendanceDate={attendanceDate}
                hasAttendanceEvent={Boolean(attendance)}
                onSelectMember={setSelectedMemberId}
                onEditMember={openMemberForm}
                onNewMember={() => openMemberForm()}
                onNewLog={(member) => openLogForm(member)}
                isFormOpen={isMemberFormOpen}
                isSaving={isSaving}
                editing={Boolean(editingMemberId)}
                form={memberForm}
                setForm={setMemberForm}
                onSubmit={handleMemberSubmit}
                onCloseForm={() => setIsMemberFormOpen(false)}
              />
            )}

            {activeTab === 'attendance' && (
              <AttendanceTab
                attendance={attendance}
                attendanceEvents={attendanceEvents}
                activeEventType={activeAttendanceEventType}
                onEventTypeChange={switchAttendanceEventType}
                date={attendanceDate}
                setDate={setAttendanceDate}
                serviceType={attendanceServiceType}
                setServiceType={setAttendanceServiceType}
                includesCommunion={attendanceIncludesCommunion}
                setIncludesCommunion={setAttendanceIncludesCommunion}
                memo={attendanceMemo}
                setMemo={setAttendanceMemo}
                members={members}
                attendanceHistory={attendanceHistory}
                records={filteredAttendanceRecords}
                allRecords={attendanceRecords}
                setRecords={setAttendanceRecords}
                attendanceCount={attendanceCount}
                communionCount={communionCount}
                showAbsencesOnly={showAbsencesOnly}
                setShowAbsencesOnly={setShowAbsencesOnly}
                expandedNotes={expandedAttendanceNotes}
                setExpandedNotes={setExpandedAttendanceNotes}
                isSaving={isSaving}
                onToggle={toggleAttendance}
                onSave={handleSaveAttendance}
                disabled={storageMode !== 'supabase'}
              />
            )}

            {activeTab === 'schedule' && (
              <ScheduleTab
                scheduleItems={filteredScheduleItems}
                scheduleForm={scheduleForm}
                setScheduleForm={setScheduleForm}
                editingScheduleItemId={editingScheduleItemId}
                isScheduleFormOpen={isScheduleFormOpen}
                onOpenNewSchedule={openNewScheduleForm}
                onCloseScheduleForm={closeScheduleForm}
                onEdit={openScheduleFormForEdit}
                calendarStatus={calendarStatus}
                isSaving={isSaving}
                onCreateScheduleItem={handleCreateScheduleItem}
                onCompleteScheduleItem={handleCompleteScheduleItem}
                onConnectCalendar={handleConnectCalendar}
                onSyncCalendar={handleSyncCalendar}
                copiedScheduleItem={copiedScheduleItem}
                onCopySchedule={(item) => {
                  setCopiedScheduleItem(item);
                  toast.success('일정을 복사했습니다. 원하는 날짜를 눌러 붙여넣을 수 있습니다.');
                }}
                onSelectDate={(dateIso) => {
                  openNewScheduleForm(dateIso, copiedScheduleItem);
                  if (copiedScheduleItem) toast.success('복사한 일정 내용을 새 날짜에 붙여넣었습니다.');
                }}
              />
            )}

            {activeTab === 'visitation' && (
              <VisitationTab
                logs={filteredLogs}
                selectedLog={selectedLog}
                selectedLogId={selectedLogId}
                setSelectedLogId={setSelectedLogId}
                clearDecrypted={() => setDecryptedLog(null)}
                isFormOpen={isLogFormOpen}
                isSaving={isSaving}
                members={members}
                form={logForm}
                setForm={setLogForm}
                editingLogId={editingLogId}
                rawAiMemo={rawAiMemo}
                setRawAiMemo={setRawAiMemo}
                aiSuggestion={aiSuggestion}
                isAiDrafting={isAiDrafting}
                isDetailLoading={isDetailLoading}
                calendarStatus={calendarStatus}
                calendarEventForm={calendarEventForm}
                setCalendarEventForm={setCalendarEventForm}
                isCalendarEventFormOpen={isCalendarEventFormOpen}
                setIsCalendarEventFormOpen={setIsCalendarEventFormOpen}
                onAiDraft={handleGenerateAiDraft}
                onSubmit={handleLogSubmit}
                onCreateCalendarEvent={handleCreateCalendarEvent}
                onOpenCalendarEvent={openCalendarEventForm}
                onEdit={openLogFormForEdit}
                onCloseForm={() => {
                  setIsLogFormOpen(false);
                  setEditingLogId(null);
                  setRawAiMemo('');
                  setAiSuggestion('');
                }}
                onNew={() => openLogForm(selectedMember || undefined)}
                onMemberSelect={handleMemberSelectForLog}
              />
            )}

            {activeTab === 'legacy' && (
              <LegacyTab
                notes={filteredLegacyNotes}
                selectedNote={selectedLegacyNote}
                selectedNoteId={selectedLegacyNoteId}
                setSelectedNoteId={setSelectedLegacyNoteId}
                clearDecrypted={() => setDecryptedLegacyNote(null)}
                isLoading={isLegacyLoading}
                isFormOpen={isLegacyFormOpen}
                isSaving={isSaving}
                form={legacyForm}
                setForm={setLegacyForm}
                editing={Boolean(editingLegacyNoteId)}
                onSubmit={handleLegacySubmit}
                onCloseForm={() => {
                  setIsLegacyFormOpen(false);
                  setEditingLegacyNoteId(null);
                  setLegacyForm(createEmptyPastoralNoteInput());
                }}
                onNew={openNewLegacyForm}
                onEdit={openLegacyFormForEdit}
              />
            )}
          </div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#dbe3e8] bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(21,38,57,0.08)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-6 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-xs font-semibold transition ${
                activeTab === tab.id ? 'bg-[#12345a] text-white' : 'text-[#607080]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function ScheduleTab({
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

function ScheduleDetailList({
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

function ScheduleListColumn({
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

function DashboardTab({
  isLoading,
  summary,
  members,
  logs,
  attendanceDate,
  attendanceCount,
  communionCount,
  attendanceHistory,
  pendingFollowUps,
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
  onOpenAttendance,
  onOpenLog,
  onResolveFollowUp,
  onNewLog,
  onNewLogForMember,
  onCreateScheduleItem,
  onCompleteScheduleItem,
  onConnectCalendar,
  onSyncCalendar,
}: {
  isLoading: boolean;
  summary: RaahDashboardSummary;
  members: RaahMember[];
  logs: RaahVisitationLog[];
  attendanceDate: string;
  attendanceCount: number;
  communionCount: number;
  attendanceHistory: RaahAttendanceHistoryRecord[];
  pendingFollowUps: RaahVisitationLog[];
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
  onOpenAttendance: () => void;
  onOpenLog: (logId: string) => void;
  onResolveFollowUp: (log: RaahVisitationLog) => void;
  onNewLog: () => void;
  onNewLogForMember: (member: RaahMember) => void;
  onCreateScheduleItem: (event: React.FormEvent<HTMLFormElement>) => void;
  onCompleteScheduleItem: (itemId: string) => void;
  onConnectCalendar: () => void;
  onSyncCalendar: () => void;
}) {
  const activeMemberCount = summary.activeMemberCount || members.filter((member) => member.status === 'active').length;
  const absentCount = Math.max(activeMemberCount - attendanceCount, 0);
  const attendanceRate = percent(attendanceCount, activeMemberCount);
  const communionRate = percent(communionCount, attendanceCount);
  const dashboardAttendanceFlow = React.useMemo(
    () => buildRaahAttendanceFlow({ members, history: attendanceHistory, limit: 1 }),
    [attendanceHistory, members]
  );
  const todayTasks = React.useMemo(
    () => buildDashboardTasks({
      flow: dashboardAttendanceFlow,
      members,
      pendingFollowUps,
      scheduleItems,
    }),
    [dashboardAttendanceFlow, members, pendingFollowUps, scheduleItems]
  );
  const dashboardSeason = getDashboardSeason();
  const taskBoardCopy =
    dashboardSeason === 'attendance'
      ? '출석 정리와 후속 연락을 한 화면에서 처리합니다.'
      : dashboardSeason === 'follow-up'
        ? '결석자와 남은 다음 단계를 먼저 확인합니다.'
        : '다가오는 일정과 미체크 예배를 먼저 점검합니다.';

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        <FocusCard label="활성 성도" value={activeMemberCount} icon={<Users size={20} />} />
        <FocusCard label="주일 출석" value={attendanceCount} helper={`성찬 ${communionCount} · 미출석 ${absentCount}`} icon={<CheckSquare size={20} />} />
        <FocusCard label="이번 주 기록" value={summary.thisWeekLogCount} icon={<ClipboardList size={20} />} />
        <FocusCard label="암호화 기록" value={summary.encryptedLogCount || logs.filter((log) => log.isEncrypted).length} icon={<Lock size={20} />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AttendanceSnapshot
          date={attendanceDate}
          activeMemberCount={activeMemberCount}
          attendanceCount={attendanceCount}
          communionCount={communionCount}
          absentCount={absentCount}
          attendanceRate={attendanceRate}
          communionRate={communionRate}
          flow={dashboardAttendanceFlow}
          onOpenAttendance={onOpenAttendance}
        />

        <div className={shell.panel + ' p-4'}>
          <h2 className="text-lg font-semibold">최근 심방/상담</h2>
          <div className="mt-4 space-y-2">
            {isLoading ? <EmptyState>RAAH 데이터를 불러오는 중입니다.</EmptyState> : logs.length === 0 ? <EmptyState>아직 심방/상담 기록이 없습니다.</EmptyState> : logs.slice(0, 5).map((log) => <LogRow key={log.id} log={log} active={false} onClick={() => onOpenLog(log.id)} />)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={shell.panel + ' p-5'}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">오늘 할 일</h2>
              <p className="mt-1 text-sm text-[#607080]">{taskBoardCopy}</p>
            </div>
            <button type="button" onClick={onNewLog} className={shell.button}>
              <Plus size={16} />
              기록
            </button>
          </div>
          <TodayTaskList
            tasks={todayTasks}
            members={members}
            isSaving={isSaving}
            onOpenAttendance={onOpenAttendance}
            onOpenLog={onOpenLog}
            onResolveFollowUp={onResolveFollowUp}
            onNewLogForMember={onNewLogForMember}
            onEditSchedule={onEdit}
            onCompleteSchedule={onCompleteScheduleItem}
          />
        </div>

        <div className={shell.panel + ' p-5'}>
          <h2 className="text-lg font-semibold">후속 확인 후보</h2>
          <div className="mt-4 space-y-2">
            {isLoading ? (
              <EmptyState>후속 확인 목록을 불러오는 중입니다.</EmptyState>
            ) : pendingFollowUps.length === 0 ? (
              <EmptyState>후속 확인이 필요한 기록이 아직 없습니다.</EmptyState>
            ) : (
              pendingFollowUps.map((log) => <FollowUpRow key={log.id} log={log} disabled={isSaving} onOpenLog={onOpenLog} onResolve={onResolveFollowUp} />)
            )}
          </div>
        </div>
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
      />
    </section>
  );
}

type DashboardTask =
  | {
      id: string;
      kind: 'attendance_missing';
      label: string;
      title: string;
      description: string;
      event: RaahAttendanceFlowEvent;
    }
  | {
      id: string;
      kind: 'attendance_absence';
      label: string;
      title: string;
      description: string;
      memberId: string;
      event?: RaahAttendanceFlowEvent;
    }
  | {
      id: string;
      kind: 'follow_up';
      label: string;
      title: string;
      description: string;
      log: RaahVisitationLog;
    }
  | {
      id: string;
      kind: 'schedule';
      label: string;
      title: string;
      description: string;
      item: RaahMinistryScheduleItem;
    };

function buildDashboardTasks({
  flow,
  members,
  pendingFollowUps,
  scheduleItems,
}: {
  flow: ReturnType<typeof buildRaahAttendanceFlow>;
  members: RaahMember[];
  pendingFollowUps: RaahVisitationLog[];
  scheduleItems: RaahMinistryScheduleItem[];
}): DashboardTask[] {
  const tasks: DashboardTask[] = [];
  const latestWeek = flow.weeks[0];
  const latestEvent = latestWeek?.events[0];
  if (latestWeek) {
    latestWeek.events.forEach((event) => {
      const index = flow.events.findIndex((flowEvent) => flowEvent.key === event.key);
      const recordedCount = index >= 0 ? flow.rows.filter((row) => row.cells[index]?.attended !== null).length : 0;
      if (recordedCount === 0) {
        tasks.push({
          id: `missing:${event.key}`,
          kind: 'attendance_missing',
          label: '미체크 예배',
          title: getAttendanceEventLabel(event),
          description: `${event.date.slice(5).replace('-', '.')} 출석 기록이 아직 없습니다.`,
          event,
        });
      }
    });
  }

  const latestEventIndex = latestEvent ? flow.events.findIndex((event) => event.key === latestEvent.key) : -1;
  if (latestEventIndex >= 0) {
    flow.rows
      .filter((row) => row.cells[latestEventIndex]?.attended === false)
      .slice(0, 2)
      .forEach((row) => {
        const member = members.find((current) => current.id === row.memberId);
        tasks.push({
          id: `absence:${row.memberId}:${latestEvent?.key}`,
          kind: 'attendance_absence',
          label: '출석 후속',
          title: row.memberName,
          description: `${getAttendanceEventLabel(latestEvent)} 결석${member?.phone ? ` · ${member.phone}` : ''}`,
          memberId: row.memberId,
          event: latestEvent,
        });
      });
  }

  flow.concernRows.slice(0, 2).forEach((row) => {
    if (tasks.some((task) => task.kind === 'attendance_absence' && task.memberId === row.memberId)) return;
    tasks.push({
      id: `concern:${row.memberId}`,
      kind: 'attendance_absence',
      label: '연락 대상',
      title: row.memberName,
      description: row.consecutiveAbsences >= 2 ? `주일 오전 ${row.consecutiveAbsences}회 연속 결석` : `주일 오전 결석 ${row.requiredAbsenceCount}회`,
      memberId: row.memberId,
      event: latestEvent,
    });
  });

  pendingFollowUps.slice(0, 2).forEach((log) => {
    tasks.push({
      id: `follow:${log.id}`,
      kind: 'follow_up',
      label: '심방 후속',
      title: log.memberName,
      description: log.nextSteps || log.publicSummary || `${formatDisplayDate(log.date)} ${log.logType} 기록 확인`,
      log,
    });
  });

  const todayIso = getTodayIso();
  getOpenScheduleItems(scheduleItems)
    .filter((item) => item.date >= todayIso)
    .slice(0, 2)
    .forEach((item) => {
      tasks.push({
        id: `schedule:${item.id}`,
        kind: 'schedule',
        label: '다가오는 일정',
        title: item.title,
        description: `${formatScheduleDateRange(item)}${item.startsAt ? ` · ${item.startsAt}` : ''}${getScheduleMemberLabel(item) ? ` · ${getScheduleMemberLabel(item)}` : ''}`,
        item,
      });
    });

  return tasks.slice(0, 6);
}

function TodayTaskList({
  tasks,
  members,
  isSaving,
  onOpenAttendance,
  onOpenLog,
  onResolveFollowUp,
  onNewLogForMember,
  onEditSchedule,
  onCompleteSchedule,
}: {
  tasks: DashboardTask[];
  members: RaahMember[];
  isSaving: boolean;
  onOpenAttendance: () => void;
  onOpenLog: (logId: string) => void;
  onResolveFollowUp: (log: RaahVisitationLog) => void;
  onNewLogForMember: (member: RaahMember) => void;
  onEditSchedule: (item: RaahMinistryScheduleItem) => void;
  onCompleteSchedule: (itemId: string) => void;
}) {
  if (tasks.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState>오늘 먼저 처리할 항목이 없습니다.</EmptyState>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {tasks.map((task) => {
        const member = task.kind === 'attendance_absence' ? members.find((current) => current.id === task.memberId) : null;
        return (
          <div key={task.id} className="rounded-lg border border-[#dbe3e8] bg-[#f8fafb] p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <span className={shell.badge}>{task.label}</span>
                <p className="mt-2 font-semibold text-[#17202b]">{task.title}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#607080]">{task.description}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {task.kind === 'attendance_missing' && (
                  <button type="button" onClick={onOpenAttendance} className={shell.ghostButton}>
                    출석 열기
                  </button>
                )}
                {task.kind === 'attendance_absence' && (
                  <>
                    <button type="button" onClick={() => (member ? onNewLogForMember(member) : onOpenAttendance())} className={shell.button}>
                      기록
                    </button>
                    <button type="button" onClick={onOpenAttendance} className={shell.ghostButton}>
                      출석
                    </button>
                  </>
                )}
                {task.kind === 'follow_up' && (
                  <>
                    <button type="button" onClick={() => onOpenLog(task.log.id)} className={shell.ghostButton}>
                      열기
                    </button>
                    <button type="button" disabled={isSaving} onClick={() => onResolveFollowUp(task.log)} className={shell.button}>
                      완료
                    </button>
                  </>
                )}
                {task.kind === 'schedule' && (
                  <>
                    <button type="button" onClick={() => onEditSchedule(task.item)} className={shell.ghostButton}>
                      수정
                    </button>
                    <button type="button" disabled={isSaving} onClick={() => onCompleteSchedule(task.item.id)} className={shell.button}>
                      완료
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FollowUpRow({
  log,
  disabled,
  onOpenLog,
  onResolve,
}: {
  log: RaahVisitationLog;
  disabled: boolean;
  onOpenLog: (logId: string) => void;
  onResolve: (log: RaahVisitationLog) => void;
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-[#dbe3e8] bg-[#f8fafb] p-2 md:grid-cols-[minmax(0,1fr),96px]">
      <LogRow log={log} active={false} onClick={() => onOpenLog(log.id)} />
      <button type="button" disabled={disabled} onClick={() => onResolve(log)} className={shell.ghostButton + ' min-h-10 md:h-full'}>
        완료
      </button>
    </div>
  );
}

function MinistrySchedulePanel({
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
  const lastWheelAtRef = React.useRef(0);
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
  const handleCalendarWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) < 20) return;
    const now = Date.now();
    if (now - lastWheelAtRef.current < 420) return;
    event.preventDefault();
    lastWheelAtRef.current = now;
    shiftCalendar(event.deltaY > 0 ? 1 : -1);
  };
  return (
    <div className={shell.panel + ' p-5'}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">사역 일정판</h2>
          <p className="mt-1 text-sm text-[#607080]">날짜를 누르면 그 날짜로 일정을 등록합니다.</p>
        </div>
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
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-[#dbe3e8] bg-[#f8fafb] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={shell.badge}>
              <CalendarDays size={13} />
              Google Calendar
            </span>
            {calendarStatus?.connected && <span className="text-xs font-semibold text-[#2e6b5f]">연결됨</span>}
          </div>
          <p className="mt-2 text-sm leading-6 text-[#607080]">
            {!calendarStatus?.configured
              ? 'OAuth 환경 변수를 설정하면 RAAH 전용 캘린더를 연결할 수 있습니다.'
              : calendarStatus.connected
                ? `${getCalendarDisplayName(calendarStatus)}에서 오늘/이번 주 사역 일정을 읽어옵니다.`
                : '심방 일정과 사역 할 일을 Google Calendar에서 함께 관리할 수 있습니다.'}
          </p>
        </div>
        {!calendarStatus?.configured ? (
          <button type="button" disabled className={shell.ghostButton + ' shrink-0 opacity-60'} title="Google Calendar OAuth 환경 변수가 필요합니다.">
            설정 필요
          </button>
        ) : calendarStatus.connected ? (
          <button type="button" onClick={onSyncCalendar} disabled={isSaving} className={shell.ghostButton + ' shrink-0'}>
            동기화
          </button>
        ) : (
          <button type="button" onClick={onConnectCalendar} disabled={isSaving} className={shell.button + ' shrink-0'}>
            연결
          </button>
        )}
      </div>

      <div onWheel={handleCalendarWheel}>
        {viewMode === 'week' ? (
          <WeekScheduleGrid
            days={weekDays}
            rangeLabel={weekRange}
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

function SchedulePopupForm({
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

function WeekScheduleGrid({
  days,
  rangeLabel,
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
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#607080]">Weekly Care Calendar</p>
          <h3 className="mt-1 text-base font-semibold text-[#17202b]">이번 주 사역 일정</h3>
        </div>
        <p className="text-xl font-semibold tracking-tight text-[#17202b] sm:text-2xl">{rangeLabel}</p>
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
                  <div key={item.id} className="relative rounded-lg border border-[#dbe3e8] bg-white p-2 pr-24 shadow-[0_4px_14px_rgba(21,38,57,0.04)]">
                    <div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[#17202b]">{item.title}</p>
                        <p className="mt-1 text-[11px] text-[#607080]">
                          {item.startsAt || '시간 미정'}
                          {getScheduleMemberLabel(item) ? ` · ${getScheduleMemberLabel(item)}` : ''}
                        </p>
                      </div>
                      {onCopy && (
                        <button type="button" disabled={isSaving} onClick={() => onCopy(item)} title="복사" aria-label={`${item.title} 복사`} className="absolute right-16 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#d5dee5] text-[0px] text-[#2e6b5f] transition hover:bg-[#eef7f3] disabled:opacity-50">
                          <Copy size={12} strokeWidth={2.4} />
                          복사
                        </button>
                      )}
                      <button type="button" disabled={isSaving} onClick={() => onEdit(item)} title="수정" aria-label={`${item.title} 수정`} className="absolute right-9 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#d5dee5] text-[0px] text-[#2e6b5f] transition hover:bg-[#eef7f3] disabled:opacity-50">
                        <FileText size={12} strokeWidth={2.4} />
                        수정
                      </button>
                      <button type="button" disabled={isSaving} onClick={() => onComplete(item.id)} title="완료" aria-label={`${item.title} 완료`} className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#d5dee5] text-[0px] text-[#2e6b5f] transition hover:bg-[#eef7f3] disabled:opacity-50">
                        <CheckSquare size={12} strokeWidth={2.4} />
                        완료
                      </button>
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

function MonthScheduleGrid({
  days,
  rangeLabel,
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
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#607080]">Monthly Care Calendar</p>
          <h3 className="mt-1 text-base font-semibold text-[#17202b]">이번 달 사역 일정</h3>
        </div>
        <p className="text-xl font-semibold tracking-tight text-[#17202b] sm:text-2xl">{rangeLabel}</p>
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
                    <div key={item.id} className="relative rounded-lg border border-[#dbe3e8] bg-white p-2 pr-16 shadow-[0_4px_12px_rgba(21,38,57,0.04)]">
                      <div>
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-semibold text-[#17202b]">{item.title}</p>
                          <p className="mt-0.5 truncate text-[10px] text-[#607080]">
                            {item.startsAt || '시간 미정'}
                            {getScheduleMemberLabel(item) ? ` · ${getScheduleMemberLabel(item)}` : ''}
                          </p>
                        </div>
                        {onCopy && (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => onCopy(item)}
                            title="복사"
                            aria-label={`${item.title} 복사`}
                            className="absolute right-12 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#d5dee5] text-[0px] text-[#2e6b5f] transition hover:bg-[#eef7f3] disabled:opacity-50"
                          >
                            <Copy size={11} strokeWidth={2.4} />
                            복사
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => onEdit(item)}
                          title="수정"
                          aria-label={`${item.title} 수정`}
                          className="absolute right-7 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#d5dee5] text-[0px] text-[#2e6b5f] transition hover:bg-[#eef7f3] disabled:opacity-50"
                        >
                          <FileText size={11} strokeWidth={2.4} />
                          수정
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => onComplete(item.id)}
                          title="완료"
                          aria-label={`${item.title} 완료`}
                          className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#d5dee5] text-[0px] text-[#2e6b5f] transition hover:bg-[#eef7f3] disabled:opacity-50"
                        >
                          <CheckSquare size={11} strokeWidth={2.4} />
                          완료
                        </button>
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

function ScheduleColumn({ title, items, isSaving, onComplete }: { title: string; items: RaahMinistryScheduleItem[]; isSaving: boolean; onComplete: (itemId: string) => void }) {
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

function AttendanceSnapshot({
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

function AttendancePeopleList({ title, rows, empty }: { title: string; rows: ReturnType<typeof buildRaahAttendanceFlow>['rows']; empty: string }) {
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

function ProgressMetric({ label, value, width, helper }: { label: string; value: string; width: number; helper: string }) {
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

function StatusMetric({ label, value, tone, helper }: { label: string; value: string; tone: 'good' | 'alert' | 'neutral'; helper: string }) {
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

function MembersTab({
  members,
  selectedMember,
  selectedMemberLogs,
  selectedMemberAttendance,
  selectedMemberAttendanceHistory,
  attendanceDate,
  hasAttendanceEvent,
  onSelectMember,
  onEditMember,
  onNewMember,
  onNewLog,
  isFormOpen,
  isSaving,
  editing,
  form,
  setForm,
  onSubmit,
  onCloseForm,
}: {
  members: RaahMember[];
  selectedMember: RaahMember | null;
  selectedMemberLogs: RaahVisitationLog[];
  selectedMemberAttendance: RaahAttendanceRecord | null | undefined;
  selectedMemberAttendanceHistory: RaahAttendanceHistoryRecord[];
  attendanceDate: string;
  hasAttendanceEvent: boolean;
  onSelectMember: (id: string) => void;
  onEditMember: (member?: RaahMember) => void;
  onNewMember: () => void;
  onNewLog: (member: RaahMember) => void;
  isFormOpen: boolean;
  isSaving: boolean;
  editing: boolean;
  form: RaahMemberInput;
  setForm: React.Dispatch<React.SetStateAction<RaahMemberInput>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCloseForm: () => void;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(640px,1.25fr),minmax(420px,0.75fr)]">
      <div className={shell.panel + ' p-4'}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">성도 명부</h2>
          <button type="button" onClick={onNewMember} className={shell.button}>
            <Plus size={16} />
            등록
          </button>
        </div>
        <div className="mt-4 lg:hidden">
          {members.length === 0 ? (
            <EmptyState>조건에 맞는 성도가 없습니다.</EmptyState>
          ) : (
            members.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => onSelectMember(member.id)}
                className={`mb-2 w-full rounded-lg border px-4 py-3 text-left transition last:mb-0 ${
                  selectedMember?.id === member.id ? 'border-[#12345a] bg-[#12345a] text-white' : 'border-[#dbe3e8] bg-[#ffffff] hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{member.name}</p>
                    <p className={`mt-1 text-xs ${selectedMember?.id === member.id ? 'text-white/70' : 'text-[#607080]'}`}>
                    {[member.position, member.district, member.phone].filter(Boolean).join(' · ') || '기본 정보 미입력'}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${selectedMember?.id === member.id ? 'border-white/20 text-white/70' : 'border-[#dbe3e8] bg-[#ffffff] text-[#28415b]'}`}>
                    {member.status === 'active' ? '활성' : '비활성'}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="mt-4 hidden max-h-[calc(100vh-220px)] overflow-auto rounded-lg border border-[#dbe3e8] bg-[#ffffff] lg:block">
          {members.length === 0 ? (
            <EmptyState>조건에 맞는 성도가 없습니다.</EmptyState>
          ) : (
            <table className="w-full table-fixed border-collapse text-sm">
              <thead className="sticky top-0 bg-[#eef3f6] text-left text-xs font-semibold text-[#607080]">
                <tr>
                  <th className="w-[22%] px-3 py-2">이름</th>
                  <th className="w-[30%] px-3 py-2">직분 / 구역</th>
                  <th className="w-[28%] px-3 py-2">연락처</th>
                  <th className="w-[20%] px-3 py-2 text-right">상태</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const isSelected = selectedMember?.id === member.id;
                  return (
                    <tr
                      key={member.id}
                      onClick={() => onSelectMember(member.id)}
                      className={`cursor-pointer border-t border-[#e6edf2] transition ${isSelected ? 'bg-[#12345a] text-white' : 'hover:bg-[#f8fafb]'}`}
                    >
                      <td className="truncate px-3 py-2.5 font-semibold">{member.name}</td>
                      <td className={`truncate px-3 py-2.5 ${isSelected ? 'text-white/80' : 'text-[#28415b]'}`}>
                        {[member.position, member.district].filter(Boolean).join(' · ') || '직분/구역 미입력'}
                      </td>
                      <td className={`truncate px-3 py-2.5 ${isSelected ? 'text-white/70' : 'text-[#607080]'}`}>{member.phone || '-'}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${isSelected ? 'border-white/20 text-white/70' : 'border-[#dbe3e8] bg-[#ffffff] text-[#28415b]'}`}>
                          {member.status === 'active' ? '활성' : '비활성'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {isFormOpen ? (
          <MemberForm isSaving={isSaving} editing={editing} form={form} setForm={setForm} onSubmit={onSubmit} onClose={onCloseForm} />
        ) : selectedMember ? (
          <MemberHub
            member={selectedMember}
            logs={selectedMemberLogs}
            attendance={selectedMemberAttendance}
            attendanceHistory={selectedMemberAttendanceHistory}
            attendanceDate={attendanceDate}
            hasAttendanceEvent={hasAttendanceEvent}
            onEdit={() => onEditMember(selectedMember)}
            onNewLog={() => onNewLog(selectedMember)}
          />
        ) : (
          <div className={shell.panel + ' p-5'}>
            <EmptyState>성도를 선택하거나 새로 등록해 주세요.</EmptyState>
          </div>
        )}
      </div>
    </section>
  );
}

function MemberHub({
  member,
  logs,
  attendance,
  attendanceHistory,
  attendanceDate,
  hasAttendanceEvent,
  onEdit,
  onNewLog,
}: {
  member: RaahMember;
  logs: RaahVisitationLog[];
  attendance?: RaahAttendanceRecord | null;
  attendanceHistory: RaahAttendanceHistoryRecord[];
  attendanceDate: string;
  hasAttendanceEvent: boolean;
  onEdit: () => void;
  onNewLog: () => void;
}) {
  const weeklyAttendanceLabel = !hasAttendanceEvent ? '미체크' : attendance?.attended ? '출석' : '미출석';
  const weeklyAttendanceTone = !hasAttendanceEvent ? 'neutral' : attendance?.attended ? 'good' : 'alert';
  const communionLabel = !hasAttendanceEvent || !attendance?.attended ? '-' : attendance.communionParticipated ? '참여' : '미참여';
  const recentAttendance = attendanceHistory.slice(0, 6);

  return (
    <div className={shell.panel + ' p-5'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#607080]">성도 허브</p>
          <h2 className="mt-2 text-2xl font-semibold">{member.name}</h2>
          <p className="mt-1 text-sm text-[#607080]">{[member.position, member.district].filter(Boolean).join(' · ') || '직분/구역 미입력'}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onNewLog} className={shell.button}>
            <Plus size={16} />
            기록
          </button>
          <button type="button" onClick={onEdit} className={shell.ghostButton}>
            수정
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MiniCount label="심방/상담" value={logs.length} />
        <StatusMetric label="이번주 출석" value={weeklyAttendanceLabel} tone={weeklyAttendanceTone} helper={`${formatDisplayDate(attendanceDate)} 기준`} />
        <StatusMetric label="성찬" value={communionLabel} tone={attendance?.communionParticipated ? 'good' : 'neutral'} helper={hasAttendanceEvent ? '주일예배 기록' : '출석 미체크'} />
      </div>

      <div className="mt-5 rounded-lg border border-[#dbe3e8] bg-[#f8fafb] p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#17202b]">최근 출석 흐름</h3>
          <span className="text-xs font-semibold text-[#607080]">최근 {recentAttendance.length || 0}회</span>
        </div>
        {recentAttendance.length === 0 ? (
          <p className="mt-3 text-sm text-[#607080]">아직 누적된 출석 기록이 없습니다.</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {recentAttendance.map((record) => (
              <div key={`${record.date}-${record.memberId}`} className={`rounded-md border px-2 py-2 text-center ${record.attended ? 'border-[#2e6b5f] bg-[#eef3ec]' : 'border-[#dbe3e8] bg-[#ffffff]'}`}>
                <p className="text-[11px] font-semibold text-[#607080]">{record.date.slice(5).replace('-', '.')}</p>
                <p className={`mt-1 text-sm font-semibold ${record.attended ? 'text-[#12345a]' : 'text-[#8a5a4a]'}`}>{record.attended ? '출석' : '미출석'}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <DetailBlock label="연락처" value={member.phone || '-'} />
        <DetailBlock label="주소" value={member.address || '-'} />
        <div className="lg:col-span-2">
          <DetailBlock label="공개 메모" value={member.publicNote || '-'} />
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-[#17202b]">최근 기록</h3>
        <div className="mt-3 space-y-2">
          {logs.length === 0 ? <EmptyState>이 성도의 심방/상담 기록이 없습니다.</EmptyState> : logs.slice(0, 4).map((log) => <CompactLog key={log.id} log={log} />)}
        </div>
      </div>
    </div>
  );
}

function AttendanceTab({
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

function AttendanceFlowPanel({
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

function getAttendanceEventLabel(event: RaahAttendanceFlowEvent) {
  return ATTENDANCE_EVENT_OPTIONS.find((option) => option.type === event.eventType)?.label || event.serviceType || '기타';
}

function formatWeekLabel(weekStartDate: string) {
  return `${weekStartDate.slice(5).replace('-', '.')} 주간`;
}

function AttendanceStatusPill({ cell, compact }: { cell?: RaahAttendanceFlowCell; compact?: boolean }) {
  const base = compact ? 'min-w-10 px-2 py-1 text-[11px]' : 'min-w-12 px-2.5 py-1 text-xs';
  if (!cell || cell.attended === null) {
    return <span className={`inline-flex justify-center rounded-full border border-[#d5dee5] bg-[#f8fafb] font-semibold text-[#7a8b9a] ${base}`}>-</span>;
  }
  if (cell.attended) {
    return <span className={`inline-flex justify-center rounded-full border border-[#cfddd8] bg-[#eef7f3] font-semibold text-[#2e6b5f] ${base}`}>{cell.communionParticipated ? '성찬' : '출석'}</span>;
  }
  return <span className={`inline-flex justify-center rounded-full border border-[#e4c7b8] bg-[#fff6ef] font-semibold text-[#9a4b34] ${base}`}>결석</span>;
}

function VisitationTab({
  logs,
  selectedLog,
  selectedLogId,
  setSelectedLogId,
  clearDecrypted,
  isFormOpen,
  isSaving,
  members,
  form,
  setForm,
  editingLogId,
  rawAiMemo,
  setRawAiMemo,
  aiSuggestion,
  isAiDrafting,
  isDetailLoading,
  calendarStatus,
  calendarEventForm,
  setCalendarEventForm,
  isCalendarEventFormOpen,
  setIsCalendarEventFormOpen,
  onAiDraft,
  onSubmit,
  onCreateCalendarEvent,
  onOpenCalendarEvent,
  onEdit,
  onCloseForm,
  onNew,
  onMemberSelect,
}: {
  logs: RaahVisitationLog[];
  selectedLog: RaahVisitationLog | null;
  selectedLogId: string | null;
  setSelectedLogId: (id: string) => void;
  clearDecrypted: () => void;
  isFormOpen: boolean;
  isSaving: boolean;
  members: RaahMember[];
  form: RaahVisitationLogInput;
  setForm: React.Dispatch<React.SetStateAction<RaahVisitationLogInput>>;
  editingLogId: string | null;
  rawAiMemo: string;
  setRawAiMemo: (value: string) => void;
  aiSuggestion: string;
  isAiDrafting: boolean;
  isDetailLoading: boolean;
  calendarStatus: RaahCalendarStatus | null;
  calendarEventForm: RaahGoogleCalendarEventInput;
  setCalendarEventForm: React.Dispatch<React.SetStateAction<RaahGoogleCalendarEventInput>>;
  isCalendarEventFormOpen: boolean;
  setIsCalendarEventFormOpen: (value: boolean) => void;
  onAiDraft: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCreateCalendarEvent: (event: React.FormEvent<HTMLFormElement>) => void;
  onOpenCalendarEvent: (log: RaahVisitationLog) => void;
  onEdit: (log: RaahVisitationLog) => void;
  onCloseForm: () => void;
  onNew: () => void;
  onMemberSelect: (memberId: string) => void;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(320px,440px),minmax(0,1fr)] xl:grid-cols-[minmax(360px,480px),minmax(0,1fr)]">
      <div className={shell.panel + ' p-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-9rem)] lg:overflow-hidden'}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">심방/상담 기록</h2>
            <p className="mt-1 text-xs text-[#607080]">기록을 고르면 오른쪽에서 바로 확인합니다.</p>
          </div>
          <button type="button" onClick={onNew} className={shell.button + ' shrink-0'}>
            <Plus size={16} />
            새 기록
          </button>
        </div>
        <div className="mt-4 space-y-2 lg:max-h-[calc(100vh-15rem)] lg:overflow-y-auto lg:pr-1">
          {logs.length === 0 ? (
            <EmptyState>심방/상담 기록이 없습니다.</EmptyState>
          ) : (
            logs.map((log) => (
              <LogRow
                key={log.id}
                log={log}
                active={selectedLogId === log.id}
                onClick={() => {
                  setSelectedLogId(log.id);
                  clearDecrypted();
                }}
              />
            ))
          )}
        </div>
      </div>
      <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto">
        <LogPanel
          isOpen={isFormOpen}
          isSaving={isSaving}
          members={members}
          form={form}
          setForm={setForm}
          editingLogId={editingLogId}
          rawAiMemo={rawAiMemo}
          setRawAiMemo={setRawAiMemo}
          aiSuggestion={aiSuggestion}
          isAiDrafting={isAiDrafting}
          selectedLog={selectedLog}
          isDetailLoading={isDetailLoading}
          calendarStatus={calendarStatus}
          calendarEventForm={calendarEventForm}
          setCalendarEventForm={setCalendarEventForm}
          isCalendarEventFormOpen={isCalendarEventFormOpen}
          setIsCalendarEventFormOpen={setIsCalendarEventFormOpen}
          onAiDraft={onAiDraft}
          onSubmit={onSubmit}
          onCreateCalendarEvent={onCreateCalendarEvent}
          onOpenCalendarEvent={onOpenCalendarEvent}
          onEdit={onEdit}
          onClose={onCloseForm}
          onNew={onNew}
          onMemberSelect={onMemberSelect}
        />
      </div>
    </section>
  );
}

function LegacyTab({
  notes,
  selectedNote,
  selectedNoteId,
  setSelectedNoteId,
  clearDecrypted,
  isLoading,
  isFormOpen,
  isSaving,
  form,
  setForm,
  editing,
  onSubmit,
  onCloseForm,
  onNew,
  onEdit,
}: {
  notes: PastoralNote[];
  selectedNote: PastoralNote | null;
  selectedNoteId: string | null;
  setSelectedNoteId: (id: string) => void;
  clearDecrypted: () => void;
  isLoading: boolean;
  isFormOpen: boolean;
  isSaving: boolean;
  form: PastoralNoteInput;
  setForm: React.Dispatch<React.SetStateAction<PastoralNoteInput>>;
  editing: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCloseForm: () => void;
  onNew: () => void;
  onEdit: (note: PastoralNote) => void;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr),minmax(0,1.1fr)]">
      <div className={shell.panel + ' p-5'}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">기존 RAAH 기록</h2>
          <button type="button" onClick={onNew} className={shell.button}>
            <Plus size={16} />
            이전 양식
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {isLoading ? (
            <EmptyState>기존 기록을 불러오는 중입니다.</EmptyState>
          ) : notes.length === 0 ? (
            <EmptyState>기존 기록이 없습니다.</EmptyState>
          ) : (
            notes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => {
                  setSelectedNoteId(note.id);
                  clearDecrypted();
                }}
                className={`w-full rounded-lg border px-4 py-3 text-left transition ${selectedNoteId === note.id ? 'border-[#12345a] bg-[#12345a] text-white' : 'border-[#dbe3e8] bg-[#f8fafb] hover:bg-[#ffffff]'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{note.memberName}</p>
                    <p className={`mt-1 text-xs ${selectedNoteId === note.id ? 'text-white/70' : 'text-[#607080]'}`}>{formatDisplayDate(note.date)} · {note.meetingType}</p>
                  </div>
                  {note.isEncrypted && <Lock size={16} />}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      <LegacyPanel isOpen={isFormOpen} isSaving={isSaving} editing={editing} form={form} setForm={setForm} selectedNote={selectedNote} onSubmit={onSubmit} onClose={onCloseForm} onEdit={onEdit} />
    </section>
  );
}

function FocusCard({ label, value, helper, icon }: { label: string; value: number; helper?: string; icon: React.ReactNode }) {
  return (
    <div className={shell.panel + ' p-4'}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#607080]">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef7f3] text-[#2e6b5f]">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-[#17202b] sm:text-3xl">{value}</p>
      {helper && <p className="mt-1 text-xs text-[#607080]">{helper}</p>}
    </div>
  );
}

function MiniCount({ label, value }: { label: string; value: number }) {
  return (
    <div className={shell.mutedPanel + ' p-3'}>
      <p className="text-xs font-semibold text-[#607080]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#17202b]">{value}</p>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-[#ccd7df] bg-[#f8fafb] p-8 text-center text-sm text-[#607080]">{children}</p>;
}

function TextInput({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#607080]">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={shell.input} />
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 4, locked }: { label: string; value: string; onChange: (value: string) => void; rows?: number; locked?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#607080]">
        {locked && <Lock size={13} />}
        {label}
      </span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className={`${shell.input} leading-6`} />
    </label>
  );
}

function DetailBlock({ label, value, locked }: { label: string; value?: string; locked?: boolean }) {
  return (
    <div className={shell.mutedPanel + ' p-4'}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#607080]">
        {locked && <Lock size={13} />}
        {label}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#28415b]">{value?.trim() ? value : '-'}</p>
    </div>
  );
}

function BigToggle({ active, label, onClick, text, accent, disabled }: { active: boolean; label: string; onClick: () => void; text: string; accent?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-9 rounded-lg border px-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? (accent ? 'border-[#2e6b5f] bg-[#eef7f3] text-[#245b51]' : 'border-[#12345a] bg-[#12345a] text-white') : 'border-[#d5dee5] bg-white text-[#2e6b5f] hover:bg-[#f7faf9]'
      }`}
      aria-label={label}
    >
      {text}
    </button>
  );
}

function LogRow({ log, active, onClick }: { log: RaahVisitationLog; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-lg border px-3 py-3 text-left transition ${active ? 'border-[#12345a] bg-[#12345a] text-white shadow-[0_10px_24px_rgba(18,52,90,0.18)]' : 'border-[#dbe3e8] bg-[#f8fafb] hover:border-[#b7c6d2] hover:bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <UserRound size={15} className={active ? 'text-white/75' : 'text-[#2e6b5f]'} />
            <p className="truncate text-sm font-semibold">{log.memberName}</p>
            {log.isEncrypted && <Lock size={14} className={active ? 'text-white/75' : 'text-[#2e6b5f]'} />}
          </div>
          <div className={`mt-2 flex flex-wrap items-center gap-2 text-xs ${active ? 'text-white/75' : 'text-[#607080]'}`}>
            <CalendarDays size={14} />
            {formatDisplayDate(log.date)}
            <span className="rounded-full border px-2 py-0.5">{log.logType}</span>
          </div>
          <p className={`mt-2 line-clamp-2 text-xs leading-5 ${active ? 'text-white/90' : 'text-[#28415b]'}`}>{log.publicSummary || '민감 본문은 상세 보기에서만 복호화됩니다.'}</p>
        </div>
      </div>
    </button>
  );
}

function CompactLog({ log }: { log: RaahVisitationLog }) {
  return (
    <div className="rounded-lg border border-[#dbe3e8] bg-[#f8fafb] px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{log.logType}</span>
        <span className="text-xs text-[#607080]">{formatDisplayDate(log.date)}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-[#28415b]">{log.publicSummary || '공개 요약 없음'}</p>
    </div>
  );
}

function MemberForm({
  isSaving,
  editing,
  form,
  setForm,
  onSubmit,
  onClose,
}: {
  isSaving: boolean;
  editing: boolean;
  form: RaahMemberInput;
  setForm: React.Dispatch<React.SetStateAction<RaahMemberInput>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <div className={shell.panel + ' p-5'}>
      <h2 className="text-lg font-semibold">{editing ? '성도 정보 수정' : '성도 등록'}</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <TextInput label="이름" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput label="생년월일" type="date" value={form.birthDate || ''} onChange={(value) => setForm((prev) => ({ ...prev, birthDate: value }))} />
          <TextInput label="등록일" type="date" value={form.registeredAt || ''} onChange={(value) => setForm((prev) => ({ ...prev, registeredAt: value }))} />
        </div>
        <TextInput label="연락처" value={form.phone || ''} onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))} />
        <TextInput label="주소" value={form.address || ''} onChange={(value) => setForm((prev) => ({ ...prev, address: value }))} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput label="직분" value={form.position || ''} onChange={(value) => setForm((prev) => ({ ...prev, position: value }))} />
          <TextInput label="구역" value={form.district || ''} onChange={(value) => setForm((prev) => ({ ...prev, district: value }))} />
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#607080]">상태</span>
          <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as RaahMemberInput['status'] }))} className={shell.input}>
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
          </select>
        </label>
        <TextArea label="공개 메모" value={form.publicNote || ''} onChange={(value) => setForm((prev) => ({ ...prev, publicNote: value }))} rows={3} />
        <div className="flex gap-2">
          <button type="submit" disabled={isSaving} className={shell.button}>{isSaving ? '저장 중...' : '저장'}</button>
          <button type="button" onClick={onClose} className={shell.ghostButton}>닫기</button>
        </div>
      </form>
    </div>
  );
}

function LogPanel({
  isOpen,
  isSaving,
  members,
  form,
  setForm,
  editingLogId,
  rawAiMemo,
  setRawAiMemo,
  aiSuggestion,
  isAiDrafting,
  selectedLog,
  isDetailLoading,
  calendarStatus,
  calendarEventForm,
  setCalendarEventForm,
  isCalendarEventFormOpen,
  setIsCalendarEventFormOpen,
  onAiDraft,
  onSubmit,
  onCreateCalendarEvent,
  onOpenCalendarEvent,
  onEdit,
  onClose,
  onNew,
  onMemberSelect,
}: {
  isOpen: boolean;
  isSaving: boolean;
  members: RaahMember[];
  form: RaahVisitationLogInput;
  setForm: React.Dispatch<React.SetStateAction<RaahVisitationLogInput>>;
  editingLogId: string | null;
  rawAiMemo: string;
  setRawAiMemo: (value: string) => void;
  aiSuggestion: string;
  isAiDrafting: boolean;
  selectedLog: RaahVisitationLog | null;
  isDetailLoading: boolean;
  calendarStatus: RaahCalendarStatus | null;
  calendarEventForm: RaahGoogleCalendarEventInput;
  setCalendarEventForm: React.Dispatch<React.SetStateAction<RaahGoogleCalendarEventInput>>;
  isCalendarEventFormOpen: boolean;
  setIsCalendarEventFormOpen: (value: boolean) => void;
  onAiDraft: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCreateCalendarEvent: (event: React.FormEvent<HTMLFormElement>) => void;
  onOpenCalendarEvent: (log: RaahVisitationLog) => void;
  onEdit: (log: RaahVisitationLog) => void;
  onClose: () => void;
  onNew: () => void;
  onMemberSelect: (memberId: string) => void;
}) {
  return (
    <div className={shell.panel + ' p-5'}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isOpen ? (editingLogId ? '심방/상담 기록 수정' : '새 심방/상담 기록') : '기록 상세'}</h2>
        {!isOpen && <button type="button" onClick={onNew} className="text-sm font-semibold text-[#2e6b5f]">새 기록</button>}
      </div>
      {isOpen ? (
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className={shell.mutedPanel + ' px-4 py-3 text-sm leading-6 text-[#28415b]'}>
            <span className={shell.badge}><Lock size={12} />보안 저장</span>
            <p className="mt-2">민감 본문은 서버에서 암호화해 저장합니다.</p>
          </div>
          <div className="rounded-lg border border-[#dbe3e8] bg-[#f8fafb] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#17202b]">긴 메모 AI 정리</p>
                <p className="mt-1 text-xs leading-5 text-[#607080]">상담 후 남긴 긴 메모를 붙여넣으면 아래 기록 칸으로 나눠 초안을 만듭니다.</p>
              </div>
              <button type="button" onClick={onAiDraft} disabled={isAiDrafting || rawAiMemo.trim().length < 10} className={shell.button + ' shrink-0'}>
                <Sparkles size={16} />
                {isAiDrafting ? '정리 중...' : 'AI로 정리'}
              </button>
            </div>
            <textarea
              value={rawAiMemo}
              onChange={(event) => setRawAiMemo(event.target.value)}
              rows={5}
              className={`${shell.input} mt-3 leading-6`}
              placeholder="정리되지 않은 긴 메모를 여기에 붙여넣으세요. AI 결과는 바로 저장되지 않고, 아래 칸에 초안으로만 채워집니다."
            />
            {aiSuggestion && (
              <div className="mt-3 rounded-md border border-[#d5dee5] bg-[#ffffff] p-3 text-sm leading-6 text-[#28415b]">
                <span className={shell.badge}><Sparkles size={12} />AI 후속 제안</span>
                <p className="mt-2 whitespace-pre-wrap">{aiSuggestion}</p>
              </div>
            )}
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#607080]">성도 선택</span>
            <select value={form.memberId || ''} onChange={(event) => onMemberSelect(event.target.value)} className={shell.input}>
              <option value="">직접 입력</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </label>
          <TextInput label="성도 이름" value={form.memberName} onChange={(value) => setForm((prev) => ({ ...prev, memberName: value, memberId: '' }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="날짜" type="date" value={form.date} onChange={(value) => setForm((prev) => ({ ...prev, date: value }))} />
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#607080]">유형</span>
              <select value={form.logType} onChange={(event) => setForm((prev) => ({ ...prev, logType: event.target.value }))} className={shell.input}>
                {LOG_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
          </div>
          <TextArea label="공개 요약" value={form.publicSummary || ''} onChange={(value) => setForm((prev) => ({ ...prev, publicSummary: value }))} rows={3} />
          <TextArea label="내밀한 목양 기록" value={form.innerNote} onChange={(value) => setForm((prev) => ({ ...prev, innerNote: value }))} rows={5} locked />
          <TextArea label="기도 제목" value={form.prayerTopics} onChange={(value) => setForm((prev) => ({ ...prev, prayerTopics: value }))} rows={4} locked />
          <TextArea label="다음 단계" value={form.nextSteps || ''} onChange={(value) => setForm((prev) => ({ ...prev, nextSteps: value }))} rows={3} locked />
          <TextArea label="비공개 메모" value={form.privateRemarks || ''} onChange={(value) => setForm((prev) => ({ ...prev, privateRemarks: value }))} rows={3} locked />
          <div className="flex gap-2">
            <button type="submit" disabled={isSaving} className={shell.button}>{isSaving ? '저장 중...' : editingLogId ? '수정 저장' : '암호화 저장'}</button>
            <button type="button" onClick={onClose} className={shell.ghostButton}>닫기</button>
          </div>
        </form>
      ) : selectedLog ? (
        <div className="mt-4 space-y-4">
          <div className={shell.mutedPanel + ' p-5'}>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#607080]">
              <span className={shell.badge}>{selectedLog.logType}</span>
              <span>{formatDisplayDate(selectedLog.date)}</span>
              <span className={shell.badge}><Lock size={12} />암호화됨</span>
            </div>
            <h3 className="mt-4 text-2xl font-semibold">{selectedLog.memberName}</h3>
            <p className="mt-2 text-sm text-[#607080]">{selectedLog.publicSummary || '공개 요약 없음'}</p>
            <button type="button" onClick={() => onEdit(selectedLog)} disabled={isSaving || isDetailLoading} className={shell.ghostButton + ' mt-4'}>
              <FileText size={16} />
              수정
            </button>
          </div>
          <div className={shell.mutedPanel + ' p-4'}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#17202b]">캘린더 일정</p>
                <p className="mt-1 text-xs leading-5 text-[#607080]">
                  {calendarStatus?.connected ? '이 심방 기록을 바탕으로 Google Calendar에 후속 일정을 만듭니다.' : 'Google Calendar를 먼저 연결하면 기록에서 바로 일정을 만들 수 있습니다.'}
                </p>
              </div>
              <button
                type="button"
                disabled={!calendarStatus?.connected || isSaving}
                onClick={() => onOpenCalendarEvent(selectedLog)}
                className={shell.ghostButton + ' shrink-0'}
              >
                <CalendarDays size={16} />
                일정 만들기
              </button>
            </div>
            {isCalendarEventFormOpen && calendarStatus?.connected && (
              <form onSubmit={onCreateCalendarEvent} className="mt-4 grid gap-3 lg:grid-cols-[minmax(180px,1fr),150px,110px,110px]">
                <TextInput label="일정 제목" value={calendarEventForm.title} onChange={(value) => setCalendarEventForm((prev) => ({ ...prev, title: value }))} />
                <TextInput label="날짜" type="date" value={calendarEventForm.date} onChange={(value) => setCalendarEventForm((prev) => ({ ...prev, date: value }))} />
                <TextInput label="시작" type="time" value={calendarEventForm.startsAt} onChange={(value) => setCalendarEventForm((prev) => ({ ...prev, startsAt: value }))} />
                <TextInput label="종료" type="time" value={calendarEventForm.endsAt || ''} onChange={(value) => setCalendarEventForm((prev) => ({ ...prev, endsAt: value }))} />
                <div className="lg:col-span-4">
                  <TextArea label="메모" value={calendarEventForm.memo || ''} onChange={(value) => setCalendarEventForm((prev) => ({ ...prev, memo: value }))} rows={3} />
                </div>
                <div className="flex gap-2 lg:col-span-4">
                  <button type="submit" disabled={isSaving} className={shell.button}>Google Calendar에 저장</button>
                  <button type="button" onClick={() => setIsCalendarEventFormOpen(false)} className={shell.ghostButton}>닫기</button>
                </div>
              </form>
            )}
          </div>
          {isDetailLoading && <EmptyState>복호화하는 중입니다.</EmptyState>}
          <DetailBlock label="내밀한 목양 기록" value={selectedLog.innerNote} locked />
          <DetailBlock label="기도 제목" value={selectedLog.prayerTopics} locked />
          <DetailBlock label="다음 단계" value={selectedLog.nextSteps} locked />
          <DetailBlock label="비공개 메모" value={selectedLog.privateRemarks} locked />
        </div>
      ) : (
        <EmptyState>선택한 기록이 없습니다.</EmptyState>
      )}
    </div>
  );
}

function LegacyPanel({
  isOpen,
  isSaving,
  editing,
  form,
  setForm,
  selectedNote,
  onSubmit,
  onClose,
  onEdit,
}: {
  isOpen: boolean;
  isSaving: boolean;
  editing: boolean;
  form: PastoralNoteInput;
  setForm: React.Dispatch<React.SetStateAction<PastoralNoteInput>>;
  selectedNote: PastoralNote | null;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  onEdit: (note: PastoralNote) => void;
}) {
  return (
    <div className={shell.panel + ' p-5'}>
      <h2 className="text-lg font-semibold">{isOpen ? (editing ? '기존 RAAH 기록 수정' : '기존 RAAH 양식') : '기존 기록 상세'}</h2>
      {isOpen ? (
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <TextInput label="성도 이름" value={form.memberName} onChange={(value) => setForm((prev) => ({ ...prev, memberName: value }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="날짜" type="date" value={form.date} onChange={(value) => setForm((prev) => ({ ...prev, date: value }))} />
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#607080]">만남 유형</span>
              <select value={form.meetingType} onChange={(event) => setForm((prev) => ({ ...prev, meetingType: event.target.value }))} className={shell.input}>
                {PASTORAL_MEETING_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
          </div>
          <TextArea label="현재 상황" value={form.currentSituation} onChange={(value) => setForm((prev) => ({ ...prev, currentSituation: value }))} locked />
          <TextArea label="권면 내용" value={form.encouragement} onChange={(value) => setForm((prev) => ({ ...prev, encouragement: value }))} locked />
          <TextArea label="기도 제목" value={form.prayerTopics} onChange={(value) => setForm((prev) => ({ ...prev, prayerTopics: value }))} locked />
          <TextArea label="비고" value={form.remarks || ''} onChange={(value) => setForm((prev) => ({ ...prev, remarks: value }))} rows={3} locked />
          <div className="flex gap-2">
            <button type="submit" disabled={isSaving} className={shell.button}>{isSaving ? '저장 중...' : editing ? '수정 저장' : '저장'}</button>
            <button type="button" onClick={onClose} className={shell.ghostButton}>닫기</button>
          </div>
        </form>
      ) : selectedNote ? (
        <div className="mt-4 space-y-4">
          <div className={shell.mutedPanel + ' p-5'}>
            <p className="text-xs font-semibold text-[#607080]">{formatDisplayDate(selectedNote.date)} · {selectedNote.meetingType}</p>
            <h3 className="mt-3 text-2xl font-semibold">{selectedNote.memberName}</h3>
            <button type="button" onClick={() => onEdit(selectedNote)} disabled={isSaving} className={shell.ghostButton + ' mt-4'}>
              <FileText size={16} />
              수정
            </button>
          </div>
          <DetailBlock label="현재 상황" value={selectedNote.currentSituation} locked={selectedNote.isEncrypted} />
          <DetailBlock label="권면 내용" value={selectedNote.encouragement} locked={selectedNote.isEncrypted} />
          <DetailBlock label="기도 제목" value={selectedNote.prayerTopics} locked={selectedNote.isEncrypted} />
          <DetailBlock label="비고" value={selectedNote.remarks} locked={selectedNote.isEncrypted} />
        </div>
      ) : (
        <EmptyState>선택한 기존 기록이 없습니다.</EmptyState>
      )}
    </div>
  );
}
