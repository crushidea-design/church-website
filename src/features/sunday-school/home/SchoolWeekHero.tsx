import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import type { WeekHeroModel } from './weekHero';

const TONE_CLASS: Record<WeekHeroModel['tone'], string> = {
  lesson: 'border-t-amber-400',
  holiday: 'border-t-amber-200',
  vacation: 'border-t-sky-300',
  unscheduled: 'border-t-emerald-900',
  off: 'border-t-emerald-900',
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
        <div className={`rounded-lg border-t-4 bg-emerald-700 p-6 text-white shadow-sm sm:p-8 ${TONE_CLASS[model.tone]}`}>
          {schoolName && (
            <p className="mb-3 text-base font-black text-white">
              {schoolName}
              {schoolNameEn && <span className="ml-2 text-xs font-bold uppercase tracking-wide text-amber-300">{schoolNameEn}</span>}
            </p>
          )}
          <p className="flex items-center gap-2 text-sm font-black text-emerald-200">
            <CalendarDays size={16} />
            이번 주일 · {sundayKey}
            {isOverride && <span className="rounded bg-amber-300 px-2 py-0.5 text-xs text-amber-950">날짜 미리보기</span>}
          </p>
          <h1 className="mt-3 text-2xl font-black leading-tight tracking-normal text-white sm:text-4xl">
            {model.title}
          </h1>
          {model.subtitle && <p className="mt-3 text-lg font-bold leading-8 text-emerald-100">{model.subtitle}</p>}
          {model.badges.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {model.badges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white ring-1 ring-white/25"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}
          {model.eventLine && (
            <p className="mt-4 text-sm font-bold text-amber-300">{model.eventLine}</p>
          )}
          {model.links.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {model.links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="inline-flex items-center rounded-lg bg-amber-400 px-4 py-2 text-sm font-black text-emerald-950 hover:bg-amber-300"
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
