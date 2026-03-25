import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { BookOpen, Plus } from 'lucide-react';

export default function ResearchLab() {
  const { user, role, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const q = query(
          collection(db, 'posts'),
          where('category', '==', 'research'),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPosts(data);
      } catch (error) {
        console.error('Error fetching posts:', error);
        handleFirestoreError(error, OperationType.GET, 'posts');
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  const canWrite = !authLoading && (role === 'admin' || user?.email === 'crushidea@gmail.com');

  return (
    <div className="bg-wood-100 min-h-screen py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-12 border-b border-wood-200 pb-6">
          <div>
            <h1 className="text-4xl font-serif font-bold text-wood-900 mb-4">교회 연구실</h1>
            <p className="text-wood-600 text-lg">목사님의 연구 내용과 묵상을 나눕니다.</p>
          </div>
          {canWrite && (
            <Link
              to="/create-post?type=research"
              className="inline-flex items-center px-4 py-2 bg-wood-900 text-white rounded-md hover:bg-wood-800 transition shadow-sm"
            >
              <Plus size={20} className="mr-2" />
              연구글 작성
            </Link>
          )}
        </div>

        {/* Posts Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wood-900"></div>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-wood-200">
            <BookOpen className="mx-auto h-12 w-12 text-wood-300 mb-4" />
            <h3 className="text-lg font-medium text-wood-900">등록된 연구글이 없습니다</h3>
            <p className="mt-2 text-wood-500">곧 새로운 연구 내용이 업데이트될 예정입니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link to={`/post/${post.id}`} className="block h-full">
                  <div className="bg-white rounded-2xl shadow-sm border border-wood-100 p-8 h-full hover:shadow-md transition flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-wood-50 text-wood-800">
                        {post.subCategory === 'worship' ? '예배' :
                         post.subCategory === 'preaching' ? '설교' :
                         post.subCategory === 'pastoring' ? '목양' :
                         post.subCategory === 'governing' ? '치리' :
                         post.subCategory === 'general' ? '일반' : '연구글'}
                      </span>
                      <span className="text-sm text-wood-500">
                        {formatDate(post.createdAt)}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-wood-900 mb-4 line-clamp-2 leading-snug">
                      {post.title}
                    </h3>
                    <p className="text-wood-700 line-clamp-3 mb-6 flex-grow">
                      {post.content.replace(/<[^>]*>?/gm, '')}
                    </p>
                    <div className="flex items-center justify-between text-sm text-wood-600 pt-4 border-t border-wood-100">
                      <span>{post.authorName}</span>
                      <span className="flex items-center">
                        댓글 {post.commentCount || 0}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
