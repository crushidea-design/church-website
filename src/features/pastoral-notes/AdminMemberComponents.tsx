// Member-domain components extracted from AdminPastoralNotes.tsx.
// MembersTab is the directory + edit panel; MemberHub is the side
// panel rendering the selected member's summary; MemberForm is the
// edit form. All take data and callbacks via props.
import React from 'react';
import { Plus, Phone, Search, X } from 'lucide-react';
import {
  RaahAttendanceHistoryRecord,
  RaahAttendanceRecord,
  RaahMember,
  RaahMemberInput,
  RaahVisitationLog,
} from './managementApi';
import { formatDisplayDate } from './utils';
import { shell } from './adminShell';
import { getAttendanceOption } from './adminHelpers';
import { DetailBlock, EmptyState, MiniCount, TextArea, TextInput } from './AdminPrimitives';
import { StatusMetric } from './AdminAttendanceComponents';
import { CompactLog } from './AdminVisitationComponents';

export function MembersTab({
  members,
  search,
  onSearch,
  logs,
  attendanceHistory,
  onNewSchedule,
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
  search: string;
  onSearch: (value: string) => void;
  logs: RaahVisitationLog[];
  attendanceHistory: RaahAttendanceHistoryRecord[];
  onNewSchedule: (member: RaahMember) => void;
  selectedMember: RaahMember | null;
  selectedMemberLogs: RaahVisitationLog[];
  selectedMemberAttendance: RaahAttendanceRecord | null | undefined;
  selectedMemberAttendanceHistory: RaahAttendanceHistoryRecord[];
  attendanceDate: string;
  hasAttendanceEvent: boolean;
  onSelectMember: (id: string | null) => void;
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
  const [isDesktop, setIsDesktop] = React.useState(() => window.matchMedia('(min-width: 1280px)').matches);
  React.useEffect(() => {
    const media = window.matchMedia('(min-width: 1280px)');
    const update = () => setIsDesktop(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const [status, setStatus] = React.useState('active');
  const [district, setDistrict] = React.useState('');
  const [sort, setSort] = React.useState('name');
  const panelRef = React.useRef<HTMLElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const isPanelOpen = Boolean(selectedMember || isFormOpen);
  const closePanel = () => { onCloseForm(); onSelectMember(null); };
  React.useEffect(() => {
    if (!isPanelOpen || isDesktop) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, textarea') || []);
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trapFocus);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', trapFocus); previous?.focus({ preventScroll: true }); };
  }, [isPanelOpen, isDesktop]);
  const districts = [...new Set(members.map((member) => member.district).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'ko'));
  const sundayHistory = attendanceHistory.filter((record) => !record.eventType || record.eventType === 'sunday_morning');
  const latestDate = sundayHistory.reduce((date, record) => record.date > date ? record.date : date, '');
  const rows = members.map((member) => ({
    member,
    attendance: sundayHistory.find((record) => record.memberId === member.id && record.date === latestDate),
    visit: logs.filter((log) => log.memberId === member.id || (!log.memberId && log.memberSearchName === member.searchName)).sort((a, b) => b.date.localeCompare(a.date))[0],
  })).filter(({ member }) => {
    const text = [member.name, member.position, member.district, member.phone].join('').replace(/\s/g, '').toLocaleLowerCase('ko-KR');
    return (status === 'all' || member.status === status) && (!district || member.district === district) && text.includes(search.replace(/\s/g, '').toLocaleLowerCase('ko-KR'));
  }).sort((a, b) => {
    if (sort === 'absence') {
      const difference = Number(b.attendance?.attended === false) - Number(a.attendance?.attended === false);
      if (difference) return difference;
    }
    if (sort === 'visit') {
      const difference = (a.visit?.date || '').localeCompare(b.visit?.date || '');
      if (difference) return difference;
    }
    return a.member.name.localeCompare(b.member.name, 'ko');
  });
  const attendanceLabel = (record?: RaahAttendanceHistoryRecord) => record ? record.attended ? '출석' : '결석' : '미기록';
  return (
    <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div inert={isPanelOpen && !isDesktop ? true : undefined} className={shell.panel + ' min-w-0 p-4'}>
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold">성도 명부</h2><p className="mt-1 text-xs text-[#607080]">{rows.length}명 표시 · 전체 {members.length}명</p></div>
          <button type="button" onClick={onNewMember} className={shell.button}><Plus size={16} />등록</button>
        </div>
        <div className="mt-4 space-y-2">
          <label className="relative block"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#607080]" /><input aria-label="성도 검색" placeholder="이름, 구역, 직분, 연락처 검색" value={search} onChange={(event) => onSearch(event.target.value)} className={shell.input + ' pl-9'} /></label>
          <div className="grid gap-2 sm:grid-cols-3">
            <select aria-label="성도 상태" value={status} onChange={(event) => setStatus(event.target.value)} className={shell.input}><option value="active">활성 성도</option><option value="inactive">비활성 성도</option><option value="all">전체 성도</option></select>
            <select aria-label="구역 선택" value={district} onChange={(event) => setDistrict(event.target.value)} className={shell.input}><option value="">전체 구역</option>{districts.map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <select aria-label="명부 정렬" value={sort} onChange={(event) => setSort(event.target.value)} className={shell.input}><option value="name">가나다순</option><option value="absence">최근 결석 우선</option><option value="visit">심방 오래된 순</option></select>
          </div>
        </div>
        <p className="my-3 text-xs text-[#607080]">최근 출석: {latestDate ? `${formatDisplayDate(latestDate)} 주일 오전 기준` : '미기록'} · 심방 미기록은 오래된 순에서 먼저 표시합니다.</p>
        {rows.length === 0 ? <EmptyState>조건에 맞는 성도가 없습니다.</EmptyState> : <div className="overflow-x-auto rounded-lg border border-[#dbe3e8]">
          <div className="divide-y divide-[#e6edf2] md:hidden">{rows.map(({ member, attendance: record, visit }) => <div key={member.id} className={`p-3 ${selectedMember?.id === member.id ? 'bg-[#e8f2ef]' : ''}`}>
            <div className="flex items-center justify-between gap-2"><button type="button" aria-pressed={selectedMember?.id === member.id} onClick={() => { onCloseForm(); onSelectMember(member.id); }} className="font-semibold text-[#12345a] underline underline-offset-4">{member.name}</button>{member.phone && <a href={`tel:${member.phone}`} aria-label={`${member.name} 전화`} className="p-2 text-[#2e6b5f]"><Phone size={16} /></a>}</div>
            <p className="mt-1 text-xs text-[#607080]">{[member.district, member.position, member.status === 'inactive' ? '비활성' : ''].filter(Boolean).join(' · ') || '구역·직분 미등록'}</p>
            <p className="mt-2 text-xs"><span className={record?.attended === false ? 'font-semibold text-[#9a4d35]' : 'text-[#2e6b5f]'}>최근 출석 {attendanceLabel(record)}</span><span className="ml-3 text-[#607080]">최근 심방 {visit ? formatDisplayDate(visit.date) : '미기록'}</span></p>
          </div>)}</div>
          <table className="hidden w-full min-w-[530px] md:table border-collapse text-sm">
            <thead className="bg-[#eef3f6] text-left text-xs text-[#607080]"><tr>{['이름', '구역', '직분·신급', '최근 출석', '최근 심방'].map((label) => <th key={label} className="px-2 py-3">{label}</th>)}</tr></thead>
            <tbody>{rows.map(({ member, attendance: record, visit }) => <tr key={member.id} className={`border-t border-[#e6edf2] ${selectedMember?.id === member.id ? 'bg-[#e8f2ef]' : 'hover:bg-[#f8fafb]'}`}>
              <th scope="row" className="px-2 py-3 text-left"><div className="flex items-center gap-2"><button type="button" aria-pressed={selectedMember?.id === member.id} onClick={() => { onCloseForm(); onSelectMember(member.id); }} className="whitespace-nowrap font-semibold text-[#12345a] underline decoration-[#b8ccc8] underline-offset-4">{member.name}</button>{member.phone && <a href={`tel:${member.phone}`} aria-label={`${member.name} 전화`} className="p-1 text-[#2e6b5f]"><Phone size={14} /></a>}</div>{member.status === 'inactive' && <span className="text-xs font-normal text-[#607080]">비활성</span>}</th>
              <td className="px-2 py-3 text-xs">{member.district || '미등록'}</td><td className="max-w-36 px-2 py-3 text-xs">{member.position || '미등록'}</td>
              <td className="whitespace-nowrap px-2 py-3"><span className={`rounded px-2 py-1 text-xs font-semibold ${!record ? 'bg-[#f3f6f8] text-[#607080]' : record.attended ? 'bg-[#e1efe9] text-[#2e6b5f]' : 'bg-[#fbe8df] text-[#9a4d35]'}`}>{attendanceLabel(record)}</span></td>
              <td className="whitespace-nowrap px-2 py-3 text-xs text-[#607080]">{visit ? formatDisplayDate(visit.date) : '미기록'}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </div>
      <aside ref={panelRef} role={!isDesktop && isPanelOpen ? 'dialog' : undefined} aria-modal={!isDesktop && isPanelOpen ? true : undefined} aria-label="성도 상세" onKeyDown={(event) => { if (event.key === 'Escape') closePanel(); }} className={isPanelOpen ? 'fixed inset-0 z-50 overflow-y-auto bg-[#f3f6f8] p-4 xl:sticky xl:top-4 xl:z-auto xl:overflow-visible xl:bg-transparent xl:p-0' : 'hidden xl:block'}>
        {isPanelOpen ? <><div className="mb-3 flex justify-end"><button ref={closeRef} type="button" onClick={closePanel} className={shell.ghostButton}><X size={16} />닫기</button></div>
          {isFormOpen ? <MemberForm isSaving={isSaving} editing={editing} form={form} setForm={setForm} onSubmit={onSubmit} onClose={onCloseForm} /> : selectedMember && <MemberHub member={selectedMember} logs={[...selectedMemberLogs].sort((a, b) => b.date.localeCompare(a.date))} attendance={selectedMemberAttendance} attendanceHistory={selectedMemberAttendanceHistory} attendanceDate={attendanceDate} hasAttendanceEvent={hasAttendanceEvent} onEdit={() => onEditMember(selectedMember)} onNewLog={() => onNewLog(selectedMember)} onNewSchedule={() => onNewSchedule(selectedMember)} />}
        </> : <div className={shell.panel + ' p-6 text-sm text-[#607080]'}>성도 이름을 누르면 이곳에서 정보와 기록을 확인할 수 있습니다.</div>}
      </aside>
    </section>
  );
}

export function MemberHub({
  member,
  logs,
  attendance,
  attendanceHistory,
  attendanceDate,
  hasAttendanceEvent,
  onEdit,
  onNewLog,
  onNewSchedule,
}: {
  member: RaahMember;
  logs: RaahVisitationLog[];
  attendance?: RaahAttendanceRecord | null;
  attendanceHistory: RaahAttendanceHistoryRecord[];
  attendanceDate: string;
  hasAttendanceEvent: boolean;
  onEdit: () => void;
  onNewLog: () => void;
  onNewSchedule: () => void;
}) {
  const weeklyAttendanceLabel = !hasAttendanceEvent || !attendance ? '미기록' : attendance?.attended ? '출석' : '미출석';
  const weeklyAttendanceTone = !hasAttendanceEvent || !attendance ? 'neutral' : attendance?.attended ? 'good' : 'alert';
  const communionLabel = !hasAttendanceEvent || !attendance?.attended ? '-' : attendance.communionParticipated ? '참여' : '미참여';
  const recentAttendance = attendanceHistory.slice(0, 6);

  return (
    <div className={shell.panel + ' p-5'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#607080]">성도 상세</p>
          <h2 className="mt-2 text-2xl font-semibold">{member.name}</h2>
          <p className="mt-1 text-sm text-[#607080]">{[member.position, member.district].filter(Boolean).join(' · ') || '직분/구역 미입력'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onNewLog} className={shell.button}>
            <Plus size={16} />
            심방 기록
          </button>
          <button type="button" onClick={onEdit} className={shell.ghostButton}>
            정보 수정
          </button>
        </div>
      </div>

      <button type="button" onClick={onNewSchedule} className={shell.ghostButton + ' mt-3 w-full'}>일정 등록</button>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <MiniCount label="심방/상담" value={logs.length} />
        <StatusMetric label="선택일 출석" value={weeklyAttendanceLabel} tone={weeklyAttendanceTone} helper={`${formatDisplayDate(attendanceDate)} 기준`} />
        <StatusMetric label="성찬" value={communionLabel} tone={attendance?.communionParticipated ? 'good' : 'neutral'} helper={hasAttendanceEvent ? '선택한 예배 기록' : '출석 미기록'} />
      </div>

      <div className="mt-5 rounded-lg border border-[#dbe3e8] bg-[#f8fafb] p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#17202b]">최근 출석 흐름</h3>
          <span className="text-xs font-semibold text-[#607080]">최근 {recentAttendance.length || 0}회</span>
        </div>
        {recentAttendance.length === 0 ? (
          <p className="mt-3 text-sm text-[#607080]">아직 누적된 출석 기록이 없습니다.</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {recentAttendance.map((record) => (
              <div key={`${record.date}-${record.eventType || 'sunday_morning'}-${record.memberId}`} className={`rounded-md border px-2 py-2 text-center ${record.attended ? 'border-[#2e6b5f] bg-[#eef3ec]' : 'border-[#dbe3e8] bg-[#ffffff]'}`}>
                <p className="text-[11px] font-semibold text-[#607080]">{record.date.slice(5).replace('-', '.')}</p>
                <p className="mt-1 text-[10px] text-[#607080]">{record.serviceType || getAttendanceOption(record.eventType || 'sunday_morning').label}</p>
                <p className={`mt-1 text-sm font-semibold ${record.attended ? 'text-[#12345a]' : 'text-[#8a5a4a]'}`}>{record.attended ? '출석' : '미출석'}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <DetailBlock label="상태" value={member.status === 'active' ? '활성' : '비활성'} />
        <DetailBlock label="생년월일" value={member.birthDate || '미등록'} />
        <DetailBlock label="등록일" value={member.registeredAt || '미등록'} />
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



export function MemberForm({
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
    <div className="mt-4 rounded-md border border-[#dbe3e8] bg-[#f8fafb] p-4">
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
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={isSaving} className={shell.button}>{isSaving ? '저장 중...' : '저장'}</button>
          <button type="button" onClick={onClose} className={shell.ghostButton}>닫기</button>
        </div>
      </form>
    </div>
  );
}
