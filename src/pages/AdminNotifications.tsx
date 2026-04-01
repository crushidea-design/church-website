import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, where, limit } from 'firebase/firestore';
import { Bell, Send, ArrowLeft, Users, CheckCircle, AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { requestNotificationPermission } from '../services/notificationService';

const CATEGORIES = [
  { id: 'home', name: '홈페이지', path: '/' },
  { id: 'today_word', name: '오늘의 말씀', path: '/archive/today' },
  { id: 'sermon', name: '말씀 서재', path: '/archive/sermons' },
  { id: 'research', name: '교회 연구실', path: '/archive/research' },
  { id: 'community', name: '소통 게시판', path: '/community' },
  { id: 'journal', name: '개척 일지', path: '/journal' },
  { id: 'manual', name: '직접 입력', path: '' }
];

export default function AdminNotifications() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('home');
  const [posts, setPosts] = useState<any[]>([]);
  const [selectedPostId, setSelectedPostId] = useState('');
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (role !== 'admin') {
      navigate('/');
      return;
    }

    const fetchTokenCount = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'fcm_tokens'));
        setTokenCount(snapshot.size);
      } catch (error) {
        console.error('Error fetching tokens:', error);
      }
    };

    fetchTokenCount();
  }, [role, navigate]);

  useEffect(() => {
    if (selectedCategory === 'home') {
      setTargetUrl('/');
      setPosts([]);
      setSelectedPostId('');
    } else if (selectedCategory === 'manual') {
      // Keep targetUrl as is or empty it if it was a post URL
      if (targetUrl.includes('/journal/') || targetUrl.includes('/community/')) {
        setTargetUrl('');
      }
      setPosts([]);
      setSelectedPostId('');
    } else {
      const fetchPosts = async () => {
        setLoadingPosts(true);
        try {
          const q = query(
            collection(db, 'posts'),
            where('category', '==', selectedCategory),
            orderBy('createdAt', 'desc'),
            limit(20)
          );
          const snap = await getDocs(q);
          const fetchedPosts = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setPosts(fetchedPosts);
          
          // Default to the category path if no post selected
          const cat = CATEGORIES.find(c => c.id === selectedCategory);
          setTargetUrl(cat?.path || '/');
        } catch (error) {
          console.error('Error fetching posts for notifications:', error);
        } finally {
          setLoadingPosts(false);
        }
      };
      fetchPosts();
    }
  }, [selectedCategory]);

  const handlePostSelect = (postId: string) => {
    setSelectedPostId(postId);
    if (!postId) {
      const cat = CATEGORIES.find(c => c.id === selectedCategory);
      setTargetUrl(cat?.path || '/');
      setImageUrl('');
      return;
    }

    const post = posts.find(p => p.id === postId);
    if (post && post.imageUrl) {
      setImageUrl(post.imageUrl);
    } else {
      setImageUrl('');
    }

    const cat = CATEGORIES.find(c => c.id === selectedCategory);
    if (selectedCategory === 'community') {
      setTargetUrl(`/community?id=${postId}`);
    } else {
      setTargetUrl(`/post/${postId}`);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) return;

    setLoading(true);
    setStatus(null);

    try {
      // Fetch all tokens and deduplicate
      const snapshot = await getDocs(collection(db, 'fcm_tokens'));
      const allTokens = snapshot.docs.map(doc => doc.data().token);
      const tokens = Array.from(new Set(allTokens));

      if (tokens.length === 0) {
        setStatus({ type: 'error', message: '알림을 받을 수 있는 기기가 없습니다.' });
        setLoading(false);
        return;
      }

      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, targetUrl, imageUrl, targetTokens: tokens }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus({ 
          type: 'success', 
          message: `알림 발송 성공! (성공: ${result.successCount}, 실패: ${result.failureCount})` 
        });
        setTitle('');
        setBody('');
        setTargetUrl('');
        setImageUrl('');
      } else {
        setStatus({ type: 'error', message: result.error || '알림 발송에 실패했습니다.' });
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      setStatus({ type: 'error', message: '서버 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-wood-100 min-h-screen py-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/admin')}
            className="p-2 hover:bg-white rounded-full transition shadow-sm border border-wood-200"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-serif font-bold text-wood-900">알림 발송</h1>
            <p className="text-wood-600">성도들에게 모바일 푸시 알림을 보냅니다.</p>
          </div>
        </div>

          <div className="bg-white rounded-3xl p-8 border border-wood-200 shadow-sm">
            <div className="flex items-center gap-3 mb-8 p-4 bg-orange-50 rounded-2xl border border-orange-100">
              <Users className="text-orange-600" />
              <div>
                <p className="text-sm text-orange-800 font-medium">현재 알림 수신 가능 기기</p>
                <p className="text-2xl font-bold text-orange-900">{tokenCount}대</p>
              </div>
            </div>

            {tokenCount === 0 && (
              <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <div className="flex gap-3">
                  <AlertCircle className="text-amber-600 shrink-0" size={20} />
                  <div>
                    <p className="text-sm font-bold text-amber-900">수신 가능 기기가 없습니다.</p>
                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                      1. 브라우저에서 알림 권한을 허용했는지 확인해 주세요.<br />
                      2. VAPID 키(Web Push Certificate)가 올바르게 설정되어 있는지 확인이 필요합니다.<br />
                      3. 시크릿 모드에서는 알림 기능이 작동하지 않을 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSend} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-wood-700 mb-2">알림 제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 이번 주 주보 안내"
                className="w-full px-4 py-3 rounded-xl border border-wood-200 focus:ring-2 focus:ring-gold-500 outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-wood-700 mb-2">알림 내용</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="성도들에게 전달할 내용을 입력하세요."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-wood-200 focus:ring-2 focus:ring-gold-500 outline-none transition resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-wood-700 mb-2">이동할 페이지 설정</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="relative">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-wood-200 focus:ring-2 focus:ring-gold-500 outline-none transition appearance-none bg-white"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-wood-400 pointer-events-none" size={18} />
                </div>

                {selectedCategory !== 'home' && selectedCategory !== 'manual' && (
                  <div className="relative">
                    <select
                      value={selectedPostId}
                      onChange={(e) => handlePostSelect(e.target.value)}
                      disabled={loadingPosts || posts.length === 0}
                      className="w-full px-4 py-3 rounded-xl border border-wood-200 focus:ring-2 focus:ring-gold-500 outline-none transition appearance-none bg-white disabled:bg-wood-50"
                    >
                      <option value="">게시판 전체로 이동</option>
                      {posts.map(post => (
                        <option key={post.id} value={post.id}>{post.title}</option>
                      ))}
                    </select>
                    {loadingPosts ? (
                      <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-wood-400 animate-spin" size={18} />
                    ) : (
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-wood-400 pointer-events-none" size={18} />
                    )}
                  </div>
                )}
              </div>

              {selectedCategory === 'manual' && (
                <input
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="예: /journal/123"
                  className="w-full px-4 py-3 rounded-xl border border-wood-200 focus:ring-2 focus:ring-gold-500 outline-none transition"
                />
              )}
              
              {selectedCategory !== 'manual' && (
                <div className="px-4 py-2 bg-wood-50 rounded-lg border border-wood-100">
                  <p className="text-xs text-wood-500">
                    <span className="font-medium">최종 이동 경로:</span> {targetUrl || '(홈페이지)'}
                  </p>
                </div>
              )}
            </div>

            {status && (
              <div className={`p-4 rounded-xl flex items-center gap-3 ${
                status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
              }`}>
                {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                <p className="text-sm font-medium">{status.message}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-wood-100">
              <button
                type="button"
                onClick={async () => {
                  if (!title || !body) {
                    setStatus({ type: 'error', message: '제목과 내용을 입력해 주세요.' });
                    return;
                  }
                  setLoading(true);
                  try {
                    const token = await requestNotificationPermission(user?.uid || '');
                    if (!token) {
                      setStatus({ type: 'error', message: '내 기기의 알림 토큰을 가져올 수 없습니다. 알림 권한을 확인해 주세요.' });
                      return;
                    }
                    const response = await fetch('/api/notifications/send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ title, body, targetUrl, imageUrl, targetTokens: [token] }),
                    });
                    const result = await response.json();
                    if (result.success) {
                      setStatus({ type: 'success', message: '테스트 알림 발송 성공!' });
                    } else {
                      setStatus({ type: 'error', message: result.error || '발송 실패' });
                    }
                  } catch (err) {
                    setStatus({ type: 'error', message: '오류 발생' });
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || !title || !body}
                className="flex-1 bg-wood-100 text-wood-700 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-wood-200 transition disabled:opacity-50"
              >
                나에게 테스트 발송
              </button>
              <button
                type="submit"
                disabled={loading || !title || !body || tokenCount === 0}
                className="flex-[2] bg-wood-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-wood-800 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <Send size={20} />
                    전체 성도에게 발송 ({tokenCount}명)
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 p-6 bg-blue-50 rounded-2xl border border-blue-100">
          <h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
            <AlertCircle size={16} />
            알림 발송 전 확인사항
          </h4>
          <ul className="text-xs text-blue-800 space-y-1 list-disc pl-4">
            <li>알림은 '알림 허용'을 한 성도들에게만 발송됩니다.</li>
            <li>너무 잦은 알림은 성도들에게 불편을 줄 수 있으니 주의해 주세요.</li>
            <li>발송 후에는 취소할 수 없습니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
