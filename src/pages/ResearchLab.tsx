import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, limit, startAfter } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { BookOpen, Plus, ArrowUpDown, ChevronDown, RefreshCw } from 'lucide-react';
import { useStore } from '../store/useStore';

interface ResearchCategory {
  id: string;
  name: string;
  order: number;
}

export default function ResearchLab() {
  const { user, role, loading: authLoading } = useAuth();
  
  const { research, researchCategories, setCategoryCollection, appendCategoryCollection, setCategories, resetCategory } = useStore();
  
  const [activeTab, setActiveTab] = useState('all');
  const currentResearch = research[activeTab] || { data: [], lastDoc: null, hasMore: true, fetched: false };
  
  const [loading, setLoading] = useState(!currentResearch.fetched);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'title'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch Categories if not fetched
        let cats = researchCategories;
        if (cats.length === 0) {
          const catQ = query(collection(db, 'research_categories'), orderBy('order', 'asc'));
          const catSnap = await getDocs(catQ);
          cats = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ResearchCategory[];
          setCategories('researchCategories', cats);
        }

        // Fetch Research Posts for current tab if not fetched
        const tabResearch = research[activeTab];
        // Force refetch if it looks like it was fetched with the old limit of 20
        const needsUpgrade = tabResearch && tabResearch.fetched && tabResearch.data.length === 20 && tabResearch.hasMore;
        
        if (!tabResearch || !tabResearch.fetched || needsUpgrade) {
          setLoading(true);
          setError(null);
          
          let q;

          if (activeTab === 'all') {
            q = query(
              collection(db, 'posts'),
              where('category', '==', 'research'),
              orderBy('createdAt', 'desc'),
              limit(1000)
            );
          } else {
            q = query(
              collection(db, 'posts'),
              where('category', '==', 'research'),
              where('researchCategoryId', '==', activeTab),
              orderBy('createdAt', 'desc'),
              limit(1000)
            );
          }

          const snapshot = await getDocs(q);
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
          const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
          const hasMore = snapshot.docs.length === 1000;
          
          setCategoryCollection('research', activeTab, data, lastDoc, hasMore);
        }
      } catch (error: any) {
        console.error('Error fetching data:', error);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
        try {
          handleFirestoreError(error, OperationType.GET, 'posts');
        } catch (e) {}
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [activeTab, researchCategories.length, research[activeTab]?.fetched]);

  const handleLoadMore = async () => {
    if (!currentResearch.lastDoc || !currentResearch.hasMore || loadingMore) return;
    
    setLoadingMore(true);
    setError(null);

    try {
      let q;

      if (activeTab === 'all') {
        q = query(
          collection(db, 'posts'),
          where('category', '==', 'research'),
          orderBy('createdAt', 'desc'),
          startAfter(currentResearch.lastDoc),
          limit(1000)
        );
      } else {
        q = query(
          collection(db, 'posts'),
          where('category', '==', 'research'),
          where('researchCategoryId', '==', activeTab),
          orderBy('createdAt', 'desc'),
          startAfter(currentResearch.lastDoc),
          limit(1000)
        );
      }

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
      const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
      const hasMore = snapshot.docs.length === 1000;
      
      appendCategoryCollection('research', activeTab, data, lastDoc, hasMore);
    } catch (error: any) {
      console.error('Error loading more research:', error);
      setError('데이터를 더 불러오는 중 오류가 발생했습니다.');
      try {
        handleFirestoreError(error, OperationType.GET, 'posts');
      } catch (e) {}
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRefresh = async () => {
    if (!activeTab) return;
    setLoading(true);
    setError(null);
    try {
      let q;
      if (activeTab === 'all') {
        q = query(
          collection(db, 'posts'),
          where('category', '==', 'research'),
          orderBy('createdAt', 'desc'),
          limit(1000)
        );
      } else {
        q = query(
          collection(db, 'posts'),
          where('category', '==', 'research'),
          where('researchCategoryId', '==', activeTab),
          orderBy('createdAt', 'desc'),
          limit(1000)
        );
      }

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
      const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
      const hasMore = snapshot.docs.length === 1000;
      
      setCategoryCollection('research', activeTab, data, lastDoc, hasMore);
    } catch (error: any) {
      console.error('Error refreshing data:', error);
      setError('데이터를 새로고침하는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const sortedPosts = React.useMemo(() => {
    const getSortKey = (s: string) => {
      const re = /(\d+)|(\D+)/g;
      return Array.from(s.matchAll(re)).map(m => {
        const n = parseInt(m[1], 10);
        return isNaN(n) ? (m[2] || '').toLowerCase() : n;
      });
    };

    const itemsWithKeys = currentResearch.data.map(item => ({
      item,
      key: sortBy === 'title' ? getSortKey(item.title || '') : null
    }));

    itemsWithKeys.sort((a, b) => {
      if (sortBy === 'title') {
        const ak = a.key!;
        const bk = b.key!;
        const len = Math.min(ak.length, bk.length);
        for (let i = 0; i < len; i++) {
          const av = ak[i];
          const bv = bk[i];
          if (typeof av === 'number' && typeof bv === 'number') {
            if (av !== bv) return av - bv;
          } else if (av !== bv) {
            return String(av).localeCompare(String(bv), 'ko-KR', { sensitivity: 'base' });
          }
        }
        return ak.length - bk.length;
      } else {
        const dateA = a.item.createdAt?.toDate?.()?.getTime() || 0;
        const dateB = b.item.createdAt?.toDate?.()?.getTime() || 0;
        return dateA - dateB;
      }
    });

    const result = itemsWithKeys.map(x => x.item);
    return sortOrder === 'desc' ? result.reverse() : result;
  }, [currentResearch.data, sortBy, sortOrder]);

  const canWrite = !authLoading && (role === 'admin' || user?.email === 'crushidea@gmail.com');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-wood-200 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-wood-900 mb-2">연구실</h1>
          <p className="text-wood-600 text-lg">목사님의 연구 내용과 묵상을 나눕니다.</p>
        </div>
        {canWrite && (
          <Link
            to="/create-post?type=research"
            className="inline-flex items-center px-6 py-3 bg-wood-900 text-white rounded-xl hover:bg-wood-800 transition shadow-md font-medium"
          >
            <Plus size={20} className="mr-2" />
            연구글 작성
          </Link>
        )}
      </div>

      {/* Filters and Sorting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-wood-900 text-white shadow-md transform scale-105'
                : 'bg-white text-wood-600 hover:bg-wood-50 border border-wood-200'
            }`}
          >
            전체
          </button>
          {researchCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === cat.id
                  ? 'bg-wood-900 text-white shadow-md transform scale-105'
                  : 'bg-white text-wood-600 hover:bg-wood-50 border border-wood-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-wood-200 shadow-sm self-end md:self-auto">
          <div className="flex items-center gap-2 px-3 border-r border-wood-100">
            <ArrowUpDown size={16} className="text-wood-400" />
            <select
              value={sortBy}
              onChange={(e) => {
                const newSortBy = e.target.value as 'date' | 'title';
                setSortBy(newSortBy);
                if (newSortBy === 'title') {
                  setSortOrder('asc');
                } else {
                  setSortOrder('desc');
                }
              }}
              className="text-sm bg-transparent border-none focus:ring-0 text-wood-700 font-bold cursor-pointer py-1"
            >
              <option value="date">날짜순</option>
              <option value="title">제목순</option>
            </select>
          </div>
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="px-4 py-1.5 text-sm font-bold text-wood-700 hover:bg-wood-50 rounded-xl transition flex items-center gap-1"
          >
            {sortOrder === 'desc' ? '내림차순' : '오름차순'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-center font-medium">
          {error}
        </div>
      )}

      {/* Posts Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wood-900 mb-4"></div>
          <p className="text-wood-500 font-medium">연구글을 불러오는 중입니다...</p>
        </div>
      ) : sortedPosts.length === 0 ? (
        <div className="text-center py-32 bg-white rounded-3xl border border-wood-200 shadow-sm">
          <BookOpen className="mx-auto h-16 w-16 text-wood-200 mb-6" />
          <h3 className="text-xl font-bold text-wood-900">등록된 연구글이 없습니다</h3>
          <p className="mt-2 text-wood-500">곧 새로운 연구 내용이 업데이트될 예정입니다.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sortedPosts.map((post, index) => (
              <motion.div
                key={post.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  delay: Math.min(index * 0.03, 0.4),
                  ease: "easeOut"
                }}
              >
                <Link to={`/post/${post.id}`} className="block h-full group">
                  <div className="bg-white rounded-3xl shadow-sm border border-wood-100 p-8 h-full hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-wood-900 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                    
                    <div className="flex items-center justify-between mb-6">
                      <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-wood-50 text-wood-800 border border-wood-100">
                        {researchCategories.find(c => c.id === post.researchCategoryId)?.name || '연구글'}
                      </span>
                      <span className="text-xs font-medium text-wood-400">
                        {formatDate(post.createdAt)}
                      </span>
                    </div>
                    
                    <h3 className="text-xl font-bold text-wood-900 mb-4 line-clamp-2 leading-tight group-hover:text-wood-700 transition-colors">
                      {post.title}
                    </h3>
                    
                    <p className="text-wood-600 line-clamp-3 mb-8 flex-grow text-sm leading-relaxed">
                      {post.content.replace(/<[^>]*>?/gm, '')}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs font-bold text-wood-500 pt-5 border-t border-wood-50">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-wood-100 flex items-center justify-center text-[10px] text-wood-600">
                          {post.authorName?.[0] || 'M'}
                        </div>
                        <span>{post.authorName}</span>
                      </div>
                      <span className="bg-wood-50 px-2 py-1 rounded-md">
                        댓글 {post.commentCount || 0}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {currentResearch.hasMore && (
            <div className="mt-16 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-10 py-4 bg-white border-2 border-wood-900 text-wood-900 rounded-2xl font-bold hover:bg-wood-900 hover:text-white transition-all duration-300 shadow-lg disabled:opacity-50 group"
              >
                {loadingMore ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                    불러오는 중...
                  </>
                ) : (
                  <>
                    더 보기
                    <ChevronDown size={20} className="group-hover:translate-y-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Manual Refresh Button (Admin Only) */}
          {canWrite && (
            <div className="flex justify-end pt-8">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 text-sm text-wood-500 hover:text-wood-900 transition-colors disabled:opacity-50"
                title="데이터 새로고침"
              >
                <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                새로고침
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
