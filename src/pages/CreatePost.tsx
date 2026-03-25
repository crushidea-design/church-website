import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { ArrowLeft } from 'lucide-react';

export default function CreatePost() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'community';
  const { user, role } = useAuth();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    try {
      const postData = {
        title: title.trim(),
        content: content.trim(),
        category: type,
        author_id: user.uid,
        author_name: user.displayName || '익명',
        comment_count: 0
      };

      const { data, error } = await supabase
        .from('posts')
        .insert([postData])
        .select()
        .single();

      if (error) throw error;

      navigate(`/post/${data.id}`);
    } catch (error) {
      console.error('Error creating post:', error);
      alert('게시글 등록 중 오류가 발생했습니다.');
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
              <div className="flex justify-between items-end mb-2">
                <label htmlFor="content" className="block text-sm font-medium text-wood-700">
                  내용
                </label>
                <span className="text-xs text-wood-500">
                  유튜브 영상 링크(youtube.com 또는 youtu.be)를 본문에 넣으면 자동으로 영상이 재생됩니다.
                </span>
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
