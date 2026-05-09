import React, { useState } from 'react';
import WordFruitTree, { FruitStage, stageMessage } from './WordFruitTree';

const STAGE_META: Array<{ stage: FruitStage; label: string; verse: string }> = [
  { stage: 0, label: '아직 자라는 중', verse: '고전 3:6' },
  { stage: 1, label: '익기 시작', verse: '고전 3:6' },
  { stage: 2, label: '점점 익어감', verse: '고전 3:7' },
  { stage: 3, label: '완전히 익음', verse: '갈 5:22' },
];

/**
 * 디자인 검수용 공개 미리보기. 운영 페이지가 아니라 사용자 데이터 0건의
 * 순수 렌더링 도구. 4단계를 동시에 보고, 인터랙티브 1개로 전환을 확인.
 *
 * URL: /preview/word-fruit-tree
 */
export default function WordFruitTreePreview() {
  const [stage, setStage] = useState<FruitStage>(0);

  return (
    <div className="min-h-screen bg-stone-50 px-6 py-10 text-stone-900 md:px-12 md:py-14">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em] text-stone-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            WordFruitTree · 디자인 미리보기
          </div>
          <h1 className="text-3xl leading-tight text-stone-800 md:text-4xl">
            오늘의 말씀 열매
          </h1>
          <p className="max-w-2xl leading-relaxed text-stone-600">
            나는 심었고 아볼로는 물을 주었으되, 오직 하나님께서 자라게 하셨나니.
            <span className="ml-2 font-mono text-xs text-stone-400">— 고전 3:6</span>
          </p>
          <p className="text-sm text-stone-500">
            운영 화면이 아니라 디자인 검수용입니다. 학생/실적 데이터는 사용하지 않아요.
          </p>
        </header>

        {/* 4단계 그리드 */}
        <section className="mb-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xl text-stone-800">네 단계의 익어감</h2>
            <span className="font-mono text-xs text-stone-400">stage 0 → 3</span>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {STAGE_META.map((m) => (
              <div
                key={m.stage}
                className="flex flex-col rounded-2xl border border-stone-200/60 bg-white p-4 shadow-sm"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-stone-400">
                    stage {m.stage}
                  </span>
                  <span className="font-mono text-[10px] text-stone-400">{m.verse}</span>
                </div>
                <div className="mb-2 text-base text-stone-800">{m.label}</div>
                <div className="flex flex-1 items-center justify-center">
                  <WordFruitTree stage={m.stage} />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-stone-600">
                  {stageMessage(m.stage)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 인터랙티브 단일 */}
        <section className="mb-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xl text-stone-800">전환 미리보기</h2>
            <span className="font-mono text-xs text-stone-400">CSS transition · 0.6s ease</span>
          </div>
          <div className="grid items-center gap-8 rounded-2xl border border-stone-200/60 bg-white p-6 shadow-sm md:grid-cols-[320px_1fr] md:p-10">
            <div className="mx-auto w-full max-w-[320px]">
              <WordFruitTree stage={stage} />
            </div>

            <div className="flex flex-col gap-5">
              <div>
                <div className="mb-2 font-mono text-xs uppercase tracking-widest text-stone-400">
                  체크 횟수 — stage {stage}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {([0, 1, 2, 3] as FruitStage[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStage(s)}
                      className={[
                        'rounded-lg border py-2 text-sm transition',
                        stage === s
                          ? 'border-stone-800 bg-stone-800 text-white'
                          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400',
                      ].join(' ')}
                    >
                      {s === 3 ? '3+' : s}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStage((s) => (s >= 3 ? 0 : ((s + 1) as FruitStage)))}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-base text-white shadow-sm transition hover:bg-emerald-700"
              >
                🌱 오늘 실천했어요
              </button>

              <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm leading-relaxed text-stone-700">
                {stageMessage(stage)}
              </p>

              <p className="text-xs leading-relaxed text-stone-500">
                체크할 때마다 열매가 한 단계 익어요.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
