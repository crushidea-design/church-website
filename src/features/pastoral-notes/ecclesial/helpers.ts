// Church-record facts per member (plan 6.1). The default is "미확인"; nothing is
// inferred from office, age, active status or past communion ticks, and an
// unconfirmed status never bars anyone from the Supper or removes them from care.

export type BaptismStatus = 'unknown' | 'not_baptized' | 'baptized';
export type ProfessionStatus = 'unknown' | 'preparing' | 'confirmed';
export type CommunicantStatus = 'unknown' | 'not_registered' | 'registered';

export type EcclesialDraft = {
  baptismStatus: BaptismStatus;
  professionStatus: ProfessionStatus;
  communicantStatus: CommunicantStatus;
  sourceLabel: string;
};

export type MemberEcclesialProfile = EcclesialDraft & {
  verifiedAt: string | null;
  /** 0 when the church has recorded nothing yet. */
  revision: number;
};

export type EcclesialSummary = { memberId: string; baptismStatus: BaptismStatus; professionStatus: ProfessionStatus; communicantStatus: CommunicantStatus };

export const BAPTISM_LABELS: Record<BaptismStatus, string> = { unknown: '미확인', not_baptized: '받지 않음', baptized: '받음' };
export const PROFESSION_LABELS: Record<ProfessionStatus, string> = { unknown: '미확인', preparing: '준비 중', confirmed: '입교함' };
export const COMMUNICANT_LABELS: Record<CommunicantStatus, string> = { unknown: '미확인', not_registered: '등록 안 됨', registered: '등록됨' };

export const SOURCE_MAX_LENGTH = 120;
export const ECCLESIAL_HINT = '교회가 가진 기록에 근거해 적습니다. 미확인은 성찬 참여 금지를 뜻하지 않습니다.';
export const SOURCE_REQUIRED_MESSAGE = '미확인이 아닌 항목이 있으면 출처를 적어 주세요. (예: 교적부 2026)';

export const EMPTY_ECCLESIAL_PROFILE: MemberEcclesialProfile = {
  baptismStatus: 'unknown',
  professionStatus: 'unknown',
  communicantStatus: 'unknown',
  sourceLabel: '',
  verifiedAt: null,
  revision: 0,
};

export const draftFromProfile = (profile: MemberEcclesialProfile): EcclesialDraft => ({
  baptismStatus: profile.baptismStatus,
  professionStatus: profile.professionStatus,
  communicantStatus: profile.communicantStatus,
  sourceLabel: profile.sourceLabel,
});

export const hasRecordedFact = (draft: Pick<EcclesialDraft, 'baptismStatus' | 'professionStatus' | 'communicantStatus'>) =>
  draft.baptismStatus !== 'unknown' || draft.professionStatus !== 'unknown' || draft.communicantStatus !== 'unknown';

/** Mirrors the server rule. Returns a Korean message, or null when the draft can be saved. */
export function validateEcclesialDraft(draft: EcclesialDraft): string | null {
  const source = draft.sourceLabel.trim();
  if (source.length > SOURCE_MAX_LENGTH) return `출처는 ${SOURCE_MAX_LENGTH}자 이내로 적어 주세요.`;
  if (hasRecordedFact(draft) && !source) return SOURCE_REQUIRED_MESSAGE;
  return null;
}

export type CommunicantBadge = { label: string; tone: 'registered' | 'unknown' | 'not_registered' };

export function communicantBadge(status: CommunicantStatus | undefined): CommunicantBadge {
  if (status === 'registered') return { label: '성찬회원', tone: 'registered' };
  if (status === 'not_registered') return { label: '등록 안 됨', tone: 'not_registered' };
  return { label: '미확인', tone: 'unknown' };
}

/** Map of member id to communicant status; a member without a row is unknown. */
export const communicantStatusById = (profiles: EcclesialSummary[]) =>
  new Map(profiles.map((profile) => [profile.memberId, profile.communicantStatus] as const));

/**
 * The roster filter. Anyone already on the roster stays visible so the pastor
 * never loses sight of a selection; the filter only narrows the candidates.
 */
export function passesCommunicantFilter(
  memberId: string,
  statuses: Map<string, CommunicantStatus>,
  onlyRegistered: boolean,
  onRoster: Set<string>
) {
  if (!onlyRegistered) return true;
  return statuses.get(memberId) === 'registered' || onRoster.has(memberId);
}
