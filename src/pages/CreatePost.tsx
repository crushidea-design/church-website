import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, setDoc, doc, getDoc, where, getCountFromServer } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { useStore } from '../store/useStore';
import { sendPushNotification } from '../services/notificationService';
import { ArrowLeft, FileText, X, Plus } from 'lucide-react';

interface SermonCategory {
  id: string;
  name: string;
}

interface ResearchCategory {
  id: string;
  name: string;
}

export default function CreatePost() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'community';
  const { user, role, loading: authLoading } = useAuth();
  const { invalidateCache } = useStore();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [journalDate, setJournalDate] = useState(new Date().toISOString().split('T')[0]);
  const [subCategory, setSubCategory] = useState(searchParams.get('subCategory') || (type === 'sermon' ? 'past_sermons' : 'general'));
  const [sermonCategoryId, setSermonCategoryId] = useState('');
  const [sermonCategories, setSermonCategories] = useState<SermonCategory[]>([]);
  const [researchCategoryId, setResearchCategoryId] = useState('');
  const [researchCategories, setResearchCategories] = useState<ResearchCategory[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [targetUserIds, setTargetUserIds] = useState<string[]>([]);
  const [fcmUsers, setFcmUsers] = useState<{uid: string, displayName: string, email: string}[]>([]);
  const [loadingFcmUsers, setLoadingFcmUsers] = useState(false);
  const [isAllMembers, setIsAllMembers] = useState(true);
  const [tokenCount, setTokenCount] = useState(0);

  useEffect(() => {
    if (type === 'sermon') {
      const fetchCategories = async () => {
        try {
          const q = query(collection(db, 'sermon_categories'), orderBy('order', 'asc'));
          const snapshot = await getDocs(q);
          const cats = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
          setSermonCategories(cats);
          
          const paramCategoryId = searchParams.get('categoryId');
          if (paramCategoryId && cats.some(c => c.id === paramCategoryId)) {
            setSermonCategoryId(paramCategoryId);
          } else if (cats.length > 0) {
            setSermonCategoryId(cats[0].id);
          }
        } catch (error) {
          console.error('Error fetching sermon categories:', error);
        }
      };
      fetchCategories();
    } else if (type === 'research') {
      const fetchCategories = async () => {
        try {
          const q = query(collection(db, 'research_categories'), orderBy('order', 'asc'));
          const snapshot = await getDocs(q);
          const cats = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
          setResearchCategories(cats);
          
          const paramCategoryId = searchParams.get('categoryId');
          if (paramCategoryId && cats.some(c => c.id === paramCategoryId)) {
            setResearchCategoryId(paramCategoryId);
          } else if (cats.length > 0) {
            setResearchCategoryId(cats[0].id);
          }
        } catch (error) {
          console.error('Error fetching research categories:', error);
        }
      };
      fetchCategories();
    }
    
    // Fetch token count for Today's Word
    if (type === 'today_word' && role === 'admin') {
      const fetchTokenCount = async () => {
        try {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const tokensQuery = query(
            collection(db, 'fcm_tokens'),
            where('updatedAt', '>=', thirtyDaysAgo)
          );
          const countSnap = await getCountFromServer(tokensQuery);
          setTokenCount(countSnap.data().count);
        } catch (err) {
          console.error('Error fetching token count:', err);
        }
      };
      fetchTokenCount();
    }
  }, [type, role]);

  const fetchFcmUsers = async () => {
    if (fcmUsers.length > 0 || loadingFcmUsers) return;
    
    setLoadingFcmUsers(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const tokensQuery = query(
        collection(db, 'fcm_tokens'),
        where('updatedAt', '>=', thirtyDaysAgo)
      );
      const tokensSnap = await getDocs(tokensQuery);
      const uidsWithTokens = Array.from(new Set(tokensSnap.docs.map(doc => doc.data().userId).filter(Boolean)));
      
      if (uidsWithTokens.length > 0) {
        // Optimization: Only fetch users that have tokens, in chunks of 30 due to Firestore 'in' limit
        const users: any[] = [];
        for (let i = 0; i < uidsWithTokens.length; i += 30) {
          const chunk = uidsWithTokens.slice(i, i + 30);
          const usersQuery = query(collection(db, 'users'), where('uid', 'in', chunk));
          const usersSnap = await getDocs(usersQuery);
          users.push(...usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
        }
        setFcmUsers(users);
      }
    } catch (err) {
      console.error('Error fetching FCM users:', err);
    } finally {
      setLoadingFcmUsers(false);
    }
  };

  useEffect(() => {
    if (type === 'today_word' && !isAllMembers) {
      fetchFcmUsers();
    }
  }, [type, isAllMembers]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wood-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wood-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wood-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-wood-900 mb-4">로그인이 필요합니다</h2>
          <button onClick={() => navigate(-1)} className="text-wood-600 hover:underline">돌아가기</button>
        </div>
      </div>
    );
  }

  if ((type === 'research' || type === 'sermon' || type === 'today_word') && role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wood-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-wood-900 mb-4">권한이 없습니다</h2>
          <p className="text-wood-600 mb-4">이 게시판은 관리자(목회자)만 작성할 수 있습니다.</p>
          <button onClick={() => navigate(-1)} className="text-wood-600 hover:underline">돌아가기</button>
        </div>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        alert('PDF 파일만 업로드 가능합니다.');
        return;
      }
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        alert('파일 크기는 2MB를 초과할 수 없습니다.');
        return;
      }
      setPdfFile(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    setError(null);
    setUploadProgress(0);
    console.log('Starting post creation...', { type, title, contentLen: content.length, online: navigator.onLine });

    if (!navigator.onLine) {
      setError('인터넷 연결이 끊어져 있습니다. 네트워크 상태를 확인해 주세요.');
      setSubmitting(false);
      return;
    }

    if (!title.trim()) {
      setError('제목을 입력해 주세요.');
      setSubmitting(false);
      return;
    }
    if (!content.trim()) {
      setError('내용을 입력해 주세요.');
      setSubmitting(false);
      return;
    }

    if (type === 'sermon' && sermonCategories.length === 0) {
      setError('영상을 등록하려면 먼저 카테고리를 생성해야 합니다.');
      setSubmitting(false);
      return;
    }

    if (type === 'research' && researchCategories.length === 0) {
      setError('연구글을 등록하려면 먼저 카테고리를 생성해야 합니다.');
      setSubmitting(false);
      return;
    }

    try {
      let pdfBase64 = '';
      
      if (pdfFile) {
        console.log('--- PDF PROCESSING ---');
        console.log('File:', { name: pdfFile.name, size: pdfFile.size });

        if (pdfFile.size > 2 * 1024 * 1024) {
          throw new Error('파일 크기는 2MB를 초과할 수 없습니다.');
        }

        console.log('Converting PDF to Base64...');
        setUploadProgress(20);
        
        pdfBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(pdfFile);
        });
        
        setUploadProgress(40);
        console.log('Base64 conversion complete. Length:', pdfBase64.length);
      }

      const postData: any = {
        title: title.trim(),
        content: content.trim(),
        category: type,
        subCategory: subCategory,
        authorId: user.uid,
        authorName: user.displayName || '익명',
        commentCount: 0,
        viewCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (type === 'today_word' && isScheduled && scheduledDate && scheduledTime) {
        const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
        if (scheduledDateTime > new Date()) {
          postData.scheduledAt = scheduledDateTime;
          postData.isPublished = false;
        } else {
          postData.isPublished = true;
        }
      } else {
        postData.isPublished = true;
      }

      if (type === 'today_word' && !isAllMembers && targetUserIds.length > 0) {
        postData.targetUserIds = targetUserIds;
      }

      if (pdfBase64) {
        postData.pdfName = pdfFile?.name;
        postData.pdfChunkCount = Math.ceil(pdfBase64.length / 800000);
      }

      if (type === 'journal' && journalDate) {
        // Convert local date string to a Date object at noon to avoid timezone issues
        const [year, month, day] = journalDate.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day, 12, 0, 0);
        postData.journalDate = dateObj;
      }

      if (type === 'sermon') {
        const finalCategoryId = sermonCategoryId || (sermonCategories.length > 0 ? sermonCategories[0].id : '');
        if (finalCategoryId) {
          postData.sermonCategoryId = finalCategoryId;
        }
      }

      if (type === 'research') {
        const finalCategoryId = researchCategoryId || (researchCategories.length > 0 ? researchCategories[0].id : '');
        if (finalCategoryId) {
          postData.researchCategoryId = finalCategoryId;
        }
      }

      console.log('Adding document to Firestore...', postData);
      
      // Use a timeout for Firestore operation
      const addDocPromise = addDoc(collection(db, 'posts'), postData);
      const firestoreTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('게시글 등록 시간이 초과되었습니다. 네트워크 상태를 확인해 주세요.')), 30000)
      );

      console.log('Awaiting addDoc...');
      const docRef = (await Promise.race([addDocPromise, firestoreTimeoutPromise])) as any;
      console.log('Post created successfully with ID:', docRef.id);
      
      // Send push notification for Today's Word if not scheduled
      if (type === 'today_word' && postData.isPublished) {
        try {
          console.log('Sending push notification for Today\'s Word...');
          await sendPushNotification(
            '오늘의 말씀 가이드라인이 올라왔습니다!',
            title.trim(),
            `/archive/today`,
            postData.targetUserIds
          );
          console.log('Push notification sent.');
        } catch (pushErr) {
          console.error('Error sending push notification:', pushErr);
        }
      }
      
      // Invalidate cache for the created category and home page
      if (type === 'journal' || type === 'community' || type === 'sermon' || type === 'research' || type === 'today_word') {
        const cacheKey = type === 'sermon' ? 'sermons' : type;
        invalidateCache(cacheKey as any);
      }
      invalidateCache('home');
      
      // Update latest posts summary for Home page optimization
      try {
        const summaryRef = doc(db, 'settings', 'latest_posts_summary');
        const summarySnap = await getDoc(summaryRef);
        const currentSummary = summarySnap.exists() ? summarySnap.data() : {};
        
        const postSummary = {
          id: docRef.id,
          title: title.trim(),
          content: content.trim().substring(0, 500), // Store a snippet
          category: type,
          subCategory: subCategory,
          createdAt: new Date().toISOString(), // Use ISO string for summary to avoid timestamp issues in simple doc
          authorName: user.displayName || '익명'
        };

        await setDoc(summaryRef, {
          ...currentSummary,
          [type]: postSummary,
          updatedAt: serverTimestamp()
        }, { merge: true });
        console.log('Latest posts summary updated.');
      } catch (summaryErr) {
        console.error('Error updating latest posts summary:', summaryErr);
        // Don't fail the whole post creation if summary update fails
      }
      
      if (pdfBase64 && postData.pdfChunkCount) {
        console.log(`Uploading PDF in ${postData.pdfChunkCount} chunks...`);
        const CHUNK_SIZE = 800000;
        for (let i = 0; i < postData.pdfChunkCount; i++) {
          const chunk = pdfBase64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          await setDoc(doc(db, 'post_pdfs', `${docRef.id}_${i}`), {
            postId: docRef.id,
            index: i,
            data: chunk
          });
          setUploadProgress(40 + Math.round(((i + 1) / postData.pdfChunkCount) * 60));
        }
        console.log('PDF chunks uploaded successfully.');
      }
      
      console.log('Navigating to post detail...');
      navigate(`/post/${docRef.id}`);
    } catch (err: any) {
      console.error('Error in handleSubmit:', err);
      const errorMessage = err.message || '게시글 등록 중 오류가 발생했습니다.';
      setError(errorMessage);
      
      // If it's a Firestore error, handle it with our utility
      if (err.code || err.message?.includes('permission')) {
        try {
          handleFirestoreError(err, OperationType.CREATE, 'posts');
        } catch (fError) {
          // handleFirestoreError throws, so we just let it be logged to console
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'research': return '연구글 작성';
      case 'sermon': return '말씀 서재 등록';
      case 'journal': return '개척 일지 작성';
      case 'today_word': return '오늘의 묵상 가이드라인 작성';
      default: return '게시글 작성';
    }
  };

  return (
    <div className="bg-wood-100 min-h-screen py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm font-medium text-wood-600 hover:text-wood-900 mb-8 transition"
        >
          <ArrowLeft size={16} className="mr-2" />
          돌아가기
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-wood-200 p-8 md:p-12">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-serif font-bold text-wood-900">
              {getTitle()}
            </h1>
            <button
              type="submit"
              form="create-post-form"
              disabled={submitting}
              className="inline-flex items-center px-8 py-2.5 border border-transparent text-sm font-medium rounded-full shadow-sm text-white bg-wood-900 hover:bg-wood-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wood-500 transition disabled:opacity-50"
            >
              {submitting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {uploadProgress > 0 && uploadProgress < 100 ? `${uploadProgress}%` : '...'}
                </div>
              ) : '등록하기'}
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start text-red-700">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{error}</p>
              </div>
            </div>
          )}

          <form id="create-post-form" onSubmit={handleSubmit} className="space-y-6">
            {type === 'research' && (
              <div>
                <label htmlFor="researchCategoryId" className="block text-sm font-medium text-wood-700 mb-2">
                  연구 분야 (카테고리)
                </label>
                <div className="flex gap-2">
                  <select
                    id="researchCategoryId"
                    value={researchCategoryId}
                    onChange={(e) => setResearchCategoryId(e.target.value)}
                    className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50"
                  >
                    {researchCategories.length === 0 ? (
                      <option value="">등록된 카테고리가 없습니다</option>
                    ) : (
                      researchCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/research-categories')}
                    className="p-3 bg-wood-100 text-wood-600 rounded-xl hover:bg-wood-200 transition"
                    title="카테고리 관리"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                {researchCategories.length === 0 && (
                  <p className="mt-2 text-sm text-amber-600">
                    먼저 카테고리를 생성해야 연구글을 등록할 수 있습니다.
                  </p>
                )}
              </div>
            )}

            {type === 'sermon' && (
              <div>
                <label htmlFor="sermonCategoryId" className="block text-sm font-medium text-wood-700 mb-2">
                  재생목록 (카테고리)
                </label>
                <div className="flex gap-2">
                  <select
                    id="sermonCategoryId"
                    value={sermonCategoryId}
                    onChange={(e) => setSermonCategoryId(e.target.value)}
                    className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50"
                  >
                    {sermonCategories.length === 0 ? (
                      <option value="">등록된 카테고리가 없습니다</option>
                    ) : (
                      sermonCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/sermon-categories')}
                    className="p-3 bg-wood-100 text-wood-600 rounded-xl hover:bg-wood-200 transition"
                    title="카테고리 관리"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                {sermonCategories.length === 0 && (
                  <p className="mt-2 text-sm text-amber-600">
                    먼저 카테고리를 생성해야 영상을 등록할 수 있습니다.
                  </p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-wood-700 mb-2">
                제목
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50"
                placeholder="제목을 입력하세요"
                required
                maxLength={200}
              />
            </div>

            {type === 'journal' && (
              <div>
                <label htmlFor="journalDate" className="block text-sm font-medium text-wood-700 mb-2">
                  일지 날짜
                </label>
                <input
                  type="date"
                  id="journalDate"
                  value={journalDate}
                  onChange={(e) => setJournalDate(e.target.value)}
                  className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50"
                  required
                />
              </div>
            )}

            {type === 'today_word' && (
              <div className="bg-wood-50 p-6 rounded-xl border border-wood-200">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-wood-900">
                    예약 발송
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={isScheduled}
                        onChange={(e) => setIsScheduled(e.target.checked)}
                      />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${isScheduled ? 'bg-wood-900' : 'bg-wood-300'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isScheduled ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                    <span className="ml-3 text-sm font-medium text-wood-700">
                      {isScheduled ? '예약 켜짐' : '예약 꺼짐'}
                    </span>
                  </label>
                </div>
                
                {isScheduled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label htmlFor="scheduledDate" className="block text-xs font-medium text-wood-500 mb-1">
                        예약 날짜
                      </label>
                      <input
                        type="date"
                        id="scheduledDate"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="block w-full rounded-lg border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-2.5 bg-white"
                        required={isScheduled}
                      />
                    </div>
                    <div>
                      <label htmlFor="scheduledTime" className="block text-xs font-medium text-wood-500 mb-1">
                        예약 시간 (정각 단위)
                      </label>
                      <select
                        id="scheduledTime"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="block w-full rounded-lg border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-2.5 bg-white"
                        required={isScheduled}
                      >
                        {Array.from({ length: 24 }).map((_, i) => {
                          const hour = i.toString().padStart(2, '0');
                          return (
                            <option key={hour} value={`${hour}:00`}>
                              {hour}:00
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                )}
                <p className="mt-3 text-xs text-wood-500">
                  예약 발송을 설정하면 지정된 시간에 게시글이 등록되고 성도들에게 알림이 발송됩니다.
                </p>

                <div className="mt-6 pt-6 border-t border-wood-200">
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-wood-900">
                      알림 대상 설정
                    </label>
                    <div className="flex bg-wood-200 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setIsAllMembers(true)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition ${isAllMembers ? 'bg-white text-wood-900 shadow-sm' : 'text-wood-600 hover:text-wood-900'}`}
                      >
                        전체
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAllMembers(false)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition ${!isAllMembers ? 'bg-white text-wood-900 shadow-sm' : 'text-wood-600 hover:text-wood-900'}`}
                      >
                        선택
                      </button>
                    </div>
                  </div>

                  {!isAllMembers && (
                    <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-white rounded-lg border border-wood-200">
                      {loadingFcmUsers ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-wood-900"></div>
                          <p className="text-xs text-wood-500">회원 목록을 불러오는 중...</p>
                        </div>
                      ) : fcmUsers.length === 0 ? (
                        <p className="text-xs text-wood-400 text-center py-4">알림 수신이 가능한 회원이 없습니다.</p>
                      ) : (
                        fcmUsers.map(u => (
                          <label key={u.uid} className="flex items-center p-2 hover:bg-wood-50 rounded-md cursor-pointer transition">
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-wood-900 border-wood-300 rounded focus:ring-wood-500"
                              checked={targetUserIds.includes(u.uid)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTargetUserIds([...targetUserIds, u.uid]);
                                } else {
                                  setTargetUserIds(targetUserIds.filter(id => id !== u.uid));
                                }
                              }}
                            />
                            <div className="ml-3">
                              <p className="text-sm font-medium text-wood-900">{u.displayName}</p>
                              <p className="text-xs text-wood-500">{u.email}</p>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-wood-500">
                    {isAllMembers ? `알림을 허용한 모든 회원(${tokenCount}명)에게 알림이 발송됩니다.` : `선택한 ${targetUserIds.length}명의 회원에게만 알림이 발송됩니다.`}
                  </p>
                </div>
              </div>
            )}

            <div>
              <div className="mb-2">
                <label htmlFor="content" className="block text-sm font-medium text-wood-700">
                  내용
                </label>
              </div>
              <textarea
                id="content"
                rows={15}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-4 bg-wood-50"
                placeholder={type === 'journal' ? "오늘의 기록을 남겨주세요." : "내용을 입력하세요. 유튜브 링크를 포함하면 영상이 자동 삽입됩니다."}
                required
                maxLength={50000}
              />
            </div>

            {(type === 'research' || type === 'sermon') && (
              <div>
                <label className="block text-sm font-medium text-wood-700 mb-2">
                  PDF 파일 첨부 (선택)
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-wood-300 border-dashed rounded-xl bg-wood-50 hover:bg-wood-100 transition-colors cursor-pointer relative">
                  <div className="space-y-1 text-center">
                    {pdfFile ? (
                      <div className="flex items-center justify-center space-x-2">
                        <FileText className="h-8 w-8 text-wood-600" />
                        <span className="text-sm text-wood-900 font-medium">{pdfFile.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPdfFile(null);
                          }}
                          className="p-1 hover:bg-wood-200 rounded-full transition"
                        >
                          <X className="h-4 w-4 text-wood-500" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <FileText className="mx-auto h-12 w-12 text-wood-400" />
                        <div className="flex text-sm text-wood-600">
                          <label
                            htmlFor="file-upload"
                            className="relative cursor-pointer rounded-md font-medium text-wood-900 hover:text-wood-700 focus-within:outline-none"
                          >
                            <span>파일 업로드</span>
                            <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".pdf" onChange={handleFileChange} />
                          </label>
                          <p className="pl-1">또는 드래그 앤 드롭</p>
                        </div>
                        <p className="text-xs text-wood-500">PDF up to 2MB</p>
                      </>
                    )}
                  </div>
                  {!pdfFile && (
                    <input
                      type="file"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      accept=".pdf"
                      onChange={handleFileChange}
                    />
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-6 border-t border-wood-100">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="mr-4 px-6 py-2.5 border border-wood-300 shadow-sm text-sm font-medium rounded-full text-wood-700 bg-white hover:bg-wood-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wood-500 transition"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center px-8 py-2.5 border border-transparent text-sm font-medium rounded-full shadow-sm text-white bg-wood-900 hover:bg-wood-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wood-500 transition disabled:opacity-50"
              >
                {submitting ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {uploadProgress > 0 && uploadProgress < 100 ? `업로드 중 (${uploadProgress}%)` : '등록 중...'}
                  </div>
                ) : '등록하기'}
              </button>
            </div>
            
            {submitting && uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-4">
                <div className="w-full bg-wood-200 rounded-full h-2.5">
                  <div 
                    className="bg-wood-600 h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-wood-500 mt-1 text-right">PDF 업로드 중... {uploadProgress}%</p>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
