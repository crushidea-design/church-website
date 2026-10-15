// Pure helpers for deleting test ("시범") data. The server enforces every rule
// again; these only decide what the UI offers and how it words the result.
import type { RaahMember, RaahSyntheticDeleteCounts } from './managementApi';

/** A period can be deleted only when nobody real has a review in it (empty periods qualify). */
export function canDeleteTestPeriod(reviews: Array<{ memberId: string }>, members: Array<Pick<RaahMember, 'id' | 'isSynthetic'>>) {
  const synthetic = new Set(members.filter((member) => member.isSynthetic).map((member) => member.id));
  return reviews.every((review) => synthetic.has(review.memberId));
}

export const SYNTHETIC_MEMBER_DELETE_CONFIRM =
  '이 시범 성도와 관련된 모든 기록(심방·상담 기록, 성찬 목양 대화, 후속 돌봄, 일정)이 영구적으로 삭제되며 되돌릴 수 없습니다.\n\n정말 삭제할까요?';

export const TEST_PERIOD_DELETE_CONFIRM =
  '이 목양 주기와 주기에 속한 시범 성도의 성찬 목양 정보, 이 주기에서 만든 후속 돌봄과 일정이 영구적으로 삭제되며 되돌릴 수 없습니다.\n\n정말 삭제할까요?';

export const REAL_MEMBERS_IN_PERIOD_MESSAGE = '실제 성도가 포함된 주기는 삭제할 수 없습니다.';

export function describeSyntheticDelete(counts: Partial<RaahSyntheticDeleteCounts>) {
  return `시범 자료를 삭제했습니다. (기록 ${counts.visitationLogs ?? 0}건, 후속 돌봄 ${counts.careTasks ?? 0}건, 일정 ${counts.scheduleItems ?? 0}건)`;
}
