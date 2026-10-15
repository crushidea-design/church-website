import type { CareTask, CareTaskStatus } from './api';

/**
 * Shows a saved status change at once, from the server's answer (new status and
 * revision), so the next click carries the new revision. In the "active" list a
 * finished task leaves; the "all" list keeps it. A background reload reconciles the rest.
 */
export function applyCareTaskStatus(
  tasks: CareTask[],
  taskId: string,
  saved: { status: CareTaskStatus; revision: number; dueOn?: string },
  scope: 'active' | 'all'
): CareTask[] {
  return tasks
    .map((task) => (task.id === taskId ? { ...task, status: saved.status, revision: saved.revision, dueOn: saved.dueOn ?? task.dueOn } : task))
    .filter((task) => scope === 'all' || (task.status !== 'done' && task.status !== 'cancelled'));
}
