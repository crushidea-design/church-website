import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  BookOpen,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Edit,
  ExternalLink,
  Loader2,
  Lock,
} from 'lucide-react';
import { useTodayWordData } from '../hooks/useTodayWordData';

interface Props {
  /** When true the component drops its outer max-width and padding so it can sit in a column. */
  compact?: boolean;
}

export default function NextGenerationTodayWord({ compact = false }: Props) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [guideTextSize, setGuideTextSize] = useState(1);
  const {
    selectedDate,
    setSelectedDate,
    dateStr,
    readingPlan,
    isSelectedLeapDay,
    latestPost,
    loading,
    readingProgress,
    meditation,
    setMeditation,
    toggleProgress,
    saveProgress,
    savingProgress,
    saveMessage,
    isAuthenticated,
    isAdmin,
  } = useTodayWordData();

  const [bridge, setBridge] = useState<{ link: string; version: string } | null>(null);
  const guideTextClasses = ['text-sm leading-7', 'text-base leading-8', 'text-lg leading-9', 'text-xl leading-10'];

  const openBridge = (link: string, version: string) => setBridge({ link, version });

  const launchBridge = () => {
    if (!bridge) return;
    const width = 1000;
    const height = 800;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    window.open(
      bridge.link,
      'BibleViewer',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`,
    );
    setBridge(null);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = new Date(e.target.value);
    if (!Number.isNaN(next.getTime())) setSelectedDate(next);
  };

  return (
    <div className={compact ? '' : 'mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8'}>
      <div className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-emerald-700">
              <BookOpen size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-normal text-emerald-950">오늘의 말씀</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                맥체인 성경 읽기와 묵상 가이드를 매일 함께해요.
              </p>
            </div>
          </div>

          {/* Date picker */}
          <div
            onClick={() => {
              if (dateInputRef.current?.showPicker) {
                dateInputRef.current.showPicker();
              } else {
                dateInputRef.current?.click();
              }
            }}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-emerald-950 hover:bg-sky-100"
          >
            <CalendarIcon size={14} className="text-emerald-700" />
            <span className="font-bold">{dateStr}</span>
            <span className="text-xs text-slate-500">({format(selectedDate, 'EEEE', { locale: ko })})</span>
            <input
              ref={dateInputRef}
              type="date"
              value={dateStr}
              onChange={handleDateChange}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="sr-only"
              aria-hidden="true"
            />
          </div>
        </div>

        {isSelectedLeapDay && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
            2월 29일은 윤년 보정일이라 별도 본문이 없어요. 지난 본문을 다시 묵상해 봐요.
          </div>
        )}

        {/* McCheyne reading plan */}
        {readingPlan.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {readingPlan.map((passage, index) => {
              const completed = !!readingProgress[index];
              return (
                <div
                  key={index}
                  className={`relative flex flex-col rounded-xl border px-4 py-3 transition ${
                    completed
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-sky-100 bg-sky-50/60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleProgress(index)}
                    className="absolute right-3 top-3 text-slate-400 transition hover:text-emerald-700"
                    title={completed ? '읽음 취소' : '읽음 완료'}
                  >
                    {completed ? (
                      <CheckCircle2 size={22} className="text-emerald-600" />
                    ) : (
                      <Circle size={22} />
                    )}
                  </button>
                  <span
                    className={`mb-4 mr-9 text-xl font-black sm:text-base ${
                      completed ? 'text-slate-400 line-through' : 'text-emerald-950'
                    }`}
                  >
                    {passage.text}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openBridge(passage.gaeLink, '개역개정')}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-950 shadow-sm hover:bg-sky-100 sm:px-2.5 sm:py-1 sm:text-xs"
                    >
                      <BookOpen size={14} /> 개역개정
                    </button>
                    <button
                      type="button"
                      onClick={() => openBridge(passage.saeHangeulLink, '새한글성경')}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-950 shadow-sm hover:bg-sky-100 sm:px-2.5 sm:py-1 sm:text-xs"
                    >
                      <BookOpen size={14} /> 새한글성경
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-sky-200 bg-sky-50 px-4 py-6 text-center text-sm text-slate-600">
            오늘은 별도 읽기표가 없어요.
          </div>
        )}

        {/* Guide post */}
        <div className="mt-5 rounded-xl border border-sky-100 bg-white p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-black text-emerald-950">묵상 가이드</h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-sky-200 bg-sky-50 p-1">
                <button
                  type="button"
                  onClick={() => setGuideTextSize((size) => Math.max(0, size - 1))}
                  className="rounded-md px-2.5 py-1 text-sm font-black text-emerald-900 hover:bg-white disabled:opacity-40"
                  disabled={guideTextSize === 0}
                  aria-label="묵상 가이드 글자 줄이기"
                >
                  A-
                </button>
                <button
                  type="button"
                  onClick={() => setGuideTextSize((size) => Math.min(guideTextClasses.length - 1, size + 1))}
                  className="rounded-md px-2.5 py-1 text-sm font-black text-emerald-900 hover:bg-white disabled:opacity-40"
                  disabled={guideTextSize === guideTextClasses.length - 1}
                  aria-label="묵상 가이드 글자 키우기"
                >
                  A+
                </button>
              </div>
              {isAdmin && (
                <Link
                  to="/create-post?type=today_word"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-coral-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-coral-700"
                >
                  <Edit size={12} /> 가이드 작성
                </Link>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-emerald-600" />
            </div>
          ) : latestPost ? (
            <div>
              <h4 className="text-base font-black text-emerald-950">{latestPost.title}</h4>
              <p className="mt-1 text-xs text-slate-500">
                {latestPost.authorName} · {latestPost.createdAt?.toDate
                  ? format(latestPost.createdAt.toDate(), 'yyyy.MM.dd')
                  : ''}
              </p>
              <div className={`mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap text-slate-800 ${guideTextClasses[guideTextSize]}`}>
                {latestPost.content}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-sky-200 bg-sky-50/60 px-4 py-6 text-center text-xs text-slate-500">
              해당 날짜에 등록된 묵상 가이드가 없어요.
            </div>
          )}
        </div>

        {/* Private meditation */}
        <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/60 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="flex items-center gap-1 text-sm font-black text-emerald-950">
              <Edit size={14} /> 오늘의 한줄 묵상
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                {savingProgress ? '저장 중...' : saveMessage}
              </span>
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => saveProgress()}
                  disabled={savingProgress}
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  저장
                </button>
              )}
            </div>
          </div>
          {isAuthenticated ? (
            <textarea
              value={meditation}
              onChange={(e) => setMeditation(e.target.value)}
              placeholder="다른 사람에게 공개되지 않습니다. 자유롭게 적어 보세요."
              rows={3}
              className="w-full resize-none rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400"
            />
          ) : (
            <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-sky-200 bg-white px-4 py-6 text-xs text-slate-500">
              <Lock size={14} /> 로그인 후 묵상을 기록할 수 있어요.
            </p>
          )}
        </div>
      </div>

      {/* Bridge Modal */}
      {bridge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-2xl">
            <div className="bg-emerald-700 p-4 text-center">
              <BookOpen className="mx-auto mb-2 text-amber-200" size={28} />
              <h3 className="text-lg font-black text-white">외부 사이트 이동 안내</h3>
            </div>
            <div className="p-6 text-center">
              <p className="text-sm font-bold text-emerald-950">대한성서공회 사이트로 이동합니다.</p>
              <p className="mt-2 text-xs leading-6 text-slate-600">
                성경을 다 읽으신 후 브라우저의 <span className="font-bold text-emerald-950">'완료'</span>나{' '}
                <span className="font-bold text-emerald-950">'닫기'</span>를 눌러 다시 돌아와 주세요.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={launchBridge}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800"
                >
                  {bridge.version} 읽기 시작 <ExternalLink size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setBridge(null)}
                  className="rounded-lg border border-sky-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 hover:bg-sky-50"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
