import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, onSnapshot, doc, updateDoc,
  deleteDoc, addDoc, serverTimestamp, orderBy, Timestamp, deleteField,
  getDocs, getDoc, setDoc, arrayUnion, writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { NextGenerationMember, Department, NEXT_GENERATION_DEPARTMENTS, useNextGenerationAuth } from '../lib/nextGenerationAuth';
import { getPostAttachments, serializeMaterialAttachments } from '../lib/attachments';
import { buildNextGenerationClassDashboard } from '../lib/nextGenerationClassDashboard';
import {
  AttendanceDoc,
  ATTENDANCE_COLLECTION,
  getRecentSundayWeekKeys,
  setAttendanceBatch,
} from '../features/word-fruit/attendanceApi';
import {
  Users, CheckCircle, XCircle, Trash2, ChevronDown, ChevronUp,
  Bell, MessageSquare, Mail, Clock, Search, ShieldCheck, RefreshCw,
  AlertTriangle, CheckCircle2, BookOpen,
} from 'lucide-react';
import { NEXT_GENERATION_NOTIFICATION_TOPIC } from '../services/notificationService';
import BibleReadingChart from './BibleReadingChart';
import WordFruitSettings from '../features/word-fruit/WordFruitSettings';

import {
  AdminTab,
  ClassReadingDoc,
  ContactItem,
  DEPT_COLORS,
  MigrationRow,
  NEXT_NOTIFICATION_TARGETS,
  NOTIFICATION_DEPARTMENT_OPTIONS,
  QADepartment,
  QAItem,
  QA_DEPARTMENT_BADGE,
  QA_DEPARTMENT_LABEL,
  StatusRow,
  formatActivityDate,
  formatAdminDate as formatDate,
} from '../features/next-generation/adminHelpers';

export default function NextGenerationAdmin({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { member: nextMember, isPastor: isNextGenerationPastor } = useNextGenerationAuth();
  const [tab, setTab] = useState<AdminTab>('members');
  const [members, setMembers] = useState<NextGenerationMember[]>([]);
  const [qaItems, setQaItems] = useState<QAItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [classReadings, setClassReadings] = useState<ClassReadingDoc[]>([]);
  const [classAttendance, setClassAttendance] = useState<AttendanceDoc[]>([]);
  const [attendanceDrafts, setAttendanceDrafts] = useState<Record<string, boolean>>({});
  const [savingAttendanceGroup, setSavingAttendanceGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classSearch, setClassSearch] = useState('');
  const [classGroupFilter, setClassGroupFilter] = useState('all');
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

  // Q&A filter
  const [qaFilter, setQaFilter] = useState<'all' | QADepartment>('all');
  const [qaBackfilling, setQaBackfilling] = useState(false);

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

  // Subscribe to student Bible-reading progress for the class dashboard
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'next_generation_bible_reading'), (snap) => {
      setClassReadings(snap.docs.map(d => ({ uid: d.id, ...d.data() } as ClassReadingDoc)));
    }, () => setClassReadings([]));
    return () => unsub();
  }, []);

  const attendanceWeekKeys = useMemo(() => getRecentSundayWeekKeys(4), []);
  const currentAttendanceWeekKey = attendanceWeekKeys[0] ?? '';

  // Subscribe to attendance records for the class dashboard
  useEffect(() => {
    const q = query(collection(db, ATTENDANCE_COLLECTION), where('weekKey', 'in', attendanceWeekKeys.slice(0, 10)));
    const unsub = onSnapshot(q, (snap) => {
      setClassAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceDoc)));
    }, () => setClassAttendance([]));
    return () => unsub();
  }, [attendanceWeekKeys]);

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
  const studentDepartment = NEXT_GENERATION_DEPARTMENTS[3];
  const teacherGroupIds = !isNextGenerationPastor && nextMember?.groupIds?.length
    ? nextMember.groupIds
    : undefined;
  const classDashboard = useMemo(() => buildNextGenerationClassDashboard({
    members,
    readings: classReadings,
    qaItems,
    attendanceItems: classAttendance,
    currentWeekKey: currentAttendanceWeekKey,
    recentWeekKeys: attendanceWeekKeys,
    studentDepartment,
    visibleGroupIds: teacherGroupIds,
  }), [attendanceWeekKeys, classAttendance, classReadings, currentAttendanceWeekKey, members, qaItems, studentDepartment, teacherGroupIds]);
  const visibleClassGroups = classDashboard.groups.filter((group) =>
    classGroupFilter === 'all' ? true : group.groupId === classGroupFilter
  );
  const normalizedClassSearch = classSearch.trim().toLowerCase();
  const filteredClassGroups = visibleClassGroups
    .map((group) => ({
      ...group,
      students: normalizedClassSearch
        ? group.students.filter((student) =>
            `${student.displayName ?? ''} ${student.email ?? ''} ${student.church ?? ''} ${student.groupLabel}`
              .toLowerCase()
              .includes(normalizedClassSearch)
          )
        : group.students,
    }))
    .filter((group) => group.students.length > 0);
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

  const getAttendanceChecked = (studentUid: string, fallbackPresent: boolean) =>
    attendanceDrafts[studentUid] ?? fallbackPresent;

  const setAttendanceDraft = (studentUid: string, present: boolean) => {
    setAttendanceDrafts((drafts) => ({ ...drafts, [studentUid]: present }));
  };

  const saveGroupAttendance = async (group: typeof classDashboard.groups[number]) => {
    if (!user || !currentAttendanceWeekKey) return;
    const fullGroup = classDashboard.groups.find((item) => item.groupId === group.groupId) || group;
    setSavingAttendanceGroup(group.groupId);
    try {
      await setAttendanceBatch(fullGroup.students.map((student) => ({
        weekKey: currentAttendanceWeekKey,
        sundayDate: currentAttendanceWeekKey,
        studentUid: student.uid,
        studentName: student.displayName || '이름 없음',
        groupId: student.groupId,
        present: getAttendanceChecked(student.uid, student.currentAttendanceStatus === 'present'),
        checkedBy: user.uid,
      })));
      setAttendanceDrafts((drafts) => {
        const next = { ...drafts };
        fullGroup.students.forEach((student) => delete next[student.uid]);
        return next;
      });
      showToast('출석부를 저장했습니다.');
    } catch {
      showToast('출석부 저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setSavingAttendanceGroup(null);
    }
  };

  const approveMember = async (uid: string) => {
    setSubmitting(true);
    try {
      const target = members.find((m) => m.uid === uid);
      const batch = writeBatch(db);
      batch.update(doc(db, 'next_generation_members', uid), {
        role: 'member',
        approvedAt: serverTimestamp(),
        rejectedAt: deleteField(),
        rejectionReason: deleteField(),
      });

      // Auto-link student → parent via parentEmail
      if (target?.department === '학생' && (target as any).parentEmail) {
        const parentEmail = String((target as any).parentEmail).trim().toLowerCase();
        const parent = members.find(
          (m) => m.department === '학부모' && m.role === 'member' && m.email?.toLowerCase() === parentEmail,
        );
        if (parent) {
          batch.update(doc(db, 'next_generation_members', parent.uid), {
            childIds: arrayUnion(uid),
          });
        }
      }
      await batch.commit();
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

  const toggleNextGenerationAdmin = async (member: NextGenerationMember) => {
    const nextValue = !member.isNextGenerationAdmin;
    if (member.uid === user?.uid && !nextValue) {
      showToast('자기 자신의 관리자 권한은 해제할 수 없습니다.', 'error');
      return;
    }

    const message = nextValue
      ? `${member.displayName} 님에게 다음세대 관리자 권한을 부여하시겠습니까?`
      : `${member.displayName} 님의 다음세대 관리자 권한을 해제하시겠습니까?`;
    if (!confirm(message)) return;

    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'next_generation_members', member.uid), {
        isNextGenerationAdmin: nextValue,
      });
      showToast(nextValue ? '관리자 권한을 부여했습니다.' : '관리자 권한을 해제했습니다.');
    } catch {
      showToast('관리자 권한 변경 중 오류가 발생했습니다.', 'error');
    } finally {
      setSubmitting(false);
    }
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

  const backfillQaDepartments = async () => {
    if (!confirm('부서 미지정 질문을 모두 청년부로 보정하시겠습니까?\n(이 작업은 안전하게 1회만 수행됩니다.)')) return;
    setQaBackfilling(true);
    try {
      const targets = qaItems.filter((q) => !q.department);
      let updated = 0;
      for (const item of targets) {
        await updateDoc(doc(db, 'next_generation_qa', item.id), {
          department: 'young-adults',
        });
        updated += 1;
      }
      showToast(`${updated}건의 질문에 부서 정보를 보정했습니다.`);
    } catch (err) {
      showToast('부서 보정 중 오류가 발생했습니다.', 'error');
    } finally {
      setQaBackfilling(false);
    }
  };

  const backfillQaPrivacy = async () => {
    if (!confirm('isPrivate 필드가 없는 질문을 모두 공개(false)로 표시하시겠습니까?\n이 보정 후에야 일반 회원이 기존 질문을 정상적으로 볼 수 있습니다.')) return;
    setQaBackfilling(true);
    try {
      const targets = qaItems.filter((q) => typeof q.isPrivate !== 'boolean');
      let updated = 0;
      for (const item of targets) {
        await updateDoc(doc(db, 'next_generation_qa', item.id), {
          isPrivate: false,
        });
        updated += 1;
      }
      showToast(`${updated}건의 질문에 공개 표시를 부여했습니다.`);
    } catch (err) {
      showToast('공개 여부 보정 중 오류가 발생했습니다.', 'error');
    } finally {
      setQaBackfilling(false);
    }
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
              {m.isNextGenerationAdmin && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-900 text-white font-medium">
                  <ShieldCheck size={11} /> 관리자
                </span>
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
              {m.role === 'member' && (
                <button
                  onClick={() => toggleNextGenerationAdmin(m)}
                  disabled={submitting}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-60 ${
                    m.isNextGenerationAdmin
                      ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  <ShieldCheck size={14} />
                  {m.isNextGenerationAdmin ? '관리자 해제' : '관리자 부여'}
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:p-4">
      <div className="my-3 flex w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl max-h-[calc(100vh-1.5rem)] sm:my-6 sm:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-5 sm:py-5">
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
        <div className="border-b border-gray-200 px-2 sm:px-3">
          <div className="overflow-x-auto overflow-y-hidden">
            <div className="flex min-w-max items-stretch gap-1">
          {([
            { key: 'members', label: '회원 관리', badge: pendingMembers.length },
            { key: 'bibleReading', label: '성경 읽기', badge: 0 },
            { key: 'classes', label: '반별 관리', badge: classDashboard.totalUnansweredQuestions },
            { key: 'qa', label: 'Q&A', badge: unansweredQA },
            { key: 'contacts', label: '문의', badge: unreadContacts },
            { key: 'wordFruit', label: '말씀 열매', badge: 0 },
            { key: 'migration', label: '자료 이전', badge: 0 },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-t-xl border-b-2 px-3 py-3 text-sm font-medium leading-5 transition-colors sm:px-4 ${
                tab === t.key
                  ? 'border-amber-500 bg-amber-50 text-amber-600'
                  : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.badge > 0 && (
                <span className="min-w-[18px] rounded-full bg-red-500 px-1.5 py-0.5 text-center text-xs leading-none text-white">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading && (
            <div className="text-center py-8 text-gray-400 text-sm">로딩 중...</div>
          )}

          {/* MEMBERS TAB */}
          {!loading && tab === 'members' && (
            <div>
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="pr-2">
                    <p className="text-sm font-semibold text-amber-900">학생 성경 읽기 기록표</p>
                    <p className="mt-1 text-xs leading-5 text-amber-800">
                      학생별 성경 읽기 기록표를 열어 읽은 책을 바로 색칠하거나 해제할 수 있습니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('bibleReading')}
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
                  >
                    <BookOpen size={14} />
                    기록표 열기
                  </button>
                </div>
              </div>

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

          {!loading && tab === 'classes' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">교사용 반별 관리 대시보드</p>
                    <p className="mt-1 text-xs leading-5 text-emerald-800">
                      승인된 학생을 반별로 묶고 성경읽기, 질문, 미답변 상태를 한눈에 확인합니다.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div className="rounded-lg bg-white px-3 py-2 text-center shadow-sm">
                      <p className="font-bold text-slate-400">학생</p>
                      <p className="mt-1 text-lg font-black text-emerald-900">{classDashboard.totalStudents}</p>
                    </div>
                    <div className="rounded-lg bg-white px-3 py-2 text-center shadow-sm">
                      <p className="font-bold text-slate-400">완료 권수</p>
                      <p className="mt-1 text-lg font-black text-emerald-900">{classDashboard.totalCompletedBooks}</p>
                    </div>
                    <div className="rounded-lg bg-white px-3 py-2 text-center shadow-sm">
                      <p className="font-bold text-slate-400">질문</p>
                      <p className="mt-1 text-lg font-black text-emerald-900">{classDashboard.totalQuestions}</p>
                    </div>
                    <div className="rounded-lg bg-white px-3 py-2 text-center shadow-sm">
                      <p className="font-bold text-slate-400">미답변</p>
                      <p className="mt-1 text-lg font-black text-amber-700">{classDashboard.totalUnansweredQuestions}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-xl border border-sky-100 bg-white px-3 py-3 text-center shadow-sm">
                  <p className="font-bold text-slate-400">이번 주 출석</p>
                  <p className="mt-1 text-lg font-black text-sky-700">{classDashboard.currentPresentCount}</p>
                </div>
                <div className="rounded-xl border border-rose-100 bg-white px-3 py-3 text-center shadow-sm">
                  <p className="font-bold text-slate-400">이번 주 미출석</p>
                  <p className="mt-1 text-lg font-black text-rose-700">{classDashboard.currentAbsentCount}</p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-white px-3 py-3 text-center shadow-sm">
                  <p className="font-bold text-slate-400">미체크</p>
                  <p className="mt-1 text-lg font-black text-amber-700">{classDashboard.currentUncheckedCount}</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-white px-3 py-3 text-center shadow-sm">
                  <p className="font-bold text-slate-400">최근 4주 출석률</p>
                  <p className="mt-1 text-lg font-black text-emerald-700">{classDashboard.recentAttendancePercent}%</p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={classSearch}
                    onChange={e => setClassSearch(e.target.value)}
                    placeholder="학생 이름, 이메일, 교회 검색"
                    className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <select
                  value={classGroupFilter}
                  onChange={(e) => setClassGroupFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <option value="all">전체 반</option>
                  {classDashboard.groups.map((group) => (
                    <option key={group.groupId} value={group.groupId}>
                      {group.groupLabel} ({group.students.length})
                    </option>
                  ))}
                </select>
              </div>

              {filteredClassGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
                  조건에 맞는 승인 학생이 없습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredClassGroups.map((group) => (
                    <section key={group.groupId} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-sm font-black text-emerald-950">{group.groupLabel}</h3>
                          <p className="mt-1 text-xs font-bold text-slate-500">
                            이번 주 출석 {group.currentPresentCount}명 · 미출석 {group.currentAbsentCount}명 · 미체크 {group.currentUncheckedCount}명 · 최근 4주 {group.recentAttendancePercent}%
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-500">
                            학생 {group.students.length}명 · 완료 {group.totalCompletedBooks}권 · 미답변 {group.totalUnansweredQuestions}개
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => saveGroupAttendance(group)}
                          disabled={savingAttendanceGroup === group.groupId || group.students.length === 0}
                          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-sky-600 px-3 py-2 text-xs font-black text-white transition hover:bg-sky-700 disabled:opacity-60"
                        >
                          {savingAttendanceGroup === group.groupId ? '저장 중...' : '출석 저장'}
                        </button>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {group.students.map((student) => (
                          <div key={student.uid} className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1.2fr)_120px_120px_120px_90px] sm:items-center">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-black text-slate-900">{student.displayName || '이름 없음'}</p>
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                                  {student.groupLabel}
                                </span>
                              </div>
                              <p className="mt-1 truncate text-xs font-medium text-slate-500">
                                {student.email || '-'} · {student.church || '-'}
                              </p>
                            </div>
                            <div>
                              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                                <span>성경읽기</span>
                                <span>{student.completedBooks}/66</span>
                              </div>
                              <div className="mt-1 h-2 rounded-full bg-slate-100">
                                <div
                                  className="h-2 rounded-full bg-emerald-500"
                                  style={{ width: `${student.readingPercent}%` }}
                                />
                              </div>
                            </div>
                            <label className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                              <input
                                type="checkbox"
                                checked={getAttendanceChecked(student.uid, student.currentAttendanceStatus === 'present')}
                                onChange={(event) => setAttendanceDraft(student.uid, event.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400"
                              />
                              <span>
                                {getAttendanceChecked(student.uid, student.currentAttendanceStatus === 'present') ? '출석' : '미출석'}
                                {student.currentAttendanceStatus === 'unchecked' && attendanceDrafts[student.uid] === undefined ? ' (미체크)' : ''}
                              </span>
                            </label>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 sm:justify-center">
                              <MessageSquare size={14} className="text-amber-500" />
                              질문 {student.questionCount}
                              {student.unansweredQuestionCount > 0 && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                                  미답변 {student.unansweredQuestionCount}
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-bold text-slate-500 sm:text-right">
                              최근 {formatActivityDate(student.lastActivityMillis)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && tab === 'bibleReading' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-amber-900">학생 성경 읽기 기록표 관리</p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    학생을 선택한 뒤 읽은 책을 눌러 색칠하거나 해제할 수 있습니다. 변경은 바로 저장됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTab('members')}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                >
                  회원 관리로 돌아가기
                </button>
              </div>

              <BibleReadingChart />
            </div>
          )}

          {/* QA TAB */}
          {!loading && tab === 'qa' && (() => {
            const filteredQa = qaItems.filter((item) => {
              const dept = (item.department ?? 'young-adults') as QADepartment;
              return qaFilter === 'all' ? true : dept === qaFilter;
            });
            const legacyDeptCount = qaItems.filter((item) => !item.department).length;
            const legacyPrivacyCount = qaItems.filter((item) => typeof item.isPrivate !== 'boolean').length;
            return (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {([
                    { id: 'all', label: '전체' },
                    { id: 'elementary', label: '유초등부' },
                    { id: 'young-adults', label: '청년부' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setQaFilter(opt.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${
                        qaFilter === opt.id
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <span className="ml-2 text-xs text-gray-500">{filteredQa.length}건</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {legacyDeptCount > 0 && (
                    <button
                      type="button"
                      disabled={qaBackfilling}
                      onClick={backfillQaDepartments}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-50"
                    >
                      {qaBackfilling ? '보정 중...' : `부서 미지정 ${legacyDeptCount}건 → 청년부로 보정`}
                    </button>
                  )}
                  {legacyPrivacyCount > 0 && (
                    <button
                      type="button"
                      disabled={qaBackfilling}
                      onClick={backfillQaPrivacy}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50"
                      title="이 보정을 실행해야 일반 회원이 기존 질문을 볼 수 있습니다."
                    >
                      {qaBackfilling ? '보정 중...' : `공개 미지정 ${legacyPrivacyCount}건 → 공개로 보정`}
                    </button>
                  )}
                </div>
              </div>
              {filteredQa.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <MessageSquare size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">조건에 맞는 질문이 없습니다.</p>
                </div>
              )}
              {filteredQa.map((item) => {
                const isExpanded = expandedId === item.id;
                const dept = (item.department ?? 'young-adults') as QADepartment;
                return (
                  <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="w-full flex items-start gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${QA_DEPARTMENT_BADGE[dept]}`}>
                            {QA_DEPARTMENT_LABEL[dept]}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            item.isAnswered ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {item.isAnswered ? '답변완료' : '미답변'}
                          </span>
                          {item.isPrivate && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium border border-amber-200 bg-amber-50 text-amber-800">
                              비공개
                            </span>
                          )}
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
            );
          })()}

          {/* WORD FRUIT TAB */}
          {tab === 'wordFruit' && (
            <div>
              <div className="flex items-start gap-3 rounded-lg bg-emerald-50 border border-emerald-200 p-4 mb-4">
                <BookOpen size={20} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-emerald-800 space-y-1">
                  <p className="font-semibold">유초등부 “이번 주 말씀 열매” 운영 설정</p>
                  <p>주차마다 바뀌지 않는 회원·구조 설정입니다. 주간 강의 등록은 다음세대 페이지의 “이번 주 말씀 열매 → 관리”에서 진행하세요.</p>
                </div>
              </div>
              <WordFruitSettings />
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
