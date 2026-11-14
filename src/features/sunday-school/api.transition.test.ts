import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateDoc, setDoc } = vi.hoisted(() => ({ updateDoc: vi.fn(), setDoc: vi.fn() }));
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
  deleteField: vi.fn(),
  serverTimestamp: vi.fn(),
  writeBatch: vi.fn(),
  updateDoc,
  setDoc,
}));

import { publishPreparationPosts, setSundaySchool2027Flag } from './api';

describe('transition writes', () => {
  beforeEach(() => {
    updateDoc.mockReset();
    setDoc.mockReset();
  });

  it('publishes each post by writing only isPublished', async () => {
    updateDoc.mockResolvedValue(undefined);
    const result = await publishPreparationPosts(['a', 'b']);
    expect(result).toEqual({ published: 2, failed: [] });
    expect(updateDoc).toHaveBeenCalledWith('posts/a', { isPublished: true });
    expect(updateDoc).toHaveBeenCalledWith('posts/b', { isPublished: true });
  });

  it('reports failures without stopping the rest', async () => {
    updateDoc.mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await publishPreparationPosts(['a', 'b']);
    expect(result).toEqual({ published: 1, failed: ['a'] });
  });

  it('writes the flag with merge so other settings stay', async () => {
    setDoc.mockResolvedValue(undefined);
    await setSundaySchool2027Flag(true);
    expect(setDoc).toHaveBeenCalledWith(
      'settings/next_generation_flags',
      { sunday_school_2027: true },
      { merge: true },
    );
  });
});
