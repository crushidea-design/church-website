import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link, useSearchParams } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { PlayCircle, Plus, Video, ArrowUpDown } from 'lucide-react';

interface SermonCategory {
  id: string;
  name: string;
  order: number;
}

export default function Sermons() {
  const { user, role, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [videos, setVideos] = useState<any[]>([]);
  const [categories, setCategories] = useState<SermonCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');
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

    // Fetch categories
    const fetchCategories = async () => {
      try {
        const q = query(collection(db, 'sermon_categories'), orderBy('order', 'asc'));
        const snapshot = await getDocs(q);
        const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SermonCategory[];
        setCategories(cats);
        
        const tabParam = searchParams.get('tab');
        if (tabParam && (cats.some(c => c.id === tabParam) || tabParam === 'past_sermons' || tabParam === 'pilgrims_progress')) {
          setActiveTab(tabParam);
        } else if (cats.length > 0 && !activeTab) {
          setActiveTab(cats[0].id);
        } else if (cats.length === 0) {
          setActiveTab('past_sermons');
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    fetchCategories();

    const q = query(
      collection(db, 'posts'),
      where('category', '==', 'sermon')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVideos(data);
      setLoading(false);
    }, (error) => {
      // If it's a permission error and we're not a regular member, we already handle it in the UI
      if (error.code === 'permission-denied' && !isRegularMember) {
        setLoading(false);
        return;
      }
      console.error('Error fetching videos:', error);
      handleFirestoreError(error, OperationType.GET, 'posts');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [authLoading, isRegularMember]);

  const getYouTubeId = (content: string) => {
    const youtubeRegex = /(?:https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11}))/;
    const match = content.match(youtubeRegex);
    return match ? match[1] : null;
  };

  const filteredVideos = videos
    .filter(video => {
      // Support legacy subCategory and new sermonCategoryId
      const matchesTab = video.sermonCategoryId === activeTab || 
                        (activeTab === 'past_sermons' && video.subCategory === 'past_sermons') ||
                        (activeTab === 'pilgrims_progress' && video.subCategory === 'pilgrims_progress');
      return matchesTab;
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
    <div className="bg-wood-100 min-h-screen py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-8 border-b border-wood-200 pb-6">
          <div className="text-left">
            <h1 className="text-4xl font-serif font-bold text-wood-900 mb-4">말씀 서재</h1>
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
            {categories.map((tab) => (
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
            {/* Fallback for legacy tabs if they don't exist in categories */}
            {!categories.find(c => c.id === 'past_sermons') && videos.some(v => v.subCategory === 'past_sermons') && (
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
            {!categories.find(c => c.id === 'pilgrims_progress') && videos.some(v => v.subCategory === 'pilgrims_progress') && (
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

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wood-900"></div>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-wood-200">
            <Video className="mx-auto h-12 w-12 text-wood-300 mb-4" />
            <h3 className="text-lg font-medium text-wood-900">등록된 영상이 없습니다</h3>
            <p className="mt-2 text-wood-500">곧 새로운 말씀 영상이 업데이트될 예정입니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredVideos.map((video, index) => {
              const videoId = getYouTubeId(video.content);
              return (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link to={`/post/${video.id}`} className="block h-full group">
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-wood-100 hover:shadow-md transition-shadow flex flex-col h-full">
                      <div className="aspect-video bg-wood-900 relative">
                        {videoId ? (
                          <img
                            src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                            alt={video.title}
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
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
        )}
      </div>
    </div>
  );
}
