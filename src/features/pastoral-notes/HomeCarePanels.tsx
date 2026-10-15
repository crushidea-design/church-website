// RAAH home: my follow-up care and the communion cycles in progress. Each panel
// loads on its own (it remounts whenever the home tab opens, so it is fresh) and
// keeps loading, empty and error apart: a failed load never reads as "nothing to do".
// Only neutral titles, member names, dates and counts are shown; no encrypted detail.
import React from 'react';
import type { User } from 'firebase/auth';
import { RefreshCw } from 'lucide-react';
import { shell } from './adminShell';
import { getTodayIso } from './adminHelpers';
import { formatDisplayDate } from './utils';
import { CARE_TASK_STATUS_LABELS, listMyActiveCareTasks, type CareTask } from './care-tasks/api';
import { groupHomeCareTasks } from './care-tasks/homeGroups';
import { listCommunionPeriods, type CommunionPeriod } from './communion/api';
import { describePeriodProgress } from './communion/workflow';

type Load<T> = { state: 'loading' } | { state: 'ready'; data: T } | { state: 'error' };

function useHomeLoad<T>(load: () => Promise<T>) {
  const [result, setResult] = React.useState<Load<T>>({ state: 'loading' });
  const [attempt, setAttempt] = React.useState(0);
  const loadRef = React.useRef(load);
  loadRef.current = load;
  React.useEffect(() => {
    let cancelled = false;
    setResult((prev) => (prev.state === 'ready' ? prev : { state: 'loading' }));
    loadRef.current()
      .then((data) => !cancelled && setResult({ state: 'ready', data }))
      .catch(() => !cancelled && setResult({ state: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  return { result, retry: () => { setResult({ state: 'loading' }); setAttempt((value) => value + 1); } };
}

function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-3 flex flex-col items-start gap-2" role="alert">
      <p className="text-sm text-[#8a3b2a]">{message}</p>
      <button type="button" onClick={onRetry} className={shell.ghostButton + ' px-3 py-1.5 text-xs'}>
        <RefreshCw size={14} />
        다시 시도
      </button>
    </div>
  );
}

export function HomeCarePanels({
  user,
  onOpenMember,
  onOpenPeriod,
  onOpenCommunionTab,
}: {
  user: User;
  onOpenMember: (memberId: string) => void;
  onOpenPeriod: (periodId: string) => void;
  onOpenCommunionTab: () => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <MyCareTasksPanel user={user} onOpenMember={onOpenMember} />
      <OpenPeriodsPanel user={user} onOpenPeriod={onOpenPeriod} onOpenCommunionTab={onOpenCommunionTab} />
    </div>
  );
}

function MyCareTasksPanel({ user, onOpenMember }: { user: User; onOpenMember: (memberId: string) => void }) {
  const { result, retry } = useHomeLoad(() => listMyActiveCareTasks(user));
  const todayIso = getTodayIso();
  const grouped = result.state === 'ready' ? groupHomeCareTasks(result.data, todayIso) : null;
  return (
    <section className={shell.panel + ' p-4'} aria-label="내가 맡은 후속 돌봄">
      <h2 className="text-base font-semibold">내가 맡은 후속 돌봄</h2>
      {result.state === 'loading' && <p className="mt-3 text-sm text-[#607080]" role="status">불러오는 중…</p>}
      {result.state === 'error' && <PanelError message="후속 돌봄을 불러오지 못했습니다." onRetry={retry} />}
      {grouped && grouped.total === 0 && <p className="mt-3 text-sm text-[#607080]">맡은 후속 돌봄이 없습니다.</p>}
      {grouped && grouped.total > 0 && (
        <div className="mt-3 space-y-3">
          {grouped.groups.map((group) => (
            <div key={group.id}>
              <h3 className="text-xs font-semibold text-[#607080]">{group.label}</h3>
              <ul className="mt-1 space-y-1.5">
                {group.tasks.map((task) => (
                  <CareTaskRow key={task.id} task={task} onOpen={() => onOpenMember(task.memberId)} />
                ))}
              </ul>
            </div>
          ))}
          {grouped.hiddenCount > 0 && <p className="text-xs text-[#607080]">외 {grouped.hiddenCount}건</p>}
        </div>
      )}
    </section>
  );
}

function CareTaskRow({ task, onOpen }: { task: CareTask; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className={shell.mutedPanel + ' flex w-full flex-wrap items-center justify-between gap-2 p-2 text-left text-sm'}>
        <span>
          <span className="font-semibold">{task.title}</span>
          <span className="ml-2 text-[#4b5d6d]">{task.memberName || '이름 없음'}</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs text-[#607080]">
          {task.dueOn && <span>{formatDisplayDate(task.dueOn)}</span>}
          {task.status === 'deferred' && <span className={shell.badge}>{CARE_TASK_STATUS_LABELS.deferred}</span>}
        </span>
      </button>
    </li>
  );
}

const MAX_OPEN_PERIODS = 3;

function OpenPeriodsPanel({
  user,
  onOpenPeriod,
  onOpenCommunionTab,
}: {
  user: User;
  onOpenPeriod: (periodId: string) => void;
  onOpenCommunionTab: () => void;
}) {
  const { result, retry } = useHomeLoad(() => listCommunionPeriods(user));
  const periods: CommunionPeriod[] =
    result.state === 'ready'
      ? result.data
        .filter((period) => period.status !== 'closed')
        .sort((a, b) => b.startsOn.localeCompare(a.startsOn) || b.endsOn.localeCompare(a.endsOn))
        .slice(0, MAX_OPEN_PERIODS)
      : [];
  return (
    <section className={shell.panel + ' p-4'} aria-label="진행 중인 성찬 목양">
      <h2 className="text-base font-semibold">진행 중인 성찬 목양</h2>
      {result.state === 'loading' && <p className="mt-3 text-sm text-[#607080]" role="status">불러오는 중…</p>}
      {result.state === 'error' && <PanelError message="성찬 목양 정보를 불러오지 못했습니다." onRetry={retry} />}
      {result.state === 'ready' && periods.length === 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[#607080]">진행 중인 목양 주기가 없습니다.</p>
          <button type="button" onClick={onOpenCommunionTab} className={shell.ghostButton + ' px-3 py-1.5 text-xs'}>
            성찬 탭으로
          </button>
        </div>
      )}
      {periods.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {periods.map((period) => (
            <li key={period.id}>
              <button type="button" onClick={() => onOpenPeriod(period.id)} className={shell.mutedPanel + ' w-full p-2 text-left text-sm'}>
                <span className="block font-semibold">{period.name}</span>
                <span className="block text-xs text-[#607080]">{formatDisplayDate(period.startsOn)} – {formatDisplayDate(period.endsOn)}</span>
                <span className="mt-1 block text-xs text-[#17202b]">
                  {describePeriodProgress(period.counts)} · 미확인 {period.counts.byStatus.not_started}명
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
