import React from 'react';
import type { SchoolClass } from '../types';
import type { ClassFilter } from './weeklyMaterials';

export default function ClassChips({
  classes,
  value,
  onChange,
}: {
  classes: SchoolClass[];
  value: ClassFilter;
  onChange: (next: ClassFilter) => void;
}) {
  const visible = classes.filter((item) => item.isVisible).sort((a, b) => a.order - b.order);
  const selected = visible.find((item) => item.id === value);
  const chipClass = (active: boolean) =>
    `shrink-0 rounded-xl px-4 py-2.5 text-sm font-black transition min-h-[44px] ${
      active ? 'bg-emerald-600 text-white shadow-sm' : 'bg-sky-50 text-emerald-950 hover:bg-sky-100'
    }`;

  return (
    <section className="bg-white pt-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex gap-2 overflow-x-auto pb-2" role="group" aria-label="반 선택" data-next-tour="school-classes">
          <button type="button" onClick={() => onChange('all')} className={chipClass(value === 'all')} aria-pressed={value === 'all'}>
            전체
          </button>
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={chipClass(value === item.id)}
              aria-pressed={value === item.id}
            >
              {item.name}
            </button>
          ))}
        </div>
        {selected && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black text-emerald-950">{selected.name}</h2>
              <span className="text-sm font-bold text-slate-600">{selected.ageRule}</span>
              {selected.mode === 'parent' && (
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-200">
                  부모와 함께하는 반
                </span>
              )}
            </div>
            <p className="mt-3 text-base font-bold leading-7 text-emerald-950">
              {selected.verseText}
              <span className="ml-2 text-sm text-slate-600">({selected.verseRef})</span>
            </p>
            <p className="mt-2 text-sm font-bold text-slate-600">장소: {selected.room}</p>
          </div>
        )}
      </div>
    </section>
  );
}
