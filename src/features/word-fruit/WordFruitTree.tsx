/**
 * WordFruitTree
 * --------------
 * 일러스트 PNG 배경 + 단계별 SVG 사과 열매 오버레이.
 *
 * 신학적 톤: "나는 심었고 아볼로는 물을 주었으되,
 *           오직 하나님께서 자라게 하셨나니." (고전 3:6)
 *
 * Stages
 *  0  growing            — 작고 푸른 열매
 *  1  starting to ripen  — 옅은 노랑
 *  2  ripening           — 따뜻한 주황
 *  3  fully ripe         — 깊은 빨강
 */

import React from 'react';

export type FruitStage = 0 | 1 | 2 | 3;

type Token = {
  core: string;
  coreDeep: string;
  highlight: string;
  radius: number;
  glow: number;
  glowColor: string;
  sparkle: 0 | 1 | 2;
};

const FRUIT_TOKENS: Record<FruitStage, Token> = {
  0: { core: '#86efac', coreDeep: '#15803d', highlight: '#dcfce7', radius: 30, glow: 0,    glowColor: '#bbf7d0', sparkle: 0 },
  1: { core: '#d9f24a', coreDeep: '#65a30d', highlight: '#f7fbcc', radius: 33, glow: 0.12, glowColor: '#fde68a', sparkle: 0 },
  2: { core: '#fb923c', coreDeep: '#9a3412', highlight: '#ffedd5', radius: 36, glow: 0.22, glowColor: '#fed7aa', sparkle: 0 },
  3: { core: '#e11d48', coreDeep: '#7f1d1d', highlight: '#fecdd3', radius: 40, glow: 0.34, glowColor: '#fde68a', sparkle: 0 },
};

/** 단계별로 가지 처짐(=열매 top%)을 미세 조정 */
const STAGE_TOP: Record<FruitStage, number> = {
  0: 40,
  1: 40.5,
  2: 41,
  3: 41.5,
};

/* ===== Sparkle (4-point star) ===== */
function Sparkle({
  cx, cy, size = 6, fill = '#fff7ed', dur = '3s', begin = '0s',
}: { cx: number; cy: number; size?: number; fill?: string; dur?: string; begin?: string }) {
  const s = size, i = size * 0.32;
  const d = `M0 ${-s} L${i} ${-i} L${s} 0 L${i} ${i} L0 ${s} L${-i} ${i} L${-s} 0 L${-i} ${-i} Z`;
  return (
    <g transform={`translate(${cx},${cy})`} opacity="0.95">
      <path d={d} fill={fill}>
        <animate attributeName="opacity" values="0.3;1;0.3" dur={dur} begin={begin} repeatCount="indefinite" />
      </path>
    </g>
  );
}

/* ===== Fruit (apple SVG) ===== */
function Fruit({ stage }: { stage: FruitStage }) {
  const t = FRUIT_TOKENS[stage];
  const uid = React.useId().replace(/:/g, '');
  const FX = 100, FY = 110;
  const r = t.radius;

  const transition = { transition: 'all 0.6s ease' } as const;

  return (
    <svg viewBox="0 0 200 200" style={{ overflow: 'visible', width: '100%', height: '100%' }} aria-hidden="true">
      <defs>
        <radialGradient id={`fruit-${uid}`} cx="34%" cy="28%" r="78%">
          <stop offset="0%"   stopColor={t.highlight} />
          <stop offset="55%"  stopColor={t.core} />
          <stop offset="100%" stopColor={t.coreDeep} />
        </radialGradient>
        <filter id={`glow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      {/* Soft glow */}
      <circle
        cx={FX} cy={FY} r={r + 18}
        fill={t.glowColor} opacity={t.glow}
        filter={`url(#glow-${uid})`}
        style={transition}
      />

      {/* Drop shadow */}
      <ellipse
        cx={FX + 2} cy={FY + r - 2}
        rx={r * 0.85} ry={r * 0.32}
        fill="#000" opacity="0.22"
        style={transition}
      />

      {/* Apple body */}
      <path
        d={`M ${FX} ${FY - r * 0.92}
            C ${FX - r * 0.3} ${FY - r}, ${FX - r} ${FY - r * 0.85}, ${FX - r} ${FY - r * 0.15}
            C ${FX - r} ${FY + r * 0.85}, ${FX - r * 0.4} ${FY + r}, ${FX} ${FY + r}
            C ${FX + r * 0.4} ${FY + r}, ${FX + r} ${FY + r * 0.85}, ${FX + r} ${FY - r * 0.15}
            C ${FX + r} ${FY - r * 0.85}, ${FX + r * 0.3} ${FY - r}, ${FX} ${FY - r * 0.92} Z`}
        fill={`url(#fruit-${uid})`}
        stroke={t.coreDeep} strokeOpacity="0.25" strokeWidth="0.8"
        style={transition}
      />

      {/* Highlight */}
      <ellipse
        cx={FX - r * 0.32} cy={FY - r * 0.42}
        rx={r * 0.34} ry={r * 0.22}
        fill="#fff" opacity="0.55"
        style={transition}
      />
      <ellipse
        cx={FX - r * 0.45} cy={FY - r * 0.52}
        rx={r * 0.13} ry={r * 0.08}
        fill="#fff" opacity="0.9"
        style={transition}
      />

      {/* Stem */}
      <path
        d={`M${FX} ${FY - r * 0.95} L ${FX + 1} ${FY - r - 7}`}
        stroke="#5a2d10" strokeWidth="2.2" strokeLinecap="round" fill="none"
      />

      {/* Right leaf */}
      <path
        d={`M${FX + 1} ${FY - r - 5}
            Q ${FX + 14} ${FY - r - 13}
              ${FX + 20} ${FY - r - 2}
            Q ${FX + 8}  ${FY - r - 1}
              ${FX + 1}  ${FY - r - 5} Z`}
        fill="#4faa45"
        style={transition}
      />
      <path
        d={`M${FX + 3} ${FY - r - 4} L ${FX + 14} ${FY - r - 7}`}
        stroke="#216938" strokeWidth="0.8" strokeOpacity="0.7" fill="none"
      />

      {/* Left leaf */}
      <path
        d={`M${FX - 1} ${FY - r - 4}
            Q ${FX - 10} ${FY - r - 9}
              ${FX - 15} ${FY - r}
            Q ${FX - 6}  ${FY - r - 1}
              ${FX - 1}  ${FY - r - 4} Z`}
        fill="#3ea35c"
        style={transition}
      />

      {t.sparkle >= 1 && <Sparkle cx={FX + r + 15} cy={FY - r + 6}  size={5}   dur="3.2s" />}
      {t.sparkle >= 2 && (
        <>
          <Sparkle cx={FX - r - 15} cy={FY - r + 12} size={4.5} fill="#fff7ed" dur="2.6s" begin="0.4s" />
          <Sparkle cx={FX + r + 5}  cy={FY + r + 8}  size={4}   fill="#fff7ed" dur="3.4s" begin="1s" />
        </>
      )}
    </svg>
  );
}

/* ===== Public component ===== */
type Props = {
  stage: FruitStage;
  /** 카드의 별도 라벨에 쓰이는 이름. 시각적으로 직접 그리지는 않고, 접근성 라벨에만 반영. */
  fruitName?: string;
  className?: string;
};

export default function WordFruitTree({ stage, fruitName, className = '' }: Props) {
  return (
    <div
      className={`relative mx-auto w-full max-w-xs bg-contain bg-center bg-no-repeat ${className}`}
      style={{
        aspectRatio: '807 / 957',
        backgroundImage: "url('/assets/tree-bg.png')",
      }}
      role="img"
      aria-label={fruitName ? `${fruitName} · 단계 ${stage}` : `말씀 열매 단계 ${stage}`}
    >
      <div
        className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
        style={{
          left: '54.9%',
          top: `${STAGE_TOP[stage]}%`,
          width: '38%',
          aspectRatio: '1',
        }}
      >
        <Fruit stage={stage} />
      </div>
    </div>
  );
}

/**
 * 단계별 격려 문구. WordFruitPanel·ParentView에서 import해서 사용.
 * 디자인 데모 (Claude Design)에 맞춰 따뜻한 톤으로 갱신.
 */
export function stageMessage(stage: FruitStage): string {
  switch (stage) {
    case 0:
      return '아직 작고 푸른 열매예요. 천천히 자라고 있어요.';
    case 1:
      return '햇살이 닿아 옅은 노랑이 번지고 있어요.';
    case 2:
      return '따뜻한 주황빛이 깊어지고 있어요.';
    case 3:
      return '하나님께서 자라게 하셨어요. 함께 기뻐해요.';
  }
}
