// Visitation-domain components extracted from AdminPastoralNotes.tsx.
// VisitationTab is the full record-keeping tab; LogPanel renders the
// editor; LogRow / CompactLog are compact list rows reused by the
// dashboard, member hub, and visitation tab.
import React from 'react';
import { CalendarDays, FileText, Lock, Plus, Sparkles, UserRound } from 'lucide-react';
import {
  RaahCalendarStatus,
  RaahGoogleCalendarEventInput,
  RaahMember,
  RaahVisitationLog,
  RaahVisitationLogInput,
} from './managementApi';
import { formatDisplayDate } from './utils';
import { shell } from './adminShell';
import { DetailBlock, EmptyState, TextArea, TextInput } from './AdminPrimitives';
import { LOG_TYPES } from './adminHelpers';

export function VisitationTab({
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

export function LogRow({ log, active, onClick }: { log: RaahVisitationLog; active: boolean; onClick: () => void }) {
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

export function CompactLog({ log }: { log: RaahVisitationLog }) {
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


export function LogPanel({
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

