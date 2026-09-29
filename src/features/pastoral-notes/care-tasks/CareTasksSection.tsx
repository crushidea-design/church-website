// Follow-up care for one person (plan 7.4, 8.2, PR-9). The list shows neutral
// titles; a task's detail is fetched (and audited) only when asked for and is
// dropped when the panel closes. A linked calendar slot is shown separately:
// finishing the visit on the calendar does not finish the care.
import React from 'react';
import type { User } from 'firebase/auth';
import { toast } from 'sonner';
import { CalendarDays, Eye, Plus } from 'lucide-react';
import { shell } from '../adminShell';
import { TextArea, TextInput } from '../AdminPrimitives';
import { getErrorMessage } from '../adminHelpers';
import { formatDisplayDate } from '../utils';
import { confirmDiscardChanges, useBeforeUnloadWarning } from '../hooks/useUnsavedChanges';
import { hasFormChanges } from '../formChanges';
import {
  CARE_TASK_STATUS_LABELS,
  createCareTask,
  getCareTask,
  listCareTasks,
  setCareTaskStatus,
  type CareTask,
  type CareTaskSourceType,
} from './api';

export type SourceOption = { value: string; label: string; sourceType: CareTaskSourceType; sourceId: string | null };

type TaskDraft = { title: string; dueOn: string; source: string; detail: string; scheduleDate: string; scheduleStartsAt: string };

const emptyDraft = (source: string): TaskDraft => ({ title: '후속 면담', dueOn: '', source, detail: '', scheduleDate: '', scheduleStartsAt: '' });

export function CareTasksSection({
  memberId,
  sources,
  user,
  disabled,
  onDirtyChange,
}: {
  memberId: string;
  /** Where a new task can point: this review, one of its linked records, or nothing. */
  sources: SourceOption[];
  user: User;
  disabled: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [scope, setScope] = React.useState<'active' | 'all'>('active');
  const [tasks, setTasks] = React.useState<CareTask[] | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [reload, setReload] = React.useState(0);
  const [details, setDetails] = React.useState<Record<string, string>>({});
  const [deferDates, setDeferDates] = React.useState<Record<string, string>>({});
  const [busyTaskId, setBusyTaskId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    listCareTasks(memberId, scope, user)
      .then((next) => !cancelled && setTasks(next))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [memberId, scope, user, reload]);

  const refresh = () => setReload((value) => value + 1);

  const showDetail = async (taskId: string) => {
    try {
      const task = await getCareTask(taskId, user);
      setDetails((prev) => ({ ...prev, [taskId]: task.detail }));
    } catch (error) {
      toast.error(getErrorMessage(error, '내용을 불러오지 못했습니다.'));
    }
  };

  const changeStatus = async (task: CareTask, status: CareTask['status']) => {
    const dueOn = status === 'deferred' ? deferDates[task.id] : undefined;
    if (status === 'deferred' && !dueOn) {
      toast.error('연기할 날짜를 골라 주세요.');
      return;
    }
    setBusyTaskId(task.id);
    try {
      await setCareTaskStatus(task.id, { status, expectedRevision: task.revision, dueOn }, user);
      toast.success(`후속 돌봄을 '${CARE_TASK_STATUS_LABELS[status]}'(으)로 바꿨습니다.`);
    } catch (error) {
      toast.error(getErrorMessage(error, '후속 돌봄을 바꾸지 못했습니다.'));
    } finally {
      setBusyTaskId(null);
      refresh();
    }
  };

  return (
    <div className="mt-4 border-t border-[#e6edf2] pt-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">후속 돌봄</h4>
        <label className="flex items-center gap-1.5 text-xs text-[#607080]">
          <input type="checkbox" checked={scope === 'all'} onChange={(event) => setScope(event.target.checked ? 'all' : 'active')} />
          완료·취소 포함
        </label>
      </div>
      {loadError ? (
        <p className="mt-1 text-sm text-[#8a3b2a]" role="alert">
          후속 돌봄을 불러오지 못했습니다. <button type="button" onClick={refresh} className="underline">다시 시도</button>
        </p>
      ) : tasks === null ? (
        <p className="mt-1 text-sm text-[#607080]" role="status">불러오는 중…</p>
      ) : tasks.length === 0 ? (
        <p className="mt-1 text-sm text-[#607080]">{scope === 'active' ? '남은 후속 돌봄이 없습니다.' : '후속 돌봄 기록이 없습니다.'}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {tasks.map((task) => {
            const finished = task.status === 'done' || task.status === 'cancelled';
            return (
              <li key={task.id} className={shell.mutedPanel + ' p-2 text-sm'}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{task.title}</p>
                  <span className={shell.badge}>{CARE_TASK_STATUS_LABELS[task.status]}</span>
                </div>
                <p className="mt-1 text-xs text-[#607080]">
                  {task.dueOn ? `확인일 ${formatDisplayDate(task.dueOn)}` : '확인일 없음'}
                  {task.schedule && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <CalendarDays size={12} />
                      약속 {formatDisplayDate(task.schedule.date)} {task.schedule.startsAt}
                      {task.schedule.status === 'done' && ' · 일정 완료(돌봄 완료와 별개)'}
                    </span>
                  )}
                </p>
                {task.hasDetail &&
                  (details[task.id] !== undefined ? (
                    <p className="mt-1 whitespace-pre-wrap rounded bg-white p-2 text-xs">{details[task.id] || '(내용 없음)'}</p>
                  ) : (
                    <button type="button" onClick={() => showDetail(task.id)} className="mt-1 inline-flex items-center gap-1 text-xs text-[#12345a] underline">
                      <Eye size={12} />
                      내용 보기
                    </button>
                  ))}
                {!disabled && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {finished ? (
                      <button type="button" disabled={busyTaskId === task.id} onClick={() => changeStatus(task, 'open')} className={shell.ghostButton + ' px-2 py-1 text-xs'}>
                        다시 열기
                      </button>
                    ) : (
                      <>
                        <button type="button" disabled={busyTaskId === task.id} onClick={() => changeStatus(task, 'done')} className={shell.button + ' px-2 py-1 text-xs'}>
                          완료
                        </button>
                        {task.status === 'deferred' && (
                          <button type="button" disabled={busyTaskId === task.id} onClick={() => changeStatus(task, 'open')} className={shell.ghostButton + ' px-2 py-1 text-xs'}>
                            다시 진행
                          </button>
                        )}
                        <input
                          type="date"
                          aria-label={`${task.title} 연기할 날짜`}
                          value={deferDates[task.id] || ''}
                          onChange={(event) => setDeferDates((prev) => ({ ...prev, [task.id]: event.target.value }))}
                          className={shell.input + ' w-auto px-2 py-1 text-xs'}
                        />
                        <button type="button" disabled={busyTaskId === task.id} onClick={() => changeStatus(task, 'deferred')} className={shell.ghostButton + ' px-2 py-1 text-xs'}>
                          연기
                        </button>
                        <button type="button" disabled={busyTaskId === task.id} onClick={() => changeStatus(task, 'cancelled')} className={shell.ghostButton + ' px-2 py-1 text-xs'}>
                          취소
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!disabled && <NewTaskForm memberId={memberId} sources={sources} user={user} onDirtyChange={onDirtyChange} onCreated={refresh} />}
    </div>
  );
}

function NewTaskForm({
  memberId,
  sources,
  user,
  onDirtyChange,
  onCreated,
}: {
  memberId: string;
  sources: SourceOption[];
  user: User;
  onDirtyChange: (dirty: boolean) => void;
  onCreated: () => void;
}) {
  const initialSource = sources[0]?.value || 'manual';
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<TaskDraft>(() => emptyDraft(initialSource));
  const [isSaving, setIsSaving] = React.useState(false);
  const idempotencyKey = React.useRef(crypto.randomUUID());
  const dirty = open && hasFormChanges(draft, emptyDraft(initialSource));
  useBeforeUnloadWarning(dirty);
  React.useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  React.useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const source = sources.find((option) => option.value === draft.source);
    if (!draft.title.trim()) {
      toast.error('목록에 보일 짧은 제목을 적어 주세요.');
      return;
    }
    if (draft.scheduleStartsAt && !draft.scheduleDate) {
      toast.error('약속 시간을 정하려면 날짜도 골라 주세요.');
      return;
    }
    setIsSaving(true);
    try {
      await createCareTask(
        {
          memberId,
          sourceType: source?.sourceType || 'manual',
          sourceId: source?.sourceId ?? null,
          title: draft.title.trim(),
          dueOn: draft.dueOn || null,
          detail: draft.detail.trim(),
          schedule: draft.scheduleDate ? { date: draft.scheduleDate, startsAt: draft.scheduleStartsAt } : null,
        },
        idempotencyKey.current,
        user
      );
      toast.success(draft.scheduleDate ? '후속 돌봄과 목양 일정을 만들었습니다.' : '후속 돌봄을 만들었습니다.');
      idempotencyKey.current = crypto.randomUUID();
      setDraft(emptyDraft(initialSource));
      setOpen(false);
      onCreated();
    } catch (error) {
      toast.error(getErrorMessage(error, '후속 돌봄을 만들지 못했습니다. 내용은 화면에 남아 있습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={shell.ghostButton + ' mt-2 px-3 py-1.5 text-xs'}>
        <Plus size={14} />
        후속 돌봄 추가
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2 rounded-md border border-[#dbe3e8] p-2">
      <TextInput label="목록용 제목 (민감한 내용 없이)" value={draft.title} onChange={(title) => setDraft((prev) => ({ ...prev, title }))} placeholder="예: 후속 면담, 안부 연락" />
      <TextInput label="다음 확인일" type="date" value={draft.dueOn} onChange={(dueOn) => setDraft((prev) => ({ ...prev, dueOn }))} />
      <label className="block text-xs text-[#607080]">
        원본 연결
        <select value={draft.source} onChange={(event) => setDraft((prev) => ({ ...prev, source: event.target.value }))} className={shell.input + ' mt-1'}>
          {sources.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <TextArea label="구체적인 행동 (암호화 저장, 선택)" value={draft.detail} onChange={(detail) => setDraft((prev) => ({ ...prev, detail }))} rows={2} locked />
      <div className="grid grid-cols-2 gap-2">
        <TextInput label="심방 약속일 (선택)" type="date" value={draft.scheduleDate} onChange={(scheduleDate) => setDraft((prev) => ({ ...prev, scheduleDate }))} />
        <TextInput label="시간" type="time" value={draft.scheduleStartsAt} onChange={(scheduleStartsAt) => setDraft((prev) => ({ ...prev, scheduleStartsAt }))} />
      </div>
      <p className="text-xs text-[#607080]">약속을 정하면 사역 일정에 '목양 일정'이라는 중립 제목으로 추가됩니다.</p>
      <div className="flex gap-2">
        <button type="submit" disabled={isSaving} className={shell.button + ' px-3 py-1.5 text-xs'}>
          {isSaving ? '저장 중…' : '추가'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!confirmDiscardChanges(dirty)) return;
            setDraft(emptyDraft(initialSource));
            setOpen(false);
          }}
          className={shell.ghostButton + ' px-3 py-1.5 text-xs'}
        >
          닫기
        </button>
      </div>
    </form>
  );
}
