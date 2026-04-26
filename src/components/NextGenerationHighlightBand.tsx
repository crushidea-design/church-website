import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

export interface HighlightEntry {
  id: string;
  icon: React.ReactNode;
  label: string;
  summary?: string;
  badge?: { text: string; tone: 'amber' | 'emerald' | 'sky' | 'rose' };
  content: React.ReactNode;
}

interface Props {
  entries: HighlightEntry[];
  /** Tailwind classes for the band background. */
  themeBg?: string;
  /** Search-param key used to remember which entry is open. */
  paramKey?: string;
  /** Tailwind class for the highlight ring color when a tile is active. */
  activeRing?: string;
}

const TONE_CLASS: Record<NonNullable<HighlightEntry['badge']>['tone'], string> = {
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  sky: 'bg-sky-100 text-sky-800 border-sky-200',
  rose: 'bg-rose-100 text-rose-800 border-rose-200',
};

/**
 * Slim row of entry tiles ("highlight band"). Tiles are collapsed by default;
 * clicking expands the entry's content inline below the band. State is tracked
 * via a URL parameter (default `highlight`) so back/forward navigation works.
 */
export default function NextGenerationHighlightBand({
  entries,
  themeBg = 'bg-white',
  paramKey = 'highlight',
  activeRing = 'border-emerald-400 bg-emerald-50',
}: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const focus = searchParams.get(paramKey);
  const activeEntry = entries.find((entry) => entry.id === focus);

  const toggle = (id: string) => {
    const next = new URLSearchParams(searchParams);
    if (focus === id) next.delete(paramKey);
    else next.set(paramKey, id);
    setSearchParams(next, { replace: true });
  };

  const cols = entries.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';

  return (
    <section className={themeBg}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className={`grid gap-3 ${cols}`}>
          {entries.map((entry) => {
            const isActive = focus === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => toggle(entry.id)}
                aria-expanded={isActive}
                className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition hover:shadow ${
                  isActive ? activeRing : 'border-slate-200'
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-emerald-700">
                  {entry.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black text-emerald-950">{entry.label}</div>
                  {entry.summary && (
                    <div className="mt-0.5 truncate text-xs text-slate-500">{entry.summary}</div>
                  )}
                </div>
                {entry.badge && (
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${TONE_CLASS[entry.badge.tone]}`}
                  >
                    {entry.badge.text}
                  </span>
                )}
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-slate-400 transition-transform ${isActive ? 'rotate-180' : ''}`}
                />
              </button>
            );
          })}
        </div>

        {activeEntry && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-1 duration-200">
            {activeEntry.content}
          </div>
        )}
      </div>
    </section>
  );
}
