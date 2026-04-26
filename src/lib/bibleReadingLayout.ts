// Bible reading chart — book layout coordinates over the bookshelf illustration.
//
// AUTO-GENERATED from public/bible-reading-chart-blueprint.svg by
// scripts/derive-bible-layout.mjs. Re-run that script if the blueprint changes.
// Coordinates are percentages of the container.

export type BibleTestament = 'old' | 'new';
export type BibleBookOrientation = 'vertical' | 'horizontal';

export interface BibleBookSpot {
  name: string;
  abbr: string;
  testament: BibleTestament;
  shelf: 1 | 2 | 3 | 4;
  top: number;
  left: number;
  width: number;
  height: number;
  orientation: BibleBookOrientation;
}

export const BIBLE_BOOK_SPOTS: BibleBookSpot[] = [
  // ── Shelf 1 ─────────────────────────────────────────────────────
  { name: '창세기', abbr: '창', testament: 'old', shelf: 1, top: 1.6, left: 0.15, width: 3.54, height: 17.31, orientation: 'vertical' },
  { name: '출애굽기', abbr: '출', testament: 'old', shelf: 1, top: 1.46, left: 3.94, width: 6.23, height: 17.32, orientation: 'vertical' },
  { name: '레위기', abbr: '레', testament: 'old', shelf: 1, top: 1.84, left: 10.58, width: 3.64, height: 17.07, orientation: 'vertical' },
  { name: '민수기', abbr: '민', testament: 'old', shelf: 1, top: 1.76, left: 14.9, width: 5.05, height: 17.07, orientation: 'vertical' },
  { name: '신명기', abbr: '신', testament: 'old', shelf: 1, top: 1.6, left: 20.23, width: 6.35, height: 17.48, orientation: 'vertical' },
  { name: '여호수아', abbr: '수', testament: 'old', shelf: 1, top: 12.86, left: 27.27, width: 21.15, height: 2.92, orientation: 'horizontal' },
  { name: '사사기', abbr: '삿', testament: 'old', shelf: 1, top: 16.03, left: 27.27, width: 21.15, height: 2.88, orientation: 'horizontal' },
  { name: '룻기', abbr: '룻', testament: 'old', shelf: 1, top: 1.77, left: 50.46, width: 5.08, height: 17.15, orientation: 'vertical' },
  { name: '사무엘상', abbr: '삼상', testament: 'old', shelf: 1, top: 1.76, left: 55.7, width: 5.24, height: 17.15, orientation: 'vertical' },
  { name: '사무엘하', abbr: '삼하', testament: 'old', shelf: 1, top: 1.5, left: 61.17, width: 6.34, height: 17.49, orientation: 'vertical' },
  { name: '열왕기상', abbr: '왕상', testament: 'old', shelf: 1, top: 0, left: 67.83, width: 3.78, height: 18.91, orientation: 'vertical' },
  { name: '열왕기하', abbr: '왕하', testament: 'old', shelf: 1, top: 1.76, left: 71.86, width: 3.64, height: 17.15, orientation: 'vertical' },
  { name: '역대상', abbr: '대상', testament: 'old', shelf: 1, top: 1.76, left: 75.69, width: 5.24, height: 17.23, orientation: 'vertical' },
  { name: '역대하', abbr: '대하', testament: 'old', shelf: 1, top: 1.76, left: 81.22, width: 5.05, height: 17.23, orientation: 'vertical' },
  { name: '에스라', abbr: '스', testament: 'old', shelf: 1, top: 1.68, left: 86.65, width: 4.06, height: 17.31, orientation: 'vertical' },
  { name: '느헤미야', abbr: '느', testament: 'old', shelf: 1, top: 1.76, left: 90.98, width: 4.75, height: 17.15, orientation: 'vertical' },
  { name: '에스더', abbr: '에', testament: 'old', shelf: 1, top: 1.76, left: 96.17, width: 3.64, height: 17.23, orientation: 'vertical' },

  // ── Shelf 2 ─────────────────────────────────────────────────────
  { name: '욥기', abbr: '욥', testament: 'old', shelf: 2, top: 28.73, left: 0, width: 3.74, height: 17.19, orientation: 'vertical' },
  { name: '시편', abbr: '시', testament: 'old', shelf: 2, top: 28.67, left: 4.16, width: 5.69, height: 17.3, orientation: 'vertical' },
  { name: '잠언', abbr: '잠', testament: 'old', shelf: 2, top: 28.61, left: 10.24, width: 3.64, height: 17.19, orientation: 'vertical' },
  { name: '전도서', abbr: '전', testament: 'old', shelf: 2, top: 28.65, left: 14.19, width: 4.65, height: 17.39, orientation: 'vertical' },
  { name: '아가', abbr: '아', testament: 'old', shelf: 2, top: 28.73, left: 19.31, width: 3.54, height: 17.19, orientation: 'vertical' },
  { name: '이사야', abbr: '사', testament: 'old', shelf: 2, top: 28.73, left: 23.19, width: 3.74, height: 17.19, orientation: 'vertical' },
  { name: '예레미야', abbr: '렘', testament: 'old', shelf: 2, top: 26.96, left: 27.27, width: 3.64, height: 18.95, orientation: 'vertical' },
  { name: '예레미야애가', abbr: '애', testament: 'old', shelf: 2, top: 30.29, left: 47.89, width: 21.25, height: 2.84, orientation: 'horizontal' },
  { name: '에스겔', abbr: '겔', testament: 'old', shelf: 2, top: 33.41, left: 46.77, width: 21.3, height: 2.88, orientation: 'horizontal' },
  { name: '다니엘', abbr: '단', testament: 'old', shelf: 2, top: 39.74, left: 44.93, width: 21.35, height: 2.92, orientation: 'horizontal' },
  { name: '호세아', abbr: '호', testament: 'old', shelf: 2, top: 36.54, left: 48.52, width: 21.25, height: 3, orientation: 'horizontal' },
  { name: '요엘', abbr: '욜', testament: 'old', shelf: 2, top: 42.91, left: 47.45, width: 21.25, height: 2.92, orientation: 'horizontal' },
  { name: '아모스', abbr: '암', testament: 'old', shelf: 2, top: 24.56, left: 85.59, width: 3.74, height: 21.23, orientation: 'vertical' },
  { name: '오바댜', abbr: '옵', testament: 'old', shelf: 2, top: 28.57, left: 89.71, width: 6.12, height: 17.43, orientation: 'vertical' },
  { name: '요나', abbr: '욘', testament: 'old', shelf: 2, top: 28.77, left: 96.17, width: 3.64, height: 17.15, orientation: 'vertical' },

  // ── Shelf 3 ─────────────────────────────────────────────────────
  { name: '미가', abbr: '미', testament: 'old', shelf: 3, top: 55.49, left: 0.92, width: 4.71, height: 17.27, orientation: 'vertical' },
  { name: '나훔', abbr: '나', testament: 'old', shelf: 3, top: 51.48, left: 6.16, width: 3.59, height: 21.27, orientation: 'vertical' },
  { name: '하박국', abbr: '합', testament: 'old', shelf: 3, top: 55.53, left: 10.24, width: 4.6, height: 17.4, orientation: 'vertical' },
  { name: '스바냐', abbr: '습', testament: 'old', shelf: 3, top: 55.49, left: 15.28, width: 4.66, height: 17.27, orientation: 'vertical' },
  { name: '학개', abbr: '학', testament: 'old', shelf: 3, top: 55.49, left: 20.33, width: 3.49, height: 17.43, orientation: 'vertical' },
  { name: '스가랴', abbr: '슥', testament: 'old', shelf: 3, top: 53.73, left: 24.21, width: 3.59, height: 19.19, orientation: 'vertical' },
  { name: '말라기', abbr: '말', testament: 'old', shelf: 3, top: 55.54, left: 28.14, width: 5.5, height: 17.38, orientation: 'vertical' },
  { name: '마태복음', abbr: '마', testament: 'new', shelf: 3, top: 55.53, left: 34.06, width: 3.59, height: 17.23, orientation: 'vertical' },
  { name: '마가복음', abbr: '막', testament: 'new', shelf: 3, top: 60.42, left: 40.08, width: 21.25, height: 2.88, orientation: 'horizontal' },
  { name: '누가복음', abbr: '눅', testament: 'new', shelf: 3, top: 63.5, left: 38.28, width: 21.25, height: 3.08, orientation: 'horizontal' },
  { name: '요한복음', abbr: '요', testament: 'new', shelf: 3, top: 66.75, left: 40.08, width: 21.25, height: 2.92, orientation: 'horizontal' },
  { name: '사도행전', abbr: '행', testament: 'new', shelf: 3, top: 69.87, left: 38.28, width: 21.25, height: 3, orientation: 'horizontal' },
  { name: '로마서', abbr: '롬', testament: 'new', shelf: 3, top: 51.56, left: 62.15, width: 3.69, height: 21.31, orientation: 'vertical' },
  { name: '고린도전서', abbr: '고전', testament: 'new', shelf: 3, top: 66.75, left: 68.66, width: 21.25, height: 2.92, orientation: 'horizontal' },
  { name: '고린도후서', abbr: '고후', testament: 'new', shelf: 3, top: 69.87, left: 67.01, width: 21.11, height: 3, orientation: 'horizontal' },
  { name: '갈라디아서', abbr: '갈', testament: 'new', shelf: 3, top: 55.57, left: 91.27, width: 3.64, height: 17.15, orientation: 'vertical' },
  { name: '에베소서', abbr: '엡', testament: 'new', shelf: 3, top: 55.37, left: 95.11, width: 4.88, height: 17.61, orientation: 'vertical' },

  // ── Shelf 4 ─────────────────────────────────────────────────────
  { name: '빌립보서', abbr: '빌', testament: 'new', shelf: 4, top: 93.79, left: 1.94, width: 21.15, height: 2.88, orientation: 'horizontal' },
  { name: '골로새서', abbr: '골', testament: 'new', shelf: 4, top: 96.92, left: 0.19, width: 21.15, height: 2.92, orientation: 'horizontal' },
  { name: '데살로니가전서', abbr: '살전', testament: 'new', shelf: 4, top: 78.45, left: 23.44, width: 3.69, height: 21.39, orientation: 'vertical' },
  { name: '데살로니가후서', abbr: '살후', testament: 'new', shelf: 4, top: 78.45, left: 27.41, width: 3.59, height: 21.39, orientation: 'vertical' },
  { name: '디모데전서', abbr: '딤전', testament: 'new', shelf: 4, top: 82.61, left: 31.44, width: 4.66, height: 17.23, orientation: 'vertical' },
  { name: '디모데후서', abbr: '딤후', testament: 'new', shelf: 4, top: 82.61, left: 36.39, width: 4.71, height: 17.23, orientation: 'vertical' },
  { name: '디도서', abbr: '딛', testament: 'new', shelf: 4, top: 87.34, left: 43.91, width: 21.2, height: 3, orientation: 'horizontal' },
  { name: '빌레몬서', abbr: '몬', testament: 'new', shelf: 4, top: 90.58, left: 42.65, width: 21.11, height: 2.92, orientation: 'horizontal' },
  { name: '히브리서', abbr: '히', testament: 'new', shelf: 4, top: 93.75, left: 44.3, width: 21.3, height: 2.96, orientation: 'horizontal' },
  { name: '야고보서', abbr: '약', testament: 'new', shelf: 4, top: 96.92, left: 42.65, width: 21.11, height: 2.92, orientation: 'horizontal' },
  { name: '베드로전서', abbr: '벧전', testament: 'new', shelf: 4, top: 82.65, left: 66.23, width: 4.66, height: 17.19, orientation: 'vertical' },
  { name: '베드로후서', abbr: '벧후', testament: 'new', shelf: 4, top: 82.65, left: 71.28, width: 4.61, height: 17.19, orientation: 'vertical' },
  { name: '요한일서', abbr: '요일', testament: 'new', shelf: 4, top: 78.53, left: 76.37, width: 3.59, height: 21.31, orientation: 'vertical' },
  { name: '요한이서', abbr: '요이', testament: 'new', shelf: 4, top: 78.53, left: 80.2, width: 3.64, height: 21.31, orientation: 'vertical' },
  { name: '요한삼서', abbr: '요삼', testament: 'new', shelf: 4, top: 78.53, left: 84.18, width: 3.49, height: 21.31, orientation: 'vertical' },
  { name: '유다서', abbr: '유', testament: 'new', shelf: 4, top: 82.53, left: 87.91, width: 5.84, height: 17.47, orientation: 'vertical' },
  { name: '요한계시록', abbr: '계', testament: 'new', shelf: 4, top: 82.49, left: 93.98, width: 3.64, height: 17.19, orientation: 'vertical' },
];

export const BIBLE_BOOKS_OT_COUNT = BIBLE_BOOK_SPOTS.filter((s) => s.testament === 'old').length;
export const BIBLE_BOOKS_NT_COUNT = BIBLE_BOOK_SPOTS.filter((s) => s.testament === 'new').length;
export const BIBLE_BOOKS_TOTAL = BIBLE_BOOK_SPOTS.length;

export const isValidBibleBookName = (name: string) =>
  BIBLE_BOOK_SPOTS.some((spot) => spot.name === name);
