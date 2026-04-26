import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { arrayRemove, arrayUnion } from 'firebase/firestore';
import { BookOpen, Eye, EyeOff, Loader2, UserSearch } from 'lucide-react';
import { db } from '../lib/firebase';
import { useNextGenerationAuth, NextGenerationMember } from '../lib/nextGenerationAuth';
import {
  BIBLE_BOOKS_NT_COUNT,
  BIBLE_BOOKS_OT_COUNT,
  BIBLE_BOOKS_TOTAL,
  BIBLE_BOOK_SPOTS,
  BibleBookSpot,
  CHART_VIEWBOX,
} from '../lib/bibleReadingLayout';

interface BibleReadingDoc {
  uid: string;
  displayName?: string;
  completedBooks?: string[];
  updatedAt?: any;
  updatedBy?: string;
}

const READING_COLLECTION = 'next_generation_bible_reading';

interface BibleReadingChartProps {
  enableBrowse?: boolean;
}

export default function BibleReadingChart({ enableBrowse = false }: BibleReadingChartProps) {
  const { user, member, isPastor, isMember } = useNextGenerationAuth();
  const isStudent = isMember && member?.department === '학생';

  // Pastor: pick which student to view/edit. Default to none until selected.
  const [students, setStudents] = useState<NextGenerationMember[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [selectedStudentUid, setSelectedStudentUid] = useState<string>('');
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseReadings, setBrowseReadings] = useState<BibleReadingDoc[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [selectedBrowseUid, setSelectedBrowseUid] = useState<string>('');

  // Whose document we're viewing.
  const targetUid = isPastor ? selectedStudentUid : selectedBrowseUid || user?.uid || '';
  const targetMember = isPastor
    ? students.find((s) => s.uid === selectedStudentUid)
    : selectedBrowseUid
      ? browseReadings.find((item) => item.uid === selectedBrowseUid)
      : member;

  const [reading, setReading] = useState<BibleReadingDoc | null>(null);
  const [readingLoading, setReadingLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [savingBook, setSavingBook] = useState<string | null>(null);

  // Pastor — load student member list (department === '학생', role === 'member')
  useEffect(() => {
    if (!isPastor) {
      setStudents([]);
      setStudentsLoading(false);
      return;
    }
    setStudentsLoading(true);
    const q = query(
      collection(db, 'next_generation_members'),
      where('department', '==', '학생'),
      where('role', '==', 'member'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as NextGenerationMember)
          .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'ko'));
        setStudents(list);
        setStudentsLoading(false);
      },
      () => setStudentsLoading(false),
    );
    return () => unsub();
  }, [isPastor]);

  useEffect(() => {
    if (!enableBrowse || !user || !isStudent) {
      setBrowseReadings([]);
      setBrowseLoading(false);
      return;
    }

    setBrowseLoading(true);
    const unsub = onSnapshot(
      collection(db, READING_COLLECTION),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ uid: d.id, ...(d.data() as BibleReadingDoc) }))
          .filter((item) => item.uid !== user.uid)
          .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'ko'));
        setBrowseReadings(list);
        setBrowseLoading(false);
      },
      () => setBrowseLoading(false),
    );
    return () => unsub();
  }, [enableBrowse, isStudent, user]);

  // Subscribe to the target student's reading document
  useEffect(() => {
    if (!targetUid) {
      setReading(null);
      setReadingLoading(false);
      return;
    }
    setReadingLoading(true);
    const ref = doc(db, READING_COLLECTION, targetUid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setReading(snap.data() as BibleReadingDoc);
        } else {
          setReading({ uid: targetUid, completedBooks: [] });
        }
        setReadingLoading(false);
      },
      () => setReadingLoading(false),
    );
    return () => unsub();
  }, [targetUid]);

  const completedSet = useMemo(
    () => new Set(reading?.completedBooks ?? []),
    [reading?.completedBooks],
  );

  const otRead = useMemo(
    () => BIBLE_BOOK_SPOTS.filter((s) => s.testament === 'old' && completedSet.has(s.name)).length,
    [completedSet],
  );
  const ntRead = useMemo(
    () => BIBLE_BOOK_SPOTS.filter((s) => s.testament === 'new' && completedSet.has(s.name)).length,
    [completedSet],
  );
  const totalRead = otRead + ntRead;
  const percent = Math.round((totalRead * 100) / BIBLE_BOOKS_TOTAL);

  const canEdit = !!isPastor && !!targetUid;
  const viewingOtherStudent = !isPastor && !!selectedBrowseUid;

  const toggleBook = async (spot: BibleBookSpot) => {
    if (!canEdit || !targetUid || !user) return;
    const isCompleted = completedSet.has(spot.name);
    setSavingBook(spot.name);
    try {
      const ref = doc(db, READING_COLLECTION, targetUid);
      const exists = !!reading?.updatedAt;
      if (!exists) {
        await setDoc(ref, {
          uid: targetUid,
          displayName: targetMember?.displayName || '',
          completedBooks: isCompleted ? [] : [spot.name],
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } else {
        await updateDoc(ref, {
          completedBooks: isCompleted ? arrayRemove(spot.name) : arrayUnion(spot.name),
          displayName: targetMember?.displayName || reading?.displayName || '',
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      }
    } finally {
      setSavingBook(null);
    }
  };

  // Decide what to show based on viewer
  const showInteractive = canEdit;
  const showReadOnlyData = !!isStudent;
  const showEmptyChart = !isPastor && !isStudent; // visitors / other roles see decorative chart

  return (
    <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
          <BookOpen size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-black tracking-normal text-emerald-950">성경 읽기 기록표</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {viewingOtherStudent && `${targetMember?.displayName || '다른 친구'}의 기록표를 읽기 전용으로 보고 있어요.`}
            {isPastor && '학생을 선택해 읽은 책에 색을 칠해 주세요.'}
            {isStudent && '내가 읽은 성경에 색이 칠해져요. 끝까지 함께 읽어 봐요!'}
            {!isPastor && !isStudent && '유초등부 학생이 성경 한 권씩 읽을 때마다 책장에 색이 채워집니다.'}
          </p>
        </div>
        {isPastor && (
          <button
            type="button"
            onClick={() => setShowDebug((v) => !v)}
            className="rounded-lg border border-amber-200 px-2.5 py-1 text-xs font-bold text-amber-700 hover:bg-amber-50"
            title="좌표 디버그 모드"
          >
            {showDebug ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        )}
      </div>

      {isPastor && (
        <div className="mb-3 flex items-center gap-2">
          <UserSearch size={14} className="text-amber-600" />
          <select
            value={selectedStudentUid}
            onChange={(e) => setSelectedStudentUid(e.target.value)}
            className="flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            disabled={studentsLoading}
          >
            <option value="">— 학생 선택 —</option>
            {students.map((s) => (
              <option key={s.uid} value={s.uid}>{s.displayName}</option>
            ))}
          </select>
          {studentsLoading && <Loader2 size={14} className="animate-spin text-amber-600" />}
        </div>
      )}

      {isPastor && !targetUid && (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-center text-sm font-medium text-amber-800">
          위에서 학생을 선택해 주세요. {students.length === 0 && !studentsLoading && '(아직 학생 부서로 승인된 회원이 없습니다.)'}
        </div>
      )}

      {enableBrowse && isStudent && (
        <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black text-emerald-950">
                {viewingOtherStudent ? `${targetMember?.displayName || '친구'} 기록표 구경 중` : '내 성경 읽기 기록표'}
              </p>
              <p className="mt-1 text-xs font-bold text-emerald-700">
                다른 학생들의 기록표는 읽기 전용으로만 볼 수 있어요.
              </p>
            </div>
            <div className="flex gap-2">
              {viewingOtherStudent && (
                <button
                  type="button"
                  onClick={() => setSelectedBrowseUid('')}
                  className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50"
                >
                  내 기록표
                </button>
              )}
              <button
                type="button"
                onClick={() => setBrowseOpen((v) => !v)}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >
                다른 사람 기록표 구경하기
              </button>
            </div>
          </div>
          {browseOpen && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {browseLoading ? (
                <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-500">
                  <Loader2 size={14} className="animate-spin" /> 불러오는 중
                </div>
              ) : browseReadings.length === 0 ? (
                <p className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-500">
                  아직 구경할 수 있는 다른 기록표가 없습니다.
                </p>
              ) : (
                browseReadings.map((item) => {
                  const count = item.completedBooks?.length || 0;
                  const selected = item.uid === selectedBrowseUid;
                  return (
                    <button
                      key={item.uid}
                      type="button"
                      onClick={() => setSelectedBrowseUid(item.uid)}
                      className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                        selected
                          ? 'border-emerald-500 bg-emerald-600 text-white'
                          : 'border-emerald-100 bg-white text-emerald-950 hover:border-emerald-300'
                      }`}
                    >
                      <span className="block font-black">{item.displayName || '이름 없는 학생'}</span>
                      <span className={selected ? 'text-emerald-50' : 'text-slate-500'}>
                        {count}/{BIBLE_BOOKS_TOTAL}권
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {(!isPastor || !!targetUid) && (
        <>
          {/* Progress counter */}
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-bold text-emerald-950">
            <span>구약 {otRead}/{BIBLE_BOOKS_OT_COUNT}</span>
            <span className="text-amber-300">·</span>
            <span>신약 {ntRead}/{BIBLE_BOOKS_NT_COUNT}</span>
            <span className="text-amber-300">·</span>
            <span>전체 {totalRead}/{BIBLE_BOOKS_TOTAL} ({percent}%)</span>
            {readingLoading && <Loader2 size={12} className="ml-auto animate-spin text-amber-600" />}
          </div>

          {/* Bookshelf with overlay.
              Tries the hand-illustrated PNG first; falls back to the
              auto-generated SVG placeholder so the feature always renders.
              Capped to a comfortable display size — the source PNG is large
              and would otherwise dominate the band when expanded. */}
          <div
            className="relative mx-auto w-full max-w-md overflow-hidden rounded-xl border border-amber-100 bg-amber-50"
            style={{ aspectRatio: '2265 / 2806' }}
          >
            <img
              src="/bible-reading-chart.png"
              alt="성경 읽기 기록표 책장"
              className="absolute inset-0 block h-full w-full select-none"
              draggable={false}
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
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
              aria-label="성경 읽기 기록표 색칠 영역"
              xmlns="http://www.w3.org/2000/svg"
            >
              {BIBLE_BOOK_SPOTS.map((spot) => {
                const shape = spot.shape;

                const completed = completedSet.has(spot.name);
                const fill = completed
                  ? spot.testament === 'old'
                    ? 'rgba(251, 191, 36, 0.55)'
                    : 'rgba(251, 113, 133, 0.55)'
                  : 'rgba(255, 255, 255, 0.001)';
                const stroke = showDebug ? 'rgba(16, 185, 129, 0.9)' : 'transparent';
                const commonProps = {
                  fill,
                  stroke,
                  strokeWidth: 5,
                  vectorEffect: 'non-scaling-stroke' as const,
                  className: showInteractive
                    ? 'cursor-pointer transition-colors hover:fill-amber-300/40'
                    : 'transition-colors',
                  style: { opacity: savingBook === spot.name ? 0.6 : 1 },
                  onClick: () => {
                    if (showInteractive && savingBook !== spot.name) toggleBook(spot);
                  },
                  onKeyDown: (event: React.KeyboardEvent<SVGElement>) => {
                    if (!showInteractive || savingBook === spot.name) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleBook(spot);
                    }
                  },
                  role: showInteractive ? 'button' : undefined,
                  tabIndex: showInteractive ? 0 : -1,
                  'aria-label': spot.name,
                };

                return shape.type === 'path' ? (
                  <path key={spot.name} d={shape.d} {...commonProps}>
                    <title>{spot.name}</title>
                  </path>
                ) : (
                  <rect
                    key={spot.name}
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    transform={shape.transform}
                    rx={14}
                    {...commonProps}
                  >
                    <title>{spot.name}</title>
                  </rect>
                );
              })}
            </svg>
          </div>

          {showReadOnlyData && reading && totalRead === 0 && (
            <p className="mt-3 text-center text-xs text-slate-500">
              아직 읽은 책이 없어요. 한 권씩 차근차근 읽어 봐요!
            </p>
          )}
          {showEmptyChart && (
            <p className="mt-3 text-center text-xs text-slate-500">
              학생 회원으로 가입하면 자기 책장이 함께 채워집니다.
            </p>
          )}
        </>
      )}
    </div>
  );
}
