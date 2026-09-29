// Church-record facts for one member (plan 6.1): baptism, profession of faith,
// communicant registration. Entered from the church's own records with a source.
// The default is 미확인; nothing is inferred, and an unconfirmed status never bars
// anyone from the Supper or removes them from care.
import React from 'react';
import type { User } from 'firebase/auth';
import { toast } from 'sonner';
import { Pencil, Save } from 'lucide-react';
import { shell } from '../adminShell';
import { getErrorMessage } from '../adminHelpers';
import { confirmDiscardChanges, useBeforeUnloadWarning } from '../hooks/useUnsavedChanges';
import { hasFormChanges } from '../formChanges';
import { getMemberEcclesialProfile, setMemberEcclesialProfile } from './api';
import {
  BAPTISM_LABELS,
  COMMUNICANT_LABELS,
  ECCLESIAL_HINT,
  PROFESSION_LABELS,
  SOURCE_MAX_LENGTH,
  draftFromProfile,
  validateEcclesialDraft,
  type BaptismStatus,
  type CommunicantStatus,
  type EcclesialDraft,
  type MemberEcclesialProfile,
  type ProfessionStatus,
} from './helpers';

const formatVerifiedAt = (value: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium' }).format(parsed);
};

function StatusSelect<T extends string>({ label, value, labels, onChange }: { label: string; value: T; labels: Record<T, string>; onChange: (value: T) => void }) {
  return (
    <label className="block text-xs font-semibold text-[#607080]">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value as T)} className={shell.input + ' mt-1'}>
        {(Object.keys(labels) as T[]).map((key) => (
          <option key={key} value={key}>
            {labels[key]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function EcclesialProfileSection({
  memberId,
  user,
  onDirtyChange,
}: {
  memberId: string;
  user: User;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [profile, setProfile] = React.useState<MemberEcclesialProfile | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [reload, setReload] = React.useState(0);
  const [draft, setDraft] = React.useState<EcclesialDraft | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    getMemberEcclesialProfile(memberId, user)
      .then((next) => !cancelled && setProfile(next))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [memberId, user, reload]);

  const dirty = Boolean(profile && draft && hasFormChanges(draft, draftFromProfile(profile)));
  useBeforeUnloadWarning(dirty);
  React.useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  React.useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const cancel = () => {
    if (!confirmDiscardChanges(dirty)) return;
    setDraft(null);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || !profile) return;
    const problem = validateEcclesialDraft(draft);
    if (problem) {
      toast.error(problem);
      return;
    }
    setIsSaving(true);
    try {
      await setMemberEcclesialProfile(memberId, { ...draft, expectedRevision: profile.revision }, user);
      toast.success('교회 기록을 저장했습니다.');
      setDraft(null);
      setReload((value) => value + 1);
    } catch (error) {
      if ((error as { status?: number })?.status === 409) {
        toast.error('다른 곳에서 먼저 변경되었습니다. 최신 기록을 다시 불러왔습니다. 확인 후 다시 입력해 주세요.');
        setDraft(null);
        setReload((value) => value + 1);
      } else {
        toast.error(getErrorMessage(error, '교회 기록을 저장하지 못했습니다.'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-4 border-t border-[#e6edf2] pt-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">교회 기록 (세례·입교·성찬회원)</h4>
        {profile && !draft && (
          <button type="button" onClick={() => setDraft(draftFromProfile(profile))} className={shell.ghostButton + ' px-2 py-1 text-xs'}>
            <Pencil size={13} />
            수정
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-[#607080]">{ECCLESIAL_HINT}</p>
      {loadError ? (
        <p className="mt-2 text-sm text-[#8a3b2a]" role="alert">
          교회 기록을 불러오지 못했습니다. <button type="button" onClick={() => setReload((value) => value + 1)} className="underline">다시 시도</button>
        </p>
      ) : !profile ? (
        <p className="mt-2 text-sm text-[#607080]" role="status">불러오는 중…</p>
      ) : draft ? (
        <form onSubmit={save} className="mt-2 space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <StatusSelect<BaptismStatus> label="세례" value={draft.baptismStatus} labels={BAPTISM_LABELS} onChange={(baptismStatus) => setDraft({ ...draft, baptismStatus })} />
            <StatusSelect<ProfessionStatus> label="입교" value={draft.professionStatus} labels={PROFESSION_LABELS} onChange={(professionStatus) => setDraft({ ...draft, professionStatus })} />
            <StatusSelect<CommunicantStatus> label="성찬회원" value={draft.communicantStatus} labels={COMMUNICANT_LABELS} onChange={(communicantStatus) => setDraft({ ...draft, communicantStatus })} />
          </div>
          <label className="block text-xs font-semibold text-[#607080]">
            출처
            <input
              value={draft.sourceLabel}
              maxLength={SOURCE_MAX_LENGTH}
              onChange={(event) => setDraft({ ...draft, sourceLabel: event.target.value })}
              placeholder="출처 (예: 교적부 2026)"
              className={shell.input + ' mt-1'}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={isSaving || !dirty} className={shell.button}>
              <Save size={16} />
              {isSaving ? '저장 중…' : '저장'}
            </button>
            <button type="button" disabled={isSaving} onClick={cancel} className={shell.ghostButton}>
              취소
            </button>
          </div>
        </form>
      ) : (
        <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-xs text-[#607080]">세례</dt>
            <dd className="font-semibold">{BAPTISM_LABELS[profile.baptismStatus]}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#607080]">입교</dt>
            <dd className="font-semibold">{PROFESSION_LABELS[profile.professionStatus]}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#607080]">성찬회원</dt>
            <dd className="font-semibold">{COMMUNICANT_LABELS[profile.communicantStatus]}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-[#607080]">출처</dt>
            <dd>{profile.sourceLabel || '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#607080]">확인일</dt>
            <dd>{formatVerifiedAt(profile.verifiedAt)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
