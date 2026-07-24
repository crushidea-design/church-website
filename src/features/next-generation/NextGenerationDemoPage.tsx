import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Apple,
  Bell,
  BookOpen,
  Camera,
  CheckCircle2,
  HelpCircle,
  Home,
  LogIn,
  MessageSquare,
  QrCode,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react';
import WordFruitTree, { FruitStage } from '../word-fruit/WordFruitTree';
import {
  DEMO_REAL_PAGE_LINKS,
  NEXT_GENERATION_DEMO_STEPS,
  NEXT_GENERATION_PARENT_QR_PATH,
  NextGenerationDemoStepId,
  getNextGenerationHomeUrl,
} from './demoContent';

const wordFruitMessages = [
  '이번 주 말씀을 아이와 다시 이야기해 보세요.',
  '오늘 기억한 말씀을 함께 확인했어요.',
  '작은 순종이 좋은 습관으로 자라고 있어요.',
  '가정과 교회가 함께 기쁜 열매를 격려했어요.',
];

function openRealSignUp() {
  window.dispatchEvent(new Event('next-generation-open-login'));
}

function getStepIcon(id: NextGenerationDemoStepId) {
  switch (id) {
    case 'signup':
      return LogIn;
    case 'children':
      return Users;
    case 'curriculum':
      return BookOpen;
    case 'word-fruit':
      return Apple;
    case 'family-worship':
      return Home;
    case 'qa-notifications':
      return MessageSquare;
  }
}

export default function NextGenerationDemoPage() {
  const [activeStep, setActiveStep] = useState<NextGenerationDemoStepId>('signup');
  const [fruitStage, setFruitStage] = useState<FruitStage>(0);
  const [questionSent, setQuestionSent] = useState(false);
  const [familyLogged, setFamilyLogged] = useState(false);
  const signUpUrl = useMemo(
    () => getNextGenerationHomeUrl('https://builttogether.church'),
    [],
  );
  const activeIndex = NEXT_GENERATION_DEMO_STEPS.findIndex((step) => step.id === activeStep);

  return (
    <main className="bg-stone-50">
      <section className="border-b border-emerald-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-2 text-sm font-black text-emerald-950">
                <Sparkles size={18} />
                부모님을 위한 이용 안내
              </span>
              <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-normal text-emerald-950 sm:text-5xl">
                아이의 주일을 가정의 한 주로 이어 주세요
              </h1>
              <p className="mt-4 max-w-3xl text-lg font-bold leading-8 text-slate-700">
                다음세대 홈페이지에서 부모님은 공과를 확인하고, 자녀의 말씀 습관을 격려하며,
                가정예배와 신앙 질문을 교회와 함께 이어 갈 수 있습니다.
              </p>
            </div>
            <Link
              to="/next"
              className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-black text-emerald-800 shadow-sm hover:bg-emerald-50"
            >
              다음세대 홈으로
            </Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ['주일 자료', '이번 주 공과와 가정예배 자료를 한곳에서 확인합니다.'],
              ['자녀의 신앙 습관', '우리 아이 말씀열매를 보고 오늘의 실천을 함께 격려합니다.'],
              ['교회와의 연결', '질문과 알림을 통해 목회자·교사와 신앙 대화를 이어 갑니다.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                <p className="font-black text-emerald-950">{title}</p>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[300px_1fr] lg:px-8">
        <aside className="h-fit rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm lg:sticky lg:top-24">
          <p className="text-sm font-black text-emerald-800">부모님 이용 순서</p>
          <p className="mb-3 mt-1 text-xs font-bold leading-5 text-slate-500">아래 항목을 순서대로 눌러 살펴보세요.</p>
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
                      ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
                      : 'border-emerald-100 bg-emerald-50/60 text-emerald-950 hover:border-emerald-300 hover:bg-white'
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-white/20' : 'bg-white'}`}>
                    <Icon size={18} />
                  </span>
                  <span>
                    <span className="block text-xs font-black opacity-75">{index + 1}단계</span>
                    <span className="block text-base font-black">{step.shortTitle}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-h-[640px] rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-amber-700">{activeIndex + 1}단계</p>
              <h2 className="mt-1 text-3xl font-black tracking-normal text-emerald-950">
                {NEXT_GENERATION_DEMO_STEPS[activeIndex]?.title}
              </h2>
              <p className="mt-2 max-w-3xl text-base font-bold leading-7 text-slate-600">
                {NEXT_GENERATION_DEMO_STEPS[activeIndex]?.description}
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">
              {NEXT_GENERATION_DEMO_STEPS[activeIndex]?.mode === 'real' ? '실제 화면 연결' : '안내와 체험'}
            </span>
          </div>

          {activeStep === 'signup' && (
            <div className="grid gap-7 lg:grid-cols-[320px_1fr] lg:items-center">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-emerald-700">
                  <QrCode size={26} />
                </div>
                <img
                  src={NEXT_GENERATION_PARENT_QR_PATH}
                  alt="한우리교회 다음세대 홈페이지 접속 QR 코드"
                  className="mx-auto h-64 w-64 rounded-xl bg-white p-3 shadow-sm"
                />
                <p className="mt-4 break-all rounded-lg bg-white px-3 py-2 text-sm font-black text-emerald-900">
                  {signUpUrl}
                </p>
                <a
                  href={NEXT_GENERATION_PARENT_QR_PATH}
                  download="한우리교회-다음세대-QR.png"
                  className="mt-3 inline-flex text-sm font-black text-emerald-700 underline underline-offset-4"
                >
                  QR 코드 내려받기
                </a>
              </div>
              <div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['QR 접속', '휴대폰 카메라로 QR을 찍습니다.'],
                    ['가입 선택', 'Google 또는 이메일로 가입합니다.'],
                    ['역할 확인', '역할에서 “학부모”를 선택합니다.'],
                    ['승인 후 이용', '교회 승인 뒤 로그인하면 모든 기능이 열립니다.'],
                  ].map(([title, body], index) => (
                    <div key={title} className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                      <p className="text-sm font-black text-amber-700">가입 {index + 1}</p>
                      <p className="mt-2 text-xl font-black text-emerald-950">{title}</p>
                      <p className="mt-2 text-sm font-bold leading-6 text-slate-600">{body}</p>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={openRealSignUp}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-amber-600 sm:w-auto"
                >
                  <LogIn size={22} />
                  로그인·가입 화면 열기
                </button>
                <p className="mt-4 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-bold leading-6 text-slate-700">
                  가입 신청 직후에는 승인 대기 화면이 보입니다. 교회에서 승인하면 같은 계정으로 로그인해 이용할 수 있습니다.
                </p>
              </div>
            </div>
          )}

          {activeStep === 'children' && (
            <div>
              <div className="grid gap-4 md:grid-cols-2">
                <article className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-sky-700">
                    <Smartphone size={23} />
                  </div>
                  <p className="mt-4 text-sm font-black text-sky-700">아이가 자기 휴대폰을 쓰는 경우</p>
                  <h3 className="mt-1 text-2xl font-black text-emerald-950">학생 계정으로 연결해요</h3>
                  <ol className="mt-4 space-y-3 text-sm font-bold leading-6 text-slate-700">
                    <li>1. 부모님이 먼저 학부모로 가입합니다.</li>
                    <li>2. 아이가 “학생” 역할로 가입합니다.</li>
                    <li>3. 아이 가입 때 부모님의 가입 이메일을 입력합니다.</li>
                    <li>4. 승인되면 부모님 내 페이지에 자동으로 연결됩니다.</li>
                  </ol>
                </article>
                <article className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-amber-700">
                    <Users size={23} />
                  </div>
                  <p className="mt-4 text-sm font-black text-amber-700">아이가 아직 휴대폰을 쓰지 않는 경우</p>
                  <h3 className="mt-1 text-2xl font-black text-emerald-950">부모 계정에서 등록해요</h3>
                  <ol className="mt-4 space-y-3 text-sm font-bold leading-6 text-slate-700">
                    <li>1. 내 페이지의 “우리 아이”를 엽니다.</li>
                    <li>2. 자녀 이름과 학년·반을 등록합니다.</li>
                    <li>3. 부모님이 아이의 말씀열매를 대신 확인합니다.</li>
                    <li>4. 가정예배 기록도 아이와 함께 연결됩니다.</li>
                  </ol>
                </article>
              </div>
              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                <p className="text-lg font-black text-emerald-950">나중에 아이가 직접 가입해도 괜찮습니다.</p>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                  학생 가입 때 부모님의 가입 이메일을 입력하면, 승인 시 부모 계정에 자동으로 연결됩니다.
                </p>
              </div>
              <Link
                to={DEMO_REAL_PAGE_LINKS.myPage}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-emerald-800 sm:w-auto"
              >
                <Users size={22} />
                실제 내 페이지 확인하기
              </Link>
            </div>
          )}

          {activeStep === 'curriculum' && (
            <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr] lg:items-center">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6">
                <p className="text-sm font-black text-emerald-700">부모님이 미리 보면 좋은 곳</p>
                <h3 className="mt-2 text-3xl font-black text-emerald-950">이번 주 공과 탭</h3>
                <p className="mt-4 text-lg font-bold leading-8 text-slate-700">
                  아이가 배운 본문과 공과 자료를 확인하면, 집에서도 “오늘 어떤 말씀을 들었어?”라고 자연스럽게 대화를 시작할 수 있습니다.
                </p>
                <Link
                  to={DEMO_REAL_PAGE_LINKS.curriculum}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-emerald-800"
                >
                  <BookOpen size={22} />
                  실제 공과 탭 열기
                </Link>
              </div>
              <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
                <p className="text-sm font-black text-sky-700">이렇게 활용해 보세요</p>
                <ul className="mt-4 space-y-3 text-base font-bold leading-7 text-slate-700">
                  <li>주일 전, 이번 주 성경 본문을 먼저 읽습니다.</li>
                  <li>주일 후, 공과의 질문 한 가지를 골라 대화합니다.</li>
                  <li>첨부된 활동지나 자료가 있으면 함께 확인합니다.</li>
                  <li>가정예배 자료로 한 주의 말씀을 다시 이어 갑니다.</li>
                </ul>
              </div>
            </div>
          )}

          {activeStep === 'word-fruit' && (
            <div className="grid gap-7 lg:grid-cols-[340px_1fr] lg:items-center">
              <WordFruitTree stage={fruitStage} fruitName="우리 아이 말씀열매" className="max-w-[320px]" />
              <div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6">
                  <p className="text-sm font-black text-amber-700">내 페이지 → 우리 아이 열매</p>
                  <h3 className="mt-2 text-3xl font-black text-emerald-950">작은 실천을 함께 확인해요</h3>
                  <p className="mt-4 text-xl font-black leading-8 text-emerald-800">{wordFruitMessages[fruitStage]}</p>
                  <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
                    부모님은 연결된 자녀별 진행을 보고, 아이와 이야기한 뒤 하루 한 번 “오늘 +1”로 격려할 수 있습니다.
                  </p>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setFruitStage((stage) => (Math.min(stage + 1, 3) as FruitStage))}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-amber-600"
                  >
                    <Apple size={22} />
                    오늘의 실천 +1
                  </button>
                  <button
                    type="button"
                    onClick={() => setFruitStage(0)}
                    className="rounded-xl border border-amber-200 bg-white px-5 py-4 text-lg font-black text-amber-800 transition hover:bg-amber-50"
                  >
                    다시 보기
                  </button>
                  <Link
                    to={DEMO_REAL_PAGE_LINKS.wordFruit}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-emerald-800"
                  >
                    <Apple size={22} />
                    실제 말씀열매 열기
                  </Link>
                </div>
              </div>
            </div>
          )}

          {activeStep === 'family-worship' && (
            <div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-black text-amber-700">주일의 말씀을 가정으로</p>
                    <h3 className="mt-2 text-3xl font-black text-emerald-950">이번 주 가정예배</h3>
                    <p className="mt-4 max-w-3xl text-lg font-bold leading-8 text-slate-700">
                      가정예배 자료를 보고 함께 예배한 뒤, 짧은 나눔과 기도제목 또는 사진을 선택해서 남길 수 있습니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFamilyLogged(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-amber-600"
                  >
                    <Camera size={22} />
                    기록 남긴 모습 보기
                  </button>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {[
                    ['자료 보기', '이번 주 가정예배 순서와 말씀을 확인합니다.'],
                    ['나눔 기록', '감사와 기도제목을 600자 안에서 남깁니다.'],
                    ['공개 선택', '다른 가정에 공개하거나 교사·관리자만 보게 정합니다.'],
                  ].map(([title, body]) => (
                    <div key={title} className="rounded-xl border border-amber-100 bg-white p-5">
                      <p className="text-xl font-black text-emerald-950">{title}</p>
                      <p className="mt-2 text-sm font-bold leading-6 text-slate-600">{body}</p>
                    </div>
                  ))}
                </div>
                {familyLogged && (
                  <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-100 bg-white px-5 py-4 text-lg font-black text-emerald-800">
                    <CheckCircle2 size={24} />
                    이번 주 가정예배 기록이 우리 아이와 함께 연결됐어요.
                  </div>
                )}
              </div>
              <Link
                to={DEMO_REAL_PAGE_LINKS.familyWorship}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-emerald-800 sm:w-auto"
              >
                <Home size={22} />
                실제 가정예배 탭 열기
              </Link>
            </div>
          )}

          {activeStep === 'qa-notifications' && (
            <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-start">
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6">
                <p className="text-sm font-black text-amber-700">말씀과 신앙에 관한 대화</p>
                <h3 className="mt-2 text-3xl font-black text-emerald-950">부모님도 질문할 수 있어요</h3>
                <p className="mt-4 text-lg font-bold leading-8 text-slate-700">
                  아이와 나누다 생긴 질문이나 신앙의 고민을 남기면 목사님의 답변을 확인할 수 있습니다.
                </p>
                <button
                  type="button"
                  onClick={() => setQuestionSent(true)}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-amber-600"
                >
                  <MessageSquare size={22} />
                  질문 카드 체험하기
                </button>
                <Link
                  to={DEMO_REAL_PAGE_LINKS.qa}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-emerald-800"
                >
                  <HelpCircle size={22} />
                  실제 질문있습니다 열기
                </Link>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
                  {questionSent ? (
                    <>
                      <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">비공개 · 답변 기다리는 중</span>
                      <h4 className="mt-4 text-2xl font-black text-emerald-950">아이의 신앙 질문에 어떻게 답하면 좋을까요?</h4>
                      <p className="mt-3 text-base font-bold leading-7 text-slate-700">
                        비공개로 남기면 작성자와 목사님만 질문과 답변을 볼 수 있습니다.
                      </p>
                    </>
                  ) : (
                    <p className="text-lg font-bold leading-8 text-slate-500">버튼을 누르면 부모님의 질문 카드 예시가 나타납니다.</p>
                  )}
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                  <div className="flex items-center gap-3">
                    <Bell className="text-emerald-700" size={23} />
                    <h4 className="text-xl font-black text-emerald-950">알림으로 놓치지 않아요</h4>
                  </div>
                  <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
                    상단 종 모양에서 새 자료와 가입 승인, 질문 답변 안내를 확인할 수 있습니다. 휴대폰 알림은 브라우저에서 허용한 경우에만 도착합니다.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
