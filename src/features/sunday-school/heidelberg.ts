export type HeidelbergPart = 'comfort' | 'misery' | 'deliverance' | 'gratitude';

export const HEIDELBERG_TOTAL_LORDS_DAYS = 52;
export const HEIDELBERG_TOTAL_QUESTIONS = 129;

const RANGES: Array<[number, number]> = [
  [1, 2], [3, 5], [6, 8], [9, 11], [12, 15], [16, 19], [20, 23], [24, 25], [26, 26], [27, 28],
  [29, 30], [31, 32], [33, 34], [35, 36], [37, 39], [40, 44], [45, 45], [46, 49], [50, 52], [53, 53],
  [54, 56], [57, 58], [59, 61], [62, 64], [65, 68], [69, 71], [72, 74], [75, 77], [78, 79], [80, 82],
  [83, 85], [86, 87], [88, 91], [92, 95], [96, 98], [99, 100], [101, 102], [103, 103], [104, 104], [105, 107],
  [108, 109], [110, 111], [112, 112], [113, 115], [116, 119], [120, 121], [122, 122], [123, 123], [124, 124], [125, 125],
  [126, 126], [127, 129],
];

// Lord's Day -> inclusive question range. LD1 is index 0.
export const HEIDELBERG_LORDS_DAYS: Array<{ lordsDay: number; questions: [number, number] }> = RANGES.map(
  (questions, index) => ({ lordsDay: index + 1, questions }),
);

export const HEIDELBERG_PART_LABELS: Record<HeidelbergPart, string> = {
  comfort: '위로',
  misery: '비참',
  deliverance: '구원',
  gratitude: '감사',
};

export function getHeidelbergPart(lordsDay: number): HeidelbergPart {
  if (lordsDay <= 1) return 'comfort';
  if (lordsDay <= 4) return 'misery';
  if (lordsDay <= 31) return 'deliverance';
  return 'gratitude';
}
