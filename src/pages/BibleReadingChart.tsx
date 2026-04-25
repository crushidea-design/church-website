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
              auto-generated SVG placeholder so the feature always renders. */}
          <div className="relative w-full overflow-hidden rounded-xl border border-amber-100 bg-amber-50">
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
            <div className="absolute inset-0">
              {BIBLE_BOOK_SPOTS.map((spot) => {
                const completed = completedSet.has(spot.name);
                const fillColor = completed
                  ? spot.testament === 'old'
                    ? 'bg-amber-400/55'
                    : 'bg-rose-400/55'
                  : 'bg-transparent';
                const debugBorder = showDebug ? 'border border-emerald-500/80' : 'border-transparent';

                const commonClass = `absolute ${fillColor} ${debugBorder} transition-colors`;
                const style: React.CSSProperties = {
                  top: `${spot.top}%`,
                  left: `${spot.left}%`,
                  width: `${spot.width}%`,
                  height: `${spot.height}%`,
                };

                if (showInteractive) {
                  return (
                    <button
                      key={spot.name}
                      type="button"
                      onClick={() => toggleBook(spot)}
                      title={spot.name}
                      disabled={savingBook === spot.name}
                      style={style}
                      className={`${commonClass} cursor-pointer rounded-sm hover:bg-amber-300/40 disabled:opacity-60`}
                    >
                      {showDebug && (
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-emerald-900">
                          {spot.abbr}
                        </span>
                      )}
                    </button>
                  );
                }

                return (
                  <div key={spot.name} title={spot.name} style={style} className={commonClass}>
                    {showDebug && (
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-emerald-900">
                        {spot.abbr}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
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
