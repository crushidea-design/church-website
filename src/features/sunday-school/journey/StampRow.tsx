// Mon-Sat stamp row: tap a day to mark that the family worshiped / the child practiced.
import React from 'react';
import { isDayCheckable, weekDays } from './journey';

export default function StampRow({
  label,
  weekKey,
  todayKey,
  checkedDates,
  canEdit,
  busy,
  onToggle,
}: {
  label: string;
  weekKey: string;
  todayKey: string;
  checkedDates: readonly string[];
  /** The viewer's role may check this row. */
  canEdit: boolean;
  busy?: boolean;
  onToggle: (date: string) => void;
}) {
  const checked = new Set(checkedDates);
  return (
    <div role="group" aria-label={`${label} 도장`} className="grid grid-cols-6 gap-1.5">
      {weekDays(weekKey).map((day) => {
        const isChecked = checked.has(day.date);
        const open = isDayCheckable(day.date, weekKey, todayKey);
        const disabled = !canEdit || !open || busy;
        return (
          <button
            key={day.date}
            type="button"
            aria-pressed={isChecked}
            aria-label={`${label} ${day.label}요일${isChecked ? ' 했어요' : ''}`}
            disabled={disabled}
            onClick={() => onToggle(day.date)}
            className={`flex min-h-[44px] flex-col items-center justify-center rounded-lg border text-xs font-black transition ${
              isChecked
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : open && canEdit
                  ? 'border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-50'
                  : 'border-slate-200 bg-slate-50 text-slate-400'
            } disabled:cursor-default`}
          >
            <span>{day.label}</span>
            <span aria-hidden="true" className="text-sm leading-none">
              {isChecked ? '✓' : '·'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
