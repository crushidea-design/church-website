import { Timestamp } from 'firebase/firestore';

export const PASTORAL_MEETING_TYPES = [
  '대면',
  '전화',
  '메시지',
  '가정 심방',
  '예배 전후',
  '기타',
] as const;

export type PastoralMeetingType = typeof PASTORAL_MEETING_TYPES[number];
export type PastoralNoteSource = 'supabase' | 'firestore';

export interface PastoralNoteSensitiveFields {
  currentSituation: string;
  encouragement: string;
  prayerTopics: string;
  nextFollowUpDate?: string;
  remarks?: string;
}

export interface PastoralNote extends Partial<PastoralNoteSensitiveFields> {
  id: string;
  memberName: string;
  memberSearchName: string;
  date: string;
  meetingType: PastoralMeetingType | string;
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
  createdByUid: string;
  createdByName: string;
  isEncrypted?: boolean;
  encryptionVersion?: number;
  source?: PastoralNoteSource;
}

export interface PastoralNoteInput extends PastoralNoteSensitiveFields {
  memberName: string;
  date: string;
  meetingType: PastoralMeetingType | string;
}
