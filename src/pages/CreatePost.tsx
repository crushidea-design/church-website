import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, setDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
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
  }, [type]);

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

  if ((type === 'research' || type === 'sermon') && role !== 'admin') {
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
        authorId: user.uid,
        authorName: user.displayName || '익명',
        commentCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

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
