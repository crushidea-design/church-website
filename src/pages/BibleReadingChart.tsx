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
} from '../lib/bibleReadingLayout';

interface BibleReadingDoc {
  uid: string;
  displayName?: string;
  completedBooks?: string[];
  updatedAt?: any;
  updatedBy?: string;
}

const READING_COLLECTION = 'next_generation_bible_reading';

type ChartShape =
  | {
      type: 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
      transform?: string;
    }
  | {
      type: 'path';
      d: string;
    };

const CHART_VIEWBOX = '0 0 2061 2496';
const CHART_SHAPES: ChartShape[] = [
  {
    type: 'rect',
    x: 3,
    y: 40,
    width: 73,
    height: 432
  },
  {
    type: 'rect',
    x: 218,
    y: 46,
    width: 75,
    height: 426
  },
  {
    type: 'rect',
    x: 307,
    y: 44,
    width: 104,
    height: 426
  },
  {
    type: 'rect',
    x: 81.1835,
    y: 45.8705,
    width: 74.3318,
    height: 426.294,
    transform: 'rotate(-7.37314 81.1835 45.8705)'
  },
  {
    type: 'rect',
    x: 417,
    y: 49.8004,
    width: 76.3679,
    height: 430.075,
    transform: 'rotate(-7.37314 417 49.8004)'
  },
  {
    type: 'rect',
    x: 562,
    y: 321,
    width: 436,
    height: 73
  },
  {
    type: 'rect',
    x: 562,
    y: 400,
    width: 436,
    height: 72
  },
  {
    type: 'rect',
    x: 1069.98,
    y: 44.2572,
    width: 75,
    height: 423.725,
    transform: 'rotate(4.05681 1069.98 44.2572)'
  },
  {
    type: 'rect',
    x: 1148,
    y: 44,
    width: 108,
    height: 428
  },
  {
    type: 'rect',
    x: 1260.78,
    y: 47.2212,
    width: 77.469,
    height: 430.225,
    transform: 'rotate(-7.19438 1260.78 47.2212)'
  },
  {
    type: 'rect',
    x: 1398,
    y: 0,
    width: 78,
    height: 472
  },
  {
    type: 'rect',
    x: 1481,
    y: 44,
    width: 75,
    height: 428
  },
  {
    type: 'rect',
    x: 1560,
    y: 44,
    width: 108,
    height: 430
  },
  {
    type: 'rect',
    x: 1674,
    y: 44,
    width: 104,
    height: 430
  },
  {
    type: 'rect',
    x: 1795.62,
    y: 42,
    width: 74.0296,
    height: 430.62,
    transform: 'rotate(1.28743 1795.62 42)'
  },
  {
    type: 'rect',
    x: 1875,
    y: 44,
    width: 98,
    height: 428
  },
  {
    type: 'rect',
    x: 1982,
    y: 44,
    width: 75,
    height: 430
  },
  {
    type: 'rect',
    x: 1982,
    y: 718,
    width: 75,
    height: 428
  },
  {
    type: 'rect',
    x: 1764,
    y: 613,
    width: 77,
    height: 530
  },
  {
    type: 'rect',
    x: 1848.86,
    y: 718.567,
    width: 103.877,
    height: 430.313,
    transform: 'rotate(-2.97849 1848.86 718.567)'
  },
  {
    type: 'rect',
    x: 987,
    y: 756,
    width: 438,
    height: 71
  },
  {
    type: 'rect',
    x: 964,
    y: 834,
    width: 439,
    height: 72
  },
  {
    type: 'rect',
    x: 1000,
    y: 912,
    width: 438,
    height: 75
  },
  {
    type: 'rect',
    x: 926,
    y: 992,
    width: 440,
    height: 73
  },
  {
    type: 'rect',
    x: 978,
    y: 1071,
    width: 438,
    height: 73
  },
  {
    type: 'rect',
    x: 0,
    y: 717,
    width: 77,
    height: 429
  },
  {
    type: 'rect',
    x: 98.4507,
    y: 715.57,
    width: 104.643,
    height: 429,
    transform: 'rotate(1.68891 98.4507 715.57)'
  },
  {
    type: 'rect',
    x: 211,
    y: 714,
    width: 75,
    height: 429
  },
  {
    type: 'rect',
    x: 292.494,
    y: 718.529,
    width: 76.1213,
    height: 431,
    transform: 'rotate(-2.62417 292.494 718.529)'
  },
  {
    type: 'rect',
    x: 398,
    y: 717,
    width: 73,
    height: 429
  },
  {
    type: 'rect',
    x: 478,
    y: 717,
    width: 77,
    height: 429
  },
  {
    type: 'rect',
    x: 562,
    y: 673,
    width: 75,
    height: 473
  },
  {
    type: 'rect',
    x: 19,
    y: 1385,
    width: 97,
    height: 431
  },
  {
    type: 'rect',
    x: 127,
    y: 1285,
    width: 74,
    height: 531
  },
  {
    type: 'path',
    d: 'M211.032 1389.54L285.635 1386.04L305.861 1816.81L231.258 1820.32L211.032 1389.54Z'
  },
  {
    type: 'rect',
    x: 315,
    y: 1385,
    width: 96,
    height: 431
  },
  {
    type: 'rect',
    x: 419,
    y: 1385,
    width: 72,
    height: 435
  },
  {
    type: 'rect',
    x: 499,
    y: 1341,
    width: 74,
    height: 479
  },
  {
    type: 'rect',
    x: 579.888,
    y: 1389.91,
    width: 97.2804,
    height: 430.406,
    transform: 'rotate(-2.14002 579.888 1389.91)'
  },
  {
    type: 'rect',
    x: 702,
    y: 1386,
    width: 74,
    height: 430
  },
  {
    type: 'rect',
    x: 826,
    y: 1508,
    width: 438,
    height: 72
  },
  {
    type: 'rect',
    x: 789,
    y: 1585,
    width: 438,
    height: 77
  },
  {
    type: 'rect',
    x: 826,
    y: 1666,
    width: 438,
    height: 73
  },
  {
    type: 'rect',
    x: 789,
    y: 1744,
    width: 438,
    height: 75
  },
  {
    type: 'rect',
    x: 1281,
    y: 1287,
    width: 76,
    height: 532
  },
  {
    type: 'rect',
    x: 1415,
    y: 1666,
    width: 438,
    height: 73
  },
  {
    type: 'rect',
    x: 1381,
    y: 1744,
    width: 435,
    height: 75
  },
  {
    type: 'rect',
    x: 1881,
    y: 1387,
    width: 75,
    height: 428
  },
  {
    type: 'rect',
    x: 1960.25,
    y: 1386.57,
    width: 75,
    height: 435.842,
    transform: 'rotate(-3.38888 1960.25 1386.57)'
  },
  {
    type: 'rect',
    x: 1937,
    y: 2059,
    width: 75,
    height: 429
  },
  {
    type: 'rect',
    x: 1826.41,
    y: 2060,
    width: 105.853,
    height: 432.684,
    transform: 'rotate(1.92958 1826.41 2060)'
  },
  {
    type: 'rect',
    x: 1735,
    y: 1960,
    width: 72,
    height: 532
  },
  {
    type: 'rect',
    x: 1653,
    y: 1960,
    width: 75,
    height: 532
  },
  {
    type: 'rect',
    x: 1574,
    y: 1960,
    width: 74,
    height: 532
  },
  {
    type: 'rect',
    x: 1469,
    y: 2063,
    width: 95,
    height: 429
  },
  {
    type: 'rect',
    x: 1365,
    y: 2063,
    width: 96,
    height: 429
  },
  {
    type: 'rect',
    x: 905,
    y: 2180,
    width: 437,
    height: 75
  },
  {
    type: 'rect',
    x: 879,
    y: 2261,
    width: 435,
    height: 73
  },
  {
    type: 'rect',
    x: 913,
    y: 2340,
    width: 439,
    height: 74
  },
  {
    type: 'rect',
    x: 879,
    y: 2419,
    width: 435,
    height: 73
  },
  {
    type: 'rect',
    x: 750,
    y: 2062,
    width: 97,
    height: 430
  },
  {
    type: 'rect',
    x: 648,
    y: 2062,
    width: 96,
    height: 430
  },
  {
    type: 'rect',
    x: 565,
    y: 1958,
    width: 74,
    height: 534
  },
  {
    type: 'rect',
    x: 483,
    y: 1958,
    width: 76,
    height: 534
  },
  {
    type: 'rect',
    x: 40,
    y: 2341,
    width: 436,
    height: 72
  },
  {
    type: 'rect',
    x: 4,
    y: 2419,
    width: 436,
    height: 73
  }
];


export default function BibleReadingChart() {
  const { user, member, isPastor, isMember } = useNextGenerationAuth();
  const isStudent = isMember && member?.department === '학생';

  // Pastor: pick which student to view/edit. Default to none until selected.
  const [students, setStudents] = useState<NextGenerationMember[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [selectedStudentUid, setSelectedStudentUid] = useState<string>('');

  // Whose document we're viewing.
  const targetUid = isPastor ? selectedStudentUid : user?.uid || '';
  const targetMember = isPastor
    ? students.find((s) => s.uid === selectedStudentUid)
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
          <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-xl border border-amber-100 bg-amber-50">
            <img
              src="/bible-reading-chart.png"
              alt="성경 읽기 기록표 책장"
              className="block h-auto w-full select-none"
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
              {BIBLE_BOOK_SPOTS.map((spot, index) => {
                const shape = CHART_SHAPES[index];
                if (!shape) return null;

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
