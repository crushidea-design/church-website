// Legacy-note tab and edit panel extracted from AdminPastoralNotes.tsx.
import React from 'react';
import { FileText, Lock, Plus } from 'lucide-react';
import { PASTORAL_MEETING_TYPES, PastoralNote, PastoralNoteInput } from './types';
import { formatDisplayDate } from './utils';
import { shell } from './adminShell';
import { DetailBlock, EmptyState, TextArea, TextInput } from './AdminPrimitives';

export function LegacyTab({
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
  canEdit,
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
  canEdit: boolean;
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
      <LegacyPanel isOpen={isFormOpen} isSaving={isSaving} editing={editing} form={form} setForm={setForm} selectedNote={selectedNote} onSubmit={onSubmit} onClose={onCloseForm} onEdit={onEdit} canEdit={canEdit} />
    </section>
  );
}


export function LegacyPanel({
  isOpen,
  isSaving,
  editing,
  form,
  setForm,
  selectedNote,
  onSubmit,
  onClose,
  onEdit,
  canEdit,
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
  canEdit: boolean;
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
            {canEdit && <button type="button" onClick={() => onEdit(selectedNote)} disabled={isSaving} className={shell.ghostButton + ' mt-4'}>
              <FileText size={16} />
              수정
            </button>}
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
