'use client';

import type { SeverityResult } from '../lib/severity';
import { SEVERITY_COLORS } from '../lib/severity';
import { xScale } from '../lib/chartUtils';

interface DangerRowProps {
  severities: SeverityResult[];
  width: number;
  height?: number;
  tickIndices?: number[];
}

export default function DangerRow({
  severities,
  width,
  height = 22,
  tickIndices,
}: DangerRowProps) {
  if (severities.length === 0 || width <= 0 || !tickIndices) return null;

  return (
    <svg width={width} height={height} className="block" overflow="visible">
      {tickIndices.map(i => {
        if (i >= severities.length) return null;
        const cx = xScale(i, severities.length, width);
        const sev = severities[i];
        const label = sev.danger || (sev.thunder ? sev.thunder : '');
        if (!label) {
          return (
            <text
              key={`d-${i}`}
              x={cx}
              y={16}
              textAnchor="middle"
              fontSize="13"
              fill={SEVERITY_COLORS.green.bg}
            >
              ok
            </text>
          );
        }
        return (
          <text
            key={`d-${i}`}
            x={cx}
            y={16}
            textAnchor="middle"
            fontSize="13"
            fill={SEVERITY_COLORS[sev.level].bg}
            fontWeight="bold"
          >
            {label}{sev.thunder && sev.danger ? ` ${sev.thunder}` : ''}
          </text>
        );
      })}
    </svg>
  );
}
