import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useNextGenerationAuth } from '../../lib/nextGenerationAuth';
import {
  addTodayCheckByLeader,
  fruitStageOf,
  getTodayKey,
  getWeekId,
  subscribeMyProgress,
  subscribeProgressForGroups,
  subscribeProgressForUsers,
} from './api';
import { WordFruitProgress } from './types';
import WordFruitTree from './WordFruitTree';
import {
  subscribeAttendanceForGroup,
  subscribeAttendanceForStudent,
  getRecentSundayWeekKeys,
  AttendanceDoc,
  setAttendanceBatch,
} from './attendanceApi';
import { mergeTeacherStudentsWithProgress, TeacherStudent } from './teacherRoster';
import {
  setFamilyWorshipLog,
  subscribeMyFamilyWorshipLogs,
  FamilyWorshipLog,
} from './familyWorshipApi';

/* ---------------- Student ---------------- */

export function StudentRoleCards() {
  const { user } = useNextGenerationAuth();
  const weekId = useMemo(() => getWeekId(), []);
  const [progress, setProgress] = useState<WordFruitProgress | null>(null);
  const [attendance, setAttendance] = useState<AttendanceDoc[]>([]);
  const recentWeekKeys = useMemo(() => getRecentSundayWeekKeys(8), []);

  useEffect(() => {
    if (!user) return;
    return subscribeMyProgress(weekId, user.uid, setProgress);
  }, [user, weekId]);

  useEffect(() => {
    if (!user) return;
    return subscribeAttendanceForStudent(user.uid, setAttendance);
  }, [user]);

  const attMap = useMemo(() => {
    const m = new Map<string, boolean>();
    attendance.forEach((a) => m.set(a.weekKey, !!a.present));
    return m;
  }, [attendance]);

  const stage = (progress ? fruitStageOf(progress.checkCount) : 0) as 0 | 1 | 2 | 3;

  return (
    <>
      <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-emerald-950">내 이번 주 열매</h2>
        {progress ? (
          <>
            <p className="mt-1 text-xs font-bold text-slate-500">{progress.practice || '작은 순종이 등록되지 않았어요.'}</p>
            <div className="mt-3">
              <WordFruitTree stage={stage} fruitName={'열매'} />
            </div>
            <p className="mt-2 text-center text-xs font-bold text-emerald-800">체크 {progress.checkCount}/3</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-500">이번 주 작은 순종이 아직 등록되지 않았어요.</p>
        )}
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-emerald-950">최근 8주 출석</h2>
        <p className="mt-1 text-xs text-slate-500">왼쪽이 가장 최근입니다.</p>
        <div className="mt-3 flex gap-1.5">
          {recentWeekKeys.map((k) => (
            <span
              key={k}
              title={k}
              className={`h-4 w-4 rounded-full ${attMap.get(k) ? 'bg-emerald-500' : 'bg-slate-200'}`}
            />
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------------- Parent ---------------- */

export function ParentRoleCards() {
  const { user, member } = useNextGenerationAuth();
  const weekId = useMemo(() => getWeekId(), []);
  const childIds = member?.childIds ?? [];
  const proxyChildren = member?.proxyChildren ?? [];
  const proxyNames = new Set(proxyChildren.map((child) => child.name.replace(/\s+/g, '').trim()).filter(Boolean));
  const pendingChildNames = (member?.childNames ?? [])
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && !proxyNames.has(name.replace(/\s+/g, '').trim()));
  const combinedIds = useMemo(
    () => [...childIds, ...proxyChildren.map((p) => p.id)],
    [childIds.join('|'), proxyChildren.map((p) => p.id).join('|')],
  );
  const [progresses, setProgresses] = useState<WordFruitProgress[]>([]);
  const [logs, setLogs] = useState<FamilyWorshipLog[]>([]);
  const [savingWorship, setSavingWorship] = useState(false);
  const [savingChild, setSavingChild] = useState<string | null>(null);
  const todayKey = getTodayKey();
  const recentWeekKeys = useMemo(() => getRecentSundayWeekKeys(8), []);
  const thisWeekKey = recentWeekKeys[0];

  useEffect(() => {
    if (combinedIds.length === 0) {
      setProgresses([]);
      return;
    }
    return subscribeProgressForUsers(weekId, combinedIds, setProgresses);
  }, [weekId, combinedIds]);

  useEffect(() => {
    if (!user) return;
    return subscribeMyFamilyWorshipLogs(user.uid, setLogs);
  }, [user]);

  const progressByUid = new Map(progresses.map((p) => [p.userId, p]));
  const worshipMap = new Map(logs.map((l) => [l.weekKey, l]));
  const thisWeekDone = worshipMap.has(thisWeekKey);

  const handleChildPlus = async (id: string, name: string, groupId?: string) => {
    setSavingChild(id);
    try {
      await addTodayCheckByLeader({
        weekId,
        userId: id,
        childName: name,
        groupId: groupId ?? '',
      });
    } catch {
      // ignore
    } finally {
      setSavingChild(null);
    }
  };

  const handleWorship = async () => {
    if (!user) return;
    setSavingWorship(true);
    try {
      await setFamilyWorshipLog({
        weekKey: thisWeekKey,
        parentUid: user.uid,
        childUids: combinedIds,
      });
    } finally {
      setSavingWorship(false);
    }
  };

  const entries = [
    ...childIds.map((uid) => ({
      id: uid,
      name: progressByUid.get(uid)?.childName || '자녀',
      groupId: progressByUid.get(uid)?.groupId,
    })),
    ...proxyChildren.map((c) => ({ id: c.id, name: c.name, groupId: c.groupId })),
  ];

  return (
    <>
      <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-emerald-950">우리 아이 열매</h2>
        {entries.length === 0 ? (
          pendingChildNames.length > 0 ? (
            <div className="mt-2 rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm text-slate-600">
              <p className="font-bold text-sky-800">학생 계정 연결을 기다리는 자녀가 있어요.</p>
              <p className="mt-1 text-xs font-bold text-slate-500">{pendingChildNames.join(', ')}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                자녀가 학생으로 가입하고 승인되면 말씀 열매 기록이 이곳에 연결됩니다.
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">등록된 자녀가 없어요.</p>
          )
        ) : (
          <div className="mt-3 space-y-2">
            {entries.map((c) => {
              const p = progressByUid.get(c.id);
              const checkedToday = !!p && (p.checkedDates ?? []).includes(todayKey);
              return (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-emerald-950">{c.name}</p>
                    <p className="text-xs text-slate-500">체크 {Math.min(p?.checkCount ?? 0, 3)}/3</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleChildPlus(c.id, c.name, c.groupId)}
                    disabled={savingChild === c.id || checkedToday || p?.completed}
                    className="ml-2 shrink-0 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:bg-slate-300"
                  >
                    {checkedToday ? '오늘 완료' : '오늘 +1'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-emerald-950">이번 주 가정예배</h2>
        <p className="mt-1 text-xs text-slate-500">{thisWeekKey} 기준</p>
        <button
          type="button"
          onClick={handleWorship}
          disabled={savingWorship || thisWeekDone}
          className="mt-3 w-full rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:bg-slate-300"
        >
          {thisWeekDone ? '이번 주 가정예배 드림 ✓' : '이번 주 가정예배 드렸어요'}
        </button>
        <div className="mt-3 flex gap-1.5">
          {recentWeekKeys.map((k) => (
            <span
              key={k}
              title={k}
              className={`h-3 w-3 rounded-full ${worshipMap.has(k) ? 'bg-amber-500' : 'bg-slate-200'}`}
            />
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------------- Teacher ---------------- */

export function TeacherRoleCards() {
  const { user, member } = useNextGenerationAuth();
  const groupIds = member?.groupIds ?? [];
  const weekId = useMemo(() => getWeekId(), []);
  const recentWeekKeys = useMemo(() => getRecentSundayWeekKeys(1), []);
  const thisWeekKey = recentWeekKeys[0];

  const [progresses, setProgresses] = useState<WordFruitProgress[]>([]);
  const [studentsByGroup, setStudentsByGroup] = useState<Record<string, TeacherStudent[]>>({});
  const [attendance, setAttendance] = useState<Record<string, AttendanceDoc[]>>({});
  const [attendanceDrafts, setAttendanceDrafts] = useState<Record<string, boolean>>({});
  const [savingGroup, setSavingGroup] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (groupIds.length === 0) return;
    return subscribeProgressForGroups(weekId, groupIds, setProgresses);
  }, [weekId, groupIds.join('|')]);

  useEffect(() => {
    if (groupIds.length === 0) return;
    let legacyMemberGrouped: Record<string, TeacherStudent[]> = {};
    let multiRoleMemberGrouped: Record<string, TeacherStudent[]> = {};
    let proxyGrouped: Record<string, TeacherStudent[]> = {};
    const sync = () => {
      const next: Record<string, TeacherStudent[]> = {};
      groupIds.forEach((groupId) => {
        const byUid = new Map<string, TeacherStudent>();
        [
          ...(legacyMemberGrouped[groupId] ?? []),
          ...(multiRoleMemberGrouped[groupId] ?? []),
          ...(proxyGrouped[groupId] ?? []),
        ].forEach((student) => byUid.set(student.uid, student));
        next[groupId] = Array.from(byUid.values()).sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'));
      });
      setStudentsByGroup(next);
    };
    const legacyMemberQuery = query(
      collection(db, 'next_generation_members'),
      where('role', '==', 'member'),
      where('department', '==', '학생'),
    );
    const multiRoleMemberQuery = query(
      collection(db, 'next_generation_members'),
      where('role', '==', 'member'),
      where('departments', 'array-contains', '학생'),
    );
    const childQuery = query(
      collection(db, 'next_generation_children'),
      where('groupId', 'in', groupIds.slice(0, 10)),
    );
    const mapMemberGroups = (snap: any) => {
      const grouped: Record<string, TeacherStudent[]> = {};
      snap.docs.forEach((d: any) => {
        const data = d.data() as any;
        const gid = data.groupId ?? '';
        if (!groupIds.includes(gid)) return;
        if (!grouped[gid]) grouped[gid] = [];
        grouped[gid].push({ uid: data.uid ?? d.id, displayName: data.displayName ?? '이름 없음', groupId: gid });
      });
      return grouped;
    };
    const unsubscribeLegacyMembers = onSnapshot(
      legacyMemberQuery,
      (snap) => {
        legacyMemberGrouped = mapMemberGroups(snap);
        sync();
      },
      () => {
        legacyMemberGrouped = {};
        sync();
      },
    );
    const unsubscribeMultiRoleMembers = onSnapshot(
      multiRoleMemberQuery,
      (snap) => {
        multiRoleMemberGrouped = mapMemberGroups(snap);
        sync();
      },
      () => {
        multiRoleMemberGrouped = {};
        sync();
      },
    );
    const unsubscribeChildren = onSnapshot(
      childQuery,
      (snap) => {
        const grouped: Record<string, TeacherStudent[]> = {};
        snap.docs.forEach((d) => {
          const data = d.data() as any;
          const gid = data.groupId ?? '';
          if (!groupIds.includes(gid)) return;
          if (!grouped[gid]) grouped[gid] = [];
          grouped[gid].push({ uid: d.id, displayName: data.displayName ?? '이름 없음', groupId: gid });
        });
        proxyGrouped = grouped;
        sync();
      },
      () => {
        proxyGrouped = {};
        sync();
      },
    );
    return () => {
      unsubscribeLegacyMembers();
      unsubscribeMultiRoleMembers();
      unsubscribeChildren();
    };
  }, [groupIds.join('|')]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    groupIds.forEach((gid) => {
      const u = subscribeAttendanceForGroup(gid, [thisWeekKey], (rows) => {
        setAttendance((prev) => ({ ...prev, [gid]: rows }));
      });
      unsubs.push(u);
    });
    return () => unsubs.forEach((u) => u());
  }, [groupIds.join('|'), thisWeekKey]);

  const studentsByVisibleGroup = useMemo(() => {
    const result: Record<string, TeacherStudent[]> = {};
    groupIds.forEach((gid) => {
      result[gid] = mergeTeacherStudentsWithProgress(
        studentsByGroup[gid] ?? [],
        progresses.filter((p) => p.groupId === gid),
        [gid],
      );
    });
    return result;
  }, [groupIds.join('|'), progresses, studentsByGroup]);

  useEffect(() => {
    const seeded: Record<string, boolean> = {};
    groupIds.forEach((gid) => {
      const presentByStudent = new Map((attendance[gid] ?? []).map((record) => [record.studentUid, !!record.present]));
      (studentsByVisibleGroup[gid] ?? []).forEach((student) => {
        seeded[student.uid] = presentByStudent.get(student.uid) ?? false;
      });
    });
    setAttendanceDrafts((prev) => {
      const next = { ...seeded };
      Object.keys(prev).forEach((studentUid) => {
        if (studentUid in seeded) next[studentUid] = prev[studentUid];
      });
      return next;
    });
  }, [attendance, groupIds.join('|'), studentsByVisibleGroup]);

  const saveAttendanceGroup = async (gid: string, students: TeacherStudent[]) => {
    if (!user || !thisWeekKey) return;
    setSavingGroup(gid);
    setMessage('');
    try {
      await setAttendanceBatch(students.map((student) => ({
        weekKey: thisWeekKey,
        sundayDate: thisWeekKey,
        studentUid: student.uid,
        studentName: student.displayName || '이름 없음',
        groupId: gid,
        present: !!attendanceDrafts[student.uid],
        checkedBy: user.uid,
      })));
      setMessage('출석부를 저장했습니다.');
      setTimeout(() => setMessage(''), 1600);
    } catch {
      setMessage('출석부 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingGroup(null);
    }
  };

  if (groupIds.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-emerald-950">우리 반 현황</h2>
        <p className="mt-2 text-sm text-slate-500">담당 반이 아직 지정되지 않았어요.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-black text-emerald-950">반 출석부</h2>
          <p className="mt-1 text-xs text-slate-500">{thisWeekKey} 기준</p>
        </div>
        {message && <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{message}</span>}
      </div>
      <div className="mt-3 space-y-2">
        {groupIds.map((gid) => {
          const list = studentsByVisibleGroup[gid] ?? [];
          const groupProgress = progresses.filter((p) => p.groupId === gid);
          const completed = groupProgress.filter((p) => p.completed).length;
          const fruitPct = list.length > 0 ? Math.round((completed / list.length) * 100) : 0;
          const presentCount = list.filter((student) => !!attendanceDrafts[student.uid]).length;
          const attPct = list.length > 0 ? Math.round((presentCount / list.length) * 100) : 0;
          return (
            <div key={gid} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-emerald-950">{gid}</p>
                <span className="text-xs font-bold text-slate-500">{list.length}명</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-white px-2 py-1.5">
                  <p className="text-slate-500">열매 완료</p>
                  <p className="font-black text-emerald-700">{fruitPct}%</p>
                </div>
                <div className="rounded-md bg-white px-2 py-1.5">
                  <p className="text-slate-500">출석</p>
                  <p className="font-black text-sky-700">{attPct}%</p>
                </div>
              </div>
              {list.length === 0 ? (
                <p className="mt-3 rounded-lg border border-dashed border-emerald-200 bg-white/70 p-3 text-xs font-bold text-slate-500">
                  이 반에 표시할 학생이 아직 없습니다.
                </p>
              ) : (
                <div className="mt-3 space-y-1.5">
                  {list.map((student) => (
                    <label key={student.uid} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                      <span className="font-bold text-slate-800">{student.displayName}</span>
                      <span className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        {attendanceDrafts[student.uid] ? '출석' : '미출석'}
                        <input
                          type="checkbox"
                          checked={!!attendanceDrafts[student.uid]}
                          onChange={(event) => {
                            setAttendanceDrafts((drafts) => ({
                              ...drafts,
                              [student.uid]: event.target.checked,
                            }));
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400"
                        />
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => saveAttendanceGroup(gid, list)}
                disabled={savingGroup === gid || list.length === 0}
                className="mt-3 w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-black text-white transition hover:bg-sky-700 disabled:bg-slate-300"
              >
                {savingGroup === gid ? '저장 중...' : '출석부 저장'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RoleCardsLoader() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
      <Loader2 className="inline animate-spin" size={14} /> 불러오는 중
    </div>
  );
}
