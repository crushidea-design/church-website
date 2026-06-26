import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, onSnapshot, doc, updateDoc,
  deleteDoc, addDoc, serverTimestamp, orderBy, deleteField,
  getDocs, getDoc, setDoc, arrayUnion, writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { NextGenerationMember, Department, NEXT_GENERATION_DEPARTMENTS, useNextGenerationAuth } from '../lib/nextGenerationAuth';
import { buildMemberRoleFields, hasDepartment } from '../lib/nextGenerationRoles';
import { getPostAttachments, serializeMaterialAttachments } from '../lib/attachments';
import { buildNextGenerationClassDashboard } from '../lib/nextGenerationClassDashboard';
import {
  AttendanceDoc,
  ATTENDANCE_COLLECTION,
  getRecentSundayWeekKeys,
  setAttendanceBatch,
} from '../features/word-fruit/attendanceApi';
import { Users, BookOpen } from 'lucide-react';
import { NEXT_GENERATION_NOTIFICATION_TOPIC } from '../services/notificationService';
import BibleReadingChart from './BibleReadingChart';
import WordFruitSettings from '../features/word-fruit/WordFruitSettings';

import {
  AdminTab,
  ClassReadingDoc,
  ContactItem,
  MigrationRow,
  QADepartment,
  QAItem,
} from '../features/next-generation/adminHelpers';
import AdminMigrationTab from '../features/next-generation/AdminMigrationTab';
import AdminContactsTab from '../features/next-generation/AdminContactsTab';
import AdminQATab from '../features/next-generation/AdminQATab';
import AdminClassesTab from '../features/next-generation/AdminClassesTab';
import AdminMembersTab from '../features/next-generation/AdminMembersTab';
import { AdminAnswerModal, AdminRejectModal } from '../features/next-generation/AdminModals';
import { inferProxyChildDepartment } from '../features/next-generation/proxyChildren';

export default function NextGenerationAdmin({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { member: nextMember, isPastor: isNextGenerationPastor } = useNextGenerationAuth();
  const [tab, setTab] = useState<AdminTab>('members');
  const [members, setMembers] = useState<NextGenerationMember[]>([]);
  const [proxyChildMembers, setProxyChildMembers] = useState<NextGenerationMember[]>([]);
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
  useEffect(() => {
    if (isNextGenerationPastor) {
      const q = query(collection(db, 'next_generation_children'), orderBy('displayName', 'asc'));
      return onSnapshot(q, (snap) => {
        setProxyChildMembers(snap.docs.map((childDoc) => {
          const data = childDoc.data() as any;
          return {
            uid: childDoc.id,
            email: '',
            displayName: data.displayName ?? '이름 없음',
            role: 'member',
            department: studentDepartment,
            church: '',
            intro: '',
            provider: 'google',
            createdAt: data.createdAt,
            groupId: data.groupId ?? '',
          } as NextGenerationMember;
        }));
      }, () => setProxyChildMembers([]));
    }

    if (!teacherGroupIds || teacherGroupIds.length === 0) {
      setProxyChildMembers([]);
      return;
    }

    const q = query(
      collection(db, 'next_generation_children'),
      where('groupId', 'in', teacherGroupIds.slice(0, 10)),
    );
    return onSnapshot(q, (snap) => {
      setProxyChildMembers(snap.docs.map((childDoc) => {
        const data = childDoc.data() as any;
        return {
          uid: childDoc.id,
          email: '',
          displayName: data.displayName ?? '이름 없음',
          role: 'member',
          department: studentDepartment,
          church: '',
          intro: '',
          provider: 'google',
          createdAt: data.createdAt,
          groupId: data.groupId ?? '',
        } as NextGenerationMember;
      }));
    }, () => setProxyChildMembers([]));
  }, [isNextGenerationPastor, studentDepartment, teacherGroupIds?.join('|')]);
  const classDashboardMembers = useMemo(
    () => [...members, ...proxyChildMembers],
    [members, proxyChildMembers],
  );
  const classDashboard = useMemo(() => buildNextGenerationClassDashboard({
    members: classDashboardMembers,
    readings: classReadings,
    qaItems,
    attendanceItems: classAttendance,
    currentWeekKey: currentAttendanceWeekKey,
    recentWeekKeys: attendanceWeekKeys,
    studentDepartment,
    visibleGroupIds: teacherGroupIds,
  }), [attendanceWeekKeys, classAttendance, classReadings, currentAttendanceWeekKey, classDashboardMembers, qaItems, studentDepartment, teacherGroupIds]);
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
      : approvedMembers.filter((member) => notificationAudience.some((department) => hasDepartment(member, department))).length;

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
      if (target && hasDepartment(target, '학생') && (target as any).parentEmail) {
        const parentEmail = String((target as any).parentEmail).trim().toLowerCase();
        const parent = members.find(
          (m) => hasDepartment(m, '학부모') && m.role === 'member' && m.email?.toLowerCase() === parentEmail,
        );
        if (parent) {
          batch.update(doc(db, 'next_generation_members', parent.uid), {
            childIds: arrayUnion(uid),
            childNames: arrayUnion(target.displayName),
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

  const updateMemberRoles = async (
    member: NextGenerationMember,
    departments: Department[],
    primaryDepartment: Department,
  ) => {
    const roleFields = buildMemberRoleFields(departments, primaryDepartment);
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'next_generation_members', member.uid), roleFields);
      showToast('역할을 저장했습니다.');
    } catch {
      showToast('역할 저장 중 오류가 발생했습니다.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const linkParentChild = async (parent: NextGenerationMember, student: NextGenerationMember) => {
    if (!parent?.uid || !student?.uid) return;
    setSubmitting(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'next_generation_members', parent.uid), {
        childIds: arrayUnion(student.uid),
        childNames: arrayUnion(student.displayName),
      });
      batch.update(doc(db, 'next_generation_members', student.uid), {
        parentEmail: parent.email?.trim().toLowerCase() || '',
      });
      await batch.commit();
      showToast(`${student.displayName} 학생을 ${parent.displayName} 학부모와 연결했습니다.`);
    } catch {
      showToast('부모-학생 연결 중 오류가 발생했습니다.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const createTeacherAssignedChild = async (
    teacher: NextGenerationMember,
    child: { name: string; grade: string; groupId: string },
  ) => {
    const childName = child.name.trim();
    const groupId = child.groupId.trim();
    if (!user || !childName || !groupId) return;
    setSubmitting(true);
    try {
      const id = `teacher-child:${teacher.uid}:${Date.now()}`;
      await setDoc(doc(db, 'next_generation_children', id), {
        kind: 'proxy',
        careType: 'teacher_assigned',
        displayName: childName,
        department: inferProxyChildDepartment(child.grade),
        groupId,
        parentUids: [],
        assignedTeacherUids: [teacher.uid],
        linkedUid: null,
        visibility: 'family_and_teachers',
        createdBy: user.uid,
        createdByAdmin: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showToast(`${childName} 아이를 ${teacher.displayName} 교사에게 배정했습니다.`);
    } catch {
      showToast('교사 전담 아이 추가 중 오류가 발생했습니다.', 'error');
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
            .filter((member) => notificationAudience.some((department) => hasDepartment(member, department)))
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
          : approvedMembers.filter((member) => notificationAudience.some((department) => hasDepartment(member, department)));

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
            <AdminMembersTab
              search={search}
              onSearchChange={setSearch}
              systemHealth={systemHealth}
              checkingHealth={checkingHealth}
              onCheckHealth={checkSystemHealth}
              notificationAudience={notificationAudience}
              notificationAudienceCount={notificationAudienceCount}
              onSetAudienceAll={(all) => setNotificationAudience(all ? 'all' : [])}
              onToggleAudienceDepartment={toggleAudienceDepartment}
              notificationTitle={notificationTitle}
              onNotificationTitleChange={setNotificationTitle}
              notificationBody={notificationBody}
              onNotificationBodyChange={setNotificationBody}
              notificationTargetUrl={notificationTargetUrl}
              onNotificationTargetUrlChange={setNotificationTargetUrl}
              sendingNotification={sendingNotification}
              onSendNotification={sendNextGenerationNotification}
              pendingMembers={pendingMembers}
              approvedMembers={approvedMembers}
              rejectedMembers={rejectedMembers}
              filteredMembers={filteredMembers}
              members={members}
              expandedId={expandedId}
              submitting={submitting}
              onTabChange={setTab}
              onToggleExpand={setExpandedId}
              onApproveMember={approveMember}
              onOpenReject={(uid) => { setRejectTargetId(uid); setRejectReason(''); }}
              onToggleAdmin={toggleNextGenerationAdmin}
              onUpdateMemberRoles={updateMemberRoles}
              onLinkParentChild={linkParentChild}
              onCreateTeacherAssignedChild={createTeacherAssignedChild}
              onDeleteMember={deleteMember}
            />
          )}

          {!loading && tab === 'classes' && (
            <AdminClassesTab
              classDashboard={classDashboard}
              filteredClassGroups={filteredClassGroups}
              classSearch={classSearch}
              classGroupFilter={classGroupFilter}
              attendanceDrafts={attendanceDrafts}
              savingAttendanceGroup={savingAttendanceGroup}
              onSearchChange={setClassSearch}
              onGroupFilterChange={setClassGroupFilter}
              onSaveAttendance={saveGroupAttendance}
              getAttendanceChecked={getAttendanceChecked}
              setAttendanceDraft={setAttendanceDraft}
            />
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
          {!loading && tab === 'qa' && (
            <AdminQATab
              qaItems={qaItems}
              qaFilter={qaFilter}
              qaBackfilling={qaBackfilling}
              expandedId={expandedId}
              onFilterChange={setQaFilter}
              onToggleExpand={setExpandedId}
              onBackfillDepartments={backfillQaDepartments}
              onBackfillPrivacy={backfillQaPrivacy}
              onOpenAnswer={(id, currentAnswer) => {
                setAnswerTargetId(id);
                setAnswerText(currentAnswer);
              }}
              onDelete={(id) => deleteDoc(doc(db, 'next_generation_qa', id))}
            />
          )}

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
            <AdminMigrationTab
              migrationRunning={migrationRunning}
              migrationScanned={migrationScanned}
              migrationRows={migrationRows}
              migrationDone={migrationDone}
              migrationError={migrationError}
              migrationPending={migrationPending}
              onScan={scanForMigration}
              onRun={runMigration}
            />
          )}

          {/* CONTACTS TAB */}
          {!loading && tab === 'contacts' && (
            <AdminContactsTab
              contacts={contacts}
              expandedId={expandedId}
              onToggleExpand={setExpandedId}
              onMarkRead={markContactRead}
              onDelete={(id) => deleteDoc(doc(db, 'next_generation_contacts', id))}
            />
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

      <AdminRejectModal
        open={!!rejectTargetId}
        reason={rejectReason}
        submitting={submitting}
        onReasonChange={setRejectReason}
        onCancel={() => { setRejectTargetId(null); setRejectReason(''); }}
        onConfirm={rejectMember}
      />

      <AdminAnswerModal
        open={!!answerTargetId}
        answer={answerText}
        submitting={submitting}
        onAnswerChange={setAnswerText}
        onCancel={() => { setAnswerTargetId(null); setAnswerText(''); }}
        onConfirm={answerQA}
      />
    </div>
  );
}
