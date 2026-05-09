import React from 'react';

interface Props {
  stage: 0 | 1 | 2 | 3;
  fruitName?: string;
}

/**
 * Single-fruit tree that ripens with the check count.
 * Stage 0: small green fruit; 3: fully ripe.
 */
export default function WordFruitTree({ stage, fruitName }: Props) {
  const fruitColor = stage === 0
    ? '#86efac'
    : stage === 1
      ? '#fcd34d'
      : stage === 2
        ? '#fb923c'
        : '#dc2626';
  const fruitRadius = 10 + stage * 2;
  const glow = stage === 3;

  return (
    <div className="relative mx-auto flex w-full max-w-xs flex-col items-center">
      <svg viewBox="0 0 220 240" className="h-56 w-full" aria-hidden="true">
        {/* ground */}
        <ellipse cx="110" cy="225" rx="80" ry="8" fill="#d1fae5" />
        {/* trunk */}
        <path d="M104 225 Q108 170 110 130 Q112 95 110 70" stroke="#92400e" strokeWidth="10" strokeLinecap="round" fill="none" />
        {/* canopy */}
        <circle cx="110" cy="80" r="60" fill="#34d399" />
        <circle cx="75" cy="95" r="34" fill="#10b981" />
        <circle cx="145" cy="95" r="34" fill="#10b981" />
        {/* central fruit */}
        {glow && <circle cx="110" cy="100" r={fruitRadius + 6} fill={fruitColor} opacity="0.25" />}
        <circle cx="110" cy="100" r={fruitRadius} fill={fruitColor} stroke="#7f1d1d" strokeOpacity="0.2" />
        {/* leaf on fruit */}
        <path d="M112 92 Q120 86 124 92 Q118 94 112 95 Z" fill="#065f46" />
      </svg>
      {fruitName && (
        <div className="mt-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
          {fruitName}
        </div>
      )}
    </div>
  );
}

export function stageMessage(stage: 0 | 1 | 2 | 3): string {
  switch (stage) {
    case 0:
      return '아직 열매가 자라고 있어요.';
    case 1:
      return '열매가 조금 익어가고 있어요.';
    case 2:
      return '열매가 점점 익어가고 있어요.';
    case 3:
      return '이번 주 말씀 열매가 아름답게 익었어요.';
  }
}
