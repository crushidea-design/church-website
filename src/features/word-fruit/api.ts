import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  WORD_FRUITS_COLLECTION,
  WORD_FRUIT_LEGACY_TOTALS_COLLECTION,
  WORD_FRUIT_GROUPS_COLLECTION,
  WORD_FRUIT_PROGRESS_COLLECTION,
  LegacyWordFruitTotal,
  WordFruitCard,
  WordFruitGroup,
  WordFruitProgress,
  WeeklyWordFruit,
  emptyCards,
} from './types';

// Pure logic extracted to ./logic so it can be unit-tested without Firebase.
export {
  fruitStageOf,
  fruitWeekIdFromSundayKey,
  getTodayKey,
  getWeekId,
  isCheckAllowedDay,
  progressDocId,
} from './logic';
import { fruitStageOf, progressDocId } from './logic';
import { normalizeLegacyFruitTotalInput } from './logic';

export function subscribeWeeklyWordFruit(
  weekId: string,
  cb: (fruit: WeeklyWordFruit | null) => void,
  onError?: (err: unknown) => void,
) {
  const ref = doc(db, WORD_FRUITS_COLLECTION, weekId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return cb(null);
      cb({ id: snap.id, ...(snap.data() as Omit<WeeklyWordFruit, 'id'>) });
    },
    (err) => onError?.(err),
  );
}

export function subscribeMyProgress(
  weekId: string,
  userId: string,
  cb: (progress: WordFruitProgress | null) => void,
  onError?: (err: unknown) => void,
) {
  const ref = doc(db, WORD_FRUIT_PROGRESS_COLLECTION, progressDocId(weekId, userId));
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return cb(null);
      cb({ id: snap.id, ...(snap.data() as Omit<WordFruitProgress, 'id'>) });
    },
    (err) => onError?.(err),
  );
}

export function subscribeAllProgress(
  weekId: string,
  cb: (progresses: WordFruitProgress[]) => void,
  onError?: (err: unknown) => void,
) {
  const q = query(collection(db, WORD_FRUIT_PROGRESS_COLLECTION), where('weekId', '==', weekId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WordFruitProgress, 'id'>) }));
      items.sort((a, b) => a.childName.localeCompare(b.childName, 'ko'));
      cb(items);
    },
    (err) => onError?.(err),
  );
}

export async function saveWeeklyWordFruit(
  fruit: Omit<WeeklyWordFruit, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdBy?: string },
  isNew: boolean,
) {
  const ref = doc(db, WORD_FRUITS_COLLECTION, fruit.weekId);
  const payload: Record<string, unknown> = {
    weekId: fruit.weekId,
    title: fruit.title,
    passage: fruit.passage,
    memoryVerse: fruit.memoryVerse,
    fruitName: fruit.fruitName,
    startDate: fruit.startDate,
    endDate: fruit.endDate,
    status: fruit.status,
    topMessage: fruit.topMessage,
    guideMessage: fruit.guideMessage,
    recommendedPractices: fruit.recommendedPractices,
    cards: fruit.cards,
    updatedAt: serverTimestamp(),
  };
  if (isNew) {
    payload.createdAt = serverTimestamp();
    if (fruit.createdBy) payload.createdBy = fruit.createdBy;
  }
  await setDoc(ref, payload, { merge: true });
}

export async function upsertProgressByLeader(input: {
  weekId: string;
  userId: string;
  childName: string;
  practice: string;
  groupId?: string;
}) {
  const id = progressDocId(input.weekId, input.userId);
  const ref = doc(db, WORD_FRUIT_PROGRESS_COLLECTION, id);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    await setDoc(ref, {
      weekId: input.weekId,
      userId: input.userId,
      childName: input.childName,
      practice: input.practice,
      groupId: input.groupId ?? '',
      checkCount: 0,
      checkedDates: [],
      fruitStage: 0,
      completed: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    const cur = existing.data() as WordFruitProgress;
    await updateDoc(ref, {
      childName: input.childName,
      practice: input.practice,
      groupId: input.groupId ?? cur.groupId ?? '',
      fruitStage: fruitStageOf(cur.checkCount ?? 0),
      completed: (cur.checkCount ?? 0) >= 3,
      updatedAt: serverTimestamp(),
    });
  }
}

/** Backwards-compatible alias for the pastor flow. */
export const upsertProgressByPastor = upsertProgressByLeader;

/**
 * Adds one today's check to a progress doc on behalf of a teacher or parent.
 * Idempotent per day. Caller is expected to have permission (firestore.rules).
 */
export async function addTodayCheckByLeader(input: {
  weekId: string;
  userId: string;
  childName: string;
  practice?: string;
  groupId?: string;
}) {
  const id = progressDocId(input.weekId, input.userId);
  const ref = doc(db, WORD_FRUIT_PROGRESS_COLLECTION, id);
  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    const checkedDates = [todayKey];
    await setDoc(ref, {
      weekId: input.weekId,
      userId: input.userId,
      childName: input.childName,
      practice: input.practice ?? '',
      groupId: input.groupId ?? '',
      checkCount: 1,
      checkedDates,
      fruitStage: 1,
      completed: false,
      lastCheckedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { skipped: false } as const;
  }
  const cur = existing.data() as WordFruitProgress;
  const checkedDates = Array.isArray(cur.checkedDates) ? cur.checkedDates : [];
  if (checkedDates.includes(todayKey)) {
    return { skipped: true } as const;
  }
  const nextDates = [...checkedDates, todayKey];
  const checkCount = nextDates.length;
  await updateDoc(ref, {
    checkedDates: nextDates,
    checkCount,
    fruitStage: fruitStageOf(checkCount),
    completed: checkCount >= 3,
    lastCheckedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...(input.practice ? { practice: input.practice } : {}),
  });
  return { skipped: false } as const;
}

/**
 * Server-validated check. Routes through `/api/word-fruit/check` so date and
 * one-per-day rules are enforced in Asia/Seoul, not from the client clock.
 */
export async function checkInToday(progress: WordFruitProgress) {
  const { auth } = await import('../../lib/firebase');
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('NOT_AUTHENTICATED');

  const res = await fetch('/api/word-fruit/check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ weekId: progress.weekId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data?.error || 'CHECK_FAILED');
    (err as any).serverMessage = data?.message;
    throw err;
  }
}

export function subscribePublishedFruits(
  cb: (items: WeeklyWordFruit[]) => void,
  onError?: (err: unknown) => void,
) {
  const q = query(
    collection(db, WORD_FRUITS_COLLECTION),
    where('status', '==', 'published'),
    orderBy('startDate', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WeeklyWordFruit, 'id'>) }))),
    (err) => onError?.(err),
  );
}

export function subscribeProgressForUser(
  userId: string,
  cb: (items: WordFruitProgress[]) => void,
  onError?: (err: unknown) => void,
) {
  const q = query(
    collection(db, WORD_FRUIT_PROGRESS_COLLECTION),
    where('userId', '==', userId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WordFruitProgress, 'id'>) }));
      // Newest week first
      items.sort((a, b) => b.weekId.localeCompare(a.weekId));
      cb(items);
    },
    (err) => onError?.(err),
  );
}

export function subscribeProgressForUsers(
  weekId: string,
  userIds: string[],
  cb: (items: WordFruitProgress[]) => void,
  onError?: (err: unknown) => void,
) {
  if (userIds.length === 0) {
    cb([]);
    return () => {};
  }
  // Firestore `in` supports up to 30 — for parents this is far below.
  const q = query(
    collection(db, WORD_FRUIT_PROGRESS_COLLECTION),
    where('weekId', '==', weekId),
    where('userId', 'in', userIds.slice(0, 30)),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WordFruitProgress, 'id'>) }));
      items.sort((a, b) => a.childName.localeCompare(b.childName, 'ko'));
      cb(items);
    },
    (err) => onError?.(err),
  );
}

export { summarizeProgress } from './logic';

export async function saveCommunityAggregate(
  weekId: string,
  data: { total: number; completed: number; growing: number; message: string },
) {
  const ref = doc(db, WORD_FRUITS_COLLECTION, weekId);
  await updateDoc(ref, {
    aggregateTotal: data.total,
    aggregateCompleted: data.completed,
    aggregateGrowing: data.growing,
    aggregateMessage: data.message,
    aggregateUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

interface AICardResult {
  recommendedPractices: string[];
  cards: WordFruitCard[];
  fruitName?: string;
  memoryVerse?: string;
}

/**
 * Calls the server endpoint to generate cards from a manuscript. The Gemini
 * API key lives only on the server, so it is never shipped to the client.
 */
export async function generateCardsFromManuscript(manuscript: string): Promise<AICardResult> {
  const trimmed = manuscript.trim();
  if (trimmed.length < 30) {
    throw new Error('강의원고가 너무 짧습니다.');
  }

  const { auth } = await import('../../lib/firebase');
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('로그인이 필요합니다.');

  const res = await fetch('/api/word-fruit/generate-cards', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ manuscript: trimmed }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || data?.error || 'AI 생성 중 오류가 발생했습니다.');
  }
  const json = await res.json();
  const parsed = json?.data ?? {};

  const baseCards = emptyCards();
  const cards: WordFruitCard[] = baseCards.map((base) => {
    const found = (parsed?.cards ?? []).find((c: any) => Number(c?.order) === base.order);
    if (!found) return base;
    return {
      order: base.order,
      title: typeof found.title === 'string' && found.title.trim() ? found.title.trim() : base.title,
      summary: typeof found.summary === 'string' ? found.summary.trim() : '',
      question: typeof found.question === 'string' ? found.question.trim() : '',
      prayer: typeof found.prayer === 'string' ? found.prayer.trim() : '',
    };
  });

  const recommendedPractices = Array.isArray(parsed?.recommendedPractices)
    ? parsed.recommendedPractices
        .filter((s: any): s is string => typeof s === 'string')
        .map((s: string) => s.trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];

  return {
    recommendedPractices,
    cards,
    fruitName: typeof parsed?.fruitName === 'string' ? parsed.fruitName.trim() : undefined,
    memoryVerse: typeof parsed?.memoryVerse === 'string' ? parsed.memoryVerse.trim() : undefined,
  };
}

/**
 * Trigger publish notifications (in-app + FCM) via the server endpoint.
 * Server validates next-generation pastor role and the published status.
 */
export async function notifyPublishViaServer(weekId: string): Promise<{
  inAppCount: number;
  fcmTokenCount: number;
  successCount?: number;
  failureCount?: number;
}> {
  const { auth } = await import('../../lib/firebase');
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('NOT_AUTHENTICATED');

  const res = await fetch('/api/word-fruit/notify-publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ weekId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || data?.error || 'NOTIFY_FAILED');
  }
  return res.json();
}

export async function fetchElementaryNotificationTargets(): Promise<string[]> {
  const targets: string[] = [];
  for (const department of ['학생', '학부모', '교사']) {
    const q = query(
      collection(db, 'next_generation_members'),
      where('department', '==', department),
      where('role', '==', 'member'),
    );
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const data = d.data() as { uid?: string };
      if (data.uid) targets.push(data.uid);
    });
  }
  return Array.from(new Set(targets));
}

export function subscribeGroups(
  cb: (groups: WordFruitGroup[]) => void,
  onError?: (err: unknown) => void,
) {
  const q = query(collection(db, WORD_FRUIT_GROUPS_COLLECTION), orderBy('name'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WordFruitGroup, 'id'>) }))),
    (err) => onError?.(err),
  );
}

export async function createGroup(name: string, description?: string): Promise<string> {
  const ref = doc(collection(db, WORD_FRUIT_GROUPS_COLLECTION));
  await setDoc(ref, {
    name: name.trim(),
    description: (description ?? '').trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateGroup(id: string, name: string, description?: string) {
  await updateDoc(doc(db, WORD_FRUIT_GROUPS_COLLECTION, id), {
    name: name.trim(),
    description: (description ?? '').trim(),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeProgressForGroups(
  weekId: string,
  groupIds: string[],
  cb: (items: WordFruitProgress[]) => void,
  onError?: (err: unknown) => void,
) {
  if (groupIds.length === 0) {
    cb([]);
    return () => {};
  }
  const q = query(
    collection(db, WORD_FRUIT_PROGRESS_COLLECTION),
    where('weekId', '==', weekId),
    where('groupId', 'in', groupIds.slice(0, 30)),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WordFruitProgress, 'id'>) }));
      items.sort((a, b) => a.childName.localeCompare(b.childName, 'ko'));
      cb(items);
    },
    (err) => onError?.(err),
  );
}

export async function setMemberGroup(uid: string, groupId: string) {
  await updateDoc(doc(db, 'next_generation_members', uid), { groupId });
}

export async function setMemberGroupIds(uid: string, groupIds: string[]) {
  await updateDoc(doc(db, 'next_generation_members', uid), { groupIds });
}

export async function fetchElementaryStudents(): Promise<Array<{ uid: string; displayName: string; groupId?: string }>> {
  const q = query(
    collection(db, 'next_generation_members'),
    where('department', '==', '학생'),
    where('role', '==', 'member'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as { uid?: string; displayName?: string; groupId?: string };
    return {
      uid: data.uid ?? d.id,
      displayName: data.displayName ?? '이름 없음',
      groupId: data.groupId,
    };
  });
}

export interface BackfillReport {
  scanned: number;
  alreadyHasGroup: number;
  noStudentMember: number;
  studentHasNoGroup: number;
  updated: number;
}

/**
 * Fill in `groupId` on legacy progress docs by reading each student's
 * current `member.groupId`. Idempotent: skips docs that already have a
 * non-empty groupId, and skips students without a group set.
 */
export async function backfillProgressGroupIds(): Promise<BackfillReport> {
  const progressSnap = await getDocs(collection(db, WORD_FRUIT_PROGRESS_COLLECTION));
  const studentIds = new Set<string>();
  progressSnap.docs.forEach((d) => {
    const data = d.data() as { userId?: string };
    if (data.userId) studentIds.add(data.userId);
  });

  // Load student member docs in chunks of 30 (Firestore `in` cap)
  const memberGroupByUid = new Map<string, string>();
  const ids = Array.from(studentIds);
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    const memSnap = await getDocs(query(
      collection(db, 'next_generation_members'),
      where('uid', 'in', chunk),
    ));
    memSnap.docs.forEach((d) => {
      const data = d.data() as { uid?: string; groupId?: string };
      if (data.uid) memberGroupByUid.set(data.uid, data.groupId ?? '');
    });
  }

  const report: BackfillReport = {
    scanned: 0,
    alreadyHasGroup: 0,
    noStudentMember: 0,
    studentHasNoGroup: 0,
    updated: 0,
  };

  for (const d of progressSnap.docs) {
    report.scanned += 1;
    const data = d.data() as { userId?: string; groupId?: string };
    if (typeof data.groupId === 'string' && data.groupId.length > 0) {
      report.alreadyHasGroup += 1;
      continue;
    }
    if (!data.userId) continue;
    if (!memberGroupByUid.has(data.userId)) {
      report.noStudentMember += 1;
      continue;
    }
    const targetGroup = memberGroupByUid.get(data.userId) ?? '';
    if (!targetGroup) {
      report.studentHasNoGroup += 1;
      continue;
    }
    await updateDoc(d.ref, {
      groupId: targetGroup,
      updatedAt: serverTimestamp(),
    });
    report.updated += 1;
  }

  return report;
}

export async function fetchTeachers(): Promise<Array<{ uid: string; displayName: string; email: string; groupIds: string[] }>> {
  const q = query(
    collection(db, 'next_generation_members'),
    where('department', '==', '교사'),
    where('role', '==', 'member'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      uid: data.uid ?? d.id,
      displayName: data.displayName ?? '이름 없음',
      email: data.email ?? '',
      groupIds: Array.isArray(data.groupIds) ? data.groupIds : [],
    };
  });
}

export function subscribeLegacyFruitTotals(
  cb: (items: LegacyWordFruitTotal[]) => void,
  onError?: (err: unknown) => void,
) {
  const q = query(collection(db, WORD_FRUIT_LEGACY_TOTALS_COLLECTION), orderBy('childName'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LegacyWordFruitTotal, 'id'>) }))),
    (err) => onError?.(err),
  );
}

export async function saveLegacyFruitTotal(input: {
  id?: string;
  childName: string;
  totalCount: number;
  groupId?: string;
  linkedUid?: string;
  memo?: string;
}): Promise<string> {
  const normalized = normalizeLegacyFruitTotalInput(input);
  if (!normalized) throw new Error('INVALID_CHILD_NAME');

  const ref = input.id
    ? doc(db, WORD_FRUIT_LEGACY_TOTALS_COLLECTION, input.id)
    : doc(collection(db, WORD_FRUIT_LEGACY_TOTALS_COLLECTION));
  const payload: Record<string, unknown> = {
    childName: normalized.childName,
    totalCount: normalized.totalCount,
    groupId: input.groupId ?? '',
    linkedUid: input.linkedUid ?? '',
    memo: normalized.memo,
    updatedAt: serverTimestamp(),
  };
  if (!input.id) {
    payload.createdAt = serverTimestamp();
  }
  await setDoc(ref, payload, { merge: true });
  return ref.id;
}
