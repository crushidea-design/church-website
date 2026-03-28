import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { Activity, ArrowLeft, ChevronDown, ChevronRight, User } from 'lucide-react';

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
  id: string; // uid + dateStr
  uid: string;
  email: string;
  displayName: string;
  role: string;
  dateStr: string;
  loginTime: any; // Earliest log in this group
  lastActivityTime: any; // Latest log in this group
  logs: ActivityLog[];
}

const translatePath = (path: string, activityType: string, postsMap: Record<string, any>) => {
  if (activityType === '기도 응원 참여') return '기도 응원에 참여했습니다.';
  if (path === '/') return '홈 화면에 방문했습니다.';
  if (path === '/login') return '로그인 했습니다.';
  if (path === '/prayer-room') return '기도방에 입장했습니다.';
  if (path === '/community') return '소통 게시판에 입장했습니다.';
  if (path === '/community/new') return '소통 게시판에 새 글을 작성하기 시작했습니다.';
  if (path === '/sermons') return '말씀 서재에 입장했습니다.';
  if (path === '/sermons/new') return '말씀 서재에 새 설교를 작성하기 시작했습니다.';
  if (path === '/research') return '교회 연구실에 입장했습니다.';
  if (path === '/profile') return '내 프로필을 확인했습니다.';
  if (path === '/admin') return '관리자 페이지에 입장했습니다.';
  if (path === '/admin/activity-logs') return '디지털 출석부를 확인했습니다.';
  
  if (path.startsWith('/post/')) {
    const postId = path.split('/')[2];
    const postTitle = postsMap[postId]?.title;
    if (postTitle) {
      return `"${postTitle}" 글을 열어보았습니다.`;
    } else {
      return '게시글을 열어보았습니다. (삭제된 글이거나 로딩 중)';
    }
  }

  if (path.startsWith('/community/')) return '소통 게시판의 글을 읽었습니다.';
  if (path.startsWith('/sermons/')) return '말씀 서재의 설교를 읽었습니다.';
  if (path.startsWith('/admin/')) return '관리자 메뉴를 이용했습니다.';
  return `${path} 페이지에 방문했습니다.`;
};

export default function AdminActivityLogs() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [postsMap, setPostsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (role !== 'admin') {
      navigate('/');
      return;
    }

    const fetchUsersAndPosts = async () => {
      try {
        const [usersSnap, postsSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'posts'))
        ]);
        
        const uMap: Record<string, any> = {};
        usersSnap.forEach(doc => { uMap[doc.id] = doc.data(); });
        setUsersMap(uMap);

        const pMap: Record<string, any> = {};
        postsSnap.forEach(doc => { pMap[doc.id] = doc.data(); });
        setPostsMap(pMap);
      } catch (error) {
        console.error("Failed to fetch users or posts:", error);
      }
    };
    fetchUsersAndPosts();

    const q = query(
      collection(db, 'activity_logs'),
      orderBy('timestamp', 'desc'),
      limit(500)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ActivityLog[];
      setLogs(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [role, navigate]);

  const groupedLogs = useMemo(() => {
    const groups = new Map<string, LogGroup>();
    
    logs.forEach(log => {
      if (!log.timestamp) return;
      const date = log.timestamp.toDate();
      const dateStr = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
      const groupId = `${log.uid}-${dateStr}`;
      
      if (!groups.has(groupId)) {
        groups.set(groupId, {
          id: groupId,
          uid: log.uid,
          email: log.email,
          displayName: log.displayName || usersMap[log.uid]?.displayName || log.email.split('@')[0],
          role: log.role,
          dateStr: dateStr,
          loginTime: log.timestamp, 
          lastActivityTime: log.timestamp,
          logs: []
        });
      }
      
      const group = groups.get(groupId)!;
      group.logs.push(log);
      
      // Since logs are sorted desc, the last one we process is the earliest (login time)
      if (log.timestamp.toMillis() < group.loginTime.toMillis()) {
        group.loginTime = log.timestamp;
      }
      if (log.timestamp.toMillis() > group.lastActivityTime.toMillis()) {
        group.lastActivityTime = log.timestamp;
      }
    });
    
    return Array.from(groups.values())
      .map(group => ({
        ...group,
        logs: group.logs.reverse() // Reverse to show chronologically (oldest first)
      }))
      .sort((a, b) => b.lastActivityTime.toMillis() - a.lastActivityTime.toMillis());
  }, [logs, usersMap]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
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
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(date);
  };

  if (loading) return <div className="min-h-screen bg-wood-100 flex items-center justify-center">로딩 중...</div>;

  return (
    <div className="min-h-screen bg-wood-100 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/admin')} className="p-2 hover:bg-wood-200 rounded-full transition">
              <ArrowLeft size={24} className="text-wood-600" />
            </button>
            <h1 className="text-3xl font-serif font-bold text-wood-900 flex items-center gap-3">
              <Activity className="text-gold-500" />
              디지털 출석부 (활동 로그)
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-wood-200 overflow-hidden">
          {groupedLogs.length === 0 ? (
            <div className="p-8 text-center text-wood-500">기록된 활동이 없습니다.</div>
          ) : (
            <div className="divide-y divide-wood-200">
              {groupedLogs.map(group => {
                const isExpanded = expandedGroups.has(group.id);
                return (
                  <div key={group.id} className="flex flex-col">
                    {/* Group Header (Login Record) */}
                    <div 
                      onClick={() => toggleGroup(group.id)}
                      className="flex items-center justify-between p-4 hover:bg-wood-50 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-wood-100 rounded-full text-wood-600">
                          <User size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-wood-900">{group.displayName}</span>
                            <span className="text-sm text-wood-500">({group.email})</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              group.role === 'admin' ? 'bg-red-100 text-red-700' :
                              group.role === 'regular' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {group.role === 'admin' ? '목사님' : group.role === 'regular' ? '정회원' : '준회원'}
                            </span>
                          </div>
                          <div className="text-sm text-wood-600 mt-1">
                            {group.dateStr} 접속 (첫 활동: {formatTime(group.loginTime)})
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-wood-500">
                        <span className="text-sm">{group.logs.length}건의 활동</span>
                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </div>
                    </div>

                    {/* Expanded Logs */}
                    {isExpanded && (
                      <div className="bg-wood-50 border-t border-wood-100 p-4 pl-16">
                        <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-[11px] before:w-0.5 before:bg-wood-200">
                          {group.logs.map((log, index) => (
                            <div key={log.id} className="relative flex items-start gap-4">
                              <div className="absolute left-0 w-6 h-6 bg-white border-2 border-wood-300 rounded-full flex items-center justify-center z-10 -ml-[11px]">
                                <div className="w-2 h-2 bg-wood-400 rounded-full"></div>
                              </div>
                              <div className="ml-8 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-wood-900">
                                    {formatTime(log.timestamp)}
                                  </span>
                                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium ${
                                    log.activityType === '페이지 방문' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                    log.activityType === '기도 응원 참여' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                                    'bg-wood-200 text-wood-700'
                                  }`}>
                                    {log.activityType}
                                  </span>
                                </div>
                                <div className="text-sm text-wood-700 mt-1">
                                  {translatePath(log.pagePath, log.activityType, postsMap)}
                                </div>
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
      </div>
    </div>
  );
}
