import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { Book, Plus, MessageSquare, ChevronDown } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function Journal() {
  const { user, role } = useAuth();
  const { journal, setCollection, appendCollection } = useStore();
  
  const [loading, setLoading] = useState(!journal.fetched);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (journal.fetched) {
        setLoading(false);
        return;
      }

      try {
        setError(null);

        const q = query(
          collection(db, 'posts'),
          where('category', '==', 'journal'),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
        const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
        const hasMore = snapshot.docs.length === 20;

        setCollection('journal', data, lastDoc, hasMore);
      } catch (error: any) {
        console.error('Error fetching journal posts:', error);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
        try {
          handleFirestoreError(error, OperationType.GET, 'posts');
        } catch (e) {}
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [journal.fetched]);

  const handleLoadMore = async () => {
    if (!journal.lastDoc || !journal.hasMore || loadingMore) return;

    setLoadingMore(true);
    setError(null);

    try {
      const q = query(
        collection(db, 'posts'),
        where('category', '==', 'journal'),
        orderBy('createdAt', 'desc'),
        startAfter(journal.lastDoc),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
      const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
      const hasMore = snapshot.docs.length === 20;

      appendCollection('journal', data, lastDoc, hasMore);
    } catch (error: any) {
      console.error('Error loading more journal posts:', error);
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-12 border-b border-wood-200 pb-6">
          <div>
            <h1 className="text-4xl font-serif font-bold text-wood-900 mb-4">개척 일지</h1>
            <p className="text-wood-600 text-lg">교회가 세워져 가는 과정과 고민을 담은 기록입니다.</p>
          </div>
          {role === 'admin' && (
            <Link
              to="/create-post?type=journal"
              className="inline-flex items-center px-6 py-3 bg-wood-900 text-white rounded-xl hover:bg-wood-800 transition shadow-md font-medium"
            >
              <Plus size={20} className="mr-2" />
              일지 작성
            </Link>
          )}
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-center font-medium">
            {error}
          </div>
        )}

        {/* Posts List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wood-900 mb-4"></div>
            <p className="text-wood-500">일지를 불러오는 중입니다...</p>
          </div>
        ) : journal.data.length === 0 ? (
          <div className="text-center py-32 bg-white rounded-3xl border border-wood-200 shadow-sm">
            <Book className="mx-auto h-16 w-16 text-wood-200 mb-6" />
            <h3 className="text-xl font-bold text-wood-900">등록된 일지가 없습니다</h3>
            <p className="mt-2 text-wood-500">목사님의 소중한 기록을 기다립니다.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {journal.data.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ 
                    delay: Math.min(index * 0.03, 0.4),
                    ease: "easeOut"
                  }}
                  className="bg-white rounded-3xl shadow-sm border border-wood-100 overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col group"
                >
                  <Link to={`/post/${post.id}`} className="p-8 flex-grow flex flex-col">
                    <h3 className="text-xl font-bold text-wood-900 mb-4 line-clamp-2 leading-tight group-hover:text-wood-700 transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-wood-600 text-sm line-clamp-3 mb-6 leading-relaxed flex-grow">
                      {post.content.replace(/<[^>]*>?/gm, '')}
                    </p>
                    <div className="mt-auto pt-6 border-t border-wood-50 flex items-center justify-between text-xs font-bold text-wood-400">
                      <span className="bg-wood-50 px-2 py-1 rounded-md">{formatDate(post.createdAt)}</span>
                      <div className="flex items-center gap-1 bg-wood-50 px-2 py-1 rounded-md">
                        <MessageSquare size={14} />
                        <span>{post.commentCount || 0}</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {journal.hasMore && (
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
          </>
        )}
      </div>
    </div>
  );
}
