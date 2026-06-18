import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Apple,
  BookOpen,
  Camera,
  CheckCircle2,
  HelpCircle,
  Home,
  LogIn,
  MessageSquare,
  QrCode,
  Sparkles,
} from 'lucide-react';
import WordFruitTree, { FruitStage } from '../word-fruit/WordFruitTree';
import {
  BIBLE_BOOK_SPOTS,
  CHART_VIEWBOX,
} from '../../lib/bibleReadingLayout';
import {
  DEMO_BIBLE_READING_COMPLETED_BOOK_INDEXES,
  DEMO_REAL_PAGE_LINKS,
  NEXT_GENERATION_DEMO_STEPS,
  NextGenerationDemoStepId,
  getDemoPageUrl,
} from './demoContent';

const wordFruitMessages = [
  '아직 작은 열매예요. 말씀을 듣고 마음에 심어 보아요.',
  '말씀이 마음에 싹트기 시작했어요.',
  '순종의 열매가 점점 익어가고 있어요.',
  '하나님 앞에서 기쁜 열매로 자랐어요.',
];

function openRealSignUp() {
  window.dispatchEvent(new Event('next-generation-open-login'));
}

function getStepIcon(id: NextGenerationDemoStepId) {
  switch (id) {
    case 'signup':
      return LogIn;
    case 'bible-reading':
      return BookOpen;
    case 'curriculum':
      return Sparkles;
    case 'word-fruit':
      return Apple;
    case 'qa':
      return HelpCircle;
    case 'family-worship':
      return Home;
  }
}

export default function NextGenerationDemoPage() {
  const [activeStep, setActiveStep] = useState<NextGenerationDemoStepId>('signup');
  const [fruitStage, setFruitStage] = useState<FruitStage>(0);
  const [questionSent, setQuestionSent] = useState(false);
  const [familyLogged, setFamilyLogged] = useState(false);
  const demoUrl = useMemo(
    () => getDemoPageUrl(typeof window === 'undefined' ? undefined : window.location.origin),
    [],
  );
  const demoCompletedBookIndexes = useMemo(
    () => new Set(DEMO_BIBLE_READING_COMPLETED_BOOK_INDEXES),
    [],
  );
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(demoUrl)}`;
  const activeIndex = NEXT_GENERATION_DEMO_STEPS.findIndex((step) => step.id === activeStep);

  return (
    <main className="bg-emerald-50/50">
      <section className="border-b border-emerald-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm font-black text-emerald-950">
                <Sparkles size={18} />
                현장 시연 모드
              </span>
              <h1 className="mt-4 text-4xl font-black tracking-normal text-emerald-950 sm:text-5xl">
                다음세대 앱 체험하기
              </h1>
              <p className="mt-4 max-w-3xl text-lg font-bold leading-8 text-slate-700">
                먼저 휴대폰으로 접속해 실제 회원가입을 진행하고, 이어서 공과와 신앙 습관 기능을 함께 살펴봅니다.
              </p>
            </div>
            <Link
              to="/next"
              className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-black text-emerald-800 shadow-sm hover:bg-emerald-50"
            >
              다음세대 홈으로
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[300px_1fr] lg:px-8">
        <aside className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-black text-emerald-800">시연 순서</p>
          <div className="grid gap-2">
            {NEXT_GENERATION_DEMO_STEPS.map((step, index) => {
              const Icon = getStepIcon(step.id);
              const isActive = step.id === activeStep;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                    isActive
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                      : 'border-emerald-100 bg-emerald-50 text-emerald-950 hover:border-emerald-300 hover:bg-white'
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-white/20' : 'bg-white'}`}>
                    <Icon size={18} />
                  </span>
                  <span>
                    <span className="block text-xs font-black opacity-80">STEP {index + 1}</span>
                    <span className="block text-base font-black">{step.shortTitle}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-h-[620px] rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-amber-700">STEP {activeIndex + 1}</p>
              <h2 className="mt-1 text-3xl font-black tracking-normal text-emerald-950">
                {NEXT_GENERATION_DEMO_STEPS[activeIndex]?.title}
              </h2>
              <p className="mt-2 max-w-3xl text-base font-bold leading-7 text-slate-600">
                {NEXT_GENERATION_DEMO_STEPS[activeIndex]?.description}
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">
              {NEXT_GENERATION_DEMO_STEPS[activeIndex]?.mode === 'real' ? '실제 화면' : '저장 없는 데모'}
            </span>
          </div>

          {activeStep === 'signup' && (
            <div className="grid gap-7 lg:grid-cols-[320px_1fr] lg:items-center">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-emerald-700">
                  <QrCode size={26} />
                </div>
                <img src={qrUrl} alt="다음세대 시연 페이지 QR 코드" className="mx-auto h-64 w-64 rounded-xl bg-white p-3 shadow-sm" />
                <p className="mt-4 break-all rounded-lg bg-white px-3 py-2 text-sm font-black text-emerald-900">
                  {demoUrl}
                </p>
              </div>
              <div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    '휴대폰 카메라로 QR을 찍어요.',
                    'Google로 로그인해요.',
                    '이름과 부서를 확인해요.',
                    '가입 신청을 완료해요.',
                  ].map((item, index) => (
                    <div key={item} className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                      <p className="text-sm font-black text-amber-700">가입 {index + 1}</p>
                      <p className="mt-2 text-xl font-black text-emerald-950">{item}</p>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={openRealSignUp}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-amber-600 sm:w-auto"
                >
                  <LogIn size={22} />
                  실제 회원가입 열기
                </button>
                <p className="mt-4 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-bold text-slate-700">
                  폰이 없는 친구는 선생님 화면을 함께 보거나 선생님 기기로 같이 진행하면 됩니다.
                </p>
              </div>
            </div>
          )}

          {activeStep === 'bible-reading' && (
            <div className="grid gap-8 xl:grid-cols-[480px_1fr] xl:items-center">
              <div
                className="relative mx-auto w-full max-w-md overflow-hidden rounded-xl border border-amber-100 bg-amber-50 shadow-sm"
                style={{ aspectRatio: '2265 / 2806' }}
              >
                <img
                  src="/bible-reading-chart.png"
                  alt="성경 읽기 기록표 책장"
                  className="absolute inset-0 block h-full w-full select-none"
                  draggable={false}
                  onError={(event) => {
                    const img = event.currentTarget;
                    if (!img.dataset.fallback) {
                      img.dataset.fallback = '1';
                      img.src = '/bible-reading-chart.svg';
                    }
                  }}
                />
                <svg
                  viewBox={CHART_VIEWBOX}
                  preserveAspectRatio="none"
                  className="absolute inset-0 h-full w-full"
                  aria-label="성경 읽기 기록표 데모 색칠 영역"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {BIBLE_BOOK_SPOTS.map((spot, index) => {
                    const completed = demoCompletedBookIndexes.has(index);
                    const fill = completed
                      ? spot.testament === 'old'
                        ? 'rgba(251, 191, 36, 0.55)'
                        : 'rgba(251, 113, 133, 0.55)'
                      : 'rgba(255, 255, 255, 0.001)';
                    const commonProps = {
                      fill,
                      stroke: 'transparent',
                      strokeWidth: 5,
                      vectorEffect: 'non-scaling-stroke' as const,
                      className: 'transition-colors',
                    };

                    return spot.shape.type === 'path' ? (
                      <path key={spot.name} d={spot.shape.d} {...commonProps}>
                        <title>{spot.name}</title>
                      </path>
                    ) : (
                      <rect
                        key={spot.name}
                        x={spot.shape.x}
                        y={spot.shape.y}
                        width={spot.shape.width}
                        height={spot.shape.height}
                        transform={spot.shape.transform}
                        rx={14}
                        {...commonProps}
                      >
                        <title>{spot.name}</title>
                      </rect>
                    );
                  })}
                </svg>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                  <h3 className="text-2xl font-black text-emerald-950">내 페이지에서 확인해요</h3>
                  <p className="mt-3 text-lg font-bold leading-8 text-slate-700">
                    가입 후 내 페이지에서 성경 읽기 기록표를 볼 수 있어요.
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
                  <h3 className="text-2xl font-black text-emerald-950">목회자/관리자가 기록해요</h3>
                  <p className="mt-3 text-lg font-bold leading-8 text-slate-700">
                    읽은 책 색칠은 목회자나 관리자가 확인해서 기록해 줘요.
                  </p>
                </div>
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
                  <h3 className="text-2xl font-black text-emerald-950">주중 문의는 문의하기에 남겨요</h3>
                  <p className="mt-3 text-lg font-bold leading-8 text-slate-700">
                    따로 연락하고 싶거나 읽은 내용을 알리고 싶으면 앱 안의 문의하기에 글을 남겨도 좋아요.
                  </p>
                </div>
                <Link
                  to={DEMO_REAL_PAGE_LINKS.bibleReading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-emerald-700 sm:w-auto"
                >
                  <BookOpen size={22} />
                  실제 내 페이지에서 보기
                </Link>
              </div>
            </div>
          )}

          {activeStep === 'curriculum' && (
            <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr] lg:items-center">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6">
                <h3 className="text-3xl font-black text-emerald-950">실제 공과 탭을 열어봅니다</h3>
                <p className="mt-4 text-lg font-bold leading-8 text-slate-700">
                  유초등부 게시판의 공과 탭으로 이동해서 실제 등록된 공과를 누르고, 상세 화면에서 자료를 확인합니다.
                </p>
                <Link
                  to={DEMO_REAL_PAGE_LINKS.curriculum}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <BookOpen size={22} />
                  실제 공과 탭 열기
                </Link>
              </div>
              <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
                <p className="text-sm font-black text-sky-700">시연 멘트</p>
                <ul className="mt-4 space-y-3 text-lg font-bold leading-8 text-slate-700">
                  <li>1. 이번주 공과 탭을 엽니다.</li>
                  <li>2. 실제 공과 목록 중 하나를 누릅니다.</li>
                  <li>3. 본문과 첨부 자료를 확인합니다.</li>
                  <li>4. 상단 안내로 다시 시연 코스로 돌아옵니다.</li>
                </ul>
              </div>
            </div>
          )}

          {activeStep === 'word-fruit' && (
            <div className="grid gap-7 lg:grid-cols-[340px_1fr] lg:items-center">
              <WordFruitTree stage={fruitStage} fruitName="말씀열매" className="max-w-[320px]" />
              <div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6">
                  <p className="text-sm font-black text-amber-700">이번주 말씀</p>
                  <h3 className="mt-2 text-3xl font-black text-emerald-950">말씀을 마음에 담아요</h3>
                  <p className="mt-4 text-xl font-black leading-8 text-emerald-800">{wordFruitMessages[fruitStage]}</p>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setFruitStage((stage) => (Math.min(stage + 1, 3) as FruitStage))}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-amber-600"
                  >
                    <Apple size={22} />
                    말씀을 마음에 담았어요
                  </button>
                  <button
                    type="button"
                    onClick={() => setFruitStage(0)}
                    className="rounded-xl border border-amber-200 bg-white px-5 py-4 text-lg font-black text-amber-800 transition hover:bg-amber-50"
                  >
                    다시 보여주기
                  </button>
                  <Link
                    to={DEMO_REAL_PAGE_LINKS.wordFruit}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    <Apple size={22} />
                    실제 말씀열매 열기
                  </Link>
                </div>
              </div>
            </div>
          )}

          {activeStep === 'qa' && (
            <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-start">
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6">
                <h3 className="text-3xl font-black text-emerald-950">말씀을 듣다 생긴 질문을 남겨요</h3>
                <p className="mt-4 text-lg font-bold leading-8 text-slate-700">
                  궁금한 내용을 남기면 선생님과 목회자가 함께 보고 답해 줄 수 있어요.
                </p>
                <button
                  type="button"
                  onClick={() => setQuestionSent(true)}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-amber-600"
                >
                  <MessageSquare size={22} />
                  질문 카드 남기기
                </button>
                <Link
                  to={DEMO_REAL_PAGE_LINKS.qa}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <HelpCircle size={22} />
                  실제 질문있습니다 열기
                </Link>
              </div>
              <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
                {questionSent ? (
                  <>
                    <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">답변 기다리는 중</span>
                    <h4 className="mt-4 text-2xl font-black text-emerald-950">하나님은 왜 기도를 들으세요?</h4>
                    <p className="mt-3 text-base font-bold leading-7 text-slate-700">
                      선생님이 함께 읽고 답을 준비하고 있어요.
                    </p>
                  </>
                ) : (
                  <p className="text-lg font-bold leading-8 text-slate-500">버튼을 누르면 질문 카드가 만들어집니다.</p>
                )}
              </div>
            </div>
          )}

          {activeStep === 'family-worship' && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-black text-amber-700">가정에서도 이어지는 말씀</p>
                  <h3 className="mt-2 text-3xl font-black text-emerald-950">이번주 가정예배 자료</h3>
                  <p className="mt-4 max-w-3xl text-lg font-bold leading-8 text-slate-700">
                    부모님과 함께 가정예배를 드리고, 나눔 기록과 인증샷을 남길 수 있어요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFamilyLogged(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <Camera size={22} />
                  기록과 인증샷 남기기
                </button>
                <Link
                  to={DEMO_REAL_PAGE_LINKS.familyWorship}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-5 py-4 text-lg font-black text-emerald-800 shadow-sm transition hover:bg-emerald-50"
                >
                  <Home size={22} />
                  실제 가정예배 탭 열기
                </Link>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {['가정예배 자료 보기', '우리 가족 나눔 기록하기', '인증샷 올리기'].map((item) => (
                  <div key={item} className="rounded-xl border border-amber-100 bg-white p-5">
                    <p className="text-xl font-black text-emerald-950">{item}</p>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-600">기존 가정예배 기능에서 실제로 사용할 수 있어요.</p>
                  </div>
                ))}
              </div>
              {familyLogged && (
                <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-100 bg-white px-5 py-4 text-lg font-black text-emerald-800">
                  <CheckCircle2 size={24} />
                  우리 가정 나눔 카드가 완성됐어요.
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
