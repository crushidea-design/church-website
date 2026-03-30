import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { Book, Plus, MessageSquare } from 'lucide-react';

export default function Journal() {
  const { user, role } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      where('category', '==', 'journal'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort client-side since orderBy was removed to prevent missing data issues
      const sortedData = data.sort((a: any, b: any) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });
      setPosts(sortedData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching journal posts:', error);
      handleFirestoreError(error, OperationType.GET, 'posts');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
              className="inline-flex items-center px-4 py-2 bg-wood-900 text-white rounded-md hover:bg-wood-800 transition shadow-sm"
            >
              <Plus size={20} className="mr-2" />
              일지 작성
            </Link>
          )}
        </div>

        {/* Posts List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading ? (
            <div className="col-span-full flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wood-900"></div>
            </div>
          ) : posts.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-white rounded-2xl border border-wood-200">
              <Book className="mx-auto h-12 w-12 text-wood-300 mb-4" />
              <h3 className="text-lg font-medium text-wood-900">등록된 일지가 없습니다</h3>
              <p className="mt-2 text-wood-500">목사님의 소중한 기록을 기다립니다.</p>
            </div>
          ) : (
            posts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl shadow-sm border border-wood-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col"
              >
                <Link to={`/post/${post.id}`} className="p-6 flex-grow">
                  <h3 className="text-lg font-bold text-wood-900 mb-3 line-clamp-2 leading-tight">
                    {post.title}
                  </h3>
                  <p className="text-wood-600 text-sm line-clamp-3 mb-4 leading-relaxed">
                    {post.content}
                  </p>
                  <div className="mt-auto pt-4 border-t border-wood-50 flex items-center justify-between text-xs text-wood-500">
                    <span>{formatDate(post.createdAt)}</span>
                    <div className="flex items-center gap-1">
                      <MessageSquare size={14} />
                      <span>{post.commentCount || 0}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
