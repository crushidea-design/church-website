// Onboarding overlay extracted from NextGeneration.tsx. Self-contained
// modal that walks a department-specific tutorial flow; only callback
// is `onClose` from the parent.
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Apple,
  Bell,
  BookMarked,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  HelpCircle,
  Sparkles,
  X,
} from 'lucide-react';
import {
  NextGenerationTutorialDepartment,
  NextGenerationTutorialStep,
  getNextGenerationTutorialSteps,
} from '../../lib/nextGenerationTutorial';

const tutorialIconMap: Record<NextGenerationTutorialStep['id'], React.ComponentType<{ size?: number; className?: string }>> = {
  overview: Sparkles,
  materials: FileText,
  word: BookOpen,
  wordFruit: Apple,
  profileReading: BookMarked,
  qa: HelpCircle,
  notifications: Bell,
};

export default function NextGenerationTutorialModal({ onClose }: { onClose: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedDepartment, setSelectedDepartment] = useState<NextGenerationTutorialDepartment | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tutorialSteps = selectedDepartment ? getNextGenerationTutorialSteps(selectedDepartment) : [];
  const step = tutorialSteps[activeIndex];
  const Icon = step ? tutorialIconMap[step.id] : Sparkles;
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === tutorialSteps.length - 1;
  const paddedRect = targetRect
    ? {
        top: Math.max(8, targetRect.top - 8),
        left: Math.max(8, targetRect.left - 8),
        width: Math.min(window.innerWidth - 16, targetRect.width + 16),
        height: targetRect.height + 16,
      }
    : null;
  const mobilePanelPosition =
    targetRect && targetRect.top > window.innerHeight * 0.42
      ? 'top-3'
      : 'bottom-3';
  const goPrev = () => setActiveIndex((value) => Math.max(0, value - 1));
  const goNext = () => {
    if (isLast) onClose();
    else setActiveIndex((value) => Math.min(tutorialSteps.length - 1, value + 1));
  };
  const selectDepartment = (department: NextGenerationTutorialDepartment) => {
    setSelectedDepartment(department);
    setActiveIndex(0);
    setTargetRect(null);
  };

  useEffect(() => {
    if (!step) return;

    const currentRoute = `${location.pathname}${location.search}`;
    if (currentRoute !== step.route) {
      navigate(step.route);
    }
  }, [location.pathname, location.search, navigate, step?.route]);

  useEffect(() => {
    if (!step) return;

    let frame = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const measure = (retryCount = 0) => {
      frame = window.requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>(step.target);
        if (!target && retryCount < 8) {
          retryTimer = setTimeout(() => measure(retryCount + 1), 120);
          return;
        }

        if (!target) {
          setTargetRect(null);
          return;
        }

        target.scrollIntoView({
          block: window.innerWidth < 640 ? 'start' : 'center',
          inline: 'center',
          behavior: 'smooth',
        });
        retryTimer = setTimeout(() => {
          setTargetRect(target.getBoundingClientRect());
        }, window.innerWidth < 640 ? 320 : 220);
      });
    };

    measure();

    const refresh = () => {
      const target = document.querySelector<HTMLElement>(step.target);
      setTargetRect(target?.getBoundingClientRect() || null);
    };

    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, true);

    return () => {
      window.cancelAnimationFrame(frame);
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh, true);
    };
  }, [location.pathname, location.search, step?.target]);

  if (!selectedDepartment) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 px-3 pb-3 pt-6 pointer-events-none sm:items-center sm:px-4 sm:py-6">
        <div className="max-h-[calc(100dvh-24px)] w-full max-w-xl overflow-y-auto rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xl pointer-events-auto sm:max-h-[calc(100dvh-48px)] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-normal text-coral-700">처음 이용 안내</p>
              <h2 className="mt-1 text-xl font-black tracking-normal text-emerald-950">어느 부서 안내를 볼까요?</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                선택한 부서에 맞춰 필요한 기능만 차근차근 보여드립니다.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
              aria-label="이용 안내 닫기"
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => selectDepartment('elementary')}
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-left transition hover:bg-amber-100"
            >
              <span className="block text-base font-black text-emerald-950">유초등부</span>
              <span className="mt-1 block text-sm font-bold leading-6 text-slate-600">
                주간 자료, 말씀 열매, 성경 읽기 기록표를 안내합니다.
              </span>
            </button>
            <button
              type="button"
              onClick={() => selectDepartment('young-adults')}
              className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-4 text-left transition hover:bg-sky-100"
            >
              <span className="block text-base font-black text-emerald-950">청년부</span>
              <span className="mt-1 block text-sm font-bold leading-6 text-slate-600">
                청년부 자료, 오늘의 말씀, Q&A를 안내합니다.
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        className="fixed rounded-2xl border-2 border-amber-400 bg-white/5 shadow-[0_0_0_9999px_rgba(15,23,42,0.28),0_0_0_4px_rgba(253,230,138,0.85),0_14px_35px_rgba(15,23,42,0.18)] transition-all duration-200 sm:bg-amber-100/10 sm:shadow-[0_0_0_3px_rgba(251,191,36,0.22),0_12px_30px_rgba(15,23,42,0.16)]"
        style={{
          top: paddedRect?.top || 96,
          left: paddedRect?.left || 16,
          width: paddedRect?.width || Math.min(window.innerWidth - 32, 360),
          height: paddedRect?.height || 120,
        }}
        aria-hidden="true"
      />

      <div
        className={`fixed inset-x-3 ${mobilePanelPosition} mx-auto flex max-h-[38dvh] w-[calc(100vw-24px)] max-w-xl flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl pointer-events-auto sm:inset-x-4 sm:bottom-6 sm:top-auto sm:max-h-[calc(100dvh-48px)] sm:w-[calc(100vw-32px)]`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-emerald-100 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 sm:h-9 sm:w-9">
              <Icon size={17} />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-normal text-coral-700">{step.eyebrow}</p>
              <h2 className="text-base font-black tracking-normal text-emerald-950">화면 안내</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
            aria-label="이용 안내 닫기"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-5">
          <div className="mb-3 flex items-center gap-1.5 sm:mb-4 sm:gap-2">
            {tutorialSteps.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`h-2.5 flex-1 rounded-full transition ${
                  index === activeIndex ? 'bg-emerald-600' : 'bg-emerald-100 hover:bg-emerald-200'
                }`}
                aria-label={`${index + 1}단계 ${item.title}`}
                aria-current={index === activeIndex ? 'step' : undefined}
              />
            ))}
          </div>

          <p className="text-xs font-black text-coral-700 sm:text-sm">{activeIndex + 1} / {tutorialSteps.length}</p>
          <h3 className="mt-1.5 text-base font-black tracking-normal text-emerald-950 sm:mt-2 sm:text-xl">{step.title}</h3>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-700 sm:mt-3">{step.body}</p>
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-bold leading-6 text-amber-900 sm:mt-4 sm:px-4 sm:py-3">
            {step.action}
          </div>
          <p className="mt-3 text-xs font-bold text-slate-500">강조된 영역은 직접 눌러보면서 확인할 수 있습니다.</p>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-emerald-100 bg-white px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={isFirst}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10"
          >
            <ChevronLeft size={16} />
            이전
          </button>
          <button
            type="button"
            onClick={goNext}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700 sm:h-10"
          >
            {isLast ? '닫기' : '다음'}
            {!isLast && <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
