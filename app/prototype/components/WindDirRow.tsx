'use client';

import type { HourlyData } from '../lib/types';
import { xScale, windArrow, windCompass } from '../lib/chartUtils';

interface WindDirRowProps {
  hourlyData: HourlyData[];
  width: number;
  height?: number;
  tickIndices?: number[];
}

export default function WindDirRow({
  hourlyData,
  width,
  height = 26,
  tickIndices,
}: WindDirRowProps) {
  if (hourlyData.length === 0 || width <= 0 || !tickIndices) return null;

  return (
    <svg width={width} height={height} className="block" overflow="visible">
      {tickIndices.map(i => {
        if (i >= hourlyData.length) return null;
        const cx = xScale(i, hourlyData.length, width);
        const dir = hourlyData[i].windDirection;
        const arrow = windArrow(dir);
        const compass = windCompass(dir);
        return (
          <g key={`dir-${i}`}>
            <text
              x={cx}
              y={14}
              textAnchor="middle"
              fontSize="14"
              fill="var(--chart-wind)"
            >
              {arrow}
            </text>
            <text
              x={cx}
              y={24}
              textAnchor="middle"
              fontSize="13"
              fill="var(--chart-axis-text)"
            >
              {compass}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
