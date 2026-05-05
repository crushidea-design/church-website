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
  UserRound,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createRaahNote, getRaahNoteDetail, listRaahNotes } from '../features/pastoral-notes/api';
import {
  createRaahMember,
  createRaahVisitationLog,
  getRaahAttendance,
  getRaahDashboardSummary,
  getRaahVisitationLogDetail,
  listRaahMembers,
  listRaahVisitationLogs,
  RaahAttendanceEvent,
  RaahAttendanceInput,
  RaahAttendanceRecord,
  RaahDashboardSummary,
  RaahMember,
  RaahMemberInput,
  RaahVisitationLog,
  RaahVisitationLogInput,
  saveRaahAttendance,
  updateRaahMember,
} from '../features/pastoral-notes/managementApi';
import { createPastoralNote, subscribePastoralNotes } from '../features/pastoral-notes/firestore';
import { PASTORAL_MEETING_TYPES, PastoralNote, PastoralNoteInput } from '../features/pastoral-notes/types';
import { createEmptyPastoralNoteInput, formatDisplayDate, normalizeMemberName, sortNotesByDate } from '../features/pastoral-notes/utils';
import { useAuth } from '../lib/auth';
import { logout, signInWithGoogle } from '../lib/firebase';

type StorageMode = 'loading' | 'supabase' | 'firestore';
type ActiveTab = 'dashboard' | 'members' | 'attendance' | 'visitation' | 'legacy';

const LOG_TYPES = ['심방', '상담', '기도', '전화', '양육', '기타'];

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

const emptyLogForm: RaahVisitationLogInput = {
  memberId: '',
  memberName: '',
  date: new Date().toISOString().slice(0, 10),
  logType: LOG_TYPES[0],
  publicSummary: '',
  innerNote: '',
  prayerTopics: '',
  nextSteps: '',
  privateRemarks: '',
};

const shell = {
  page: 'min-h-screen bg-[#f4f1ea] text-[#202721]',
  panel: 'rounded-lg border border-[#d8d1c4] bg-[#fffdf8] shadow-sm',
  mutedPanel: 'rounded-lg border border-[#d8d1c4] bg-[#f8f5ee]',
  input:
    'w-full rounded-md border border-[#cfc8ba] bg-[#fffdf8] px-3 py-2.5 text-sm text-[#202721] outline-none transition focus:border-[#596850] focus:ring-2 focus:ring-[#596850]/15',
  button: 'inline-flex items-center justify-center gap-2 rounded-md bg-[#25352e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d2b25] disabled:cursor-not-allowed disabled:opacity-60',
  ghostButton:
    'inline-flex items-center justify-center gap-2 rounded-md border border-[#cfc8ba] bg-[#fffdf8] px-4 py-2.5 text-sm font-semibold text-[#39443d] transition hover:bg-[#f0ece2]',
  badge: 'inline-flex items-center gap-1.5 rounded-full border border-[#cfc8ba] bg-[#f8f5ee] px-2.5 py-1 text-xs font-semibold text-[#596850]',
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

function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#667264]">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={shell.input} />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  locked,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  locked?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#667264]">
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
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#667264]">
        {locked && <Lock size={13} />}
        {label}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#2f3731]">{value?.trim() ? value : '-'}</p>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className={shell.panel + ' p-4'}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#667264]">{label}</p>
        <span className="text-[#718069]">{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold text-[#202721]">{value}</p>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-[#cfc8ba] bg-[#f8f5ee] p-8 text-center text-sm text-[#667264]">{children}</p>;
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
  const [legacyNotes, setLegacyNotes] = React.useState<PastoralNote[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');

  const [memberForm, setMemberForm] = React.useState<RaahMemberInput>(emptyMemberForm);
  const [editingMemberId, setEditingMemberId] = React.useState<string | null>(null);
  const [isMemberFormOpen, setIsMemberFormOpen] = React.useState(false);

  const [logForm, setLogForm] = React.useState<RaahVisitationLogInput>(emptyLogForm);
  const [selectedLogId, setSelectedLogId] = React.useState<string | null>(null);
  const [decryptedLog, setDecryptedLog] = React.useState<RaahVisitationLog | null>(null);
  const [isLogFormOpen, setIsLogFormOpen] = React.useState(false);
  const [isDetailLoading, setIsDetailLoading] = React.useState(false);

  const [attendanceDate, setAttendanceDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [attendanceServiceType, setAttendanceServiceType] = React.useState('주일예배');
  const [attendanceIncludesCommunion, setAttendanceIncludesCommunion] = React.useState(true);
  const [attendanceMemo, setAttendanceMemo] = React.useState('');
  const [attendanceRecords, setAttendanceRecords] = React.useState<RaahAttendanceRecord[]>([]);

  const [legacyForm, setLegacyForm] = React.useState<PastoralNoteInput>(createEmptyPastoralNoteInput);
  const [selectedLegacyNoteId, setSelectedLegacyNoteId] = React.useState<string | null>(null);
  const [decryptedLegacyNote, setDecryptedLegacyNote] = React.useState<PastoralNote | null>(null);
  const [isLegacyFormOpen, setIsLegacyFormOpen] = React.useState(false);

  const buildAttendanceRecords = React.useCallback((nextMembers: RaahMember[], nextAttendance: RaahAttendanceEvent | null) => {
    const existingRecords = new Map((nextAttendance?.records || []).map((record) => [record.memberId, record]));
    return nextMembers
      .filter((member) => member.status === 'active')
      .map((member) => {
        const existing = existingRecords.get(member.id);
        return {
          id: existing?.id,
          memberId: member.id,
          memberName: member.name,
          memberSearchName: member.searchName,
          attended: existing?.attended || false,
          communionParticipated: existing?.communionParticipated || false,
          note: existing?.note || '',
        };
      });
  }, []);

  const loadManagementData = React.useCallback(async () => {
    if (!user) return;
    const [nextSummary, nextMembers, nextLogs] = await Promise.all([getRaahDashboardSummary(user), listRaahMembers(user), listRaahVisitationLogs(user)]);
    const nextAttendance = await getRaahAttendance(attendanceDate, user).catch(() => null);
    setSummary(nextSummary);
    setMembers(nextMembers);
    setLogs(nextLogs);
    setAttendance(nextAttendance);
    setAttendanceServiceType(nextAttendance?.serviceType || '주일예배');
    setAttendanceIncludesCommunion(nextAttendance?.includesCommunion ?? true);
    setAttendanceMemo(nextAttendance?.memo || '');
    setAttendanceRecords(buildAttendanceRecords(nextMembers, nextAttendance));
    setSelectedLogId((currentId) => (currentId && nextLogs.some((log) => log.id === currentId) ? currentId : nextLogs[0]?.id ?? null));
  }, [attendanceDate, buildAttendanceRecords, user]);

  const loadLegacyNotes = React.useCallback(async () => {
    if (!user) return [];
    const nextNotes = sortNotesByDate(await listRaahNotes(user));
    setLegacyNotes(nextNotes);
    setSelectedLegacyNoteId((currentId) => (currentId && nextNotes.some((note) => note.id === currentId) ? currentId : nextNotes[0]?.id ?? null));
    return nextNotes;
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
      let loadedLegacyNotes: PastoralNote[] = [];
      try {
        loadedLegacyNotes = await loadLegacyNotes();
        await loadManagementData();
        if (!cancelled) setStorageMode('supabase');
      } catch (error) {
        const apiError = error as { status?: number; code?: string };
        if (apiError.status === 503 || apiError.status === 404 || apiError.code === 'RAAH_SUPABASE_NOT_CONFIGURED') {
          if (loadedLegacyNotes.length > 0) {
            setStorageMode('supabase');
            toast.info('새 목양 관리 테이블 설정 전입니다. 기존 RAAH 기록은 Supabase에서 계속 표시합니다.');
          } else {
            setStorageMode('firestore');
            toast.info('Supabase 설정 전입니다. 기존 Firestore 호환 모드로 기록을 불러옵니다.');
            unsubscribe = subscribePastoralNotes(
              (nextNotes) => {
                if (cancelled) return;
                const sorted = sortNotesByDate(nextNotes);
                setLegacyNotes(sorted);
                setSelectedLegacyNoteId((currentId) => (currentId && sorted.some((note) => note.id === currentId) ? currentId : sorted[0]?.id ?? null));
              },
              (firestoreError) => {
                console.error('Error loading pastoral notes:', firestoreError);
                toast.error(getErrorMessage(firestoreError, '기존 RAAH 기록을 불러오지 못했습니다.'));
              }
            );
          }
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
  }, [authLoading, loadLegacyNotes, loadManagementData, role, user]);

  React.useEffect(() => {
    setDecryptedLog(null);
    if (!selectedLogId || !user || storageMode !== 'supabase') return;

    let cancelled = false;
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
    setDecryptedLegacyNote(null);
    if (!selectedLegacyNoteId || !user || storageMode !== 'supabase') return;

    let cancelled = false;
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
  const filteredMembers = members.filter((member) => [member.searchName, member.position, member.district, member.phone].join(' ').toLocaleLowerCase('ko-KR').includes(normalizedSearch));
  const filteredLogs = logs.filter((log) => [log.memberSearchName, log.logType, log.publicSummary].join(' ').toLocaleLowerCase('ko-KR').includes(normalizedSearch));
  const filteredAttendanceRecords = attendanceRecords.filter((record) => [record.memberSearchName, record.memberName, record.note].join(' ').toLocaleLowerCase('ko-KR').includes(normalizedSearch));
  const filteredLegacyNotes = legacyNotes.filter((note) => note.memberSearchName.includes(normalizedSearch));
  const attendanceCount = attendanceRecords.filter((record) => record.attended).length;
  const communionCount = attendanceRecords.filter((record) => record.communionParticipated).length;
  const selectedLog = decryptedLog?.id === selectedLogId ? decryptedLog : logs.find((log) => log.id === selectedLogId) ?? filteredLogs[0] ?? null;
  const selectedLegacyNote =
    decryptedLegacyNote?.id === selectedLegacyNoteId ? decryptedLegacyNote : legacyNotes.find((note) => note.id === selectedLegacyNoteId) ?? filteredLegacyNotes[0] ?? null;

  const refreshSupabase = async () => {
    if (!user || storageMode !== 'supabase') return;
    await Promise.all([loadManagementData(), loadLegacyNotes()]);
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

  const handleMemberSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || isSaving) return;
    if (!memberForm.name.trim()) {
      toast.error('성도 이름을 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingMemberId) {
        await updateRaahMember(editingMemberId, memberForm, user);
        toast.success('성도 정보를 수정했습니다.');
      } else {
        await createRaahMember(memberForm, user);
        toast.success('성도 명부에 등록했습니다.');
      }
      setIsMemberFormOpen(false);
      setEditingMemberId(null);
      setMemberForm(emptyMemberForm);
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

  const openLogForm = (member?: RaahMember) => {
    setDecryptedLog(null);
    setLogForm({ ...emptyLogForm, memberId: member?.id || '', memberName: member?.name || '' });
    setIsLogFormOpen(true);
    setActiveTab('visitation');
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
      setLogForm(emptyLogForm);
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

  const handleSaveAttendance = async () => {
    if (!user || isSaving) return;
    if (!attendanceDate || !attendanceServiceType.trim()) {
      toast.error('출석 날짜와 예배 유형을 입력해 주세요.');
      return;
    }

    const input: RaahAttendanceInput = {
      date: attendanceDate,
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
      setAttendanceRecords(buildAttendanceRecords(members, saved));
      toast.success('출석 체크를 저장했습니다.');
      await refreshSupabase();
    } catch (error) {
      toast.error(getErrorMessage(error, '출석 체크를 저장하지 못했습니다.'));
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
        await refreshSupabase();
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
      <div className="flex min-h-screen items-center justify-center bg-[#f4f1ea]">
        <p className="text-sm text-[#667264]">관리자 권한을 확인하는 중입니다.</p>
      </div>
    );
  }

  if (role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f1ea] px-4">
        <div className="w-full max-w-md rounded-lg border border-[#d8d1c4] bg-[#fffdf8] p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#25352e] text-white">
            <Lock size={22} />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-[#202721]">RAAH 관리자 전용</h2>
          <p className="mt-3 text-sm leading-6 text-[#667264]">목양 기록은 관리자 계정으로 로그인한 경우에만 열람할 수 있습니다.</p>
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
    { id: 'dashboard', label: '대시보드', icon: <BarChart3 size={17} /> },
    { id: 'members', label: '성도 명부', icon: <Users size={17} /> },
    { id: 'attendance', label: '출석 체크', icon: <CheckSquare size={17} /> },
    { id: 'visitation', label: '심방/상담', icon: <ClipboardList size={17} /> },
    { id: 'legacy', label: '기존 기록', icon: <FileText size={17} /> },
  ];

  return (
    <div className={shell.page}>
      <div className="min-h-screen lg:grid lg:grid-cols-[240px,minmax(0,1fr)]">
        <aside className="hidden border-r border-[#d8d1c4] bg-[#25352e] text-white lg:flex lg:flex-col">
          <div className="border-b border-white/10 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#d8d1c4] text-[#25352e]">
                <ShieldCheck size={22} />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-[0.16em]">RAAH</p>
                <p className="text-xs text-white/60">Pastoral Care</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 p-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setDecryptedLog(null);
                  setDecryptedLegacyNote(null);
                }}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition ${
                  activeTab === tab.id ? 'bg-[#f4f1ea] text-[#202721]' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="border-t border-white/10 p-4">
            <button type="button" onClick={() => logout()} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white">
              <LogOut size={17} />
              로그아웃
            </button>
          </div>
        </aside>

        <main className="min-w-0 pb-24 lg:pb-0">
          <header className="sticky top-0 z-20 border-b border-[#d8d1c4] bg-[#f4f1ea]/95 px-4 py-4 backdrop-blur lg:px-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                {!subdomainMode && (
                  <button type="button" onClick={() => navigate('/admin')} className="rounded-md border border-[#cfc8ba] bg-[#fffdf8] p-2 text-[#39443d]" aria-label="관리자 대시보드로 돌아가기">
                    <ArrowLeft size={18} />
                  </button>
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight text-[#202721]">RAAH 목양 관리</h1>
                    <span className={shell.badge}>
                      <Lock size={12} />
                      {storageMode === 'supabase' ? 'Supabase 암호화 저장' : storageMode === 'firestore' ? 'Firestore 호환' : '저장소 확인 중'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#667264]">성도 명부, 출석, 심방 기록을 한 곳에서 조용히 관리합니다.</p>
                </div>
              </div>
              <label className="relative w-full xl:w-80">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#718069]" />
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="이름, 구역, 유형 검색" className={`${shell.input} pl-9`} />
              </label>
            </div>
            <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
                    activeTab === tab.id ? 'bg-[#25352e] text-white' : 'border border-[#cfc8ba] bg-[#fffdf8] text-[#39443d]'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </header>

          <div className="space-y-6 px-4 py-6 lg:px-8">
            {activeTab === 'dashboard' && (
              <section className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
                  <StatCard label="전체 성도" value={summary.memberCount || members.length} icon={<Users size={20} />} />
                  <StatCard label="활성 성도" value={summary.activeMemberCount || members.filter((member) => member.status === 'active').length} icon={<UserRound size={20} />} />
                  <StatCard label="전체 기록" value={(summary.logCount || logs.length) + legacyNotes.length} icon={<ClipboardList size={20} />} />
                  <StatCard label="이번 주 기록" value={summary.thisWeekLogCount} icon={<CalendarDays size={20} />} />
                  <StatCard label="암호화 기록" value={(summary.encryptedLogCount || logs.filter((log) => log.isEncrypted).length) + legacyNotes.filter((note) => note.isEncrypted).length} icon={<Lock size={20} />} />
                  <StatCard label="이번 주 출석" value={summary.thisWeekAttendanceCount} icon={<CheckSquare size={20} />} />
                  <StatCard label="이번 주 성찬" value={summary.thisWeekCommunionCount} icon={<ShieldCheck size={20} />} />
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className={shell.panel + ' p-5'}>
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold">최근 심방/상담</h2>
                      <button type="button" onClick={() => openLogForm()} className={shell.button}>
                        <Plus size={15} /> 기록
                      </button>
                    </div>
                    <div className="mt-4 space-y-2">
                      {isLoading ? <EmptyState>RAAH 데이터를 불러오는 중입니다.</EmptyState> : logs.length === 0 ? <EmptyState>아직 새 심방/상담 기록이 없습니다.</EmptyState> : logs.slice(0, 5).map((log) => <LogListButton key={log.id} log={log} active={false} onClick={() => { setSelectedLogId(log.id); setActiveTab('visitation'); }} />)}
                    </div>
                  </div>
                  <div className={shell.panel + ' p-5'}>
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold">최근 성도</h2>
                      <button type="button" onClick={() => openMemberForm()} className={shell.button}>
                        <Plus size={15} /> 등록
                      </button>
                    </div>
                    <div className="mt-4 divide-y divide-[#e5ded1]">
                      {members.length === 0 ? (
                        <EmptyState>성도 명부가 비어 있습니다.</EmptyState>
                      ) : (
                        members.slice(0, 6).map((member) => (
                          <button key={member.id} type="button" onClick={() => openMemberForm(member)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                            <span>
                              <span className="block font-semibold">{member.name}</span>
                              <span className="mt-1 block text-xs text-[#667264]">{[member.position, member.district].filter(Boolean).join(' · ') || '기본 정보 미입력'}</span>
                            </span>
                            <span className={shell.badge}>{member.status === 'active' ? '활성' : '비활성'}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'members' && (
              <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr),380px]">
                <div className={shell.panel + ' p-5'}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">성도 명부</h2>
                    <button type="button" onClick={() => openMemberForm()} className={shell.button}>
                      <Plus size={16} /> 성도 등록
                    </button>
                  </div>
                  <ResponsiveTable
                    empty="조건에 맞는 성도가 없습니다."
                    headers={['이름', '직분', '구역', '연락처']}
                    rows={filteredMembers.map((member) => ({
                      id: member.id,
                      cells: [member.name, member.position || '-', member.district || '-', member.phone || '-'],
                      onClick: () => openMemberForm(member),
                    }))}
                  />
                </div>
                <MemberFormPanel
                  isOpen={isMemberFormOpen}
                  isSaving={isSaving}
                  editing={Boolean(editingMemberId)}
                  form={memberForm}
                  setForm={setMemberForm}
                  onSubmit={handleMemberSubmit}
                  onClose={() => setIsMemberFormOpen(false)}
                />
              </section>
            )}

            {activeTab === 'attendance' && (
              <section className="grid gap-4 xl:grid-cols-[320px,minmax(0,1fr)]">
                <div className={shell.panel + ' p-5'}>
                  <h2 className="text-lg font-semibold">출석 설정</h2>
                  <div className="mt-4 space-y-4">
                    <TextInput label="날짜" type="date" value={attendanceDate} onChange={setAttendanceDate} />
                    <TextInput label="예배 유형" value={attendanceServiceType} onChange={setAttendanceServiceType} placeholder="주일예배" />
                    <label className="flex items-center justify-between rounded-md border border-[#cfc8ba] bg-[#f8f5ee] px-3 py-2.5 text-sm font-semibold text-[#39443d]">
                      <span>성찬 체크 포함</span>
                      <input
                        type="checkbox"
                        checked={attendanceIncludesCommunion}
                        onChange={(event) => {
                          setAttendanceIncludesCommunion(event.target.checked);
                          if (!event.target.checked) setAttendanceRecords((prev) => prev.map((record) => ({ ...record, communionParticipated: false })));
                        }}
                        className="h-5 w-5 accent-[#25352e]"
                      />
                    </label>
                    <TextArea label="메모" value={attendanceMemo} onChange={setAttendanceMemo} rows={3} />
                    <div className="grid grid-cols-2 gap-3">
                      <MiniCount label="출석" value={attendanceCount} />
                      <MiniCount label="성찬" value={communionCount} />
                    </div>
                    <button type="button" onClick={handleSaveAttendance} disabled={isSaving || storageMode !== 'supabase'} className={shell.button + ' w-full'}>
                      <CheckSquare size={16} />
                      {isSaving ? '저장 중...' : '출석 저장'}
                    </button>
                    {attendance?.updatedAt && <p className="text-xs text-[#667264]">마지막 저장: {new Date(attendance.updatedAt).toLocaleString('ko-KR')}</p>}
                  </div>
                </div>
                <div className={shell.panel + ' p-5'}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">주일 출석 및 성찬 체크</h2>
                      <p className="mt-1 text-sm text-[#667264]">성도 명부의 활성 성도 기준으로 체크합니다.</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setAttendanceRecords((prev) => prev.map((record) => ({ ...record, attended: true })))} className={shell.ghostButton}>
                        전체 출석
                      </button>
                      <button type="button" onClick={() => setAttendanceRecords((prev) => prev.map((record) => ({ ...record, attended: false, communionParticipated: false })))} className={shell.ghostButton}>
                        전체 해제
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-lg border border-[#d8d1c4]">
                    <div className={`grid ${attendanceIncludesCommunion ? 'grid-cols-[1.3fr,78px,78px,1fr]' : 'grid-cols-[1.3fr,78px,1fr]'} bg-[#f8f5ee] px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#667264]`}>
                      <span>성도</span>
                      <span>출석</span>
                      {attendanceIncludesCommunion && <span>성찬</span>}
                      <span>메모</span>
                    </div>
                    {filteredAttendanceRecords.length === 0 ? (
                      <p className="p-8 text-center text-sm text-[#667264]">체크할 활성 성도가 없습니다.</p>
                    ) : (
                      filteredAttendanceRecords.map((record) => (
                        <div key={record.memberId} className={`grid ${attendanceIncludesCommunion ? 'grid-cols-[1.3fr,78px,78px,1fr]' : 'grid-cols-[1.3fr,78px,1fr]'} items-center gap-3 border-t border-[#e5ded1] px-4 py-3 text-sm`}>
                          <div>
                            <p className="font-semibold">{record.memberName}</p>
                            <p className="mt-1 text-xs text-[#667264]">{record.attended ? '출석' : '미체크'}{record.communionParticipated ? ' · 성찬' : ''}</p>
                          </div>
                          <IconToggle active={record.attended} label={`${record.memberName} 출석 체크`} onClick={() => toggleAttendance(record.memberId, 'attended')} icon={<CheckSquare size={18} />} />
                          {attendanceIncludesCommunion && <IconToggle active={record.communionParticipated} label={`${record.memberName} 성찬 체크`} onClick={() => toggleAttendance(record.memberId, 'communionParticipated')} icon={<ShieldCheck size={18} />} accent />}
                          <input value={record.note || ''} onChange={(event) => setAttendanceRecords((prev) => prev.map((row) => (row.memberId === record.memberId ? { ...row, note: event.target.value } : row)))} className={shell.input} placeholder="메모" />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'visitation' && (
              <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr),minmax(0,1.1fr)]">
                <div className={shell.panel + ' p-5'}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">심방/상담 기록</h2>
                    <button type="button" onClick={() => openLogForm()} className={shell.button}>
                      <Plus size={16} /> 새 기록
                    </button>
                  </div>
                  <div className="mt-4 space-y-2">{filteredLogs.length === 0 ? <EmptyState>심방/상담 기록이 없습니다.</EmptyState> : filteredLogs.map((log) => <LogListButton key={log.id} log={log} active={selectedLog?.id === log.id} onClick={() => { setSelectedLogId(log.id); setIsLogFormOpen(false); setDecryptedLog(null); }} />)}</div>
                </div>
                <LogDetailPanel
                  isOpen={isLogFormOpen}
                  isSaving={isSaving}
                  members={members}
                  form={logForm}
                  setForm={setLogForm}
                  selectedLog={selectedLog}
                  isDetailLoading={isDetailLoading}
                  onSubmit={handleLogSubmit}
                  onClose={() => setIsLogFormOpen(false)}
                  onNew={() => openLogForm()}
                  onMemberSelect={handleMemberSelectForLog}
                />
              </section>
            )}

            {activeTab === 'legacy' && (
              <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr),minmax(0,1.1fr)]">
                <div className={shell.panel + ' p-5'}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">기존 RAAH 기록</h2>
                    <button type="button" onClick={() => setIsLegacyFormOpen(true)} className={shell.button}>
                      <Plus size={16} /> 기존 양식 기록
                    </button>
                  </div>
                  <div className="mt-4 space-y-2">
                    {filteredLegacyNotes.length === 0 ? (
                      <EmptyState>기존 기록이 없습니다.</EmptyState>
                    ) : (
                      filteredLegacyNotes.map((note) => (
                        <button key={note.id} type="button" onClick={() => { setSelectedLegacyNoteId(note.id); setIsLegacyFormOpen(false); setDecryptedLegacyNote(null); }} className={`w-full rounded-lg border px-4 py-3 text-left transition ${selectedLegacyNote?.id === note.id ? 'border-[#25352e] bg-[#25352e] text-white' : 'border-[#d8d1c4] bg-[#f8f5ee] hover:bg-[#fffdf8]'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold">{note.memberName}</p>
                              <p className={`mt-1 text-xs ${selectedLegacyNote?.id === note.id ? 'text-white/70' : 'text-[#667264]'}`}>{formatDisplayDate(note.date)} · {note.meetingType}</p>
                            </div>
                            {note.isEncrypted && <Lock size={16} />}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <LegacyPanel
                  isOpen={isLegacyFormOpen}
                  isSaving={isSaving}
                  form={legacyForm}
                  setForm={setLegacyForm}
                  selectedNote={selectedLegacyNote}
                  onSubmit={handleLegacySubmit}
                  onClose={() => setIsLegacyFormOpen(false)}
                />
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function MiniCount({ label, value }: { label: string; value: number }) {
  return (
    <div className={shell.mutedPanel + ' p-4'}>
      <p className="text-xs font-semibold text-[#667264]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function IconToggle({ active, label, onClick, icon, accent }: { active: boolean; label: string; onClick: () => void; icon: React.ReactNode; accent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-md border transition ${
        active ? (accent ? 'border-[#718069] bg-[#e7eadf] text-[#25352e]' : 'border-[#25352e] bg-[#25352e] text-white') : 'border-[#cfc8ba] bg-[#fffdf8] text-[#718069] hover:bg-[#f0ece2]'
      }`}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

function ResponsiveTable({ headers, rows, empty }: { headers: string[]; rows: Array<{ id: string; cells: string[]; onClick: () => void }>; empty: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-[#d8d1c4]">
      <div className="hidden grid-cols-4 bg-[#f8f5ee] px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#667264] md:grid">
        {headers.map((header) => <span key={header}>{header}</span>)}
      </div>
      {rows.length === 0 ? (
        <p className="p-8 text-center text-sm text-[#667264]">{empty}</p>
      ) : (
        rows.map((row) => (
          <button key={row.id} type="button" onClick={row.onClick} className="grid w-full gap-2 border-t border-[#e5ded1] px-4 py-3 text-left text-sm transition hover:bg-[#f8f5ee] md:grid-cols-4">
            {row.cells.map((cell, index) => <span key={`${row.id}-${index}`} className={index === 0 ? 'font-semibold text-[#202721]' : 'text-[#4e5a51]'}>{cell}</span>)}
          </button>
        ))
      )}
    </div>
  );
}

function LogListButton({ log, active, onClick }: { log: RaahVisitationLog; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-lg border px-4 py-3 text-left transition ${active ? 'border-[#25352e] bg-[#25352e] text-white' : 'border-[#d8d1c4] bg-[#f8f5ee] hover:bg-[#fffdf8]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <UserRound size={15} className={active ? 'text-white/75' : 'text-[#718069]'} />
            <p className="truncate text-sm font-semibold">{log.memberName}</p>
            {log.isEncrypted && <Lock size={14} className={active ? 'text-white/75' : 'text-[#718069]'} />}
          </div>
          <div className={`mt-2 flex flex-wrap items-center gap-2 text-xs ${active ? 'text-white/75' : 'text-[#667264]'}`}>
            <CalendarDays size={14} />
            {formatDisplayDate(log.date)}
            <span className="rounded-full border px-2 py-0.5">{log.logType}</span>
          </div>
          <p className={`mt-2 line-clamp-2 text-sm leading-6 ${active ? 'text-white/90' : 'text-[#4e5a51]'}`}>{log.publicSummary || '민감 본문은 상세 보기에서만 복호화됩니다.'}</p>
        </div>
      </div>
    </button>
  );
}

function MemberFormPanel({
  isOpen,
  isSaving,
  editing,
  form,
  setForm,
  onSubmit,
  onClose,
}: {
  isOpen: boolean;
  isSaving: boolean;
  editing: boolean;
  form: RaahMemberInput;
  setForm: React.Dispatch<React.SetStateAction<RaahMemberInput>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <div className={shell.panel + ' p-5'}>
      <h2 className="text-lg font-semibold">{isOpen ? (editing ? '성도 정보 수정' : '성도 등록') : '성도 입력'}</h2>
      {isOpen ? (
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
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#667264]">상태</span>
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
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-[#cfc8ba] bg-[#f8f5ee] p-5 text-sm leading-6 text-[#667264]">성도를 선택하거나 새로 등록해 주세요. 내밀한 목양 기록은 심방/상담 기록에 암호화해 저장합니다.</p>
      )}
    </div>
  );
}

function LogDetailPanel({
  isOpen,
  isSaving,
  members,
  form,
  setForm,
  selectedLog,
  isDetailLoading,
  onSubmit,
  onClose,
  onNew,
  onMemberSelect,
}: {
  isOpen: boolean;
  isSaving: boolean;
  members: RaahMember[];
  form: RaahVisitationLogInput;
  setForm: React.Dispatch<React.SetStateAction<RaahVisitationLogInput>>;
  selectedLog: RaahVisitationLog | null;
  isDetailLoading: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  onNew: () => void;
  onMemberSelect: (memberId: string) => void;
}) {
  return (
    <div className={shell.panel + ' p-5'}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isOpen ? '새 심방/상담 기록' : '기록 상세'}</h2>
        {!isOpen && <button type="button" onClick={onNew} className="text-sm font-semibold text-[#596850]">새 기록</button>}
      </div>
      {isOpen ? (
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className={shell.mutedPanel + ' px-4 py-3 text-sm leading-6 text-[#4e5a51]'}>보안 저장이 켜져 있습니다. 민감 본문은 서버에서 암호화합니다.</div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#667264]">성도 선택</span>
            <select value={form.memberId || ''} onChange={(event) => onMemberSelect(event.target.value)} className={shell.input}>
              <option value="">직접 입력</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </label>
          <TextInput label="성도 이름" value={form.memberName} onChange={(value) => setForm((prev) => ({ ...prev, memberName: value, memberId: '' }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="날짜" type="date" value={form.date} onChange={(value) => setForm((prev) => ({ ...prev, date: value }))} />
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#667264]">유형</span>
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
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#667264]">
              <span className={shell.badge}>{selectedLog.logType}</span>
              <span>{formatDisplayDate(selectedLog.date)}</span>
              <span className={shell.badge}><Lock size={12} />암호화됨</span>
            </div>
            <h3 className="mt-4 text-2xl font-semibold">{selectedLog.memberName}</h3>
            <p className="mt-2 text-sm text-[#667264]">{selectedLog.publicSummary || '공개 요약 없음'}</p>
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
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[#667264]">만남 유형</span>
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
            <p className="text-xs font-semibold text-[#667264]">{formatDisplayDate(selectedNote.date)} · {selectedNote.meetingType}</p>
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
