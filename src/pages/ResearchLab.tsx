import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  collection, query, where, orderBy, getDocs, limit, 
  startAfter, getCountFromServer, doc, updateDoc 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // Storage 관련 추가
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { formatDate } from '../lib/utils';
import { BookOpen, Plus, ArrowUpDown, RefreshCw, ChevronLeft, ChevronRight, Wrench } from 'lucide-react'; // Wrench 아이콘 추가
import { useStore } from '../store/useStore';

interface ResearchCategory {
  id: string;
  name: string;
  order: number;
}

export default function ResearchLab() {
  const { user, role, loading: authLoading } = useAuth();
  const { research, researchCategories, setCategoryCollection, setCategories } = useStore();
  
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageLastDocs, setPageLastDocs] = useState<{[key: number]: any}>({});
  const pageSize = 10;
  
  const currentResearch = research[activeTab] || { data: [], lastDoc: null, hasMore: true, fetched: false };
  
  const [loading, setLoading] = useState(!currentResearch.fetched);
  const [error, setError] = useState<string | null>(null);
  const [sortOrderDirection, setSortOrderDirection] = useState<'asc' | 'desc'>('asc');

  // --- [Jarvis] 데이터 이사(Migration) 로직 시작 ---
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState('');

  const handleMigrateOldPdfs = async () => {
    if (!window.confirm("옛날 PDF 자료들을 현재 방식으로 일괄 복구하시겠습니까?")) return;
    
    setIsMigrating(true);
    setMigrationStatus('복구 대상 게시글을 찾는 중...');
    
    try {
      // 1. pdfUrl이 없고 pdfChunkCount가 있는 옛날 게시글들 찾기
      const q = query(collection(db, 'posts'), where('category', '==', 'research'));
      const snapshot = await getDocs(q);
      const oldPosts = snapshot.docs.filter(doc => !doc.data().pdfUrl && doc.data().pdfChunkCount > 0);
      
      if (oldPosts.length === 0) {
        alert("복구할 옛날 자료가 없습니다.");
        setIsMigrating(false);
        return;
      }

      setMigrationStatus(`${oldPosts.length}개의 자료 발견. 복구를 시작합니다...`);

      for (let i = 0; i < oldPosts.length; i++) {
        const postDoc = oldPosts[i];
        const postData = postDoc.data();
        const postId = postDoc.id;
        const pdfName = postData.pdfName || `restored_${Date.now()}.pdf`;

        setMigrationStatus(`[${i + 1}/${oldPosts.length}] ${postData.title} 처리 중...`);

        // 2. 조각들 가져오기
        const chunksQ = query(collection(db, 'post_pdfs'), where('postId', '==', postId), orderBy('index', 'asc'));
        const chunksSnap = await getDocs(chunksQ);
        
        if (chunksSnap.empty) continue;

        // 3. [개선된 부분] Fetch 대신 직접 메모리에서 합치기
        const fullBase64 = chunksSnap.docs.map(d => d.data().data).join('');
        
        // Base64를 안전하게 Blob으로 변환 (용량 제한 없음)
        const byteCharacters = atob(fullBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let j = 0; j < byteCharacters.length; j++) {
          byteNumbers[j] = byteCharacters.charCodeAt(j);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });

        // 4. Storage 업로드
        const fileRef = ref(storage, `pdfs/${Date.now()}_${pdfName}`);
        await uploadBytes(fileRef, blob);
        const downloadUrl = await getDownloadURL(fileRef);

        // 5. 게시글 업데이트
        await updateDoc(doc(db, 'posts', postId), {
          pdfUrl: downloadUrl,
          updatedAt: new Date()
        });
      }

      setMigrationStatus('모든 자료 복구가 완료되었습니다!');
      alert("모든 자료가 성공적으로 복구되었습니다.");
      window.location.reload();
    } catch (err: any) {
      console.error("Migration error:", err);
      alert(`복구 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsMigrating(false);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        let cats = researchCategories;
        if (cats.length === 0) {
          const catQ = query(collection(db, 'research_categories'), orderBy('order', 'asc'));
          const catSnap = await getDocs(catQ);
          cats = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ResearchCategory[];
          setCategories('researchCategories', cats);
        }

        setLoading(true);
        setError(null);
        setCurrentPage(1);
        setPageLastDocs({});

        let countQ;
        if (activeTab === 'all') {
          countQ = query(collection(db, 'posts'), where('category', '==', 'research'));
        } else {
          countQ = query(collection(db, 'posts'), where('category', '==', 'research'), where('researchCategoryId', '==', activeTab));
        }
        const countSnap = await getCountFromServer(countQ);
        setTotalCount(countSnap.data().count);

        let q;
        const orderField = 'title';
        const orderDir = sortOrderDirection;

        if (activeTab === 'all') {
          q = query(collection(db, 'posts'), where('category', '==', 'research'), orderBy(orderField, orderDir), limit(pageSize));
        } else {
          q = query(collection(db, 'posts'), where('category', '==', 'research'), where('researchCategoryId', '==', activeTab), orderBy(orderField, orderDir), limit(pageSize));
        }

        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
        const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
        setCategoryCollection('research', activeTab, data, lastDoc, snapshot.docs.length === pageSize);
        if (lastDoc) setPageLastDocs({ 1: lastDoc });
      } catch (error: any) {
        console.error('Error fetching data:', error);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [activeTab, sortOrderDirection]);

  const handlePageChange = async (page: number) => {
    if (page === currentPage || page < 1 || page > Math.ceil(totalCount / pageSize) || loading) return;
    if (page > 1 && !pageLastDocs[page - 1]) return;
    setLoading(true);
    try {
      let q;
      const orderField = 'title';
      const orderDir = sortOrderDirection;
      const anchorDoc = pageLastDocs[page - 1];

      if (page > 1 && anchorDoc) {
        q = query(collection(db, 'posts'), where('category', '==', 'research'), 
            ...(activeTab !== 'all' ? [where('researchCategoryId', '==', activeTab)] : []),
            orderBy(orderField, orderDir), startAfter(anchorDoc), limit(pageSize));
      } else {
        q = query(collection(db, 'posts'), where('category', '==', 'research'),
            ...(activeTab !== 'all' ? [where('researchCategoryId', '==', activeTab)] : []),
            orderBy(orderField, orderDir), limit(pageSize));
      }

      const snapshot = await getDocs(q);
      let docs = snapshot.docs;

      const data = docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
      const lastDoc = docs[docs.length - 1] || null;
      setCategoryCollection('research', activeTab, data, lastDoc, docs.length === pageSize);
      setCurrentPage(page);
      if (lastDoc) setPageLastDocs(prev => ({ ...prev, [page]: lastDoc }));
    } catch (err) {
      setError('페이지 이동 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    window.location.reload();
  };

  const sortedPosts = React.useMemo(() => currentResearch.data, [currentResearch.data]);
  const canWrite = !authLoading && role === 'admin';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 관리자 복구 도구 (Admin Only) */}
      {canWrite && (
        <div className="mb-8 p-6 bg-amber-50 border-2 border-amber-200 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-bold text-amber-900 flex items-center">
                <Wrench size={20} className="mr-2" />
                옛날 PDF 자료 일괄 복구 도구
              </h2>
              <p className="text-sm text-amber-700 mt-1">
                저장 방식이 바뀌기 전(2026년 3월 이전)에 올린 자료들을 한꺼번에 현재 방식으로 이사시킵니다.
              </p>
            </div>
            <button
              onClick={handleMigrateOldPdfs}
              disabled={isMigrating}
              className={`px-6 py-3 rounded-xl font-bold transition flex items-center ${
                isMigrating ? 'bg-amber-300 text-amber-800' : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              {isMigrating ? (
                <>
                  <RefreshCw size={18} className="mr-2 animate-spin" />
                  {migrationStatus}
                </>
              ) : '이삿짐 옮기기 시작'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-wood-200 pb-6 gap-4">
        <div>
          <p className="text-wood-600 text-lg">목사님의 연구 내용과 묵상을 나눕니다.</p>
        </div>
        {canWrite && (
          <Link
            to="/create-post?type=research"
            className="inline-flex items-center px-6 py-3 bg-wood-900 text-white rounded-xl hover:bg-wood-800 transition shadow-md font-medium"
          >
            <Plus size={20} className="mr-2" />
            연구글 작성
          </Link>
        )}
      </div>

      {/* 필터 및 정렬 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-wood-900 text-white shadow-md transform scale-105'
                : 'bg-white text-wood-600 hover:bg-wood-50 border border-wood-200'
            }`}
          >
            전체
          </button>
          {researchCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === cat.id
                  ? 'bg-wood-900 text-white shadow-md transform scale-105'
                  : 'bg-white text-wood-600 hover:bg-wood-50 border border-wood-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-wood-200 shadow-sm self-end md:self-auto">
          <button
            onClick={() => setSortOrderDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="px-4 py-1.5 text-sm font-bold text-wood-700 hover:bg-wood-50 rounded-xl transition flex items-center gap-1"
          >
            <ArrowUpDown size={16} className="text-wood-400" />
            {sortOrderDirection === 'desc' ? '내림차순' : '오름차순'}
          </button>
        </div>
      </div>

      {error && <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-center font-medium">{error}</div>}

      {/* 게시글 그리드 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-wood-900 mb-4"></div>
          <p className="text-wood-500 font-medium">연구글을 불러오는 중입니다...</p>
        </div>
      ) : sortedPosts.length === 0 ? (
        <div className="text-center py-32 bg-white rounded-3xl border border-wood-200 shadow-sm">
          <BookOpen className="mx-auto h-16 w-16 text-wood-200 mb-6" />
          <h3 className="text-xl font-bold text-wood-900">등록된 연구글이 없습니다</h3>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sortedPosts.map((post, index) => (
              <motion.div key={post.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.03, 0.4) }}>
                <Link to={`/post/${post.id}`} className="block h-full group">
                  <div className="bg-white rounded-3xl shadow-sm border border-wood-100 p-8 h-full hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-wood-900 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                    <div className="flex items-center justify-between mb-6">
                      <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-wood-50 text-wood-800 border border-wood-100">
                        {researchCategories.find(c => c.id === post.researchCategoryId)?.name || '연구글'}
                      </span>
                      <span className="text-xs font-medium text-wood-400">{formatDate(post.createdAt)}</span>
                    </div>
                    <h3 className="text-xl font-bold text-wood-900 mb-4 line-clamp-2 leading-tight group-hover:text-wood-700 transition-colors">{post.title}</h3>
                    <p className="text-wood-600 line-clamp-3 mb-8 flex-grow text-sm leading-relaxed">{post.content.replace(/<[^>]*>?/gm, '')}</p>
                    <div className="flex items-center justify-between text-xs font-bold text-wood-500 pt-5 border-t border-wood-50">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-wood-100 flex items-center justify-center text-[10px] text-wood-600">{post.authorName?.[0] || 'M'}</div>
                        <span>{post.authorName}</span>
                      </div>
                      <span className="bg-wood-50 px-2 py-1 rounded-md">댓글 {post.commentCount || 0}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* 페이지네이션 */}
          {totalCount > pageSize && (
            <div className="flex justify-center items-center gap-2 mt-16">
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || loading} className="p-3 rounded-xl border border-wood-200 text-wood-600 hover:bg-wood-50 disabled:opacity-30 transition-colors shadow-sm">
                <ChevronLeft size={20} />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.ceil(totalCount / pageSize) }).map((_, i) => (
                  <button key={i} onClick={() => handlePageChange(i + 1)} disabled={loading || (i + 1 > 1 && !pageLastDocs[i])} className={`w-11 h-11 rounded-xl text-sm font-bold transition-all ${currentPage === i + 1 ? 'bg-wood-900 text-white shadow-lg' : (i + 1 > 1 && !pageLastDocs[i]) ? 'text-wood-300 cursor-not-allowed' : 'text-wood-600 hover:bg-wood-50'}`}>
                    {i + 1}
                  </button>
                ))}
              </div>
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === Math.ceil(totalCount / pageSize) || loading} className="p-3 rounded-xl border border-wood-200 text-wood-600 hover:bg-wood-50 disabled:opacity-30 transition-colors shadow-sm">
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
