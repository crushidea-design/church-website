import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link, useSearchParams } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { formatDate, getYouTubeId } from '../lib/utils';
import { generateSortOrder } from '../lib/sortUtils';
import { PlayCircle, Plus, Video, ArrowUpDown, ChevronDown, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../store/useStore';

const ALL_SERMONS_TAB = 'all';

interface SermonCategory {
  id: string;
  name: string;
  order: number;
}

interface SermonPost {
  id: string;
  title?: string;
  createdAt?: any;
  sortOrder?: number;
  sermonCategoryId?: string;
  subCategory?: string;
  [key: string]: any;
}

const getTime = (value: any) => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
};

const getSortOrder = (post: SermonPost) => {
  return typeof post.sortOrder === 'number' ? post.sortOrder : generateSortOrder(post.title || '');
};

const isLegacySermon = (post: SermonPost) => {
  return post.subCategory === 'past_sermons' || post.subCategory === 'pilgrims_progress';
};

const isUncategorizedSermon = (post: SermonPost, categories: SermonCategory[]) => {
  const hasValidCategory = categories.some(category => category.id === post.sermonCategoryId);
  return !hasValidCategory && !isLegacySermon(post);
};

const filterSermonsByTab = (posts: SermonPost[], tab: string, categories: SermonCategory[]) => {
  if (tab === ALL_SERMONS_TAB) return posts;
  if (tab === 'uncategorized') return posts.filter(post => isUncategorizedSermon(post, categories));
  if (tab === 'past_sermons' || tab === 'pilgrims_progress') return posts.filter(post => post.subCategory === tab);
  return posts.filter(post => post.sermonCategoryId === tab);
};

const sortSermons = (posts: SermonPost[], direction: 'asc' | 'desc') => {
  return [...posts].sort((a, b) => {
    const sortDelta = getSortOrder(a) - getSortOrder(b);
    if (sortDelta !== 0) {
      return direction === 'asc' ? sortDelta : -sortDelta;
    }

    return getTime(b.createdAt) - getTime(a.createdAt);
  });
};

export default function Sermons() {
  const { user, role, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const { sermons, sermonCategories, setCategoryCollection, appendCategoryCollection, setCategories, resetCategory } = useStore();
  
  const [activeTab, setActiveTab] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;
  
  const currentSermons = sermons[activeTab] || { data: [], lastDoc: null, hasMore: true, fetched: false };
  
  const [loading, setLoading] = useState(!currentSermons.fetched);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortOrderDirection, setSortOrderDirection] = useState<'asc' | 'desc'>('asc');

  const canWrite = !authLoading && role === 'admin';
  const isRegularMember = role === 'regular' || role === 'admin';

  const fetchSermonsPage = async (tab: string, page: number, categories: SermonCategory[]) => {
    const sermonsQuery = query(collection(db, 'posts'), where('category', '==', 'sermon'));
    const snapshot = await getDocs(sermonsQuery);
    const allSermons = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) })) as SermonPost[];
    const filtered = filterSermonsByTab(allSermons, tab, categories);
    const sorted = sortSermons(filtered, sortOrderDirection);
    const startIndex = (page - 1) * pageSize;
    const data = sorted.slice(startIndex, startIndex + pageSize);

    setTotalCount(sorted.length);
    setCategoryCollection('sermons', tab, data, null, startIndex + pageSize < sorted.length);
  };

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
        let tab = activeTab || ALL_SERMONS_TAB;
        const tabParam = searchParams.get('tab');
        if (tabParam && (tabParam === ALL_SERMONS_TAB || cats.some(c => c.id === tabParam) || tabParam === 'past_sermons' || tabParam === 'pilgrims_progress' || tabParam === 'uncategorized')) {
          tab = tabParam;
          if (activeTab !== tabParam) {
            setActiveTab(tabParam);
          }
        } else if (!activeTab) {
          tab = ALL_SERMONS_TAB;
          setActiveTab(tab);
        }

        // Reset pagination when tab changes
        setCurrentPage(1);

        // Fetch Sermons for current tab (Page 1)
        setLoading(true);
        setError(null);
        await fetchSermonsPage(tab, 1, cats);
      } catch (error: any) {
        console.error('Error fetching data:', error);
        let errorMessage = '데이터를 불러오는 중 오류가 발생했습니다.';
        if (error.message && error.message.includes('index')) {
          errorMessage = '데이터 정렬을 위한 인덱스가 필요합니다. 브라우저 콘솔(F12)에 표시된 링크를 클릭하여 인덱스를 생성해주세요.';
          console.error('Firestore Index Error:', error.message);
        }
        setError(errorMessage);
        try {
          handleFirestoreError(error, OperationType.GET, 'posts');
        } catch (e) {}
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [authLoading, isRegularMember, activeTab, sermonCategories.length, sortOrderDirection]);

  const handlePageChange = async (page: number) => {
    if (page === currentPage || page < 1 || page > Math.ceil(totalCount / pageSize) || loading) return;
    
    setLoading(true);
    setError(null);

    try {
      await fetchSermonsPage(activeTab || ALL_SERMONS_TAB, page, sermonCategories);
      setCurrentPage(page);
    } catch (error: any) {
      console.error('Error changing page:', error);
      let errorMessage = '페이지를 이동하는 중 오류가 발생했습니다.';
      if (error.message && error.message.includes('index')) {
        errorMessage = '데이터 정렬을 위한 인덱스가 필요합니다. 관리자에게 문의하거나 잠시 후 다시 시도해주세요.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    // This is now replaced by handlePageChange
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchSermonsPage(activeTab || ALL_SERMONS_TAB, 1, sermonCategories);
      setCurrentPage(1);
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
    // The query already filters and sorts the data from Firestore.
    if (activeTab === 'uncategorized') {
      return currentSermons.data.filter(video => {
        const hasValidCategory = sermonCategories.some(c => c.id === video.sermonCategoryId);
        const isLegacy = video.subCategory === 'past_sermons' || video.subCategory === 'pilgrims_progress';
        return !hasValidCategory && !isLegacy;
      });
    }

    return currentSermons.data;
  }, [currentSermons.data, activeTab, sermonCategories]);

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
            to={`/create-post?type=sermon${activeTab && activeTab !== ALL_SERMONS_TAB ? `&categoryId=${activeTab}` : ''}`}
            className="inline-flex items-center px-4 py-2 bg-wood-900 text-white rounded-md hover:bg-wood-800 transition shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            영상 등록
          </Link>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex space-x-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <button
            onClick={() => {
              setActiveTab(ALL_SERMONS_TAB);
              setSearchParams({ tab: ALL_SERMONS_TAB });
            }}
            className={`px-6 py-2.5 rounded-full text-sm font-medium transition whitespace-nowrap ${
              activeTab === ALL_SERMONS_TAB
                ? 'bg-wood-900 text-white shadow-sm'
                : 'bg-white text-wood-600 hover:bg-wood-50 border border-wood-200'
            }`}
          >
            전체
          </button>
          {sermonCategories.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchParams({ tab: tab.id });
              }}
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
              onClick={() => {
                setActiveTab('uncategorized');
                setSearchParams({ tab: 'uncategorized' });
              }}
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
              onClick={() => {
                setActiveTab('past_sermons');
                setSearchParams({ tab: 'past_sermons' });
              }}
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
              onClick={() => {
                setActiveTab('pilgrims_progress');
                setSearchParams({ tab: 'pilgrims_progress' });
              }}
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
          <button
            onClick={() => setSortOrderDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-1 text-sm font-medium text-wood-600 hover:bg-wood-50 rounded-xl transition flex items-center gap-1"
          >
            <ArrowUpDown size={14} className="text-wood-400" />
            {sortOrderDirection === 'desc' ? '내림차순' : '오름차순'}
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
          {totalCount > 0 && (
            <p className="mt-4 text-amber-600 text-sm font-medium px-4">
              이름순 정렬을 위한 인덱스가 생성되지 않았을 수 있습니다.<br />
              오류가 발생하면 잠시 후 다시 시도해 주세요.
            </p>
          )}
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
                            loading="lazy"
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

          {/* Pagination */}
          {totalCount > pageSize && (
            <div className="flex justify-center items-center gap-2 pt-8">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className="p-2 rounded-lg border border-wood-200 text-wood-600 hover:bg-wood-50 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.ceil(totalCount / pageSize) }).map((_, i) => {
                  const pageNum = i + 1;
                  // Show limited page numbers if there are too many
                  if (
                    pageNum === 1 || 
                    pageNum === Math.ceil(totalCount / pageSize) || 
                    (pageNum >= currentPage - 2 && pageNum <= currentPage + 2)
                  ) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        disabled={loading}
                        className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${
                          currentPage === pageNum
                            ? 'bg-wood-900 text-white shadow-md'
                            : 'text-wood-600 hover:bg-wood-50 border border-transparent'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  } else if (
                    pageNum === currentPage - 3 || 
                    pageNum === currentPage + 3
                  ) {
                    return <span key={pageNum} className="text-wood-300 px-1">...</span>;
                  }
                  return null;
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === Math.ceil(totalCount / pageSize) || loading}
                className="p-2 rounded-lg border border-wood-200 text-wood-600 hover:bg-wood-50 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}

          {/* Admin Tools */}
          {canWrite && (
            <div className="flex justify-end items-center gap-4 pt-8">
              <button
                onClick={async () => {
                  if (!window.confirm('모든 말씀 영상의 정렬 데이터를 재계산하여 업데이트하시겠습니까? (데이터가 많을 경우 시간이 걸릴 수 있습니다)')) return;
                  setLoading(true);
                  try {
                    const q = query(collection(db, 'posts'), where('category', '==', 'sermon'));
                    const snapshot = await getDocs(q);
                    let updatedCount = 0;
                    
                    for (const docSnap of snapshot.docs) {
                      const data = docSnap.data();
                      const newSortOrder = generateSortOrder(data.title || '');
                      if (data.sortOrder !== newSortOrder) {
                        await setDoc(doc(db, 'posts', docSnap.id), { sortOrder: newSortOrder }, { merge: true });
                        updatedCount++;
                      }
                    }
                    alert(`${updatedCount}개의 영상 정렬 데이터가 복구되었습니다.`);
                    handleRefresh();
                  } catch (err) {
                    console.error('Error repairing sort order:', err);
                    alert('정렬 데이터 복구 중 오류가 발생했습니다.');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 text-sm text-amber-600 hover:text-amber-700 transition-colors disabled:opacity-50 border border-amber-200 rounded-lg hover:bg-amber-50"
                title="정렬 데이터 복구"
              >
                <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                정렬 데이터 복구
              </button>

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
