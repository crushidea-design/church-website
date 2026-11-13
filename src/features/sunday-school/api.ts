import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
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
import { SUNDAY_SCHOOL_FLAG_DOC, SUNDAY_SCHOOL_FLAG_FIELD } from './flags';
import type { InventoryPost } from './admin/transition';
import {
  buildHeidelbergTopics,
  buildPreparationTabs,
  pickMissing,
} from './admin/preparationCatalog';

export interface SundaySchoolCatalog {
  terms: SchoolTerm[];
  curriculum: CurriculumEntry[];
  classes: SchoolClass[];
  loading: boolean;
  usingFallback: boolean;
  /** Per collection: true while the collection is empty/unreadable and defaults are shown. */
  fallback: { terms: boolean; curriculum: boolean; classes: boolean };
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
    fallback: { terms: terms.fallback, curriculum: curriculum.fallback, classes: classes.fallback },
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

const OPTIONAL_CURRICULUM_FIELDS = ['session', 'lordsDay', 'questions', 'note', 'isCommunionSunday'] as const;

/** Saves an entry and clears optional fields that were emptied in the editor. */
export function saveCurriculumEntry(entry: CurriculumEntry) {
  const data: Record<string, unknown> = { ...entry, updatedAt: serverTimestamp() };
  for (const field of OPTIONAL_CURRICULUM_FIELDS) {
    if (entry[field] === undefined) data[field] = deleteField();
  }
  return setDoc(doc(db, SCHOOL_CURRICULUM_COLLECTION, entry.id), data, { merge: true });
}

export const deleteCurriculumEntry = (id: string) => deleteDoc(doc(db, SCHOOL_CURRICULUM_COLLECTION, id));

export interface PreparationCatalogResult {
  tabs: { existing: number; created: number };
  topics: { existing: number; created: number };
}

const BATCH_LIMIT = 400;

/**
 * Creates the hidden 2027 resource tabs and Heidelberg topics that do not exist
 * yet. Existing documents are never read back or modified.
 */
export async function createMissingPreparationCatalog(): Promise<PreparationCatalogResult> {
  const [tabSnap, topicSnap] = await Promise.all([
    getDocs(collection(db, 'next_generation_resource_tabs')),
    getDocs(collection(db, 'next_generation_topics')),
  ]);
  const allTabs = buildPreparationTabs();
  const allTopics = buildHeidelbergTopics();
  const missingTabs = pickMissing(
    tabSnap.docs.map((d) => d.id),
    allTabs,
  );
  const missingTopics = pickMissing(
    topicSnap.docs.map((d) => d.id),
    allTopics,
  );

  const writes: Array<{ collectionName: string; slug: string; data: object }> = [
    ...missingTabs.map((item) => ({ collectionName: 'next_generation_resource_tabs', slug: item.slug, data: item })),
    ...missingTopics.map((item) => ({ collectionName: 'next_generation_topics', slug: item.slug, data: item })),
  ];
  for (let start = 0; start < writes.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const write of writes.slice(start, start + BATCH_LIMIT)) {
      batch.set(doc(db, write.collectionName, write.slug), {
        ...write.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  return {
    tabs: { existing: allTabs.length - missingTabs.length, created: missingTabs.length },
    topics: { existing: allTopics.length - missingTopics.length, created: missingTopics.length },
  };
}

export interface PreparationPostSummary {
  id: string;
  title: string;
  tabSlug: string;
  weekKey: string;
  topicId: string;
}

/** Unpublished next-generation posts (readable by the site admin only). */
export async function fetchUnpublishedPreparationPosts(): Promise<PreparationPostSummary[]> {
  // Same shape as the deployed isPublished + category + createdAt index.
  const snapshot = await getDocs(
    query(
      collection(db, 'posts'),
      where('isPublished', '==', false),
      where('category', '==', 'next_generation'),
      orderBy('createdAt', 'desc'),
      limit(100),
    ),
  );
  return snapshot.docs.map((postDoc) => {
    const data = postDoc.data();
    return {
      id: postDoc.id,
      title: typeof data.title === 'string' ? data.title : '',
      tabSlug: data.nextGenerationTabSlug || data.subCategory || '',
      weekKey: data.nextGenerationWeekKey || '',
      topicId: data.nextGenerationTopicId || '',
    };
  });
}

/** Posts used by the preservation check (plan §5-3); read-only. */
export interface InventoryFetchResult {
  published: PreservationPostRecord[];
  unpublished: PreservationPostRecord[];
  /** True when a query hit the limit, so the counts may be incomplete. */
  truncated: boolean;
}

type PreservationPostRecord = InventoryPost;

export const INVENTORY_QUERY_LIMIT = 1000;

/** Reads next-generation posts (published and private) for counting. Admin only for the private half. */
export async function fetchPostsForInventory(): Promise<InventoryFetchResult> {
  const run = async (isPublished: boolean) => {
    const snapshot = await getDocs(
      query(
        collection(db, 'posts'),
        where('isPublished', '==', isPublished),
        where('category', '==', 'next_generation'),
        orderBy('createdAt', 'desc'),
        limit(INVENTORY_QUERY_LIMIT),
      ),
    );
    return {
      posts: snapshot.docs.map((postDoc) => postDoc.data() as PreservationPostRecord),
      full: snapshot.docs.length >= INVENTORY_QUERY_LIMIT,
    };
  };
  const [published, unpublished] = await Promise.all([run(true), run(false)]);
  return { published: published.posts, unpublished: unpublished.posts, truncated: published.full || unpublished.full };
}

/**
 * Publishes the given private preparation posts. Only `isPublished` is written,
 * so the posts keep passing the Firestore rules' field whitelist.
 */
export async function publishPreparationPosts(postIds: string[]): Promise<{ published: number; failed: string[] }> {
  const failed: string[] = [];
  let published = 0;
  for (const id of postIds) {
    try {
      await updateDoc(doc(db, 'posts', id), { isPublished: true });
      published += 1;
    } catch (error) {
      console.error('Failed to publish post', id, error);
      failed.push(id);
    }
  }
  return { published, failed };
}

/** Turns the 2027 school screens on or off (settings write requires the site admin). */
export function setSundaySchool2027Flag(enabled: boolean) {
  return setDoc(
    doc(db, SUNDAY_SCHOOL_FLAG_DOC.collection, SUNDAY_SCHOOL_FLAG_DOC.id),
    { [SUNDAY_SCHOOL_FLAG_FIELD]: enabled },
    { merge: true },
  );
}
