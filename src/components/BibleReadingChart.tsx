import React, { useState } from 'react';

type ChartShape =
  | {
      id: string;
      type: 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
      transform?: string;
    }
  | {
      id: string;
      type: 'path';
      d: string;
    };

const CHART_VIEWBOX = '0 0 2061 2496';
const CHART_ASPECT_RATIO = '2265 / 2806';

const chartShapes: ChartShape[] = [
  { id: 'shape-0', type: 'rect', x: 3, y: 40, width: 73, height: 432 },
  { id: 'shape-1', type: 'rect', x: 218, y: 46, width: 75, height: 426 },
  { id: 'shape-2', type: 'rect', x: 307, y: 44, width: 104, height: 426 },
  { id: 'shape-3', type: 'rect', x: 81.1835, y: 45.8705, width: 74.3318, height: 426.294, transform: 'rotate(-7.37314 81.1835 45.8705)' },
  { id: 'shape-4', type: 'rect', x: 417, y: 49.8004, width: 76.3679, height: 430.075, transform: 'rotate(-7.37314 417 49.8004)' },
  { id: 'shape-5', type: 'rect', x: 562, y: 321, width: 436, height: 73 },
  { id: 'shape-6', type: 'rect', x: 562, y: 400, width: 436, height: 72 },
  { id: 'shape-7', type: 'rect', x: 1069.98, y: 44.2572, width: 75, height: 423.725, transform: 'rotate(4.05681 1069.98 44.2572)' },
  { id: 'shape-8', type: 'rect', x: 1148, y: 44, width: 108, height: 428 },
  { id: 'shape-9', type: 'rect', x: 1260.78, y: 47.2212, width: 77.469, height: 430.225, transform: 'rotate(-7.19438 1260.78 47.2212)' },
  { id: 'shape-10', type: 'rect', x: 1398, y: 0, width: 78, height: 472 },
  { id: 'shape-11', type: 'rect', x: 1481, y: 44, width: 75, height: 428 },
  { id: 'shape-12', type: 'rect', x: 1560, y: 44, width: 108, height: 430 },
  { id: 'shape-13', type: 'rect', x: 1674, y: 44, width: 104, height: 430 },
  { id: 'shape-14', type: 'rect', x: 1795.62, y: 42, width: 74.0296, height: 430.62, transform: 'rotate(1.28743 1795.62 42)' },
  { id: 'shape-15', type: 'rect', x: 1875, y: 44, width: 98, height: 428 },
  { id: 'shape-16', type: 'rect', x: 1982, y: 44, width: 75, height: 430 },
  { id: 'shape-17', type: 'rect', x: 1982, y: 718, width: 75, height: 428 },
  { id: 'shape-18', type: 'rect', x: 1764, y: 613, width: 77, height: 530 },
  { id: 'shape-19', type: 'rect', x: 1848.86, y: 718.567, width: 103.877, height: 430.313, transform: 'rotate(-2.97849 1848.86 718.567)' },
  { id: 'shape-20', type: 'rect', x: 987, y: 756, width: 438, height: 71 },
  { id: 'shape-21', type: 'rect', x: 964, y: 834, width: 439, height: 72 },
  { id: 'shape-22', type: 'rect', x: 1000, y: 912, width: 438, height: 75 },
  { id: 'shape-23', type: 'rect', x: 926, y: 992, width: 440, height: 73 },
  { id: 'shape-24', type: 'rect', x: 978, y: 1071, width: 438, height: 73 },
  { id: 'shape-25', type: 'rect', x: 0, y: 717, width: 77, height: 429 },
  { id: 'shape-26', type: 'rect', x: 98.4507, y: 715.57, width: 104.643, height: 429, transform: 'rotate(1.68891 98.4507 715.57)' },
  { id: 'shape-27', type: 'rect', x: 211, y: 714, width: 75, height: 429 },
  { id: 'shape-28', type: 'rect', x: 292.494, y: 718.529, width: 76.1213, height: 431, transform: 'rotate(-2.62417 292.494 718.529)' },
  { id: 'shape-29', type: 'rect', x: 398, y: 717, width: 73, height: 429 },
  { id: 'shape-30', type: 'rect', x: 478, y: 717, width: 77, height: 429 },
  { id: 'shape-31', type: 'rect', x: 562, y: 673, width: 75, height: 473 },
  { id: 'shape-32', type: 'rect', x: 19, y: 1385, width: 97, height: 431 },
  { id: 'shape-33', type: 'rect', x: 127, y: 1285, width: 74, height: 531 },
  { id: 'shape-34', type: 'path', d: 'M211.032 1389.54L285.635 1386.04L305.861 1816.81L231.258 1820.32L211.032 1389.54Z' },
  { id: 'shape-35', type: 'rect', x: 315, y: 1385, width: 96, height: 431 },
  { id: 'shape-36', type: 'rect', x: 419, y: 1385, width: 72, height: 435 },
  { id: 'shape-37', type: 'rect', x: 499, y: 1341, width: 74, height: 479 },
  { id: 'shape-38', type: 'rect', x: 579.888, y: 1389.91, width: 97.2804, height: 430.406, transform: 'rotate(-2.14002 579.888 1389.91)' },
  { id: 'shape-39', type: 'rect', x: 702, y: 1386, width: 74, height: 430 },
  { id: 'shape-40', type: 'rect', x: 826, y: 1508, width: 438, height: 72 },
  { id: 'shape-41', type: 'rect', x: 789, y: 1585, width: 438, height: 77 },
  { id: 'shape-42', type: 'rect', x: 826, y: 1666, width: 438, height: 73 },
  { id: 'shape-43', type: 'rect', x: 789, y: 1744, width: 438, height: 75 },
  { id: 'shape-44', type: 'rect', x: 1281, y: 1287, width: 76, height: 532 },
  { id: 'shape-45', type: 'rect', x: 1415, y: 1666, width: 438, height: 73 },
  { id: 'shape-46', type: 'rect', x: 1381, y: 1744, width: 435, height: 75 },
  { id: 'shape-47', type: 'rect', x: 1881, y: 1387, width: 75, height: 428 },
  { id: 'shape-48', type: 'rect', x: 1960.25, y: 1386.57, width: 75, height: 435.842, transform: 'rotate(-3.38888 1960.25 1386.57)' },
  { id: 'shape-49', type: 'rect', x: 1937, y: 2059, width: 75, height: 429 },
  { id: 'shape-50', type: 'rect', x: 1826.41, y: 2060, width: 105.853, height: 432.684, transform: 'rotate(1.92958 1826.41 2060)' },
  { id: 'shape-51', type: 'rect', x: 1735, y: 1960, width: 72, height: 532 },
  { id: 'shape-52', type: 'rect', x: 1653, y: 1960, width: 75, height: 532 },
  { id: 'shape-53', type: 'rect', x: 1574, y: 1960, width: 74, height: 532 },
  { id: 'shape-54', type: 'rect', x: 1469, y: 2063, width: 95, height: 429 },
  { id: 'shape-55', type: 'rect', x: 1365, y: 2063, width: 96, height: 429 },
  { id: 'shape-56', type: 'rect', x: 905, y: 2180, width: 437, height: 75 },
  { id: 'shape-57', type: 'rect', x: 879, y: 2261, width: 435, height: 73 },
  { id: 'shape-58', type: 'rect', x: 913, y: 2340, width: 439, height: 74 },
  { id: 'shape-59', type: 'rect', x: 879, y: 2419, width: 435, height: 73 },
  { id: 'shape-60', type: 'rect', x: 750, y: 2062, width: 97, height: 430 },
  { id: 'shape-61', type: 'rect', x: 648, y: 2062, width: 96, height: 430 },
  { id: 'shape-62', type: 'rect', x: 565, y: 1958, width: 74, height: 534 },
  { id: 'shape-63', type: 'rect', x: 483, y: 1958, width: 76, height: 534 },
  { id: 'shape-64', type: 'rect', x: 40, y: 2341, width: 436, height: 72 },
  { id: 'shape-65', type: 'rect', x: 4, y: 2419, width: 436, height: 73 },
];

interface BibleReadingChartProps {
  editable?: boolean;
}

export default function BibleReadingChart({ editable = false }: BibleReadingChartProps) {
  const [selectedShapeIds, setSelectedShapeIds] = useState<Set<string>>(new Set());

  const toggleShape = (shapeId: string) => {
    if (!editable) return;

    setSelectedShapeIds((current) => {
      const next = new Set(current);
      if (next.has(shapeId)) {
        next.delete(shapeId);
      } else {
        next.add(shapeId);
      }
      return next;
    });
  };

  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-xl border border-amber-100 bg-white shadow-sm">
      <div className="relative" style={{ aspectRatio: CHART_ASPECT_RATIO }}>
        <img
          src="/bible-reading-chart.png"
          alt="성경 읽기 기록표 책장"
          className="absolute inset-0 block h-full w-full select-none"
          draggable={false}
        />
        <svg
          viewBox={CHART_VIEWBOX}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-label="성경 읽기 기록표 색칠 영역"
          xmlns="http://www.w3.org/2000/svg"
        >
          {chartShapes.map((shape) => {
            const isSelected = selectedShapeIds.has(shape.id);
            const shapeProps = {
              fill: isSelected ? 'rgba(16, 185, 129, 0.38)' : 'rgba(13, 148, 136, 0.08)',
              stroke: isSelected ? '#059669' : '#14b8a6',
              strokeWidth: 5,
              vectorEffect: 'non-scaling-stroke' as const,
              className: editable
                ? 'cursor-pointer transition-colors hover:fill-emerald-300/30'
                : 'pointer-events-none transition-colors',
              onClick: () => toggleShape(shape.id),
              onKeyDown: (event: React.KeyboardEvent<SVGElement>) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  toggleShape(shape.id);
                }
              },
              role: editable ? 'button' : 'img',
              tabIndex: editable ? 0 : -1,
            };

            return shape.type === 'path' ? (
              <path key={shape.id} d={shape.d} {...shapeProps} />
            ) : (
              <rect
                key={shape.id}
                x={shape.x}
                y={shape.y}
                width={shape.width}
                height={shape.height}
                transform={shape.transform}
                rx={14}
                {...shapeProps}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
