import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { getMcheyneReadingPlan, ReadingPassage, isLeapDay } from '../lib/mcheyneUtils';
import { useStore } from '../store/useStore';

const toLocalDateKey = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().split('T')[0];
};

const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isSameLocalDate = (value: any, dateKey: string) => {
  const date = toDate(value);
  return date ? toLocalDateKey(date) === dateKey : false;
};

export interface UseTodayWordDataResult {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  dateStr: string;
  readingPlan: ReadingPassage[];
  isSelectedLeapDay: boolean;
  latestPost: any | null;
  loading: boolean;
  readingProgress: boolean[];
  meditation: string;
  setMeditation: (text: string) => void;
  toggleProgress: (index: number) => Promise<void>;
  saveProgress: () => Promise<void>;
  savingProgress: boolean;
  saveMessage: string;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

export function useTodayWordData(): UseTodayWordDataResult {
  const { user, role } = useAuth();
  const [selectedDate, setSelectedDateRaw] = useState<Date>(new Date());
  const [latestPost, setLatestPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [readingProgress, setReadingProgress] = useState<boolean[]>([]);
  const [meditation, setMeditation] = useState('');
  const [savingProgress, setSavingProgress] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const isSelectedLeapDay = isLeapDay(selectedDate);
  const readingPlan = useMemo(() => getMcheyneReadingPlan(selectedDate), [dateStr]);

  const progressCacheKey = user ? `${user.uid}_${dateStr}` : '';
  const cachedProgress = useStore((state) =>
    progressCacheKey ? state.todayWordProgress[progressCacheKey] : undefined,
  );
  const setTodayWordProgress = useStore((state) => state.setTodayWordProgress);

  const setSelectedDate = (date: Date) => {
    setSelectedDateRaw(date);
    setReadingProgress([]);
    setMeditation('');
  };

  // Fetch post + user progress whenever date or auth changes
  useEffect(() => {
    let ignore = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        let postDocs: any[] = [];

        try {
          const byDateKeyQuery = query(
            collection(db, 'posts'),
            where('dateKey', '==', dateStr),
            limit(10),
          );
          const byDateKeySnap = await getDocs(byDateKeyQuery);
          postDocs = byDateKeySnap.docs;
        } catch (err) {
          console.warn('TodayWord dateKey query failed, falling back:', err);
        }

        if (postDocs.length === 0) {
          try {
            const start = new Date(selectedDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(selectedDate);
            end.setHours(23, 59, 59, 999);
            const byCreatedAtQuery = query(
              collection(db, 'posts'),
              where('category', '==', 'today_word'),
              where('createdAt', '>=', start),
              where('createdAt', '<=', end),
              limit(10),
            );
            const byCreatedAtSnap = await getDocs(byCreatedAtQuery);
            postDocs = byCreatedAtSnap.docs;
          } catch (err) {
            console.warn('TodayWord createdAt query failed, using fallback:', err);
            const fallbackQuery = query(
              collection(db, 'posts'),
              where('category', '==', 'today_word'),
              limit(500),
            );
            const fallbackSnap = await getDocs(fallbackQuery);
            postDocs = fallbackSnap.docs.filter((d) => isSameLocalDate((d.data() as any).createdAt, dateStr));
          }
        }

        let validPosts = postDocs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((post) => post.category === 'today_word');

        if (role !== 'admin') {
          validPosts = validPosts.filter((p) => p.isPublished !== false);
        }

        validPosts.sort((a, b) => {
          const dateA = toDate(a.updatedAt)?.getTime() || toDate(a.createdAt)?.getTime() || 0;
          const dateB = toDate(b.updatedAt)?.getTime() || toDate(b.createdAt)?.getTime() || 0;
          return dateB - dateA;
        });

        if (validPosts.length > 0) {
          const postData = validPosts[0];

          if (postData.isLongContent) {
            try {
              const chunksQuery = query(
                collection(db, 'post_contents'),
                where('postId', '==', postData.id),
                orderBy('index', 'asc'),
              );
              const chunksSnap = await getDocs(chunksQuery);
              if (!chunksSnap.empty) {
                postData.content = chunksSnap.docs.map((d) => d.data().content).join('');
              }
            } catch (err) {
              console.error('Error reassembling long content in TodayWord hook:', err);
            }
          }

          if (!ignore) setLatestPost(postData);
        } else if (!ignore) {
          setLatestPost(null);
        }

        // User progress
        if (user) {
          const cacheKey = `${user.uid}_${dateStr}`;
          if (cachedProgress) {
            if (!ignore) {
              setReadingProgress(cachedProgress.progress || new Array(readingPlan.length).fill(false));
              setMeditation(cachedProgress.meditation || '');
            }
          } else {
            const progressRef = doc(db, 'users', user.uid, 'readings', dateStr);
            const progressSnap = await getDoc(progressRef);
            if (progressSnap.exists()) {
              const data = progressSnap.data();
              if (!ignore) {
                setReadingProgress(data.progress || new Array(readingPlan.length).fill(false));
                setMeditation(data.meditation || '');
              }
              setTodayWordProgress(cacheKey, data);
            } else {
              if (!ignore) {
                setReadingProgress(new Array(readingPlan.length).fill(false));
                setMeditation('');
              }
              setTodayWordProgress(cacheKey, {
                progress: new Array(readingPlan.length).fill(false),
                meditation: '',
              });
            }
          }
        } else if (!ignore) {
          setReadingProgress(new Array(readingPlan.length).fill(false));
          setMeditation('');
        }
      } catch (err) {
        console.error('Error fetching TodayWord data:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchData();
    return () => {
      ignore = true;
    };
  }, [selectedDate, user, role, dateStr, readingPlan.length, cachedProgress, setTodayWordProgress]);

  const persist = async (progress: boolean[], med: string) => {
    if (!user) return;
    setSavingProgress(true);
    setSaveMessage('');
    try {
      const progressRef = doc(db, 'users', user.uid, 'readings', dateStr);
      await setDoc(
        progressRef,
        {
          date: dateStr,
          progress,
          meditation: med,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      const cacheKey = `${user.uid}_${dateStr}`;
      setTodayWordProgress(cacheKey, { progress, meditation: med });
      setSaveMessage('저장되었습니다.');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch (err) {
      console.error('Error saving today word progress:', err);
      setSaveMessage('저장 실패');
    } finally {
      setSavingProgress(false);
    }
  };

  const toggleProgress = async (index: number) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    const next = [...readingProgress];
    next[index] = !next[index];
    setReadingProgress(next);
    await persist(next, meditation);
  };

  const saveProgress = async () => {
    if (!user) return;
    await persist(readingProgress, meditation);
  };

  return {
    selectedDate,
    setSelectedDate,
    dateStr,
    readingPlan,
    isSelectedLeapDay,
    latestPost,
    loading,
    readingProgress,
    meditation,
    setMeditation,
    toggleProgress,
    saveProgress,
    savingProgress,
    saveMessage,
    isAuthenticated: !!user,
    isAdmin: role === 'admin',
  };
}
