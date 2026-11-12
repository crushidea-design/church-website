import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  DEFAULT_SCHOOL_CLASSES,
  DEFAULT_SCHOOL_CURRICULUM,
  DEFAULT_SCHOOL_TERMS,
} from './seedData';
import {
  SCHOOL_CLASSES_COLLECTION,
  SCHOOL_CURRICULUM_COLLECTION,
  SCHOOL_TERMS_COLLECTION,
} from './types';
import type { CurriculumEntry, SchoolClass, SchoolTerm } from './types';

export interface SundaySchoolCatalog {
  terms: SchoolTerm[];
  curriculum: CurriculumEntry[];
  classes: SchoolClass[];
  loading: boolean;
  usingFallback: boolean;
}

interface Slot<T> {
  items: T[];
  ready: boolean;
  fallback: boolean;
}

function useCollectionWithFallback<T extends { id: string }>(
  collectionName: string,
  orderField: string,
  defaults: T[],
): Slot<T> {
  const [slot, setSlot] = useState<Slot<T>>({ items: defaults, ready: false, fallback: true });

  useEffect(() => {
    const q = query(collection(db, collectionName), orderBy(orderField));
    return onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setSlot({ items: defaults, ready: true, fallback: true });
          return;
        }
        setSlot({
          items: snap.docs.map((d) => ({ ...(d.data() as Omit<T, 'id'>), id: d.id }) as T),
          ready: true,
          fallback: false,
        });
      },
      (err) => {
        console.error(`Failed to load ${collectionName}`, err);
        setSlot({ items: defaults, ready: true, fallback: true });
      },
    );
  }, [collectionName, orderField, defaults]);

  return slot;
}

export function useSundaySchoolCatalog(): SundaySchoolCatalog {
  const terms = useCollectionWithFallback<SchoolTerm>(SCHOOL_TERMS_COLLECTION, 'order', DEFAULT_SCHOOL_TERMS);
  const curriculum = useCollectionWithFallback<CurriculumEntry>(
    SCHOOL_CURRICULUM_COLLECTION,
    'date',
    DEFAULT_SCHOOL_CURRICULUM,
  );
  const classes = useCollectionWithFallback<SchoolClass>(SCHOOL_CLASSES_COLLECTION, 'order', DEFAULT_SCHOOL_CLASSES);

  return {
    terms: terms.items,
    curriculum: curriculum.items,
    classes: classes.items,
    loading: !(terms.ready && curriculum.ready && classes.ready),
    usingFallback: terms.fallback || curriculum.fallback || classes.fallback,
  };
}

async function seedCollectionIfEmpty<T extends { id: string }>(collectionName: string, defaults: T[]) {
  const existing = await getDocs(query(collection(db, collectionName), limit(1)));
  if (!existing.empty) return false;
  const batch = writeBatch(db);
  for (const item of defaults) {
    batch.set(doc(db, collectionName, item.id), {
      ...item,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return true;
}

/** Writes the default catalog into any collection that is still empty. Never overwrites. */
export async function seedSundaySchoolCatalogIfEmpty() {
  const terms = await seedCollectionIfEmpty(SCHOOL_TERMS_COLLECTION, DEFAULT_SCHOOL_TERMS);
  const curriculum = await seedCollectionIfEmpty(SCHOOL_CURRICULUM_COLLECTION, DEFAULT_SCHOOL_CURRICULUM);
  const classes = await seedCollectionIfEmpty(SCHOOL_CLASSES_COLLECTION, DEFAULT_SCHOOL_CLASSES);
  return { terms, curriculum, classes };
}

function upsert<T extends { id: string }>(collectionName: string, item: T) {
  return setDoc(doc(db, collectionName, item.id), { ...item, updatedAt: serverTimestamp() }, { merge: true });
}

export const upsertSchoolTerm = (term: SchoolTerm) => upsert(SCHOOL_TERMS_COLLECTION, term);
export const upsertCurriculumEntry = (entry: CurriculumEntry) => upsert(SCHOOL_CURRICULUM_COLLECTION, entry);
export const upsertSchoolClass = (schoolClass: SchoolClass) => upsert(SCHOOL_CLASSES_COLLECTION, schoolClass);
