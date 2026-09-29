// Communion services of one period (plan 6, R11). Changing a service only
// changes the schedule: reviews, conversations and care tasks stay as they are.
import React from 'react';
import type { User } from 'firebase/auth';
import { toast } from 'sonner';
import { shell } from '../adminShell';
import { getErrorMessage } from '../adminHelpers';
import { addCommunionOccasion, updateCommunionOccasion, type CommunionOccasion, type CommunionOccasionStatus } from './api';
import { OCCASION_CANCEL_CONFIRM, describeOccasion, occasionActions, type OccasionPatch } from './workflow';

const smallButton = shell.ghostButton + ' px-2.5 py-1 text-xs';

export function OccasionList({
  periodId,
  occasions,
  periodClosed,
  user,
  onChanged,
}: {
  periodId: string;
  occasions: CommunionOccasion[];
  periodClosed: boolean;
  user: User;
  /** Called after every attempt: with the saved change on success, with null after a failure so stale data is replaced. */
  onChanged: (patch: OccasionPatch | null) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  // Which row is being moved (id) or whether a new date is being added.
  const [movingId, setMovingId] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [dateDraft, setDateDraft] = React.useState('');

  const run = async (action: () => Promise<OccasionPatch>, done: string, failure: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const patch = await action();
      toast.success(done);
      setMovingId(null);
      setAdding(false);
      setDateDraft('');
      setBusy(false);
      onChanged(patch);
    } catch (error) {
      toast.error(
        (error as { status?: number })?.status === 409
          ? '다른 곳에서 먼저 변경되었거나 같은 날짜가 이미 있습니다. 최신 내용을 다시 불러옵니다.'
          : getErrorMessage(error, failure)
      );
      setBusy(false);
      onChanged(null);
    }
  };

  const setStatus = (occasion: CommunionOccasion, status: CommunionOccasionStatus, done: string) =>
    run(async () => ({ kind: 'update', id: occasion.id, status, ...(await updateCommunionOccasion(occasion.id, { expectedRevision: occasion.revision, status }, user)) }), done, '성찬 시행 상태를 바꾸지 못했습니다.');

  const submitDate = () => {
    if (!dateDraft) {
      toast.error('날짜를 골라 주세요.');
      return;
    }
    const moving = occasions.find((occasion) => occasion.id === movingId);
    if (moving) {
      return run(async () => ({ kind: 'update', id: moving.id, serviceDate: dateDraft, ...(await updateCommunionOccasion(moving.id, { expectedRevision: moving.revision, serviceDate: dateDraft }, user)) }), '시행일을 바꿨습니다.', '시행일을 바꾸지 못했습니다.');
    }
    return run(async () => ({ kind: 'add', serviceDate: dateDraft, ...(await addCommunionOccasion(periodId, dateDraft, user)) }), '시행일을 추가했습니다.', '시행일을 추가하지 못했습니다.');
  };

  const dateForm = (label: string) => (
    <form
      className="mt-1 flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void submitDate();
      }}
    >
      <input type="date" aria-label={label} value={dateDraft} onChange={(event) => setDateDraft(event.target.value)} className={shell.compactInput} />
      <button type="submit" disabled={busy} className={shell.button + ' px-3 py-1.5 text-xs'}>
        확인
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setMovingId(null);
          setAdding(false);
          setDateDraft('');
        }}
        className={smallButton}
      >
        취소
      </button>
    </form>
  );

  if (occasions.length === 0 && periodClosed) return null;

  return (
    <div className="mt-2" aria-label="성찬 시행">
      <h3 className="text-xs font-semibold text-[#4b5d6d]">성찬 시행</h3>
      {occasions.length === 0 ? (
        <p className="text-xs text-[#607080]">등록된 시행일이 없습니다.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {occasions.map((occasion) => (
            <li key={occasion.id} className="text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={occasion.status === 'cancelled' ? 'text-[#607080] line-through' : ''}>{describeOccasion(occasion)}</span>
                {occasionActions(occasion.status, periodClosed).map((action) => {
                  if (action === 'held') return <button key={action} type="button" disabled={busy} onClick={() => setStatus(occasion, 'held', '시행됨으로 표시했습니다.')} className={smallButton}>시행됨</button>;
                  if (action === 'move') {
                    return (
                      <button key={action} type="button" disabled={busy} onClick={() => { setAdding(false); setMovingId(occasion.id); setDateDraft(occasion.serviceDate); }} className={smallButton}>
                        날짜 변경
                      </button>
                    );
                  }
                  if (action === 'cancel') {
                    return (
                      <button
                        key={action}
                        type="button"
                        disabled={busy}
                        onClick={() => window.confirm(OCCASION_CANCEL_CONFIRM) && setStatus(occasion, 'cancelled', '성찬 시행을 취소했습니다.')}
                        className={smallButton}
                      >
                        취소
                      </button>
                    );
                  }
                  return <button key={action} type="button" disabled={busy} onClick={() => setStatus(occasion, 'scheduled', '예정으로 되돌렸습니다.')} className={smallButton}>되돌리기</button>;
                })}
              </div>
              {movingId === occasion.id && dateForm('새 시행일')}
            </li>
          ))}
        </ul>
      )}
      {!periodClosed &&
        (adding ? (
          dateForm('추가할 시행일')
        ) : (
          <button type="button" disabled={busy} onClick={() => { setMovingId(null); setDateDraft(''); setAdding(true); }} className={smallButton + ' mt-1'}>
            ＋ 시행일 추가
          </button>
        ))}
    </div>
  );
}
