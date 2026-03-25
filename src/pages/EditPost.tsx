import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function EditPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('');
  const [subCategory, setSubCategory] = useState('general');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !title.trim() || !content.trim()) return;

    setSubmitting(true);
    try {
      const postRef = doc(db, 'posts', id);
      const updateData: any = {
        title: title.trim(),
        content: content.trim(),
        updatedAt: serverTimestamp()
      };

      if ((type === 'research' || type === 'sermon') && subCategory) {
        updateData.subCategory = subCategory;
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
            게시글 수정
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
