import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { Activity, ChevronDown, ChevronRight, Clock3, User } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

interface ActivityLog {
  id: string;
  uid: string;
  email: string;
  displayName?: string;
  role: string;
  activityType: string;
  pagePath: string;
  timestamp: any;
}

interface LogGroup {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: string;
  dateStr: string;
  loginTime: any;
  lastActivityTime: any;
  logs: ActivityLog[];
}

const translateActivity = (path: string, activityType: string) => {
  if (activityType === '기도 응답 참여') return '기도 응답 기록에 참여했습니다.';
  if (activityType === '페이지 방문') return `${path} 페이지를 방문했습니다.`;
  if (path === '/') return '홈 화면을 방문했습니다.';
  if (path === '/login') return '로그인 화면을 확인했습니다.';
  if (path === '/prayer-room') return '기도방에 입장했습니다.';
  if (path === '/community') return '소통 게시판을 열었습니다.';
  if (path === '/community/new') return '소통 게시판 글 작성을 시작했습니다.';
  if (path === '/sermons') return '말씀서재를 열었습니다.';
  if (path === '/sermons/new') return '새 설교 게시글 작성을 시작했습니다.';
  if (path === '/research') return '교회연구실을 열었습니다.';
  if (path === '/intro') return '교회 소개 페이지를 확인했습니다.';
  if (path === '/contact') return '문의 페이지를 확인했습니다.';
  if (path === '/journal') return '개척일지를 읽었습니다.';
  if (path === '/profile') return '프로필 화면을 확인했습니다.';
  if (path === '/admin') return '관리자 화면에 진입했습니다.';
  if (path === '/admin/activity-logs') return '활동 로그를 확인했습니다.';
  if (path === '/admin/users') return '회원 관리 화면을 열었습니다.';
  if (path === '/admin/contacts') return '문의 관리 화면을 열었습니다.';
  if (path === '/admin/sermon-categories') return '말씀서재 카테고리 관리 화면을 열었습니다.';
  if (path === '/admin/research-categories') return '교회연구실 카테고리 관리 화면을 열었습니다.';
  if (path === '/admin/church-info') return '교회 정보 관리 화면을 열었습니다.';
  if (path === '/admin/notifications') return '알림 발송 화면을 열었습니다.';
  if (path === '/create-post') return '게시글 작성 화면에 진입했습니다.';
  if (path === '/privacy') return '개인정보 처리방침을 확인했습니다.';

  if (path.startsWith('/post/')) return '게시글 상세 페이지를 확인했습니다.';
  if (path.startsWith('/edit-post/')) return '게시글 수정 화면을 열었습니다.';
  if (path.startsWith('/community/')) return '소통 게시판 글을 읽었습니다.';
  if (path.startsWith('/sermons/')) return '말씀서재 콘텐츠를 읽었습니다.';
  if (path.startsWith('/admin/')) return '관리자 메뉴를 사용했습니다.';
  return `${path} 경로를 방문했습니다.`;
};

const roleLabel = (role: string) => {
  if (role === 'admin') return '관리자';
  if (role === 'regular') return '정회원';
  return '일반 회원';
};

const roleColor = (role: string) => {
  if (role === 'admin') return 'bg-red-100 text-red-700';
  if (role === 'regular') return 'bg-green-100 text-green-700';
  return 'bg-gray-100 text-gray-700';
};

export default function AdminActivityLogs() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (role !== 'admin') {
      navigate('/');
      return;
    }

    const fetchLogs = async () => {
      try {
        const logQuery = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(100));
        const snapshot = await getDocs(logQuery);
        const data = snapshot.docs.map((logDoc) => ({
          id: logDoc.id,
          ...logDoc.data(),
        })) as ActivityLog[];
        setLogs(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching activity logs:', error);
        handleFirestoreError(error, OperationType.GET, 'activity_logs');
        setLoading(false);
      }
    };

    fetchLogs();
  }, [role, navigate]);

  const groupedLogs = useMemo(() => {
    const groups = new Map<string, LogGroup>();

    logs.forEach((log) => {
      if (!log.timestamp) return;

      const date = log.timestamp.toDate();
      const dateStr = new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
      const groupId = `${log.uid}-${dateStr}`;

      if (!groups.has(groupId)) {
        groups.set(groupId, {
          id: groupId,
          uid: log.uid,
          email: log.email,
          displayName: log.displayName || log.email.split('@')[0],
          role: log.role,
          dateStr,
          loginTime: log.timestamp,
          lastActivityTime: log.timestamp,
          logs: [],
        });
      }

      const currentGroup = groups.get(groupId)!;
      currentGroup.logs.push(log);

      if (log.timestamp.toMillis() < currentGroup.loginTime.toMillis()) {
        currentGroup.loginTime = log.timestamp;
      }
      if (log.timestamp.toMillis() > currentGroup.lastActivityTime.toMillis()) {
        currentGroup.lastActivityTime = log.timestamp;
      }
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        logs: [...group.logs].reverse(),
      }))
      .sort((a, b) => b.lastActivityTime.toMillis() - a.lastActivityTime.toMillis());
  }, [logs]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '-';
    return new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(timestamp.toDate());
  };

  const summary = useMemo(() => {
    const uniqueUsers = new Set(logs.map((log) => log.uid).filter(Boolean));
    return {
      totalLogs: logs.length,
      sessionCount: groupedLogs.length,
      userCount: uniqueUsers.size,
    };
  }, [logs, groupedLogs]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-wood-50">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-wood-900" />
      </div>
    );
  }

  return (
    <AdminLayout
      title="활동 로그"
      description="최근 사용자 활동을 날짜별 세션 단위로 묶어서, 누가 언제 어떤 흐름으로 이용했는지 한눈에 살펴볼 수 있게 정리했습니다."
      backTo="/admin"
      backLabel="관리자 대시보드"
      badge="유지보수"
      icon={<Activity size={14} />}
      maxWidthClassName="max-w-7xl"
      aside={
        <div className="grid min-w-[220px] gap-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-wood-500">전체 로그</span>
            <strong className="text-wood-900">{summary.totalLogs}</strong>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-wood-500">세션 수</span>
            <strong className="text-wood-900">{summary.sessionCount}</strong>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-wood-500">사용자 수</span>
            <strong className="text-wood-900">{summary.userCount}</strong>
          </div>
        </div>
      }
    >
      <div className="overflow-hidden rounded-[2rem] border border-wood-200 bg-white shadow-sm">
        {groupedLogs.length === 0 ? (
          <div className="p-12 text-center text-wood-500">기록된 활동 로그가 없습니다.</div>
        ) : (
          <div className="divide-y divide-wood-200">
            {groupedLogs.map((group) => {
              const isExpanded = expandedGroups.has(group.id);

              return (
                <div key={group.id}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-wood-50"
                  >
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="rounded-full bg-wood-100 p-3 text-wood-600">
                        <User size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-wood-900">{group.displayName}</span>
                          <span className="truncate text-sm text-wood-500">({group.email})</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${roleColor(group.role)}`}>
                            {roleLabel(group.role)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-wood-600">
                          <span>{group.dateStr}</span>
                          <span>첫 활동 {formatTime(group.loginTime)}</span>
                          <span>마지막 활동 {formatTime(group.lastActivityTime)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-wood-500">
                      <span className="text-sm">{group.logs.length}건</span>
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-wood-100 bg-wood-50/60 px-5 py-6">
                      <div className="relative space-y-5 before:absolute before:bottom-0 before:left-[18px] before:top-0 before:w-0.5 before:bg-wood-200">
                        {group.logs.map((log) => (
                          <div key={log.id} className="relative flex items-start gap-4">
                            <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border border-wood-300 bg-white text-wood-500">
                              <Clock3 size={16} />
                            </div>
                            <div className="min-w-0 flex-1 rounded-[1.25rem] border border-wood-100 bg-white p-4 shadow-sm">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-wood-900">{formatTime(log.timestamp)}</span>
                                <span className="rounded-md bg-wood-100 px-2 py-0.5 text-[11px] font-medium text-wood-700">
                                  {log.activityType || '기타'}
                                </span>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-wood-700">
                                {translateActivity(log.pagePath, log.activityType)}
                              </p>
                              <p className="mt-2 text-xs text-wood-400">{log.pagePath}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
