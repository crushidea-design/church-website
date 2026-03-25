import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { ArrowLeft, FileText, X } from 'lucide-react';

export default function CreatePost() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'community';
  const { user, role } = useAuth();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subCategory, setSubCategory] = useState(type === 'sermon' ? 'past_sermons' : 'general');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert('파일 크기는 10MB를 초과할 수 없습니다.');
        return;
      }
      setPdfFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    try {
      let pdfUrl = '';
      if (pdfFile) {
        const storageRef = ref(storage, `pdfs/${Date.now()}_${pdfFile.name}`);
        const uploadResult = await uploadBytes(storageRef, pdfFile);
        pdfUrl = await getDownloadURL(uploadResult.ref);
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

      if (pdfUrl) {
        postData.pdfUrl = pdfUrl;
        postData.pdfName = pdfFile?.name;
      }

      if ((type === 'research' || type === 'sermon') && subCategory) {
        postData.subCategory = subCategory;
      }

      const docRef = await addDoc(collection(db, 'posts'), postData);
      navigate(`/post/${docRef.id}`);
    } catch (error) {
      console.error('Error creating post:', error);
      alert('게시글 등록 중 오류가 발생했습니다.');
      handleFirestoreError(error, OperationType.CREATE, 'posts');
    } finally {
      setSubmitting(false);
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'research': return '연구글 작성';
      case 'sermon': return '말씀 서재 등록';
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
          <h1 className="text-3xl font-serif font-bold text-wood-900 mb-8">
            {getTitle()}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {(type === 'research' || type === 'sermon') && (
              <div>
                <label htmlFor="subCategory" className="block text-sm font-medium text-wood-700 mb-2">
                  분류
                </label>
                <select
                  id="subCategory"
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-3 bg-wood-50"
                >
                  {type === 'research' ? (
                    <>
                      <option value="worship">예배</option>
                      <option value="preaching">설교</option>
                      <option value="pastoring">목양</option>
                      <option value="governing">치리</option>
                      <option value="general">일반</option>
                    </>
                  ) : (
                    <>
                      <option value="past_sermons">지난 설교들</option>
                      <option value="pilgrims_progress">천로역정</option>
                    </>
                  )}
                </select>
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
                        <p className="text-xs text-wood-500">PDF up to 10MB</p>
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
                {submitting ? '등록 중...' : '등록하기'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
