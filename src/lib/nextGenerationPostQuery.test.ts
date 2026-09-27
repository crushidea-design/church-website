import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDocs } = vi.hoisted(() => ({ getDocs: vi.fn() }));
vi.mock('./firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => name,
  where: (field: string, operator: string, value: unknown) => ({ field, operator, value }),
  orderBy: (field: string, direction: string) => ({ field, direction }),
  limit: (count: number) => ({ count }),
  query: (collection: string, ...constraints: unknown[]) => ({ collection, constraints }),
  getDocs,
}));

import { fetchResourcePosts } from './nextGenerationPostQuery';

const posts = [
  { id: 'moved-in', subCategory: 'old', nextGenerationTabSlug: 'current' },
  { id: 'canonical-only', nextGenerationTabSlug: 'current' },
  { id: 'legacy', subCategory: 'current' },
  { id: 'empty-canonical', subCategory: 'current', nextGenerationTabSlug: '' },
  { id: 'moved-out', subCategory: 'current', nextGenerationTabSlug: 'other' },
  { id: 'unclassified' },
];

describe('resource post queries', () => {
  beforeEach(() => {
    getDocs.mockReset();
    // Simulate server-side filters, so an incorrect legacy-only query really
    // loses moved-in/canonical-only posts instead of passing with a canned result.
    getDocs.mockImplementation(async ({ constraints }) => {
      const legacyFilter = constraints.find((item: { field?: string }) => item.field === 'subCategory');
      const matches = legacyFilter ? posts.filter((post) => legacyFilter.value.includes(post.subCategory)) : posts;
      return { docs: matches.map((post) => ({ id: post.id, data: () => post })) };
    });
  });

  it('keeps moved and canonical-only posts and excludes posts moved elsewhere', async () => {
    const result = await fetchResourcePosts(['current', 'current', '']);
    expect(result.map((post) => post.id)).toEqual(['moved-in', 'canonical-only', 'legacy', 'empty-canonical']);
    expect(getDocs).toHaveBeenCalledOnce();
  });

  it('preserves the latest-300 query without requiring a new tab index', async () => {
    await fetchResourcePosts(['current']);
    expect(getDocs).toHaveBeenCalledWith({
      collection: 'posts',
      constraints: [
        { field: 'category', operator: '==', value: 'next_generation' },
        { field: 'createdAt', direction: 'desc' },
        { count: 300 },
      ],
    });
  });

  it('does not read posts for an empty weekly group', async () => {
    expect(await fetchResourcePosts([''])).toEqual([]);
    expect(getDocs).not.toHaveBeenCalled();
  });

  it('supports weekly groups spanning more than 30 tabs without duplicate results', async () => {
    const ids = ['current', 'other', ...Array.from({ length: 31 }, (_, index) => `tab_${index}`)];
    expect((await fetchResourcePosts(ids)).map((post) => post.id)).toEqual(posts.slice(0, 5).map((post) => post.id));
    expect(getDocs).toHaveBeenCalledOnce();
  });

  it('propagates read failures to the screen', async () => {
    getDocs.mockRejectedValue(new Error('offline'));
    await expect(fetchResourcePosts(['current'])).rejects.toThrow('offline');
  });
});
