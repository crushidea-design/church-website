import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { format } from 'date-fns';
import { ArrowLeft, MessageSquare, Trash2 } from 'lucide-react';

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchPostAndComments = async () => {
      try {
        // Fetch post
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .select('*')
          .eq('id', id)
          .single();

        if (postError || !postData) {
          navigate('/research');
          return;
        }
        setPost(postData);

        // Fetch comments
        const { data: commentsData, error: commentsError } = await supabase
          .from('comments')
          .select('*')
          .eq('post_id', id)
          .order('created_at', { ascending: true });

        if (!commentsError && commentsData) {
          setComments(commentsData);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPostAndComments();
  }, [id, navigate]);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim() || !id) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert([{
          post_id: id,
          content: newComment.trim(),
          author_id: user.uid,
          author_name: user.displayName || '익명'
        }])
        .select()
        .single();

      if (error) throw error;

      // Update post comment count
      await supabase.rpc('increment_comment_count', { row_id: id });

      setComments([...comments, data]);
      setPost({ ...post, comment_count: (post.comment_count || 0) + 1 });
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('댓글 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = async () => {
    if (!id || !window.confirm('정말로 이 게시글을 삭제하시겠습니까?')) return;
    
    try {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) throw error;
      navigate(-1);
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('게시글 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!id || !window.confirm('댓글을 삭제하시겠습니까?')) return;
    
    try {
      const { error } = await supabase.from('comments').delete().eq('id', commentId);
      if (error) throw error;

      // Decrement post comment count
      await supabase.rpc('decrement_comment_count', { row_id: id });

      setComments(comments.filter(c => c.id !== commentId));
      setPost({ ...post, comment_count: Math.max(0, (post.comment_count || 0) - 1) });
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('댓글 삭제 중 오류가 발생했습니다.');
    }
  };

  const renderContentWithYouTube = (text: string) => {
    // Regex to match YouTube URLs (youtube.com/watch, youtu.be, and youtube.com/shorts)
    const youtubeRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s]*)?)/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = youtubeRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex, match.index)}</span>);
      }
      
      // Add the YouTube iframe
      const videoId = match[2];
      parts.push(
        <div key={`yt-${match.index}`} className="my-8 w-full max-w-3xl mx-auto">
          <div className="aspect-video rounded-xl overflow-hidden shadow-lg bg-wood-900 mb-2">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${videoId}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
          <div className="text-right">
            <a 
              href={`https://www.youtube.com/watch?v=${videoId}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm font-medium text-wood-500 hover:text-wood-900 transition inline-flex items-center"
            >
              <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M19.812 5.418c.861.23 1.538.907 1.768 1.768C21.998 8.746 22 12 22 12s0 3.255-.418 4.814a2.504 2.504 0 0 1-1.768 1.768c-1.56.419-7.814.419-7.814.419s-6.255 0-7.814-.419a2.505 2.505 0 0 1-1.768-1.768C2 15.255 2 12 2 12s0-3.255.417-4.814a2.507 2.507 0 0 1 1.768-1.768C5.744 5 11.998 5 11.998 5s6.255 0 7.814.418ZM15.194 12 10 15V9l5.194 3Z" clipRule="evenodd" />
              </svg>
              유튜브에서 직접 보기
            </a>
          </div>
        </div>
      );
      
      lastIndex = youtubeRegex.lastIndex;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
    }
    
    return parts.length > 0 ? parts : text;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-wood-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wood-900"></div>
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="bg-wood-100 min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm font-medium text-wood-500 hover:text-wood-900 mb-8 transition"
        >
          <ArrowLeft size={16} className="mr-2" />
          목록으로 돌아가기
        </button>

        {/* Post Content */}
        <article className="bg-white rounded-2xl shadow-sm border border-wood-200 overflow-hidden mb-8">
          <div className="p-8 md:p-12">
            <div className="flex items-center justify-between mb-6">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-wood-50 text-wood-800">
                {post.category === 'research' ? '연구실' : post.category === 'sermon' ? '말씀 서재' : '소통 게시판'}
              </span>
              <div className="flex items-center text-sm text-wood-600 gap-4">
                <span>{post.author_name}</span>
                <span>&bull;</span>
                <span>{post.created_at ? format(new Date(post.created_at), 'yyyy.MM.dd HH:mm') : ''}</span>
              </div>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold text-wood-900 mb-8 leading-tight">
              {post.title}
            </h1>
            
            <div className="prose prose-stone max-w-none text-wood-700 leading-relaxed whitespace-pre-wrap">
              {renderContentWithYouTube(post.content)}
            </div>

            {(user?.uid === post.author_id || role === 'admin') && (
              <div className="mt-12 pt-6 border-t border-wood-100 flex justify-end">
                <button
                  onClick={handleDeletePost}
                  className="inline-flex items-center text-sm font-medium text-red-600 hover:text-red-800 transition"
                >
                  <Trash2 size={16} className="mr-1.5" />
                  삭제
                </button>
              </div>
            )}
          </div>
        </article>

        {/* Comments Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-wood-200 p-8 md:p-12">
          <h3 className="text-xl font-bold text-wood-900 mb-8 flex items-center">
            <MessageSquare className="mr-2 text-wood-900" />
            댓글 {post.comment_count || 0}
          </h3>

          {/* Comment Form */}
          {user ? (
            <form onSubmit={handleCommentSubmit} className="mb-10">
              <div className="mb-4">
                <label htmlFor="comment" className="sr-only">댓글 작성</label>
                <textarea
                  id="comment"
                  rows={3}
                  className="block w-full rounded-xl border-wood-300 shadow-sm focus:border-wood-500 focus:ring-wood-500 sm:text-sm p-4 bg-wood-50"
                  placeholder="댓글을 남겨주세요..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || !newComment.trim()}
                  className="inline-flex items-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-full shadow-sm text-white bg-wood-900 hover:bg-wood-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wood-500 disabled:opacity-50 transition"
                >
                  {submitting ? '등록 중...' : '댓글 등록'}
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-wood-50 rounded-xl p-6 text-center mb-10 border border-wood-100">
              <p className="text-wood-600 mb-4">댓글을 작성하려면 로그인이 필요합니다.</p>
            </div>
          )}

          {/* Comments List */}
          <div className="space-y-6">
            {comments.map((comment) => (
              <div key={comment.id} className="flex space-x-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-wood-100 flex items-center justify-center text-wood-800 font-bold text-lg">
                    {comment.author_name?.charAt(0) || '익'}
                  </div>
                </div>
                <div className="flex-grow bg-wood-50 rounded-2xl p-5 border border-wood-100">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-wood-900">{comment.author_name}</h4>
                    <span className="text-xs text-wood-500">
                      {comment.created_at ? format(new Date(comment.created_at), 'yyyy.MM.dd HH:mm') : ''}
                    </span>
                  </div>
                  <div className="text-sm text-wood-700 whitespace-pre-wrap">
                    {comment.content}
                  </div>
                  {(user?.uid === comment.author_id || role === 'admin') && (
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-xs font-medium text-red-500 hover:text-red-700 transition"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
