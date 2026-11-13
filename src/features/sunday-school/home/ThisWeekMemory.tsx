import React from 'react';
import { getMemoryLines, SEED_MEMORY_NOTE } from '../memory';
import type { CurriculumEntry, SchoolClassId } from '../types';

const CLASS_NAMES: Record<string, string> = { jaram: '자람반', seum: '세움반', didim: '디딤반' };

/** 이번 주 암송: 선택한 반의 암송 범위를 보여 준다. 입력된 문구가 없으면 숨긴다. */
export default function ThisWeekMemory({
  entry,
  classFilter,
}: {
  entry: CurriculumEntry | undefined;
  classFilter: SchoolClassId | 'all';
}) {
  if (!entry?.memory) return null;
  const lines = getMemoryLines(entry, classFilter);
  const isSeed = classFilter === 'seed';
  if (lines.length === 0 && !isSeed) return null;

  const question = entry.memory.question;

  return (
    <section className="bg-white pt-8" data-next-tour="school-memory">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-5">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-lg font-black text-emerald-950">이번 주 암송</h2>
            {question !== undefined && !isSeed && (
              <span className="text-sm font-bold text-emerald-700">하이델베르크 제{question}문</span>
            )}
          </div>
          {isSeed ? (
            <p className="mt-2 text-sm font-bold leading-6 text-slate-600">{SEED_MEMORY_NOTE}</p>
          ) : (
            <div className={`mt-3 grid gap-3 ${lines.length > 1 ? 'md:grid-cols-3' : ''}`}>
              {lines.map((line) => (
                <div key={line.classId} className="rounded-lg bg-white p-4 ring-1 ring-emerald-100">
                  <p className="text-xs font-black text-emerald-700">
                    {CLASS_NAMES[line.classId]} · {line.level}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-base font-bold leading-7 text-emerald-950">{line.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
