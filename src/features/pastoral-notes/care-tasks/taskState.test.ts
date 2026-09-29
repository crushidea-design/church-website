import { describe, expect, it } from 'vitest';
import type { CareTask } from './api';
import { applyCareTaskStatus } from './taskState';

const task = (id: string, overrides: Partial<CareTask> = {}): CareTask => ({
  id, memberId: 'm', memberName: '', sourceType: 'manual', sourceId: null, assigneeUid: 'u', title: '후속 면담', dueOn: null,
  status: 'open', hasDetail: false, schedule: null, revision: 1, updatedAt: '2026-10-01T00:00:00Z', ...overrides,
});

describe('applyCareTaskStatus', () => {
  it('takes the new status and revision and sets the deferral date', () => {
    const next = applyCareTaskStatus([task('a'), task('b')], 'a', { status: 'deferred', revision: 2, dueOn: '2026-10-20' }, 'active');
    expect(next[0]).toMatchObject({ status: 'deferred', revision: 2, dueOn: '2026-10-20' });
    expect(next[1].revision).toBe(1);
  });
  it('keeps the due date when none is given', () => {
    expect(applyCareTaskStatus([task('a', { dueOn: '2026-10-05' })], 'a', { status: 'open', revision: 3 }, 'active')[0].dueOn).toBe('2026-10-05');
  });
  it('drops a finished task from the active list but keeps it in the full list', () => {
    expect(applyCareTaskStatus([task('a'), task('b')], 'a', { status: 'done', revision: 2 }, 'active').map((t) => t.id)).toEqual(['b']);
    expect(applyCareTaskStatus([task('a')], 'a', { status: 'cancelled', revision: 2 }, 'all')[0].status).toBe('cancelled');
  });
});
