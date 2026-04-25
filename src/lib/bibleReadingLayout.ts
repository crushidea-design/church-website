// Bible reading chart — book layout coordinates over the bookshelf illustration.
//
// Coordinates are percentages of the container (which renders the illustration
// with object-fit: contain at the source's native aspect ratio of 4:5 portrait).
// The accompanying SVG placeholder at /public/bible-reading-chart.svg draws
// books at exactly these same positions, so swapping in a hand-illustrated PNG
// later is just a path change — the click overlay will already line up.
//
// orientation: 'vertical' = book stands on the shelf (label runs along the
//              spine). 'horizontal' = book lies flat in a stack (label reads
//              left-to-right).

export type BibleTestament = 'old' | 'new';
export type BibleBookOrientation = 'vertical' | 'horizontal';

export interface BibleBookSpot {
  /** Canonical Korean name. Stored verbatim in completedBooks[]. */
  name: string;
  /** Short label for compact UI / debug overlay. */
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

// Each shelf occupies a 4%-margin top with a body 18% tall, and the shelf
// "wood" line sits at top + 19%. This leaves consistent banding for all 4 shelves.
const VERTICAL_HEIGHT = 18;
const VERTICAL_WIDTH = 4.4;
const VERTICAL_GAP = 0.6;
const HORIZONTAL_HEIGHT = 3.4;

// Helper for vertical books — caller supplies left% explicitly.
const v = (
  shelf: 1 | 2 | 3 | 4,
  shelfTop: number,
  left: number,
  name: string,
  abbr: string,
  testament: BibleTestament,
): BibleBookSpot => ({
  name,
  abbr,
  testament,
  shelf,
  top: shelfTop,
  left,
  width: VERTICAL_WIDTH,
  height: VERTICAL_HEIGHT,
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

// Lay out N vertical books starting at startLeft with the standard width+gap.
const verticalRow = (
  shelf: 1 | 2 | 3 | 4,
  shelfTop: number,
  startLeft: number,
  entries: Array<[name: string, abbr: string, testament: BibleTestament]>,
): BibleBookSpot[] =>
  entries.map(([name, abbr, testament], i) =>
    v(shelf, shelfTop, startLeft + i * (VERTICAL_WIDTH + VERTICAL_GAP), name, abbr, testament),
  );

// Lay out a vertical horizontal-book stack at (left, top) with given count.
const horizontalStack = (
  shelf: 1 | 2 | 3 | 4,
  topStart: number,
  left: number,
  width: number,
  entries: Array<[name: string, abbr: string, testament: BibleTestament]>,
): BibleBookSpot[] =>
  entries.map(([name, abbr, testament], i) =>
    h(shelf, topStart + i * (HORIZONTAL_HEIGHT + 0.5), left, width, name, abbr, testament),
  );

// Shelves
const SHELF1_TOP = 3;
const SHELF2_TOP = 27;
const SHELF3_TOP = 51;
const SHELF4_TOP = 75;

export const BIBLE_BOOK_SPOTS: BibleBookSpot[] = [
  // Shelf 1 — Pentateuch + early historical (17 books)
  // 5 vertical · 2-stack · 10 vertical
  ...verticalRow(1, SHELF1_TOP, 4, [
    ['창세기', '창', 'old'],
    ['출애굽기', '출', 'old'],
    ['레위기', '레', 'old'],
    ['민수기', '민', 'old'],
    ['신명기', '신', 'old'],
  ]),
  ...horizontalStack(1, SHELF1_TOP + 8, 31, 12, [
    ['여호수아', '수', 'old'],
    ['사사기', '삿', 'old'],
  ]),
  ...verticalRow(1, SHELF1_TOP, 47, [
    ['룻기', '룻', 'old'],
    ['사무엘상', '삼상', 'old'],
    ['사무엘하', '삼하', 'old'],
    ['열왕기상', '왕상', 'old'],
    ['열왕기하', '왕하', 'old'],
    ['역대상', '대상', 'old'],
    ['역대하', '대하', 'old'],
    ['에스라', '스', 'old'],
    ['느헤미야', '느', 'old'],
    ['에스더', '에', 'old'],
  ]),

  // Shelf 2 — Wisdom + major prophets (15 books)
  // 7 vertical · 5-stack · 3 vertical
  ...verticalRow(2, SHELF2_TOP, 4, [
    ['욥기', '욥', 'old'],
    ['시편', '시', 'old'],
    ['잠언', '잠', 'old'],
    ['전도서', '전', 'old'],
    ['아가', '아', 'old'],
    ['이사야', '사', 'old'],
    ['예레미야', '렘', 'old'],
  ]),
  ...horizontalStack(2, SHELF2_TOP + 0.5, 44, 13, [
    ['예레미야애가', '애', 'old'],
    ['에스겔', '겔', 'old'],
    ['다니엘', '단', 'old'],
    ['호세아', '호', 'old'],
    ['요엘', '욜', 'old'],
  ]),
  ...verticalRow(2, SHELF2_TOP, 75, [
    ['아모스', '암', 'old'],
    ['오바댜', '옵', 'old'],
    ['요나', '욘', 'old'],
  ]),

  // Shelf 3 — Minor prophets + Gospels + Acts + early epistles (17 books)
  // 7 vertical · 5-stack · 1 vertical · 2-stack · 2 vertical
  ...verticalRow(3, SHELF3_TOP, 4, [
    ['미가', '미', 'old'],
    ['나훔', '나', 'old'],
    ['하박국', '합', 'old'],
    ['스바냐', '습', 'old'],
    ['학개', '학', 'old'],
    ['스가랴', '슥', 'old'],
    ['말라기', '말', 'old'],
  ]),
  ...horizontalStack(3, SHELF3_TOP + 0.5, 38, 13, [
    ['마태복음', '마', 'new'],
    ['마가복음', '막', 'new'],
    ['누가복음', '눅', 'new'],
    ['요한복음', '요', 'new'],
    ['사도행전', '행', 'new'],
  ]),
  ...verticalRow(3, SHELF3_TOP, 56, [
    ['로마서', '롬', 'new'],
  ]),
  ...horizontalStack(3, SHELF3_TOP + 6, 65, 12, [
    ['고린도전서', '고전', 'new'],
    ['고린도후서', '고후', 'new'],
  ]),
  ...verticalRow(3, SHELF3_TOP, 82, [
    ['갈라디아서', '갈', 'new'],
    ['에베소서', '엡', 'new'],
  ]),

  // Shelf 4 — Remaining epistles + Revelation (17 books)
  // 2-stack · 4 vertical · 4-stack · 7 vertical
  ...horizontalStack(4, SHELF4_TOP + 5, 4, 12, [
    ['빌립보서', '빌', 'new'],
    ['골로새서', '골', 'new'],
  ]),
  ...verticalRow(4, SHELF4_TOP, 19, [
    ['데살로니가전서', '살전', 'new'],
    ['데살로니가후서', '살후', 'new'],
    ['디모데전서', '딤전', 'new'],
    ['디모데후서', '딤후', 'new'],
  ]),
  ...horizontalStack(4, SHELF4_TOP + 0.5, 41, 13, [
    ['디도서', '딛', 'new'],
    ['빌레몬서', '몬', 'new'],
    ['히브리서', '히', 'new'],
    ['야고보서', '약', 'new'],
  ]),
  ...verticalRow(4, SHELF4_TOP, 56, [
    ['베드로전서', '벧전', 'new'],
    ['베드로후서', '벧후', 'new'],
    ['요한일서', '요일', 'new'],
    ['요한이서', '요이', 'new'],
    ['요한삼서', '요삼', 'new'],
    ['유다서', '유', 'new'],
    ['요한계시록', '계', 'new'],
  ]),
];

export const BIBLE_BOOKS_OT_COUNT = BIBLE_BOOK_SPOTS.filter((s) => s.testament === 'old').length;
export const BIBLE_BOOKS_NT_COUNT = BIBLE_BOOK_SPOTS.filter((s) => s.testament === 'new').length;
export const BIBLE_BOOKS_TOTAL = BIBLE_BOOK_SPOTS.length;

export const isValidBibleBookName = (name: string) =>
  BIBLE_BOOK_SPOTS.some((spot) => spot.name === name);
