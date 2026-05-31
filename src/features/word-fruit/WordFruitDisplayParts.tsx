// Display sub-components extracted from WordFruitPanel.tsx:
// InfoTile, StudentTree, CardModal, ArchiveList, CommunitySummary.
import React, { useMemo } from 'react';
import { WeeklyWordFruit, WordFruitProgress } from './types';
import WordFruitTree, { stageMessage } from './WordFruitTree';

export function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

export function StudentTree({
  fruit,
  progress,
  stage,
  alreadyToday,
  canCheck,
  onCheck,
  myAllProgress,
}: {
  fruit: WeeklyWordFruit;
  progress: WordFruitProgress | null;
  stage: 0 | 1 | 2 | 3;
  alreadyToday: boolean;
  canCheck: boolean;
  onCheck: () => void;
  myAllProgress: WordFruitProgress[];
}) {
  const completed = !!progress?.completed;
  const monthly = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const monthPrefix = `${yyyy}-${mm}`;
    let monthRipened = 0;
    let totalRipened = 0;
    myAllProgress.forEach((p) => {
      if (!p.completed) return;
      totalRipened += 1;
      if ((p.checkedDates ?? []).some((d) => d.startsWith(monthPrefix))) {
        monthRipened += 1;
      }
    });
    return { monthRipened, totalRipened };
  }, [myAllProgress]);

  return (
    <div className="mt-5 rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50/60 to-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-black text-emerald-950">이번 주 나의 말씀 열매</h3>
        {(monthly.monthRipened > 0 || monthly.totalRipened > 0) && (
          <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
            {monthly.monthRipened > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
                이번 달 익은 열매 {monthly.monthRipened}개 🌳
              </span>
            )}
            {monthly.totalRipened > monthly.monthRipened && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                지금까지 모은 열매 {monthly.totalRipened}개
              </span>
            )}
          </div>
        )}
      </div>

      {!progress ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          이번 주 나의 작은 순종이 아직 등록되지 않았어요. 선생님께 문의해 주세요.
        </p>
      ) : (
        <>
          <div className="mt-2 rounded-lg border border-emerald-100 bg-white p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">나의 작은 순종</p>
            <p className="mt-1 text-sm font-bold text-emerald-900">{progress.practice}</p>
          </div>

          <div className="mt-4">
            <WordFruitTree stage={stage} fruitName={fruit.fruitName} />
          </div>

          <p className="mt-2 text-center text-sm font-semibold text-emerald-800">
            {stageMessage(stage)}
          </p>
          <p className="mt-1 text-center text-xs text-emerald-700">
            이번 주 체크 {progress.checkCount}/3
          </p>

          {completed ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-900">
              하나님께서 이번 주에도 내 삶에 열매를 맺게 하셨어요.
            </div>
          ) : !canCheck ? (
            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4 text-center text-sm text-amber-800">
              {new Date().getDay() === 0
                ? '주일은 새 말씀 열매를 받는 날이에요. 내일부터 다시 작은 순종을 실천해 보아요.'
                : '지난 주차는 기록을 보기만 할 수 있어요.'}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-emerald-100 bg-white p-4">
              <p className="text-center text-sm text-slate-700">
                오늘도 내가 정한 작은 순종을 실천했나요?
              </p>
              <button
                type="button"
                onClick={onCheck}
                disabled={alreadyToday}
                className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {alreadyToday ? '오늘은 이미 열매를 돌보았어요' : '오늘 실천했어요'}
              </button>
              {alreadyToday && (
                <p className="mt-2 text-center text-xs text-slate-500">
                  내일 다시 말씀을 기억하며 실천해 보아요.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function CardModal({
  card,
  submitting,
  onConfirm,
  onCancel,
}: {
  card: WeeklyWordFruit['cards'][number];
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">
          {card.order}회차 카드
        </p>
        <h4 className="mt-1 text-lg font-black text-emerald-950">{card.title}</h4>
        {card.summary && (
          <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm leading-relaxed text-emerald-900">
            {card.summary}
          </p>
        )}
        {card.question && (
          <div className="mt-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">오늘의 질문</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-800">{card.question}</p>
          </div>
        )}
        {card.prayer && (
          <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">짧은 기도</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-900">{card.prayer}</p>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? '저장 중...' : '네, 오늘 실천했어요'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            아직 실천하지 못했어요
          </button>
          <p className="text-center text-xs text-slate-500">
            괜찮아요. 오늘 다시 말씀을 기억하며 작은 순종을 실천해 보아요.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ArchiveList({
  fruits,
  selectedWeekId,
  currentWeekId,
  onSelect,
  onResetToCurrent,
}: {
  fruits: WeeklyWordFruit[];
  selectedWeekId: string;
  currentWeekId: string;
  onSelect: (weekId: string) => void;
  onResetToCurrent: () => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, WeeklyWordFruit[]>();
    fruits.forEach((f) => {
      const key = (f.startDate || f.weekId).slice(0, 7) || '기타';
      const list = map.get(key) ?? [];
      list.push(f);
      map.set(key, list);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [fruits]);

  return (
    <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-emerald-900">지난 주 말씀 열매</p>
        {selectedWeekId !== currentWeekId && (
          <button
            type="button"
            onClick={onResetToCurrent}
            className="text-xs font-bold text-emerald-700 underline-offset-2 hover:underline"
          >
            이번 주로 돌아가기
          </button>
        )}
      </div>
      {fruits.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">아직 게시된 지난 말씀 열매가 없어요.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {grouped.map(([month, list]) => (
            <div key={month}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">{month}</p>
              <ul className="mt-1 space-y-1">
                {list.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(f.weekId)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                        selectedWeekId === f.weekId
                          ? 'border-emerald-400 bg-white'
                          : 'border-slate-200 bg-white/70 hover:border-emerald-300'
                      }`}
                    >
                      <p className="font-bold text-emerald-950">{f.title || '(제목 없음)'}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {f.weekId} · {f.passage || '-'} · {f.fruitName || '-'}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CommunitySummary({ fruit }: { fruit: WeeklyWordFruit }) {
  const total = fruit.aggregateTotal ?? 0;
  const completed = fruit.aggregateCompleted ?? 0;
  const growing = fruit.aggregateGrowing ?? 0;
  const ratio = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
      <p className="text-xs font-bold text-amber-700">우리 유초등부 공동체 현황</p>
      <p className="mt-1 text-sm font-semibold text-amber-900">{fruit.aggregateMessage}</p>
      {total > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-amber-800">
          <span className="rounded-full bg-white/80 px-2 py-0.5">완료 {completed}</span>
          <span className="rounded-full bg-white/80 px-2 py-0.5">익어가는 중 {growing}</span>
          <span className="rounded-full bg-white/80 px-2 py-0.5">완료 비율 {ratio}%</span>
        </div>
      )}
    </div>
  );
}
