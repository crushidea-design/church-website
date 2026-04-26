import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { MessageSquare, Plus, ChevronDown } from 'lucide-react';
import { useStore } from '../store/useStore';
import SiteCmsSections from '../components/SiteCmsSections';

export default function Community() {
  const { user } = useAuth();
  const { community, setCollection, appendCollection } = useStore();
  
  const [loading, setLoading] = useState(!community.fetched);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (community.fetched) {
        setLoading(false);
        return;
      }

      try {
        setError(null);

        const q = query(
          collection(db, 'posts'),
          where('category', '==', 'community'),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
        const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
        const hasMore = snapshot.docs.length === 20;

        setCollection('community', data, lastDoc, hasMore);
      } catch (error: any) {
        console.error('Error fetching community posts:', error);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
        try {
          handleFirestoreError(error, OperationType.GET, 'posts');
        } catch (e) {}
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [community.fetched]);

  const handleLoadMore = async () => {
    if (!community.lastDoc || !community.hasMore || loadingMore) return;

    setLoadingMore(true);
    setError(null);

    try {
      const q = query(
        collection(db, 'posts'),
        where('category', '==', 'community'),
        orderBy('createdAt', 'desc'),
        startAfter(community.lastDoc),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
      const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
      const hasMore = snapshot.docs.length === 20;

      appendCollection('community', data, lastDoc, hasMore);
    } catch (error: any) {
      console.error('Error loading more community posts:', error);
      setError('데이터를 더 불러오는 중 오류가 발생했습니다.');
      try {
        handleFirestoreError(error, OperationType.GET, 'posts');
      } catch (e) {}
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="bg-wood-100 min-h-screen py-16">
      <SiteCmsSections pageSlug="community" placement="top" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-12 border-b border-wood-200 pb-6">
          <div>
            <h1 className="text-4xl font-serif font-bold text-wood-900 mb-4">소통 게시판</h1>
            <p className="text-wood-600 text-lg">자유롭게 의견을 나누고 교제하는 공간입니다.</p>
          </div>
          {user && (
            <Link
              to="/create-post?type=community"
              className="inline-flex items-center px-6 py-3 bg-wood-900 text-white rounded-xl hover:bg-wood-800 transition shadow-md font-medium"
            >
              <Plus size={20} className="mr-2" />
              글쓰기
            </Link>
          )}
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-center font-medium">
            {error}
          </div>
        )}

        {/* Posts List */}
        <div className="bg-white rounded-3xl shadow-sm border border-wood-200 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wood-900 mb-4"></div>
              <p className="text-wood-500">게시글을 불러오는 중입니다...</p>
            </div>
          ) : community.data.length === 0 ? (
            <div className="text-center py-32">
              <MessageSquare className="mx-auto h-16 w-16 text-wood-200 mb-6" />
              <h3 className="text-xl font-bold text-wood-900">등록된 게시글이 없습니다</h3>
              <p className="mt-2 text-wood-500">첫 번째 게시글을 작성해 보세요.</p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-wood-50">
                {community.data.map((post, index) => (
                  <motion.li
                    key={post.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      delay: Math.min(index * 0.03, 0.4),
                      ease: "easeOut"
                    }}
                  >
                    <Link to={`/post/${post.id}`} className="block hover:bg-wood-50/50 transition-all p-8 group">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold text-wood-900 truncate mb-3 group-hover:text-wood-700 transition-colors">
                            {post.title}
                          </h3>
                          <div className="flex items-center text-sm font-medium text-wood-400 gap-4">
                            <span className="text-wood-600">{post.authorName}</span>
                            <span className="text-wood-200">&bull;</span>
                            <span>{formatDate(post.createdAt)}</span>
                          </div>
                        </div>
                        <div className="ml-8 flex-shrink-0 flex items-center gap-2 bg-wood-50 px-4 py-2 rounded-xl text-wood-500 group-hover:bg-wood-100 transition-colors">
                          <MessageSquare size={18} />
                          <span className="text-sm font-bold">{post.commentCount || 0}</span>
                        </div>
                      </div>
                    </Link>
                  </motion.li>
                ))}
              </ul>

              {community.hasMore && (
                <div className="p-8 border-t border-wood-50 flex justify-center bg-wood-50/30">
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
            </>
          )}
        </div>
      </div>
      <SiteCmsSections pageSlug="community" placement="bottom" />
    </div>
  );
}
