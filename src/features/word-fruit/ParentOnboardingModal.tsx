import React, { useEffect, useMemo, useState } from 'react';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Check, Copy, Loader2, Plus, Trash2, X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useNextGenerationAuth } from '../../lib/nextGenerationAuth';
import { buildProxyChildRecords } from '../next-generation/proxyChildren';
import { subscribeGroups } from './api';
import type { WordFruitGroup } from './types';

const NEXT_SIGNUP_URL = 'https://builttogether.church/next';

interface DraftChild {
  tempId: string;
  id?: string;
  name: string;
  grade: string;
  groupId: string;
  usesPhone: 'yes' | 'no' | null;
}

interface Props {
  onClose: () => void;
}

function makeDraft(patch: Partial<DraftChild> = {}): DraftChild {
  return {
    tempId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    grade: '',
    groupId: '',
    usesPhone: null,
    ...patch,
  };
}

function normalizeName(name: string) {
  return name.replace(/\s+/g, '').trim();
}

function getKoreanVocativeName(name: string) {
  const compact = normalizeName(name);
  if (!compact) return '아이야';
  const givenName = compact.length >= 3 ? compact.slice(1) : compact;
  const lastCode = givenName.charCodeAt(givenName.length - 1);
  const hasFinalConsonant =
    lastCode >= 0xac00 && lastCode <= 0xd7a3 && (lastCode - 0xac00) % 28 !== 0;
  return `${givenName}${hasFinalConsonant ? '아' : '야'}`;
}

function buildInitialDrafts(member: NonNullable<ReturnType<typeof useNextGenerationAuth>['member']>) {
  const proxyDrafts = (member.proxyChildren ?? []).map((child) =>
    makeDraft({
      id: child.id,
      name: child.name,
      grade: child.grade ?? '',
      groupId: child.groupId ?? '',
      usesPhone: 'no',
    }),
  );
  const proxyNames = new Set(proxyDrafts.map((child) => normalizeName(child.name)).filter(Boolean));
  const phoneDrafts = (member.childNames ?? [])
    .filter((name) => {
      const normalized = normalizeName(name);
      return normalized && !proxyNames.has(normalized);
    })
    .map((name) => makeDraft({ name, usesPhone: 'yes' }));
  const drafts = [...proxyDrafts, ...phoneDrafts];
  return drafts.length > 0 ? drafts : [makeDraft()];
}

export default function ParentOnboardingModal({ onClose }: Props) {
  const { user, member } = useNextGenerationAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [drafts, setDrafts] = useState<DraftChild[]>(() => (member ? buildInitialDrafts(member) : [makeDraft()]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [groups, setGroups] = useState<WordFruitGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  useEffect(() => {
    if (member) setDrafts(buildInitialDrafts(member));
  }, [member?.uid]);

  useEffect(() => {
    return subscribeGroups(
      (items) => {
        setGroups(items);
        setGroupsLoading(false);
      },
      () => {
        setGroups([]);
        setGroupsLoading(false);
      },
    );
  }, []);

  const existingProxyIds = useMemo(
    () => new Set((member?.proxyChildren ?? []).map((child) => child.id)),
    [member?.proxyChildren],
  );

  if (!user || !member) return null;

  const updateDraft = (idx: number, patch: Partial<DraftChild>) => {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const removeDraft = (idx: number) => {
    setDrafts((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const addDraft = () => setDrafts((prev) => [...prev, makeDraft()]);

  const validStep1 = drafts.every((d) => d.name.trim().length > 0);
  const validStep2 = drafts.every((d) => d.usesPhone !== null && (d.usesPhone === 'yes' || d.groupId.trim().length > 0));
  const parentEmail = (member.email || '').trim().toLowerCase();

  const signupHint = (child: DraftChild) =>
    `${getKoreanVocativeName(child.name)}, ${NEXT_SIGNUP_URL}에서 학생으로 가입해 줘. 가입할 때 '학부모 이메일'에 ${parentEmail}을 입력하면 부모님 계정과 자동으로 연결돼.`;

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError('복사하지 못했어요. 문장을 직접 선택해서 복사해 주세요.');
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    setError('');
    try {
      const cleanedDrafts = drafts
        .map((draft) => ({
          ...draft,
          name: draft.name.trim(),
          grade: draft.grade.trim(),
          groupId: draft.groupId.trim(),
        }))
        .filter((draft) => draft.name.length > 0);
      const records = buildProxyChildRecords({
        parentUid: user.uid,
        parentName: member.displayName,
        now: Date.now(),
        children: cleanedDrafts.map((draft) => ({
          id: draft.id,
          name: draft.name,
          grade: draft.grade,
          groupId: draft.groupId,
          usesPhone: draft.usesPhone,
        })),
      });

      const nextProxyIds = new Set(records.childDocs.map((childDoc) => childDoc.id));
      const removedProxyIds = [...existingProxyIds].filter((id) => !nextProxyIds.has(id));
      const batch = writeBatch(db);

      records.childDocs.forEach((childDoc) => {
        const ref = doc(db, 'next_generation_children', childDoc.id);
        if (existingProxyIds.has(childDoc.id)) {
          batch.set(ref, {
            displayName: childDoc.data.displayName,
            department: childDoc.data.department,
            groupId: childDoc.data.groupId,
            parentUids: childDoc.data.parentUids,
            linkedUid: childDoc.data.linkedUid,
            visibility: childDoc.data.visibility,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } else {
          batch.set(ref, {
            ...childDoc.data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      });

      removedProxyIds.forEach((id) => {
        batch.delete(doc(db, 'next_generation_children', id));
      });
      batch.update(doc(db, 'next_generation_members', user.uid), {
        parentOnboardingCompleted: true,
        proxyChildren: records.memberSummaries,
        childNames: cleanedDrafts.map((draft) => draft.name),
      });
      await batch.commit();
      onClose();
    } catch (e: any) {
      setError(e?.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">학부모 설정</p>
            <h2 className="mt-1 text-xl font-black text-emerald-950">우리 아이 등록/수정</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              자녀를 등록하면 내 페이지에서 아이 이름을 확인하고, 말씀 열매와 가정예배 기록에 함께 연결할 수 있어요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2 text-xs font-bold text-slate-500">
          <span className={step === 1 ? 'text-emerald-700' : ''}>1. 자녀 정보</span>
          <span>→</span>
          <span className={step === 2 ? 'text-emerald-700' : ''}>2. 사용 여부</span>
          <span>→</span>
          <span className={step === 3 ? 'text-emerald-700' : ''}>3. 저장</span>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            {drafts.map((d, idx) => (
              <div key={d.tempId} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-emerald-800">자녀 {idx + 1}</p>
                  {drafts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDraft(idx)}
                      className="text-xs text-rose-700 hover:underline"
                    >
                      <Trash2 size={12} className="inline" /> 삭제
                    </button>
                  )}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="이름"
                    value={d.name}
                    onChange={(e) => updateDraft(idx, { name: e.target.value })}
                  />
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="학년 (예: 초2)"
                    value={d.grade}
                    onChange={(e) => updateDraft(idx, { grade: e.target.value })}
                  />
                  <select
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={d.groupId}
                    onChange={(e) => updateDraft(idx, { groupId: e.target.value })}
                    disabled={groupsLoading || groups.length === 0}
                  >
                    <option value="">{groupsLoading ? '반 불러오는 중' : '반 선택'}</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  휴대폰이 없는 아이는 교사가 같은 반에서 볼 수 있도록 반 선택이 필요해요.
                </p>
              </div>
            ))}
            <button
              type="button"
              onClick={addDraft}
              className="flex items-center gap-1 rounded-lg border border-dashed border-emerald-300 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
            >
              <Plus size={14} /> 자녀 추가
            </button>
            <div className="mt-4 flex justify-between gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600"
              >
                취소
              </button>
              <button
                type="button"
                disabled={!validStep1}
                onClick={() => setStep(2)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-300"
              >
                다음
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {drafts.map((d, idx) => (
              <div key={d.tempId} className="rounded-xl border border-emerald-100 bg-white p-3">
                <p className="text-sm font-black text-emerald-950">
                  {d.name || `자녀 ${idx + 1}`}
                  {d.grade && <span className="ml-1 text-xs font-bold text-slate-500">({d.grade})</span>}
                </p>
                <p className="mt-1 text-xs text-slate-600">아이가 자기 휴대폰으로 로그인할 수 있나요?</p>
                <div className="mt-2 flex gap-2">
                  {(['yes', 'no'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateDraft(idx, { usesPhone: value })}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold ${
                        d.usesPhone === value
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                          : 'border-slate-300 text-slate-600 hover:border-emerald-300'
                      }`}
                    >
                      {value === 'yes' ? '네, 직접 가입해요' : '아직 어려워요'}
                    </button>
                  ))}
                </div>
                {d.usesPhone === 'no' && !d.groupId && (
                  <p className="mt-2 text-xs font-bold text-rose-600">
                    휴대폰이 없는 아이는 이전 단계에서 반을 선택해야 저장할 수 있어요.
                  </p>
                )}
              </div>
            ))}
            <div className="mt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600"
              >
                이전
              </button>
              <button
                type="button"
                disabled={!validStep2}
                onClick={() => setStep(3)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:bg-slate-300"
              >
                다음
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              내용을 확인하고 저장해 주세요. 휴대폰으로 직접 가입할 아이에게는 아래 안내 문장을 전달하면 됩니다.
            </p>
            {drafts.map((d) => (
              <div key={d.tempId} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-sm font-black text-emerald-950">
                  {d.name}
                  {d.grade && <span className="ml-1 text-xs font-bold text-slate-500">({d.grade})</span>}
                </p>
                {d.usesPhone === 'yes' ? (
                  <div className="mt-2 rounded-lg bg-sky-50 p-3 text-xs text-sky-900">
                    <p className="font-bold">가입 안내 메시지</p>
                    <p className="mt-1 leading-5 text-slate-700">{signupHint(d)}</p>
                    <button
                      type="button"
                      onClick={() => copy(signupHint(d), d.tempId)}
                      className="mt-2 inline-flex items-center gap-1 rounded-md border border-sky-300 bg-white px-2 py-1 text-xs font-bold text-sky-800 hover:bg-sky-50"
                    >
                      {copied === d.tempId ? <Check size={12} /> : <Copy size={12} />}
                      {copied === d.tempId ? '복사됨' : '메시지 복사'}
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">
                    부모님 계정에서 직접 말씀 열매와 가정예배를 체크할 수 있어요.
                  </p>
                )}
              </div>
            ))}
            <div className="mt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600"
                disabled={saving}
              >
                이전
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                저장하기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
