import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, orderBy, getDocs, addDoc, deleteDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { ArrowLeft, MessageSquare, Trash2, Edit3, FileText } from 'lucide-react';

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
        const postRef = doc(db, 'posts', id);
        const postSnap = await getDoc(postRef);

        if (!postSnap.exists()) {
          navigate('/research');
          return;
        }
        setPost({ id: postSnap.id, ...postSnap.data() });

        // Fetch comments
        const q = query(
          collection(db, 'comments'),
          where('postId', '==', id),
          orderBy('createdAt', 'asc')
        );
        const commentsSnap = await getDocs(q);
        const commentsData = commentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setComments(commentsData);
      } catch (error) {
        console.error('Error fetching data:', error);
        handleFirestoreError(error, OperationType.GET, 'posts/comments');
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
      const commentData = {
        postId: id,
        content: newComment.trim(),
        authorId: user.uid,
        authorName: user.displayName || '익명',
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'comments'), commentData);
      const newCommentObj = { id: docRef.id, ...commentData, createdAt: new Date() };

      // Update post comment count
      const postRef = doc(db, 'posts', id);
      await updateDoc(postRef, {
        commentCount: increment(1)
      });

      setComments([...comments, newCommentObj]);
      setPost({ ...post, commentCount: (post.commentCount || 0) + 1 });
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      handleFirestoreError(error, OperationType.CREATE, 'comments');
      alert('댓글 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = async () => {
    if (!id || !window.confirm('정말로 이 게시글을 삭제하시겠습니까?')) return;
    
    try {
      await deleteDoc(doc(db, 'posts', id));
      navigate(-1);
    } catch (error) {
      console.error('Error deleting post:', error);
      handleFirestoreError(error, OperationType.DELETE, 'posts');
      alert('게시글 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!id || !window.confirm('댓글을 삭제하시겠습니까?')) return;
    
    try {
      await deleteDoc(doc(db, 'comments', commentId));

      // Decrement post comment count
      const postRef = doc(db, 'posts', id);
      await updateDoc(postRef, {
        commentCount: increment(-1)
      });

      setComments(comments.filter(c => c.id !== commentId));
      setPost({ ...post, commentCount: Math.max(0, (post.commentCount || 0) - 1) });
    } catch (error) {
      console.error('Error deleting comment:', error);
      handleFirestoreError(error, OperationType.DELETE, 'comments');
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
                {post.category === 'research' ? (
                  post.subCategory === 'worship' ? '예배' :
                  post.subCategory === 'preaching' ? '설교' :
                  post.subCategory === 'pastoring' ? '목양' :
                  post.subCategory === 'governing' ? '치리' :
                  post.subCategory === 'general' ? '일반' : '연구실'
                ) : post.category === 'sermon' ? (
                  post.subCategory === 'past_sermons' ? '지난 설교들' :
                  post.subCategory === 'pilgrims_progress' ? '천로역정' : '말씀 서재'
                ) : '소통 게시판'}
              </span>
              <div className="flex items-center text-sm text-wood-600 gap-4">
                <span>{post.authorName}</span>
                <span>&bull;</span>
                <span>{formatDate(post.createdAt, 'yyyy.MM.dd HH:mm')}</span>
              </div>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold text-wood-900 mb-8 leading-tight">
              {post.title}
            </h1>
            
            <div className="prose prose-stone max-w-none text-wood-700 leading-relaxed whitespace-pre-wrap mb-12">
              {renderContentWithYouTube(post.content)}
            </div>

            {post.pdfUrl && (
              <div className="mt-12 border-t border-wood-100 pt-12">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-wood-900 flex items-center">
                    <FileText className="mr-2 text-wood-900" />
                    첨부된 PDF 문서
                  </h3>
                  <a
                    href={post.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-wood-50 text-wood-900 rounded-full text-sm font-medium hover:bg-wood-100 transition border border-wood-200"
                  >
                    새 창에서 열기 / 다운로드
                  </a>
                </div>
                <div className="aspect-[1/1.4] w-full bg-wood-50 rounded-2xl border border-wood-200 overflow-hidden shadow-inner">
                  <iframe
                    src={`${post.pdfUrl}#toolbar=0`}
                    className="w-full h-full"
                    title="PDF Viewer"
                  >
                    <p>이 브라우저는 PDF 뷰어를 지원하지 않습니다. <a href={post.pdfUrl}>여기</a>를 클릭하여 다운로드하세요.</p>
                  </iframe>
                </div>
              </div>
            )}

            {(user?.uid === post.authorId || role === 'admin') && (
              <div className="mt-12 pt-6 border-t border-wood-100 flex justify-end gap-4">
                <button
                  onClick={() => navigate(`/edit-post/${id}`)}
                  className="inline-flex items-center text-sm font-medium text-wood-600 hover:text-wood-900 transition"
                >
                  <Edit3 size={16} className="mr-1.5" />
                  수정
                </button>
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
            댓글 {post.commentCount || 0}
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
                    {comment.authorName?.charAt(0) || '익'}
                  </div>
                </div>
                <div className="flex-grow bg-wood-50 rounded-2xl p-5 border border-wood-100">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-wood-900">{comment.authorName}</h4>
                    <span className="text-xs text-wood-500">
                      {formatDate(comment.createdAt, 'yyyy.MM.dd HH:mm')}
                    </span>
                  </div>
                  <div className="text-sm text-wood-700 whitespace-pre-wrap">
                    {comment.content}
                  </div>
                  {(user?.uid === comment.authorId || role === 'admin') && (
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
