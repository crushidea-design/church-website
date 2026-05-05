import { User } from 'firebase/auth';
import { PastoralNote, PastoralNoteInput, PastoralNoteSensitiveFields } from './types';

type ApiNote = {
  id: string;
  memberName: string;
  memberSearchName: string;
  date: string;
  meetingType: string;
  createdByUid: string;
  createdByName: string;
  createdAt?: string;
  updatedAt?: string;
  isEncrypted: boolean;
  encryptionVersion: number;
  sensitive?: PastoralNoteSensitiveFields;
};

async function getAuthHeaders(user: User) {
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : 'RAAH API request failed.';
    const error = new Error(message) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = typeof data?.code === 'string' ? data.code : undefined;
    throw error;
  }

  return data as T;
}

function toPastoralNote(note: ApiNote): PastoralNote {
  return {
    id: note.id,
    memberName: note.memberName,
    memberSearchName: note.memberSearchName,
    date: note.date,
    meetingType: note.meetingType,
    createdByUid: note.createdByUid,
    createdByName: note.createdByName,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    isEncrypted: note.isEncrypted,
    encryptionVersion: note.encryptionVersion,
    source: 'supabase',
    ...note.sensitive,
  };
}

export async function listRaahNotes(user: User) {
  const response = await fetch('/api/raah/notes', {
    headers: await getAuthHeaders(user),
  });
  const data = await readJsonResponse<{ notes: ApiNote[] }>(response);
  return data.notes.map(toPastoralNote);
}

export async function getRaahNoteDetail(noteId: string, user: User) {
  const response = await fetch(`/api/raah/notes/${encodeURIComponent(noteId)}`, {
    headers: await getAuthHeaders(user),
  });
  const data = await readJsonResponse<{ note: ApiNote }>(response);
  return toPastoralNote(data.note);
}

export async function createRaahNote(input: PastoralNoteInput, user: User) {
  const response = await fetch('/api/raah/notes', {
    method: 'POST',
    headers: await getAuthHeaders(user),
    body: JSON.stringify(input),
  });
  const data = await readJsonResponse<{ note: ApiNote }>(response);
  return toPastoralNote(data.note);
}

export async function deleteRaahNote(noteId: string, user: User) {
  const response = await fetch(`/api/raah/notes/${encodeURIComponent(noteId)}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(user),
  });
  await readJsonResponse<{ ok: true }>(response);
}
