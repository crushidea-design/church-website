import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';

export const FAMILY_WORSHIP_COLLECTION = 'next_generation_family_worship_logs';
export const MAX_FAMILY_WORSHIP_PHOTO_SIZE = 10 * 1024 * 1024;

export interface FamilyWorshipLog {
  id: string;
  weekKey: string;
  parentUid: string;
  parentName?: string;
  completedAt?: any;
  childUids: string[];
  childNames?: string[];
  note?: string;
  isPublic?: boolean;
  photoUrl?: string;
  photoPath?: string;
  photoName?: string;
  photoContentType?: string;
  photoSize?: number;
}

export function familyWorshipDocId(weekKey: string, parentUid: string) {
  return `${weekKey}_${parentUid}`;
}

const getSafeStorageName = (name: string) => {
  return name.replace(/[\\/#?[\]@]/g, '_');
};

export function getFamilyWorshipFamilyLabel(parentName?: string) {
  const trimmed = parentName?.trim();
  if (!trimmed) return '한 가정';

  return `${trimmed[0]} 가정`;
}

export function validateFamilyWorshipPhoto(file: File | null | undefined) {
  if (!file) return null;

  const isAllowedType = file.type === 'image/jpeg' || file.type === 'image/png';
  const hasAllowedExtension = /\.(jpe?g|png)$/i.test(file.name);
  if (!isAllowedType && !hasAllowedExtension) {
    return 'JPG, PNG 사진만 업로드할 수 있습니다.';
  }

  if (file.size > MAX_FAMILY_WORSHIP_PHOTO_SIZE) {
    return '사진 크기는 10MB를 초과할 수 없습니다.';
  }

  return null;
}

export async function uploadFamilyWorshipPhoto(parentUid: string, weekKey: string, file: File) {
  const validationError = validateFamilyWorshipPhoto(file);
  if (validationError) throw new Error(validationError);

  const photoPath = `family-worship/${parentUid}/${weekKey}_${Date.now()}_${getSafeStorageName(file.name)}`;
  const photoRef = ref(storage, photoPath);
  await uploadBytes(photoRef, file, { contentType: file.type || undefined });
  const photoUrl = await getDownloadURL(photoRef);

  return {
    photoUrl,
    photoPath,
    photoName: file.name,
    photoContentType: file.type,
    photoSize: file.size,
  };
}

export async function setFamilyWorshipLog(input: {
  weekKey: string;
  parentUid: string;
  parentName?: string;
  childUids: string[];
  childNames?: string[];
  note?: string;
  isPublic?: boolean;
  photoUrl?: string;
  photoPath?: string;
  photoName?: string;
  photoContentType?: string;
  photoSize?: number;
}) {
  const ref = doc(db, FAMILY_WORSHIP_COLLECTION, familyWorshipDocId(input.weekKey, input.parentUid));
  await setDoc(
    ref,
    {
      weekKey: input.weekKey,
      parentUid: input.parentUid,
      parentName: input.parentName || '',
      childUids: input.childUids,
      childNames: input.childNames || [],
      ...(input.note ? { note: input.note } : {}),
      isPublic: !!input.isPublic,
      ...(input.photoUrl ? { photoUrl: input.photoUrl } : {}),
      ...(input.photoPath ? { photoPath: input.photoPath } : {}),
      ...(input.photoName ? { photoName: input.photoName } : {}),
      ...(input.photoContentType ? { photoContentType: input.photoContentType } : {}),
      ...(typeof input.photoSize === 'number' ? { photoSize: input.photoSize } : {}),
      completedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function subscribeMyFamilyWorshipLogs(
  parentUid: string,
  cb: (rows: FamilyWorshipLog[]) => void,
  onError?: (err: unknown) => void,
) {
  const q = query(collection(db, FAMILY_WORSHIP_COLLECTION), where('parentUid', '==', parentUid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FamilyWorshipLog, 'id'>) }));
      items.sort((a, b) => b.weekKey.localeCompare(a.weekKey));
      cb(items);
    },
    (err) => onError?.(err),
  );
}

export function subscribeFamilyWorshipStats(
  weekKeys: string[],
  cb: (rows: FamilyWorshipLog[]) => void,
  onError?: (err: unknown) => void,
) {
  if (weekKeys.length === 0) {
    cb([]);
    return () => {};
  }
  const q = query(
    collection(db, FAMILY_WORSHIP_COLLECTION),
    where('weekKey', 'in', weekKeys.slice(0, 30)),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FamilyWorshipLog, 'id'>) }))),
    (err) => onError?.(err),
  );
}

export function subscribePublicFamilyWorshipLogs(
  weekKey: string,
  cb: (rows: FamilyWorshipLog[]) => void,
  onError?: (err: unknown) => void,
) {
  const q = query(
    collection(db, FAMILY_WORSHIP_COLLECTION),
    where('weekKey', '==', weekKey),
    where('isPublic', '==', true),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FamilyWorshipLog, 'id'>) }));
      items.sort((a, b) => {
        const aMillis = typeof a.completedAt?.toMillis === 'function' ? a.completedAt.toMillis() : 0;
        const bMillis = typeof b.completedAt?.toMillis === 'function' ? b.completedAt.toMillis() : 0;
        return bMillis - aMillis;
      });
      cb(items);
    },
    (err) => onError?.(err),
  );
}

export async function getPublicFamilyWorshipLogsOnce(weekKey: string) {
  const q = query(
    collection(db, FAMILY_WORSHIP_COLLECTION),
    where('weekKey', '==', weekKey),
    where('isPublic', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FamilyWorshipLog, 'id'>) }));
}
