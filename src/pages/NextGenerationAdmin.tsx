import React, { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot, doc, updateDoc,
  deleteDoc, addDoc, serverTimestamp, orderBy, Timestamp, deleteField,
  getDocs, getDoc, setDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { NextGenerationMember, Department } from '../lib/nextGenerationAuth';
import { getPostAttachments, serializeMaterialAttachments } from '../lib/attachments';
import {
  Users, CheckCircle, XCircle, Trash2, ChevronDown, ChevronUp,
  Bell, MessageSquare, Mail, Clock, Search, ShieldCheck, RefreshCw,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { NEXT_GENERATION_NOTIFICATION_TOPIC } from '../services/notificationService';

interface QAItem {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp;
  isAnswered: boolean;
  answer?: string;
  answeredAt?: Timestamp;
  answeredBy?: string;
}

interface ContactItem {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: Timestamp;
  isRead: boolean;
}

type AdminTab = 'members' | 'qa' | 'contacts' | 'notifications' | 'migration';

interface MigrationRow {
  postId: string;
  title: string;
  status: 'pending' | 'done' | 'skipped' | 'error';
  error?: string;
}

const NEXT_NOTIFICATION_TARGETS = [
  { value: '/next', label: '다음세대 홈' },
  { value: '/next/elementary', label: '초등부 자료' },
  { value: '/next/young-adults', label: '청년부 자료' },
  { value: '/next/contact', label: '문의하기' },
];

const NOTIFICATION_DEPARTMENT_OPTIONS: Department[] = ['청년', '교사', '학부모'];

const DEPT_COLORS: Record<Department, string> = {
  '청년': 'bg-blue-100 text-blue-700',
  '교사': 'bg-green-100 text-green-700',
  '학부모': 'bg-purple-100 text-purple-700',
};

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1 ${ok ? 'text-green-600' : 'text-red-600'}`}>
      {ok ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />} {label}
    </span>
  );
}

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return '-';
  const d = ts.toDate();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function NextGenerationAdmin({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [tab, setTab] = useState<AdminTab>('members');
  const [members, setMembers] = useState<NextGenerationMember[]>([]);
  const [qaItems, setQaItems] = useState<QAItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Reject modal
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // QA answer modal
  const [answerTargetId, setAnswerTargetId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');

  // Migration
  const [migrationRows, setMigrationRows] = useState<MigrationRow[]>([]);
  const [migrationRunning, setMigrationRunning] = useState(false);
  const [migrationScanned, setMigrationScanned] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');
  const [notificationTargetUrl, setNotificationTargetUrl] = useState('/next');
  const [notificationAudience, setNotificationAudience] = useState<'all' | Department[]>('all');
  const [sendingNotification, setSendingNotification] = useState(false);

  // Notification system health
  const [systemHealth, setSystemHealth] = useState<{
    ok: boolean;
    adminInitialized: boolean;
    messagingAvailable: boolean;
    firestoreReachable: boolean;
    activeTokenCount: number;
    error?: string;
  } | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const getRequestHeaders = async () => {
    const idToken = await user?.getIdToken();
    return {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    };
  };

  const checkSystemHealth = async () => {
    setCheckingHealth(true);
    try {
      const idToken = await user?.getIdToken();
      const response = await fetch('/api/notifications/health', {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      });
      const data = await response.json();
      setSystemHealth(data);
    } catch {
      setSystemHealth({
        ok: false,
        adminInitialized: false,
        messagingAvailable: false,
        firestoreReachable: false,
        activeTokenCount: 0,
        error: '상태 확인 중 오류가 발생했습니다.',
      });
    } finally {
      setCheckingHealth(false);
    }
  };

  // Subscribe to members
  useEffect(() => {
    const q = query(collection(db, 'next_generation_members'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setMembers(snap.docs.map(d => ({ ...d.data() } as NextGenerationMember)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  // Subscribe to QA
  useEffect(() => {
    const q = query(collection(db, 'next_generation_qa'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setQaItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as QAItem)));
    });
    return () => unsub();
  }, []);

  // Subscribe to contacts
  useEffect(() => {
    const q = query(collection(db, 'next_generation_contacts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setContacts(snap.docs.map(d => ({ id: d.id, ...d.data() } as ContactItem)));
    });
    return () => unsub();
  }, []);

  const pendingMembers = members.filter(m => m.role === 'pending');
  const approvedMembers = members.filter(m => m.role === 'member');
  const rejectedMembers = members.filter(m => m.role === 'rejected');
  const unreadContacts = contacts.filter(c => !c.isRead).length;
  const unansweredQA = qaItems.filter(q => !q.isAnswered).length;
  const notificationAudienceCount =
    notificationAudience === 'all'
      ? approvedMembers.length
      : approvedMembers.filter((member) => notificationAudience.includes(member.department)).length;

  const toggleAudienceDepartment = (dept: Department) => {
    setNotificationAudience((prev) => {
      const current = prev === 'all' ? [] : prev;
      return current.includes(dept)
        ? current.filter((d) => d !== dept)
        : [...current, dept];
    });
  };

  const filteredMembers = members.filter(m =>
    m.displayName.includes(search) ||
    m.email.includes(search) ||
    m.church.includes(search)
  );

  const approveMember = async (uid: string) => {
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'next_generation_members', uid), {
        role: 'member',
        approvedAt: serverTimestamp(),
        rejectedAt: deleteField(),
        rejectionReason: deleteField(),
      });
      await addDoc(collection(db, 'next_generation_notifications'), {
        uid,
        type: 'approved',
        message: '다음세대 가입 신청이 승인되었습니다.',
        createdAt: serverTimestamp(),
        isRead: false,
      });
      // FCM 푸시 (실패해도 in-app 알림은 이미 저장됨)
      fetch('/api/notifications/send', {
        method: 'POST',
        headers: await getRequestHeaders(),
        body: JSON.stringify({
          title: '다음세대 가입 승인',
          body: '다음세대 가입 신청이 승인되었습니다.',
          targetUrl: '/next',
          targetUserIds: [uid],
          appScope: 'next',
        }),
      }).catch(() => {});
      showToast('✓ 승인되었습니다.');
    } catch {
      showToast('오류가 발생했습니다.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const rejectMember = async () => {
    if (!rejectTargetId) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'next_generation_members', rejectTargetId), {
        role: 'rejected',
        rejectedAt: serverTimestamp(),
        rejectionReason: rejectReason.trim() || '승인 거부',
      });
      await addDoc(collection(db, 'next_generation_notifications'), {
        uid: rejectTargetId,
        type: 'rejected',
        message: '다음세대 가입 신청이 반려되었습니다.',
        rejectionReason: rejectReason.trim() || '승인 거부',
        createdAt: serverTimestamp(),
        isRead: false,
      });
      // FCM 푸시 (실패해도 in-app 알림은 이미 저장됨)
      fetch('/api/notifications/send', {
        method: 'POST',
        headers: await getRequestHeaders(),
        body: JSON.stringify({
          title: '다음세대 가입 반려',
          body: '다음세대 가입 신청이 반려되었습니다.',
          targetUrl: '/next',
          targetUserIds: [rejectTargetId],
          appScope: 'next',
        }),
      }).catch(() => {});
      setRejectTargetId(null);
      setRejectReason('');
      showToast('반려 처리되었습니다.');
    } catch {
      showToast('오류가 발생했습니다.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteMember = async (uid: string) => {
    if (!confirm('회원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    await deleteDoc(doc(db, 'next_generation_members', uid));
  };

  const answerQA = async () => {
    if (!answerTargetId || !answerText.trim()) return;
    setSubmitting(true);
    try {
      const targetItem = qaItems.find(q => q.id === answerTargetId);
      await updateDoc(doc(db, 'next_generation_qa', answerTargetId), {
        answer: answerText.trim(),
        answeredAt: serverTimestamp(),
        answeredBy: '목사님',
        isAnswered: true,
      });
      if (targetItem) {
        const answerMessage = `"${targetItem.title}" 질문에 목사님 답변이 등록되었습니다.`;
        await addDoc(collection(db, 'next_generation_notifications'), {
          uid: targetItem.authorId,
          type: 'answered',
          message: answerMessage,
          createdAt: serverTimestamp(),
          isRead: false,
        });
        // FCM 푸시 (실패해도 in-app 알림은 이미 저장됨)
        fetch('/api/notifications/send', {
          method: 'POST',
          headers: await getRequestHeaders(),
          body: JSON.stringify({
            title: '질문 답변 등록',
            body: answerMessage,
            targetUrl: '/next',
            targetUserIds: [targetItem.authorId],
            appScope: 'next',
          }),
        }).catch(() => {});
      }
      setAnswerTargetId(null);
      setAnswerText('');
    } finally {
      setSubmitting(false);
    }
  };

  const markContactRead = async (id: string) => {
    await updateDoc(doc(db, 'next_generation_contacts', id), { isRead: true });
  };

  const sendNextGenerationNotification = async () => {
    const trimmedTitle = notificationTitle.trim();
    const trimmedBody = notificationBody.trim();
    const trimmedTargetUrl = notificationTargetUrl.trim() || '/next';
    const targetUserIds =
      notificationAudience === 'all'
        ? []
        : approvedMembers
            .filter((member) => notificationAudience.includes(member.department))
            .map((member) => member.uid);

    if (!trimmedTitle || !trimmedBody) {
      showToast('알림 제목과 내용을 입력해 주세요.', 'error');
      return;
    }

    if (!trimmedTargetUrl.startsWith('/next')) {
      showToast('이동 경로는 /next로 시작해야 합니다.', 'error');
      return;
    }

    if (notificationAudience !== 'all' && notificationAudience.length === 0) {
      showToast('대상 역할을 한 개 이상 선택해 주세요.', 'error');
      return;
    }

    if (notificationAudience !== 'all' && targetUserIds.length === 0) {
      showToast('선택한 역할에 해당하는 승인 회원이 없습니다.', 'error');
      return;
    }

    setSendingNotification(true);
    try {
      // in-app notification 대상 uid 목록 (서버에서 Admin SDK로 처리)
      const targetMembers =
        notificationAudience === 'all'
          ? approvedMembers
          : approvedMembers.filter((m) => notificationAudience.includes(m.department));

      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: await getRequestHeaders(),
        body: JSON.stringify({
          title: trimmedTitle,
          body: trimmedBody,
          targetUrl: trimmedTargetUrl,
          useTopic: notificationAudience === 'all' ? NEXT_GENERATION_NOTIFICATION_TOPIC : false,
          targetUserIds: notificationAudience === 'all' ? undefined : targetUserIds,
          appScope: 'next',
          inAppTargetUids: targetMembers.map((m) => m.uid),
          inAppMessage: trimmedBody,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '알림을 보내지 못했습니다.');
      }

      setNotificationTitle('');
      setNotificationBody('');
      setNotificationTargetUrl('/next');
      setNotificationAudience('all');
      showToast('다음세대 알림을 발송했습니다.');
    } catch (error: any) {
      showToast(error?.message || '알림 발송 중 오류가 발생했습니다.', 'error');
    } finally {
      setSendingNotification(false);
    }
  };

  // ── Migration helpers ─────────────────────────────────────────────

  /** Scan all next_generation posts and find those with inline attachment URLs */
  const scanForMigration = async () => {
    setMigrationScanned(false);
    setMigrationRows([]);
    const snap = await getDocs(
      query(collection(db, 'posts'), where('category', '==', 'next_generation'))
    );
    const rows: MigrationRow[] = snap.docs
      .filter(d => {
        const data = d.data();
        return data.pdfUrl || data.pdfBase64 || Array.isArray(data.attachments);
      })
      .map(d => ({ postId: d.id, title: d.data().title || '(제목 없음)', status: 'pending' }));
    setMigrationRows(rows);
    setMigrationScanned(true);
  };

  /** Migrate a single post: move URLs to subcollection and strip from post doc */
  const migratePost = async (index: number, postId: string): Promise<'done' | 'skipped' | string> => {
    const postSnap = await getDoc(doc(db, 'posts', postId));
    if (!postSnap.exists()) return 'skipped';

    const data = postSnap.data() as any;
    const attachments = getPostAttachments(data);
    if (attachments.length === 0) return 'skipped';

    // Skip if file doc already up-to-date (idempotent)
    const existingFileSnap = await getDoc(doc(db, 'next_generation_post_files', postId));
    const alreadyMigrated = existingFileSnap.exists();

    // Write to restricted subcollection (overwrite to ensure fresh data)
    const fileData: any = {
      postId,
      updatedAt: serverTimestamp(),
      pdfBase64: serializeMaterialAttachments(attachments),
    };
    if (data.pdfUrl) {
      fileData.pdfUrl = data.pdfUrl;
      if (data.pdfName) fileData.pdfName = data.pdfName;
    }
    await setDoc(doc(db, 'next_generation_post_files', postId), fileData);

    // Strip inline URL fields from the public post doc
    await updateDoc(doc(db, 'posts', postId), {
      pdfUrl: deleteField(),
      pdfName: deleteField(),
      pdfBase64: deleteField(),
      pdfChunkCount: deleteField(),
      attachments: deleteField(),
      attachmentCount: attachments.length,
    });

    return alreadyMigrated ? 'done' : 'done';
  };

  /** Run migration over all scanned rows with progress tracking */
  const runMigration = async () => {
    if (migrationRows.length === 0) return;
    setMigrationRunning(true);
    const updated = [...migrationRows];
    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], status: 'pending' };
      setMigrationRows([...updated]);
      try {
        const result = await migratePost(i, updated[i].postId);
        updated[i] = { ...updated[i], status: result as 'done' | 'skipped' };
      } catch (err: any) {
        updated[i] = { ...updated[i], status: 'error', error: err?.message || '오류' };
      }
      setMigrationRows([...updated]);
    }
    setMigrationRunning(false);
  };

  const migrationDone = migrationRows.filter(r => r.status === 'done').length;
  const migrationError = migrationRows.filter(r => r.status === 'error').length;
  const migrationPending = migrationRows.filter(r => r.status === 'pending').length;

  const MemberRow = ({ m }: { m: NextGenerationMember }) => {
    const isExpanded = expandedId === m.uid;
    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden mb-2">
        <button
          onClick={() => setExpandedId(isExpanded ? null : m.uid)}
          className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 text-sm">{m.displayName}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DEPT_COLORS[m.department]}`}>
                {m.department}
              </span>
              {m.role === 'pending' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">대기중</span>
              )}
              {m.role === 'member' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">승인</span>
              )}
              {m.role === 'rejected' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">반려</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{m.email} · {m.church} · {formatDate(m.createdAt)}</p>
          </div>
          {isExpanded ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
        </button>

        {isExpanded && (
          <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-3">
            {m.intro && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">자기소개</p>
                <p className="text-sm text-gray-700">{m.intro}</p>
              </div>
            )}
            {m.role === 'rejected' && m.rejectionReason && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">반려 사유</p>
                <p className="text-sm text-red-600">{m.rejectionReason}</p>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              {m.role === 'pending' && (
                <>
                  <button
                    onClick={() => approveMember(m.uid)}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-lg transition-colors disabled:opacity-60"
                  >
                    <CheckCircle size={14} /> 승인
                  </button>
                  <button
                    onClick={() => { setRejectTargetId(m.uid); setRejectReason(''); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
                  >
                    <XCircle size={14} /> 반려
                  </button>
                </>
              )}
              {m.role === 'rejected' && (
                <button
                  onClick={() => approveMember(m.uid)}
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-lg transition-colors disabled:opacity-60"
                >
                  <CheckCircle size={14} /> 승인으로 변경
                </button>
              )}
              <button
                onClick={() => deleteMember(m.uid)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg transition-colors ml-auto"
              >
                <Trash2 size={14} /> 삭제
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-amber-500" />
            <h2 className="text-lg font-bold text-gray-900">다음세대 관리</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {([
            { key: 'members', label: '회원 관리', badge: pendingMembers.length },
            { key: 'qa', label: 'Q&A', badge: unansweredQA },
            { key: 'contacts', label: '문의', badge: unreadContacts },
            { key: 'migration', label: '자료 이전', badge: 0 },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.badge > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none min-w-[18px] text-center">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="text-center py-8 text-gray-400 text-sm">로딩 중...</div>
          )}

          {/* MEMBERS TAB */}
          {!loading && tab === 'members' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="이름, 이메일, 교회 검색"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              {/* 알림 시스템 상태 */}
              <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <ShieldCheck size={13} />
                    알림 시스템 상태
                  </p>
                  <button
                    type="button"
                    onClick={checkSystemHealth}
                    disabled={checkingHealth}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw size={11} className={checkingHealth ? 'animate-spin' : ''} />
                    {checkingHealth ? '확인 중...' : '상태 확인'}
                  </button>
                </div>
                {!systemHealth && !checkingHealth && (
                  <p className="mt-2 text-xs text-gray-400">"상태 확인" 버튼을 눌러 Firebase 연결 상태를 확인하세요.</p>
                )}
                {systemHealth && (
                  <div className="mt-2 space-y-1">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <StatusRow ok={systemHealth.adminInitialized} label="Firebase Admin" />
                      <StatusRow ok={systemHealth.messagingAvailable} label="FCM 메시징" />
                      <StatusRow ok={systemHealth.firestoreReachable} label="Firestore" />
                      <span className="text-gray-600">
                        활성 토큰 <strong>{systemHealth.activeTokenCount}</strong>개 (최근 30일)
                      </span>
                    </div>
                    {systemHealth.error && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertTriangle size={11} /> {systemHealth.error}
                      </p>
                    )}
                    {systemHealth.ok && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 size={11} /> 모든 시스템 정상
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="mb-3 flex items-start gap-2">
                  <Bell size={16} className="mt-0.5 text-amber-600" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">다음세대 푸시 알림 보내기</p>
                    <p className="mt-1 text-xs leading-5 text-amber-800">
                      여기서 보낸 알림은 다음세대 앱에서 알림을 허용한 사용자에게만 전달되고, 누르면 아래에서 정한 `/next` 경로로 이동합니다.
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm text-gray-800">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationAudience === 'all'}
                          onChange={(e) =>
                            setNotificationAudience(e.target.checked ? 'all' : [])
                          }
                          className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-400"
                        />
                        <span className="font-medium">전체 회원</span>
                      </label>
                      <span className="text-amber-300">|</span>
                      {NOTIFICATION_DEPARTMENT_OPTIONS.map((dept) => {
                        const checked =
                          notificationAudience !== 'all' && notificationAudience.includes(dept);
                        return (
                          <label key={dept} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={notificationAudience === 'all'}
                              onChange={() => toggleAudienceDepartment(dept)}
                              className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-400 disabled:opacity-40"
                            />
                            <span className={notificationAudience === 'all' ? 'text-gray-400' : ''}>
                              {dept}
                            </span>
                          </label>
                        );
                      })}
                      <span className="ml-auto text-xs text-gray-600">
                        현재 대상 {notificationAudienceCount}명
                      </span>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={notificationTitle}
                    onChange={(e) => setNotificationTitle(e.target.value)}
                    placeholder="알림 제목"
                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <textarea
                    value={notificationBody}
                    onChange={(e) => setNotificationBody(e.target.value)}
                    rows={3}
                    placeholder="알림 내용"
                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  />
                  <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                    <select
                      value={NEXT_NOTIFICATION_TARGETS.some((entry) => entry.value === notificationTargetUrl) ? notificationTargetUrl : '__custom__'}
                      onChange={(e) => {
                        if (e.target.value !== '__custom__') {
                          setNotificationTargetUrl(e.target.value);
                        }
                      }}
                      className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      {NEXT_NOTIFICATION_TARGETS.map((entry) => (
                        <option key={entry.value} value={entry.value}>
                          {entry.label}
                        </option>
                      ))}
                      <option value="__custom__">직접 입력</option>
                    </select>
                    <input
                      type="text"
                      value={notificationTargetUrl}
                      onChange={(e) => setNotificationTargetUrl(e.target.value)}
                      placeholder="/next/elementary"
                      className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-amber-700">예: `/next`, `/next/young-adults`, `/next/post/문서ID`</p>
                    <button
                      type="button"
                      onClick={sendNextGenerationNotification}
                      disabled={sendingNotification}
                      className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
                    >
                      <Bell size={14} />
                      {sendingNotification ? '보내는 중...' : '다음세대 알림 보내기'}
                    </button>
                  </div>
                </div>
              </div>

              {pendingMembers.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Clock size={12} /> 승인 대기 ({pendingMembers.length})
                  </p>
                  {(search ? filteredMembers.filter(m => m.role === 'pending') : pendingMembers).map(m => (
                    <MemberRow key={m.uid} m={m} />
                  ))}
                </div>
              )}

              {approvedMembers.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <CheckCircle size={12} /> 승인된 회원 ({approvedMembers.length})
                  </p>
                  {(search ? filteredMembers.filter(m => m.role === 'member') : approvedMembers).map(m => (
                    <MemberRow key={m.uid} m={m} />
                  ))}
                </div>
              )}

              {rejectedMembers.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <XCircle size={12} /> 반려된 신청 ({rejectedMembers.length})
                  </p>
                  {(search ? filteredMembers.filter(m => m.role === 'rejected') : rejectedMembers).map(m => (
                    <MemberRow key={m.uid} m={m} />
                  ))}
                </div>
              )}

              {members.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Users size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">가입 신청이 없습니다.</p>
                </div>
              )}
            </div>
          )}

          {/* QA TAB */}
          {!loading && tab === 'qa' && (
            <div className="space-y-3">
              {qaItems.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <MessageSquare size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">등록된 질문이 없습니다.</p>
                </div>
              )}
              {qaItems.map(item => {
                const isExpanded = expandedId === item.id;
                return (
                  <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="w-full flex items-start gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            item.isAnswered ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {item.isAnswered ? '답변완료' : '미답변'}
                          </span>
                          <span className="text-xs text-gray-400">{item.authorName} · {formatDate(item.createdAt)}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                      </div>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400 mt-0.5 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-3">
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">질문</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.content}</p>
                        </div>
                        {item.isAnswered && item.answer && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <p className="text-xs font-medium text-amber-600 mb-1">목사님 답변 ({formatDate(item.answeredAt)})</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.answer}</p>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setAnswerTargetId(item.id); setAnswerText(item.answer || ''); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded-lg transition-colors"
                          >
                            <MessageSquare size={14} /> {item.isAnswered ? '답변 수정' : '답변하기'}
                          </button>
                          <button
                            onClick={() => deleteDoc(doc(db, 'next_generation_qa', item.id))}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg transition-colors ml-auto"
                          >
                            <Trash2 size={14} /> 삭제
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* MIGRATION TAB */}
          {tab === 'migration' && (
            <div>
              {/* Description */}
              <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-4 mb-4">
                <ShieldCheck size={20} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800 space-y-1">
                  <p className="font-semibold">자료 URL 보안 이전</p>
                  <p>이전에 등록된 다음세대 자료 중 PDF/첨부파일 URL이 공개 문서에 저장된 게시물을 찾아, 정회원 전용 보안 저장소로 이전합니다.</p>
                  <p className="text-xs text-amber-600">이전 후에는 기존 다운로드 링크가 그대로 유지되며 정회원만 접근 가능해집니다.</p>
                </div>
              </div>

              {/* Step 1: Scan */}
              <div className="mb-4">
                <button
                  onClick={scanForMigration}
                  disabled={migrationRunning}
                  className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                >
                  <Search size={15} />
                  이전 대상 게시물 검색
                </button>
              </div>

              {migrationScanned && (
                <>
                  {/* Scan result summary */}
                  {migrationRows.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700 mb-4">
                      <CheckCircle2 size={18} />
                      <span>이전이 필요한 게시물이 없습니다. 모두 안전합니다.</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-gray-700">
                          이전 대상: <span className="font-bold text-amber-600">{migrationRows.length}개</span>
                          {migrationDone > 0 && (
                            <span className="ml-2 text-emerald-600">✓ 완료 {migrationDone}</span>
                          )}
                          {migrationError > 0 && (
                            <span className="ml-2 text-red-500">✗ 오류 {migrationError}</span>
                          )}
                        </p>
                        <button
                          onClick={runMigration}
                          disabled={migrationRunning || migrationPending === 0}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                        >
                          {migrationRunning
                            ? <><RefreshCw size={14} className="animate-spin" /> 이전 중...</>
                            : <><ShieldCheck size={14} /> 일괄 이전 실행</>}
                        </button>
                      </div>

                      {/* Progress bar */}
                      {migrationRunning && (
                        <div className="mb-3">
                          <div className="h-2 w-full rounded-full bg-gray-200">
                            <div
                              className="h-2 rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${Math.round((migrationDone + migrationError) / migrationRows.length * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Row list */}
                      <div className="space-y-1.5 max-h-72 overflow-y-auto">
                        {migrationRows.map(row => (
                          <div
                            key={row.postId}
                            className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                              row.status === 'done'    ? 'border-emerald-200 bg-emerald-50' :
                              row.status === 'error'   ? 'border-red-200 bg-red-50' :
                              row.status === 'skipped' ? 'border-gray-200 bg-gray-50' :
                                                         'border-gray-200 bg-white'
                            }`}
                          >
                            <span className="flex-shrink-0">
                              {row.status === 'done'    && <CheckCircle2 size={15} className="text-emerald-500" />}
                              {row.status === 'error'   && <AlertTriangle size={15} className="text-red-500" />}
                              {row.status === 'skipped' && <span className="text-gray-400 text-xs">-</span>}
                              {row.status === 'pending' && (
                                migrationRunning
                                  ? <RefreshCw size={14} className="animate-spin text-sky-400" />
                                  : <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-gray-300" />
                              )}
                            </span>
                            <span className="flex-1 truncate text-gray-800 font-medium">{row.title}</span>
                            <span className="flex-shrink-0 text-xs text-gray-400">
                              {row.status === 'done'    && '완료'}
                              {row.status === 'error'   && (row.error || '오류')}
                              {row.status === 'skipped' && '건너뜀'}
                              {row.status === 'pending' && '대기'}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* All done message */}
                      {!migrationRunning && migrationPending === 0 && migrationDone > 0 && (
                        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 mt-3 text-sm text-emerald-700">
                          <CheckCircle2 size={16} />
                          <span>이전 완료. 자료 URL이 정회원 전용 저장소로 안전하게 이동되었습니다.</span>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* CONTACTS TAB */}
          {!loading && tab === 'contacts' && (
            <div className="space-y-3">
              {contacts.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Mail size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">등록된 문의가 없습니다.</p>
                </div>
              )}
              {contacts.map(item => {
                const isExpanded = expandedId === item.id;
                return (
                  <div key={item.id} className={`border rounded-lg overflow-hidden ${!item.isRead ? 'border-amber-300' : 'border-gray-200'}`}>
                    <button
                      onClick={() => {
                        setExpandedId(isExpanded ? null : item.id);
                        if (!item.isRead) markContactRead(item.id);
                      }}
                      className="w-full flex items-start gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          {!item.isRead && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">새 문의</span>
                          )}
                          <span className="text-xs text-gray-400">{item.name} · {item.email} · {formatDate(item.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-700 truncate">{item.message}</p>
                      </div>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400 mt-0.5 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-2">
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">문의 내용</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.message}</p>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <a
                            href={`mailto:${item.email}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded-lg transition-colors"
                          >
                            <Mail size={14} /> 이메일 답장
                          </a>
                          <button
                            onClick={() => deleteDoc(doc(db, 'next_generation_contacts', item.id))}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg transition-colors"
                          >
                            <Trash2 size={14} /> 삭제
                          </button>
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

      {/* Toast */}
      {toast && (
        <div className={`absolute bottom-5 left-1/2 -translate-x-1/2 z-20 px-4 py-2.5 rounded-lg shadow-lg text-sm font-semibold text-white transition-all ${
          toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Reject Modal */}
      {rejectTargetId && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-gray-900 mb-3">가입 신청 반려</h3>
            <p className="text-sm text-gray-600 mb-3">반려 사유를 입력해 주세요. 신청자에게 전달됩니다.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-4"
              placeholder="반려 사유 (선택)"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setRejectTargetId(null); setRejectReason(''); }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={rejectMember}
                disabled={submitting}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                반려
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Answer Modal */}
      {answerTargetId && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-900 mb-3">Q&A 답변</h3>
            <textarea
              value={answerText}
              onChange={e => setAnswerText(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none mb-4"
              placeholder="답변을 입력해 주세요"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setAnswerTargetId(null); setAnswerText(''); }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={answerQA}
                disabled={submitting || !answerText.trim()}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                답변 등록
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
