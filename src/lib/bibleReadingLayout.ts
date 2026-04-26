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

export const CHART_VIEWBOX = '0 0 2265 2806';

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
  { name: '창세기', abbr: '창', testament: 'old', shelf: 1, top: 2.46, left: 5.3, width: 3.22, height: 15.4, orientation: 'vertical', shape: { type: 'rect', x: 120, y: 69, width: 73, height: 432 } },
  { name: '출애굽기', abbr: '출', testament: 'old', shelf: 1, top: 2.33, left: 8.75, width: 5.67, height: 15.41, orientation: 'vertical', shape: { type: 'rect', x: 198.183, y: 74.8705, width: 74.3318, height: 426.294, transform: 'rotate(-7.37314 198.183 74.8705)' } },
  { name: '레위기', abbr: '레', testament: 'old', shelf: 1, top: 2.67, left: 14.79, width: 3.31, height: 15.18, orientation: 'vertical', shape: { type: 'rect', x: 335, y: 75, width: 75, height: 426 } },
  { name: '민수기', abbr: '민', testament: 'old', shelf: 1, top: 2.6, left: 18.72, width: 4.59, height: 15.18, orientation: 'vertical', shape: { type: 'rect', x: 424, y: 73, width: 104, height: 426 } },
  { name: '신명기', abbr: '신', testament: 'old', shelf: 1, top: 2.46, left: 23.58, width: 5.78, height: 15.55, orientation: 'vertical', shape: { type: 'rect', x: 534, y: 78.8004, width: 76.3679, height: 430.075, transform: 'rotate(-7.37314 534 78.8004)' } },
  { name: '여호수아', abbr: '수', testament: 'old', shelf: 1, top: 12.47, left: 29.98, width: 19.25, height: 2.6, orientation: 'horizontal', shape: { type: 'rect', x: 679, y: 350, width: 436, height: 73 } },
  { name: '사사기', abbr: '삿', testament: 'old', shelf: 1, top: 15.29, left: 29.98, width: 19.25, height: 2.57, orientation: 'horizontal', shape: { type: 'rect', x: 679, y: 429, width: 436, height: 72 } },
  { name: '룻기', abbr: '룻', testament: 'old', shelf: 1, top: 2.61, left: 51.08, width: 4.63, height: 15.25, orientation: 'vertical', shape: { type: 'rect', x: 1186.98, y: 73.2572, width: 75, height: 423.725, transform: 'rotate(4.05681 1186.98 73.2572)' } },
  { name: '사무엘상', abbr: '삼상', testament: 'old', shelf: 1, top: 2.6, left: 55.85, width: 4.77, height: 15.25, orientation: 'vertical', shape: { type: 'rect', x: 1265, y: 73, width: 108, height: 428 } },
  { name: '사무엘하', abbr: '삼하', testament: 'old', shelf: 1, top: 2.37, left: 60.83, width: 5.77, height: 15.56, orientation: 'vertical', shape: { type: 'rect', x: 1377.78, y: 76.2212, width: 77.469, height: 430.225, transform: 'rotate(-7.19438 1377.78 76.2212)' } },
  { name: '열왕기상', abbr: '왕상', testament: 'old', shelf: 1, top: 1.03, left: 66.89, width: 3.44, height: 16.82, orientation: 'vertical', shape: { type: 'rect', x: 1515, y: 29, width: 78, height: 472 } },
  { name: '열왕기하', abbr: '왕하', testament: 'old', shelf: 1, top: 2.6, left: 70.55, width: 3.31, height: 15.25, orientation: 'vertical', shape: { type: 'rect', x: 1598, y: 73, width: 75, height: 428 } },
  { name: '역대상', abbr: '대상', testament: 'old', shelf: 1, top: 2.6, left: 74.04, width: 4.77, height: 15.32, orientation: 'vertical', shape: { type: 'rect', x: 1677, y: 73, width: 108, height: 430 } },
  { name: '역대하', abbr: '대하', testament: 'old', shelf: 1, top: 2.6, left: 79.07, width: 4.59, height: 15.32, orientation: 'vertical', shape: { type: 'rect', x: 1791, y: 73, width: 104, height: 430 } },
  { name: '에스라', abbr: '스', testament: 'old', shelf: 1, top: 2.53, left: 84.02, width: 3.69, height: 15.4, orientation: 'vertical', shape: { type: 'rect', x: 1912.62, y: 71, width: 74.0296, height: 430.62, transform: 'rotate(1.28743 1912.62 71)' } },
  { name: '느헤미야', abbr: '느', testament: 'old', shelf: 1, top: 2.6, left: 87.95, width: 4.33, height: 15.25, orientation: 'vertical', shape: { type: 'rect', x: 1992, y: 73, width: 98, height: 428 } },
  { name: '에스더', abbr: '에', testament: 'old', shelf: 1, top: 2.6, left: 92.67, width: 3.31, height: 15.32, orientation: 'vertical', shape: { type: 'rect', x: 2099, y: 73, width: 75, height: 430 } },

  // ── Shelf 2 ─────────────────────────────────────────────────────
  { name: '욥기', abbr: '욥', testament: 'old', shelf: 2, top: 26.59, left: 5.17, width: 3.4, height: 15.29, orientation: 'vertical', shape: { type: 'rect', x: 117, y: 746, width: 77, height: 429 } },
  { name: '시편', abbr: '시', testament: 'old', shelf: 2, top: 26.53, left: 8.95, width: 5.18, height: 15.39, orientation: 'vertical', shape: { type: 'rect', x: 215.451, y: 744.57, width: 104.643, height: 429, transform: 'rotate(1.68891 215.451 744.57)' } },
  { name: '잠언', abbr: '잠', testament: 'old', shelf: 2, top: 26.48, left: 14.48, width: 3.31, height: 15.29, orientation: 'vertical', shape: { type: 'rect', x: 328, y: 743, width: 75, height: 429 } },
  { name: '전도서', abbr: '전', testament: 'old', shelf: 2, top: 26.52, left: 18.08, width: 4.23, height: 15.47, orientation: 'vertical', shape: { type: 'rect', x: 409.494, y: 747.529, width: 76.1213, height: 431, transform: 'rotate(-2.62417 409.494 747.529)' } },
  { name: '아가', abbr: '아', testament: 'old', shelf: 2, top: 26.59, left: 22.74, width: 3.22, height: 15.29, orientation: 'vertical', shape: { type: 'rect', x: 515, y: 746, width: 73, height: 429 } },
  { name: '이사야', abbr: '사', testament: 'old', shelf: 2, top: 26.59, left: 26.27, width: 3.4, height: 15.29, orientation: 'vertical', shape: { type: 'rect', x: 595, y: 746, width: 77, height: 429 } },
  { name: '예레미야', abbr: '렘', testament: 'old', shelf: 2, top: 25.02, left: 29.98, width: 3.31, height: 16.86, orientation: 'vertical', shape: { type: 'rect', x: 679, y: 702, width: 75, height: 473 } },
  { name: '예레미야애가', abbr: '애', testament: 'old', shelf: 2, top: 27.98, left: 48.74, width: 19.34, height: 2.53, orientation: 'horizontal', shape: { type: 'rect', x: 1104, y: 785, width: 438, height: 71 } },
  { name: '에스겔', abbr: '겔', testament: 'old', shelf: 2, top: 30.76, left: 47.73, width: 19.38, height: 2.57, orientation: 'horizontal', shape: { type: 'rect', x: 1081, y: 863, width: 439, height: 72 } },
  { name: '다니엘', abbr: '단', testament: 'old', shelf: 2, top: 36.39, left: 46.05, width: 19.43, height: 2.6, orientation: 'horizontal', shape: { type: 'rect', x: 1043, y: 1021, width: 440, height: 73 } },
  { name: '호세아', abbr: '호', testament: 'old', shelf: 2, top: 33.54, left: 49.32, width: 19.34, height: 2.67, orientation: 'horizontal', shape: { type: 'rect', x: 1117, y: 941, width: 438, height: 75 } },
  { name: '요엘', abbr: '욜', testament: 'old', shelf: 2, top: 39.2, left: 48.34, width: 19.34, height: 2.6, orientation: 'horizontal', shape: { type: 'rect', x: 1095, y: 1100, width: 438, height: 73 } },
  { name: '아모스', abbr: '암', testament: 'old', shelf: 2, top: 22.88, left: 83.05, width: 3.4, height: 18.89, orientation: 'vertical', shape: { type: 'rect', x: 1881, y: 642, width: 77, height: 530 } },
  { name: '오바댜', abbr: '옵', testament: 'old', shelf: 2, top: 26.45, left: 86.79, width: 5.57, height: 15.51, orientation: 'vertical', shape: { type: 'rect', x: 1965.86, y: 747.567, width: 103.877, height: 430.313, transform: 'rotate(-2.97849 1965.86 747.567)' } },
  { name: '요나', abbr: '욘', testament: 'old', shelf: 2, top: 26.62, left: 92.67, width: 3.31, height: 15.25, orientation: 'vertical', shape: { type: 'rect', x: 2099, y: 747, width: 75, height: 428 } },

  // ── Shelf 3 ─────────────────────────────────────────────────────
  { name: '미가', abbr: '미', testament: 'old', shelf: 3, top: 50.39, left: 6, width: 4.28, height: 15.36, orientation: 'vertical', shape: { type: 'rect', x: 136, y: 1414, width: 97, height: 431 } },
  { name: '나훔', abbr: '나', testament: 'old', shelf: 3, top: 46.83, left: 10.77, width: 3.27, height: 18.92, orientation: 'vertical', shape: { type: 'rect', x: 244, y: 1314, width: 74, height: 531 } },
  { name: '하박국', abbr: '합', testament: 'old', shelf: 3, top: 50.43, left: 14.48, width: 4.19, height: 15.48, orientation: 'vertical', shape: { type: 'path', d: 'M328.032 1418.54L402.635 1415.04L422.861 1845.81L348.258 1849.32L328.032 1418.54Z' } },
  { name: '스바냐', abbr: '습', testament: 'old', shelf: 3, top: 50.39, left: 19.07, width: 4.24, height: 15.36, orientation: 'vertical', shape: { type: 'rect', x: 432, y: 1414, width: 96, height: 431 } },
  { name: '학개', abbr: '학', testament: 'old', shelf: 3, top: 50.39, left: 23.66, width: 3.18, height: 15.5, orientation: 'vertical', shape: { type: 'rect', x: 536, y: 1414, width: 72, height: 435 } },
  { name: '스가랴', abbr: '슥', testament: 'old', shelf: 3, top: 48.82, left: 27.2, width: 3.27, height: 17.07, orientation: 'vertical', shape: { type: 'rect', x: 616, y: 1370, width: 74, height: 479 } },
  { name: '말라기', abbr: '말', testament: 'old', shelf: 3, top: 50.44, left: 30.77, width: 5, height: 15.46, orientation: 'vertical', shape: { type: 'rect', x: 696.888, y: 1418.91, width: 97.2804, height: 430.406, transform: 'rotate(-2.14002 696.888 1418.91)' } },
  { name: '마태복음', abbr: '마', testament: 'new', shelf: 3, top: 50.43, left: 36.16, width: 3.27, height: 15.32, orientation: 'vertical', shape: { type: 'rect', x: 819, y: 1415, width: 74, height: 430 } },
  { name: '마가복음', abbr: '막', testament: 'new', shelf: 3, top: 54.78, left: 41.63, width: 19.34, height: 2.57, orientation: 'horizontal', shape: { type: 'rect', x: 943, y: 1537, width: 438, height: 72 } },
  { name: '누가복음', abbr: '눅', testament: 'new', shelf: 3, top: 57.52, left: 40, width: 19.34, height: 2.74, orientation: 'horizontal', shape: { type: 'rect', x: 906, y: 1614, width: 438, height: 77 } },
  { name: '요한복음', abbr: '요', testament: 'new', shelf: 3, top: 60.41, left: 41.63, width: 19.34, height: 2.6, orientation: 'horizontal', shape: { type: 'rect', x: 943, y: 1695, width: 438, height: 73 } },
  { name: '사도행전', abbr: '행', testament: 'new', shelf: 3, top: 63.19, left: 40, width: 19.34, height: 2.67, orientation: 'horizontal', shape: { type: 'rect', x: 906, y: 1773, width: 438, height: 75 } },
  { name: '로마서', abbr: '롬', testament: 'new', shelf: 3, top: 46.9, left: 61.72, width: 3.36, height: 18.96, orientation: 'vertical', shape: { type: 'rect', x: 1398, y: 1316, width: 76, height: 532 } },
  { name: '고린도전서', abbr: '고전', testament: 'new', shelf: 3, top: 60.41, left: 67.64, width: 19.34, height: 2.6, orientation: 'horizontal', shape: { type: 'rect', x: 1532, y: 1695, width: 438, height: 73 } },
  { name: '고린도후서', abbr: '고후', testament: 'new', shelf: 3, top: 63.19, left: 66.14, width: 19.21, height: 2.67, orientation: 'horizontal', shape: { type: 'rect', x: 1498, y: 1773, width: 435, height: 75 } },
  { name: '갈라디아서', abbr: '갈', testament: 'new', shelf: 3, top: 50.46, left: 88.21, width: 3.31, height: 15.25, orientation: 'vertical', shape: { type: 'rect', x: 1998, y: 1416, width: 75, height: 428 } },
  { name: '에베소서', abbr: '엡', testament: 'new', shelf: 3, top: 50.29, left: 91.71, width: 4.44, height: 15.66, orientation: 'vertical', shape: { type: 'rect', x: 2077.25, y: 1415.57, width: 75, height: 435.842, transform: 'rotate(-3.38888 2077.25 1415.57)' } },

  // ── Shelf 4 ─────────────────────────────────────────────────────
  { name: '빌립보서', abbr: '빌', testament: 'new', shelf: 4, top: 84.46, left: 6.93, width: 19.25, height: 2.57, orientation: 'horizontal', shape: { type: 'rect', x: 157, y: 2370, width: 436, height: 72 } },
  { name: '골로새서', abbr: '골', testament: 'new', shelf: 4, top: 87.24, left: 5.34, width: 19.25, height: 2.6, orientation: 'horizontal', shape: { type: 'rect', x: 121, y: 2448, width: 436, height: 73 } },
  { name: '데살로니가전서', abbr: '살전', testament: 'new', shelf: 4, top: 70.81, left: 26.49, width: 3.36, height: 19.03, orientation: 'vertical', shape: { type: 'rect', x: 600, y: 1987, width: 76, height: 534 } },
  { name: '데살로니가후서', abbr: '살후', testament: 'new', shelf: 4, top: 70.81, left: 30.11, width: 3.27, height: 19.03, orientation: 'vertical', shape: { type: 'rect', x: 682, y: 1987, width: 74, height: 534 } },
  { name: '디모데전서', abbr: '딤전', testament: 'new', shelf: 4, top: 74.52, left: 33.77, width: 4.24, height: 15.32, orientation: 'vertical', shape: { type: 'rect', x: 765, y: 2091, width: 96, height: 430 } },
  { name: '디모데후서', abbr: '딤후', testament: 'new', shelf: 4, top: 74.52, left: 38.28, width: 4.28, height: 15.32, orientation: 'vertical', shape: { type: 'rect', x: 867, y: 2091, width: 97, height: 430 } },
  { name: '디도서', abbr: '딛', testament: 'new', shelf: 4, top: 78.72, left: 45.12, width: 19.29, height: 2.67, orientation: 'horizontal', shape: { type: 'rect', x: 1022, y: 2209, width: 437, height: 75 } },
  { name: '빌레몬서', abbr: '몬', testament: 'new', shelf: 4, top: 81.61, left: 43.97, width: 19.21, height: 2.6, orientation: 'horizontal', shape: { type: 'rect', x: 996, y: 2290, width: 435, height: 73 } },
  { name: '히브리서', abbr: '히', testament: 'new', shelf: 4, top: 84.43, left: 45.47, width: 19.38, height: 2.64, orientation: 'horizontal', shape: { type: 'rect', x: 1030, y: 2369, width: 439, height: 74 } },
  { name: '야고보서', abbr: '약', testament: 'new', shelf: 4, top: 87.24, left: 43.97, width: 19.21, height: 2.6, orientation: 'horizontal', shape: { type: 'rect', x: 996, y: 2448, width: 435, height: 73 } },
  { name: '베드로전서', abbr: '벧전', testament: 'new', shelf: 4, top: 74.55, left: 65.43, width: 4.24, height: 15.29, orientation: 'vertical', shape: { type: 'rect', x: 1482, y: 2092, width: 96, height: 429 } },
  { name: '베드로후서', abbr: '벧후', testament: 'new', shelf: 4, top: 74.55, left: 70.02, width: 4.19, height: 15.29, orientation: 'vertical', shape: { type: 'rect', x: 1586, y: 2092, width: 95, height: 429 } },
  { name: '요한일서', abbr: '요일', testament: 'new', shelf: 4, top: 70.88, left: 74.66, width: 3.27, height: 18.96, orientation: 'vertical', shape: { type: 'rect', x: 1691, y: 1989, width: 74, height: 532 } },
  { name: '요한이서', abbr: '요이', testament: 'new', shelf: 4, top: 70.88, left: 78.15, width: 3.31, height: 18.96, orientation: 'vertical', shape: { type: 'rect', x: 1770, y: 1989, width: 75, height: 532 } },
  { name: '요한삼서', abbr: '요삼', testament: 'new', shelf: 4, top: 70.88, left: 81.77, width: 3.18, height: 18.96, orientation: 'vertical', shape: { type: 'rect', x: 1852, y: 1989, width: 72, height: 532 } },
  { name: '유다서', abbr: '유', testament: 'new', shelf: 4, top: 74.45, left: 85.16, width: 5.31, height: 15.54, orientation: 'vertical', shape: { type: 'rect', x: 1943.41, y: 2089, width: 105.853, height: 432.684, transform: 'rotate(1.92958 1943.41 2089)' } },
  { name: '요한계시록', abbr: '계', testament: 'new', shelf: 4, top: 74.41, left: 90.68, width: 3.31, height: 15.29, orientation: 'vertical', shape: { type: 'rect', x: 2054, y: 2088, width: 75, height: 429 } },
];

export const BIBLE_BOOKS_OT_COUNT = BIBLE_BOOK_SPOTS.filter((s) => s.testament === 'old').length;
export const BIBLE_BOOKS_NT_COUNT = BIBLE_BOOK_SPOTS.filter((s) => s.testament === 'new').length;
export const BIBLE_BOOKS_TOTAL = BIBLE_BOOK_SPOTS.length;

export const isValidBibleBookName = (name: string) =>
  BIBLE_BOOK_SPOTS.some((spot) => spot.name === name);
