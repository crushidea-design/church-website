import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { subscribeWeeklyWordFruit } from './api';
import { GUIDE_MESSAGE_DEFAULT, TOP_MESSAGE_DEFAULT, WeeklyWordFruit } from './types';

/**
 * Family-use printable page: clean, single-color, no fixed nav.
 * Loaded at /print/word-fruit/:weekId. Pastor can open from admin panel,
 * but the page renders only published fruits for everyone else (rules-enforced).
 */
export default function WordFruitPrintView() {
  const { weekId } = useParams<{ weekId: string }>();
  const [fruit, setFruit] = useState<WeeklyWordFruit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!weekId) return;
    return subscribeWeeklyWordFruit(weekId, (f) => {
      setFruit(f);
      setLoading(false);
    }, () => setLoading(false));
  }, [weekId]);

  useEffect(() => {
    document.title = fruit?.title ? `${fruit.title} · 이번 주 말씀 열매` : '이번 주 말씀 열매';
  }, [fruit?.title]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        <Loader2 className="mr-2 animate-spin" size={16} /> 불러오는 중...
      </div>
    );
  }
  if (!fruit) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12 text-slate-700">
        <p>요청하신 말씀 열매를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-800 print:bg-white">
      <style>{`
        @media print {
          @page { margin: 14mm; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="mx-auto max-w-3xl px-6 py-8 print:px-0 print:py-0">
        <div className="no-print mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">
            출력용 화면 — 가정에서 함께 사용해 주세요. 인쇄 대화상자에서 “대상 → PDF로 저장”을 선택하면 PDF 파일로 받을 수 있어요.
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
            >
              PDF로 저장 / 인쇄
            </button>
          </div>
        </div>

        <header className="border-b border-emerald-200 pb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">
            이번 주 말씀 열매 · {fruit.weekId}
          </p>
          <h1 className="mt-2 text-2xl font-black text-emerald-900">{fruit.title}</h1>
          <p className="mt-1 text-sm font-semibold text-emerald-700">
            {fruit.topMessage || TOP_MESSAGE_DEFAULT}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {fruit.guideMessage || GUIDE_MESSAGE_DEFAULT}
          </p>
        </header>

        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          <Tile label="성경 본문" value={fruit.passage || '-'} />
          <Tile label="이번 주 열매" value={fruit.fruitName || '-'} />
          <Tile
            label="기간"
            value={fruit.startDate && fruit.endDate ? `${fruit.startDate} ~ ${fruit.endDate}` : '-'}
          />
        </section>

        {fruit.memoryVerse && (
          <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-bold text-emerald-700">이번 주 말씀</p>
            <p className="mt-1 text-base font-semibold text-emerald-900">“{fruit.memoryVerse}”</p>
          </section>
        )}

        {fruit.recommendedPractices.length > 0 && (
          <section className="mt-5">
            <h2 className="text-sm font-black text-emerald-900">추천 실천 목록</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {fruit.recommendedPractices.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-6 space-y-4">
          {fruit.cards.map((card) => (
            <article key={card.order} className="break-inside-avoid rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">
                {card.order}회차 카드
              </p>
              <h3 className="mt-1 text-base font-black text-emerald-900">{card.title}</h3>
              {card.summary && <p className="mt-2 text-sm leading-relaxed text-slate-800">{card.summary}</p>}
              {card.question && (
                <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">오늘의 질문</p>
                  <p className="mt-1 text-sm text-slate-800">{card.question}</p>
                </div>
              )}
              {card.prayer && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">짧은 기도</p>
                  <p className="mt-1 text-sm text-amber-900">{card.prayer}</p>
                </div>
              )}
            </article>
          ))}
        </section>

        <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
          한우리교회 다음세대 · 가정에서 함께 사용해 주세요.
        </footer>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}
