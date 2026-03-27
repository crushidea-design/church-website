import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, orderBy, getDocs, deleteField, setDoc, deleteDoc, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { ArrowLeft, Loader2, FileText, X, Plus } from 'lucide-react';

interface SermonCategory {
  id: string;
  name: string;
}

interface ResearchCategory {
  id: string;
  name: string;
}

export default function EditPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('');
  const [subCategory, setSubCategory] = useState('general');
  const [sermonCategoryId, setSermonCategoryId] = useState('');
  const [sermonCategories, setSermonCategories] = useState<SermonCategory[]>([]);
  const [researchCategoryId, setResearchCategoryId] = useState('');
  const [researchCategories, setResearchCategories] = useState<ResearchCategory[]>([]);
  const [existingPdfUrl, setExistingPdfUrl] = useState('');
  const [existingPdfName, setExistingPdfName] = useState('');
  const [existingPdfBase64, setExistingPdfBase64] = useState('');
  const [existingPdfChunkCount, setExistingPdfChunkCount] = useState(0);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [removeExistingPdf, setRemoveExistingPdf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPost = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'posts', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTitle(data.title);
          setContent(data.content);
          setType(data.category);
          setSubCategory(data.subCategory || 'general');
          setSermonCategoryId(data.sermonCategoryId || '');
          setResearchCategoryId(data.researchCategoryId || '');
          setExistingPdfUrl(data.pdfUrl || '');
          setExistingPdfName(data.pdfName || '');
          setExistingPdfBase64(data.pdfBase64 || '');
          setExistingPdfChunkCount(data.pdfChunkCount || 0);
          
          // Check permission: only author or admin can edit
          if (!authLoading && user) {
            if (user.uid !== data.authorId && role !== 'admin') {
              alert('수정 권한이 없습니다.');
              navigate(-1);
            }
          }
        } else {
          alert('게시글을 찾을 수 없습니다.');
          navigate(-1);
        }
      } catch (error) {
        console.error('Error fetching post:', error);
        handleFirestoreError(error, OperationType.GET, `posts/${id}`);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchPost();
    }
  }, [id, user, role, authLoading, navigate]);

  useEffect(() => {
    if (type === 'sermon') {
      const fetchCategories = async () => {
        try {
          const q = query(collection(db, 'sermon_categories'), orderBy('order', 'asc'));
          const snapshot = await getDocs(q);
          const cats = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
          setSermonCategories(cats);
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
        } catch (error) {
          console.error('Error fetching research categories:', error);
        }
      };
      fetchCategories();
    }
  }, [type]);

  useEffect(() => {
    if (type === 'sermon' && sermonCategories.length > 0 && !sermonCategoryId) {
      setSermonCategoryId(sermonCategories[0].id);
    } else if (type === 'research' && researchCategories.length > 0 && !researchCategoryId) {
      setResearchCategoryId(researchCategories[0].id);
    }
  }, [type, sermonCategories, sermonCategoryId, researchCategories, researchCategoryId]);

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
      setRemoveExistingPdf(true); // If new file selected, we'll replace existing
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !title.trim() || !content.trim()) return;

    setError(null);
    setSubmitting(true);
    setUploadProgress(0);

    try {
      let pdfUrl = existingPdfUrl;
      let pdfName = existingPdfName;
      let pdfBase64 = existingPdfBase64;
      let pdfChunkCount = existingPdfChunkCount;

      if (removeExistingPdf) {
        pdfUrl = '';
        pdfName = '';
        pdfBase64 = '';
        pdfChunkCount = 0;
      }

      if (pdfFile) {
        console.log('--- PDF PROCESSING (UPDATE) ---');
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
        
        pdfUrl = ''; // Clear URL if using Base64
        pdfName = pdfFile.name;
        pdfChunkCount = Math.ceil(pdfBase64.length / 800000);
        setUploadProgress(40);
        console.log('Base64 conversion complete.');
      }

      const postRef = doc(db, 'posts', id);
      const updateData: any = {
        title: title.trim(),
        content: content.trim(),
        updatedAt: serverTimestamp(),
      };

      // Handle PDF fields explicitly to ensure they are cleared if needed
      if (pdfFile) {
        updateData.pdfName = pdfName;
        updateData.pdfChunkCount = pdfChunkCount;
        updateData.pdfBase64 = deleteField();
        updateData.pdfUrl = deleteField();
      } else if (removeExistingPdf) {
        updateData.pdfUrl = deleteField();
        updateData.pdfName = deleteField();
        updateData.pdfBase64 = deleteField();
        updateData.pdfChunkCount = deleteField();
      }

      if (type === 'sermon') {
        const finalCategoryId = sermonCategoryId || (sermonCategories.length > 0 ? sermonCategories[0].id : '');
        if (finalCategoryId) {
          updateData.sermonCategoryId = finalCategoryId;
          updateData.subCategory = deleteField();
        }
      }

      if (type === 'research') {
        const finalCategoryId = researchCategoryId || (researchCategories.length > 0 ? researchCategories[0].id : '');
        if (finalCategoryId) {
          updateData.researchCategoryId = finalCategoryId;
          updateData.subCategory = deleteField();
        }
      }

      console.log('Updating document in Firestore...', updateData);
      
      const updatePromise = updateDoc(postRef, updateData);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('게시글 수정 시간이 초과되었습니다. 네트워크 상태를 확인해 주세요.')), 30000)
      );

      await Promise.race([updatePromise, timeoutPromise]);
      console.log('Post updated successfully');

      if (pdfFile || removeExistingPdf) {
        const oldChunksQuery = query(collection(db, 'post_pdfs'), where('postId', '==', id));
        const oldChunksSnap = await getDocs(oldChunksQuery);
        await Promise.all(oldChunksSnap.docs.map(d => deleteDoc(d.ref)));
      }

      if (pdfFile && pdfBase64 && pdfChunkCount > 0) {
        console.log(`Uploading PDF in ${pdfChunkCount} chunks...`);
        const CHUNK_SIZE = 800000;
        for (let i = 0; i < pdfChunkCount; i++) {
          const chunk = pdfBase64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          await setDoc(doc(db, 'post_pdfs', `${id}_${i}`), {
            postId: id,
            index: i,
            data: chunk
          });
          setUploadProgress(40 + Math.round(((i + 1) / pdfChunkCount) * 60));
        }
        console.log('PDF chunks uploaded successfully.');
      }

      navigate(`/post/${id}`);
    } catch (err: any) {
      console.error('Error updating post:', err);
      const errorMessage = err.message || '게시글 수정 중 오류가 발생했습니다.';
      setError(errorMessage);
      alert(errorMessage);
      handleFirestoreError(err, OperationType.UPDATE, `posts/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wood-50">
        <Loader2 className="animate-spin h-12 w-12 text-wood-900" />
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

  const getTitle = () => {
    switch (type) {
      case 'research': return '연구글 수정';
      case 'sermon': return '말씀 서재 수정';
      case 'journal': return '개척 일지 수정';
      default: return '게시글 수정';
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
              form="edit-post-form"
              disabled={submitting || !title.trim() || !content.trim()}
              className="inline-flex items-center px-8 py-2.5 border border-transparent text-sm font-medium rounded-full shadow-sm text-white bg-wood-900 hover:bg-wood-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wood-500 transition disabled:opacity-50"
            >
              {submitting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {uploadProgress > 0 && uploadProgress < 100 ? `${uploadProgress}%` : '...'}
                </div>
              ) : '수정하기'}
            </button>
          </div>

          <form id="edit-post-form" onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
                {error}
              </div>
            )}
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

            {(type === 'research' || type === 'sermon') && (
              <div>
                <label className="block text-sm font-medium text-wood-700 mb-2">
                  PDF 파일 첨부
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-wood-300 border-dashed rounded-xl bg-wood-50 hover:bg-wood-100 transition-colors cursor-pointer relative">
                  <div className="space-y-1 text-center">
                    {((existingPdfUrl || existingPdfBase64 || existingPdfChunkCount > 0) && !removeExistingPdf) ? (
                      <div className="flex items-center justify-center space-x-2">
                        <FileText className="h-8 w-8 text-wood-600" />
                        <span className="text-sm text-wood-900 font-medium">{existingPdfName}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRemoveExistingPdf(true);
                          }}
                          className="p-1 hover:bg-wood-200 rounded-full transition"
                        >
                          <X className="h-4 w-4 text-wood-500" />
                        </button>
                      </div>
                    ) : pdfFile ? (
                      <div className="flex items-center justify-center space-x-2">
                        <FileText className="h-8 w-8 text-wood-600" />
                        <span className="text-sm text-wood-900 font-medium">{pdfFile.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPdfFile(null);
                            if (existingPdfUrl) setRemoveExistingPdf(false);
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
                  {(!pdfFile && (!existingPdfUrl && !existingPdfBase64 || removeExistingPdf)) && (
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
                placeholder="내용을 입력하세요. 유튜브 링크를 포함하면 영상이 자동 삽입됩니다."
                required
                maxLength={50000}
              />
            </div>

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
                disabled={submitting || !title.trim() || !content.trim()}
                className="inline-flex items-center px-8 py-2.5 border border-transparent text-sm font-medium rounded-full shadow-sm text-white bg-wood-900 hover:bg-wood-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wood-500 disabled:opacity-50 transition"
              >
                {submitting ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {uploadProgress > 0 && uploadProgress < 100 ? `업로드 중 (${uploadProgress}%)` : '수정 중...'}
                  </div>
                ) : '수정하기'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
