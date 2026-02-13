'use client';

import type { SeverityResult } from '../lib/severity';
import { SEVERITY_COLORS } from '../lib/severity';

interface SeverityBandProps {
  severities: SeverityResult[];
  width: number;
}

export default function SeverityBand({ severities, width }: SeverityBandProps) {
  if (severities.length === 0 || width <= 0) return null;
  const segW = width / severities.length;

  return (
    <svg width={width} height={6} className="block">
      {severities.map((s, i) => (
        <rect
          key={i}
          x={i * segW}
          y={0}
          width={segW + 0.5}
          height={6}
          fill={SEVERITY_COLORS[s.level].bg}
        />
      ))}
    </svg>
  );
}
