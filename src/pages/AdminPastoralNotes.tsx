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
  ShieldCheck,
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
import { buildRaahAttendanceFlow, RaahAttendanceFlowEvent } from '../features/pastoral-notes/attendanceFlow';
import { createPastoralNote, subscribePastoralNotes } from '../features/pastoral-notes/firestore';
import { PastoralNote, PastoralNoteInput } from '../features/pastoral-notes/types';
import { createEmptyPastoralNoteInput, formatDisplayDate, normalizeMemberName, sortNotesByDate } from '../features/pastoral-notes/utils';
import {
  addDaysIso,
  emptyCalendarEventForm,
  emptyLogForm,
  emptyMemberForm,
  emptyScheduleForm,
  emptySummary,
  formatScheduleDateRange,
  getAttendanceOption,
  getDashboardSeason,
  getDateForAttendanceEventType,
  getDateSpanDays,
  getErrorMessage,
  getLatestSunday,
  getOpenScheduleItems,
  getScheduleMemberLabel,
  getTodayIso,
  isRaahSubdomain,
  percent,
} from '../features/pastoral-notes/adminHelpers';
import { shell } from '../features/pastoral-notes/adminShell';
import {
  EmptyState,
  FocusCard,
} from '../features/pastoral-notes/AdminPrimitives';
import {
  MinistrySchedulePanel,
  ScheduleTab,
} from '../features/pastoral-notes/AdminScheduleComponents';
import {
  AttendanceSnapshot,
  AttendanceTab,
  getAttendanceEventLabel,
} from '../features/pastoral-notes/AdminAttendanceComponents';
import {
  LogRow,
  VisitationTab,
} from '../features/pastoral-notes/AdminVisitationComponents';
import { LegacyTab } from '../features/pastoral-notes/AdminLegacyComponents';
import { MembersTab } from '../features/pastoral-notes/AdminMemberComponents';
import { useAuth } from '../lib/auth';
import { logout, signInWithGoogle } from '../lib/firebase';

type StorageMode = 'loading' | 'supabase' | 'firestore';
type ActiveTab = 'dashboard' | 'members' | 'attendance' | 'schedule' | 'visitation' | 'legacy';
type ScheduleViewMode = 'week' | 'month';

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
        const incomingIds = new Set(items.map((item) => item.id));
        const withoutSynced = prev.filter((item) => item.source !== 'google_calendar' && !incomingIds.has(item.id));
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
                canEdit={storageMode === 'supabase'}
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



