import React, { useEffect, useMemo, useState } from 'react';
import { deleteCurriculumEntry, saveCurriculumEntry } from '../api';
import { HEIDELBERG_LORDS_DAYS } from '../heidelberg';
import { findTermForDate } from '../schedule';
import type { CurriculumEntry, CurriculumEntryKind, SchoolTerm } from '../types';
import { toLocalDateKey } from '../../../lib/nextGenerationResources';
import {
  CURRICULUM_KINDS,
  CURRICULUM_KIND_LABELS,
  computeSundayKey,
  formatQuestionRange,
  summarizeTerm,
  validateCurriculumEntry,
} from './scheduleAdmin';
import {
  FALLBACK_EDIT_NOTICE,
  cardClass,
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  subtleButtonClass,
} from './ui';

interface FormState {
  date: string;
  kind: CurriculumEntryKind;
  session: string;
  lordsDay: string;
  qFrom: string;
  qTo: string;
  title: string;
  note: string;
  isCommunionSunday: boolean;
}

const EMPTY_FORM: FormState = {
  date: '',
  kind: 'class',
  session: '',
  lordsDay: '',
  qFrom: '',
  qTo: '',
  title: '',
  note: '',
  isCommunionSunday: false,
};

const toNumber = (value: string) => (value.trim() === '' ? undefined : Number(value));

function formToEntryFields(form: FormState) {
  const from = toNumber(form.qFrom);
  const to = toNumber(form.qTo);
  const questions: [number, number] | undefined =
    from === undefined && to === undefined ? undefined : [from ?? Number(to), to ?? Number(from)];
  return {
    date: form.date,
    kind: form.kind,
    session: toNumber(form.session),
    lordsDay: toNumber(form.lordsDay),
    questions,
    title: form.title.trim(),
    note: form.note.trim() || undefined,
    isCommunionSunday: form.isCommunionSunday ? true : undefined,
  };
}

const entryToForm = (entry: CurriculumEntry): FormState => ({
  date: entry.date,
  kind: entry.kind,
  session: entry.session === undefined ? '' : String(entry.session),
  lordsDay: entry.lordsDay === undefined ? '' : String(entry.lordsDay),
  qFrom: entry.questions ? String(entry.questions[0]) : '',
  qTo: entry.questions ? String(entry.questions[1]) : '',
  title: entry.title,
  note: entry.note ?? '',
  isCommunionSunday: !!entry.isCommunionSunday,
});

export default function SundaySchoolCurriculumSection({
  terms,
  curriculum,
  disabled,
}: {
  terms: SchoolTerm[];
  curriculum: CurriculumEntry[];
  disabled: boolean;
}) {
  const learningTerms = useMemo(() => [...terms].sort((a, b) => a.order - b.order), [terms]);
  const [termId, setTermId] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Default: the term containing today, otherwise the first term.
  useEffect(() => {
    if (termId && learningTerms.some((term) => term.id === termId)) return;
    const today = findTermForDate(learningTerms, toLocalDateKey(new Date()));
    setTermId((today ?? learningTerms[0])?.id ?? '');
  }, [learningTerms, termId]);

  const term = learningTerms.find((item) => item.id === termId);
  const rows = useMemo(
    () => curriculum.filter((entry) => entry.termId === termId).sort((a, b) => a.date.localeCompare(b.date)),
    [curriculum, termId],
  );
  const summary = term ? summarizeTerm(curriculum, term) : null;

  const fields = form ? formToEntryFields(form) : null;
  const validation =
    term && fields
      ? validateCurriculumEntry(fields, { term, existingIds: curriculum.map((entry) => entry.id), editingId })
      : { errors: [], warnings: [] };

  const update = (patch: Partial<FormState>) => setForm((current) => (current ? { ...current, ...patch } : current));

  const onLordsDayChange = (value: string) => {
    const range = HEIDELBERG_LORDS_DAYS.find((item) => String(item.lordsDay) === value)?.questions;
    update({
      lordsDay: value,
      qFrom: range ? String(range[0]) : '',
      qTo: range ? String(range[1]) : '',
    });
  };

  const startNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setMessage(null);
  };

  const startEdit = (entry: CurriculumEntry) => {
    setEditingId(entry.id);
    setForm(entryToForm(entry));
    setMessage(null);
  };

  const cancel = () => {
    setForm(null);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!term || !fields || validation.errors.length > 0) return;
    const dateChanged = editingId !== null && editingId !== fields.date;
    if (validation.warnings.length > 0 && !window.confirm(`${validation.warnings.join('\n')}\n계속 저장할까요?`)) return;
    if (dateChanged && !window.confirm('날짜가 바뀌어 기존 날짜의 항목은 삭제되고 새 날짜로 저장됩니다. 진행할까요?')) return;

    const entry: CurriculumEntry = {
      ...fields,
      id: fields.date,
      sundayKey: computeSundayKey(fields.date),
      termId: term.id,
    };
    setBusy(true);
    setMessage(null);
    try {
      await saveCurriculumEntry(entry);
      if (dateChanged && editingId) await deleteCurriculumEntry(editingId);
      setMessage(`${entry.date} 항목을 저장했습니다.`);
      cancel();
    } catch (error) {
      console.error('Failed to save curriculum entry', error);
      setMessage('저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (entry: CurriculumEntry) => {
    if (!window.confirm(`${entry.date} 「${entry.title}」 항목을 삭제할까요?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await deleteCurriculumEntry(entry.id);
      if (editingId === entry.id) cancel();
      setMessage(`${entry.date} 항목을 삭제했습니다.`);
    } catch (error) {
      console.error('Failed to delete curriculum entry', error);
      setMessage('삭제에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-wood-900">진도표</h3>
        <div className="flex items-center gap-2">
          <select className={`${inputClass} w-auto`} value={termId} onChange={(e) => { setTermId(e.target.value); cancel(); }}>
            {learningTerms.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <button type="button" className={subtleButtonClass} disabled={disabled || !term || !!form} onClick={startNew}>항목 추가</button>
        </div>
      </div>
      {disabled && <p className="mt-2 text-xs font-bold text-amber-700">{FALLBACK_EDIT_NOTICE}</p>}
      {summary && (
        <p className="mt-2 text-xs font-bold text-wood-600">
          수업 {summary.lessonCount}회 · 휴강 {summary.holidayCount}회
          {summary.progressLabel ? ` · 진도: ${summary.progressLabel}` : ''}
        </p>
      )}
      {message && <p className="mt-2 text-xs font-bold text-emerald-700">{message}</p>}

      {form && term && (
        <div className="mt-3 rounded-xl border border-wood-300 bg-wood-50 p-3">
          <p className="text-sm font-bold text-wood-900">{editingId ? `${editingId} 항목 수정` : '새 항목'}</p>
          <div className="mt-2 grid gap-2 md:grid-cols-4">
            <label className="text-xs font-bold text-wood-600">날짜
              <input type="date" className={inputClass} value={form.date} onChange={(e) => update({ date: e.target.value })} />
              {form.date && <span className="mt-0.5 block font-normal text-wood-500">주일 {computeSundayKey(form.date)}</span>}
            </label>
            <label className="text-xs font-bold text-wood-600">종류
              <select className={inputClass} value={form.kind} onChange={(e) => update({ kind: e.target.value as CurriculumEntryKind })}>
                {CURRICULUM_KINDS.map((kind) => (
                  <option key={kind} value={kind}>{CURRICULUM_KIND_LABELS[kind]}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-wood-600">회차
              <input type="number" min={1} className={inputClass} value={form.session} onChange={(e) => update({ session: e.target.value })} />
            </label>
            <label className="text-xs font-bold text-wood-600">하이델베르크 주일
              <select className={inputClass} value={form.lordsDay} onChange={(e) => onLordsDayChange(e.target.value)}>
                <option value="">없음</option>
                {HEIDELBERG_LORDS_DAYS.map((item) => (
                  <option key={item.lordsDay} value={item.lordsDay}>
                    제{item.lordsDay}주일 ({formatQuestionRange(item.questions)})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-wood-600">문 범위 시작
              <input type="number" min={1} className={inputClass} value={form.qFrom} onChange={(e) => update({ qFrom: e.target.value })} />
            </label>
            <label className="text-xs font-bold text-wood-600">문 범위 끝
              <input type="number" min={1} className={inputClass} value={form.qTo} onChange={(e) => update({ qTo: e.target.value })} />
            </label>
            <label className="text-xs font-bold text-wood-600 md:col-span-2">제목
              <input className={inputClass} value={form.title} maxLength={200} onChange={(e) => update({ title: e.target.value })} />
            </label>
            <label className="text-xs font-bold text-wood-600 md:col-span-3">비고
              <input className={inputClass} value={form.note} onChange={(e) => update({ note: e.target.value })} />
            </label>
            <label className="flex items-end gap-2 pb-2 text-xs font-bold text-wood-700">
              <input type="checkbox" checked={form.isCommunionSunday} onChange={(e) => update({ isCommunionSunday: e.target.checked })} />
              성찬 주일
            </label>
          </div>
          {validation.errors.map((message) => <p key={message} className="mt-2 text-xs font-bold text-red-600">{message}</p>)}
          {validation.warnings.map((message) => <p key={message} className="mt-2 text-xs font-bold text-amber-700">{message}</p>)}
          <div className="mt-3 flex gap-2">
            <button type="button" className={primaryButtonClass} disabled={busy || validation.errors.length > 0} onClick={handleSave}>
              {busy ? '저장 중...' : '저장'}
            </button>
            <button type="button" className={subtleButtonClass} disabled={busy} onClick={cancel}>취소</button>
          </div>
        </div>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="text-xs text-wood-500">
              <th className="p-1.5">날짜</th>
              <th className="p-1.5">주일</th>
              <th className="p-1.5">종류</th>
              <th className="p-1.5">회차</th>
              <th className="p-1.5">하이델베르크</th>
              <th className="p-1.5">문</th>
              <th className="p-1.5">제목</th>
              <th className="p-1.5">비고</th>
              <th className="p-1.5">성찬</th>
              <th className="p-1.5" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={10} className="p-3 text-center text-xs text-wood-500">이 구간에 등록된 항목이 없습니다.</td></tr>
            )}
            {rows.map((entry) => (
              <tr key={entry.id} className="border-t border-wood-100 align-top">
                <td className="p-1.5 font-bold text-wood-900">{entry.date}</td>
                <td className="p-1.5 text-wood-600">{entry.sundayKey}</td>
                <td className="p-1.5">{CURRICULUM_KIND_LABELS[entry.kind]}</td>
                <td className="p-1.5">{entry.session ?? ''}</td>
                <td className="p-1.5">{entry.lordsDay ? `제${entry.lordsDay}주일` : ''}</td>
                <td className="p-1.5">{formatQuestionRange(entry.questions)}</td>
                <td className="p-1.5">{entry.title}</td>
                <td className="p-1.5 text-wood-600">{entry.note ?? ''}</td>
                <td className="p-1.5">{entry.isCommunionSunday ? '✓' : ''}</td>
                <td className="p-1.5">
                  <div className="flex gap-1">
                    <button type="button" className={subtleButtonClass} disabled={disabled || busy || !!form} onClick={() => startEdit(entry)}>수정</button>
                    <button type="button" className={dangerButtonClass} disabled={disabled || busy} onClick={() => handleDelete(entry)}>삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
