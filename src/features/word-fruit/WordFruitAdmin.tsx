import React, { useEffect, useMemo, useState } from 'react';
import {
  Loader2, Save, AlertCircle, CheckCircle2, Eye, EyeOff, Sparkles, Megaphone, FileUp,
} from 'lucide-react';
import { extractPdfText } from './pdfText';
import { useNextGenerationAuth } from '../../lib/nextGenerationAuth';
import {
  fetchElementaryStudents,
  generateCardsFromManuscript,
  notifyPublishViaServer,
  saveCommunityAggregate,
  saveWeeklyWordFruit,
  summarizeProgress,
  upsertProgressByPastor,
} from './api';
import {
  emptyCards,
  GUIDE_MESSAGE_DEFAULT,
  TOP_MESSAGE_DEFAULT,
  WeeklyWordFruit,
  WordFruitCard,
  WordFruitProgress,
  WordFruitStatus,
} from './types';

interface Props {
  weekId: string;
  existingFruit: WeeklyWordFruit | null;
  allProgress: WordFruitProgress[];
}

interface FormState {
  title: string;
  passage: string;
  memoryVerse: string;
  fruitName: string;
  startDate: string;
  endDate: string;
  status: WordFruitStatus;
  topMessage: string;
  guideMessage: string;
  recommendedPracticesText: string;
  cards: WordFruitCard[];
  manuscript: string;
}

function fruitToForm(f: WeeklyWordFruit | null): FormState {
  if (!f) {
    return {
      title: '',
      passage: '',
      memoryVerse: '',
      fruitName: '',
      startDate: '',
      endDate: '',
      status: 'draft',
      topMessage: TOP_MESSAGE_DEFAULT,
      guideMessage: GUIDE_MESSAGE_DEFAULT,
      recommendedPracticesText: '',
      cards: emptyCards(),
      manuscript: '',
    };
  }
  return {
    title: f.title,
    passage: f.passage,
    memoryVerse: f.memoryVerse,
    fruitName: f.fruitName,
    startDate: f.startDate,
    endDate: f.endDate,
    status: f.status,
    topMessage: f.topMessage || TOP_MESSAGE_DEFAULT,
    guideMessage: f.guideMessage || GUIDE_MESSAGE_DEFAULT,
    recommendedPracticesText: (f.recommendedPractices || []).join('\n'),
    cards: f.cards && f.cards.length === 3 ? f.cards : emptyCards(),
    manuscript: '',
  };
}

export default function WordFruitAdmin({ weekId, existingFruit, allProgress }: Props) {
  const { user } = useNextGenerationAuth();
  const [form, setForm] = useState<FormState>(() => fruitToForm(existingFruit));
  const [savingFruit, setSavingFruit] = useState(false);
  const [fruitMsg, setFruitMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);

  // Reset form when existingFruit identity changes (e.g. after publish)
  useEffect(() => {
    setForm(fruitToForm(existingFruit));
  }, [existingFruit?.id, existingFruit?.updatedAt?.toMillis?.()]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  const updateCard = (idx: number, key: keyof WordFruitCard, value: string) => {
    setForm((s) => {
      const nextCards = [...s.cards];
      nextCards[idx] = { ...nextCards[idx], [key]: value } as WordFruitCard;
      return { ...s, cards: nextCards };
    });
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setFruitMsg({ tone: 'err', text: 'PDF 파일만 업로드할 수 있습니다.' });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setFruitMsg({ tone: 'err', text: 'PDF가 너무 커요 (20MB 이하).' });
      return;
    }
    setPdfBusy(true);
    setFruitMsg(null);
    setPdfFileName(file.name);
    try {
      const text = await extractPdfText(file);
      if (text.length < 30) {
        setFruitMsg({
          tone: 'err',
          text: 'PDF에서 텍스트를 추출하지 못했어요. 스캔본인 경우 텍스트를 직접 붙여 넣어 주세요.',
        });
        return;
      }
      // Append/replace? Replace is simpler — pastor can edit if needed.
      update('manuscript', text);
      setFruitMsg({
        tone: 'ok',
        text: `PDF에서 ${text.length.toLocaleString()}자 추출 완료. 검토 후 “강의원고로 카드 생성”을 눌러 주세요.`,
      });
    } catch (err: any) {
      console.error(err);
      setFruitMsg({ tone: 'err', text: 'PDF 처리 중 오류가 발생했습니다.' });
    } finally {
      setPdfBusy(false);
    }
  };

  const handleGenerateAI = async () => {
    setFruitMsg(null);
    if (!form.manuscript.trim()) {
      setFruitMsg({ tone: 'err', text: '강의원고를 입력해 주세요.' });
      return;
    }
    setAiBusy(true);
    try {
      const result = await generateCardsFromManuscript(form.manuscript);
      setForm((s) => ({
        ...s,
        cards: result.cards,
        recommendedPracticesText: result.recommendedPractices.length
          ? result.recommendedPractices.join('\n')
          : s.recommendedPracticesText,
        fruitName: s.fruitName || result.fruitName || '',
        memoryVerse: s.memoryVerse || result.memoryVerse || '',
      }));
      setFruitMsg({ tone: 'ok', text: 'AI 초안이 생성되었습니다. 반드시 검토 후 게시해 주세요.' });
    } catch (e: any) {
      console.error(e);
      setFruitMsg({ tone: 'err', text: e?.message || 'AI 생성 중 오류가 발생했습니다.' });
    } finally {
      setAiBusy(false);
    }
  };

  const handleNotify = async () => {
    if (!existingFruit || existingFruit.status !== 'published') {
      setFruitMsg({ tone: 'err', text: '먼저 게시된 후 알림을 보낼 수 있습니다.' });
      return;
    }
    if (!confirm('유초등부 회원(학생/학부모/교사)에게 인앱 알림과 푸시 알림을 보낼까요?')) return;
    setNotifyBusy(true);
    setFruitMsg(null);
    try {
      const result = await notifyPublishViaServer(existingFruit.weekId);
      setFruitMsg({
        tone: 'ok',
        text: `인앱 ${result.inAppCount}명 · 푸시 토큰 ${result.fcmTokenCount}개로 전송했습니다.`,
      });
    } catch (e: any) {
      console.error(e);
      setFruitMsg({ tone: 'err', text: e?.message || '알림 전송 중 오류가 발생했습니다.' });
    } finally {
      setNotifyBusy(false);
    }
  };

  const handleSave = async (status: WordFruitStatus) => {
    if (!form.title.trim() || !form.passage.trim()) {
      setFruitMsg({ tone: 'err', text: '강의 제목과 본문은 필수입니다.' });
      return;
    }
    setSavingFruit(true);
    setFruitMsg(null);
    try {
      await saveWeeklyWordFruit(
        {
          weekId,
          title: form.title.trim(),
          passage: form.passage.trim(),
          memoryVerse: form.memoryVerse.trim(),
          fruitName: form.fruitName.trim(),
          startDate: form.startDate,
          endDate: form.endDate,
          status,
          topMessage: form.topMessage.trim() || TOP_MESSAGE_DEFAULT,
          guideMessage: form.guideMessage.trim() || GUIDE_MESSAGE_DEFAULT,
          recommendedPractices: form.recommendedPracticesText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          cards: form.cards,
          createdBy: user?.uid,
        },
        !existingFruit,
      );
      setFruitMsg({
        tone: 'ok',
        text: status === 'published' ? '게시되었습니다.' : '임시 저장되었습니다.',
      });
    } catch (e) {
      console.error(e);
      setFruitMsg({ tone: 'err', text: '저장 중 오류가 발생했습니다.' });
    } finally {
      setSavingFruit(false);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <header className="flex items-center justify-between">
          <h3 className="text-base font-black text-emerald-950">이번 주 말씀 열매 ({weekId})</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              form.status === 'published'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {form.status === 'published' ? '게시됨' : '임시 저장'}
          </span>
        </header>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="강의 제목" required>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="예: 부모님은 소중해요"
            />
          </Field>
          <Field label="성경 본문" required>
            <input
              type="text"
              value={form.passage}
              onChange={(e) => update('passage', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="예: 에베소서 6:1-2"
            />
          </Field>
          <Field label="이번 주 말씀 한 줄">
            <input
              type="text"
              value={form.memoryVerse}
              onChange={(e) => update('memoryVerse', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="예: 네 부모를 공경하라"
            />
          </Field>
          <Field label="이번 주 열매 이름">
            <input
              type="text"
              value={form.fruitName}
              onChange={(e) => update('fruitName', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="예: 공경의 열매"
            />
          </Field>
          <Field label="시작일">
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => update('startDate', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="종료일">
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => update('endDate', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="상단 문구">
            <input
              type="text"
              value={form.topMessage}
              onChange={(e) => update('topMessage', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="안내 문구">
            <input
              type="text"
              value={form.guideMessage}
              onChange={(e) => update('guideMessage', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <Field label="추천 실천 목록 (한 줄에 하나)">
          <textarea
            value={form.recommendedPracticesText}
            onChange={(e) => update('recommendedPracticesText', e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder={'부모님 말씀을 끝까지 듣기\n부모님께 감사하다고 말하기'}
          />
        </Field>

        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-emerald-900">AI 카드 생성 (검토 필요)</p>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50">
                {pdfBusy ? <Loader2 className="animate-spin" size={12} /> : <FileUp size={12} />}
                PDF 불러오기
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={handlePdfUpload}
                  disabled={pdfBusy}
                />
              </label>
              <button
                type="button"
                onClick={handleGenerateAI}
                disabled={aiBusy || pdfBusy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {aiBusy ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                강의원고로 카드 생성
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            텍스트를 직접 붙여 넣거나 PDF 파일을 올려 주세요. AI 결과는 자동 게시되지 않습니다 — 반드시 검토·수정 후 “게시”를 눌러 주세요.
          </p>
          {pdfFileName && (
            <p className="mt-1 text-[11px] font-bold text-emerald-700">
              불러온 PDF: {pdfFileName}
            </p>
          )}
          <textarea
            value={form.manuscript}
            onChange={(e) => update('manuscript', e.target.value)}
            rows={8}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="강의원고를 붙여 넣거나 위 “PDF 불러오기”로 추출하세요"
          />
        </div>

        {/* Cards */}
        <div className="mt-4 space-y-3">
          {form.cards.map((card, idx) => (
            <div key={card.order} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-emerald-700">{card.order}회차 카드</p>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Field label="제목">
                  <input
                    type="text"
                    value={card.title}
                    onChange={(e) => updateCard(idx, 'title', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="짧은 기도">
                  <input
                    type="text"
                    value={card.prayer}
                    onChange={(e) => updateCard(idx, 'prayer', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </Field>
              </div>
              <Field label="요약">
                <textarea
                  value={card.summary}
                  onChange={(e) => updateCard(idx, 'summary', e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="오늘의 질문">
                <input
                  type="text"
                  value={card.question}
                  onChange={(e) => updateCard(idx, 'question', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </Field>
            </div>
          ))}
        </div>

        {fruitMsg && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              fruitMsg.tone === 'ok'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {fruitMsg.tone === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {fruitMsg.text}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleSave('draft')}
            disabled={savingFruit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <EyeOff size={14} /> 임시 저장
          </button>
          <button
            type="button"
            onClick={() => handleSave('published')}
            disabled={savingFruit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {savingFruit ? <Loader2 className="animate-spin" size={14} /> : <Eye size={14} />} 게시
          </button>
          <button
            type="button"
            onClick={handleNotify}
            disabled={notifyBusy || !existingFruit || existingFruit.status !== 'published'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            {notifyBusy ? <Loader2 className="animate-spin" size={14} /> : <Megaphone size={14} />} 게시 알림
          </button>
        </div>
      </section>

      <PracticeManager weekId={weekId} allProgress={allProgress} />

      <CommunitySummaryEditor
        weekId={weekId}
        existingFruit={existingFruit}
        allProgress={allProgress}
      />

      <ProgressTable allProgress={allProgress} />

      <p className="text-xs text-slate-500">
        반(그룹) 관리 · 부모-자녀 연결 · 데이터 마이그레이션은 다음세대 관리 페이지로 이동했습니다.
      </p>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="mt-3 block">
      <span className="mb-1 block text-xs font-bold text-slate-600">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function PracticeManager({
  weekId,
  allProgress,
}: {
  weekId: string;
  allProgress: WordFruitProgress[];
}) {
  const [students, setStudents] = useState<Array<{ uid: string; displayName: string; groupId?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchElementaryStudents()
      .then(setStudents)
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, []);

  const progressByUid = useMemo(() => {
    const map = new Map<string, WordFruitProgress>();
    allProgress.forEach((p) => map.set(p.userId, p));
    return map;
  }, [allProgress]);

  const handleSave = async (uid: string, displayName: string, groupId?: string) => {
    const value = (drafts[uid] ?? progressByUid.get(uid)?.practice ?? '').trim();
    if (!value) {
      setMsg({ tone: 'err', text: '실천 내용을 입력해 주세요.' });
      return;
    }
    if (value.length > 200) {
      setMsg({ tone: 'err', text: '실천 내용은 200자 이내로 입력해 주세요.' });
      return;
    }
    setSavingUid(uid);
    setMsg(null);
    try {
      await upsertProgressByPastor({
        weekId,
        userId: uid,
        childName: displayName,
        practice: value,
        groupId,
        existingProgress: progressByUid.get(uid) ?? null,
      });
      setDrafts((d) => ({ ...d, [uid]: '' }));
      setMsg({ tone: 'ok', text: `${displayName} 저장됨` });
    } catch (e) {
      console.error(e);
      setMsg({ tone: 'err', text: '저장 중 오류가 발생했습니다.' });
    } finally {
      setSavingUid(null);
    }
  };

  return (
    <section>
      <h3 className="text-base font-black text-emerald-950">아이별 작은 순종</h3>
      <p className="mt-1 text-xs text-slate-500">
        권장 길이 10~40자, 아이 눈높이의 긍정문으로 입력해 주세요.
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
          <Loader2 className="animate-spin" size={14} /> 학생 명단을 불러오는 중...
        </div>
      ) : students.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          “학생” 부서로 가입된 회원이 없습니다.
        </p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-bold">아이</th>
                <th className="px-3 py-2 text-left font-bold">이번 주 작은 순종</th>
                <th className="px-3 py-2 text-right font-bold">저장</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const existing = progressByUid.get(s.uid);
                const draft = drafts[s.uid] ?? existing?.practice ?? '';
                return (
                  <tr key={s.uid} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-bold text-slate-800">{s.displayName}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={draft}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [s.uid]: e.target.value }))
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                        placeholder="예: 부모님 말씀을 끝까지 듣기"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleSave(s.uid, s.displayName, s.groupId)}
                        disabled={savingUid === s.uid}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {savingUid === s.uid ? (
                          <Loader2 className="animate-spin" size={12} />
                        ) : (
                          <Save size={12} />
                        )}
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

function ProgressTable({ allProgress }: { allProgress: WordFruitProgress[] }) {
  if (allProgress.length === 0) {
    return null;
  }
  return (
    <section>
      <h3 className="text-base font-black text-emerald-950">이번 주 진행 현황</h3>
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-bold">아이</th>
              <th className="px-3 py-2 text-left font-bold">작은 순종</th>
              <th className="px-3 py-2 text-left font-bold">체크</th>
              <th className="px-3 py-2 text-left font-bold">마지막 체크</th>
              <th className="px-3 py-2 text-left font-bold">상태</th>
            </tr>
          </thead>
          <tbody>
            {allProgress.map((p) => {
              const last =
                p.checkedDates && p.checkedDates.length > 0
                  ? p.checkedDates[p.checkedDates.length - 1]
                  : '-';
              const status = p.completed
                ? '완료'
                : p.checkCount > 0
                  ? '익어가는 중'
                  : '자라는 중';
              return (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-bold text-slate-800">{p.childName}</td>
                  <td className="px-3 py-2 text-slate-700">{p.practice}</td>
                  <td className="px-3 py-2 text-slate-700">{Math.min(p.checkCount, 3)}/3</td>
                  <td className="px-3 py-2 text-slate-500">{last}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        p.completed
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.checkCount > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CommunitySummaryEditor({
  weekId,
  existingFruit,
  allProgress,
}: {
  weekId: string;
  existingFruit: WeeklyWordFruit | null;
  allProgress: WordFruitProgress[];
}) {
  const auto = useMemo(() => summarizeProgress(allProgress), [allProgress]);
  const [message, setMessage] = useState(existingFruit?.aggregateMessage ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setMessage(existingFruit?.aggregateMessage ?? '');
  }, [existingFruit?.id, existingFruit?.aggregateUpdatedAt?.toMillis?.()]);

  const ratio = auto.total > 0 ? Math.round((auto.completed / auto.total) * 100) : 0;
  const placeholder =
    auto.total > 0
      ? `우리 유초등부 ${auto.total}명 중 ${auto.completed}명이 이번 주 열매가 익었어요.`
      : '우리 유초등부의 말씀 열매가 자라고 있어요.';

  const handlePublish = async () => {
    if (!existingFruit) {
      setMsg({ tone: 'err', text: '먼저 이번 주 말씀 열매를 저장해 주세요.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await saveCommunityAggregate(weekId, {
        total: auto.total,
        completed: auto.completed,
        growing: auto.growing,
        message: message.trim() || placeholder,
      });
      setMsg({ tone: 'ok', text: '공동체 현황이 게시되었습니다.' });
    } catch (e) {
      console.error(e);
      setMsg({ tone: 'err', text: '저장 중 오류가 발생했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h3 className="text-base font-black text-emerald-950">공동체 익명 현황</h3>
      <p className="mt-1 text-xs text-slate-500">
        아이 이름·실천 내용·체크 횟수는 절대 공개되지 않습니다. 익명 합계와 격려 문구만 게시됩니다.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Stat label="등록된 학생" value={`${auto.total}명`} />
        <Stat label="이번 주 완료" value={`${auto.completed}명`} />
        <Stat label="완료 비율" value={`${ratio}%`} />
      </div>

      <Field label="공개 격려 문구">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder={placeholder}
        />
      </Field>

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

      <div className="mt-3">
        <button
          type="button"
          onClick={handlePublish}
          disabled={busy || !existingFruit}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} 공동체 현황 게시
        </button>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-base font-bold text-emerald-900">{value}</p>
    </div>
  );
}

