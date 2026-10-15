// Home panel "내가 맡은 후속 돌봄": groups my active tasks by how soon they are
// due, relative to today (Asia/Seoul). Titles are neutral; no detail is used here.
import { addDaysIso } from '../adminHelpers';
import type { CareTask } from './api';

export type HomeCareGroupId = 'overdue' | 'thisWeek' | 'later' | 'undated';

export const HOME_CARE_GROUP_LABELS: Record<HomeCareGroupId, string> = {
  overdue: '지난 확인일',
  thisWeek: '이번 주',
  later: '이후',
  undated: '확인일 없음',
};

export const HOME_CARE_GROUP_ORDER: HomeCareGroupId[] = ['overdue', 'thisWeek', 'later', 'undated'];
export const HOME_CARE_MAX_ROWS = 8;

export type HomeCareGroup = { id: HomeCareGroupId; label: string; tasks: CareTask[] };

export function groupIdForDueDate(dueOn: string | null, todayIso: string): HomeCareGroupId {
  if (!dueOn) return 'undated';
  if (dueOn < todayIso) return 'overdue';
  if (dueOn <= addDaysIso(todayIso, 6)) return 'thisWeek';
  return 'later';
}

export function groupHomeCareTasks(tasks: CareTask[], todayIso: string, maxRows = HOME_CARE_MAX_ROWS) {
  const active = tasks.filter((task) => task.status === 'open' || task.status === 'deferred');
  const buckets: Record<HomeCareGroupId, CareTask[]> = { overdue: [], thisWeek: [], later: [], undated: [] };
  for (const task of active) buckets[groupIdForDueDate(task.dueOn, todayIso)].push(task);
  const byDueThenName = (a: CareTask, b: CareTask) =>
    (a.dueOn || '').localeCompare(b.dueOn || '') ||
    a.memberName.localeCompare(b.memberName, 'ko') ||
    a.title.localeCompare(b.title, 'ko') ||
    a.id.localeCompare(b.id);
  let remaining = maxRows;
  const groups: HomeCareGroup[] = [];
  for (const id of HOME_CARE_GROUP_ORDER) {
    const sorted = buckets[id].sort(byDueThenName);
    const shown = sorted.slice(0, remaining);
    remaining -= shown.length;
    if (shown.length > 0) groups.push({ id, label: HOME_CARE_GROUP_LABELS[id], tasks: shown });
  }
  return { groups, hiddenCount: active.length - (maxRows - remaining), total: active.length };
}
