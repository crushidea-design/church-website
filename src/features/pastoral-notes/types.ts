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

export interface PastoralNote {
  id: string;
  memberName: string;
  memberSearchName: string;
  date: string;
  meetingType: PastoralMeetingType | string;
  currentSituation: string;
  encouragement: string;
  prayerTopics: string;
  nextFollowUpDate?: string;
  remarks?: string;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  createdByUid: string;
  createdByName: string;
}

export interface PastoralNoteInput {
  memberName: string;
  date: string;
  meetingType: PastoralMeetingType | string;
  currentSituation: string;
  encouragement: string;
  prayerTopics: string;
  nextFollowUpDate?: string;
  remarks?: string;
}
