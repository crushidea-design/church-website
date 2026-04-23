import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import {
  Users,
  Mail,
  ArrowLeft,
  Settings,
  ShieldCheck,
  Bell,
  RefreshCw,
  NotebookPen,
  Sparkles,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs, setDoc, doc, serverTimestamp, where, updateDoc, startAfter } from 'firebase/firestore';
import { toast } from 'sonner';
import { generateSortOrder } from '../lib/sortUtils';

type AdminItem = {
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  path?: string;
  onClick?: () => void | Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
};

export default function AdminDashboard() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationDone, setMigrationDone] = useState(localStorage.getItem('migration_done') === 'true');

  const migrateSortOrder = async () => {
    if (isMigrating || migrationDone) return;
    if (!window.confirm('정렬 순서 보정 작업을 실행할까요?')) return;

    setIsMigrating(true);
    try {
      const postsRef = collection(db, 'posts');
      let totalProcessed = 0;
      let totalUpdated = 0;
      let lastDoc: any = null;
      const BATCH_LIMIT = 500;

      while (totalProcessed < BATCH_LIMIT && totalUpdated < 100) {
        let q = query(postsRef, where('category', 'in', ['sermon', 'research']), orderBy('createdAt', 'asc'), limit(100));
        if (lastDoc) q = query(q, startAfter(lastDoc));

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
        toast.success('정렬 순서가 이미 모두 적용되어 있습니다.');
      } else {
        toast.success(`정렬 순서 보정 완료: ${totalUpdated}건 업데이트`);
      }
    } catch (error) {
      console.error('Error migrating sort order:', error);
      toast.error('정렬 순서 보정 중 오류가 발생했습니다.');
    } finally {
      setIsMigrating(false);
    }
  };

  const refreshLatestSummary = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const categories = ['sermon', 'research', 'community', 'journal'];
      const summary: Record<string, any> = {};

      await Promise.all(
        categories.map(async (cat) => {
          const q = query(collection(db, 'posts'), where('category', '==', cat), orderBy('createdAt', 'desc'), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const post = snap.docs[0];
            const data = post.data() as any;
            summary[cat] = {
              id: post.id,
              title: data.title,
              content: (data.content || '').substring(0, 500),
              category: cat,
              subCategory: data.subCategory || 'general',
              sermonCategoryId: data.sermonCategoryId || null,
              researchCategoryId: data.researchCategoryId || null,
              createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
              authorName: data.authorName || '익명',
            };
          }
        })
      );

      await setDoc(
        doc(db, 'settings', 'latest_posts_summary'),
        {
          ...summary,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      localStorage.removeItem('home_latest_posts_cache');
      toast.success('최신 게시물 요약을 갱신했습니다.');
    } catch (error) {
      console.error('Error refreshing summary:', error);
      toast.error('요약 갱신 중 오류가 발생했습니다.');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wood-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-wood-900 mb-4">권한이 없습니다</h2>
          <p className="text-wood-600 mb-4">이 페이지는 관리자 전용입니다.</p>
          <button onClick={() => navigate('/')} className="text-wood-600 hover:underline">
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const adminItems: AdminItem[] = [
    {
      title: '기본 홈페이지 CMS',
      description: '홈/소개/아카이브/커뮤니티를 단일 CMS 화면에서 통합 관리합니다.',
      icon: Settings,
      path: '/admin/site-cms',
      color: 'bg-rose-50 text-rose-600 border-rose-100',
    },
    {
      title: '다음세대 CMS',
      description: '다음세대 부서/탭/소개/자료를 관리자 화면에서 통합 관리합니다.',
      icon: Sparkles,
      path: '/admin/next-generation',
      color: 'bg-teal-50 text-teal-700 border-teal-100',
    },
    {
      title: '목양노트',
      description: '성도별 목양 기록을 작성하고 저장된 노트를 한눈에 모아봅니다.',
      icon: NotebookPen,
      path: '/raah',
      color: 'bg-stone-50 text-stone-700 border-stone-200',
    },
    {
      title: '회원 관리',
      description: '가입 회원의 등급과 권한을 관리합니다.',
      icon: Users,
      path: '/admin/users',
      color: 'bg-blue-50 text-blue-600 border-blue-100',
    },
    {
      title: '문의 관리',
      description: '문의/연락처 정보를 확인하고 관리합니다.',
      icon: Mail,
      path: '/admin/contacts',
      color: 'bg-amber-50 text-amber-600 border-amber-100',
    },
    {
      title: '알림 발송',
      description: '성도에게 푸시 알림을 발송합니다.',
      icon: Bell,
      path: '/admin/notifications',
      color: 'bg-orange-50 text-orange-600 border-orange-100',
    },
    {
      title: '최신 게시물 요약 갱신',
      description: '메인 화면 요약 데이터를 강제로 재생성합니다.',
      icon: RefreshCw,
      onClick: refreshLatestSummary,
      isLoading: isRefreshing,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    },
    {
      title: '정렬 순서(sortOrder) 마이그레이션',
      description: migrationDone
        ? '모든 대상 게시물의 정렬 순서가 이미 부여되어 있습니다.'
        : '말씀 서재/연구실 게시물의 누락된 정렬 순서를 보정합니다.',
      icon: RefreshCw,
      onClick: migrationDone ? undefined : migrateSortOrder,
      isLoading: isMigrating,
      disabled: migrationDone,
      color: migrationDone ? 'bg-gray-50 text-gray-400 border-gray-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
    {
      title: '할당량 초과 플래그 초기화',
      description: '로컬 저장소의 할당량 초과 플래그를 초기화합니다.',
      icon: ShieldCheck,
      onClick: () => {
        localStorage.removeItem('firestore_quota_exceeded');
        toast.success('할당량 초과 플래그를 초기화했습니다. 페이지를 새로고침해 주세요.');
      },
      color: 'bg-amber-50 text-amber-600 border-amber-100',
    },
  ];

  return (
    <div className="bg-wood-100 min-h-screen py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-full transition shadow-sm border border-wood-200">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-3xl font-serif font-bold text-wood-900">관리자 대시보드</h1>
              <p className="text-wood-600">교회 운영과 콘텐츠 관리를 위한 공간입니다.</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-wood-900 text-white px-4 py-2 rounded-full text-sm font-medium shadow-md">
            <ShieldCheck size={18} />
            관리자 모드
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {adminItems.map((item) => {
            const card = (
              <div className="h-full rounded-2xl border border-wood-200 bg-white p-6 shadow-sm hover:shadow-md transition">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 border ${item.color}`}>
                  {item.isLoading ? <RefreshCw className="animate-spin" size={22} /> : <item.icon size={22} />}
                </div>
                <h2 className="text-xl font-bold text-wood-900 mb-2">{item.title}</h2>
                <p className="text-sm leading-6 text-wood-600">{item.description}</p>
              </div>
            );

            if (item.path) {
              return (
                <Link key={item.title} to={item.path} className={item.disabled ? 'pointer-events-none opacity-60' : ''}>
                  {card}
                </Link>
              );
            }

            return (
              <button
                key={item.title}
                type="button"
                onClick={item.onClick}
                disabled={item.disabled || item.isLoading}
                className="text-left disabled:opacity-60"
              >
                {card}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
