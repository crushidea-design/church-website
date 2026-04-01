import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, limit, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { Link } from 'react-router-dom';
import { MessageSquare, FileText, Calendar, Mail, BookOpen, Bell, Edit, Save, X, Plus } from 'lucide-react';
import { requestNotificationPermission } from '../services/notificationService';

export default function Profile() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [readings, setReadings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'comments' | 'readings'>('posts');
  const [notificationStatus, setNotificationStatus] = useState<string>('default');

  // Meditation Editing State
  const [editingMeditationId, setEditingMeditationId] = useState<string | null>(null);
  const [tempMeditation, setTempMeditation] = useState('');
  const [savingMeditation, setSavingMeditation] = useState(false);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setNotificationStatus(Notification.permission);
    }
  }, []);

  const handleEnableNotifications = async () => {
    if (user) {
      const token = await requestNotificationPermission(user.uid);
      if (token) {
        setNotificationStatus('granted');
        alert('알림이 허용되었습니다.');
      } else {
        setNotificationStatus(Notification.permission);
      }
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Fetch user's posts
        const postsQuery = query(
          collection(db, 'posts'),
          where('authorId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(20)
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
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        const commentsSnapshot = await getDocs(commentsQuery);
        const commentsData = commentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        }));
        setComments(commentsData);

        // Fetch user's reading history
        const readingsQuery = query(
          collection(db, 'users', user.uid, 'readings'),
          orderBy('date', 'desc'),
          limit(30) // Show last 30 days
        );
        const readingsSnapshot = await getDocs(readingsQuery);
        const readingsData = readingsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setReadings(readingsData);
        
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  const handleUpdateMeditation = async (readingId: string) => {
    if (!user) return;
    setSavingMeditation(true);
    try {
      const readingRef = doc(db, 'users', user.uid, 'readings', readingId);
      await updateDoc(readingRef, {
        meditation: tempMeditation,
        updatedAt: serverTimestamp()
      });
      
      setReadings(prev => prev.map(r => 
        r.id === readingId ? { ...r, meditation: tempMeditation } : r
      ));
      setEditingMeditationId(null);
    } catch (error) {
      console.error('Error updating meditation:', error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/readings/${readingId}`);
    } finally {
      setSavingMeditation(false);
    }
  };

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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-wood-200 rounded-full flex items-center justify-center text-wood-600 text-3xl font-serif">
                {user.displayName?.charAt(0) || '회'}
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

            {/* Notification Permission UI */}
            {notificationStatus !== 'granted' && (
              <div className="bg-white p-4 rounded-xl border border-wood-200 shadow-sm max-w-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gold-50 text-gold-600 rounded-lg">
                    <Bell size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-wood-900 mb-1">알림을 원하시면 알림 허용을 해주세요!</h3>
                    <p className="text-xs text-wood-500 mb-3">매일 아침 오늘의 말씀 가이드라인 알림을 보내드립니다.</p>
                    <button
                      onClick={handleEnableNotifications}
                      className="text-xs font-bold bg-wood-900 text-white px-4 py-2 rounded-lg hover:bg-wood-800 transition-colors"
                    >
                      알림 허용하기
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex border-b border-wood-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex-1 min-w-[120px] py-4 text-center font-medium transition-colors ${
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
            className={`flex-1 min-w-[120px] py-4 text-center font-medium transition-colors ${
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
          <button
            onClick={() => setActiveTab('readings')}
            className={`flex-1 min-w-[120px] py-4 text-center font-medium transition-colors ${
              activeTab === 'readings'
                ? 'text-wood-900 border-b-2 border-wood-900 bg-white'
                : 'text-wood-500 hover:text-wood-700 hover:bg-wood-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <BookOpen className="w-5 h-5" />
              성경 읽기 현황
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
          ) : activeTab === 'comments' ? (
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
          ) : (
            readings.length > 0 ? (
              <div className="space-y-4">
                {readings.map(reading => {
                  const readCount = reading.progress ? reading.progress.filter(Boolean).length : 0;
                  const totalCount = reading.progress ? reading.progress.length : 4;
                  const isComplete = readCount === totalCount && totalCount > 0;

                  return (
                    <div
                      key={reading.id}
                      className="block p-5 rounded-xl border border-wood-100 bg-white"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-wood-500" />
                          <h3 className="text-lg font-bold text-wood-900">
                            {reading.date}
                          </h3>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${isComplete ? 'bg-gold-100 text-gold-700' : 'bg-wood-100 text-wood-600'}`}>
                          {readCount} / {totalCount} 완료
                        </span>
                      </div>
                      
                      {reading.meditation || editingMeditationId === reading.id ? (
                        <div className="mt-3 p-4 bg-wood-50 rounded-lg border border-wood-100">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-sm font-bold text-wood-700 flex items-center gap-1">
                              <Edit className="w-4 h-4" /> 한줄 묵상
                            </p>
                            {editingMeditationId === reading.id ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleUpdateMeditation(reading.id)}
                                  disabled={savingMeditation}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                                  title="저장"
                                >
                                  <Save size={16} />
                                </button>
                                <button
                                  onClick={() => setEditingMeditationId(null)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="취소"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingMeditationId(reading.id);
                                  setTempMeditation(reading.meditation || '');
                                }}
                                className="p-1 text-wood-400 hover:text-wood-600 hover:bg-wood-100 rounded transition-colors"
                                title="수정"
                              >
                                <Edit size={14} />
                              </button>
                            )}
                          </div>
                          
                          {editingMeditationId === reading.id ? (
                            <textarea
                              value={tempMeditation}
                              onChange={(e) => setTempMeditation(e.target.value)}
                              className="w-full bg-white border border-wood-200 rounded-lg p-3 text-sm text-wood-800 focus:ring-2 focus:ring-wood-500 outline-none resize-none"
                              rows={2}
                              placeholder="묵상을 입력하세요..."
                              autoFocus
                            />
                          ) : (
                            <p className="text-wood-800 text-sm whitespace-pre-wrap">
                              {reading.meditation}
                            </p>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingMeditationId(reading.id);
                            setTempMeditation('');
                          }}
                          className="mt-3 text-xs text-wood-400 hover:text-wood-600 flex items-center gap-1"
                        >
                          <Plus size={12} /> 묵상 기록하기
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-wood-500">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-wood-300" />
                <p>성경 읽기 기록이 없습니다.</p>
                <Link to="/archive/today" className="inline-block mt-4 text-gold-600 hover:underline">
                  오늘의 말씀 보러가기
                </Link>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
