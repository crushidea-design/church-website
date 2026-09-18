import { User } from 'firebase/auth';

export type RaahAiDraft = {
  publicSummary: string;
  innerNote: string;
  prayerTopics: string;
  nextSteps: string;
  privateRemarks: string;
  recommendedAction: string;
};

export type RaahAiDraftInput = {
  rawMemo: string;
  memberName?: string;
  logType?: string;
  date?: string;
};

// Compatibility entry point: never serialize or transmit a pastoral memo.
export async function generateRaahVisitationDraft(_input: RaahAiDraftInput, _user: User): Promise<RaahAiDraft> {
  throw new Error('목양 메모 보호를 위해 외부 AI 정리를 중단했습니다. 기록 양식에 직접 정리해 주세요.');
}
