import type { RaahAttendanceRecord } from './managementApi';

/** True when any field differs from the snapshot taken when the form opened. */
export function hasFormChanges<T extends object>(current: T, baseline: T) {
  const keys = new Set([...Object.keys(current), ...Object.keys(baseline)]) as Set<keyof T>;
  for (const key of keys) {
    if ((current[key] ?? '') !== (baseline[key] ?? '')) return true;
  }
  return false;
}

export type AttendanceDraft = {
  records: RaahAttendanceRecord[];
  serviceType: string;
  includesCommunion: boolean;
  memo: string;
};

/** Compares the attendance sheet being edited with what is saved (or the defaults for an unsaved service). */
export function hasAttendanceDraftChanges(draft: AttendanceDraft, saved: AttendanceDraft) {
  if (draft.serviceType !== saved.serviceType || draft.includesCommunion !== saved.includesCommunion || draft.memo !== saved.memo) {
    return true;
  }
  const savedByMember = new Map(saved.records.map((record) => [record.memberId, record]));
  if (draft.records.length !== savedByMember.size) return true;
  return draft.records.some((record) => {
    const baseline = savedByMember.get(record.memberId);
    return (
      !baseline ||
      record.attended !== baseline.attended ||
      record.communionParticipated !== baseline.communionParticipated ||
      (record.note || '') !== (baseline.note || '')
    );
  });
}
