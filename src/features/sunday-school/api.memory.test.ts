import { beforeEach, describe, expect, it, vi } from 'vitest';

const DELETE = { __delete: true };
const { setDoc } = vi.hoisted(() => ({ setDoc: vi.fn() }));
vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => name,
  doc: (_db: unknown, collectionName: string, id: string) => `${collectionName}/${id}`,
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  query: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  deleteDoc: vi.fn(),
  deleteField: () => DELETE,
  serverTimestamp: () => 'ts',
  writeBatch: vi.fn(),
  updateDoc: vi.fn(),
  setDoc,
}));

import { saveCurriculumEntry } from './api';
import type { CurriculumEntry } from './types';

const base: CurriculumEntry = {
  id: '2027-01-24',
  date: '2027-01-24',
  sundayKey: '2027-01-24',
  termId: '2027-1',
  kind: 'class',
  lordsDay: 2,
  questions: [3, 5],
  title: '율법으로 아는 나의 비참',
};

describe('saveCurriculumEntry memory', () => {
  beforeEach(() => setDoc.mockReset());

  it('deletes emptied memory sub-fields because merge keeps nested keys', async () => {
    await saveCurriculumEntry({ ...base, memory: { question: 3, didim: '전체' } });
    const [, data, options] = setDoc.mock.calls[0];
    expect(options).toEqual({ merge: true });
    expect(data.memory).toEqual({ question: 3, jaram: DELETE, seum: DELETE, didim: '전체' });
  });

  it('deletes the whole memory map when it was cleared', async () => {
    await saveCurriculumEntry(base);
    expect(setDoc.mock.calls[0][1].memory).toBe(DELETE);
  });
});
