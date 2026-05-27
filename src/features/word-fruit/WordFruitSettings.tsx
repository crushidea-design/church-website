import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Save, Sparkles, Users2 } from 'lucide-react';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  backfillProgressGroupIds,
  createGroup,
  fetchElementaryStudents,
  fetchTeachers,
  saveLegacyFruitTotal,
  setMemberGroup,
  setMemberGroupIds,
  subscribeGroups,
  subscribeLegacyFruitTotals,
} from './api';
import type { BackfillReport } from './api';
import type { LegacyWordFruitTotal, WordFruitGroup } from './types';

/**
 * Cross-week setup for the word-fruit feature: groups, parent linking, and
 * one-shot data migration. Lives in the broader 다음세대 관리 page so that
 * the weekly admin panel stays focused on the week's content.
 */
export default function WordFruitSettings() {
  return (
    <div className="space-y-8">
      <GroupManager />
      <LegacyFruitTotalsManager />
      <ParentLinkManager />
      <MigrationTool />
    </div>
  );
}

/* ────────────────────────── 반(그룹) 관리 ──────────────────────────── */

function GroupManager() {
  const [groups, setGroups] = useState<WordFruitGroup[]>([]);
  const [students, setStudents] = useState<Array<{ uid: string; displayName: string; groupId?: string }>>([]);
  const [teachers, setTeachers] = useState<Array<{ uid: string; displayName: string; email: string; groupIds: string[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => subscribeGroups(setGroups), []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const [stu, tch] = await Promise.all([fetchElementaryStudents(), fetchTeachers()]);
      if (cancel) return;
      setStudents(stu);
      setTeachers(tch);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, []);

  const handleAddGroup = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy('new');
    setMsg(null);
    try {
      await createGroup(name);
      setNewName('');
      setMsg({ tone: 'ok', text: `${name} 반을 추가했습니다.` });
    } catch (e) {
      console.error(e);
      setMsg({ tone: 'err', text: '추가 중 오류가 발생했습니다.' });
    } finally {
      setBusy(null);
    }
  };

  const handleAssignStudent = async (uid: string, displayName: string, groupId: string) => {
    setBusy(`student:${uid}`);
    setMsg(null);
    try {
      await setMemberGroup(uid, groupId);
      setStudents((list) => list.map((s) => (s.uid === uid ? { ...s, groupId } : s)));
      setMsg({ tone: 'ok', text: `${displayName} 반 배정 저장됨` });
    } catch (e) {
      console.error(e);
      setMsg({ tone: 'err', text: '저장 중 오류가 발생했습니다.' });
    } finally {
      setBusy(null);
    }
  };

  const handleToggleTeacherGroup = async (
    teacher: { uid: string; displayName: string; groupIds: string[] },
    groupId: string,
  ) => {
    const next = teacher.groupIds.includes(groupId)
      ? teacher.groupIds.filter((id) => id !== groupId)
      : [...teacher.groupIds, groupId];
    setBusy(`teacher:${teacher.uid}`);
    setMsg(null);
    try {
      await setMemberGroupIds(teacher.uid, next);
      setTeachers((list) => list.map((t) => (t.uid === teacher.uid ? { ...t, groupIds: next } : t)));
      setMsg({ tone: 'ok', text: `${teacher.displayName} 담당 반 저장됨` });
    } catch (e) {
      console.error(e);
      setMsg({ tone: 'err', text: '저장 중 오류가 발생했습니다.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <h3 className="text-base font-black text-emerald-950">반(그룹) 관리</h3>
      <p className="mt-1 text-xs text-slate-500">
        반을 만들고 학생을 배정하면 교사가 자기 담당 반의 진행만 보게 됩니다. 담당 반이 없는 교사는 모든 반을 볼 수 있습니다(임시 운영).
      </p>

      {msg && (
        <div
          className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            msg.tone === 'ok'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {msg.tone === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {msg.text}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="새 반 이름 (예: 1반, 초3 남자반)"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handleAddGroup}
          disabled={busy === 'new' || !newName.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy === 'new' ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />} 반 추가
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {groups.length === 0 ? (
          <span className="text-xs text-slate-400">아직 반이 없습니다.</span>
        ) : (
          groups.map((g) => (
            <span key={g.id} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">
              {g.name}
            </span>
          ))
        )}
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="animate-spin" size={14} /> 명단 로드 중...
        </div>
      ) : (
        <>
          <div className="mt-4">
            <p className="text-sm font-bold text-emerald-900">학생 반 배정</p>
            {students.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">학생 명단이 비어 있습니다.</p>
            ) : (
              <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold">아이</th>
                      <th className="px-3 py-2 text-left font-bold">반</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.uid} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-bold text-slate-800">{s.displayName}</td>
                        <td className="px-3 py-2">
                          <select
                            value={s.groupId ?? ''}
                            onChange={(e) => handleAssignStudent(s.uid, s.displayName, e.target.value)}
                            disabled={busy === `student:${s.uid}`}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                          >
                            <option value="">(미배정)</option>
                            {groups.map((g) => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-4">
            <p className="text-sm font-bold text-emerald-900">교사 담당 반</p>
            {teachers.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">교사 명단이 비어 있습니다.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {teachers.map((t) => (
                  <div key={t.uid} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-800">{t.displayName}</p>
                        <p className="text-xs text-slate-500">{t.email}</p>
                      </div>
                      {busy === `teacher:${t.uid}` && (
                        <Loader2 className="animate-spin text-emerald-600" size={14} />
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {groups.length === 0 && (
                        <span className="text-xs text-slate-400">먼저 반을 만들어 주세요.</span>
                      )}
                      {groups.map((g) => {
                        const checked = t.groupIds.includes(g.id);
                        return (
                          <label
                            key={g.id}
                            className={`flex cursor-pointer items-center gap-1 rounded-full border px-2 py-1 text-xs ${
                              checked
                                ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                                : 'border-slate-200 bg-slate-50 text-slate-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={checked}
                              onChange={() => handleToggleTeacherGroup(t, g.id)}
                            />
                            {g.name}
                          </label>
                        );
                      })}
                    </div>
                    {t.groupIds.length === 0 && (
                      <p className="mt-2 text-[11px] text-amber-700">
                        담당 반 미설정 — 모든 반을 볼 수 있는 임시 권한이 적용됩니다.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/* ────────────────────────── 부모-자녀 연결 ─────────────────────────── */

function LegacyFruitTotalsManager() {
  const [items, setItems] = useState<LegacyWordFruitTotal[]>([]);
  const [groups, setGroups] = useState<WordFruitGroup[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { childName: string; totalCount: string; groupId: string; memo: string }>>({});
  const [newDraft, setNewDraft] = useState({ childName: '', totalCount: '0', groupId: '', memo: '' });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => subscribeGroups(setGroups), []);

  useEffect(() => {
    return subscribeLegacyFruitTotals(
      (next) => {
        setItems(next);
        setLoading(false);
      },
      () => {
        setItems([]);
        setLoading(false);
      },
    );
  }, []);

  const updateDraft = (
    id: string,
    item: LegacyWordFruitTotal,
    patch: Partial<{ childName: string; totalCount: string; groupId: string; memo: string }>,
  ) => {
    setDrafts((current) => ({
      ...current,
      [id]: {
        childName: item.childName,
        totalCount: String(item.totalCount ?? 0),
        groupId: item.groupId ?? '',
        memo: item.memo ?? '',
        ...(current[id] ?? {}),
        ...patch,
      },
    }));
  };

  const saveItem = async (item: LegacyWordFruitTotal) => {
    const draft = drafts[item.id] ?? {
      childName: item.childName,
      totalCount: String(item.totalCount ?? 0),
      groupId: item.groupId ?? '',
      memo: item.memo ?? '',
    };
    setBusyId(item.id);
    setMsg(null);
    try {
      await saveLegacyFruitTotal({
        id: item.id,
        childName: draft.childName,
        totalCount: Number(draft.totalCount),
        groupId: draft.groupId,
        linkedUid: item.linkedUid ?? '',
        memo: draft.memo,
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setMsg({ tone: 'ok', text: `${draft.childName.trim()} 누적 열매를 저장했습니다.` });
    } catch (e: any) {
      console.error(e);
      setMsg({ tone: 'err', text: e?.message === 'INVALID_CHILD_NAME' ? '아이 이름을 입력해 주세요.' : '저장 중 오류가 발생했습니다.' });
    } finally {
      setBusyId(null);
    }
  };

  const addItem = async () => {
    setBusyId('new');
    setMsg(null);
    try {
      await saveLegacyFruitTotal({
        childName: newDraft.childName,
        totalCount: Number(newDraft.totalCount),
        groupId: newDraft.groupId,
        memo: newDraft.memo,
      });
      setMsg({ tone: 'ok', text: `${newDraft.childName.trim()} 누적 열매를 추가했습니다.` });
      setNewDraft({ childName: '', totalCount: '0', groupId: '', memo: '' });
    } catch (e: any) {
      console.error(e);
      setMsg({ tone: 'err', text: e?.message === 'INVALID_CHILD_NAME' ? '아이 이름을 입력해 주세요.' : '추가 중 오류가 발생했습니다.' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section>
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-emerald-700" />
        <h3 className="text-base font-black text-emerald-950">누적 열매</h3>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        기존에 아이들이 모아 온 열매 개수를 아이별 누적 개수로 보관합니다. 주차별 말씀 열매 기록과는 섞지 않고, 나중에 아이 계정이 생기면 이 기록을 연결할 수 있습니다.
      </p>

      {msg && (
        <div
          className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            msg.tone === 'ok'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {msg.tone === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {msg.text}
        </div>
      )}

      <div className="mt-3 grid gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 md:grid-cols-[1.2fr_0.7fr_0.7fr_1.5fr_auto]">
        <input
          type="text"
          value={newDraft.childName}
          onChange={(e) => setNewDraft((draft) => ({ ...draft, childName: e.target.value }))}
          placeholder="아이 이름"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          type="number"
          min={0}
          value={newDraft.totalCount}
          onChange={(e) => setNewDraft((draft) => ({ ...draft, totalCount: e.target.value }))}
          placeholder="누적 개수"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <select
          value={newDraft.groupId}
          onChange={(e) => setNewDraft((draft) => ({ ...draft, groupId: e.target.value }))}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">반 선택</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </select>
        <input
          type="text"
          value={newDraft.memo}
          onChange={(e) => setNewDraft((draft) => ({ ...draft, memo: e.target.value }))}
          placeholder="메모 (선택)"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={addItem}
          disabled={busyId === 'new' || !newDraft.childName.trim()}
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busyId === 'new' ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />}
          추가
        </button>
      </div>

      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="animate-spin" size={14} /> 누적 열매 목록을 불러오는 중...
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">아직 등록된 누적 열매가 없습니다.</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-bold">아이</th>
                <th className="px-3 py-2 text-left font-bold">누적</th>
                <th className="px-3 py-2 text-left font-bold">반</th>
                <th className="px-3 py-2 text-left font-bold">메모</th>
                <th className="px-3 py-2 text-right font-bold">저장</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const draft = drafts[item.id] ?? {
                  childName: item.childName,
                  totalCount: String(item.totalCount ?? 0),
                  groupId: item.groupId ?? '',
                  memo: item.memo ?? '',
                };
                const dirty = drafts[item.id] !== undefined;
                return (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={draft.childName}
                        onChange={(e) => updateDraft(item.id, item, { childName: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm font-bold text-slate-800"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        value={draft.totalCount}
                        onChange={(e) => updateDraft(item.id, item, { totalCount: e.target.value })}
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={draft.groupId}
                        onChange={(e) => updateDraft(item.id, item, { groupId: e.target.value })}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      >
                        <option value="">미배정</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={draft.memo}
                        onChange={(e) => updateDraft(item.id, item, { memo: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => saveItem(item)}
                        disabled={!dirty || busyId === item.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {busyId === item.id ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />}
                        저장
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

interface ParentRow {
  uid: string;
  displayName: string;
  email: string;
  childIds: string[];
}

function ParentLinkManager() {
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [students, setStudents] = useState<Array<{ uid: string; displayName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const [studentList, parentSnap] = await Promise.all([
          fetchElementaryStudents(),
          getDocs(query(
            collection(db, 'next_generation_members'),
            where('department', '==', '학부모'),
            where('role', '==', 'member'),
          )),
        ]);
        if (cancel) return;
        setStudents(studentList);
        setParents(parentSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            uid: data.uid ?? d.id,
            displayName: data.displayName ?? '이름 없음',
            email: data.email ?? '',
            childIds: Array.isArray(data.childIds) ? data.childIds : [],
          };
        }));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const studentsByUid = useMemo(() => {
    const m = new Map<string, string>();
    students.forEach((s) => m.set(s.uid, s.displayName));
    return m;
  }, [students]);

  const handleToggle = (parentUid: string, childUid: string, current: string[]) => {
    const draft = drafts[parentUid] ?? current;
    const next = draft.includes(childUid)
      ? draft.filter((id) => id !== childUid)
      : [...draft, childUid];
    setDrafts((d) => ({ ...d, [parentUid]: next }));
  };

  const handleSave = async (parent: ParentRow) => {
    const next = drafts[parent.uid] ?? parent.childIds;
    setSavingUid(parent.uid);
    setMsg(null);
    try {
      await updateDoc(doc(db, 'next_generation_members', parent.uid), {
        childIds: next,
      });
      setParents((list) =>
        list.map((p) => (p.uid === parent.uid ? { ...p, childIds: next } : p)),
      );
      setDrafts((d) => {
        const copy = { ...d };
        delete copy[parent.uid];
        return copy;
      });
      setMsg({ tone: 'ok', text: `${parent.displayName} 연결 정보를 저장했습니다.` });
    } catch (e) {
      console.error(e);
      setMsg({ tone: 'err', text: '저장 중 오류가 발생했습니다.' });
    } finally {
      setSavingUid(null);
    }
  };

  return (
    <section>
      <div className="flex items-center gap-2">
        <Users2 size={16} className="text-emerald-700" />
        <h3 className="text-base font-black text-emerald-950">부모-자녀 연결</h3>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        “학부모” 부서로 가입한 회원에게 자녀(학생) 계정을 연결해 주세요. 연결된 학부모는 자녀의 진행만 볼 수 있습니다.
      </p>

      {msg && (
        <div
          className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            msg.tone === 'ok'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {msg.tone === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="animate-spin" size={14} /> 명단 로드 중...
        </div>
      ) : parents.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">“학부모” 부서로 가입된 회원이 없습니다.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {parents.map((p) => {
            const draftSelected = drafts[p.uid] ?? p.childIds;
            const dirty = drafts[p.uid] !== undefined;
            return (
              <div key={p.uid} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-800">{p.displayName}</p>
                    <p className="text-xs text-slate-500">{p.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSave(p)}
                    disabled={savingUid === p.uid || !dirty}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {savingUid === p.uid ? (
                      <Loader2 className="animate-spin" size={12} />
                    ) : (
                      <Save size={12} />
                    )}
                    저장
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {students.length === 0 && (
                    <span className="text-xs text-slate-400">학생 명단이 비어 있습니다.</span>
                  )}
                  {students.map((s) => {
                    const checked = draftSelected.includes(s.uid);
                    return (
                      <label
                        key={s.uid}
                        className={`flex cursor-pointer items-center gap-1 rounded-full border px-2 py-1 text-xs ${
                          checked
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={checked}
                          onChange={() => handleToggle(p.uid, s.uid, p.childIds)}
                        />
                        {s.displayName}
                      </label>
                    );
                  })}
                </div>
                {p.childIds.length > 0 && !dirty && (
                  <p className="mt-2 text-[11px] text-slate-500">
                    현재 연결: {p.childIds.map((id) => studentsByUid.get(id) ?? id).join(', ')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ────────────────────────── 데이터 마이그레이션 ─────────────────────── */

function MigrationTool() {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<BackfillReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!confirm('기존 진행 도큐먼트에 그룹 정보를 백필합니다. 계속할까요?')) return;
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const result = await backfillProgressGroupIds();
      setReport(result);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || '마이그레이션 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h3 className="text-base font-black text-emerald-950">데이터 마이그레이션</h3>
      <p className="mt-1 text-xs text-slate-500">
        그룹 도입 전 만들어진 진행 문서에 학생의 현재 그룹을 백필합니다. 여러 번 눌러도 안전합니다(idempotent).
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleRun}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {busy ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} 그룹 백필 실행
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {report && (
        <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-sm text-emerald-900">
          <p className="font-bold">완료</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            <li>스캔한 진행 문서: {report.scanned}</li>
            <li>이미 그룹 있음: {report.alreadyHasGroup}</li>
            <li>학생 회원 정보 없음(스킵): {report.noStudentMember}</li>
            <li>학생에 그룹 미설정(스킵): {report.studentHasNoGroup}</li>
            <li className="font-bold text-emerald-700">백필 적용: {report.updated}</li>
          </ul>
        </div>
      )}
    </section>
  );
}
