import React from 'react';

interface LogoProps {
  className?: string;
  size?: number | string;
}

export default function Logo({ className, size = '100%' }: LogoProps) {
  return (
    <svg 
      viewBox="0 0 200 200" 
      className={className} 
      width={size} 
      height={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 2. 성자 하나님: 말씀의 토대 (성경) - 두께 강화 */}
      <g id="Foundation-Word">
        <rect x="45" y="160" width="110" height="16" rx="2" fill="#54280a" />
        <rect x="50" y="156" width="100" height="10" rx="1" fill="#FFFEF9" opacity="0.95" />
      </g>

      {/* 3. 성도의 연합: 2-3-2 구조의 7개 벽돌 (완전수, 틈 없이 밀착) */}
      <g id="Seven-Seamless-Bricks-232">
        {/* 벽돌 규격: width 30, height 22 */}
        {/* 1단 (하단): 2개 */}
        <rect x="70" y="136" width="30" height="22" fill="#B45309" />
        <rect x="100" y="136" width="30" height="22" fill="#92400E" />
        
        {/* 2단 (중단): 3개 */}
        <rect x="55" y="114" width="30" height="22" fill="#D97706" />
        <rect x="85" y="114" width="30" height="22" fill="#F59E0B" />
        <rect x="115" y="114" width="30" height="22" fill="#D97706" />

        {/* 3단 (상단): 2개 */}
        <rect x="70" y="92" width="30" height="22" fill="#B45309" />
        <rect x="100" y="92" width="30" height="22" fill="#F59E0B" />
      </g>
      
      {/* 4. 그리스도의 중심성: 벽돌 정중앙에 위치한 십자가 */}
      <g id="Centered-Cross">
        <rect x="96.5" y="101" width="7" height="46" rx="0.5" fill="white" />
        <rect x="84" y="116" width="32" height="7" rx="0.5" fill="white" />
      </g>

      {/* 5. 성령 하나님: 생명의 불꽃 (벽돌 위에서 즉각적으로 타오름) */}
      <g id="Holy-Spirit-Flame">
        <path 
          d="M100 92 C115 65 100 35 100 35 C100 35 85 65 100 92 Z" 
          fill="#F59E0B"
        >
          <animate 
            attributeName="d" 
            values="M100 92 C115 65 100 35 100 35 C100 35 85 65 100 92 Z; 
                    M100 92 C120 60 100 30 100 30 C100 30 80 60 100 92 Z; 
                    M100 92 C115 65 100 35 100 35 C100 35 85 65 100 92 Z" 
            dur="2.8s" 
            repeatCount="indefinite" 
          />
        </path>
        <path 
          d="M100 85 C108 68 100 50 100 50 C100 50 92 68 100 85 Z" 
          fill="#FFFFFF" 
          opacity="0.95"
        >
          <animate 
            attributeName="d" 
            values="M100 85 C108 68 100 50 100 50 C100 50 92 68 100 85 Z; 
                    M100 85 C110 63 100 45 100 45 C100 45 90 63 100 85 Z; 
                    M100 85 C108 68 100 50 100 50 C100 50 92 68 100 85 Z" 
            dur="2.8s" 
            repeatCount="indefinite" 
          />
        </path>
      </g>
    </svg>
  );
}
