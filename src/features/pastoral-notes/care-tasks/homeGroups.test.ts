import { describe, expect, it } from 'vitest';
import type { CareTask } from './api';
import { groupHomeCareTasks, groupIdForDueDate } from './homeGroups';

const TODAY = '2026-10-14';
const task = (id: string, dueOn: string | null, overrides: Partial<CareTask> = {}): CareTask => ({
  id,
  memberId: `m-${id}`,
  memberName: `성도${id}`,
  sourceType: 'manual',
  sourceId: null,
  assigneeUid: 'me',
  title: '후속 면담',
  dueOn,
  status: 'open',
  hasDetail: false,
  schedule: null,
  revision: 1,
  updatedAt: '2026-10-01T00:00:00Z',
  ...overrides,
});

describe('groupIdForDueDate', () => {
  it.each([
    ['2026-10-13', 'overdue'],
    ['2026-10-14', 'thisWeek'],
    ['2026-10-20', 'thisWeek'],
    ['2026-10-21', 'later'],
    [null, 'undated'],
  ] as const)('%s -> %s', (dueOn, expected) => {
    expect(groupIdForDueDate(dueOn, TODAY)).toBe(expected);
  });
});

describe('groupHomeCareTasks', () => {
  it('orders groups and hides empty ones', () => {
    const { groups } = groupHomeCareTasks([task('a', null), task('b', '2026-10-21'), task('c', '2026-10-13')], TODAY);
    expect(groups.map((group) => group.label)).toEqual(['지난 확인일', '이후', '확인일 없음']);
  });

  it('keeps deferred tasks and drops finished ones', () => {
    const { groups, total } = groupHomeCareTasks(
      [task('a', '2026-10-15', { status: 'deferred' }), task('b', '2026-10-15', { status: 'done' }), task('c', '2026-10-15', { status: 'cancelled' })],
      TODAY
    );
    expect(total).toBe(1);
    expect(groups[0].tasks.map((item) => item.id)).toEqual(['a']);
  });

  it('sorts within a group by date, then member name', () => {
    const { groups } = groupHomeCareTasks(
      [task('1', '2026-10-16', { memberName: '나' }), task('2', '2026-10-15', { memberName: '다' }), task('3', '2026-10-16', { memberName: '가' })],
      TODAY
    );
    expect(groups[0].tasks.map((item) => item.id)).toEqual(['2', '3', '1']);
  });

  it('caps the rows across groups and reports the rest', () => {
    const tasks = [
      ...Array.from({ length: 5 }, (_, index) => task(`o${index}`, '2026-10-01')),
      ...Array.from({ length: 6 }, (_, index) => task(`w${index}`, '2026-10-15')),
    ];
    const { groups, hiddenCount, total } = groupHomeCareTasks(tasks, TODAY);
    expect(total).toBe(11);
    expect(groups.map((group) => group.tasks.length)).toEqual([5, 3]);
    expect(hiddenCount).toBe(3);
  });

  it('reports nothing hidden at exactly the cap', () => {
    const tasks = Array.from({ length: 8 }, (_, index) => task(`t${index}`, null));
    expect(groupHomeCareTasks(tasks, TODAY).hiddenCount).toBe(0);
  });
});
