// Intro page for the 2027 Sunday school. Replaces the old pillar/gallery
// intro; copy lives in intro/content.ts. Reuses the original lightbox pattern.
import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
import { useSundaySchoolCatalog } from './api';
import {
  INTRO_CURRICULUM,
  INTRO_HERO,
  INTRO_LOOKBACK,
  INTRO_MOTTO,
  INTRO_PRINCIPLES,
  INTRO_SCHEDULE,
  INTRO_TERMS,
} from './intro/content';
import type { IntroGalleryImage } from './intro/content';

const formatTermDate = (key: string) => {
  const [, month, day] = key.split('-').map(Number);
  return `${month}/${day}`;
};

export default function SchoolIntroPage() {
  const catalog = useSundaySchoolCatalog();
  const classes = catalog.classes.filter((item) => item.isVisible).sort((a, b) => a.order - b.order);
  const [lightbox, setLightbox] = useState<IntroGalleryImage[] | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(null);
      if (event.key === 'ArrowLeft') setIndex((i) => (i - 1 + lightbox.length) % lightbox.length);
      if (event.key === 'ArrowRight') setIndex((i) => (i + 1) % lightbox.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const sectionTitle = 'text-2xl font-black tracking-normal text-emerald-950';

  return (
    <div>
      <section className="bg-gradient-to-b from-amber-50 to-white">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <span className="mb-5 inline-flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm font-black text-emerald-950">
            <Sparkles size={18} />
            {INTRO_HERO.eyebrow}
          </span>
          <h1 className="text-4xl font-black leading-tight tracking-normal text-emerald-950 sm:text-5xl">
            {INTRO_HERO.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg font-bold leading-8 text-slate-700">{INTRO_HERO.lead}</p>
        </div>
      </section>

      <section className="bg-white py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className={sectionTitle}>네 가지 원칙</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {INTRO_PRINCIPLES.map((item, i) => (
              <div key={item.title} className="rounded-xl border border-sky-100 bg-sky-50/50 p-5">
                <p className="text-sm font-black text-amber-700">원칙 {i + 1}</p>
                <h3 className="mt-1 text-xl font-black text-emerald-950">{item.title}</h3>
                <p className="mt-2 leading-7 text-slate-700">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-emerald-50/60 py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className={sectionTitle}>{INTRO_MOTTO.heading}</h2>
          <p className="mt-4 text-lg font-bold leading-8 text-emerald-950">{INTRO_MOTTO.verse}</p>
          <div className="mt-8 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-emerald-100 sm:p-8">
            <p className="text-center text-xl font-black text-emerald-900">{INTRO_MOTTO.command}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {INTRO_MOTTO.steps.map((step, i) => (
                <div key={step.classId} className="relative rounded-xl bg-emerald-50 p-4 text-center">
                  <p className="text-xs font-black text-emerald-700">{i + 1}</p>
                  <p className="mt-1 text-lg font-black text-emerald-950">{step.name}</p>
                  <p className="mt-1 text-sm font-bold text-slate-600">{step.phrase}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-xl font-black text-amber-700">{INTRO_MOTTO.result}</p>
          </div>
          <div className="mt-6 space-y-2 leading-7 text-slate-700">
            {INTRO_MOTTO.explanation.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className={sectionTitle}>반 소개</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {classes.map((item) => (
              <div key={item.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-black text-emerald-950">{item.name}</h3>
                  {item.mode === 'parent' && (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-200">
                      부모와 함께하는 반
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm font-bold text-slate-600">{item.ageRule}</p>
                <p className="mt-3 font-bold leading-7 text-emerald-950">
                  {item.verseText} <span className="text-sm text-slate-500">({item.verseRef})</span>
                </p>
                <p className="mt-2 text-sm font-bold text-slate-600">장소: {item.room}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-sky-50/50 py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className={sectionTitle}>주일 시간표</h2>
          <ol className="mt-6 divide-y divide-sky-100 overflow-hidden rounded-xl bg-white ring-1 ring-sky-100">
            {INTRO_SCHEDULE.map((row) => (
              <li key={row.time} className="flex items-baseline gap-4 px-5 py-3">
                <span className="w-14 shrink-0 text-lg font-black text-emerald-700">{row.time}</span>
                <span className="font-black text-emerald-950">{row.title}</span>
                {row.detail && <span className="text-sm font-bold text-slate-600">{row.detail}</span>}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className={sectionTitle}>학기제</h2>
          <p className="mt-3 text-lg font-black text-amber-700">{INTRO_TERMS.summary}</p>
          <p className="mt-3 leading-8 text-slate-700">{INTRO_TERMS.body}</p>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {catalog.terms.map((term) => (
              <li
                key={term.id}
                className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-black ${
                  term.kind === 'vacation' ? 'bg-sky-50 text-sky-900' : 'bg-emerald-50 text-emerald-900'
                }`}
              >
                <span>{term.name}</span>
                <span className="font-bold opacity-80">
                  {formatTermDate(term.startDate)} ~ {formatTermDate(term.endDate)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-emerald-50/60 py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className={sectionTitle}>교재</h2>
          <p className="mt-3 text-xl font-black text-emerald-950">
            {INTRO_CURRICULUM.title} <span className="text-base text-slate-600">'{INTRO_CURRICULUM.subtitle}'</span>
          </p>
          <p className="mt-2 font-bold leading-7 text-slate-700">{INTRO_CURRICULUM.firstQuestion}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {INTRO_CURRICULUM.years.map((year) => (
              <div key={year.label} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-emerald-100">
                <h3 className="text-lg font-black text-emerald-950">{year.label}</h3>
                <p className="mt-1 text-sm font-black text-amber-700">{year.range}</p>
                <p className="mt-2 leading-7 text-slate-700">{year.topics}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className={sectionTitle}>지난 교육 돌아보기 (2025–26 유초등부)</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {INTRO_LOOKBACK.map((group) => (
              <div key={group.title}>
                <button
                  type="button"
                  onClick={() => {
                    setLightbox(group.gallery);
                    setIndex(0);
                  }}
                  className="block w-full overflow-hidden rounded-lg border border-sky-100 shadow-sm"
                  aria-label={`${group.title} 사진 보기`}
                >
                  <img src={group.gallery[0].src} alt={group.gallery[0].alt} loading="lazy" className="h-48 w-full object-cover" />
                </button>
                <h3 className="mt-3 font-black text-emerald-950">{group.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{group.caption}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 px-4 py-8" onClick={() => setLightbox(null)}>
          <div className="relative flex w-full max-w-4xl flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute -top-10 right-0 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/25"
              aria-label="닫기"
            >
              <X size={20} />
            </button>
            <div className="relative flex h-[70vh] w-full items-center justify-center">
              <img
                key={lightbox[index].src}
                src={lightbox[index].src}
                alt={lightbox[index].alt}
                className="h-full w-full rounded-lg object-contain shadow-2xl"
              />
              {lightbox.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setIndex((i) => (i - 1 + lightbox.length) % lightbox.length)}
                    className="absolute left-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg bg-black/40 text-white transition hover:bg-black/60"
                    aria-label="이전 사진"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIndex((i) => (i + 1) % lightbox.length)}
                    className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg bg-black/40 text-white transition hover:bg-black/60"
                    aria-label="다음 사진"
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}
            </div>
            <p className="mt-3 text-sm font-bold text-white/80">
              {index + 1} / {lightbox.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
