import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { MessageSquare, Plus } from 'lucide-react';

export default function Community() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      where('category', '==', 'community')
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
      console.error('Error fetching posts:', error);
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
            <h1 className="text-4xl font-serif font-bold text-wood-900 mb-4">소통 게시판</h1>
            <p className="text-wood-600 text-lg">자유롭게 의견을 나누고 교제하는 공간입니다.</p>
          </div>
          {user && (
            <Link
              to="/create-post?type=community"
              className="inline-flex items-center px-4 py-2 bg-wood-900 text-white rounded-md hover:bg-wood-800 transition shadow-sm"
            >
              <Plus size={20} className="mr-2" />
              글쓰기
            </Link>
          )}
        </div>

        {/* Posts List */}
        <div className="bg-white rounded-2xl shadow-sm border border-wood-200 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wood-900"></div>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <MessageSquare className="mx-auto h-12 w-12 text-wood-300 mb-4" />
              <h3 className="text-lg font-medium text-wood-900">등록된 게시글이 없습니다</h3>
              <p className="mt-2 text-wood-500">첫 번째 게시글을 작성해 보세요.</p>
            </div>
          ) : (
            <ul className="divide-y divide-wood-100">
              {posts.map((post, index) => (
                <motion.li
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link to={`/post/${post.id}`} className="block hover:bg-wood-50 transition p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-wood-900 truncate mb-2">
                          {post.title}
                        </h3>
                        <div className="flex items-center text-sm text-wood-600 gap-4">
                          <span>{post.authorName}</span>
                          <span>&bull;</span>
                          <span>{formatDate(post.createdAt)}</span>
                        </div>
                      </div>
                      <div className="ml-4 flex-shrink-0 flex items-center text-wood-500">
                        <MessageSquare size={18} className="mr-1.5" />
                        <span className="text-sm font-medium">{post.commentCount || 0}</span>
                      </div>
                    </div>
                  </Link>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
