// Creating a communion care period and settling its roster (plan 6.1–6.2).
// The roster is chosen by the pastor; nothing is inferred from age, office or
// past communion ticks, and leaving someone off never bars them from the Supper.
import React from 'react';
import type { User } from 'firebase/auth';
import { toast } from 'sonner';
import { Plus, Save, X } from 'lucide-react';
import type { RaahMember } from '../managementApi';
import { shell } from '../adminShell';
import { SyntheticBadge, TextInput } from '../AdminPrimitives';
import { getErrorMessage } from '../adminHelpers';
import { confirmDiscardChanges, useBeforeUnloadWarning } from '../hooks/useUnsavedChanges';
import { hasFormChanges } from '../formChanges';
import { createCommunionPeriod, updateCommunionRoster, type CommunionReview } from './api';
import { GUIDE_VERSION } from './questionGuide';
import { ROSTER_BATCH_SIZE, chunk, computeRosterChanges, validatePeriodDraft, type PeriodDraft } from './workflow';

const EMPTY_PERIOD: PeriodDraft = { name: '', startsOn: '', endsOn: '', serviceDate: '' };

export function CreatePeriodForm({
  user,
  onCreated,
  onCancel,
  onDirtyChange,
  initial,
}: {
  user: User;
  onCreated: (periodId: string) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  /** A suggested starting draft (next period). An untouched prefilled form is not "dirty". */
  initial?: PeriodDraft;
}) {
  const [baseline] = React.useState<PeriodDraft>(initial ?? EMPTY_PERIOD);
  const [draft, setDraft] = React.useState<PeriodDraft>(baseline);
  const [isSaving, setIsSaving] = React.useState(false);
  const idempotencyKey = React.useRef(crypto.randomUUID());
  const dirty = hasFormChanges(draft, baseline);
  useBeforeUnloadWarning(dirty);
  React.useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  React.useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validatePeriodDraft(draft);
    if (problem) {
      toast.error(problem);
      return;
    }
    setIsSaving(true);
    try {
      const { id } = await createCommunionPeriod(
        { name: draft.name.trim(), startsOn: draft.startsOn, endsOn: draft.endsOn, guideVersion: GUIDE_VERSION, serviceDate: draft.serviceDate || null },
        idempotencyKey.current,
        user
      );
      toast.success('목양 주기를 만들었습니다. 이어서 명부를 정해 주세요.');
      onDirtyChange(false);
      onCreated(id);
    } catch (error) {
      toast.error(getErrorMessage(error, '목양 주기를 만들지 못했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 border-b border-[#e6edf2] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">새 목양 주기</h3>
        <button type="button" onClick={() => confirmDiscardChanges(dirty) && onCancel()} className={shell.ghostButton + ' px-2 py-1 text-xs'} aria-label="새 목양 주기 닫기">
          <X size={14} />
        </button>
      </div>
      <TextInput label="주기 이름" value={draft.name} onChange={(name) => setDraft((prev) => ({ ...prev, name }))} placeholder="예: 가을 목양 주기, 대림절 성찬 준비" />
      <div className="grid gap-2 sm:grid-cols-3">
        <TextInput label="시작일" type="date" value={draft.startsOn} onChange={(startsOn) => setDraft((prev) => ({ ...prev, startsOn }))} />
        <TextInput label="종료일" type="date" value={draft.endsOn} onChange={(endsOn) => setDraft((prev) => ({ ...prev, endsOn }))} />
        <TextInput label="성찬 시행일 (선택)" type="date" value={draft.serviceDate} onChange={(serviceDate) => setDraft((prev) => ({ ...prev, serviceDate }))} />
      </div>
      <p className="text-xs text-[#607080]">
        담당: 나 · 대화 안내 {GUIDE_VERSION} · 시간대 Asia/Seoul. 심방 마감일 같은 일정은 교회 방침에 따라 정하며 앱이 강제하지 않습니다.
      </p>
      <button type="submit" disabled={isSaving} className={shell.button}>
        <Plus size={16} />
        {isSaving ? '만드는 중…' : '주기 만들기'}
      </button>
    </form>
  );
}

export function RosterEditor({
  periodId,
  members,
  reviews,
  user,
  onSaved,
  onClose,
  onDirtyChange,
  initialSelection,
}: {
  periodId: string;
  members: RaahMember[];
  reviews: CommunionReview[];
  user: User;
  onSaved: () => void;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
  /** Members suggested from the previous period. Not saved until the pastor saves, so it counts as unsaved changes. */
  initialSelection?: Set<string>;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(initialSelection ?? reviews.filter((review) => review.rosterState === 'included').map((review) => review.memberId))
  );
  const [query, setQuery] = React.useState('');
  const [showInactive, setShowInactive] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const changes = computeRosterChanges(reviews, selected);
  const dirty = changes.length > 0;
  useBeforeUnloadWarning(dirty);
  React.useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  React.useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const onRoster = new Set(reviews.map((review) => review.memberId));
  const needle = query.replace(/\s/g, '').toLocaleLowerCase('ko-KR');
  const candidates = members
    // Inactive members stay visible when they are already on this roster.
    .filter((member) => showInactive || member.status === 'active' || onRoster.has(member.id))
    .filter((member) => !needle || member.name.replace(/\s/g, '').toLocaleLowerCase('ko-KR').includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const toggle = (memberId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });

  const selectShown = (value: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const member of candidates) {
        if (value) next.add(member.id);
        else next.delete(member.id);
      }
      return next;
    });

  const save = async () => {
    setIsSaving(true);
    try {
      let applied = 0;
      for (const batch of chunk(changes, ROSTER_BATCH_SIZE)) {
        applied += (await updateCommunionRoster(periodId, batch, user)).applied;
      }
      toast.success(`명부를 저장했습니다. (변경 ${applied}명)`);
      onDirtyChange(false);
      onSaved();
    } catch (error) {
      // Keep the editor and the selection as they are: every entry is its own
      // transaction and resending one that already went through is a no-op, so
      // saving again finishes the job without losing any choice.
      toast.error(`${getErrorMessage(error, '명부를 저장하지 못했습니다.')} 일부만 반영되었을 수 있습니다. 선택은 그대로 두었으니 다시 저장해 주세요.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">명부 편집</h3>
        <button type="button" onClick={() => confirmDiscardChanges(dirty) && onClose()} className={shell.ghostButton + ' px-3 py-1.5 text-xs'}>
          닫기
        </button>
      </div>
      {initialSelection && dirty && <p className="text-xs text-[#607080]">지난 주기 명부를 불러왔습니다. 확인 후 저장하세요.</p>}
      <p className="rounded-md bg-[#f3f6f8] p-2 text-xs text-[#4b5d6d]">
        성찬회원 정보를 입력하는 화면이 아직 없어 활성 성도를 후보로 보여 줍니다. 명부에 넣지 않는 것은 성찬 참여 금지를 뜻하지 않으며, 제외한 성도의 목양 이력은 지워지지 않습니다.
      </p>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input aria-label="성도 이름 검색" placeholder="이름 검색" value={query} onChange={(event) => setQuery(event.target.value)} className={shell.input} />
        <label className="flex items-center gap-2 text-xs text-[#607080]">
          <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
          비활성 성도도 표시
        </label>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <button type="button" onClick={() => selectShown(true)} className={shell.ghostButton + ' px-2 py-1 text-xs'}>
          표시된 {candidates.length}명 모두 선택
        </button>
        <button type="button" onClick={() => selectShown(false)} className={shell.ghostButton + ' px-2 py-1 text-xs'}>
          표시된 성도 선택 해제
        </button>
      </div>
      <ul className="max-h-[420px] divide-y divide-[#e6edf2] overflow-y-auto rounded-lg border border-[#dbe3e8]">
        {candidates.map((member) => (
          <li key={member.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-[#f8fafb]">
              <input type="checkbox" checked={selected.has(member.id)} onChange={() => toggle(member.id)} />
              <span className="font-semibold">{member.name}{member.isSynthetic && <SyntheticBadge />}</span>
              <span className="text-xs text-[#607080]">{[member.district, member.position, member.status === 'inactive' ? '비활성' : ''].filter(Boolean).join(' · ')}</span>
            </label>
          </li>
        ))}
        {candidates.length === 0 && <li className="p-3 text-sm text-[#607080]">조건에 맞는 성도가 없습니다.</li>}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[#607080]" role="status">
          선택 {selected.size}명 · 저장할 변경 {changes.length}건
        </p>
        <button type="button" disabled={!dirty || isSaving} onClick={save} className={shell.button}>
          <Save size={16} />
          {isSaving ? '저장 중…' : '명부 저장'}
        </button>
      </div>
    </div>
  );
}
