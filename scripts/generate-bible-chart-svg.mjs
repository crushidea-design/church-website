// Generates /public/bible-reading-chart.svg from src/lib/bibleReadingLayout.ts.
//
// Run: node scripts/generate-bible-chart-svg.mjs
//
// The SVG is a placeholder so the feature is usable end-to-end before a
// hand-illustrated PNG is supplied. Because the SVG is generated from the
// same layout data the click overlay uses, book positions match exactly.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// Read the .ts source as text and strip TypeScript-specific syntax just enough
// to evaluate the layout array. This avoids pulling in tsc for a one-off script.
const layoutSource = fs.readFileSync(
  path.join(repoRoot, 'src/lib/bibleReadingLayout.ts'),
  'utf8',
);

// Inline-evaluate via dynamic import after writing a temporary .mjs shim.
// Simpler approach: use a regex-based extraction since the data shape is stable.
// We dynamically import the .ts via a tiny Node ESM loader trick: write a .mjs
// adapter that re-exports from the .ts? Node can't import .ts without a loader.
// To stay dependency-free, we evaluate the code inside a sandbox by stripping
// the few TS bits that would trip the parser.

const stripped = layoutSource
  // Remove `export type ...;` lines
  .replace(/export\s+type[^;]+;/g, '')
  // Remove `export interface ... { ... }` blocks
  .replace(/export\s+interface\s+\w+\s*{[^}]*}/g, '')
  // Remove `: TypeAnnotation` after parameter names and variable decls
  // (safe enough because our types here are simple)
  .replace(/:\s*BibleBookSpot\[\]/g, '')
  .replace(/:\s*BibleBookSpot/g, '')
  .replace(/:\s*Array<\[name:\s*string,\s*abbr:\s*string,\s*testament:\s*BibleTestament\]>/g, '')
  .replace(/:\s*BibleTestament/g, '')
  .replace(/:\s*BibleBookOrientation/g, '')
  .replace(/:\s*1\s*\|\s*2\s*\|\s*3\s*\|\s*4/g, '')
  .replace(/:\s*number/g, '')
  .replace(/:\s*string/g, '')
  // Drop "export " keyword on remaining declarations
  .replace(/export\s+const/g, 'const')
  // Drop "as const" assertions
  .replace(/\s+as\s+const/g, '');

// Wrap in a function that returns the layout array
const factory = new Function(`
  ${stripped}
  return { BIBLE_BOOK_SPOTS };
`);

const { BIBLE_BOOK_SPOTS: spots } = factory();

// SVG viewBox: 4:5 portrait, 1000 x 1250
const W = 1000;
const H = 1250;

const SHELF_LINES = [
  // y values matching where the wood plank sits below each shelf body
  { y: H * 0.235, label: 1 },
  { y: H * 0.475, label: 2 },
  { y: H * 0.715, label: 3 },
  { y: H * 0.955, label: 4 },
];

// Decorative plant SVG path (simple stylized)
const plantSVG = (cx, cy, scale = 1) => {
  const s = scale;
  return `
    <g transform="translate(${cx} ${cy}) scale(${s})">
      <ellipse cx="0" cy="20" rx="22" ry="6" fill="#d6c5a8" stroke="#8b6f47" stroke-width="1.5"/>
      <path d="M 0,18 Q -18,-8 -8,-30 Q 0,-22 0,18 Z" fill="#7fa872" stroke="#3d5a3a" stroke-width="1"/>
      <path d="M 0,18 Q 18,-12 10,-26 Q 0,-18 0,18 Z" fill="#9bbe8c" stroke="#3d5a3a" stroke-width="1"/>
      <path d="M 0,18 Q -4,-20 4,-30 Q 6,-15 0,18 Z" fill="#6b9560" stroke="#3d5a3a" stroke-width="1"/>
    </g>
  `;
};

const colorForBook = (testament, idx) => {
  // Soft pastel palette — testament influences hue band, modulo offset varies tone
  const olds = ['#e8d4a4', '#dfc89a', '#d4bd8c', '#c9b380', '#bea876'];
  const news = ['#e0cdb2', '#d6c2a4', '#cdb796', '#c2ac8a', '#b89f7e'];
  const palette = testament === 'old' ? olds : news;
  return palette[idx % palette.length];
};

// Build book rectangles
const bookSvg = spots
  .map((spot, idx) => {
    const x = (spot.left * W) / 100;
    const y = (spot.top * H) / 100;
    const w = (spot.width * W) / 100;
    const h = (spot.height * H) / 100;
    const fill = colorForBook(spot.testament, idx);
    const stroke = '#5b4226';
    const strokeWidth = 1.4;
    const rx = 1.5;

    // Label position depends on orientation
    let label = '';
    if (spot.orientation === 'vertical') {
      // Rotate -90° around the book center so text reads bottom-to-top on the spine
      const cx = x + w / 2;
      const cy = y + h / 2;
      label = `
        <text x="${cx}" y="${cy}" transform="rotate(-90 ${cx} ${cy})"
              text-anchor="middle" dominant-baseline="middle"
              font-family="'Noto Sans KR','Apple SD Gothic Neo',sans-serif"
              font-size="${Math.min(13, h * 0.06)}" font-weight="700" fill="#3d2a16">
          ${spot.name}
        </text>
      `;
    } else {
      label = `
        <text x="${x + w / 2}" y="${y + h / 2 + 1}"
              text-anchor="middle" dominant-baseline="middle"
              font-family="'Noto Sans KR','Apple SD Gothic Neo',sans-serif"
              font-size="${Math.min(13, h * 0.45)}" font-weight="700" fill="#3d2a16">
          ${spot.name}
        </text>
      `;
    }

    return `
      <g>
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"
              rx="${rx}" ry="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
        ${label}
      </g>
    `;
  })
  .join('\n');

// Assemble full SVG
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fdfaf2"/>
      <stop offset="1" stop-color="#f6efdf"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#paper)"/>

  <!-- Shelf wood planks -->
  ${SHELF_LINES.map(
    (s) => `
    <rect x="20" y="${s.y - 6}" width="${W - 40}" height="14"
          rx="3" ry="3" fill="#caa97a" stroke="#7a5a32" stroke-width="1.5"/>
    <rect x="20" y="${s.y + 8}" width="${W - 40}" height="6"
          fill="#a8895b" opacity="0.7"/>
  `,
  ).join('')}

  <!-- Decorative plants between shelves (placed in gaps inside each shelf) -->
  ${plantSVG(W * 0.265, H * 0.07, 1.1)}
  ${plantSVG(W * 0.41, H * 0.31, 1.0)}
  ${plantSVG(W * 0.71, H * 0.31, 0.95)}
  ${plantSVG(W * 0.345, H * 0.55, 0.95)}
  ${plantSVG(W * 0.785, H * 0.55, 0.9)}
  ${plantSVG(W * 0.385, H * 0.79, 0.95)}

  <!-- Books -->
  ${bookSvg}
</svg>
`;

const outPath = path.join(repoRoot, 'public/bible-reading-chart.svg');
fs.writeFileSync(outPath, svg, 'utf8');
console.log(`Wrote ${outPath} (${spots.length} books)`);
