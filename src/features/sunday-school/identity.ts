import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

// The school's name for one teaching period (like an era name). It is data, not
// code, so the next period can rename it from the CMS.
// `settings` is publicly readable and only the site admin can write it.
export const SCHOOL_IDENTITY_DOC = { collection: 'settings', id: 'sunday_school_identity' } as const;

export interface SchoolIdentity {
  /** Korean name, e.g. 그안에 주일학교 */
  name: string;
  /** English name, e.g. In Him Sunday School */
  nameEn: string;
  /** The verse words the name comes from. */
  motto: string;
  verseRef: string;
  /** Period the name is used for, e.g. 2027–2028 */
  period: string;
  /** One or two sentences for intro headers. */
  description: string;
}

export const DEFAULT_SCHOOL_IDENTITY: SchoolIdentity = {
  name: '그안에 주일학교',
  nameEn: 'In Him Sunday School',
  motto: '그 안에서 행하되 그 안에 뿌리를 박으며',
  verseRef: '골로새서 2:6-7',
  period: '2027–2028',
  description:
    '그리스도 예수를 주로 받은 아이들이 그 안에 뿌리를 박고 세움을 받아, 감사함이 넘치는 삶으로 자라가도록 돕는 교육 공동체입니다. 공예배를 중심에 두고, 교회 교육이 가정과 이어지도록 힘씁니다.',
};

const FIELDS = Object.keys(DEFAULT_SCHOOL_IDENTITY) as Array<keyof SchoolIdentity>;

/** Stored values win when they are non-empty strings; anything else falls back to the default. */
export function normalizeSchoolIdentity(data: unknown): SchoolIdentity {
  const source = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const result = { ...DEFAULT_SCHOOL_IDENTITY };
  for (const field of FIELDS) {
    const value = source[field];
    if (typeof value === 'string' && value.trim()) result[field] = value.trim();
  }
  return result;
}

export function useSchoolIdentity(): { identity: SchoolIdentity; loading: boolean; stored: boolean } {
  const [state, setState] = useState({ identity: DEFAULT_SCHOOL_IDENTITY, loading: true, stored: false });

  useEffect(() => {
    return onSnapshot(
      doc(db, SCHOOL_IDENTITY_DOC.collection, SCHOOL_IDENTITY_DOC.id),
      (snap) => {
        setState({ identity: normalizeSchoolIdentity(snap.data()), loading: false, stored: snap.exists() });
      },
      (err) => {
        console.error('Failed to load sunday school identity', err);
        setState({ identity: DEFAULT_SCHOOL_IDENTITY, loading: false, stored: false });
      },
    );
  }, []);

  return state;
}

export function saveSchoolIdentity(identity: SchoolIdentity) {
  const clean = Object.fromEntries(FIELDS.map((field) => [field, identity[field].trim()]));
  return setDoc(doc(db, SCHOOL_IDENTITY_DOC.collection, SCHOOL_IDENTITY_DOC.id), clean);
}
