'use client';

import type { HourlyData } from '../lib/types';
import { xScale, yScale, buildPolylinePoints, buildAreaPolygonPoints } from '../lib/chartUtils';

interface CloudBaseSparklineProps {
  hourlyData: HourlyData[];
  width: number;
  height?: number;
  tappedHour: number | null;
  onTap: (idx: number) => void;
  dayBoundaries?: number[];
  tickIndices?: number[];
}

export default function CloudBaseSparkline({
  hourlyData,
  width,
  height = 56,
  tappedHour,
  onTap,
  dayBoundaries,
  tickIndices,
}: CloudBaseSparklineProps) {
  if (hourlyData.length === 0 || width <= 0) return null;

  const bases = hourlyData.map(h => h.cloudBase);
  const min = Math.min(...bases);
  const max = Math.max(...bases);
  const pad = (max - min) * 0.15 || 200;
  const lo = Math.max(0, min - pad);
  const hi = max + pad;

  const areaPoints = buildAreaPolygonPoints(bases, width, height, lo, hi);
  const linePoints = buildPolylinePoints(bases, width, height, lo, hi);

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
      <defs>
        <linearGradient id="cloudBaseGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-cloud)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--chart-cloud)" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Day boundary lines */}
      {dayBoundaries?.map(b => {
        const bx = xScale(b, hourlyData.length, width);
        return (
          <line key={b} x1={bx} y1={0} x2={bx} y2={height} stroke="var(--chart-grid)" strokeWidth={1} strokeOpacity={0.5} />
        );
      })}

      {/* Area fill */}
      <polygon points={areaPoints} fill="url(#cloudBaseGrad)" />

      {/* Line */}
      <polyline points={linePoints} fill="none" stroke="var(--chart-cloud)" strokeWidth={1.5} />

      {/* Value labels at tick points */}
      {tickIndices?.map(i => {
        if (i >= bases.length) return null;
        const cx = xScale(i, hourlyData.length, width);
        const cy = yScale(bases[i], lo, hi, height);
        return (
          <g key={`tick-${i}`}>
            <circle cx={cx} cy={cy} r={2} fill="var(--chart-cloud)" />
            <text
              x={cx}
              y={Math.min(cy + 14, height - 1)}
              textAnchor="middle"
              fontSize="13"
              fill="var(--chart-cloud)"
              fontWeight="bold"
            >
              {Math.round(bases[i])}m
            </text>
          </g>
        );
      })}

      {/* Tapped hour indicator */}
      {tappedHour !== null && tappedHour < hourlyData.length && (
        <>
          <line
            x1={xScale(tappedHour, hourlyData.length, width)}
            y1={0}
            x2={xScale(tappedHour, hourlyData.length, width)}
            y2={height}
            stroke="var(--chart-tapped)"
            strokeWidth={1.5}
            strokeDasharray="4,2"
          />
          <circle
            cx={xScale(tappedHour, hourlyData.length, width)}
            cy={yScale(bases[tappedHour], lo, hi, height)}
            r={3}
            fill="var(--chart-tapped)"
          />
        </>
      )}
    </svg>
  );
}
