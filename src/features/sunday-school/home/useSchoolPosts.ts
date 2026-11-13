import { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../../lib/firebase';
import { fetchResourcePosts } from '../../../lib/nextGenerationPostQuery';
import { NEXT_GENERATION_PATH, getResourceDepartmentPath } from '../../../lib/nextGenerationResources';
import type { NextGenerationPost } from '../../next-generation/sharedConstants';
import { SCHOOL_DEPARTMENT_SLUG } from './libraryTabs';

/** Same query shape as fetchUnpublishedPreparationPosts (site admin only). */
async function fetchUnpublishedPosts(): Promise<NextGenerationPost[]> {
  const snapshot = await getDocs(
    query(
      collection(db, 'posts'),
      where('isPublished', '==', false),
      where('category', '==', 'next_generation'),
      orderBy('createdAt', 'desc'),
      limit(100),
    ),
  );
  return snapshot.docs.map((postDoc) => ({ ...postDoc.data(), id: postDoc.id }) as NextGenerationPost);
}

const isSchoolPost = (post: NextGenerationPost, tabIds: string[]) => {
  if (post.isArchived === true) return false;
  const departmentSlug =
    post.nextGenerationDepartmentSlug ||
    getResourceDepartmentPath(post.subCategory).replace(`${NEXT_GENERATION_PATH}/`, '');
  if (departmentSlug !== SCHOOL_DEPARTMENT_SLUG) return false;
  return tabIds.includes(post.nextGenerationTabSlug || post.subCategory || '');
};

/**
 * Posts for the given tabs (published ones; plus unpublished ones for the site
 * admin only, since the rules would deny that query for everyone else).
 */
export function useSchoolPosts(tabIds: string[], includeUnpublished: boolean, cacheKey: string | undefined) {
  const [posts, setPosts] = useState<NextGenerationPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const idsKey = tabIds.join('|');

  useEffect(() => {
    let cancelled = false;
    const ids = idsKey ? idsKey.split('|') : [];
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const published = await fetchResourcePosts(ids);
        let merged = published;
        if (includeUnpublished) {
          try {
            const unpublished = await fetchUnpublishedPosts();
            const seen = new Set(published.map((post) => post.id));
            merged = [...published, ...unpublished.filter((post) => !seen.has(post.id))];
          } catch (err) {
            console.error('Error fetching unpublished posts:', err);
          }
        }
        if (cancelled) return;
        setPosts(merged.filter((post) => isSchoolPost(post, ids)));
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching next generation posts:', err);
        setError('자료를 불러오는 중 오류가 발생했습니다.');
        try {
          handleFirestoreError(err, OperationType.GET, 'posts');
        } catch {
          // handleFirestoreError rethrows; the message above is enough for the UI.
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [idsKey, includeUnpublished, cacheKey]);

  return { posts, loading, error };
}
