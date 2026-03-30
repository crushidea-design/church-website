import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, getDocs, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { BookOpen, Plus, Filter, ArrowUpDown } from 'lucide-react';

interface ResearchCategory {
  id: string;
  name: string;
  order: number;
}

export default function ResearchLab() {
  const { user, role, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [categories, setCategories] = useState<ResearchCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'title'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    // Fetch categories
    const fetchCategories = async () => {
      try {
        const q = query(collection(db, 'research_categories'), orderBy('order', 'asc'));
        const snapshot = await getDocs(q);
        const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ResearchCategory[];
        setCategories(cats);
      } catch (error) {
        console.error('Error fetching research categories:', error);
      }
    };

    fetchCategories();

    const q = query(
      collection(db, 'posts'),
      where('category', '==', 'research'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(data);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching posts:', error);
      handleFirestoreError(error, OperationType.GET, 'posts');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredPosts = posts
    .filter(post => {
      if (activeTab === 'all') return true;
      // Support both new researchCategoryId and legacy subCategory
      return post.researchCategoryId === activeTab || post.subCategory === activeTab;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      } else {
        const titleA = a.title;
        const titleB = b.title;
        if (sortOrder === 'asc') {
          return titleA.localeCompare(titleB, undefined, { numeric: true, sensitivity: 'base' });
        } else {
          return titleB.localeCompare(titleA, undefined, { numeric: true, sensitivity: 'base' });
        }
      }
    });

  const canWrite = !authLoading && (role === 'admin' || user?.email === 'crushidea@gmail.com');

  return (
    <div className="bg-wood-100 min-h-screen py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-8 border-b border-wood-200 pb-6">
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

        {/* Filters and Sorting */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-wood-900 text-white shadow-sm'
                  : 'bg-white text-wood-600 hover:bg-wood-50 border border-wood-200'
              }`}
            >
              전체
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${
                  activeTab === cat.id
                    ? 'bg-wood-900 text-white shadow-sm'
                    : 'bg-white text-wood-600 hover:bg-wood-50 border border-wood-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 bg-white p-1.5 rounded-2xl border border-wood-200 shadow-sm self-end md:self-auto">
            <div className="flex items-center gap-1 px-2 border-r border-wood-100">
              <ArrowUpDown size={14} className="text-wood-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'title')}
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

        {/* Posts Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wood-900"></div>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-wood-200">
            <BookOpen className="mx-auto h-12 w-12 text-wood-300 mb-4" />
            <h3 className="text-lg font-medium text-wood-900">등록된 연구글이 없습니다</h3>
            <p className="mt-2 text-wood-500">곧 새로운 연구 내용이 업데이트될 예정입니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPosts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link to={`/post/${post.id}`} className="block h-full">
                  <div className="bg-white rounded-2xl shadow-sm border border-wood-100 p-8 h-full hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-wood-50 text-wood-800">
                        {categories.find(c => c.id === post.researchCategoryId)?.name || '연구글'}
                      </span>
                      <span className="text-sm text-wood-500">
                        {formatDate(post.createdAt)}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-wood-900 mb-4 line-clamp-2 leading-snug">
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
