'use client';

import type { HourlyData } from '../lib/types';
import { xScale, yScale, buildPolylinePoints, buildAreaPolygonPoints } from '../lib/chartUtils';

interface CloudSparklineProps {
  hourlyData: HourlyData[];
  width: number;
  height?: number;
  tappedHour: number | null;
  onTap: (idx: number) => void;
  dayBoundaries?: number[];
  tickIndices?: number[];
}

export default function CloudSparkline({
  hourlyData,
  width,
  height = 48,
  tappedHour,
  onTap,
  dayBoundaries,
  tickIndices,
}: CloudSparklineProps) {
  if (hourlyData.length === 0 || width <= 0) return null;

  const covers = hourlyData.map(h => h.cloudCover);
  const areaPoints = buildAreaPolygonPoints(covers, width, height, 0, 100);
  const linePoints = buildPolylinePoints(covers, width, height, 0, 100);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const idx = Math.round(ratio * (hourlyData.length - 1));
    onTap(idx);
  };

  return (
    <svg
      width={width}
      height={height}
      className="block cursor-pointer"
      overflow="visible"
      onClick={handleClick}
    >
      {/* Day boundary lines */}
      {dayBoundaries?.map(b => {
        const bx = xScale(b, hourlyData.length, width);
        return (
          <line key={b} x1={bx} y1={0} x2={bx} y2={height} stroke="var(--chart-grid)" strokeWidth={1} strokeOpacity={0.5} />
        );
      })}

      {/* Cloud cover area + line */}
      <polygon points={areaPoints} fill="var(--chart-cloud)" fillOpacity={0.15} />
      <polyline points={linePoints} fill="none" stroke="var(--chart-cloud)" strokeWidth={1.5} />

      {/* Value labels at tick points */}
      {tickIndices?.map(i => {
        if (i >= covers.length) return null;
        const cx = xScale(i, hourlyData.length, width);
        const cy = yScale(covers[i], 0, 100, height);
        return (
          <g key={`tick-${i}`}>
            <circle cx={cx} cy={cy} r={2} fill="var(--chart-cloud)" />
            <text
              x={cx}
              y={cy - 5}
              textAnchor="middle"
              fontSize="13"
              fill="var(--chart-cloud)"
              fontWeight="bold"
            >
              {Math.round(covers[i])}%
            </text>
          </g>
        );
      })}

      {/* Tapped hour indicator */}
      {tappedHour !== null && tappedHour < hourlyData.length && (
        <line
          x1={xScale(tappedHour, hourlyData.length, width)}
          y1={0}
          x2={xScale(tappedHour, hourlyData.length, width)}
          y2={height}
          stroke="var(--chart-tapped)"
          strokeWidth={1.5}
          strokeDasharray="4,2"
        />
      )}
    </svg>
  );
}
