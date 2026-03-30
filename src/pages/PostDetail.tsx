import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, orderBy, getDocs, addDoc, deleteDoc, updateDoc, increment, serverTimestamp, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { ArrowLeft, MessageSquare, Trash2, Edit3, FileText, Plus } from 'lucide-react';
import PdfCanvasViewer from '../components/PdfCanvasViewer';

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCommentDeleteConfirm, setShowCommentDeleteConfirm] = useState<string | null>(null);
  const [isDeletingComment, setIsDeletingComment] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchPostAndComments = async () => {
      try {
        // Fetch post
        const postRef = doc(db, 'posts', id);
        let postSnap;
        try {
          postSnap = await getDoc(postRef);
        } catch (error: any) {
          // If permission denied, it's likely a sermon post and user is not regular
          if (error.code === 'permission-denied') {
            const isRegularMember = role === 'regular' || role === 'admin' || user?.email === 'crushidea@gmail.com';
            if (!isRegularMember) {
              alert('정회원만 볼 수 있는 영상입니다. 상단 \'문의\'를 통해 신청해주세요.');
              navigate('/sermons');
              return;
            }
          }
          throw error;
        }

        if (!postSnap.exists()) {
          navigate('/research');
          return;
        }
        const postData: any = { id: postSnap.id, ...postSnap.data() };
        
        // Double check access for sermon category (in case rules were bypassed or changed)
        const isRegularMember = role === 'regular' || role === 'admin' || user?.email === 'crushidea@gmail.com';
        if (postData.category === 'sermon' && !isRegularMember) {
          alert('정회원만 볼 수 있는 영상입니다. 상단 \'문의\'를 통해 신청해주세요.');
          navigate('/sermons');
          return;
        }

        setPost(postData);

        // Handle Base64 PDF if exists
        if (postData.pdfChunkCount) {
          console.log('PDF Data detected (Chunks). Count:', postData.pdfChunkCount);
          try {
            let fullBase64 = '';
            for (let i = 0; i < postData.pdfChunkCount; i++) {
              const chunkDoc = await getDoc(doc(db, 'post_pdfs', `${id}_${i}`));
              if (chunkDoc.exists()) {
                fullBase64 += chunkDoc.data().data;
              }
            }
            
            const base64Parts = fullBase64.split(',');
            const mimeType = base64Parts[0].match(/:(.*?);/)?.[1] || 'application/pdf';
            const base64Data = base64Parts[1];
            
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            const url = URL.createObjectURL(blob);
            
            console.log('Successfully created Blob URL from chunks:', url);
            setPdfBlobUrl(url);
          } catch (e) {
            console.error('Error converting chunks to blob:', e);
          }
        } else if (postData.pdfBase64) {
          console.log('PDF Data detected (Base64). Size:', postData.pdfBase64.length);
          try {
            const base64Parts = postData.pdfBase64.split(',');
            const mimeType = base64Parts[0].match(/:(.*?);/)?.[1] || 'application/pdf';
            const base64Data = base64Parts[1];
            
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            const url = URL.createObjectURL(blob);
            
            console.log('Successfully created Blob URL:', url);
            setPdfBlobUrl(url);
          } catch (e) {
            console.error('Error converting base64 to blob:', e);
          }
        } else if (postData.pdfUrl) {
          console.log('PDF Data detected (URL):', postData.pdfUrl);
        }

        // Fetch comments
        const q = query(
          collection(db, 'comments'),
          where('postId', '==', id),
          orderBy('createdAt', 'asc')
        );
        const commentsSnap = await getDocs(q);
        const commentsData = commentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setComments(commentsData);

        // Auto-heal comment count if it mismatches
        const actualCommentCount = commentsData.length;
        if ((postData.commentCount || 0) !== actualCommentCount) {
          try {
            await updateDoc(postRef, { commentCount: actualCommentCount });
            setPost((prev: any) => prev ? { ...prev, commentCount: actualCommentCount } : null);
          } catch (e) {
            console.error('Failed to auto-heal comment count', e);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        handleFirestoreError(error, OperationType.GET, 'posts/comments');
      } finally {
        setLoading(false);
      }
    };

    fetchPostAndComments();

    // Cleanup function for the Blob URL
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [id, navigate, role, user]);

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

      // Update post comment count and updatedAt
      const postRef = doc(db, 'posts', id);
      await updateDoc(postRef, {
        commentCount: increment(1),
        updatedAt: serverTimestamp()
      });

      setComments([newCommentObj, ...comments]);
      setPost({ ...post, commentCount: (post.commentCount || 0) + 1, updatedAt: new Date() });
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
    if (!id) return;
    
    setIsDeleting(true);
    try {
      if (post?.pdfChunkCount) {
        const oldChunksQuery = query(collection(db, 'post_pdfs'), where('postId', '==', id));
        const oldChunksSnap = await getDocs(oldChunksQuery);
        await Promise.all(oldChunksSnap.docs.map(d => deleteDoc(d.ref)));
      }
      await deleteDoc(doc(db, 'posts', id));
      
      // Update latest posts summary for Home page optimization
      try {
        const summaryRef = doc(db, 'settings', 'latest_posts_summary');
        const summarySnap = await getDoc(summaryRef);
        if (summarySnap.exists()) {
          const summaryData = summarySnap.data();
          const category = post.category;
          
          // If the deleted post was the one in the summary, find the new latest
          if (summaryData[category]?.id === id) {
            console.log('Deleted post was in summary, finding new latest for:', category);
            const q = query(
              collection(db, 'posts'),
              where('category', '==', category),
              orderBy('createdAt', 'desc'),
              limit(1)
            );
            const nextLatestSnap = await getDocs(q);
            
            if (!nextLatestSnap.empty) {
              const nextPost = nextLatestSnap.docs[0];
              const nextData = nextPost.data();
              const postSummary = {
                id: nextPost.id,
                title: nextData.title,
                content: nextData.content.substring(0, 500),
                category: category,
                subCategory: nextData.subCategory || 'general',
                createdAt: nextData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                authorName: nextData.authorName || '익명'
              };
              await updateDoc(summaryRef, {
                [category]: postSummary,
                updatedAt: serverTimestamp()
              });
            } else {
              // No more posts in this category, remove from summary
              await updateDoc(summaryRef, {
                [category]: null,
                updatedAt: serverTimestamp()
              });
            }
          }
        }
      } catch (summaryErr) {
        console.error('Error updating latest posts summary on delete:', summaryErr);
      }

      navigate(-1);
    } catch (error) {
      console.error('Error deleting post:', error);
      handleFirestoreError(error, OperationType.DELETE, 'posts');
      alert('게시글 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!id) return;
    
    setIsDeletingComment(commentId);
    try {
      await deleteDoc(doc(db, 'comments', commentId));

      // Decrement post comment count and update updatedAt
      const postRef = doc(db, 'posts', id);
      await updateDoc(postRef, {
        commentCount: increment(-1),
        updatedAt: serverTimestamp()
      });

      setComments(comments.filter(c => c.id !== commentId));
      setPost({ ...post, commentCount: Math.max(0, (post.commentCount || 0) - 1), updatedAt: new Date() });
      setShowCommentDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting comment:', error);
      handleFirestoreError(error, OperationType.DELETE, 'comments');
      alert('댓글 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeletingComment(null);
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

  const isAdmin = role === 'admin' || user?.email === 'crushidea@gmail.com';

  return (
    <div className="bg-wood-100 min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => {
              const categoryPaths: Record<string, string> = {
                'journal': '/journal',
                'sermon': '/sermons',
                'research': '/research',
                'community': '/community',
                'contact': '/contact'
              };
              let path = post ? categoryPaths[post.category] || '/' : '/';
              
              // For sermons, append the category ID to preserve the tab
              if (post?.category === 'sermon' && post.sermonCategoryId) {
                path += `?tab=${post.sermonCategoryId}`;
              } else if (post?.category === 'sermon' && post.subCategory) {
                // Fallback for legacy subCategory
                path += `?tab=${post.subCategory}`;
              }
              
              navigate(path);
            }}
            className="inline-flex items-center text-sm font-medium text-wood-500 hover:text-wood-900 transition"
          >
            <ArrowLeft size={16} className="mr-2" />
            목록으로 돌아가기
          </button>

          {isAdmin && (post.category === 'sermon' || post.category === 'research') && (
            <Link
              to={`/create-post?type=${post.category}${post.sermonCategoryId ? `&categoryId=${post.sermonCategoryId}` : post.researchCategoryId ? `&categoryId=${post.researchCategoryId}` : post.subCategory ? `&subCategory=${post.subCategory}` : ''}`}
              className="inline-flex items-center px-4 py-2 bg-white text-wood-900 rounded-full text-sm font-medium hover:bg-wood-50 transition border border-wood-200 shadow-sm"
            >
              <Plus size={16} className="mr-2" />
              영상 추가 등록
            </Link>
          )}
        </div>

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
                ) : post.category === 'journal' ? '개척 일지' : '소통 게시판'}
              </span>
              <div className="flex items-center text-sm text-wood-600 gap-4">
                <span>{post.authorName}</span>
                <span>&bull;</span>
                <span>{formatDate(post.createdAt, 'yyyy.MM.dd HH:mm')}</span>
                <span>&bull;</span>
                <span className="flex items-center gap-1"><MessageSquare size={14} /> {comments.length}</span>
              </div>
            </div>
            
            <h1 className="text-xl md:text-2xl font-bold text-wood-900 mb-4 leading-tight border-l-4 border-wood-900 pl-4">
              {post.title}
            </h1>

            {(user?.uid === post.authorId || role === 'admin') && (
              <div className="flex justify-end items-center gap-4 mb-8 pb-4 border-b border-wood-50">
                <button
                  onClick={() => navigate(`/edit-post/${id}`)}
                  className="inline-flex items-center text-sm font-medium text-wood-600 hover:text-wood-900 transition"
                >
                  <Edit3 size={16} className="mr-1.5" />
                  수정
                </button>
                
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center text-sm font-medium text-red-600 hover:text-red-800 transition"
                    disabled={isDeleting}
                  >
                    <Trash2 size={16} className="mr-1.5" />
                    삭제
                  </button>
                ) : (
                  <div className="flex items-center space-x-2 bg-red-50 p-2 rounded-xl border border-red-100">
                    <span className="text-xs text-red-600 font-bold px-1">정말 삭제할까요?</span>
                    <button
                      onClick={handleDeletePost}
                      disabled={isDeleting}
                      className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-full hover:bg-red-700 disabled:opacity-50 transition"
                    >
                      {isDeleting ? '삭제 중...' : '확인'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                      className="text-xs bg-wood-200 text-wood-700 px-3 py-1.5 rounded-full hover:bg-wood-300 transition"
                    >
                      취소
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="prose prose-stone max-w-none text-wood-700 leading-relaxed whitespace-pre-wrap mb-12">
              {renderContentWithYouTube(post.content)}
            </div>

            {(post.pdfUrl || post.pdfBase64 || post.pdfChunkCount > 0) && (
              <div className="mt-12 border-t border-wood-100 pt-12">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <h3 className="text-xl font-bold text-wood-900 flex items-center">
                    <FileText className="mr-2 text-wood-900" />
                    첨부된 PDF 문서
                  </h3>
                  <div className="flex gap-2">
                    <a
                      href={pdfBlobUrl || post.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 bg-wood-50 text-wood-900 rounded-full text-sm font-medium hover:bg-wood-100 transition border border-wood-200"
                    >
                      새 창에서 열기
                    </a>
                    <a
                      href={pdfBlobUrl || post.pdfUrl}
                      download={post.pdfName || 'document.pdf'}
                      className="inline-flex items-center px-4 py-2 bg-wood-900 text-white rounded-full text-sm font-medium hover:bg-wood-800 transition"
                    >
                      다운로드
                    </a>
                  </div>
                </div>
                <div className="w-full bg-white rounded-2xl border border-wood-200 overflow-hidden shadow-inner relative">
                  {(pdfBlobUrl || post.pdfUrl) ? (
                    <PdfCanvasViewer 
                      url={pdfBlobUrl || post.pdfUrl} 
                      onDownload={() => {
                        const link = document.createElement('a');
                        link.href = pdfBlobUrl || post.pdfUrl;
                        link.download = post.pdfName || 'document.pdf';
                        link.click();
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-96 text-wood-400">
                      <div className="animate-pulse flex flex-col items-center">
                        <FileText size={48} className="mb-4 opacity-20" />
                        <p>문서를 불러오는 중입니다...</p>
                      </div>
                    </div>
                  )}
                </div>
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
                    <div className="mt-3 flex justify-end items-center">
                      {showCommentDeleteConfirm !== comment.id ? (
                        <button
                          onClick={() => setShowCommentDeleteConfirm(comment.id)}
                          className="text-xs font-medium text-red-500 hover:text-red-700 transition"
                          disabled={isDeletingComment === comment.id}
                        >
                          삭제
                        </button>
                      ) : (
                        <div className="flex items-center space-x-2 bg-red-50 p-1.5 rounded-lg border border-red-100">
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            disabled={isDeletingComment === comment.id}
                            className="text-[10px] bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50 transition"
                          >
                            {isDeletingComment === comment.id ? '...' : '삭제'}
                          </button>
                          <button
                            onClick={() => setShowCommentDeleteConfirm(null)}
                            disabled={isDeletingComment === comment.id}
                            className="text-[10px] bg-wood-200 text-wood-700 px-2 py-1 rounded hover:bg-wood-300 transition"
                          >
                            취소
                          </button>
                        </div>
                      )}
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
