import type { Timestamp } from 'firebase/firestore';

export interface WordFruitCard {
  order: 1 | 2 | 3;
  title: string;
  summary: string;
  question: string;
  prayer: string;
}

export type WordFruitStatus = 'draft' | 'published';

export interface WeeklyWordFruit {
  id: string;
  weekId: string;
  title: string;
  passage: string;
  memoryVerse: string;
  fruitName: string;
  startDate: string;
  endDate: string;
  status: WordFruitStatus;
  topMessage: string;
  guideMessage: string;
  recommendedPractices: string[];
  cards: WordFruitCard[];
  createdBy?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  /** Anonymous community summary, written by pastor. Public when status is published. */
  aggregateTotal?: number;
  aggregateCompleted?: number;
  aggregateGrowing?: number;
  aggregateMessage?: string;
  aggregateUpdatedAt?: Timestamp;
}

export interface WordFruitProgress {
  id: string;
  weekId: string;
  userId: string;
  childName: string;
  practice: string;
  checkCount: number;
  checkedDates: string[];
  fruitStage: 0 | 1 | 2 | 3;
  completed: boolean;
  /** Snapshot of the student's group at progress-creation time. */
  groupId?: string;
  lastCheckedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface WordFruitGroup {
  id: string;
  name: string;
  description?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const WORD_FRUIT_GROUPS_COLLECTION = 'next_generation_word_fruit_groups';

export const WORD_FRUITS_COLLECTION = 'next_generation_word_fruits';
export const WORD_FRUIT_PROGRESS_COLLECTION = 'next_generation_word_fruit_progress';

export const TOP_MESSAGE_DEFAULT = '하나님께서 우리 삶에 열매를 맺게 하세요.';
export const GUIDE_MESSAGE_DEFAULT = '이번 주 말씀을 기억하며, 한 주에 3번 이상 작은 순종을 실천해 보세요.';

export const DEFAULT_CARD_TITLES: Record<1 | 2 | 3, string> = {
  1: '말씀을 기억해요',
  2: '마음을 돌아보아요',
  3: '하나님께 감사해요',
};

export function emptyCards(): WordFruitCard[] {
  return [1, 2, 3].map((n) => ({
    order: n as 1 | 2 | 3,
    title: DEFAULT_CARD_TITLES[n as 1 | 2 | 3],
    summary: '',
    question: '',
    prayer: '',
  }));
}
