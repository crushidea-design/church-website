// Parent-facing view of the Word Fruit panel.
import React, { useState } from 'react';
import { WeeklyWordFruit, WordFruitProgress } from './types';
import { stageMessage } from './WordFruitTree';
import { addTodayCheckByLeader, getTodayKey } from './api';

export default function ParentView({
  fruit,
  weekId,
  childProgresses,
  childIds,
  proxyChildren,
  canEdit,
}: {
  fruit: WeeklyWordFruit;
  weekId: string;
  childProgresses: WordFruitProgress[];
  childIds: string[];
  proxyChildren: Array<{ id: string; name: string; grade?: string; usesPhone: boolean; groupId?: string }>;
  canEdit: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const todayKey = getTodayKey();
  const progressByUserId = new Map(childProgresses.map((p) => [p.userId, p]));
  const realChildEntries = childIds.map((uid) => ({
    kind: 'real' as const,
    id: uid,
    name: progressByUserId.get(uid)?.childName || '자녀',
    grade: undefined as string | undefined,
    progress: progressByUserId.get(uid) ?? null,
  }));
  const proxyEntries = proxyChildren.map((c) => ({
    kind: 'proxy' as const,
    id: c.id,
    name: c.name,
    grade: c.grade,
    progress: progressByUserId.get(c.id) ?? null,
  }));
  const entries = [...realChildEntries, ...proxyEntries];

  if (entries.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
        등록된 자녀가 없어요. 학부모 첫 설정에서 자녀를 추가해 주세요.
      </div>
    );
  }

  const handlePlusOne = async (entry: typeof entries[number]) => {
    if (!canEdit) return;
    setErr('');
    setBusy(entry.id);
    try {
      await addTodayCheckByLeader({
        weekId,
        userId: entry.id,
        childName: entry.name,
        practice: entry.progress?.practice,
        groupId: entry.progress?.groupId ?? '',
      });
    } catch (e: any) {
      setErr(e?.message || '저장 실패');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-5 space-y-3">
      <h3 className="text-base font-black text-emerald-950">우리 아이 말씀 열매</h3>
      {err && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>
      )}
      {entries.map((entry) => {
        const p = entry.progress;
        const checkCount = p?.checkCount ?? 0;
        const stage = (p?.completed ? 3 : Math.min(checkCount, 3)) as 0 | 1 | 2 | 3;
        const checkedToday = !!p && (p.checkedDates ?? []).includes(todayKey);
        return (
          <div key={entry.id} className="rounded-xl border border-emerald-100 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="font-bold text-emerald-950">
                {entry.name}
                {entry.kind === 'proxy' && (
                  <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">대리</span>
                )}
                {entry.grade && (
                  <span className="ml-2 text-xs font-bold text-slate-500">({entry.grade})</span>
                )}
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  p?.completed
                    ? 'bg-emerald-100 text-emerald-800'
                    : checkCount > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {p?.completed ? '완료' : checkCount > 0 ? '익어가는 중' : '자라는 중'}
              </span>
            </div>
            {p?.practice && <p className="mt-2 text-sm text-slate-700">{p.practice}</p>}
            <p className="mt-1 text-xs text-slate-500">체크 {Math.min(checkCount, 3)}/3 · {stageMessage(stage)}</p>
            {canEdit && (
              <button
                type="button"
                onClick={() => handlePlusOne(entry)}
                disabled={busy === entry.id || checkedToday || p?.completed}
                className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:bg-slate-300"
              >
                {checkedToday ? '오늘은 이미 체크했어요' : p?.completed ? '이번 주 완료' : '오늘 열매 +1'}
              </button>
            )}
          </div>
        );
      })}
      <p className="text-xs text-slate-400">{fruit.weekId} 기준</p>
    </div>
  );
}
