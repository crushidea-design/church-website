import React, { useMemo, useState } from 'react';
import { upsertSchoolTerm } from '../api';
import type { SchoolTerm, SchoolTermKind } from '../types';
import { validateTerm } from './scheduleAdmin';
import { FALLBACK_EDIT_NOTICE, cardClass, inputClass, primaryButtonClass, subtleButtonClass } from './ui';

const KIND_LABELS: Record<SchoolTermKind, string> = { term: '학기', vacation: '방학' };

export default function SundaySchoolTermsSection({
  terms,
  disabled,
}: {
  terms: SchoolTerm[];
  disabled: boolean;
}) {
  const [drafts, setDrafts] = useState<Record<string, SchoolTerm>>({});
  const [newTerm, setNewTerm] = useState<SchoolTerm | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sorted = useMemo(() => [...terms].sort((a, b) => a.order - b.order), [terms]);

  const save = async (term: SchoolTerm, others: SchoolTerm[], isNew: boolean) => {
    const { errors } = validateTerm(term, others);
    if (errors.length > 0) return;
    setBusyId(term.id);
    setMessage(null);
    try {
      await upsertSchoolTerm({ ...term, name: term.name.trim() });
      setDrafts((current) => {
        const next = { ...current };
        delete next[term.id];
        return next;
      });
      if (isNew) setNewTerm(null);
      setMessage(`「${term.name.trim()}」을(를) 저장했습니다.`);
    } catch (error) {
      console.error('Failed to save school term', error);
      setMessage('저장에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const startNew = () => {
    const nextOrder = sorted.reduce((max, term) => Math.max(max, term.order), 0) + 1;
    setNewTerm({ id: '', kind: 'term', name: '', startDate: '', endDate: '', order: nextOrder });
  };

  const renderRow = (term: SchoolTerm, isNew: boolean) => {
    const others = sorted.filter((item) => item.id !== term.id);
    const draft = isNew ? term : drafts[term.id] ?? term;
    const effective = isNew ? { ...draft, id: `term-${draft.startDate}` } : draft;
    const { errors, warnings } = validateTerm(effective, others);
    const dirty = isNew || !!drafts[term.id];
    const update = (patch: Partial<SchoolTerm>) => {
      if (isNew) setNewTerm({ ...draft, ...patch });
      else setDrafts((current) => ({ ...current, [term.id]: { ...draft, ...patch } }));
    };
    return (
      <tr key={isNew ? 'new' : term.id} className="align-top">
        <td className="p-1.5">
          <input className={inputClass} value={draft.name} disabled={disabled} onChange={(e) => update({ name: e.target.value })} />
        </td>
        <td className="p-1.5">
          <select className={inputClass} value={draft.kind} disabled={disabled} onChange={(e) => update({ kind: e.target.value as SchoolTermKind })}>
            {(Object.keys(KIND_LABELS) as SchoolTermKind[]).map((kind) => (
              <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>
            ))}
          </select>
        </td>
        <td className="p-1.5">
          <input type="date" className={inputClass} value={draft.startDate} disabled={disabled} onChange={(e) => update({ startDate: e.target.value })} />
        </td>
        <td className="p-1.5">
          <input type="date" className={inputClass} value={draft.endDate} disabled={disabled} onChange={(e) => update({ endDate: e.target.value })} />
        </td>
        <td className="p-1.5">
          <input
            type="number"
            min={1}
            className={`${inputClass} w-16`}
            value={Number.isNaN(draft.order) ? '' : draft.order}
            disabled={disabled}
            onChange={(e) => update({ order: e.target.value === '' ? NaN : Number(e.target.value) })}
          />
        </td>
        <td className="p-1.5">
          <div className="flex gap-1">
            <button
              type="button"
              className={primaryButtonClass}
              disabled={disabled || !dirty || errors.length > 0 || busyId !== null}
              onClick={() => save(effective, others, isNew)}
            >
              {busyId === effective.id ? '저장 중...' : '저장'}
            </button>
            {isNew && (
              <button type="button" className={subtleButtonClass} onClick={() => setNewTerm(null)}>취소</button>
            )}
          </div>
          {dirty && errors.map((message) => <p key={message} className="mt-1 text-[11px] font-bold text-red-600">{message}</p>)}
          {dirty && warnings.map((message) => <p key={message} className="mt-1 text-[11px] font-bold text-amber-700">{message}</p>)}
        </td>
      </tr>
    );
  };

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-wood-900">학사 일정</h3>
        <button type="button" className={subtleButtonClass} disabled={disabled || !!newTerm} onClick={startNew}>구간 추가</button>
      </div>
      <p className="mt-1 text-xs font-bold text-wood-500">학기와 방학 구간입니다. 시작일·종료일은 주일 날짜로 입력하고, 구간끼리 겹칠 수 없습니다.</p>
      {disabled && <p className="mt-2 text-xs font-bold text-amber-700">{FALLBACK_EDIT_NOTICE}</p>}
      {message && <p className="mt-2 text-xs font-bold text-emerald-700">{message}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="text-xs text-wood-500">
              <th className="p-1.5">이름</th>
              <th className="p-1.5">구분</th>
              <th className="p-1.5">시작</th>
              <th className="p-1.5">종료</th>
              <th className="p-1.5">순서</th>
              <th className="p-1.5" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((term) => renderRow(term, false))}
            {newTerm && renderRow(newTerm, true)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
