// Teacher-facing pieces of the Word Fruit panel: hook + row + action
// list + main TeacherView. Extracted from WordFruitPanel.tsx.
import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { AlertCircle } from 'lucide-react';
import { db } from '../../lib/firebase';
import { WordFruitProgress } from './types';
import { TeacherStudent, mergeTeacherStudentsWithProgress } from './teacherRoster';
import {
  addTodayCheckByLeader,
  getTodayKey,
  upsertProgressByLeader,
} from './api';

export function useTeacherStudents(teacherGroupIds: string[]): TeacherStudent[] {
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  useEffect(() => {
    if (teacherGroupIds.length === 0) {
      setStudents([]);
      return;
    }
    const q = query(
      collection(db, 'next_generation_members'),
      where('role', '==', 'member'),
      where('department', '==', '학생'),
    );
    return onSnapshot(
      q,
      (snap) => {
        const items: TeacherStudent[] = [];
        snap.docs.forEach((d) => {
          const data = d.data() as any;
          const gid = data.groupId ?? '';
          if (teacherGroupIds.includes(gid)) {
            items.push({
              uid: data.uid ?? d.id,
              displayName: data.displayName ?? '이름 없음',
              groupId: gid,
            });
          }
        });
        items.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'));
        setStudents(items);
      },
      () => setStudents([]),
    );
  }, [teacherGroupIds.join('|')]);
  return students;
}
export function TeacherView({
  weekId,
  allProgress,
  teacherGroupIds,
  canEdit,
}: {
  weekId: string;
  allProgress: WordFruitProgress[];
  teacherGroupIds: string[];
  canEdit: boolean;
}) {
  const teacherStudents = useTeacherStudents(teacherGroupIds);
  const visibleTeacherStudents = useMemo(
    () => mergeTeacherStudentsWithProgress(teacherStudents, allProgress, teacherGroupIds),
    [teacherStudents, allProgress, teacherGroupIds],
  );
  if (teacherGroupIds.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-black">담당 반이 아직 지정되지 않았습니다.</p>
        <p className="mt-1 leading-6">
          담당 반 학생의 말씀 열매 진행을 보려면 다음세대 관리자에게 교사 계정의 담당 반을 먼저 배정해 달라고 요청해 주세요.
        </p>
      </div>
    );
  }
  if (allProgress.length === 0 && visibleTeacherStudents.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        이번 주 등록된 학생 진행이 없어요.
      </div>
    );
  }
  const completed = allProgress.filter((p) => p.completed).length;
  const notStarted = allProgress.filter((p) => p.checkCount === 0);
  const growing = allProgress.length - completed - notStarted.length;
  // After Tuesday with no check, surface a stronger nudge.
  const today = new Date();
  const weekday = today.getDay(); // 0=Sun..6=Sat
  const midweekOrLater = weekday === 0 || weekday >= 3;

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-black text-emerald-950">학생 진행 현황</h3>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
            완료 {completed}
          </span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
            진행 중 {growing}
          </span>
          <span className={`rounded-full px-2 py-0.5 ${
            notStarted.length > 0 && midweekOrLater
              ? 'bg-rose-100 text-rose-800'
              : 'bg-slate-100 text-slate-600'
          }`}>
            미시작 {notStarted.length}
          </span>
        </div>
      </div>

      {notStarted.length > 0 && midweekOrLater && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <div>
            이번 주 한 번도 체크하지 않은 학생이 {notStarted.length}명 있어요. 격려해 주세요.
            <p className="mt-1 font-bold">
              {notStarted.map((p) => p.childName).join(', ')}
            </p>
          </div>
        </div>
      )}

      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-bold">아이</th>
              <th className="px-3 py-2 text-left font-bold">작은 순종</th>
              <th className="px-3 py-2 text-left font-bold">체크</th>
              <th className="px-3 py-2 text-left font-bold">상태</th>
            </tr>
          </thead>
          <tbody>
            {allProgress.map((p) => {
              const isNotStarted = p.checkCount === 0;
              const rowHighlight = isNotStarted && midweekOrLater
                ? 'bg-rose-50/60'
                : '';
              return (
                <tr key={p.id} className={`border-t border-slate-100 ${rowHighlight}`}>
                  <td className="px-3 py-2 font-bold text-slate-800">{p.childName}</td>
                  <td className="px-3 py-2 text-slate-700">{p.practice}</td>
                  <td className="px-3 py-2 text-slate-700">{Math.min(p.checkCount, 3)}/3</td>
                  <td className="px-3 py-2 text-slate-500">
                    {p.completed
                      ? '완료'
                      : p.checkCount > 0
                        ? '익어가는 중'
                        : isNotStarted && midweekOrLater
                          ? <span className="font-bold text-rose-700">아직 미시작</span>
                          : '자라는 중'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canEdit && visibleTeacherStudents.length > 0 && (
        <TeacherStudentActionList
          students={visibleTeacherStudents}
          weekId={weekId}
          allProgress={allProgress}
        />
      )}

    </div>
  );
}

function TeacherStudentActionList({
  students,
  weekId,
  allProgress,
}: {
  students: TeacherStudent[];
  weekId: string;
  allProgress: WordFruitProgress[];
}) {
  const progressByUid = new Map(allProgress.map((p) => [p.userId, p]));
  const todayKey = getTodayKey();
  return (
    <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
      <h4 className="text-sm font-black text-emerald-900">학생별 빠른 입력</h4>
      <p className="mt-1 text-xs text-slate-600">실천 내용을 수정하거나 오늘 체크를 +1 할 수 있어요.</p>
      <div className="mt-3 space-y-2">
        {students.map((s) => {
          const p = progressByUid.get(s.uid);
          const checkedToday = !!p && (p.checkedDates ?? []).includes(todayKey);
          return (
            <TeacherStudentRow
              key={s.uid}
              student={s}
              progress={p ?? null}
              weekId={weekId}
              checkedToday={checkedToday}
            />
          );
        })}
      </div>
    </div>
  );
}

function TeacherStudentRow({
  student,
  progress,
  weekId,
  checkedToday,
}: {
  student: TeacherStudent;
  progress: WordFruitProgress | null;
  weekId: string;
  checkedToday: boolean;
}) {
  const [practice, setPractice] = useState(progress?.practice ?? '');
  const [busy, setBusy] = useState<'save' | 'plus' | null>(null);
  const [err, setErr] = useState('');
  const [savedTick, setSavedTick] = useState(false);

  useEffect(() => {
    setPractice(progress?.practice ?? '');
  }, [progress?.practice]);

  const handleSave = async () => {
    setErr('');
    setBusy('save');
    try {
      await upsertProgressByLeader({
        weekId,
        userId: student.uid,
        childName: student.displayName,
        practice: practice.trim(),
        groupId: student.groupId,
      });
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
    } catch (e: any) {
      setErr(e?.message || '저장 실패');
    } finally {
      setBusy(null);
    }
  };

  const handlePlus = async () => {
    setErr('');
    setBusy('plus');
    try {
      await addTodayCheckByLeader({
        weekId,
        userId: student.uid,
        childName: student.displayName,
        practice: practice.trim() || progress?.practice,
        groupId: student.groupId,
      });
    } catch (e: any) {
      setErr(e?.message || '저장 실패');
    } finally {
      setBusy(null);
    }
  };

  const checkCount = progress?.checkCount ?? 0;

  return (
    <div className="rounded-lg border border-white bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-emerald-950">{student.displayName}</p>
        <span className="text-xs font-bold text-slate-500">체크 {Math.min(checkCount, 3)}/3</span>
      </div>
      <textarea
        value={practice}
        onChange={(e) => setPractice(e.target.value)}
        rows={2}
        maxLength={200}
        placeholder="이번 주 실천 내용을 입력하세요"
        className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
      />
      {err && <p className="mt-1 text-xs text-rose-700">{err}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy !== null}
          className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
        >
          {busy === 'save' ? '저장 중…' : savedTick ? '저장됨' : '실천 내용 저장'}
        </button>
        <button
          type="button"
          onClick={handlePlus}
          disabled={busy !== null || checkedToday || progress?.completed}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:bg-slate-300"
        >
          {checkedToday ? '오늘 체크 완료' : progress?.completed ? '주간 완료' : '이번 주 체크 +1'}
        </button>
      </div>
      {progress && progress.checkedDates && progress.checkedDates.length > 0 && (
        <div className="mt-2 flex gap-1">
          {Array.from({ length: 4 }).map((_, i) => {
            const filled = i < Math.min(progress.checkedDates.length, 4);
            return (
              <span
                key={i}
                className={`h-2 w-6 rounded-full ${filled ? 'bg-emerald-400' : 'bg-slate-200'}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

