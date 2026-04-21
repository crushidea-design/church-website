import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import {
  addDoc,
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronDown,
  Clock,
  Loader2,
  Send,
  Users,
} from 'lucide-react';
import { requestNotificationPermission } from '../services/notificationService';
import AdminLayout from '../components/AdminLayout';

interface CategoryOption {
  id: string;
  name: string;
  path: string;
}

interface PostSummary {
  id: string;
  title?: string;
  imageUrl?: string;
}

interface UserWithTokens {
  uid: string;
  displayName: string;
  email: string;
  tokens: string[];
}

const CATEGORIES: CategoryOption[] = [
  { id: 'home', name: '홈', path: '/' },
  { id: 'today_word', name: '오늘의 말씀', path: '/archive/today' },
  { id: 'sermon', name: '말씀서재', path: '/archive/sermons' },
  { id: 'research', name: '교회연구실', path: '/archive/research' },
  { id: 'community', name: '소통 게시판', path: '/community' },
  { id: 'journal', name: '개척일지', path: '/journal' },
  { id: 'manual', name: '직접 입력', path: '' },
];

export default function AdminNotifications() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('home');
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [selectedPostId, setSelectedPostId] = useState('');
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [targetAudience, setTargetAudience] = useState<'all' | 'specific'>('all');
  const [usersWithTokens, setUsersWithTokens] = useState<UserWithTokens[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState('09:00');

  const selectedCategoryLabel = useMemo(
    () => CATEGORIES.find((category) => category.id === selectedCategory)?.name ?? '홈',
    [selectedCategory]
  );

  const getRequestHeaders = async () => {
    const idToken = await user?.getIdToken();
    return {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    };
  };

  useEffect(() => {
    if (role !== 'admin') {
      navigate('/');
      return;
    }

    if (dataLoaded) return;

    const fetchTokenCount = async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const tokensQuery = query(collection(db, 'fcm_tokens'), where('updatedAt', '>=', thirtyDaysAgo));
        const countSnapshot = await getCountFromServer(tokensQuery);
        setTokenCount(countSnapshot.data().count);
        setDataLoaded(true);
      } catch (error) {
        console.error('Error fetching token count:', error);
      }
    };

    fetchTokenCount();
  }, [role, navigate, dataLoaded]);

  const fetchUsersWithTokens = async () => {
    if (usersWithTokens.length > 0 || loadingUsers) return;

    setLoadingUsers(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const tokensQuery = query(
        collection(db, 'fcm_tokens'),
        where('updatedAt', '>=', thirtyDaysAgo),
        limit(100)
      );
      const tokensSnapshot = await getDocs(tokensQuery);
      const tokensData = tokensSnapshot.docs.map((tokenDoc) => tokenDoc.data());

      const userIds = Array.from(new Set(tokensData.map((token) => token.userId).filter(Boolean)));

      if (userIds.length > 0) {
        const usersData: any[] = [];
        for (let index = 0; index < userIds.length; index += 30) {
          const chunk = userIds.slice(index, index + 30);
          const usersQuery = query(collection(db, 'users'), where('uid', 'in', chunk));
          const usersSnapshot = await getDocs(usersQuery);
          usersData.push(...usersSnapshot.docs.map((userDoc) => userDoc.data()));
        }

        const usersMap = new Map(usersData.map((entry) => [entry.uid, entry]));
        const nextUsers = userIds.map((uid) => {
          const currentUser = usersMap.get(uid);
          return {
            uid,
            displayName: currentUser?.displayName || '이름 없는 사용자',
            email: currentUser?.email || '이메일 없음',
            tokens: tokensData.filter((token) => token.userId === uid).map((token) => token.token),
          };
        });

        setUsersWithTokens(nextUsers);
      }
    } catch (error) {
      console.error('Error fetching users with tokens:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (targetAudience === 'specific') {
      fetchUsersWithTokens();
    }
  }, [targetAudience]);

  useEffect(() => {
    if (selectedCategory === 'home') {
      setTargetUrl('/');
      setPosts([]);
      setSelectedPostId('');
      return;
    }

    if (selectedCategory === 'manual') {
      if (targetUrl.includes('/journal/') || targetUrl.includes('/community/')) {
        setTargetUrl('');
      }
      setPosts([]);
      setSelectedPostId('');
      return;
    }

    const fetchPosts = async () => {
      setLoadingPosts(true);
      try {
        const postsQuery = query(
          collection(db, 'posts'),
          where('category', '==', selectedCategory),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(postsQuery);
        const fetchedPosts = snapshot.docs.map((postDoc) => ({
          id: postDoc.id,
          ...postDoc.data(),
        })) as PostSummary[];
        setPosts(fetchedPosts);

        const category = CATEGORIES.find((entry) => entry.id === selectedCategory);
        setTargetUrl(category?.path || '/');
      } catch (error) {
        console.error('Error fetching posts for notifications:', error);
      } finally {
        setLoadingPosts(false);
      }
    };

    fetchPosts();
  }, [selectedCategory, targetUrl]);

  const handlePostSelect = (postId: string) => {
    setSelectedPostId(postId);

    if (!postId) {
      const category = CATEGORIES.find((entry) => entry.id === selectedCategory);
      setTargetUrl(category?.path || '/');
      setImageUrl('');
      return;
    }

    const post = posts.find((entry) => entry.id === postId);
    setImageUrl(post?.imageUrl || '');

    if (selectedCategory === 'community') {
      setTargetUrl(`/community?id=${postId}`);
      return;
    }

    setTargetUrl(`/post/${postId}`);
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title || !body) return;

    setLoading(true);
    setStatus(null);

    try {
      if (isScheduled) {
        const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
        if (scheduledDateTime <= new Date()) {
          setStatus({ type: 'error', message: '예약 시간은 현재 시각보다 이후여야 합니다.' });
          setLoading(false);
          return;
        }

        if (targetAudience === 'specific' && selectedUserIds.length === 0) {
          setStatus({ type: 'error', message: '예약 알림을 받을 성도를 선택해 주세요.' });
          setLoading(false);
          return;
        }

        await addDoc(collection(db, 'scheduled_notifications'), {
          title,
          body,
          targetUrl,
          imageUrl,
          targetAudience,
          targetUserIds: targetAudience === 'specific' ? selectedUserIds : null,
          targetTokens: null,
          scheduledAt: scheduledDateTime,
          status: 'pending',
          createdAt: serverTimestamp(),
          authorId: user?.uid,
        });

        setStatus({ type: 'success', message: '알림 예약을 저장했습니다.' });
        setTitle('');
        setBody('');
        setIsScheduled(false);
        setLoading(false);
        return;
      }

      if (targetAudience === 'all') {
        const response = await fetch('/api/notifications/send', {
          method: 'POST',
          headers: await getRequestHeaders(),
          body: JSON.stringify({
            title,
            body,
            targetUrl,
            imageUrl,
            useTopic: true,
          }),
        });
        const result = await response.json();

        if (result.success) {
          setStatus({ type: 'success', message: '전체 성도에게 알림을 발송했습니다.' });
          setTitle('');
          setBody('');
        } else {
          setStatus({ type: 'error', message: result.error || '발송 중 오류가 발생했습니다.' });
        }
        setLoading(false);
        return;
      }

      if (selectedUserIds.length === 0) {
        setStatus({ type: 'error', message: '알림을 받을 성도를 선택해 주세요.' });
        setLoading(false);
        return;
      }

      const selectedUsers = usersWithTokens.filter((entry) => selectedUserIds.includes(entry.uid));
      const tokens = Array.from(new Set(selectedUsers.flatMap((entry) => entry.tokens)));

      if (tokens.length === 0) {
        setStatus({ type: 'error', message: '선택한 사용자에게 보낼 수 있는 기기가 없습니다.' });
        setLoading(false);
        return;
      }

      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: await getRequestHeaders(),
        body: JSON.stringify({ title, body, targetUrl, imageUrl, targetTokens: tokens }),
      });
      const result = await response.json();

      if (result.success) {
        setStatus({
          type: 'success',
          message: `알림 발송 완료 (${result.successCount}건 성공, ${result.failureCount}건 실패)`,
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
      setStatus({ type: 'error', message: '서버 처리 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestNotification = async () => {
    if (!title || !body) {
      setStatus({ type: 'error', message: '제목과 내용을 먼저 입력해 주세요.' });
      return;
    }

    setLoading(true);
    try {
      const token = await requestNotificationPermission(user?.uid || '');
      if (!token) {
        setStatus({
          type: 'error',
          message: '현재 기기의 알림 권한 또는 테스트 토큰을 확인해 주세요.',
        });
        return;
      }

      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: await getRequestHeaders(),
        body: JSON.stringify({ title, body, targetUrl, imageUrl, targetTokens: [token] }),
      });
      const result = await response.json();

      if (result.success) {
        setStatus({ type: 'success', message: '현재 기기로 테스트 알림을 발송했습니다.' });
      } else {
        setStatus({ type: 'error', message: result.error || '테스트 발송에 실패했습니다.' });
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      setStatus({ type: 'error', message: '테스트 발송 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout
      title="알림 발송"
      description="성도들에게 보낼 공지 알림을 직접 발송하거나 예약할 수 있도록 흐름을 단순하게 정리했습니다."
      backTo="/admin"
      backLabel="관리자 대시보드"
      badge="고급 기능"
      icon={<Send size={14} />}
      maxWidthClassName="max-w-3xl"
      aside={
        <div className="grid min-w-[240px] gap-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-wood-500">수신 가능 기기</span>
            <strong className="text-wood-900">{tokenCount}</strong>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-wood-500">발송 대상</span>
            <strong className="text-wood-900">{targetAudience === 'all' ? '전체' : `${selectedUserIds.length}명`}</strong>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-wood-500">이동 경로</span>
            <strong className="truncate text-wood-900">{targetUrl || '/'}</strong>
          </div>
        </div>
      }
    >
      <div className="space-y-8">
        <div className="rounded-[2rem] border border-wood-200 bg-white p-8 shadow-sm">
          <div className="mb-8 rounded-[1.5rem] border border-orange-100 bg-orange-50 p-5">
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-orange-900">최근 30일 기준 수신 가능 기기</p>
                <p className="mt-1 text-3xl font-bold text-orange-950">{tokenCount}</p>
                <p className="mt-2 text-sm leading-6 text-orange-800">
                  알림 권한을 허용한 기기만 발송 대상에 포함됩니다.
                </p>
              </div>
            </div>
          </div>

          {tokenCount === 0 && (
            <div className="mb-8 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5">
              <div className="flex gap-3">
                <AlertCircle className="mt-0.5 shrink-0 text-amber-600" size={20} />
                <div>
                  <p className="text-sm font-bold text-amber-900">수신 가능한 기기가 없습니다.</p>
                  <p className="mt-2 text-sm leading-6 text-amber-800">
                    브라우저 알림 권한 허용, VAPID 설정, 실제 기기에서의 구독 상태를 먼저 확인해 주세요.
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSend} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-wood-700">발송 방식</label>
              <div className="space-y-6 rounded-[1.5rem] border border-wood-200 bg-wood-50 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="text-wood-500" size={18} />
                    <span className="text-sm font-medium text-wood-900">예약 발송 사용</span>
                  </div>
                  <label className="flex cursor-pointer items-center">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isScheduled}
                        onChange={(event) => setIsScheduled(event.target.checked)}
                      />
                      <div className={`block h-6 w-10 rounded-full transition-colors ${isScheduled ? 'bg-wood-900' : 'bg-wood-300'}`} />
                      <div
                        className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${isScheduled ? 'translate-x-4' : ''}`}
                      />
                    </div>
                    <span className="ml-3 text-sm font-medium text-wood-700">{isScheduled ? '켜짐' : '꺼짐'}</span>
                  </label>
                </div>

                {isScheduled && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-wood-500">예약 날짜</label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(event) => setScheduledDate(event.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full rounded-xl border border-wood-200 px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-gold-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-wood-500">예약 시간</label>
                      <div className="relative">
                        <select
                          value={scheduledTime}
                          onChange={(event) => setScheduledTime(event.target.value)}
                          className="w-full appearance-none rounded-xl border border-wood-200 bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-gold-500"
                        >
                          {Array.from({ length: 24 }).map((_, index) => {
                            const hour = index.toString().padStart(2, '0');
                            return (
                              <option key={hour} value={`${hour}:00`}>
                                {hour}:00
                              </option>
                            );
                          })}
                        </select>
                        <Clock className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-wood-400" size={14} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-wood-700">발송 대상</label>
              <div className="mb-4 flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="targetAudience"
                    value="all"
                    checked={targetAudience === 'all'}
                    onChange={() => setTargetAudience('all')}
                    className="text-gold-600 focus:ring-gold-500"
                  />
                  <span className="text-sm text-wood-800">전체 발송</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="targetAudience"
                    value="specific"
                    checked={targetAudience === 'specific'}
                    onChange={() => setTargetAudience('specific')}
                    className="text-gold-600 focus:ring-gold-500"
                  />
                  <span className="text-sm text-wood-800">선택 발송</span>
                </label>
              </div>

              {targetAudience === 'specific' && (
                <div className="max-h-60 overflow-y-auto rounded-[1.5rem] border border-wood-200 bg-wood-50 p-4">
                  {loadingUsers ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-8">
                      <Loader2 className="animate-spin text-wood-400" size={24} />
                      <p className="text-sm text-wood-500">수신 대상 목록을 불러오는 중입니다.</p>
                    </div>
                  ) : usersWithTokens.length === 0 ? (
                    <p className="py-4 text-center text-sm text-wood-500">알림을 받을 수 있는 사용자가 없습니다.</p>
                  ) : (
                    <div className="space-y-2">
                      {usersWithTokens.map((entry) => (
                        <label
                          key={entry.uid}
                          className="flex cursor-pointer items-center gap-3 rounded-xl p-3 transition hover:bg-white"
                        >
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(entry.uid)}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setSelectedUserIds((prev) => [...prev, entry.uid]);
                                return;
                              }
                              setSelectedUserIds((prev) => prev.filter((id) => id !== entry.uid));
                            }}
                            className="rounded text-gold-600 focus:ring-gold-500"
                          />
                          <div>
                            <p className="text-sm font-medium text-wood-900">{entry.displayName}</p>
                            <p className="text-xs text-wood-500">{entry.email}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-wood-700">알림 제목</label>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="예: 이번 주 예배 안내"
                className="w-full rounded-xl border border-wood-200 px-4 py-3 outline-none transition focus:ring-2 focus:ring-gold-500"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-wood-700">알림 내용</label>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="성도들에게 전달할 핵심 내용을 입력해 주세요."
                rows={4}
                className="w-full resize-none rounded-xl border border-wood-200 px-4 py-3 outline-none transition focus:ring-2 focus:ring-gold-500"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-wood-700">이동 페이지</label>
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="relative">
                  <select
                    value={selectedCategory}
                    onChange={(event) => setSelectedCategory(event.target.value)}
                    className="w-full appearance-none rounded-xl border border-wood-200 bg-white px-4 py-3 outline-none transition focus:ring-2 focus:ring-gold-500"
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-wood-400" size={18} />
                </div>

                {selectedCategory !== 'home' && selectedCategory !== 'manual' && (
                  <div className="relative">
                    <select
                      value={selectedPostId}
                      onChange={(event) => handlePostSelect(event.target.value)}
                      disabled={loadingPosts || posts.length === 0}
                      className="w-full appearance-none rounded-xl border border-wood-200 bg-white px-4 py-3 outline-none transition focus:ring-2 focus:ring-gold-500 disabled:bg-wood-50"
                    >
                      <option value="">목록으로 이동</option>
                      {posts.map((post) => (
                        <option key={post.id} value={post.id}>
                          {post.title}
                        </option>
                      ))}
                    </select>
                    {loadingPosts ? (
                      <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-wood-400" size={18} />
                    ) : (
                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-wood-400" size={18} />
                    )}
                  </div>
                )}
              </div>

              {selectedCategory === 'manual' && (
                <input
                  type="text"
                  value={targetUrl}
                  onChange={(event) => setTargetUrl(event.target.value)}
                  placeholder="예: /journal/123"
                  className="w-full rounded-xl border border-wood-200 px-4 py-3 outline-none transition focus:ring-2 focus:ring-gold-500"
                />
              )}

              {selectedCategory !== 'manual' && (
                <div className="rounded-xl border border-wood-100 bg-wood-50 px-4 py-3">
                  <p className="text-sm text-wood-600">
                    <span className="font-medium text-wood-800">선택된 분류:</span> {selectedCategoryLabel}
                  </p>
                  <p className="mt-1 text-xs text-wood-500">
                    최종 이동 경로: <span className="font-medium">{targetUrl || '/'}</span>
                  </p>
                </div>
              )}
            </div>

            {status && (
              <div
                className={`flex items-center gap-3 rounded-xl border p-4 ${
                  status.type === 'success'
                    ? 'border-green-100 bg-green-50 text-green-700'
                    : 'border-red-100 bg-red-50 text-red-700'
                }`}
              >
                {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                <p className="text-sm font-medium">{status.message}</p>
              </div>
            )}

            <div className="flex flex-col gap-4 border-t border-wood-100 pt-6 sm:flex-row">
              <button
                type="button"
                onClick={handleSendTestNotification}
                disabled={loading || !title || !body}
                className="flex-1 rounded-xl bg-wood-100 py-4 font-bold text-wood-700 transition hover:bg-wood-200 disabled:opacity-50"
              >
                내 기기로 테스트 발송
              </button>
              <button
                type="submit"
                disabled={loading || !title || !body || tokenCount === 0 || (targetAudience === 'specific' && selectedUserIds.length === 0)}
                className="flex flex-[1.6] items-center justify-center gap-2 rounded-xl bg-wood-900 py-4 font-bold text-white shadow-lg transition hover:bg-wood-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <Send size={20} />
                    {isScheduled
                      ? '알림 예약하기'
                      : targetAudience === 'all'
                        ? `전체 발송 (${tokenCount}기기)`
                        : `선택 발송 (${selectedUserIds.length}명)`}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-[1.75rem] border border-blue-100 bg-blue-50 p-6">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-900">
            <AlertCircle size={16} />
            발송 전 체크
          </h4>
          <ul className="list-disc space-y-1 pl-4 text-sm leading-6 text-blue-800">
            <li>알림은 알림 수신을 허용한 기기에만 전달됩니다.</li>
            <li>전체 발송은 노출 범위가 넓기 때문에 제목과 문구를 더 짧고 분명하게 쓰는 편이 좋습니다.</li>
            <li>예약 저장 후에는 별도 관리 화면이 없다면 즉시 취소가 어렵기 때문에, 테스트 발송을 먼저 권장합니다.</li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}
