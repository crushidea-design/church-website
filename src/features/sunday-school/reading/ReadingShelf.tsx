// The 2026 bookshelf picture with each book filling up in proportion to the chapters read.
// Reuses the layout and the image of the old chart (src/lib/bibleReadingLayout.ts).
import React, { useMemo } from 'react';
import { BIBLE_BOOK_SPOTS, CHART_VIEWBOX } from '../../../lib/bibleReadingLayout';
import type { BibleBookSpot } from '../../../lib/bibleReadingLayout';
import { bookFills } from './reading';

const [, , VIEW_W, VIEW_H] = CHART_VIEWBOX.split(' ').map(Number);

function ShapeEl({ spot }: { spot: BibleBookSpot }) {
  const shape = spot.shape;
  return shape.type === 'path' ? (
    <path d={shape.d} />
  ) : (
    <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} transform={shape.transform} rx={14} />
  );
}

const clipId = (index: number) => `reading-book-clip-${index}`;

export default function ReadingShelf({ chaptersRead, currentBook }: { chaptersRead: number; currentBook: string | null }) {
  const fills = useMemo(() => new Map(bookFills(chaptersRead).map((book) => [book.name, book.fraction])), [chaptersRead]);

  return (
    <div
      className="relative mx-auto w-full max-w-md overflow-hidden rounded-xl border border-amber-100 bg-amber-50"
      style={{ aspectRatio: '2265 / 2806' }}
    >
      <img
        src="/bible-reading-chart.png"
        alt="성경 읽기 책장"
        className="absolute inset-0 block h-full w-full select-none"
        draggable={false}
        onError={(e) => {
          const img = e.currentTarget as HTMLImageElement;
          if (!img.dataset.fallback) {
            img.dataset.fallback = '1';
            img.src = '/bible-reading-chart.svg';
          }
        }}
      />
      <svg
        viewBox={CHART_VIEWBOX}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label={`성경 66권 책장, ${chaptersRead}장을 읽었어요`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {BIBLE_BOOK_SPOTS.map((spot, index) => (
            <clipPath key={spot.name} id={clipId(index)}>
              <ShapeEl spot={spot} />
            </clipPath>
          ))}
        </defs>
        {BIBLE_BOOK_SPOTS.map((spot, index) => {
          const fraction = fills.get(spot.name) ?? 0;
          const x = (spot.left / 100) * VIEW_W;
          const y = (spot.top / 100) * VIEW_H;
          const w = (spot.width / 100) * VIEW_W;
          const h = (spot.height / 100) * VIEW_H;
          const fillColor = spot.testament === 'old' ? 'rgba(251, 191, 36, 0.6)' : 'rgba(251, 113, 133, 0.6)';
          const isCurrent = currentBook === spot.name;
          const vertical = spot.orientation === 'vertical';
          return (
            <g key={spot.name}>
              <title>{`${spot.name}${fraction >= 1 ? ' (다 읽었어요)' : ''}`}</title>
              {fraction > 0 && (
                <g clipPath={`url(#${clipId(index)})`}>
                  {vertical ? (
                    <rect x={x} y={y + h * (1 - fraction)} width={w} height={h * fraction} fill={fillColor} />
                  ) : (
                    <rect x={x} y={y} width={w * fraction} height={h} fill={fillColor} />
                  )}
                </g>
              )}
              {isCurrent && (
                <g>
                  <g fill="none" stroke="rgba(5, 150, 105, 0.95)" strokeWidth={7} vectorEffect="non-scaling-stroke">
                    <ShapeEl spot={spot} />
                  </g>
                  {/* bookmark ribbon on the book being read */}
                  <path
                    d={`M ${vertical ? x + w * 0.5 - 16 : x + w - 70} ${vertical ? y - 26 : y - 12} h 32 v 62 l -16 -16 l -16 16 z`}
                    fill="rgb(5, 150, 105)"
                    stroke="white"
                    strokeWidth={4}
                  />
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
