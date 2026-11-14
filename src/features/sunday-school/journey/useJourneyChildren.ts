// Resolves "the child" of the signed-in account: a student account is its own
// child; a parent account has linked member children and proxy children.
import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useNextGenerationAuth } from '../../../lib/nextGenerationAuth';
import { hasDepartment } from '../../../lib/nextGenerationRoles';
import { subscribeAttendanceForStudent } from '../../word-fruit/attendanceApi';
import { isSchoolClassId } from '../classScreen';
import type { SchoolClassId } from '../types';
import { pickLinkedClassId } from './journey';
import type { JourneyRole, LinkedChildInfo } from './journey';

export interface JourneyChild {
  uid: string;
  name: string;
  /** Undefined until a teacher or pastor assigns one of the four classes. */
  classId?: SchoolClassId;
  /** Proxy child (no account of their own); the parent manages every check. */
  isProxy: boolean;
  /** How the signed-in account relates to this child: the student themself, or a parent. */
  viewer: JourneyRole;
}

export interface JourneyViewer {
  children: JourneyChild[];
  /** Signed in, but neither a student nor a parent with children yet. */
  empty: boolean;
}

const asClassId = (value: string | undefined): SchoolClassId | undefined =>
  value && isSchoolClassId(value) ? value : undefined;

export function useJourneyChildren(): JourneyViewer {
  const { user, member, isMember } = useNextGenerationAuth();
  const isStudent = !!user && isMember && hasDepartment(member, '학생');
  const isParent = !!user && isMember && hasDepartment(member, '학부모');

  const linkedIds = useMemo(() => (isParent ? (member?.childIds ?? []) : []), [isParent, member?.childIds]);
  const proxyList = useMemo(() => (isParent ? (member?.proxyChildren ?? []) : []), [isParent, member?.proxyChildren]);
  const linkedKey = linkedIds.join('|');
  const proxyKey = proxyList.map((child) => child.id).join('|');

  // Linked children: the class comes from the child's member doc (readable by the linked parent), so a
  // newly approved or re-assigned student is correct at once. Attendance history is only a fallback
  // (and the name source when the member doc is unavailable).
  const [linked, setLinked] = useState<Record<string, LinkedChildInfo>>({});
  useEffect(() => {
    setLinked({});
    const patch = (uid: string, change: LinkedChildInfo) =>
      setLinked((current) => ({ ...current, [uid]: { ...current[uid], ...change } }));
    const unsubs = linkedIds.flatMap((uid) => [
      onSnapshot(
        doc(db, 'next_generation_members', uid),
        (snap) => {
          const data = snap.data() as { displayName?: string; groupId?: string } | undefined;
          patch(uid, { memberName: data?.displayName, memberClassId: asClassId(data?.groupId) });
        },
        () => undefined,
      ),
      subscribeAttendanceForStudent(
        uid,
        (rows) => {
          const withClass = rows.find((row) => isSchoolClassId(row.groupId));
          patch(uid, { attendanceName: (withClass ?? rows[0])?.studentName, attendanceClassId: asClassId(withClass?.groupId) });
        },
        () => undefined,
      ),
    ]);
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
    // linkedKey stands in for linkedIds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedKey]);

  // Proxy children: the child doc is the source of truth for the class; the parent doc keeps a cached copy.
  const [proxyDocs, setProxyDocs] = useState<Record<string, { name?: string; classId?: SchoolClassId }>>({});
  useEffect(() => {
    let cancelled = false;
    setProxyDocs({});
    proxyList.forEach(async (child) => {
      try {
        const snap = await getDoc(doc(db, 'next_generation_children', child.id));
        const data = snap.data() as { displayName?: string; groupId?: string } | undefined;
        if (!cancelled && data) {
          setProxyDocs((current) => ({ ...current, [child.id]: { name: data.displayName, classId: asClassId(data.groupId) } }));
        }
      } catch {
        // Keep the cached values from the parent document.
      }
    });
    return () => {
      cancelled = true;
    };
    // proxyKey stands in for proxyList
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proxyKey]);

  return useMemo(() => {
    const children: JourneyChild[] = [];
    const seen = new Set<string>();
    const add = (child: JourneyChild) => {
      if (seen.has(child.uid)) return;
      seen.add(child.uid);
      children.push(child);
    };
    if (isStudent && user) {
      add({ uid: user.uid, name: member?.displayName || '나', classId: asClassId(member?.groupId), isProxy: false, viewer: 'student' });
    }
    for (const uid of linkedIds) {
      const info = linked[uid];
      add({
        uid,
        name: info?.memberName || info?.attendanceName || '자녀',
        classId: pickLinkedClassId(info),
        isProxy: false,
        viewer: 'parent',
      });
    }
    for (const child of proxyList) {
      const fresh = proxyDocs[child.id];
      add({ uid: child.id, name: fresh?.name || child.name || '자녀', classId: fresh?.classId ?? asClassId(child.groupId), isProxy: true, viewer: 'parent' });
    }
    return { children, empty: children.length === 0 };
  }, [isStudent, user, member?.displayName, member?.groupId, linkedIds, linked, proxyList, proxyDocs]);
}
