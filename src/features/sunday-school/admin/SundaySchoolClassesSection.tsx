import React, { useState } from 'react';
import { upsertSchoolClass } from '../api';
import type { SchoolClass } from '../types';
import { FALLBACK_EDIT_NOTICE, cardClass, inputClass, primaryButtonClass } from './ui';

const MODE_LABELS: Record<SchoolClass['mode'], string> = { parent: '부모 동반', class: '반 수업' };

export default function SundaySchoolClassesSection({
  classes,
  disabled,
}: {
  classes: SchoolClass[];
  disabled: boolean;
}) {
  const [drafts, setDrafts] = useState<Record<string, SchoolClass>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const save = async (schoolClass: SchoolClass) => {
    setBusyId(schoolClass.id);
    setMessage(null);
    try {
      await upsertSchoolClass({ ...schoolClass, name: schoolClass.name.trim() });
      setDrafts((current) => {
        const next = { ...current };
        delete next[schoolClass.id];
        return next;
      });
      setMessage(`「${schoolClass.name.trim()}」을(를) 저장했습니다.`);
    } catch (error) {
      console.error('Failed to save school class', error);
      setMessage('저장에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={cardClass}>
      <h3 className="text-lg font-bold text-wood-900">반</h3>
      <p className="mt-1 text-xs font-bold text-wood-500">공개되는 반 소개 정보입니다. 인원수와 구성은 입력하지 않습니다.</p>
      {disabled && <p className="mt-2 text-xs font-bold text-amber-700">{FALLBACK_EDIT_NOTICE}</p>}
      {message && <p className="mt-2 text-xs font-bold text-emerald-700">{message}</p>}
      <div className="mt-3 space-y-3">
        {[...classes].sort((a, b) => a.order - b.order).map((item) => {
          const draft = drafts[item.id] ?? item;
          const update = (patch: Partial<SchoolClass>) =>
            setDrafts((current) => ({ ...current, [item.id]: { ...draft, ...patch } }));
          const dirty = !!drafts[item.id];
          return (
            <div key={item.id} className="rounded-xl border border-wood-200 p-3">
              <div className="grid gap-2 md:grid-cols-4">
                <label className="text-xs font-bold text-wood-600">이름
                  <input className={inputClass} value={draft.name} disabled={disabled} onChange={(e) => update({ name: e.target.value })} />
                </label>
                <label className="text-xs font-bold text-wood-600">연령 기준
                  <input className={inputClass} value={draft.ageRule} disabled={disabled} onChange={(e) => update({ ageRule: e.target.value })} />
                </label>
                <label className="text-xs font-bold text-wood-600">근거 구절
                  <input className={inputClass} value={draft.verseRef} disabled={disabled} onChange={(e) => update({ verseRef: e.target.value })} />
                </label>
                <label className="text-xs font-bold text-wood-600">강조점
                  <input className={inputClass} value={draft.emphasis} disabled={disabled} onChange={(e) => update({ emphasis: e.target.value })} />
                </label>
                <label className="text-xs font-bold text-wood-600 md:col-span-2">구절 본문
                  <input className={inputClass} value={draft.verseText} disabled={disabled} onChange={(e) => update({ verseText: e.target.value })} />
                </label>
                <label className="text-xs font-bold text-wood-600">교실
                  <input className={inputClass} value={draft.room} disabled={disabled} onChange={(e) => update({ room: e.target.value })} />
                </label>
                <label className="text-xs font-bold text-wood-600">운영 방식
                  <select className={inputClass} value={draft.mode} disabled={disabled} onChange={(e) => update({ mode: e.target.value as SchoolClass['mode'] })}>
                    {(Object.keys(MODE_LABELS) as Array<SchoolClass['mode']>).map((mode) => (
                      <option key={mode} value={mode}>{MODE_LABELS[mode]}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-bold text-wood-700">
                  <input type="checkbox" checked={draft.isVisible} disabled={disabled} onChange={(e) => update({ isVisible: e.target.checked })} />
                  공개
                </label>
                <button type="button" className={primaryButtonClass} disabled={disabled || !dirty || !draft.name.trim() || busyId !== null} onClick={() => save(draft)}>
                  {busyId === item.id ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
