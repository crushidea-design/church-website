// Parse public/bible-reading-chart.svg (a tracing of book outlines
// over the bookshelf illustration) and emit src/lib/bibleReadingLayout.ts
// with each rect's bounding box converted to viewBox-relative percentages.
//
// The blueprint contains 65 plain <rect> elements and 1 <path> element (a
// tilted quadrilateral). Each rect/path corresponds to one of the 66 books
// arranged across 4 shelves. We sort by shelf (y band) then by x position
// (with y as tiebreaker for horizontal stack books at the same x), and map
// the result onto the canonical Korean Bible book ordering.
//
// Run: node scripts/derive-bible-layout.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const blueprintPath = path.join(repoRoot, 'public/bible-reading-chart.svg');
const outPath = path.join(repoRoot, 'src/lib/bibleReadingLayout.ts');

const svg = fs.readFileSync(blueprintPath, 'utf8');

// SVG viewBox dimensions
const viewBoxMatch = svg.match(/viewBox="0\s+0\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)"/);
if (!viewBoxMatch) throw new Error('viewBox not found');
const VBW = parseFloat(viewBoxMatch[1]);
const VBH = parseFloat(viewBoxMatch[2]);

// ─── Parse ────────────────────────────────────────────────────────────────

const rotateAabb = (x, y, w, h, angle, ax, ay) => {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
  const rotated = corners.map(([px, py]) => {
    const dx = px - ax;
    const dy = py - ay;
    return [ax + dx * cos - dy * sin, ay + dx * sin + dy * cos];
  });
  const xs = rotated.map((p) => p[0]);
  const ys = rotated.map((p) => p[1]);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
};

const parseAttr = (s, name, def) => {
  const m = s.match(new RegExp(`${name}="([^"]+)"`));
  return m ? m[1] : def;
};

const rectRegex = /<rect\s([^/>]+)\/>/g;
const pathRegex = /<path\s([^/>]+)\/>/g;

const items = [];

// rects
for (const match of svg.matchAll(rectRegex)) {
  const attrs = match[1];
  const x = parseFloat(parseAttr(attrs, 'x', '0'));
  const y = parseFloat(parseAttr(attrs, 'y', '0'));
  const w = parseFloat(parseAttr(attrs, 'width', '0'));
  const h = parseFloat(parseAttr(attrs, 'height', '0'));
  const transform = parseAttr(attrs, 'transform', '');

  let aabb = { x, y, w, h };
  const rotMatch = transform.match(/rotate\(([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)/);
  if (rotMatch) {
    aabb = rotateAabb(x, y, w, h, parseFloat(rotMatch[1]), parseFloat(rotMatch[2]), parseFloat(rotMatch[3]));
  }
  items.push({
    ...aabb,
    shape: { type: 'rect', x, y, width: w, height: h, ...(transform ? { transform } : {}) },
  });
}

// paths (treat as quadrilaterals — extract Mx,y Lx,y Lx,y Lx,y Z)
for (const match of svg.matchAll(pathRegex)) {
  const attrs = match[1];
  const d = parseAttr(attrs, 'd', '');
  const nums = [...d.matchAll(/[-+]?\d*\.?\d+/g)].map((n) => parseFloat(n[0]));
  if (nums.length >= 8) {
    const xs = [nums[0], nums[2], nums[4], nums[6]];
    const ys = [nums[1], nums[3], nums[5], nums[7]];
    items.push({
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
      shape: { type: 'path', d },
    });
  }
}

if (items.length !== 66) {
  console.warn(`Warning: expected 66 items, parsed ${items.length}.`);
}

// ─── Convert to % ─────────────────────────────────────────────────────────

const toPct = (item) => ({
  top: (item.y / VBH) * 100,
  left: (item.x / VBW) * 100,
  width: (item.w / VBW) * 100,
  height: (item.h / VBH) * 100,
  centerX: ((item.x + item.w / 2) / VBW) * 100,
  centerY: ((item.y + item.h / 2) / VBH) * 100,
  shape: item.shape,
});

const pctItems = items.map(toPct);

// ─── Group by shelf ───────────────────────────────────────────────────────
//
// Each shelf's books occupy a y band of roughly 16-20% of total height. We
// detect bands by clustering centerY values: gaps of >5% mark shelf breaks.

const sortedByY = [...pctItems].sort((a, b) => a.centerY - b.centerY);
const shelves = [[]];
const SHELF_GAP_THRESHOLD = 5; // % of height
let prevY = sortedByY[0].centerY;
for (const item of sortedByY) {
  if (item.centerY - prevY > SHELF_GAP_THRESHOLD) {
    shelves.push([]);
  }
  shelves[shelves.length - 1].push(item);
  prevY = item.centerY;
}

if (shelves.length !== 4) {
  console.warn(`Warning: expected 4 shelves, found ${shelves.length}.`);
  shelves.forEach((s, i) => console.warn(`  Shelf ${i + 1}: ${s.length} items`));
}

// ─── Order within each shelf ──────────────────────────────────────────────
//
// Sort by centerX, breaking ties (within ~3% horizontal slop) by centerY top
// first — this puts horizontal-stack books in correct top-to-bottom order.

const X_SLOP = 3;
shelves.forEach((shelf) => {
  shelf.sort((a, b) => {
    if (Math.abs(a.centerX - b.centerX) <= X_SLOP) return a.centerY - b.centerY;
    return a.centerX - b.centerX;
  });
});

// ─── Map to canonical Bible book sequence ─────────────────────────────────

const SHELVES_ORDER = [
  // Shelf 1
  [
    ['창세기', '창', 'old'],
    ['출애굽기', '출', 'old'],
    ['레위기', '레', 'old'],
    ['민수기', '민', 'old'],
    ['신명기', '신', 'old'],
    ['여호수아', '수', 'old'],
    ['사사기', '삿', 'old'],
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
  ],
  // Shelf 2
  [
    ['욥기', '욥', 'old'],
    ['시편', '시', 'old'],
    ['잠언', '잠', 'old'],
    ['전도서', '전', 'old'],
    ['아가', '아', 'old'],
    ['이사야', '사', 'old'],
    ['예레미야', '렘', 'old'],
    ['예레미야애가', '애', 'old'],
    ['에스겔', '겔', 'old'],
    ['다니엘', '단', 'old'],
    ['호세아', '호', 'old'],
    ['요엘', '욜', 'old'],
    ['아모스', '암', 'old'],
    ['오바댜', '옵', 'old'],
    ['요나', '욘', 'old'],
  ],
  // Shelf 3
  [
    ['미가', '미', 'old'],
    ['나훔', '나', 'old'],
    ['하박국', '합', 'old'],
    ['스바냐', '습', 'old'],
    ['학개', '학', 'old'],
    ['스가랴', '슥', 'old'],
    ['말라기', '말', 'old'],
    ['마태복음', '마', 'new'],
    ['마가복음', '막', 'new'],
    ['누가복음', '눅', 'new'],
    ['요한복음', '요', 'new'],
    ['사도행전', '행', 'new'],
    ['로마서', '롬', 'new'],
    ['고린도전서', '고전', 'new'],
    ['고린도후서', '고후', 'new'],
    ['갈라디아서', '갈', 'new'],
    ['에베소서', '엡', 'new'],
  ],
  // Shelf 4
  [
    ['빌립보서', '빌', 'new'],
    ['골로새서', '골', 'new'],
    ['데살로니가전서', '살전', 'new'],
    ['데살로니가후서', '살후', 'new'],
    ['디모데전서', '딤전', 'new'],
    ['디모데후서', '딤후', 'new'],
    ['디도서', '딛', 'new'],
    ['빌레몬서', '몬', 'new'],
    ['히브리서', '히', 'new'],
    ['야고보서', '약', 'new'],
    ['베드로전서', '벧전', 'new'],
    ['베드로후서', '벧후', 'new'],
    ['요한일서', '요일', 'new'],
    ['요한이서', '요이', 'new'],
    ['요한삼서', '요삼', 'new'],
    ['유다서', '유', 'new'],
    ['요한계시록', '계', 'new'],
  ],
];

// Verify counts per shelf
shelves.forEach((items, i) => {
  if (items.length !== SHELVES_ORDER[i].length) {
    console.warn(`Shelf ${i + 1}: parsed ${items.length} items but canonical has ${SHELVES_ORDER[i].length}`);
  }
});

const spots = [];
shelves.forEach((shelfItems, shelfIdx) => {
  const order = SHELVES_ORDER[shelfIdx];
  shelfItems.forEach((item, i) => {
    const [name, abbr, testament] = order[i];
    const orientation = item.height > item.width * 1.4 ? 'vertical' : 'horizontal';
    spots.push({
      name,
      abbr,
      testament,
      shelf: shelfIdx + 1,
      top: +item.top.toFixed(2),
      left: +item.left.toFixed(2),
      width: +item.width.toFixed(2),
      height: +item.height.toFixed(2),
      orientation,
      shape: item.shape,
    });
  });
});

// ─── Render TS ────────────────────────────────────────────────────────────

const tsLines = [
  `// Bible reading chart — book layout coordinates over the bookshelf illustration.`,
  `//`,
  `// AUTO-GENERATED from public/bible-reading-chart.svg by`,
  `// scripts/derive-bible-layout.mjs. Re-run that script if the blueprint changes.`,
  `// Coordinates are percentages of the container.`,
  ``,
  `export type BibleTestament = 'old' | 'new';`,
  `export type BibleBookOrientation = 'vertical' | 'horizontal';`,
  ``,
  `export type BibleBookShape =`,
  `  | { type: 'rect'; x: number; y: number; width: number; height: number; transform?: string }`,
  `  | { type: 'path'; d: string };`,
  ``,
  `export const CHART_VIEWBOX = '0 0 ${VBW} ${VBH}';`,
  ``,
  `export interface BibleBookSpot {`,
  `  name: string;`,
  `  abbr: string;`,
  `  testament: BibleTestament;`,
  `  shelf: 1 | 2 | 3 | 4;`,
  `  top: number;`,
  `  left: number;`,
  `  width: number;`,
  `  height: number;`,
  `  orientation: BibleBookOrientation;`,
  `  /** Original SVG geometry; render with preserveAspectRatio="none" so shapes`,
  `   *  stretch to fit the container regardless of source vs PNG aspect ratio. */`,
  `  shape: BibleBookShape;`,
  `}`,
  ``,
  `export const BIBLE_BOOK_SPOTS: BibleBookSpot[] = [`,
];

let currentShelf = 0;
spots.forEach((s) => {
  if (s.shelf !== currentShelf) {
    if (currentShelf !== 0) tsLines.push('');
    tsLines.push(`  // ── Shelf ${s.shelf} ─────────────────────────────────────────────────────`);
    currentShelf = s.shelf;
  }
  const shape = s.shape;
  const shapeJson =
    shape.type === 'path'
      ? `{ type: 'path', d: '${shape.d}' }`
      : `{ type: 'rect', x: ${shape.x}, y: ${shape.y}, width: ${shape.width}, height: ${shape.height}${
          shape.transform ? `, transform: '${shape.transform}'` : ''
        } }`;
  tsLines.push(
    `  { name: '${s.name}', abbr: '${s.abbr}', testament: '${s.testament}', shelf: ${s.shelf}, top: ${s.top}, left: ${s.left}, width: ${s.width}, height: ${s.height}, orientation: '${s.orientation}', shape: ${shapeJson} },`,
  );
});

tsLines.push(`];`);
tsLines.push(``);
tsLines.push(`export const BIBLE_BOOKS_OT_COUNT = BIBLE_BOOK_SPOTS.filter((s) => s.testament === 'old').length;`);
tsLines.push(`export const BIBLE_BOOKS_NT_COUNT = BIBLE_BOOK_SPOTS.filter((s) => s.testament === 'new').length;`);
tsLines.push(`export const BIBLE_BOOKS_TOTAL = BIBLE_BOOK_SPOTS.length;`);
tsLines.push(``);
tsLines.push(`export const isValidBibleBookName = (name: string) =>`);
tsLines.push(`  BIBLE_BOOK_SPOTS.some((spot) => spot.name === name);`);
tsLines.push(``);

fs.writeFileSync(outPath, tsLines.join('\n'), 'utf8');
console.log(`Wrote ${outPath} with ${spots.length} books across ${shelves.length} shelves`);
