import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import type { WeekHeroModel } from './weekHero';

const TONE_CLASS: Record<WeekHeroModel['tone'], string> = {
  lesson: 'border-t-emerald-700',
  holiday: 'border-t-amber-500',
  vacation: 'border-t-sky-300',
  unscheduled: 'border-t-emerald-700',
  off: 'border-t-emerald-700',
};

export default function SchoolWeekHero({
  model,
  sundayKey,
  isOverride,
  schoolName,
  schoolNameEn,
}: {
  model: WeekHeroModel;
  sundayKey: string;
  isOverride?: boolean;
  schoolName?: string;
  schoolNameEn?: string;
}) {
  return (
    <section className="pt-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={`border border-[#DADFDD] border-t-4 bg-white p-6 sm:p-8 ${TONE_CLASS[model.tone]}`}>
          {schoolName && (
            <p className="mb-3 text-base font-black text-emerald-900">
              {schoolName}
              {schoolNameEn && <span className="ml-2 text-xs font-bold uppercase tracking-wide text-amber-700">{schoolNameEn}</span>}
            </p>
          )}
          <p className="flex items-center gap-2 text-sm font-bold text-slate-500">
            <CalendarDays size={16} />
            이번 주일 · {sundayKey}
            {isOverride && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">날짜 미리보기</span>}
          </p>
          <h1 className="mt-3 text-2xl font-black leading-tight tracking-normal text-slate-900 sm:text-4xl">
            {model.title}
          </h1>
          {model.subtitle && <p className="mt-3 text-lg font-bold leading-8 text-amber-700">{model.subtitle}</p>}
          {model.badges.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {model.badges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-800 ring-1 ring-[#DADFDD]"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}
          {model.eventLine && (
            <p className="mt-4 text-sm font-bold text-amber-700">{model.eventLine}</p>
          )}
          {model.links.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {model.links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="inline-flex items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
