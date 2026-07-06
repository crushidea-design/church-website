import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  collection, query, where, orderBy, getDocs, limit, 
  startAfter
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { BookOpen, Plus, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import ArchiveIntroSection from '../components/ArchiveIntroSection';

interface ResearchCategory {
  id: string;
  name: string;
  order: number;
}

export default function ResearchLab() {
  const { role, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const { research, researchCategories, setCategoryCollection, setCategories } = useStore();
  
  const [activeTab, setActiveTab] = useState(tabParam || 'all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLastDocs, setPageLastDocs] = useState<{[key: number]: any}>({});
  const pageSize = 10;
  
  const currentResearch = research[activeTab] || { data: [], lastDoc: null, hasMore: true, fetched: false };
  
  const [loading, setLoading] = useState(!currentResearch.fetched);
  const [error, setError] = useState<string | null>(null);
  const [sortOrderDirection, setSortOrderDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const catQ = query(collection(db, 'research_categories'), orderBy('order', 'asc'));
        const catSnap = await getDocs(catQ);
        const cats = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ResearchCategory[];
        setCategories('researchCategories', cats);

        const requestedTab = tabParam || activeTab || 'all';
        const effectiveTab = requestedTab === 'all' || cats.some(cat => cat.id === requestedTab)
          ? requestedTab
          : 'all';

        if (effectiveTab !== activeTab) {
          setActiveTab(effectiveTab);
        }
        if (tabParam && tabParam !== effectiveTab) {
          setSearchParams(effectiveTab === 'all' ? {} : { tab: effectiveTab }, { replace: true });
        }

        setLoading(true);
        setError(null);
        setCurrentPage(1);
        setPageLastDocs({});

        let q;
        const orderField = 'title';
        const orderDir = sortOrderDirection;

        if (effectiveTab === 'all') {
          q = query(collection(db, 'posts'), where('category', '==', 'research'), orderBy(orderField, orderDir), limit(pageSize + 1));
        } else {
          q = query(collection(db, 'posts'), where('category', '==', 'research'), where('researchCategoryId', '==', effectiveTab), orderBy(orderField, orderDir), limit(pageSize + 1));
        }

        const snapshot = await getDocs(q);
        const pageDocs = snapshot.docs.slice(0, pageSize);
        const data = pageDocs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
        const lastDoc = pageDocs[pageDocs.length - 1] || null;
        setCategoryCollection('research', effectiveTab, data, lastDoc, snapshot.docs.length > pageSize);
        if (lastDoc) setPageLastDocs({ 1: lastDoc });
      } catch (error: any) {
        console.error('Error fetching data:', error);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [activeTab, tabParam, sortOrderDirection]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams(tab === 'all' ? {} : { tab });
  };

  const handlePageChange = async (page: number) => {
    if (page === currentPage || page < 1 || loading) return;
    if (page > 1 && !pageLastDocs[page - 1]) return;
    setLoading(true);
    try {
      let q;
      const orderField = 'title';
      const orderDir = sortOrderDirection;
      const anchorDoc = pageLastDocs[page - 1];

      if (page > 1 && anchorDoc) {
        q = query(collection(db, 'posts'), where('category', '==', 'research'), 
            ...(activeTab !== 'all' ? [where('researchCategoryId', '==', activeTab)] : []),
            orderBy(orderField, orderDir), startAfter(anchorDoc), limit(pageSize + 1));
      } else {
        q = query(collection(db, 'posts'), where('category', '==', 'research'),
            ...(activeTab !== 'all' ? [where('researchCategoryId', '==', activeTab)] : []),
            orderBy(orderField, orderDir), limit(pageSize + 1));
      }

      const snapshot = await getDocs(q);
      const docs = snapshot.docs.slice(0, pageSize);

      const data = docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
      const lastDoc = docs[docs.length - 1] || null;
      setCategoryCollection('research', activeTab, data, lastDoc, snapshot.docs.length > pageSize);
      setCurrentPage(page);
      if (lastDoc) setPageLastDocs(prev => ({ ...prev, [page]: lastDoc }));
    } catch (err) {
      setError('페이지 이동 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const sortedPosts = React.useMemo(() => currentResearch.data, [currentResearch.data]);
  const canWrite = !authLoading && role === 'admin';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
      <div className="space-y-8">
        <ArchiveIntroSection
          description="목사님의 연구 내용과 묵상을 나눕니다."
          action={canWrite ? (
            <Link
              to={`/create-post?type=research${activeTab && activeTab !== 'all' ? `&categoryId=${activeTab}` : ''}`}
              className="inline-flex items-center px-6 py-3 bg-wood-900 text-white rounded-sm hover:bg-wood-800 transition font-medium"
            >
              <Plus size={20} className="mr-2" />
              연구글 작성
            </Link>
          ) : null}
        />

        {/* 필터 및 정렬 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <button
            onClick={() => handleTabChange('all')}
            className={`px-5 py-2.5 rounded-sm text-sm font-medium transition whitespace-nowrap border ${
              activeTab === 'all'
                ? 'bg-wood-900 border-wood-900 text-white'
                : 'bg-white text-wood-600 hover:bg-wood-50 border-wood-200'
            }`}
          >
            전체
          </button>
          {researchCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleTabChange(cat.id)}
              className={`px-5 py-2.5 rounded-sm text-sm font-medium transition whitespace-nowrap border ${
                activeTab === cat.id
                  ? 'bg-wood-900 border-wood-900 text-white'
                  : 'bg-white text-wood-600 hover:bg-wood-50 border-wood-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-md border border-wood-200 shadow-sm self-end md:self-auto">
          <button
            onClick={() => setSortOrderDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="px-4 py-1.5 text-sm font-bold text-wood-700 hover:bg-wood-50 rounded-md transition flex items-center gap-1"
          >
            <ArrowUpDown size={16} className="text-wood-400" />
            {sortOrderDirection === 'desc' ? '내림차순' : '오름차순'}
          </button>
        </div>
      </div>

      {error && <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md text-center font-medium">{error}</div>}

      {/* 게시글 그리드 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wood-900 mb-4"></div>
          <p className="text-wood-500 font-medium">연구글을 불러오는 중입니다...</p>
        </div>
      ) : sortedPosts.length === 0 ? (
        <div className="text-center py-32 bg-white rounded-md border border-wood-200 shadow-sm">
          <BookOpen className="mx-auto h-16 w-16 text-wood-200 mb-6" />
          <h3 className="text-xl font-bold text-wood-900">등록된 연구글이 없습니다</h3>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sortedPosts.map((post) => (
              <div key={post.id}>
                <Link to={`/post/${post.id}`} className="block h-full group">
                  <div className="bg-white border border-wood-200 p-8 h-full hover:border-gold-500 transition-colors flex flex-col">
                    <div className="flex items-baseline justify-between mb-6">
                      <span className="text-xs font-semibold tracking-wider text-gold-700">
                        {researchCategories.find(c => c.id === post.researchCategoryId)?.name || '연구글'}
                      </span>
                      <span className="text-xs font-medium text-wood-400">{formatDate(post.createdAt)}</span>
                    </div>
                    <h3 className="text-xl font-serif font-bold text-wood-950 mb-4 line-clamp-2 leading-snug group-hover:underline decoration-gold-500 underline-offset-4">{post.title}</h3>
                    <p className="text-wood-600 line-clamp-3 mb-8 flex-grow text-sm leading-relaxed">{post.content.replace(/<[^>]*>?/gm, '')}</p>
                    <div className="flex items-center justify-between text-xs font-medium text-wood-500 pt-5 border-t border-wood-200">
                      <span>{post.authorName}</span>
                      <span>댓글 {post.commentCount || 0}</span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>

          {/* 페이지네이션 */}
          {(currentPage > 1 || currentResearch.hasMore) && (
            <div className="flex justify-center items-center gap-2 mt-16">
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || loading} className="p-3 rounded-sm border border-wood-200 text-wood-600 hover:bg-wood-50 disabled:opacity-30 transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div className="px-5 py-3 rounded-sm bg-white border border-wood-200 text-sm font-semibold text-wood-700">
                {currentPage}
              </div>
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={!currentResearch.hasMore || loading} className="p-3 rounded-sm border border-wood-200 text-wood-600 hover:bg-wood-50 disabled:opacity-30 transition-colors">
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
