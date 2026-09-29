// Pure mapping from a decrypted legacy note (raah_notes) to a visitation-log
// body. No I/O and no logging: callers pass decrypted text in and get the four
// log fields back. raah-legacy-migration.test.ts pins LOG_TYPES to the client list.

export const LEGACY_LOG_TYPES = ['심방', '상담', '기도', '전화', '양육', '기타'] as const;
const FALLBACK_LOG_TYPE = '기타';

// Same limits raah-management's parseLogInput enforces; oversized notes are skipped, never truncated.
export const LOG_LIMITS = { innerNote: 5000, prayerTopics: 5000, nextSteps: 3000, privateRemarks: 3000 } as const;

export type LegacyPayload = {
  currentSituation?: unknown;
  encouragement?: unknown;
  prayerTopics?: unknown;
  nextFollowUpDate?: unknown;
  remarks?: unknown;
};

export type LegacyNoteInput = {
  memberName: string;
  meetingType: string;
  payload: LegacyPayload;
};

export type LegacyMemberRef = { id: string; name: string; is_synthetic?: boolean | null };

export type LogBody = { innerNote: string; prayerTopics: string; nextSteps: string; privateRemarks: string };

export type LegacySkipReason = 'too_long' | 'invalid' | 'decrypt_failed' | 'save_failed';

export type MappedLegacyNote =
  | { ok: true; logType: string; memberId: string | null; body: LogBody }
  | { ok: false; reason: 'too_long' | 'invalid' };

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** The one real (non-synthetic) member whose name matches exactly; null when none or several match. */
export function findMatchingMemberId(memberName: string, members: LegacyMemberRef[]): string | null {
  const name = memberName.trim();
  if (!name) return null;
  const matches = members.filter((member) => member.is_synthetic !== true && member.name.trim() === name);
  return matches.length === 1 ? matches[0].id : null;
}

export function mapLegacyNote(note: LegacyNoteInput, members: LegacyMemberRef[]): MappedLegacyNote {
  const meetingType = note.meetingType.trim();
  const knownType = (LEGACY_LOG_TYPES as readonly string[]).includes(meetingType);
  const logType = knownType ? meetingType : FALLBACK_LOG_TYPE;

  const encouragement = text(note.payload.encouragement);
  const paragraphs = [
    knownType || !meetingType ? '' : `[만남 유형] ${meetingType}`,
    text(note.payload.currentSituation),
    encouragement ? `[권면]\n${encouragement}` : '',
  ].filter(Boolean);

  const followUpDate = text(note.payload.nextFollowUpDate);
  const body: LogBody = {
    innerNote: paragraphs.join('\n\n'),
    prayerTopics: text(note.payload.prayerTopics),
    nextSteps: followUpDate ? `다음 확인일: ${followUpDate}` : '',
    privateRemarks: text(note.payload.remarks),
  };

  // The log editor requires both of these, so a body without them could not be saved again.
  if (!body.innerNote || !body.prayerTopics) return { ok: false, reason: 'invalid' };
  if (
    body.innerNote.length > LOG_LIMITS.innerNote ||
    body.prayerTopics.length > LOG_LIMITS.prayerTopics ||
    body.nextSteps.length > LOG_LIMITS.nextSteps ||
    body.privateRemarks.length > LOG_LIMITS.privateRemarks
  ) {
    return { ok: false, reason: 'too_long' };
  }

  return { ok: true, logType, memberId: findMatchingMemberId(note.memberName, members), body };
}
