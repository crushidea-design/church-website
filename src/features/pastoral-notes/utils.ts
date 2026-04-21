import { PastoralNoteInput } from './types';

export function normalizeMemberName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR');
}

export function createEmptyPastoralNoteInput(): PastoralNoteInput {
  const today = new Date().toISOString().slice(0, 10);

  return {
    memberName: '',
    date: today,
    meetingType: '대면',
    currentSituation: '',
    encouragement: '',
    prayerTopics: '',
    nextFollowUpDate: '',
    remarks: '',
  };
}

export function formatDisplayDate(value?: string) {
  if (!value) return '-';

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(parsed);
}

export function sortNotesByDate<T extends { date: string; createdAt?: unknown }>(notes: T[]) {
  return [...notes].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;

    const aTime = getTimestampMillis(a.createdAt);
    const bTime = getTimestampMillis(b.createdAt);
    return bTime - aTime;
  });
}

function getTimestampMillis(value: unknown) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime();
  }

  return 0;
}
