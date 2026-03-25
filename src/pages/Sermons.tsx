import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { format } from 'date-fns';
import { PlayCircle, Plus, Video } from 'lucide-react';

export default function Sermons() {
  const { user, role, loading: authLoading } = useAuth();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .eq('category', 'sermon')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setVideos(data || []);
      } catch (error) {
        console.error('Error fetching videos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  const getYouTubeId = (content: string) => {
    const youtubeRegex = /(?:https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11}))/;
    const match = content.match(youtubeRegex);
    return match ? match[1] : null;
  };

  const canWrite = !authLoading && (role === 'admin' || user?.email === 'crushidea@gmail.com');

  return (
    <div className="bg-wood-100 min-h-screen py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-end mb-12 border-b border-wood-200 pb-6">
          <div className="text-left">
            <h1 className="text-4xl font-serif font-bold text-wood-900 mb-4">말씀 서재</h1>
            <p className="text-lg text-wood-600">유튜브에 업로드된 설교와 성경 공부 영상을 확인하세요.</p>
          </div>
          {canWrite && (
            <Link
              to="/create-post?type=sermon"
              className="inline-flex items-center px-4 py-2 bg-wood-900 text-white rounded-md hover:bg-wood-800 transition shadow-sm"
            >
              <Plus size={20} className="mr-2" />
              영상 등록
            </Link>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wood-900"></div>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-wood-200">
            <Video className="mx-auto h-12 w-12 text-wood-300 mb-4" />
            <h3 className="text-lg font-medium text-wood-900">등록된 영상이 없습니다</h3>
            <p className="mt-2 text-wood-500">곧 새로운 말씀 영상이 업데이트될 예정입니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {videos.map((video, index) => {
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
                        <h3 className="text-xl font-bold text-wood-900 mb-2 line-clamp-2">{video.title}</h3>
                        <p className="text-sm text-wood-500">
                          {video.created_at ? format(new Date(video.created_at), 'yyyy.MM.dd') : ''}
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
