// Bible reading chart — book layout coordinates over the bookshelf illustration.
//
// AUTO-GENERATED from public/bible-reading-chart.svg by
// scripts/derive-bible-layout.mjs. Re-run that script if the blueprint changes.
// Coordinates are percentages of the container.

export type BibleTestament = 'old' | 'new';
export type BibleBookOrientation = 'vertical' | 'horizontal';

export type BibleBookShape =
  | { type: 'rect'; x: number; y: number; width: number; height: number; transform?: string }
  | { type: 'path'; d: string };

export const CHART_VIEWBOX = '0 0 2061 2496';

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
  /** Original SVG geometry; render with preserveAspectRatio="none" so shapes
   *  stretch to fit the container regardless of source vs PNG aspect ratio. */
  shape: BibleBookShape;
}

export const BIBLE_BOOK_SPOTS: BibleBookSpot[] = [
  // ── Shelf 1 ─────────────────────────────────────────────────────
  { name: '창세기', abbr: '창', testament: 'old', shelf: 1, top: 1.6, left: 0.15, width: 3.54, height: 17.31, orientation: 'vertical', shape: { type: 'rect', x: 3, y: 40, width: 73, height: 432 } },
  { name: '출애굽기', abbr: '출', testament: 'old', shelf: 1, top: 1.46, left: 3.94, width: 6.23, height: 17.32, orientation: 'vertical', shape: { type: 'rect', x: 81.1835, y: 45.8705, width: 74.3318, height: 426.294, transform: 'rotate(-7.37314 81.1835 45.8705)' } },
  { name: '레위기', abbr: '레', testament: 'old', shelf: 1, top: 1.84, left: 10.58, width: 3.64, height: 17.07, orientation: 'vertical', shape: { type: 'rect', x: 218, y: 46, width: 75, height: 426 } },
  { name: '민수기', abbr: '민', testament: 'old', shelf: 1, top: 1.76, left: 14.9, width: 5.05, height: 17.07, orientation: 'vertical', shape: { type: 'rect', x: 307, y: 44, width: 104, height: 426 } },
  { name: '신명기', abbr: '신', testament: 'old', shelf: 1, top: 1.6, left: 20.23, width: 6.35, height: 17.48, orientation: 'vertical', shape: { type: 'rect', x: 417, y: 49.8004, width: 76.3679, height: 430.075, transform: 'rotate(-7.37314 417 49.8004)' } },
  { name: '여호수아', abbr: '수', testament: 'old', shelf: 1, top: 12.86, left: 27.27, width: 21.15, height: 2.92, orientation: 'horizontal', shape: { type: 'rect', x: 562, y: 321, width: 436, height: 73 } },
  { name: '사사기', abbr: '삿', testament: 'old', shelf: 1, top: 16.03, left: 27.27, width: 21.15, height: 2.88, orientation: 'horizontal', shape: { type: 'rect', x: 562, y: 400, width: 436, height: 72 } },
  { name: '룻기', abbr: '룻', testament: 'old', shelf: 1, top: 1.77, left: 50.46, width: 5.08, height: 17.15, orientation: 'vertical', shape: { type: 'rect', x: 1069.98, y: 44.2572, width: 75, height: 423.725, transform: 'rotate(4.05681 1069.98 44.2572)' } },
  { name: '사무엘상', abbr: '삼상', testament: 'old', shelf: 1, top: 1.76, left: 55.7, width: 5.24, height: 17.15, orientation: 'vertical', shape: { type: 'rect', x: 1148, y: 44, width: 108, height: 428 } },
  { name: '사무엘하', abbr: '삼하', testament: 'old', shelf: 1, top: 1.5, left: 61.17, width: 6.34, height: 17.49, orientation: 'vertical', shape: { type: 'rect', x: 1260.78, y: 47.2212, width: 77.469, height: 430.225, transform: 'rotate(-7.19438 1260.78 47.2212)' } },
  { name: '열왕기상', abbr: '왕상', testament: 'old', shelf: 1, top: 0, left: 67.83, width: 3.78, height: 18.91, orientation: 'vertical', shape: { type: 'rect', x: 1398, y: 0, width: 78, height: 472 } },
  { name: '열왕기하', abbr: '왕하', testament: 'old', shelf: 1, top: 1.76, left: 71.86, width: 3.64, height: 17.15, orientation: 'vertical', shape: { type: 'rect', x: 1481, y: 44, width: 75, height: 428 } },
  { name: '역대상', abbr: '대상', testament: 'old', shelf: 1, top: 1.76, left: 75.69, width: 5.24, height: 17.23, orientation: 'vertical', shape: { type: 'rect', x: 1560, y: 44, width: 108, height: 430 } },
  { name: '역대하', abbr: '대하', testament: 'old', shelf: 1, top: 1.76, left: 81.22, width: 5.05, height: 17.23, orientation: 'vertical', shape: { type: 'rect', x: 1674, y: 44, width: 104, height: 430 } },
  { name: '에스라', abbr: '스', testament: 'old', shelf: 1, top: 1.68, left: 86.65, width: 4.06, height: 17.31, orientation: 'vertical', shape: { type: 'rect', x: 1795.62, y: 42, width: 74.0296, height: 430.62, transform: 'rotate(1.28743 1795.62 42)' } },
  { name: '느헤미야', abbr: '느', testament: 'old', shelf: 1, top: 1.76, left: 90.98, width: 4.75, height: 17.15, orientation: 'vertical', shape: { type: 'rect', x: 1875, y: 44, width: 98, height: 428 } },
  { name: '에스더', abbr: '에', testament: 'old', shelf: 1, top: 1.76, left: 96.17, width: 3.64, height: 17.23, orientation: 'vertical', shape: { type: 'rect', x: 1982, y: 44, width: 75, height: 430 } },

  // ── Shelf 2 ─────────────────────────────────────────────────────
  { name: '욥기', abbr: '욥', testament: 'old', shelf: 2, top: 28.73, left: 0, width: 3.74, height: 17.19, orientation: 'vertical', shape: { type: 'rect', x: 0, y: 717, width: 77, height: 429 } },
  { name: '시편', abbr: '시', testament: 'old', shelf: 2, top: 28.67, left: 4.16, width: 5.69, height: 17.3, orientation: 'vertical', shape: { type: 'rect', x: 98.4507, y: 715.57, width: 104.643, height: 429, transform: 'rotate(1.68891 98.4507 715.57)' } },
  { name: '잠언', abbr: '잠', testament: 'old', shelf: 2, top: 28.61, left: 10.24, width: 3.64, height: 17.19, orientation: 'vertical', shape: { type: 'rect', x: 211, y: 714, width: 75, height: 429 } },
  { name: '전도서', abbr: '전', testament: 'old', shelf: 2, top: 28.65, left: 14.19, width: 4.65, height: 17.39, orientation: 'vertical', shape: { type: 'rect', x: 292.494, y: 718.529, width: 76.1213, height: 431, transform: 'rotate(-2.62417 292.494 718.529)' } },
  { name: '아가', abbr: '아', testament: 'old', shelf: 2, top: 28.73, left: 19.31, width: 3.54, height: 17.19, orientation: 'vertical', shape: { type: 'rect', x: 398, y: 717, width: 73, height: 429 } },
  { name: '이사야', abbr: '사', testament: 'old', shelf: 2, top: 28.73, left: 23.19, width: 3.74, height: 17.19, orientation: 'vertical', shape: { type: 'rect', x: 478, y: 717, width: 77, height: 429 } },
  { name: '예레미야', abbr: '렘', testament: 'old', shelf: 2, top: 26.96, left: 27.27, width: 3.64, height: 18.95, orientation: 'vertical', shape: { type: 'rect', x: 562, y: 673, width: 75, height: 473 } },
  { name: '예레미야애가', abbr: '애', testament: 'old', shelf: 2, top: 30.29, left: 47.89, width: 21.25, height: 2.84, orientation: 'horizontal', shape: { type: 'rect', x: 987, y: 756, width: 438, height: 71 } },
  { name: '에스겔', abbr: '겔', testament: 'old', shelf: 2, top: 33.41, left: 46.77, width: 21.3, height: 2.88, orientation: 'horizontal', shape: { type: 'rect', x: 964, y: 834, width: 439, height: 72 } },
  { name: '다니엘', abbr: '단', testament: 'old', shelf: 2, top: 39.74, left: 44.93, width: 21.35, height: 2.92, orientation: 'horizontal', shape: { type: 'rect', x: 926, y: 992, width: 440, height: 73 } },
  { name: '호세아', abbr: '호', testament: 'old', shelf: 2, top: 36.54, left: 48.52, width: 21.25, height: 3, orientation: 'horizontal', shape: { type: 'rect', x: 1000, y: 912, width: 438, height: 75 } },
  { name: '요엘', abbr: '욜', testament: 'old', shelf: 2, top: 42.91, left: 47.45, width: 21.25, height: 2.92, orientation: 'horizontal', shape: { type: 'rect', x: 978, y: 1071, width: 438, height: 73 } },
  { name: '아모스', abbr: '암', testament: 'old', shelf: 2, top: 24.56, left: 85.59, width: 3.74, height: 21.23, orientation: 'vertical', shape: { type: 'rect', x: 1764, y: 613, width: 77, height: 530 } },
  { name: '오바댜', abbr: '옵', testament: 'old', shelf: 2, top: 28.57, left: 89.71, width: 6.12, height: 17.43, orientation: 'vertical', shape: { type: 'rect', x: 1848.86, y: 718.567, width: 103.877, height: 430.313, transform: 'rotate(-2.97849 1848.86 718.567)' } },
  { name: '요나', abbr: '욘', testament: 'old', shelf: 2, top: 28.77, left: 96.17, width: 3.64, height: 17.15, orientation: 'vertical', shape: { type: 'rect', x: 1982, y: 718, width: 75, height: 428 } },

  // ── Shelf 3 ─────────────────────────────────────────────────────
  { name: '미가', abbr: '미', testament: 'old', shelf: 3, top: 55.49, left: 0.92, width: 4.71, height: 17.27, orientation: 'vertical', shape: { type: 'rect', x: 19, y: 1385, width: 97, height: 431 } },
  { name: '나훔', abbr: '나', testament: 'old', shelf: 3, top: 51.48, left: 6.16, width: 3.59, height: 21.27, orientation: 'vertical', shape: { type: 'rect', x: 127, y: 1285, width: 74, height: 531 } },
  { name: '하박국', abbr: '합', testament: 'old', shelf: 3, top: 55.53, left: 10.24, width: 4.6, height: 17.4, orientation: 'vertical', shape: { type: 'path', d: 'M211.032 1389.54L285.635 1386.04L305.861 1816.81L231.258 1820.32L211.032 1389.54Z' } },
  { name: '스바냐', abbr: '습', testament: 'old', shelf: 3, top: 55.49, left: 15.28, width: 4.66, height: 17.27, orientation: 'vertical', shape: { type: 'rect', x: 315, y: 1385, width: 96, height: 431 } },
  { name: '학개', abbr: '학', testament: 'old', shelf: 3, top: 55.49, left: 20.33, width: 3.49, height: 17.43, orientation: 'vertical', shape: { type: 'rect', x: 419, y: 1385, width: 72, height: 435 } },
  { name: '스가랴', abbr: '슥', testament: 'old', shelf: 3, top: 53.73, left: 24.21, width: 3.59, height: 19.19, orientation: 'vertical', shape: { type: 'rect', x: 499, y: 1341, width: 74, height: 479 } },
  { name: '말라기', abbr: '말', testament: 'old', shelf: 3, top: 55.54, left: 28.14, width: 5.5, height: 17.38, orientation: 'vertical', shape: { type: 'rect', x: 579.888, y: 1389.91, width: 97.2804, height: 430.406, transform: 'rotate(-2.14002 579.888 1389.91)' } },
  { name: '마태복음', abbr: '마', testament: 'new', shelf: 3, top: 55.53, left: 34.06, width: 3.59, height: 17.23, orientation: 'vertical', shape: { type: 'rect', x: 702, y: 1386, width: 74, height: 430 } },
  { name: '마가복음', abbr: '막', testament: 'new', shelf: 3, top: 60.42, left: 40.08, width: 21.25, height: 2.88, orientation: 'horizontal', shape: { type: 'rect', x: 826, y: 1508, width: 438, height: 72 } },
  { name: '누가복음', abbr: '눅', testament: 'new', shelf: 3, top: 63.5, left: 38.28, width: 21.25, height: 3.08, orientation: 'horizontal', shape: { type: 'rect', x: 789, y: 1585, width: 438, height: 77 } },
  { name: '요한복음', abbr: '요', testament: 'new', shelf: 3, top: 66.75, left: 40.08, width: 21.25, height: 2.92, orientation: 'horizontal', shape: { type: 'rect', x: 826, y: 1666, width: 438, height: 73 } },
  { name: '사도행전', abbr: '행', testament: 'new', shelf: 3, top: 69.87, left: 38.28, width: 21.25, height: 3, orientation: 'horizontal', shape: { type: 'rect', x: 789, y: 1744, width: 438, height: 75 } },
  { name: '로마서', abbr: '롬', testament: 'new', shelf: 3, top: 51.56, left: 62.15, width: 3.69, height: 21.31, orientation: 'vertical', shape: { type: 'rect', x: 1281, y: 1287, width: 76, height: 532 } },
  { name: '고린도전서', abbr: '고전', testament: 'new', shelf: 3, top: 66.75, left: 68.66, width: 21.25, height: 2.92, orientation: 'horizontal', shape: { type: 'rect', x: 1415, y: 1666, width: 438, height: 73 } },
  { name: '고린도후서', abbr: '고후', testament: 'new', shelf: 3, top: 69.87, left: 67.01, width: 21.11, height: 3, orientation: 'horizontal', shape: { type: 'rect', x: 1381, y: 1744, width: 435, height: 75 } },
  { name: '갈라디아서', abbr: '갈', testament: 'new', shelf: 3, top: 55.57, left: 91.27, width: 3.64, height: 17.15, orientation: 'vertical', shape: { type: 'rect', x: 1881, y: 1387, width: 75, height: 428 } },
  { name: '에베소서', abbr: '엡', testament: 'new', shelf: 3, top: 55.37, left: 95.11, width: 4.88, height: 17.61, orientation: 'vertical', shape: { type: 'rect', x: 1960.25, y: 1386.57, width: 75, height: 435.842, transform: 'rotate(-3.38888 1960.25 1386.57)' } },

  // ── Shelf 4 ─────────────────────────────────────────────────────
  { name: '빌립보서', abbr: '빌', testament: 'new', shelf: 4, top: 93.79, left: 1.94, width: 21.15, height: 2.88, orientation: 'horizontal', shape: { type: 'rect', x: 40, y: 2341, width: 436, height: 72 } },
  { name: '골로새서', abbr: '골', testament: 'new', shelf: 4, top: 96.92, left: 0.19, width: 21.15, height: 2.92, orientation: 'horizontal', shape: { type: 'rect', x: 4, y: 2419, width: 436, height: 73 } },
  { name: '데살로니가전서', abbr: '살전', testament: 'new', shelf: 4, top: 78.45, left: 23.44, width: 3.69, height: 21.39, orientation: 'vertical', shape: { type: 'rect', x: 483, y: 1958, width: 76, height: 534 } },
  { name: '데살로니가후서', abbr: '살후', testament: 'new', shelf: 4, top: 78.45, left: 27.41, width: 3.59, height: 21.39, orientation: 'vertical', shape: { type: 'rect', x: 565, y: 1958, width: 74, height: 534 } },
  { name: '디모데전서', abbr: '딤전', testament: 'new', shelf: 4, top: 82.61, left: 31.44, width: 4.66, height: 17.23, orientation: 'vertical', shape: { type: 'rect', x: 648, y: 2062, width: 96, height: 430 } },
  { name: '디모데후서', abbr: '딤후', testament: 'new', shelf: 4, top: 82.61, left: 36.39, width: 4.71, height: 17.23, orientation: 'vertical', shape: { type: 'rect', x: 750, y: 2062, width: 97, height: 430 } },
  { name: '디도서', abbr: '딛', testament: 'new', shelf: 4, top: 87.34, left: 43.91, width: 21.2, height: 3, orientation: 'horizontal', shape: { type: 'rect', x: 905, y: 2180, width: 437, height: 75 } },
  { name: '빌레몬서', abbr: '몬', testament: 'new', shelf: 4, top: 90.58, left: 42.65, width: 21.11, height: 2.92, orientation: 'horizontal', shape: { type: 'rect', x: 879, y: 2261, width: 435, height: 73 } },
  { name: '히브리서', abbr: '히', testament: 'new', shelf: 4, top: 93.75, left: 44.3, width: 21.3, height: 2.96, orientation: 'horizontal', shape: { type: 'rect', x: 913, y: 2340, width: 439, height: 74 } },
  { name: '야고보서', abbr: '약', testament: 'new', shelf: 4, top: 96.92, left: 42.65, width: 21.11, height: 2.92, orientation: 'horizontal', shape: { type: 'rect', x: 879, y: 2419, width: 435, height: 73 } },
  { name: '베드로전서', abbr: '벧전', testament: 'new', shelf: 4, top: 82.65, left: 66.23, width: 4.66, height: 17.19, orientation: 'vertical', shape: { type: 'rect', x: 1365, y: 2063, width: 96, height: 429 } },
  { name: '베드로후서', abbr: '벧후', testament: 'new', shelf: 4, top: 82.65, left: 71.28, width: 4.61, height: 17.19, orientation: 'vertical', shape: { type: 'rect', x: 1469, y: 2063, width: 95, height: 429 } },
  { name: '요한일서', abbr: '요일', testament: 'new', shelf: 4, top: 78.53, left: 76.37, width: 3.59, height: 21.31, orientation: 'vertical', shape: { type: 'rect', x: 1574, y: 1960, width: 74, height: 532 } },
  { name: '요한이서', abbr: '요이', testament: 'new', shelf: 4, top: 78.53, left: 80.2, width: 3.64, height: 21.31, orientation: 'vertical', shape: { type: 'rect', x: 1653, y: 1960, width: 75, height: 532 } },
  { name: '요한삼서', abbr: '요삼', testament: 'new', shelf: 4, top: 78.53, left: 84.18, width: 3.49, height: 21.31, orientation: 'vertical', shape: { type: 'rect', x: 1735, y: 1960, width: 72, height: 532 } },
  { name: '유다서', abbr: '유', testament: 'new', shelf: 4, top: 82.53, left: 87.91, width: 5.84, height: 17.47, orientation: 'vertical', shape: { type: 'rect', x: 1826.41, y: 2060, width: 105.853, height: 432.684, transform: 'rotate(1.92958 1826.41 2060)' } },
  { name: '요한계시록', abbr: '계', testament: 'new', shelf: 4, top: 82.49, left: 93.98, width: 3.64, height: 17.19, orientation: 'vertical', shape: { type: 'rect', x: 1937, y: 2059, width: 75, height: 429 } },
];

export const BIBLE_BOOKS_OT_COUNT = BIBLE_BOOK_SPOTS.filter((s) => s.testament === 'old').length;
export const BIBLE_BOOKS_NT_COUNT = BIBLE_BOOK_SPOTS.filter((s) => s.testament === 'new').length;
export const BIBLE_BOOKS_TOTAL = BIBLE_BOOK_SPOTS.length;

export const isValidBibleBookName = (name: string) =>
  BIBLE_BOOK_SPOTS.some((spot) => spot.name === name);
