import React from 'react';
import type { HeidelbergProgress } from '../schedule';
import { HEIDELBERG_TOTAL_LORDS_DAYS } from '../heidelberg';

const SEGMENTS = [
  { label: '위로', start: 1, end: 1 },
  { label: '비참', start: 2, end: 4 },
  { label: '구원', start: 5, end: 31 },
  { label: '감사', start: 32, end: 52 },
];

export default function CurriculumProgress({ progress }: { progress: HeidelbergProgress | null }) {
  if (!progress) return null;
  return (
    <section className="bg-white pt-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-black text-emerald-950">2년 과정 · 하이델베르크 요리문답</h2>
            <p className="text-sm font-black text-emerald-700">
              제{progress.lordsDay}주일 / {HEIDELBERG_TOTAL_LORDS_DAYS}
            </p>
          </div>
          <div
            className="mt-3 flex gap-1"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.lordsDay}
            aria-label={`제${progress.lordsDay}주일 (${progress.partLabel})`}
          >
            {SEGMENTS.map((segment) => {
              const count = segment.end - segment.start + 1;
              const done = Math.max(0, Math.min(count, progress.lordsDay - segment.start + 1));
              const isCurrent = progress.lordsDay >= segment.start && progress.lordsDay <= segment.end;
              return (
                <div key={segment.label} style={{ flexGrow: count, flexBasis: 0 }} className="min-w-[44px]">
                  <div className="h-3 overflow-hidden rounded-full bg-white ring-1 ring-sky-100">
                    <div
                      className={`h-full ${isCurrent ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${(done / count) * 100}%` }}
                    />
                  </div>
                  <p className={`mt-1.5 text-center text-xs font-black ${isCurrent ? 'text-amber-700' : 'text-slate-500'}`}>
                    {segment.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
