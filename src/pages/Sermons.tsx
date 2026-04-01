import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link, useSearchParams } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, limit, startAfter } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { PlayCircle, Plus, Video, ArrowUpDown, ChevronDown, RefreshCw } from 'lucide-react';
import { useStore } from '../store/useStore';

interface SermonCategory {
  id: string;
  name: string;
  order: number;
}

export default function Sermons() {
  const { user, role, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  
  const { sermons, sermonCategories, setCategoryCollection, appendCategoryCollection, setCategories, resetCategory } = useStore();
  
  const [activeTab, setActiveTab] = useState('');
  const currentSermons = sermons[activeTab] || { data: [], lastDoc: null, hasMore: true, fetched: false };
  
  const [loading, setLoading] = useState(!currentSermons.fetched);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'title'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const canWrite = !authLoading && (role === 'admin' || user?.email === 'crushidea@gmail.com');
  const isRegularMember = role === 'regular' || role === 'admin' || user?.email === 'crushidea@gmail.com';

  useEffect(() => {
    if (authLoading) return;
    if (!isRegularMember) {
      setLoading(false);
      return;
    }

    const fetchInitialData = async () => {
      try {
        // Fetch Categories if not fetched
        let cats = sermonCategories;
        if (cats.length === 0) {
          const catQ = query(collection(db, 'sermon_categories'), orderBy('order', 'asc'));
          const catSnap = await getDocs(catQ);
          cats = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SermonCategory[];
          setCategories('sermonCategories', cats);
        }

        // Set Active Tab
        let tab = activeTab;
        const tabParam = searchParams.get('tab');
        if (tabParam && (cats.some(c => c.id === tabParam) || tabParam === 'past_sermons' || tabParam === 'pilgrims_progress')) {
          tab = tabParam;
          setActiveTab(tabParam);
        } else if (cats.length > 0 && !activeTab) {
          tab = cats[0].id;
          setActiveTab(tab);
        }

        if (!tab) return;

        // Fetch Sermons for current tab if not fetched
        const tabSermons = sermons[tab];
        // Force refetch if it looks like it was fetched with the old limit of 20
        const needsUpgrade = tabSermons && tabSermons.fetched && tabSermons.data.length === 20 && tabSermons.hasMore;

        if (!tabSermons || !tabSermons.fetched || needsUpgrade) {
          setLoading(true);
          setError(null);
          
          let q;
          
          if (tab === 'uncategorized') {
            q = query(
              collection(db, 'posts'),
              where('category', '==', 'sermon'),
              orderBy('createdAt', 'desc'),
              limit(1000)
            );
          } else if (tab === 'past_sermons' || tab === 'pilgrims_progress') {
            q = query(
              collection(db, 'posts'),
              where('category', '==', 'sermon'),
              where('subCategory', '==', tab),
              orderBy('createdAt', 'desc'),
              limit(1000)
            );
          } else {
            q = query(
              collection(db, 'posts'),
              where('category', '==', 'sermon'),
              where('sermonCategoryId', '==', tab),
              orderBy('createdAt', 'desc'),
              limit(1000)
            );
          }

          const snapshot = await getDocs(q);
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
          const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
          const hasMore = snapshot.docs.length === 1000;
          
          setCategoryCollection('sermons', tab, data, lastDoc, hasMore);
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
  }, [authLoading, isRegularMember, activeTab, sermonCategories.length, sermons[activeTab]?.fetched]);

  const handleLoadMore = async () => {
    if (!currentSermons.lastDoc || !currentSermons.hasMore || loadingMore) return;
    
    setLoadingMore(true);
    setError(null);

    try {
      let q;

      if (activeTab === 'uncategorized') {
        q = query(
          collection(db, 'posts'),
          where('category', '==', 'sermon'),
          orderBy('createdAt', 'desc'),
          startAfter(currentSermons.lastDoc),
          limit(1000)
        );
      } else if (activeTab === 'past_sermons' || activeTab === 'pilgrims_progress') {
        q = query(
          collection(db, 'posts'),
          where('category', '==', 'sermon'),
          where('subCategory', '==', activeTab),
          orderBy('createdAt', 'desc'),
          startAfter(currentSermons.lastDoc),
          limit(1000)
        );
      } else {
        q = query(
          collection(db, 'posts'),
          where('category', '==', 'sermon'),
          where('sermonCategoryId', '==', activeTab),
          orderBy('createdAt', 'desc'),
          startAfter(currentSermons.lastDoc),
          limit(1000)
        );
      }

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
      const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
      const hasMore = snapshot.docs.length === 1000;
      
      appendCategoryCollection('sermons', activeTab, data, lastDoc, hasMore);
    } catch (error: any) {
      console.error('Error loading more sermons:', error);
      setError('데이터를 더 불러오는 중 오류가 발생했습니다.');
      try {
        handleFirestoreError(error, OperationType.GET, 'posts');
      } catch (e) {}
    } finally {
      setLoadingMore(false);
    }
  };

  const getYouTubeId = (content: string) => {
    const youtubeRegex = /(?:https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11}))/;
    const match = content.match(youtubeRegex);
    return match ? match[1] : null;
  };

  const handleRefresh = async () => {
    if (!activeTab) return;
    setLoading(true);
    setError(null);
    try {
      let q;
      if (activeTab === 'uncategorized') {
        q = query(
          collection(db, 'posts'),
          where('category', '==', 'sermon'),
          orderBy('createdAt', 'desc'),
          limit(1000)
        );
      } else if (activeTab === 'past_sermons' || activeTab === 'pilgrims_progress') {
        q = query(
          collection(db, 'posts'),
          where('category', '==', 'sermon'),
          where('subCategory', '==', activeTab),
          orderBy('createdAt', 'desc'),
          limit(1000)
        );
      } else {
        q = query(
          collection(db, 'posts'),
          where('category', '==', 'sermon'),
          where('sermonCategoryId', '==', activeTab),
          orderBy('createdAt', 'desc'),
          limit(1000)
        );
      }

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
      const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
      const hasMore = snapshot.docs.length === 1000;
      
      setCategoryCollection('sermons', activeTab, data, lastDoc, hasMore);
    } catch (error: any) {
      console.error('Error refreshing data:', error);
      setError('데이터를 새로고침하는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const hasUncategorized = Object.values(sermons).some(cat => 
    cat?.data?.some(video => {
      const hasValidCategory = sermonCategories.some(c => c.id === video.sermonCategoryId);
      const isLegacy = video.subCategory === 'past_sermons' || video.subCategory === 'pilgrims_progress';
      return !hasValidCategory && !isLegacy;
    })
  );

  const sortedVideos = React.useMemo(() => {
    // 1. Filter
    const filtered = currentSermons.data.filter(video => {
      if (!activeTab) return false;
      
      if (activeTab === 'uncategorized') {
        const hasValidCategory = sermonCategories.some(c => c.id === video.sermonCategoryId);
        const isLegacy = video.subCategory === 'past_sermons' || video.subCategory === 'pilgrims_progress';
        return !hasValidCategory && !isLegacy;
      }

      return video.sermonCategoryId === activeTab || 
             (activeTab === 'past_sermons' && video.subCategory === 'past_sermons') ||
             (activeTab === 'pilgrims_progress' && video.subCategory === 'pilgrims_progress');
    });

    // 2. Pre-calculate sort keys for natural sort
    const getSortKey = (s: string) => {
      const re = /(\d+)|(\D+)/g;
      return Array.from(s.matchAll(re)).map(m => {
        const n = parseInt(m[1], 10);
        return isNaN(n) ? (m[2] || '').toLowerCase() : n;
      });
    };

    const itemsWithKeys = filtered.map(item => ({
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
  }, [currentSermons.data, activeTab, sermonCategories, sortBy, sortOrder]);

  if (!authLoading && !isRegularMember) {
    return (
      <div className="bg-wood-100 min-h-screen py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-sm border border-wood-200 p-12 text-center">
            <Video className="mx-auto h-16 w-16 text-wood-300 mb-6" />
            <h2 className="text-3xl font-serif font-bold text-wood-900 mb-4">정회원 전용 공간입니다</h2>
            <p className="text-wood-600 text-lg mb-8">
              말씀 서재의 영상은 교회 정회원만 시청하실 수 있습니다.<br />
              상단 '문의'를 통해 신청해주세요.
            </p>
            <Link
              to="/"
              className="inline-flex items-center px-6 py-3 bg-wood-900 text-white rounded-full hover:bg-wood-800 transition shadow-sm font-medium"
            >
              홈으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-8 border-b border-wood-200 pb-6">
        <div className="text-left">
          <p className="text-lg text-wood-600">유튜브에 업로드된 설교와 성경 공부 영상을 확인하세요.</p>
        </div>
        {canWrite && (
          <Link
            to={`/create-post?type=sermon${activeTab ? `&categoryId=${activeTab}` : ''}`}
            className="inline-flex items-center px-4 py-2 bg-wood-900 text-white rounded-md hover:bg-wood-800 transition shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            영상 등록
          </Link>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex space-x-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {sermonCategories.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-wood-900 text-white shadow-sm'
                  : 'bg-white text-wood-600 hover:bg-wood-50 border border-wood-200'
              }`}
            >
              {tab.name}
            </button>
          ))}
          {hasUncategorized && (
            <button
              onClick={() => setActiveTab('uncategorized')}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition whitespace-nowrap ${
                activeTab === 'uncategorized'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-white text-amber-600 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              카테고리 미지정
            </button>
          )}
          {/* Fallback for legacy tabs if they don't exist in categories */}
          {!sermonCategories.find(c => c.id === 'past_sermons') && Object.values(sermons).some(cat => cat?.data?.some(v => v.subCategory === 'past_sermons')) && (
            <button
              onClick={() => setActiveTab('past_sermons')}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition whitespace-nowrap ${
                activeTab === 'past_sermons'
                  ? 'bg-wood-900 text-white shadow-sm'
                  : 'bg-white text-wood-600 hover:bg-wood-50 border border-wood-200'
              }`}
            >
              지난 설교들
            </button>
          )}
          {!sermonCategories.find(c => c.id === 'pilgrims_progress') && Object.values(sermons).some(cat => cat?.data?.some(v => v.subCategory === 'pilgrims_progress')) && (
            <button
              onClick={() => setActiveTab('pilgrims_progress')}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition whitespace-nowrap ${
                activeTab === 'pilgrims_progress'
                  ? 'bg-wood-900 text-white shadow-sm'
                  : 'bg-white text-wood-600 hover:bg-wood-50 border border-wood-200'
              }`}
            >
              천로역정
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-wood-200 shadow-sm self-end md:self-auto">
          <div className="flex items-center gap-1 px-2 border-r border-wood-100">
            <ArrowUpDown size={14} className="text-wood-400" />
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
              className="text-sm bg-transparent border-none focus:ring-0 text-wood-700 font-medium cursor-pointer py-1"
            >
              <option value="date">날짜순</option>
              <option value="title">제목순</option>
            </select>
          </div>
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-1 text-sm font-medium text-wood-600 hover:bg-wood-50 rounded-xl transition flex items-center gap-1"
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

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wood-900"></div>
        </div>
      ) : sortedVideos.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-wood-200">
          <Video className="mx-auto h-12 w-12 text-wood-300 mb-4" />
          <h3 className="text-lg font-medium text-wood-900">등록된 영상이 없습니다</h3>
          <p className="mt-2 text-wood-500">곧 새로운 말씀 영상이 업데이트될 예정입니다.</p>
        </div>
      ) : (
        <div className="space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sortedVideos.map((video, index) => {
              const videoId = getYouTubeId(video.content);
              return (
                <motion.div
                  key={video.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ 
                    delay: Math.min(index * 0.03, 0.4),
                    ease: "easeOut"
                  }}
                >
                  <Link to={`/post/${video.id}`} className="block h-full group">
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-wood-100 hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col h-full">
                      <div className="aspect-video bg-wood-900 relative">
                        {videoId ? (
                          <img
                            src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                            alt={video.title}
                            className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity duration-300"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/0.jpg`;
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-wood-500">
                            <Video size={48} />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <PlayCircle className="text-white" size={32} />
                          </div>
                        </div>
                      </div>
                      <div className="p-6 flex-grow">
                        <h3 className="text-lg font-bold text-wood-900 mb-2 line-clamp-2">{video.title}</h3>
                        <p className="text-sm text-wood-500">
                          {formatDate(video.createdAt)}
                        </p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {currentSermons.hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center px-8 py-3 bg-white border border-wood-200 text-wood-700 rounded-full hover:bg-wood-50 transition shadow-sm font-medium disabled:opacity-50"
              >
                {loadingMore ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-wood-900 mr-2"></div>
                ) : (
                  <ChevronDown size={20} className="mr-2" />
                )}
                더 보기
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
        </div>
      )}
    </div>
  );
}
