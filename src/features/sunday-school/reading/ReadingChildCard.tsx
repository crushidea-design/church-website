// One child's "올해 성경 읽기": this-week card, year progress line, then the bookshelf.
import React, { useEffect, useMemo, useState } from 'react';
import { SCHOOL_CLASS_NAMES } from '../classScreen';
import type { JourneyChild } from '../journey/useJourneyChildren';
import ReadingShelf from './ReadingShelf';
import { BIBLE_CANON } from './bibleCanon';
import {
  TOTAL_CHAPTERS,
  applyCheck,
  canCheckReading,
  canUndoLastCheck,
  chapterRefFromIndex,
  currentBookName,
  defaultCheckTarget,
  formatRange,
  indexFromChapterRef,
  lastCheckLabel,
  nextReadingLabel,
  percentRead,
  plannedChaptersByEndOf,
  plannedRangeForDate,
  readingYearFor,
  undoLastCheck,
  weekPlan,
  weekStamps,
} from './reading';
import type { ReadingState } from './reading';
import { saveReadingState, stateFromDoc, subscribeReadingForStudent } from './readingApi';
import type { ReadingYearDoc } from './readingApi';

const formatRangeOrRest = (from: number, to: number, empty: boolean) =>
  empty ? '오늘은 쉬어 가요' : formatRange(from, to);

export default function ReadingChildCard({ child, todayKey, uid }: { child: JourneyChild; todayKey: string; uid: string }) {
  const classId = child.classId;
  const year = readingYearFor(todayKey);
  const [row, setRow] = useState<ReadingYearDoc | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setRow(null);
    setLoaded(false);
    if (!classId) return;
    return subscribeReadingForStudent(
      child.uid,
      year,
      (rows) => {
        setRow(rows[0] ?? null);
        setLoaded(true);
      },
      () => {
        setError('기록을 불러오지 못했어요. 화면을 새로 고쳐 주세요.');
        setLoaded(true);
      },
    );
  }, [child.uid, classId, year]);

  const state = useMemo(() => stateFromDoc(row), [row]);
  const { chaptersRead } = state;
  const finished = chaptersRead >= TOTAL_CHAPTERS;

  const today = useMemo(() => plannedRangeForDate(year, todayKey), [year, todayKey]);
  const week = useMemo(() => weekPlan(year, todayKey), [year, todayKey]);
  const stamps = useMemo(() => weekStamps(state.log, todayKey), [state.log, todayKey]);
  const goalLine = plannedChaptersByEndOf(year, todayKey);
  const beforeYear = todayKey < `${year}-01-01`;

  // "up to" picker: a book and a chapter, never before the next unread chapter.
  const startTarget = defaultCheckTarget(year, todayKey, chaptersRead);
  const [pickBook, setPickBook] = useState('');
  const [pickChapter, setPickChapter] = useState(1);
  useEffect(() => {
    if (!picking) return;
    const ref = chapterRefFromIndex(startTarget);
    if (ref) {
      setPickBook(ref.book);
      setPickChapter(ref.chapter);
    }
    // only reset when the picker opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picking]);

  if (!classId) return null;

  const canCheck = canCheckReading({ classId, viewer: child.viewer, isProxyChild: child.isProxy });
  const bookIndex = Math.max(0, BIBLE_CANON.findIndex((book) => book.name === pickBook));
  const firstUnread = chapterRefFromIndex(chaptersRead + 1);
  const firstBookIndex = firstUnread?.bookIndex ?? 0;
  const chapterOptions = (() => {
    const count = BIBLE_CANON[bookIndex].chapters;
    const lowest = bookIndex === firstBookIndex ? (firstUnread?.chapter ?? 1) : 1;
    return Array.from({ length: count - lowest + 1 }, (_, i) => lowest + i);
  })();
  const pickedTo = indexFromChapterRef(pickBook, pickChapter) ?? 0;
  const pickedValid = pickedTo > chaptersRead;

  const persist = async (next: ReadingState | null) => {
    if (!next || busy) return;
    setBusy(true);
    setError('');
    try {
      await saveReadingState({
        year,
        studentUid: child.uid,
        studentName: child.name,
        classId,
        state: next,
        updatedBy: uid,
      });
      setPicking(false);
    } catch {
      console.error('Failed to save the Bible reading record');
      setError('저장하지 못했어요. 잠시 뒤에 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const confirmCheck = () => persist(applyCheck(state, todayKey, pickedTo));

  const checkerNote =
    classId === 'seum'
      ? '아이와 부모님이 함께 체크할 수 있어요.'
      : child.isProxy
        ? '부모님이 대신 체크해 주세요.'
        : '학생 본인이 체크해요. 옆에서 응원해 주세요.';

  return (
    <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="text-lg font-black text-emerald-950">{child.name}</h3>
      <p className="mt-0.5 text-xs font-bold text-slate-500">
        {SCHOOL_CLASS_NAMES[classId]} · {year}년 성경 1독
      </p>

      {/* 1. this week */}
      <section className="mt-3 rounded-xl bg-emerald-50 p-3" aria-label="이번 주 성경 읽기">
        <h4 className="text-sm font-black text-emerald-950">이번 주</h4>
        {beforeYear && (
          <p className="mt-1 text-xs font-bold text-emerald-800">{year}년 1월 1일부터 시작해요. 미리 읽어도 좋아요.</p>
        )}
        <dl className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-black text-slate-500">오늘 분량</dt>
            <dd className="font-black text-slate-900">{formatRangeOrRest(today.from, today.to, today.empty) || '-'}</dd>
          </div>
          <div>
            <dt className="text-xs font-black text-slate-500">이번 주 분량</dt>
            <dd className="font-black text-slate-900">{formatRangeOrRest(week.from, week.to, week.empty) || '-'}</dd>
          </div>
        </dl>
        <div role="group" aria-label="이번 주 읽은 날" className="mt-3 grid grid-cols-7 gap-1">
          {stamps.map((day) => (
            <div
              key={day.date}
              aria-label={`${day.label}요일${day.checked ? ' 읽었어요' : ''}`}
              className={`flex min-h-[44px] flex-col items-center justify-center rounded-lg border text-xs font-black ${
                day.checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              <span>{day.label}</span>
              <span aria-hidden="true" className="text-sm leading-none">
                {day.checked ? '✓' : '·'}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm font-black text-emerald-900">
          {finished ? '성경 전체를 다 읽었어요. 정말 감사해요!' : `다음 읽을 곳: ${nextReadingLabel(chaptersRead)}`}
        </p>

        {canCheck ? (
          picking ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3">
              <p className="text-sm font-black text-slate-900">오늘 어디까지 읽었나요?</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs font-black text-slate-500">책</span>
                  <select
                    value={pickBook}
                    onChange={(e) => {
                      const nextIndex = BIBLE_CANON.findIndex((book) => book.name === e.target.value);
                      setPickBook(e.target.value);
                      setPickChapter(nextIndex === firstBookIndex ? (firstUnread?.chapter ?? 1) : 1);
                    }}
                    className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold"
                  >
                    {BIBLE_CANON.slice(firstBookIndex).map((book) => (
                      <option key={book.name} value={book.name}>
                        {book.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-black text-slate-500">장</span>
                  <select
                    value={pickChapter}
                    onChange={(e) => setPickChapter(Number(e.target.value))}
                    className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold"
                  >
                    {chapterOptions.map((chapter) => (
                      <option key={chapter} value={chapter}>
                        {chapter}장
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-2 text-xs font-bold text-slate-600">
                {pickedValid ? `${formatRange(chaptersRead + 1, pickedTo)}를 읽었어요` : '읽은 곳을 골라 주세요'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={confirmCheck}
                  disabled={busy || !pickedValid}
                  className="min-h-[44px] rounded-xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-50"
                >
                  {busy ? '저장 중...' : '여기까지 읽었어요'}
                </button>
                <button
                  type="button"
                  onClick={() => setPicking(false)}
                  disabled={busy}
                  className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
                >
                  닫기
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!finished && (
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  disabled={busy || !loaded}
                  className="min-h-[44px] rounded-xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-50"
                >
                  다 읽었어요
                </button>
              )}
              {canUndoLastCheck(state) && (
                <button
                  type="button"
                  onClick={() => persist(undoLastCheck(state))}
                  disabled={busy}
                  className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  방금 체크 취소 ({lastCheckLabel(state)})
                </button>
              )}
            </div>
          )
        ) : null}
        <p className="mt-2 text-xs text-slate-500">{checkerNote}</p>
      </section>

      {/* 2. year progress */}
      <section className="mt-4" aria-label="올해 진도">
        <p className="text-sm font-black text-emerald-950">
          {chaptersRead.toLocaleString('ko-KR')}장 / {TOTAL_CHAPTERS.toLocaleString('ko-KR')}장 ({percentRead(chaptersRead)}%)
        </p>
        <div
          className="relative mt-1.5 h-2.5 rounded-full bg-slate-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={TOTAL_CHAPTERS}
          aria-valuenow={chaptersRead}
          aria-label="올해 성경 읽기 진도"
        >
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(chaptersRead / TOTAL_CHAPTERS) * 100}%` }} />
          {goalLine > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-1 w-0.5 rounded bg-amber-500"
              style={{ left: `${(goalLine / TOTAL_CHAPTERS) * 100}%`, height: '1.125rem' }}
            />
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          <span className="font-black text-amber-600">|</span> 오늘 계획선이에요. 천천히 이어 읽어도 괜찮아요.
        </p>
      </section>

      {/* 3. bookshelf */}
      <section className="mt-4" aria-label="책장">
        <ReadingShelf chaptersRead={chaptersRead} currentBook={currentBookName(chaptersRead)} />
        <p className="mt-2 text-center text-xs text-slate-500">읽은 만큼 책이 채워지고, 책갈피가 지금 읽는 책을 알려 줘요.</p>
      </section>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          {error}
        </p>
      )}
    </article>
  );
}
