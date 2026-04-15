import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Users, Mail, ArrowLeft, Settings, ShieldCheck, Video, FlaskConical, Activity, Bell, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs, setDoc, doc, serverTimestamp, where, updateDoc, startAfter } from 'firebase/firestore';
import { toast } from 'sonner';
import { generateSortOrder } from '../lib/sortUtils';

export default function AdminDashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationDone, setMigrationDone] = useState(localStorage.getItem('migration_done') === 'true');

  const migrateSortOrder = async () => {
    if (isMigrating || migrationDone) return;
    if (!window.confirm('주의: 이 작업은 대량의 읽기 비용을 발생시킵니다. 계속하시겠습니까?')) return;
    
    setIsMigrating(true);
    try {
      const postsRef = collection(db, 'posts');
      let totalProcessed = 0;
      let totalUpdated = 0;
      let lastDoc = null;
      const BATCH_LIMIT = 500; // Max docs to scan per click to avoid excessive costs
      
      while (totalProcessed < BATCH_LIMIT && totalUpdated < 100) {
        let q = query(
          postsRef, 
          where('category', 'in', ['sermon', 'research']), 
          orderBy('createdAt', 'asc'),
          limit(100)
        );
        
        if (lastDoc) {
          q = query(q, startAfter(lastDoc));
        }
        
        const snapshot = await getDocs(q);
        if (snapshot.empty) break;
        
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        totalProcessed += snapshot.docs.length;
        
        for (const document of snapshot.docs) {
          const data = document.data();
          if (!data.sortOrder) {
            const sortOrder = generateSortOrder(data.title || '');
            await updateDoc(doc(db, 'posts', document.id), { sortOrder });
            totalUpdated++;
            if (totalUpdated >= 100) break;
          }
        }
        
        if (snapshot.docs.length < 100) break;
      }
      
      if (totalUpdated === 0 && totalProcessed < BATCH_LIMIT) {
        setMigrationDone(true);
        localStorage.setItem('migration_done', 'true');
        toast.success('모든 게시물의 정렬 순서가 이미 설정되어 있습니다.');
      } else {
        toast.success(`마이그레이션 진행됨: ${totalUpdated}개 업데이트됨. (남은 작업이 있을 수 있으니 완료될 때까지 반복해 주세요)`);
      }
    } catch (error) {
      console.error('Error migrating sort order:', error);
      toast.error('마이그레이션 중 오류가 발생했습니다.');
    } finally {
      setIsMigrating(false);
    }
  };

  const refreshLatestSummary = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const categories = ['sermon', 'research', 'community', 'journal'];
      const summary: any = {};

      await Promise.all(categories.map(async (cat) => {
        const q = query(
          collection(db, 'posts'),
          where('category', '==', cat),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const post = snap.docs[0];
          const data = post.data();
          summary[cat] = {
            id: post.id,
            title: data.title,
            content: data.content.substring(0, 500),
            category: cat,
            subCategory: data.subCategory || 'general',
            sermonCategoryId: data.sermonCategoryId || null,
            researchCategoryId: data.researchCategoryId || null,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            authorName: data.authorName || '익명'
          };
        }
      }));

      await setDoc(doc(db, 'settings', 'latest_posts_summary'), {
        ...summary,
        updatedAt: serverTimestamp()
      });
      
      toast.success('최신 게시물 요약 정보가 성공적으로 갱신되었습니다.');
      // Clear local cache to show changes immediately
      localStorage.removeItem('home_latest_posts_cache');
    } catch (error) {
      console.error('Error refreshing summary:', error);
      toast.error('요약 정보 갱신 중 오류가 발생했습니다.');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wood-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-wood-900 mb-4">권한이 없습니다</h2>
          <p className="text-wood-600 mb-4">이 페이지는 관리자(목회자) 전용입니다.</p>
          <button onClick={() => navigate('/')} className="text-wood-600 hover:underline">홈으로 돌아가기</button>
        </div>
      </div>
    );
  }

  const adminItems = [
    {
      title: '디지털 출석부 (중단됨)',
      description: '성도들의 홈페이지 방문 및 활동 로그 확인 기능이 현재 비활성화되었습니다.',
      icon: Activity,
      path: '/admin/activity-logs',
      color: 'bg-gray-50 text-gray-400 border-gray-100'
    },
    {
      title: '최신 게시물 요약 갱신',
      description: '홈 화면의 최신 게시물 정보를 강제로 갱신합니다. (읽기 비용 절감용)',
      icon: RefreshCw,
      onClick: refreshLatestSummary,
      isLoading: isRefreshing,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100'
    },
    {
      title: '정렬 순서(sortOrder) 마이그레이션',
      description: migrationDone ? '모든 게시물에 정렬 순서가 부여되었습니다.' : '기존 말씀 서재 및 연구실 게시물에 자동 생성된 정렬 순서를 부여합니다.',
      icon: RefreshCw,
      onClick: migrationDone ? undefined : migrateSortOrder,
      isLoading: isMigrating,
      disabled: migrationDone,
      color: migrationDone ? 'bg-gray-50 text-gray-400 border-gray-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
    },
    {
      title: '할당량 초과 플래그 초기화',
      description: '데이터베이스 할당량 초과 경고가 떴을 때, 수동으로 초기화하여 접속을 재시도합니다.',
      icon: ShieldCheck,
      onClick: () => {
        localStorage.removeItem('firestore_quota_exceeded');
        toast.success('할당량 초과 플래그가 초기화되었습니다. 페이지를 새로고침해 주세요.');
      },
      color: 'bg-amber-50 text-amber-600 border-amber-100'
    },
    {
      title: '교회 정보 관리',
      description: '교회 소개 페이지의 텍스트와 내용을 수정합니다.',
      icon: Settings,
      path: '/admin/church-info',
      color: 'bg-rose-50 text-rose-600 border-rose-100'
    },
    {
      title: '회원 관리',
      description: '가입된 회원의 등급(준회원/정회원)을 관리하고 권한을 부여합니다.',
      icon: Users,
      path: '/admin/users',
      color: 'bg-blue-50 text-blue-600 border-blue-100'
    },
    {
      title: '문의 관리',
      description: '남겨주신 개척 모임 문의와 연락처 정보를 확인하고 관리합니다.',
      icon: Mail,
      path: '/admin/contacts',
      color: 'bg-amber-50 text-amber-600 border-amber-100'
    },
    {
      title: '말씀 서재 카테고리',
      description: '설교 영상들을 묶을 재생목록(강해 시리즈 등)을 관리합니다.',
      icon: Video,
      path: '/admin/sermon-categories',
      color: 'bg-purple-50 text-purple-600 border-purple-100'
    },
    {
      title: '교회 연구실 카테고리',
      description: '연구글들을 묶을 카테고리(예배학, 설교학 등)를 관리합니다.',
      icon: FlaskConical,
      path: '/admin/research-categories',
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100'
    },
    {
      title: '알림 발송',
      description: '성도들에게 모바일 푸시 알림을 보냅니다. (공지사항, 긴급 소식 등)',
      icon: Bell,
      path: '/admin/notifications',
      color: 'bg-orange-50 text-orange-600 border-orange-100'
    }
  ];

  return (
    <div className="bg-wood-100 min-h-screen py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-white rounded-full transition shadow-sm border border-wood-200"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-3xl font-serif font-bold text-wood-900">목사님 전용 관리실</h1>
              <p className="text-wood-600">교회 운영과 성도 관리를 위한 공간입니다.</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-wood-900 text-white px-4 py-2 rounded-full text-sm font-medium shadow-md">
            <ShieldCheck size={18} />
            관리자 모드
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {adminItems.map((item, index) => {
            const Content = (
              <div className="h-full">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border ${item.color} group-hover:scale-110 transition-transform`}>
                  {item.isLoading ? (
                    <RefreshCw className="animate-spin" size={28} />
                  ) : (
                    <item.icon size={28} />
                  )}
                </div>
                <h3 className="text-xl font-bold text-wood-900 mb-3 flex items-center justify-between">
                  {item.title}
                  <Settings size={18} className="text-wood-300 group-hover:rotate-90 transition-transform duration-500" />
                </h3>
                <p className="text-wood-600 leading-relaxed">
                  {item.description}
                </p>
              </div>
            );

            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  delay: Math.min(index * 0.03, 0.4),
                  ease: "easeOut"
                }}
              >
                {item.onClick ? (
                  <button
                    onClick={item.onClick}
                    disabled={item.isLoading || item.disabled}
                    className="w-full text-left block bg-white rounded-3xl p-8 border border-wood-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group h-full disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {Content}
                  </button>
                ) : (
                  <Link
                    to={item.path || '#'}
                    className="block bg-white rounded-3xl p-8 border border-wood-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group h-full"
                  >
                    {Content}
                  </Link>
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="mt-12 p-8 bg-white/50 backdrop-blur-sm rounded-3xl border border-wood-200/50 text-center">
          <p className="text-sm text-wood-500">
            "너희는 양 떼를 위하여 삼가라 성령이 그들 가운데 여러분을 감독자로 삼고 하나님이 자기 피로 사신 교회를 보살피게 하셨느니라" (사도행전 20:28)
          </p>
        </div>
      </div>
    </div>
  );
}
