// Bible reading chart — book layout coordinates over /public/bible-reading-chart.png
//
// Coordinates are percentages of the container (which renders the image with
// object-fit: contain at the image's native aspect ratio). Adjust these values
// when fine-tuning visual alignment with the underlying illustration.
//
// orientation: 'vertical' = book stands on the shelf (label reads bottom-to-top
//              on the spine). 'horizontal' = book lies flat in a stack (label
//              reads left-to-right).

export type BibleTestament = 'old' | 'new';
export type BibleBookOrientation = 'vertical' | 'horizontal';

export interface BibleBookSpot {
  /** Canonical Korean name. Stored verbatim in completedBooks[]. */
  name: string;
  /** Short label for compact UI. */
  abbr: string;
  testament: BibleTestament;
  shelf: 1 | 2 | 3 | 4;
  /** Percentages of the container width/height. */
  top: number;
  left: number;
  width: number;
  height: number;
  orientation: BibleBookOrientation;
}

// Shelf vertical bands (rough — adjust together with each book's top).
// The illustration has 4 shelves spread roughly evenly with a small gap.
const SHELF_TOPS = { 1: 2, 2: 26.5, 3: 51, 4: 75.5 } as const;
const VERTICAL_HEIGHT = 22;
const HORIZONTAL_HEIGHT = 4.2;
const VERTICAL_WIDTH = 4.1;

// Helper to keep the long list readable.
const v = (
  shelf: 1 | 2 | 3 | 4,
  left: number,
  name: string,
  abbr: string,
  testament: BibleTestament,
  width = VERTICAL_WIDTH,
  height = VERTICAL_HEIGHT,
): BibleBookSpot => ({
  name,
  abbr,
  testament,
  shelf,
  top: SHELF_TOPS[shelf],
  left,
  width,
  height,
  orientation: 'vertical',
});

const h = (
  shelf: 1 | 2 | 3 | 4,
  top: number,
  left: number,
  width: number,
  name: string,
  abbr: string,
  testament: BibleTestament,
): BibleBookSpot => ({
  name,
  abbr,
  testament,
  shelf,
  top,
  left,
  width,
  height: HORIZONTAL_HEIGHT,
  orientation: 'horizontal',
});

export const BIBLE_BOOK_SPOTS: BibleBookSpot[] = [
  // Shelf 1 — Pentateuch + early historical (17 books)
  v(1, 4, '창세기', '창', 'old'),
  v(1, 8.5, '출애굽기', '출', 'old'),
  v(1, 13, '레위기', '레', 'old'),
  v(1, 17.5, '민수기', '민', 'old'),
  v(1, 22, '신명기', '신', 'old'),
  // Stack: 여호수아 / 사사기 (horizontal, mid shelf)
  h(1, 16, 28, 12, '여호수아', '수', 'old'),
  h(1, 21, 28, 12, '사사기', '삿', 'old'),
  v(1, 43, '룻기', '룻', 'old'),
  v(1, 47.5, '사무엘상', '삼상', 'old'),
  v(1, 52, '사무엘하', '삼하', 'old'),
  v(1, 56.5, '열왕기상', '왕상', 'old'),
  v(1, 61, '열왕기하', '왕하', 'old'),
  v(1, 65.5, '역대상', '대상', 'old'),
  v(1, 70, '역대하', '대하', 'old'),
  v(1, 74.5, '에스라', '스', 'old'),
  v(1, 79, '느헤미야', '느', 'old'),
  v(1, 83.5, '에스더', '에', 'old'),

  // Shelf 2 — Wisdom + major prophets (15 books)
  v(2, 6, '욥기', '욥', 'old'),
  v(2, 11, '시편', '시', 'old'),
  v(2, 16, '잠언', '잠', 'old'),
  v(2, 21, '전도서', '전', 'old'),
  v(2, 26, '아가', '아', 'old'),
  v(2, 31, '이사야', '사', 'old'),
  v(2, 36, '예레미야', '렘', 'old'),
  // Center stack: 예레미야애가 / 에스겔 / 다니엘 / 호세아 / 요엘
  h(2, 12, 46, 14, '예레미야애가', '애', 'old'),
  h(2, 17, 46, 14, '에스겔', '겔', 'old'),
  h(2, 22, 46, 14, '다니엘', '단', 'old'),
  h(2, 27, 46, 14, '호세아', '호', 'old'),
  h(2, 32, 46, 14, '요엘', '욜', 'old'),
  v(2, 78, '아모스', '암', 'old'),
  v(2, 83, '오바댜', '옵', 'old'),
  v(2, 88, '요나', '욘', 'old'),

  // Shelf 3 — Minor prophets + Gospels + Acts + early epistles (17 books)
  v(3, 4, '미가', '미', 'new'),  // visual position; testament accurate per book
  v(3, 8.5, '나훔', '나', 'old'),
  v(3, 13, '하박국', '합', 'old'),
  v(3, 17.5, '스바냐', '습', 'old'),
  v(3, 22, '학개', '학', 'old'),
  v(3, 26.5, '스가랴', '슥', 'old'),
  v(3, 31, '말라기', '말', 'old'),
  // 미가 actually old — fix
  // (testament for 미가 corrected below using the constant; entry above kept for layout but we re-spread testaments correctly via override)
  // Center stack: 마태복음 / 마가복음 / 누가복음 / 요한복음 / 사도행전
  h(3, 12, 38, 14, '마태복음', '마', 'new'),
  h(3, 17, 38, 14, '마가복음', '막', 'new'),
  h(3, 22, 38, 14, '누가복음', '눅', 'new'),
  h(3, 27, 38, 14, '요한복음', '요', 'new'),
  h(3, 32, 38, 14, '사도행전', '행', 'new'),
  v(3, 56, '로마서', '롬', 'new'),
  // Right stack: 고린도전서 / 고린도후서
  h(3, 22, 67, 12, '고린도전서', '고전', 'new'),
  h(3, 27, 67, 12, '고린도후서', '고후', 'new'),
  v(3, 84, '갈라디아서', '갈', 'new'),
  v(3, 88.5, '에베소서', '엡', 'new'),

  // Shelf 4 — Remaining epistles + Revelation (17 books)
  // Left stack: 빌립보서 / 골로새서
  h(4, 23, 6, 13, '빌립보서', '빌', 'new'),
  h(4, 28, 6, 13, '골로새서', '골', 'new'),
  v(4, 22, '데살로니가전서', '살전', 'new'),
  v(4, 26.5, '데살로니가후서', '살후', 'new'),
  v(4, 31, '디모데전서', '딤전', 'new'),
  v(4, 35.5, '디모데후서', '딤후', 'new'),
  // Center stack: 디도서 / 빌레몬서 / 히브리서 / 야고보서
  h(4, 17, 42, 13, '디도서', '딛', 'new'),
  h(4, 22, 42, 13, '빌레몬서', '몬', 'new'),
  h(4, 27, 42, 13, '히브리서', '히', 'new'),
  h(4, 32, 42, 13, '야고보서', '약', 'new'),
  v(4, 60, '베드로전서', '벧전', 'new'),
  v(4, 64.5, '베드로후서', '벧후', 'new'),
  v(4, 69, '요한일서', '요일', 'new'),
  v(4, 73.5, '요한이서', '요이', 'new'),
  v(4, 78, '요한삼서', '요삼', 'new'),
  v(4, 82.5, '유다서', '유', 'new'),
  v(4, 87, '요한계시록', '계', 'new'),
];

// Correct testament for 미가 (old) — entry above marked 'new' by oversight.
const MIGAH_INDEX = BIBLE_BOOK_SPOTS.findIndex((spot) => spot.name === '미가');
if (MIGAH_INDEX >= 0) {
  BIBLE_BOOK_SPOTS[MIGAH_INDEX] = { ...BIBLE_BOOK_SPOTS[MIGAH_INDEX], testament: 'old' };
}

export const BIBLE_BOOKS_OT_COUNT = BIBLE_BOOK_SPOTS.filter((s) => s.testament === 'old').length;
export const BIBLE_BOOKS_NT_COUNT = BIBLE_BOOK_SPOTS.filter((s) => s.testament === 'new').length;
export const BIBLE_BOOKS_TOTAL = BIBLE_BOOK_SPOTS.length;

export const isValidBibleBookName = (name: string) =>
  BIBLE_BOOK_SPOTS.some((spot) => spot.name === name);
