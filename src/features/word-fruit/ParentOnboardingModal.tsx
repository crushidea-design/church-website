import React, { useEffect, useState } from 'react';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Loader2, Plus, Trash2, Copy, Check } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useNextGenerationAuth } from '../../lib/nextGenerationAuth';
import { buildProxyChildRecords } from '../next-generation/proxyChildren';
import { subscribeGroups } from './api';
import type { WordFruitGroup } from './types';

interface DraftChild {
  tempId: string;
  name: string;
  grade: string;
  groupId: string;
  usesPhone: 'yes' | 'no' | null;
}

function makeDraft(): DraftChild {
  return { tempId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: '', grade: '', groupId: '', usesPhone: null };
}

export default function ParentOnboardingModal() {
  const { user, member } = useNextGenerationAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [drafts, setDrafts] = useState<DraftChild[]>([makeDraft()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [groups, setGroups] = useState<WordFruitGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

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

  const parentEmail = (member.email || '').toLowerCase();
  const signupHint = (child: DraftChild) => {
    const base = `${child.name || '아이'}야, /next 페이지에서 학생으로 가입해 줘. 가입 화면의 '학부모 이메일' 칸에 ${parentEmail} 을(를) 입력하면 부모님과 자동 연결돼.`;
    return base;
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError('복사 실패: 직접 텍스트를 선택해서 복사해 주세요.');
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    setError('');
    try {
      const records = buildProxyChildRecords({
        parentUid: user.uid,
        parentName: member.displayName,
        now: Date.now(),
        children: drafts.map((draft) => ({
          name: draft.name,
          grade: draft.grade,
          groupId: draft.groupId,
          usesPhone: draft.usesPhone,
        })),
      });
      const batch = writeBatch(db);

      records.childDocs.forEach((childDoc) => {
        batch.set(doc(db, 'next_generation_children', childDoc.id), {
          ...childDoc.data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      batch.update(doc(db, 'next_generation_members', user.uid), {
        parentOnboardingCompleted: true,
        proxyChildren: records.memberSummaries,
      });
      await batch.commit();
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
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">학부모 첫 설정</p>
          <h2 className="mt-1 text-xl font-black text-emerald-950">우리 아이를 등록해 주세요</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            한우리교회 다음세대 학부모 계정의 첫 설정입니다. 아이를 등록하면 매주 가정예배와 말씀 열매를 함께 돌볼 수 있습니다.
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-4 flex items-center gap-2 text-xs font-bold text-slate-500">
          <span className={step === 1 ? 'text-emerald-700' : ''}>1. 자녀 정보</span>
          <span>›</span>
          <span className={step === 2 ? 'text-emerald-700' : ''}>2. 스마트폰 사용</span>
          <span>›</span>
          <span className={step === 3 ? 'text-emerald-700' : ''}>3. 마무리</span>
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
                    placeholder="학년 (예: 초3)"
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
                  스마트폰이 없는 아이는 교사가 같은 반에서 볼 수 있도록 반 선택이 필요합니다.
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
            <div className="mt-4 flex justify-end gap-2">
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
                <p className="mt-1 text-xs text-slate-600">아이가 스마트폰을 사용하나요?</p>
                <div className="mt-2 flex gap-2">
                  {(['yes', 'no'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => updateDraft(idx, { usesPhone: v })}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold ${
                        d.usesPhone === v
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                          : 'border-slate-300 text-slate-600 hover:border-emerald-300'
                      }`}
                    >
                      {v === 'yes' ? '네, 사용해요' : '아직 사용하지 않아요'}
                    </button>
                  ))}
                </div>
                {d.usesPhone === 'no' && !d.groupId && (
                  <p className="mt-2 text-xs font-bold text-rose-600">
                    스마트폰이 없는 아이는 이전 단계에서 반을 선택해야 저장할 수 있어요.
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
              아래 정보를 확인하고 저장해 주세요. 스마트폰을 사용하는 자녀에게는 가입 안내 메시지를 복사해 전달해 주세요.
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
                    부모님 계정에서 직접 열매와 가정예배를 체크해 주세요.
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
                저장하고 시작하기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
