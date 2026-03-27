import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, orderBy, getDocs, deleteField } from 'firebase/firestore';
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
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [removeExistingPdf, setRemoveExistingPdf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert('파일 크기는 10MB를 초과할 수 없습니다.');
        return;
      }
      setPdfFile(file);
      setRemoveExistingPdf(true); // If new file selected, we'll replace existing
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !title.trim() || !content.trim()) return;

    setSubmitting(true);
    try {
      let pdfUrl = existingPdfUrl;
      let pdfName = existingPdfName;

      if (removeExistingPdf) {
        pdfUrl = '';
        pdfName = '';
      }

      if (pdfFile) {
        const storageRef = ref(storage, `pdfs/${Date.now()}_${pdfFile.name}`);
        const uploadResult = await uploadBytes(storageRef, pdfFile);
        pdfUrl = await getDownloadURL(uploadResult.ref);
        pdfName = pdfFile.name;
      }

      const postRef = doc(db, 'posts', id);
      const updateData: any = {
        title: title.trim(),
        content: content.trim(),
        updatedAt: serverTimestamp(),
        pdfUrl,
        pdfName
      };

      if (type === 'sermon') {
        // Ensure sermonCategoryId is set, fallback to first category if still empty
        const finalCategoryId = sermonCategoryId || (sermonCategories.length > 0 ? sermonCategories[0].id : '');
        if (finalCategoryId) {
          updateData.sermonCategoryId = finalCategoryId;
          // Remove legacy subCategory if it exists to avoid conflicts and validation errors
          updateData.subCategory = deleteField();
        }
      }

      if (type === 'research') {
        const finalCategoryId = researchCategoryId || (researchCategories.length > 0 ? researchCategories[0].id : '');
        if (finalCategoryId) {
          updateData.researchCategoryId = finalCategoryId;
          // Remove legacy subCategory if it exists
          updateData.subCategory = deleteField();
        }
      }

      await updateDoc(postRef, updateData);
      navigate(`/post/${id}`);
    } catch (error) {
      console.error('Error updating post:', error);
      alert('게시글 수정 중 오류가 발생했습니다.');
      handleFirestoreError(error, OperationType.UPDATE, `posts/${id}`);
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
          <h1 className="text-3xl font-serif font-bold text-wood-900 mb-8">
            {getTitle()}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
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
                    {(existingPdfUrl && !removeExistingPdf) ? (
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
                        <p className="text-xs text-wood-500">PDF up to 10MB</p>
                      </>
                    )}
                  </div>
                  {(!pdfFile && (!existingPdfUrl || removeExistingPdf)) && (
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
                {submitting ? '수정 중...' : '수정하기'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
