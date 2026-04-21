import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, orderBy, getDocs, deleteField, setDoc, deleteDoc, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { useStore } from '../store/useStore';
import { ArrowLeft, Loader2, FileText, X, Plus } from 'lucide-react';
import { generateSortOrder } from '../lib/sortUtils';
import {
  inferNextGenerationTopicId,
  NEXT_GENERATION_TOPIC_OPTIONS,
  supportsNextGenerationTopic,
} from '../lib/nextGenerationTopics';
import {
  formatFileSize,
  getFirstPdfAttachment,
  getMaterialAttachmentLabel,
  getPostAttachments,
  MATERIAL_FILE_ACCEPT,
  MaterialAttachment,
  serializeMaterialAttachments,
  uploadMaterialFiles,
  validateMaterialFiles,
} from '../lib/attachments';

interface SermonCategory {
  id: string;
  name: string;
}

interface ResearchCategory {
  id: string;
  name: string;
}

const getLocalDateKey = (date = new Date()) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().split('T')[0];
};

const getDateFromFirestoreValue = (value: any) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

interface EditPostProps {
  postId?: string;
  nextGenerationMode?: boolean;
}

export default function EditPost({ postId, nextGenerationMode = false }: EditPostProps = {}) {
  const { id: routeId } = useParams();
  const id = postId || routeId;
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('');
  const isNextGeneration = nextGenerationMode || type === 'next_generation';
  const [dateKey, setDateKey] = useState('');
  const [subCategory, setSubCategory] = useState('general');
  const [nextGenerationTopicId, setNextGenerationTopicId] = useState(NEXT_GENERATION_TOPIC_OPTIONS[0].id);
  const [sermonCategoryId, setSermonCategoryId] = useState('');
  const [sermonCategories, setSermonCategories] = useState<SermonCategory[]>([]);
  const [researchCategoryId, setResearchCategoryId] = useState('');
  const [researchCategories, setResearchCategories] = useState<ResearchCategory[]>([]);
  const [existingPdfUrl, setExistingPdfUrl] = useState('');
  const [existingPdfName, setExistingPdfName] = useState('');
  const [existingPdfBase64, setExistingPdfBase64] = useState('');
  const [existingPdfChunkCount, setExistingPdfChunkCount] = useState(0);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [existingAttachments, setExistingAttachments] = useState<MaterialAttachment[]>([]);
  const [materialFiles, setMaterialFiles] = useState<File[]>([]);
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
          let fullContent = data.content;

          // Handle long content reassembly for editing
          if (data.isLongContent) {
            console.log('Long content detected in edit. Fetching chunks...');
            try {
              const chunksQuery = query(
                collection(db, 'post_contents'),
                where('postId', '==', id),
                orderBy('index', 'asc')
              );
              const chunksSnap = await getDocs(chunksQuery);
              if (!chunksSnap.empty) {
                fullContent = chunksSnap.docs.map(doc => doc.data().content).join('');
                console.log('Long content reassembled for editing.');
              }
            } catch (e) {
              console.error('Error reassembling long content for editing:', e);
            }
          }

          setTitle(data.title);
          setContent(fullContent);
          setType(data.category);
          setDateKey(data.dateKey || getLocalDateKey(getDateFromFirestoreValue(data.createdAt) || new Date()));
          setSubCategory(data.subCategory || 'general');
          setNextGenerationTopicId(inferNextGenerationTopicId({ ...data, content: fullContent }));
          setSermonCategoryId(data.sermonCategoryId || '');
          setResearchCategoryId(data.researchCategoryId || '');
          setExistingPdfUrl(data.pdfUrl || '');
          setExistingPdfName(data.pdfName || '');
          setExistingPdfBase64(data.pdfBase64 || '');
          setExistingPdfChunkCount(data.pdfChunkCount || 0);
          setExistingAttachments(getPostAttachments(data));
          
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
    if (isNextGeneration) {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const validationError = validateMaterialFiles(files, existingAttachments.length + materialFiles.length);
      if (validationError) {
        alert(validationError);
        e.target.value = '';
        return;
      }

      setMaterialFiles((currentFiles) => [...currentFiles, ...files]);
      setError(null);
      e.target.value = '';
      return;
    }

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

  const removeExistingAttachment = (indexToRemove: number) => {
    setExistingAttachments((currentAttachments) => (
      currentAttachments.filter((_, index) => index !== indexToRemove)
    ));
  };

  const removeMaterialFile = (indexToRemove: number) => {
    setMaterialFiles((currentFiles) => currentFiles.filter((_, index) => index !== indexToRemove));
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
      let nextGenerationAttachments = existingAttachments;

      if (isNextGeneration) {
        const uploadedAttachments = await uploadMaterialFiles(storage, materialFiles, setUploadProgress);
        nextGenerationAttachments = [...existingAttachments, ...uploadedAttachments];
        const firstPdfAttachment = getFirstPdfAttachment(nextGenerationAttachments);
        pdfUrl = firstPdfAttachment?.url || '';
        pdfName = firstPdfAttachment?.name || '';
      } else {
        if (removeExistingPdf) {
          pdfUrl = '';
          pdfName = '';
        }

        if (pdfFile) {
          console.log('--- PDF PROCESSING (UPDATE) ---');
          console.log('File:', { name: pdfFile.name, size: pdfFile.size });

          if (pdfFile.size > 2 * 1024 * 1024) {
            throw new Error('파일 크기는 2MB를 초과할 수 없습니다.');
          }

          console.log('Uploading PDF to Storage...');
          setUploadProgress(20);
          
          const fileRef = ref(storage, `pdfs/${Date.now()}_${pdfFile.name}`);
          await uploadBytes(fileRef, pdfFile);
          setUploadProgress(60);
          
          pdfUrl = await getDownloadURL(fileRef);
          pdfName = pdfFile.name;
          setUploadProgress(80);
          console.log('PDF upload complete. URL:', pdfUrl);
        }
      }

      const postRef = doc(db, 'posts', id);
      const updateData: any = {
        title: title.trim(),
        content: content.trim(),
        sortOrder: generateSortOrder(title.trim()),
        updatedAt: serverTimestamp(),
      };

      if (type === 'today_word') {
        updateData.dateKey = dateKey || getLocalDateKey();
      }

      // Handle long content for Datastore mode
      const isLongContent = new TextEncoder().encode(content).length > 1400;
      if (isLongContent) {
        console.log('Content is long in edit, splitting into chunks...');
        updateData.content = content.substring(0, 400); // Snippet
        updateData.isLongContent = true;
        updateData.fullContentLength = content.length;
      } else {
        updateData.isLongContent = deleteField();
        updateData.fullContentLength = deleteField();
      }

      // Handle attachment fields explicitly to ensure they are cleared if needed
      if (isNextGeneration) {
        updateData.subCategory = subCategory;

        if (nextGenerationAttachments.length > 0) {
          updateData.pdfBase64 = serializeMaterialAttachments(nextGenerationAttachments);
        } else {
          updateData.pdfBase64 = deleteField();
        }

        updateData.attachments = deleteField();

        if (pdfUrl) {
          updateData.pdfName = pdfName;
          updateData.pdfUrl = pdfUrl;
        } else {
          updateData.pdfUrl = deleteField();
          updateData.pdfName = deleteField();
        }

        updateData.pdfChunkCount = deleteField();

        if (supportsNextGenerationTopic(subCategory)) {
          updateData.nextGenerationTopicId = nextGenerationTopicId;
        } else {
          updateData.nextGenerationTopicId = deleteField();
        }
      } else if (pdfFile) {
        updateData.pdfName = pdfName;
        updateData.pdfUrl = pdfUrl;
        updateData.pdfBase64 = deleteField();
        updateData.pdfChunkCount = deleteField();
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
      
      const runUpdate = async (payload: any) => {
        const updatePromise = updateDoc(postRef, payload);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('게시글 수정 시간이 초과되었습니다. 네트워크 상태를 확인해 주세요.')), 30000)
        );

        await Promise.race([updatePromise, timeoutPromise]);
      };

      try {
        await runUpdate(updateData);
      } catch (updateError: any) {
        const shouldRetryWithoutTopic =
          updateError?.code === 'permission-denied' && 'nextGenerationTopicId' in updateData;

        if (!shouldRetryWithoutTopic) {
          throw updateError;
        }

        const fallbackUpdateData = { ...updateData };
        delete fallbackUpdateData.nextGenerationTopicId;
        await runUpdate(fallbackUpdateData);
      }
      console.log('Post updated successfully');

      // Handle long content chunks update
      if (isLongContent) {
        // Delete old chunks first
        const oldChunksQuery = query(collection(db, 'post_contents'), where('postId', '==', id));
        const oldChunksSnap = await getDocs(oldChunksQuery);
        await Promise.all(oldChunksSnap.docs.map(d => deleteDoc(d.ref)));

        console.log('Uploading new full content chunks...');
        const FULL_CHUNK_SIZE = 10000;
        const chunks = [];
        for (let i = 0; i < content.length; i += FULL_CHUNK_SIZE) {
          chunks.push(content.substring(i, i + FULL_CHUNK_SIZE));
        }
        
        for (let i = 0; i < chunks.length; i++) {
          await setDoc(doc(db, 'post_contents', `${id}_${i}`), {
            postId: id,
            index: i,
            content: chunks[i],
            createdAt: serverTimestamp()
          });
        }
        console.log('Full content chunks updated.');
      } else {
        // If not long anymore, delete any existing chunks
        const oldChunksQuery = query(collection(db, 'post_contents'), where('postId', '==', id));
        const oldChunksSnap = await getDocs(oldChunksQuery);
        if (!oldChunksSnap.empty) {
          await Promise.all(oldChunksSnap.docs.map(d => deleteDoc(d.ref)));
        }
      }

      // Update latest posts summary for Home page optimization
      try {
        const summaryRef = doc(db, 'settings', 'latest_posts_summary');
        const summarySnap = await getDoc(summaryRef);
        if (summarySnap.exists()) {
          const summaryData = summarySnap.data();
          // Only update if this post IS the one currently in the summary for its category
          if (summaryData[type]?.id === id) {
            const postSummary = {
              id: id,
              title: title.trim(),
              content: content.trim().substring(0, 500),
              category: type,
              subCategory: subCategory,
              sermonCategoryId: updateData.sermonCategoryId || sermonCategoryId || null,
              researchCategoryId: updateData.researchCategoryId || researchCategoryId || null,
              createdAt: summaryData[type].createdAt, // Keep original creation date
              authorName: user?.displayName || '익명'
            };
            await updateDoc(summaryRef, {
              [type]: postSummary,
              updatedAt: serverTimestamp()
            });
            console.log('Latest posts summary updated (edited post was the latest).');
          }
        }
      } catch (summaryErr) {
        console.error('Error updating latest posts summary on edit:', summaryErr);
      }

      if (!isNextGeneration && (pdfFile || removeExistingPdf)) {
        const oldChunksQuery = query(collection(db, 'post_pdfs'), where('postId', '==', id));
        const oldChunksSnap = await getDocs(oldChunksQuery);
        await Promise.all(oldChunksSnap.docs.map(d => deleteDoc(d.ref)));
      }

      const { invalidateCache } = useStore.getState();
      if (type === 'journal' || type === 'community' || type === 'sermon' || type === 'research' || type === 'today_word') {
        const cacheKey = type === 'sermon' ? 'sermons' : type;
        invalidateCache(cacheKey as any);
      }
      invalidateCache('home');
      localStorage.removeItem('home_latest_posts_cache');

      navigate(isNextGeneration ? `/next/post/${id}` : `/post/${id}`);
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
      case 'today_word': return '묵상 가이드 수정';
      case 'next_generation': return '다음세대 자료 수정';
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

            {type === 'today_word' && (
              <div>
                <label htmlFor="dateKey" className="block text-sm font-medium text-wood-700 mb-2">
                  묵상 날짜
                </label>
                <input
                  type="date"
                  id="dateKey"
                  value={dateKey}
                  onChange={(e) => setDateKey(e.target.value)}
                  className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50"
                  required
                />
              </div>
            )}

            {(type === 'research' || type === 'sermon' || isNextGeneration) && (
              <div>
                <label className="block text-sm font-medium text-wood-700 mb-2">
                  {isNextGeneration ? '자료 파일 첨부' : 'PDF 파일 첨부'}
                </label>
                <div className="mt-1 rounded-xl border-2 border-dashed border-wood-300 bg-wood-50 px-6 pt-5 pb-6 transition-colors hover:bg-wood-100">
                  {isNextGeneration ? (
                    <div>
                      <div className="space-y-1 text-center">
                        <FileText className="mx-auto h-12 w-12 text-wood-400" />
                        <div className="flex justify-center text-sm text-wood-600">
                          <label
                            htmlFor="file-upload"
                            className="relative cursor-pointer rounded-md font-medium text-wood-900 hover:text-wood-700 focus-within:outline-none"
                          >
                            <span>PDF/PPT 파일 업로드</span>
                            <input
                              id="file-upload"
                              name="file-upload"
                              type="file"
                              className="sr-only"
                              accept={MATERIAL_FILE_ACCEPT}
                              multiple
                              onChange={handleFileChange}
                            />
                          </label>
                        </div>
                        <p className="text-xs text-wood-500">여러 파일 선택 가능, 파일당 최대 20MB</p>
                      </div>

                      {(existingAttachments.length > 0 || materialFiles.length > 0) && (
                        <ul className="mt-5 space-y-2">
                          {existingAttachments.map((attachment, index) => (
                            <li
                              key={`${attachment.url}-${index}`}
                              className="flex flex-col gap-3 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <span className="flex items-center gap-3 text-sm font-medium text-wood-900">
                                <FileText className="h-5 w-5 shrink-0 text-wood-600" />
                                <span>
                                  <span className="mr-2 rounded-md bg-wood-100 px-2 py-1 text-xs font-bold">
                                    {getMaterialAttachmentLabel(attachment)}
                                  </span>
                                  {attachment.name}
                                  {attachment.size && (
                                    <span className="ml-2 text-xs text-wood-500">{formatFileSize(attachment.size)}</span>
                                  )}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => removeExistingAttachment(index)}
                                className="inline-flex w-fit items-center rounded-lg px-3 py-2 text-xs font-bold text-wood-600 transition hover:bg-red-50 hover:text-red-700"
                              >
                                <X className="mr-1 h-4 w-4" />
                                제거
                              </button>
                            </li>
                          ))}
                          {materialFiles.map((file, index) => (
                            <li
                              key={`${file.name}-${file.lastModified}-${index}`}
                              className="flex flex-col gap-3 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <span className="flex items-center gap-3 text-sm font-medium text-wood-900">
                                <FileText className="h-5 w-5 shrink-0 text-wood-600" />
                                <span>
                                  {file.name}
                                  <span className="ml-2 text-xs text-wood-500">{formatFileSize(file.size)}</span>
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => removeMaterialFile(index)}
                                className="inline-flex w-fit items-center rounded-lg px-3 py-2 text-xs font-bold text-wood-600 transition hover:bg-red-50 hover:text-red-700"
                              >
                                <X className="mr-1 h-4 w-4" />
                                제거
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <div className="relative flex justify-center">
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
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          accept=".pdf"
                          onChange={handleFileChange}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isNextGeneration && supportsNextGenerationTopic(subCategory) && (
              <div>
                <label htmlFor="nextGenerationTopicId" className="block text-sm font-medium text-wood-700 mb-2">
                  주제 폴더
                </label>
                <select
                  id="nextGenerationTopicId"
                  value={nextGenerationTopicId}
                  onChange={(e) => setNextGenerationTopicId(e.target.value)}
                  className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50"
                >
                  {NEXT_GENERATION_TOPIC_OPTIONS.map((topic) => (
                    <option key={topic.id} value={topic.id}>{topic.name}</option>
                  ))}
                </select>
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
