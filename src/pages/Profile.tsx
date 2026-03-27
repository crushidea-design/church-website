import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { Link } from 'react-router-dom';
import { MessageSquare, FileText, Calendar, Mail } from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'comments'>('posts');

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Fetch user's posts
        const postsQuery = query(
          collection(db, 'posts'),
          where('authorId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const postsSnapshot = await getDocs(postsQuery);
        const postsData = postsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        }));
        setPosts(postsData);

        // Fetch user's comments
        const commentsQuery = query(
          collection(db, 'comments'),
          where('authorId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const commentsSnapshot = await getDocs(commentsQuery);
        const commentsData = commentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        }));
        setComments(commentsData);
        
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-wood-600">로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-wood-200 overflow-hidden mb-8">
        <div className="p-8 sm:p-10 bg-wood-50 border-b border-wood-200">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-wood-200 rounded-full flex items-center justify-center text-wood-600 text-3xl font-serif">
              {user.displayName?.charAt(0) || 'U'}
            </div>
            <div>
              <h1 className="text-3xl font-serif font-bold text-wood-900 mb-2">
                {user.displayName}
              </h1>
              <p className="text-wood-600 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {user.email}
              </p>
            </div>
          </div>
        </div>

        <div className="flex border-b border-wood-200">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex-1 py-4 text-center font-medium transition-colors ${
              activeTab === 'posts'
                ? 'text-wood-900 border-b-2 border-wood-900 bg-white'
                : 'text-wood-500 hover:text-wood-700 hover:bg-wood-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FileText className="w-5 h-5" />
              작성한 글 ({posts.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`flex-1 py-4 text-center font-medium transition-colors ${
              activeTab === 'comments'
                ? 'text-wood-900 border-b-2 border-wood-900 bg-white'
                : 'text-wood-500 hover:text-wood-700 hover:bg-wood-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <MessageSquare className="w-5 h-5" />
              작성한 댓글 ({comments.length})
            </div>
          </button>
        </div>

        <div className="p-6 sm:p-8 bg-white min-h-[400px]">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wood-900"></div>
            </div>
          ) : activeTab === 'posts' ? (
            posts.length > 0 ? (
              <div className="space-y-4">
                {posts.map(post => (
                  <Link
                    key={post.id}
                    to={`/post/${post.id}`}
                    className="block p-5 rounded-xl border border-wood-100 hover:border-wood-300 hover:shadow-sm transition-all bg-white"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-medium text-wood-900 line-clamp-1">
                        {post.title}
                      </h3>
                      <span className="text-xs font-medium px-2.5 py-1 bg-wood-100 text-wood-600 rounded-full whitespace-nowrap ml-4">
                        {post.category === 'journal' ? '개척일지' : 
                         post.category === 'sermon' ? '설교' : 
                         post.category === 'research' ? '연구소' : '소통게시판'}
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-wood-500 gap-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {post.createdAt?.toLocaleDateString()}
                      </span>
                      {post.commentCount > 0 && (
                        <span className="flex items-center gap-1 text-gold-600">
                          <MessageSquare className="w-4 h-4" />
                          {post.commentCount}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-wood-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-wood-300" />
                <p>작성한 글이 없습니다.</p>
              </div>
            )
          ) : (
            comments.length > 0 ? (
              <div className="space-y-4">
                {comments.map(comment => (
                  <Link
                    key={comment.id}
                    to={`/post/${comment.postId}`}
                    className="block p-5 rounded-xl border border-wood-100 hover:border-wood-300 hover:shadow-sm transition-all bg-white"
                  >
                    <p className="text-wood-800 mb-3 line-clamp-2">
                      {comment.content}
                    </p>
                    <div className="flex items-center text-sm text-wood-500 gap-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {comment.createdAt?.toLocaleDateString()}
                      </span>
                      <span className="text-wood-400">
                        원문 보기 &rarr;
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-wood-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-wood-300" />
                <p>작성한 댓글이 없습니다.</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
