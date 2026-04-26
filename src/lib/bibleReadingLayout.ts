// Bible reading chart — book layout coordinates over the bookshelf illustration.
//
// Coordinates are percentages of the container (which renders the illustration
// with object-fit: contain at the source's native aspect ratio of ~4:5 portrait).
// Calibrated against /public/bible-reading-chart.png.
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

// Each shelf occupies a band ~19% tall. Top y-coords below correspond to the
// top of each shelf's vertical-book band.
const SHELF_TOPS = { 1: 4, 2: 28, 3: 52, 4: 76 } as const;
const VERTICAL_HEIGHT = 18;
const VERTICAL_WIDTH = 3.4;
const VERTICAL_GAP = 0.3;
const HORIZONTAL_HEIGHT = 3.6;

const v = (
  shelf: 1 | 2 | 3 | 4,
  left: number,
  name: string,
  abbr: string,
  testament: BibleTestament,
): BibleBookSpot => ({
  name,
  abbr,
  testament,
  shelf,
  top: SHELF_TOPS[shelf],
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

const verticalRow = (
  shelf: 1 | 2 | 3 | 4,
  startLeft: number,
  entries: Array<[name: string, abbr: string, testament: BibleTestament]>,
): BibleBookSpot[] =>
  entries.map(([name, abbr, testament], i) =>
    v(shelf, startLeft + i * (VERTICAL_WIDTH + VERTICAL_GAP), name, abbr, testament),
  );

const horizontalStack = (
  shelf: 1 | 2 | 3 | 4,
  topStart: number,
  left: number,
  width: number,
  entries: Array<[name: string, abbr: string, testament: BibleTestament]>,
): BibleBookSpot[] =>
  entries.map(([name, abbr, testament], i) =>
    h(shelf, topStart + i * (HORIZONTAL_HEIGHT + 0.3), left, width, name, abbr, testament),
  );

export const BIBLE_BOOK_SPOTS: BibleBookSpot[] = [
  // ── Shelf 1 (17): 5v · plants · 2h-stack · 10v ──────────────────────────
  ...verticalRow(1, 5, [
    ['창세기', '창', 'old'],
    ['출애굽기', '출', 'old'],
    ['레위기', '레', 'old'],
    ['민수기', '민', 'old'],
    ['신명기', '신', 'old'],
  ]),
  ...horizontalStack(1, SHELF_TOPS[1] + 11.2, 35, 15, [
    ['여호수아', '수', 'old'],
    ['사사기', '삿', 'old'],
  ]),
  ...verticalRow(1, 53, [
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

  // ── Shelf 2 (15): 7v · plant · 5h-stack · plant · 3v ────────────────────
  ...verticalRow(2, 5, [
    ['욥기', '욥', 'old'],
    ['시편', '시', 'old'],
    ['잠언', '잠', 'old'],
    ['전도서', '전', 'old'],
    ['아가', '아', 'old'],
    ['이사야', '사', 'old'],
    ['예레미야', '렘', 'old'],
  ]),
  ...horizontalStack(2, SHELF_TOPS[2] + 0.5, 46, 18, [
    ['예레미야애가', '애', 'old'],
    ['에스겔', '겔', 'old'],
    ['다니엘', '단', 'old'],
    ['호세아', '호', 'old'],
    ['요엘', '욜', 'old'],
  ]),
  ...verticalRow(2, 76, [
    ['아모스', '암', 'old'],
    ['오바댜', '옵', 'old'],
    ['요나', '욘', 'old'],
  ]),

  // ── Shelf 3 (17): 7v · plants · 5h-stack · 1v · plants · 2h-stack · 2v ──
  ...verticalRow(3, 5, [
    ['미가', '미', 'old'],
    ['나훔', '나', 'old'],
    ['하박국', '합', 'old'],
    ['스바냐', '습', 'old'],
    ['학개', '학', 'old'],
    ['스가랴', '슥', 'old'],
    ['말라기', '말', 'old'],
  ]),
  ...horizontalStack(3, SHELF_TOPS[3] + 0.5, 41, 17, [
    ['마태복음', '마', 'new'],
    ['마가복음', '막', 'new'],
    ['누가복음', '눅', 'new'],
    ['요한복음', '요', 'new'],
    ['사도행전', '행', 'new'],
  ]),
  ...verticalRow(3, 60, [['로마서', '롬', 'new']]),
  ...horizontalStack(3, SHELF_TOPS[3] + 8.5, 70, 14, [
    ['고린도전서', '고전', 'new'],
    ['고린도후서', '고후', 'new'],
  ]),
  ...verticalRow(3, 86, [
    ['갈라디아서', '갈', 'new'],
    ['에베소서', '엡', 'new'],
  ]),

  // ── Shelf 4 (17): plant · 2h-stack · 4v · 4h-stack · 7v ─────────────────
  ...horizontalStack(4, SHELF_TOPS[4] + 11, 14, 16, [
    ['빌립보서', '빌', 'new'],
    ['골로새서', '골', 'new'],
  ]),
  ...verticalRow(4, 32, [
    ['데살로니가전서', '살전', 'new'],
    ['데살로니가후서', '살후', 'new'],
    ['디모데전서', '딤전', 'new'],
    ['디모데후서', '딤후', 'new'],
  ]),
  ...horizontalStack(4, SHELF_TOPS[4] + 3.5, 49, 14, [
    ['디도서', '딛', 'new'],
    ['빌레몬서', '몬', 'new'],
    ['히브리서', '히', 'new'],
    ['야고보서', '약', 'new'],
  ]),
  ...verticalRow(4, 66, [
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
