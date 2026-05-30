// Member-domain components extracted from AdminPastoralNotes.tsx.
// MembersTab is the directory + edit panel; MemberHub is the side
// panel rendering the selected member's summary; MemberForm is the
// edit form. All take data and callbacks via props.
import React from 'react';
import { Plus } from 'lucide-react';
import {
  RaahAttendanceHistoryRecord,
  RaahAttendanceRecord,
  RaahMember,
  RaahMemberInput,
  RaahVisitationLog,
} from './managementApi';
import { formatDisplayDate } from './utils';
import { shell } from './adminShell';
import { DetailBlock, EmptyState, MiniCount, TextArea, TextInput } from './AdminPrimitives';
import { StatusMetric } from './AdminAttendanceComponents';
import { CompactLog } from './AdminVisitationComponents';

export function MembersTab({
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

export function MemberHub({
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

