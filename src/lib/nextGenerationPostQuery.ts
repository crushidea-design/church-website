import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from './firebase';
import type { NextGenerationPost } from '../features/next-generation/sharedConstants';

export async function fetchResourcePosts(resourceIds: string[]): Promise<NextGenerationPost[]> {
  const ids = new Set(resourceIds.filter(Boolean));
  if (ids.size === 0) return [];

  // Preserve the existing latest-300 window and deployed category/date index.
  // Filtering only subCategory on the server would omit posts whose canonical
  // nextGenerationTabSlug differs from their legacy category (or lacks one).
  const snapshot = await getDocs(query(
    collection(db, 'posts'),
    where('category', '==', 'next_generation'),
    orderBy('createdAt', 'desc'),
    limit(300),
  ));
  return snapshot.docs
    .map((postDoc) => ({ ...postDoc.data(), id: postDoc.id } as NextGenerationPost))
    .filter((post) => ids.has(post.nextGenerationTabSlug || post.subCategory || ''));
}
