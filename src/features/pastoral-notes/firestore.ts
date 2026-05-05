import { User } from 'firebase/auth';
import { addDoc, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { PastoralNote, PastoralNoteInput } from './types';
import { normalizeMemberName } from './utils';

const pastoralNotesCollection = collection(db, 'pastoral_notes');

export function subscribePastoralNotes(
  onChange: (notes: PastoralNote[]) => void,
  onError: (error: unknown) => void
) {
  const notesQuery = query(pastoralNotesCollection, orderBy('date', 'desc'));

  return onSnapshot(
    notesQuery,
    (snapshot) => {
      const notes = snapshot.docs.map((noteDoc) => ({
        id: noteDoc.id,
        source: 'firestore' as const,
        isEncrypted: false,
        ...(noteDoc.data() as Omit<PastoralNote, 'id'>),
      }));

      onChange(notes);
    },
    onError
  );
}

export async function createPastoralNote(input: PastoralNoteInput, user: User) {
  const memberName = input.memberName.trim().replace(/\s+/g, ' ');
  const now = new Date();

  return addDoc(pastoralNotesCollection, {
    memberName,
    memberSearchName: normalizeMemberName(memberName),
    date: input.date,
    meetingType: input.meetingType,
    currentSituation: input.currentSituation.trim(),
    encouragement: input.encouragement.trim(),
    prayerTopics: input.prayerTopics.trim(),
    nextFollowUpDate: input.nextFollowUpDate || '',
    remarks: input.remarks?.trim() || '',
    createdByUid: user.uid,
    createdByName: user.displayName || user.email || '관리자',
    createdAt: now,
    updatedAt: now,
  });
}
