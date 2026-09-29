// Write side of a person's communion care (plan 7.3–7.4, 9.3–9.4, PR-8):
// status changes, the conversation record and links to earlier records.
// Conversation text is sent once to be encrypted server-side and is not kept
// in browser storage; switching person discards the draft after confirmation.
import React from 'react';
import type { User } from 'firebase/auth';
import { toast } from 'sonner';
import { Link2, Save, ShieldAlert } from 'lucide-react';
import type { RaahVisitationLog } from '../managementApi';
import { shell } from '../adminShell';
import { TextArea, TextInput } from '../AdminPrimitives';
import { getErrorMessage, getTodayIso } from '../adminHelpers';
import { formatDisplayDate } from '../utils';
import { useBeforeUnloadWarning } from '../hooks/useUnsavedChanges';
import {
  createCommunionLog,
  linkCommunionLog,
  transitionCommunionReview,
  type CommunionReviewDetail,
  type CommunionReviewStatus,
} from './api';
import {
  COVERAGE_LABELS,
  GUIDE_TOPICS,
  SAFETY_NOTICE,
  composeConversationNote,
  emptyConversationDraft,
  isConversationDraftEmpty,
  type ConversationDraft,
  type TopicCoverage,
} from './questionGuide';
import { ALLOWED_TRANSITIONS, REVIEW_STATUS_LABELS, TRANSITION_ACTION_LABELS, transitionNeedsReason } from './workflow';

const newIdempotencyKey = () => crypto.randomUUID();

// Status buttons share the row evenly; four choices go two by two on a phone.
const TRANSITION_GRID: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
};

export function ReviewStatusControl({
  detail,
  user,
  disabled,
  onChanged,
}: {
  detail: CommunionReviewDetail;
  user: User;
  disabled: boolean;
  onChanged: () => void;
}) {
  const { review } = detail;
  const [target, setTarget] = React.useState<CommunionReviewStatus | null>(null);
  const [reason, setReason] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const needsReason = target ? transitionNeedsReason(review.status, target) : false;

  const submit = async (to: CommunionReviewStatus) => {
    if (transitionNeedsReason(review.status, to) && !reason.trim()) {
      setTarget(to);
      return;
    }
    setIsSaving(true);
    try {
      await transitionCommunionReview(review.id, { status: to, expectedRevision: review.revision, reason: reason.trim() || undefined }, user);
      toast.success(`${REVIEW_STATUS_LABELS[to]}(으)로 바꿨습니다.`);
      setTarget(null);
      setReason('');
    } catch (error) {
      toast.error(getErrorMessage(error, '진행 상태를 바꾸지 못했습니다.'));
    } finally {
      setIsSaving(false);
      onChanged();
    }
  };

  return (
    <div className="mt-3">
      <p className="text-xs text-[#607080]">진행 상태 변경</p>
      <div className={`mt-1 grid gap-1.5 ${TRANSITION_GRID[ALLOWED_TRANSITIONS[review.status].length] || 'grid-cols-2'}`}>
        {ALLOWED_TRANSITIONS[review.status].map((to) => (
          <button
            key={to}
            type="button"
            disabled={disabled || isSaving}
            onClick={() => submit(to)}
            className={(to === 'reviewed' ? shell.button : shell.ghostButton) + ' w-full px-2 py-1.5 text-xs'}
          >
            {TRANSITION_ACTION_LABELS[to]}
          </button>
        ))}
      </div>
      {target && needsReason && (
        <div className="mt-2 space-y-2 rounded-md border border-[#dbe3e8] p-2">
          <TextInput
            label={`${REVIEW_STATUS_LABELS[target]} 사유 (짧고 중립적으로)`}
            value={reason}
            onChange={setReason}
            placeholder="예: 연락이 닿지 않음, 추가 면담 필요"
          />
          <div className="flex gap-2">
            <button type="button" disabled={isSaving || !reason.trim()} onClick={() => submit(target)} className={shell.button + ' px-3 py-1.5 text-xs'}>
              확인
            </button>
            <button type="button" onClick={() => setTarget(null)} className={shell.ghostButton + ' px-3 py-1.5 text-xs'}>
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ConversationForm({
  detail,
  user,
  disabled,
  onDirtyChange,
  onSaved,
}: {
  detail: CommunionReviewDetail;
  user: User;
  disabled: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = React.useState<ConversationDraft>(() => emptyConversationDraft(getTodayIso()));
  const [isSaving, setIsSaving] = React.useState(false);
  // One key per draft: a retried save after a timeout returns the same record.
  const idempotencyKey = React.useRef(newIdempotencyKey());
  const dirty = !isConversationDraftEmpty(draft);
  useBeforeUnloadWarning(dirty);
  React.useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  React.useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const setTopic = (key: string, change: Partial<{ coverage: TopicCoverage; note: string }>) =>
    setDraft((prev) => ({ ...prev, topics: { ...prev.topics, [key]: { ...prev.topics[key], ...change } } }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const innerNote = composeConversationNote(draft);
    if (!draft.date || !innerNote) {
      toast.error('대화일과 실제 대화·권면에 대한 기록을 적어 주세요.');
      return;
    }
    setIsSaving(true);
    try {
      await createCommunionLog(
        detail.review.id,
        {
          expectedRevision: detail.review.revision,
          date: draft.date,
          publicSummary: draft.publicSummary.trim(),
          innerNote,
          prayerTopics: draft.prayerTopics.trim(),
          nextSteps: draft.nextSteps.trim(),
        },
        idempotencyKey.current,
        user
      );
      toast.success('대화 기록을 암호화해 저장했습니다.');
      setDraft(emptyConversationDraft(getTodayIso()));
      idempotencyKey.current = newIdempotencyKey();
      onSaved();
    } catch (error) {
      toast.error(getErrorMessage(error, '대화 기록을 저장하지 못했습니다. 내용은 화면에 남아 있습니다.'));
      if ((error as { status?: number }).status === 409) onSaved();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="mt-4 space-y-3 border-t border-[#e6edf2] pt-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">대화 기록</h4>
        <span className="text-xs text-[#607080]">모든 항목을 채울 필요는 없습니다</span>
      </div>
      <TextInput label="대화일" type="date" value={draft.date} onChange={(date) => setDraft((prev) => ({ ...prev, date }))} />
      <div className="space-y-1.5">
        {GUIDE_TOPICS.map((topic) => (
          <details key={topic.key} className={shell.mutedPanel + ' p-2'}>
            <summary className="cursor-pointer text-sm font-semibold">
              {topic.title}
              {draft.topics[topic.key].coverage && (
                <span className="ml-2 text-xs font-normal text-[#2e6b5f]">{COVERAGE_LABELS[draft.topics[topic.key].coverage as Exclude<TopicCoverage, ''>]}</span>
              )}
            </summary>
            <p className="mt-2 text-sm text-[#17202b]">{topic.prompt}</p>
            <p className="mt-1 text-xs text-[#607080]">남길 수 있는 기록: {topic.hint}</p>
            {topic.key === 'love' && (
              <p className="mt-2 flex items-start gap-1.5 rounded-md bg-[#fbf3e6] p-2 text-xs text-[#6b4a1a]">
                <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                {SAFETY_NOTICE}
              </p>
            )}
            <label className="mt-2 block text-xs text-[#607080]">
              대화 범위
              <select
                value={draft.topics[topic.key].coverage}
                onChange={(event) => setTopic(topic.key, { coverage: event.target.value as TopicCoverage })}
                className={shell.input + ' mt-1'}
              >
                <option value="">선택 안 함</option>
                {(Object.keys(COVERAGE_LABELS) as Array<Exclude<TopicCoverage, ''>>).map((coverage) => (
                  <option key={coverage} value={coverage}>
                    {COVERAGE_LABELS[coverage]}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-2">
              <TextArea
                label="들은 내용과 목양자의 이해 (구분해 적기)" locked
                value={draft.topics[topic.key].note}
                onChange={(note) => setTopic(topic.key, { note })}
                rows={3}
              />
            </div>
          </details>
        ))}
      </div>
      <TextArea label="전한 말씀과 권면" locked value={draft.counsel} onChange={(counsel) => setDraft((prev) => ({ ...prev, counsel }))} rows={3} />
      <TextArea label="함께 기도한 내용" locked value={draft.prayerTopics} onChange={(prayerTopics) => setDraft((prev) => ({ ...prev, prayerTopics }))} rows={2} />
      <TextArea label="다음 돌봄" locked value={draft.nextSteps} onChange={(nextSteps) => setDraft((prev) => ({ ...prev, nextSteps }))} rows={2} />
      <TextInput
        label="목록용 요약 (민감한 내용은 적지 마세요)"
        value={draft.publicSummary}
        onChange={(publicSummary) => setDraft((prev) => ({ ...prev, publicSummary }))}
        placeholder="예: 후속 면담, 가정 방문"
      />
      <p className="text-xs text-[#607080]">목록용 요약은 기록 목록에 표시됩니다. 나머지 내용은 서버에서 암호화해 저장합니다.</p>
      <button type="submit" disabled={disabled || isSaving} className={shell.button + ' w-full'}>
        <Save size={16} />
        {isSaving ? '저장 중…' : '대화 기록 저장'}
      </button>
    </form>
  );
}

export function LinkedLogs({
  detail,
  memberLogs,
  user,
  disabled,
  onOpenLog,
  onChanged,
}: {
  detail: CommunionReviewDetail;
  memberLogs: RaahVisitationLog[];
  user: User;
  disabled: boolean;
  onOpenLog: (logId: string) => void;
  onChanged: () => void;
}) {
  const linkedIds = new Set(detail.logs.map((log) => log.id));
  const candidates = memberLogs.filter((log) => !linkedIds.has(log.id));
  const [candidateId, setCandidateId] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  const link = async () => {
    if (!candidateId) return;
    setIsSaving(true);
    try {
      await linkCommunionLog(detail.review.id, candidateId, user);
      toast.success('기존 기록을 이번 목양에 연결했습니다.');
      setCandidateId('');
      onChanged();
    } catch (error) {
      toast.error(getErrorMessage(error, '기록을 연결하지 못했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold">이번 목양에 연결된 기록</h4>
      {detail.logs.length === 0 ? (
        <p className="mt-1 text-sm text-[#607080]">아직 연결된 기록이 없습니다.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {detail.logs.map((log) => (
            <li key={log.id}>
              <button type="button" onClick={() => onOpenLog(log.id)} className="text-sm text-[#12345a] underline decoration-[#b8ccc8] underline-offset-4">
                {formatDisplayDate(log.date)} · {log.logType}
                {log.publicSummary && ` · ${log.publicSummary}`}
              </button>
            </li>
          ))}
        </ul>
      )}
      {candidates.length > 0 && (
        <div className="mt-2 flex gap-2">
          <select aria-label="연결할 기존 기록" value={candidateId} onChange={(event) => setCandidateId(event.target.value)} className={shell.input}>
            <option value="">기존 심방 기록 선택</option>
            {candidates.map((log) => (
              <option key={log.id} value={log.id}>
                {formatDisplayDate(log.date)} · {log.logType}
              </option>
            ))}
          </select>
          <button type="button" disabled={disabled || isSaving || !candidateId} onClick={link} className={shell.ghostButton + ' shrink-0'}>
            <Link2 size={14} />
            연결
          </button>
        </div>
      )}
    </div>
  );
}
