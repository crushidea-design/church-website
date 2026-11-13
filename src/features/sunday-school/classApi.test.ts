import { beforeEach, describe, expect, it, vi } from 'vitest';

const DELETE = { __delete: true };
const { set, commit, getDocs } = vi.hoisted(() => ({ set: vi.fn(), commit: vi.fn(), getDocs: vi.fn() }));
vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => name,
  doc: (_db: unknown, collectionName: string, id: string) => `${collectionName}/${id}`,
  getDocs,
  where: vi.fn(),
  query: vi.fn(),
  onSnapshot: vi.fn(),
  deleteField: () => DELETE,
  serverTimestamp: () => 'ts',
  writeBatch: () => ({ set, commit }),
}));

import { createMissingClassGroups, saveClassRows } from './classApi';

const row = (uid: string, extra = {}) => ({
  uid, name: uid, present: true, period2: true, publicWorship: false, memoryChecked: false, promise: '', ...extra,
});

describe('saveClassRows', () => {
  beforeEach(() => {
    set.mockReset();
    commit.mockReset().mockResolvedValue(undefined);
  });

  it('writes attendance with the same doc id and fields plus period2/publicWorship', async () => {
    await saveClassRows({ weekKey: '2027-03-07', classId: 'seum', checkedBy: 't', rows: [row('a')], weeklyWrites: [] });
    expect(set).toHaveBeenCalledTimes(1);
    const [ref, data, options] = set.mock.calls[0];
    expect(ref).toBe('next_generation_attendance/2027-03-07_a');
    expect(options).toEqual({ merge: true });
    expect(data).toEqual({
      weekKey: '2027-03-07', sundayDate: '2027-03-07', studentUid: 'a', studentName: 'a', groupId: 'seum',
      present: true, period2: true, publicWorship: false, checkedBy: 't', checkedAt: 'ts',
    });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('writes weekly docs with only allowed fields and deleteField for cleared values', async () => {
    await saveClassRows({
      weekKey: '2027-03-07', classId: 'seum', checkedBy: 't',
      rows: [row('a'), row('b')],
      weeklyWrites: [
        { studentUid: 'a', studentName: 'a', promise: '인사하기', memoryChecked: true, memoryQuestion: 3 },
        { studentUid: 'b', studentName: 'b', promise: null, memoryChecked: null, memoryQuestion: null },
      ],
    });
    const weekly = set.mock.calls.filter(([ref]) => String(ref).startsWith('next_generation_school_weekly/'));
    expect(weekly.map(([ref]) => ref)).toEqual([
      'next_generation_school_weekly/2027-03-07_a',
      'next_generation_school_weekly/2027-03-07_b',
    ]);
    expect(weekly[0][1]).toEqual({
      weekKey: '2027-03-07', studentUid: 'a', studentName: 'a', classId: 'seum', promise: '인사하기',
      memoryChecked: true, memoryQuestion: 3, updatedBy: 't', updatedAt: 'ts',
    });
    expect(weekly[1][1]).toMatchObject({ promise: DELETE, memoryChecked: DELETE, memoryQuestion: DELETE });
  });

  it('splits large classes into several batches', async () => {
    const rows = Array.from({ length: 450 }, (_, i) => row(`s${i}`));
    await saveClassRows({ weekKey: '2027-03-07', classId: 'didim', checkedBy: 't', rows, weeklyWrites: [] });
    expect(commit).toHaveBeenCalledTimes(3);
  });
});

describe('createMissingClassGroups', () => {
  beforeEach(() => {
    set.mockReset();
    commit.mockReset().mockResolvedValue(undefined);
    getDocs.mockReset();
  });

  it('creates only the missing class groups and never touches existing ones', async () => {
    getDocs.mockResolvedValue({ docs: [{ id: 'jaram' }, { id: '2026-a' }] });
    const result = await createMissingClassGroups();
    expect(result).toEqual({ created: ['seed', 'seum', 'didim'], existing: ['jaram'] });
    expect(set.mock.calls.map(([ref]) => ref)).toEqual([
      'next_generation_word_fruit_groups/seed',
      'next_generation_word_fruit_groups/seum',
      'next_generation_word_fruit_groups/didim',
    ]);
    expect(set.mock.calls[0][1]).toMatchObject({ name: '씨앗반' });
  });

  it('writes nothing when all four exist', async () => {
    getDocs.mockResolvedValue({ docs: ['seed', 'jaram', 'seum', 'didim'].map((id) => ({ id })) });
    expect((await createMissingClassGroups()).created).toEqual([]);
    expect(commit).not.toHaveBeenCalled();
  });
});
