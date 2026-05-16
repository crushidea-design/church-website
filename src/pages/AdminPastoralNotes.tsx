import React from 'react';
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckSquare,
  ClipboardList,
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
import { createRaahNote, getRaahNoteDetail, listRaahNotes } from '../features/pastoral-notes/api';
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
} from '../features/pastoral-notes/managementApi';
import { buildAttendanceRecordsForEvent, filterResolvedFollowUps, groupMinistryScheduleItems, selectAttendanceEvent } from '../features/pastoral-notes/raahWorkflow';
import { createPastoralNote, subscribePastoralNotes } from '../features/pastoral-notes/firestore';
import { PASTORAL_MEETING_TYPES, PastoralNote, PastoralNoteInput } from '../features/pastoral-notes/types';
import { createEmptyPastoralNoteInput, formatDisplayDate, normalizeMemberName, sortNotesByDate } from '../features/pastoral-notes/utils';
import { useAuth } from '../lib/auth';
import { logout, signInWithGoogle } from '../lib/firebase';

type StorageMode = 'loading' | 'supabase' | 'firestore';
type ActiveTab = 'dashboard' | 'members' | 'attendance' | 'visitation' | 'legacy';

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

const TEXT = {
  tabs: {
    dashboard: '홈',
    members: '성도',
    attendance: '출석',
    visitation: '기록',
    legacy: '이전',
  },
  search: {
    dashboard: '성도, 기록, 구역 검색',
    members: '이름, 구역, 직분, 연락처 검색',
    attendance: '출석 체크할 성도 검색',
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

function getWeekStartIso(dateIso: string) {
  const { year, month, day } = parseIsoDateParts(dateIso);
  const date = new Date(Date.UTC(year, month - 1, day));
  return addDaysIso(dateIso, -date.getUTCDay());
}

function getWeekCalendarDays(todayIso: string, items: RaahMinistryScheduleItem[]) {
  const weekStart = getWeekStartIso(todayIso);
  return WEEKDAY_LABELS.map((label, index) => {
    const dateIso = addDaysIso(weekStart, index);
    return {
      dateIso,
      label,
      items: items.filter((item) => item.date === dateIso),
      isToday: dateIso === todayIso,
    };
  });
}

function getAttendanceOption(type: RaahAttendanceEventType) {
  return ATTENDANCE_EVENT_OPTIONS.find((option) => option.type === type) || ATTENDANCE_EVENT_OPTIONS[0];
}

const emptyScheduleForm = (): RaahMinistryScheduleItemInput => ({
  title: '',
  date: getTodayIso(),
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
  const [isScheduleFormOpen, setIsScheduleFormOpen] = React.useState(false);
  const [calendarStatus, setCalendarStatus] = React.useState<RaahCalendarStatus | null>(null);
  const [calendarEventForm, setCalendarEventForm] = React.useState<RaahGoogleCalendarEventInput>(emptyCalendarEventForm);
  const [isCalendarEventFormOpen, setIsCalendarEventFormOpen] = React.useState(false);

  const [legacyForm, setLegacyForm] = React.useState<PastoralNoteInput>(createEmptyPastoralNoteInput);
  const [selectedLegacyNoteId, setSelectedLegacyNoteId] = React.useState<string | null>(null);
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
  const scheduleGroups = groupMinistryScheduleItems(ministryScheduleItems, getTodayIso());

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
    setDecryptedLog(null);
    setLogForm(emptyLogForm(member));
    setRawAiMemo('');
    setAiSuggestion('');
    setIsLogFormOpen(true);
    setActiveTab('visitation');
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
      const created = await createRaahVisitationLog(logForm, user);
      setIsLogFormOpen(false);
      setSelectedLogId(created.id);
      setDecryptedLog(created);
      setLogForm(emptyLogForm());
      setRawAiMemo('');
      setAiSuggestion('');
      toast.success('심방/상담 기록을 암호화해 저장했습니다.');
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

  const switchAttendanceEventType = (eventType: RaahAttendanceEventType) => {
    const nextAttendance = selectAttendanceEvent(attendanceEvents, eventType);
    const option = getAttendanceOption(eventType);
    setActiveAttendanceEventType(eventType);
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
      date: attendanceDate,
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
    if (calendarStatus?.connected && !scheduleForm.startsAt) {
      toast.error('Google Calendar에 넣으려면 시작 시간을 입력해 주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const input = {
        ...scheduleForm,
        title: scheduleForm.title.trim(),
        memberId: scheduleForm.memberId || selectedMember?.id || '',
        memberName: scheduleForm.memberName || selectedMember?.name || '',
      };
      const item =
        calendarStatus?.connected && input.startsAt
          ? await createRaahGoogleCalendarEvent(
              {
                ...input,
                startsAt: input.startsAt,
              },
              user
            )
          : await createRaahMinistryScheduleItem(input, user);
      setMinistryScheduleItems((prev) => [...prev, item]);
      setScheduleForm(emptyScheduleForm());
      setIsScheduleFormOpen(false);
      toast.success(calendarStatus?.connected ? 'Google Calendar와 RAAH에 사역 일정을 추가했습니다.' : '사역 일정을 추가했습니다.');
    } catch (error) {
      toast.error(getErrorMessage(error, '사역 일정을 추가하지 못했습니다.'));
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
        const created = await createRaahNote(legacyForm, user);
        setSelectedLegacyNoteId(created.id);
        setDecryptedLegacyNote(created);
        toast.success('기존 RAAH 기록을 Supabase에 암호화해 저장했습니다.');
        await loadLegacyNotes();
      }
      setIsLegacyFormOpen(false);
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
                pendingFollowUps={pendingFollowUps}
                scheduleGroups={scheduleGroups}
                scheduleForm={scheduleForm}
                setScheduleForm={setScheduleForm}
                isScheduleFormOpen={isScheduleFormOpen}
                setIsScheduleFormOpen={setIsScheduleFormOpen}
                calendarStatus={calendarStatus}
                isSaving={isSaving}
                onOpenAttendance={() => setActiveTab('attendance')}
                onOpenLog={(logId) => {
                  setSelectedLogId(logId);
                  setActiveTab('visitation');
                }}
                onResolveFollowUp={handleResolveFollowUp}
                onNewLog={() => openLogForm(selectedMember || undefined)}
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
                onCloseForm={() => {
                  setIsLogFormOpen(false);
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
                onSubmit={handleLegacySubmit}
                onCloseForm={() => setIsLegacyFormOpen(false)}
                onNew={() => setIsLegacyFormOpen(true)}
              />
            )}
          </div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#dbe3e8] bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(21,38,57,0.08)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 gap-1">
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

function DashboardTab({
  isLoading,
  summary,
  members,
  logs,
  attendanceDate,
  attendanceCount,
  communionCount,
  pendingFollowUps,
  scheduleGroups,
  scheduleForm,
  setScheduleForm,
  isScheduleFormOpen,
  setIsScheduleFormOpen,
  calendarStatus,
  isSaving,
  onOpenAttendance,
  onOpenLog,
  onResolveFollowUp,
  onNewLog,
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
  pendingFollowUps: RaahVisitationLog[];
  scheduleGroups: ReturnType<typeof groupMinistryScheduleItems>;
  scheduleForm: RaahMinistryScheduleItemInput;
  setScheduleForm: React.Dispatch<React.SetStateAction<RaahMinistryScheduleItemInput>>;
  isScheduleFormOpen: boolean;
  setIsScheduleFormOpen: (value: boolean) => void;
  calendarStatus: RaahCalendarStatus | null;
  isSaving: boolean;
  onOpenAttendance: () => void;
  onOpenLog: (logId: string) => void;
  onResolveFollowUp: (log: RaahVisitationLog) => void;
  onNewLog: () => void;
  onCreateScheduleItem: (event: React.FormEvent<HTMLFormElement>) => void;
  onCompleteScheduleItem: (itemId: string) => void;
  onConnectCalendar: () => void;
  onSyncCalendar: () => void;
}) {
  const activeMemberCount = summary.activeMemberCount || members.filter((member) => member.status === 'active').length;
  const absentCount = Math.max(activeMemberCount - attendanceCount, 0);
  const attendanceRate = percent(attendanceCount, activeMemberCount);
  const communionRate = percent(communionCount, attendanceCount);
  const dashboardSeason = getDashboardSeason();
  const attendanceTaskTitle = dashboardSeason === 'attendance' ? '주일 출석 체크' : dashboardSeason === 'follow-up' ? '출석 후속 확인' : '다가오는 주일 준비';
  const attendanceTaskCopy =
    dashboardSeason === 'attendance'
      ? '주일 이후 1-2일 안에 출석과 성찬 참여를 정리합니다.'
      : dashboardSeason === 'follow-up'
        ? '미출석 성도와 오랜만에 출석한 성도를 확인합니다.'
        : '다음 주일 출석 체크 전 명부와 예배 메모를 점검합니다.';

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
              <p className="mt-1 text-sm text-[#607080]">요일 흐름에 맞춰 우선순위를 바꿉니다.</p>
            </div>
            <button type="button" onClick={onNewLog} className={shell.button}>
              <Plus size={16} />
              기록
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={onOpenAttendance} className="rounded-lg border border-[#dbe3e8] bg-[#f8fafb] p-4 text-left transition hover:bg-[#ffffff]">
              <p className="text-sm font-semibold text-[#17202b]">{attendanceTaskTitle}</p>
              <p className="mt-2 text-sm text-[#607080]">{attendanceTaskCopy}</p>
            </button>
            <div className="rounded-lg border border-[#dbe3e8] bg-[#f8fafb] p-4">
              <p className="text-sm font-semibold text-[#17202b]">후속 확인</p>
              <p className="mt-2 text-sm text-[#607080]">{pendingFollowUps.length ? `${pendingFollowUps.length}건의 다음 단계가 있습니다.` : '남은 다음 단계가 없습니다.'}</p>
            </div>
          </div>
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
        groups={scheduleGroups}
        form={scheduleForm}
        setForm={setScheduleForm}
        isOpen={isScheduleFormOpen}
        setIsOpen={setIsScheduleFormOpen}
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
  groups,
  form,
  setForm,
  isOpen,
  setIsOpen,
  calendarStatus,
  isSaving,
  onSubmit,
  onComplete,
  onConnectCalendar,
  onSyncCalendar,
}: {
  groups: ReturnType<typeof groupMinistryScheduleItems>;
  form: RaahMinistryScheduleItemInput;
  setForm: React.Dispatch<React.SetStateAction<RaahMinistryScheduleItemInput>>;
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  calendarStatus: RaahCalendarStatus | null;
  isSaving: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onComplete: (itemId: string) => void;
  onConnectCalendar: () => void;
  onSyncCalendar: () => void;
}) {
  const items = [...groups.today, ...groups.thisWeek];
  const weekDays = getWeekCalendarDays(getTodayIso(), items);
  const weekRange = `${formatDisplayDate(weekDays[0]?.dateIso || getTodayIso())} - ${formatDisplayDate(weekDays[6]?.dateIso || getTodayIso())}`;
  return (
    <div className={shell.panel + ' p-5'}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">오늘/이번 주 사역 일정</h2>
          <p className="mt-1 text-sm text-[#607080]">심방 일정과 사역 할 일을 먼저 RAAH 안에서 정리합니다.</p>
        </div>
        <button type="button" onClick={() => setIsOpen(!isOpen)} className={isOpen ? shell.button : shell.ghostButton}>
          <Plus size={16} />
          일정
        </button>
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
        {calendarStatus?.configured ? (
          calendarStatus.connected ? (
            <button type="button" onClick={onSyncCalendar} disabled={isSaving} className={shell.ghostButton + ' shrink-0'}>
              동기화
            </button>
          ) : (
            <button type="button" onClick={onConnectCalendar} disabled={isSaving} className={shell.button + ' shrink-0'}>
              연결
            </button>
          )
        ) : null}
      </div>

      {isOpen && (
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 rounded-lg border border-[#dbe3e8] bg-[#f8fafb] p-3 lg:grid-cols-[minmax(160px,1fr),150px,110px,120px,minmax(160px,1fr),80px]">
          <TextInput label="제목" value={form.title} onChange={(value) => setForm((prev) => ({ ...prev, title: value }))} placeholder="심방, 연락, 설교 준비" />
          <TextInput label="날짜" type="date" value={form.date} onChange={(value) => setForm((prev) => ({ ...prev, date: value }))} />
          <TextInput label="시간" type="time" value={form.startsAt || ''} onChange={(value) => setForm((prev) => ({ ...prev, startsAt: value }))} />
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
          <button type="submit" disabled={isSaving} className={shell.button + ' self-end'}>
            저장
          </button>
        </form>
      )}

      <WeekScheduleGrid days={weekDays} rangeLabel={weekRange} isSaving={isSaving} onComplete={onComplete} />
      {items.length === 0 && <EmptyState>등록된 사역 일정이 없습니다.</EmptyState>}
    </div>
  );
}

function WeekScheduleGrid({
  days,
  rangeLabel,
  isSaving,
  onComplete,
}: {
  days: ReturnType<typeof getWeekCalendarDays>;
  rangeLabel: string;
  isSaving: boolean;
  onComplete: (itemId: string) => void;
}) {
  return (
    <div className="mt-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#607080]">Weekly Care Calendar</p>
          <h3 className="mt-1 text-base font-semibold text-[#17202b]">이번 주 사역 일정</h3>
        </div>
        <p className="text-xs font-medium text-[#607080]">{rangeLabel}</p>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-7">
        {days.map((day) => (
          <div
            key={day.dateIso}
            className={`min-h-[150px] rounded-xl border p-3 transition ${
              day.isToday ? 'border-[#2e6b5f] bg-[#eef7f3] shadow-[inset_0_0_0_1px_rgba(46,107,95,0.16)]' : 'border-[#dbe3e8] bg-[#f8fafb]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className={`text-sm font-semibold ${day.isToday ? 'text-[#245b51]' : 'text-[#17202b]'}`}>{day.label}</p>
                <p className="mt-0.5 text-xs text-[#607080]">{day.dateIso.slice(5).replace('-', '.')}</p>
              </div>
              {day.isToday && <span className="rounded-full bg-[#2e6b5f] px-2 py-0.5 text-[11px] font-semibold text-white">오늘</span>}
            </div>
            <div className="mt-3 space-y-2">
              {day.items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#ccd7df] bg-white/70 px-2 py-2 text-xs text-[#7a8b9a]">일정 없음</p>
              ) : (
                day.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-[#dbe3e8] bg-white p-2 shadow-[0_4px_14px_rgba(21,38,57,0.04)]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[#17202b]">{item.title}</p>
                        <p className="mt-1 text-[11px] text-[#607080]">
                          {item.startsAt || '시간 미정'}
                          {item.memberName ? ` · ${item.memberName}` : ''}
                        </p>
                      </div>
                      <button type="button" disabled={isSaving} onClick={() => onComplete(item.id)} className="rounded-md border border-[#d5dee5] px-2 py-1 text-[11px] font-semibold text-[#2e6b5f] transition hover:bg-[#eef7f3] disabled:opacity-50">
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
                  {formatDisplayDate(item.date)}
                  {item.startsAt ? ` · ${item.startsAt}` : ''}
                  {item.memberName ? ` · ${item.memberName}` : ''}
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
  onOpenAttendance,
}: {
  date: string;
  activeMemberCount: number;
  attendanceCount: number;
  communionCount: number;
  absentCount: number;
  attendanceRate: number;
  communionRate: number;
  onOpenAttendance: () => void;
}) {
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
  onEventTypeChange: (eventType: RaahAttendanceEventType) => void;
  date: string;
  setDate: (value: string) => void;
  serviceType: string;
  setServiceType: (value: string) => void;
  includesCommunion: boolean;
  setIncludesCommunion: (value: boolean) => void;
  memo: string;
  setMemo: (value: string) => void;
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
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(280px,360px),minmax(0,1fr)]">
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
    </section>
  );
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
  onCloseForm: () => void;
  onNew: () => void;
  onMemberSelect: (memberId: string) => void;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr),minmax(0,1.1fr)]">
      <div className={shell.panel + ' p-5'}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">심방/상담 기록</h2>
          <button type="button" onClick={onNew} className={shell.button}>
            <Plus size={16} />
            새 기록
          </button>
        </div>
        <div className="mt-4 space-y-2">
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
      <LogPanel
        isOpen={isFormOpen}
        isSaving={isSaving}
        members={members}
        form={form}
        setForm={setForm}
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
        onClose={onCloseForm}
        onNew={onNew}
        onMemberSelect={onMemberSelect}
      />
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
  onSubmit,
  onCloseForm,
  onNew,
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
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCloseForm: () => void;
  onNew: () => void;
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
      <LegacyPanel isOpen={isFormOpen} isSaving={isSaving} form={form} setForm={setForm} selectedNote={selectedNote} onSubmit={onSubmit} onClose={onCloseForm} />
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
    <button type="button" onClick={onClick} className={`w-full rounded-xl border px-4 py-3 text-left transition ${active ? 'border-[#12345a] bg-[#12345a] text-white shadow-[0_10px_24px_rgba(18,52,90,0.18)]' : 'border-[#dbe3e8] bg-[#f8fafb] hover:border-[#b7c6d2] hover:bg-white'}`}>
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
          <p className={`mt-2 line-clamp-2 text-sm leading-6 ${active ? 'text-white/90' : 'text-[#28415b]'}`}>{log.publicSummary || '민감 본문은 상세 보기에서만 복호화됩니다.'}</p>
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
  onClose,
  onNew,
  onMemberSelect,
}: {
  isOpen: boolean;
  isSaving: boolean;
  members: RaahMember[];
  form: RaahVisitationLogInput;
  setForm: React.Dispatch<React.SetStateAction<RaahVisitationLogInput>>;
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
  onClose: () => void;
  onNew: () => void;
  onMemberSelect: (memberId: string) => void;
}) {
  return (
    <div className={shell.panel + ' p-5'}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isOpen ? '새 심방/상담 기록' : '기록 상세'}</h2>
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
            <button type="submit" disabled={isSaving} className={shell.button}>{isSaving ? '저장 중...' : '암호화 저장'}</button>
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
  form,
  setForm,
  selectedNote,
  onSubmit,
  onClose,
}: {
  isOpen: boolean;
  isSaving: boolean;
  form: PastoralNoteInput;
  setForm: React.Dispatch<React.SetStateAction<PastoralNoteInput>>;
  selectedNote: PastoralNote | null;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <div className={shell.panel + ' p-5'}>
      <h2 className="text-lg font-semibold">{isOpen ? '기존 RAAH 양식' : '기존 기록 상세'}</h2>
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
          <div className="flex gap-2">
            <button type="submit" disabled={isSaving} className={shell.button}>{isSaving ? '저장 중...' : '저장'}</button>
            <button type="button" onClick={onClose} className={shell.ghostButton}>닫기</button>
          </div>
        </form>
      ) : selectedNote ? (
        <div className="mt-4 space-y-4">
          <div className={shell.mutedPanel + ' p-5'}>
            <p className="text-xs font-semibold text-[#607080]">{formatDisplayDate(selectedNote.date)} · {selectedNote.meetingType}</p>
            <h3 className="mt-3 text-2xl font-semibold">{selectedNote.memberName}</h3>
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
