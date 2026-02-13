'use client';

import type { HourlyData } from '../lib/types';
import { xScale, yScale, buildPolylinePoints, buildAreaPolygonPoints } from '../lib/chartUtils';

interface FreezeSparklineProps {
  hourlyData: HourlyData[];
  width: number;
  height?: number;
  tappedHour: number | null;
  onTap: (idx: number) => void;
  dayBoundaries?: number[];
  tickIndices?: number[];
  pinElevation?: number;
}

export default function FreezeSparkline({
  hourlyData,
  width,
  height = 56,
  tappedHour,
  onTap,
  dayBoundaries,
  tickIndices,
  pinElevation,
}: FreezeSparklineProps) {
  if (hourlyData.length === 0 || width <= 0) return null;

  const levels = hourlyData.map(h => h.freezingLevel);
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  const pad = (max - min) * 0.15 || 200;
  const lo = Math.max(0, min - pad);
  const hi = max + pad;

  const areaPoints = buildAreaPolygonPoints(levels, width, height, lo, hi);
  const linePoints = buildPolylinePoints(levels, width, height, lo, hi);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const idx = Math.round(ratio * (hourlyData.length - 1));
    onTap(idx);
  };

  // Pin elevation line (if within range)
  const elevInRange = pinElevation != null && pinElevation >= lo && pinElevation <= hi;

  return (
    <svg
      width={width}
      height={height}
      className="block cursor-pointer"
      overflow="visible"
      onClick={handleClick}
    >
      <defs>
        <linearGradient id="freezeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-freeze)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--chart-freeze)" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Day boundary lines */}
      {dayBoundaries?.map(b => {
        const bx = xScale(b, hourlyData.length, width);
        return (
          <line key={b} x1={bx} y1={0} x2={bx} y2={height} stroke="var(--chart-grid)" strokeWidth={1} strokeOpacity={0.5} />
        );
      })}

      {/* Pin elevation reference line */}
      {elevInRange && (
        <>
          <line
            x1={0} x2={width}
            y1={yScale(pinElevation!, lo, hi, height)}
            y2={yScale(pinElevation!, lo, hi, height)}
            stroke="var(--chart-pin-elev)"
            strokeWidth={1}
            strokeDasharray="3,3"
            strokeOpacity={0.6}
          />
          <text
            x={width - 2}
            y={yScale(pinElevation!, lo, hi, height) - 2}
            textAnchor="end"
            fontSize="13"
            fill="var(--chart-pin-elev)"
            fillOpacity={0.8}
          >
            pin {pinElevation}m
          </text>
        </>
      )}

      {/* Area fill */}
      <polygon points={areaPoints} fill="url(#freezeGrad)" />

      {/* Line */}
      <polyline points={linePoints} fill="none" stroke="var(--chart-freeze)" strokeWidth={1.5} />

      {/* Value labels at tick points */}
      {tickIndices?.map(i => {
        if (i >= levels.length) return null;
        const cx = xScale(i, hourlyData.length, width);
        const cy = yScale(levels[i], lo, hi, height);
        return (
          <g key={`tick-${i}`}>
            <circle cx={cx} cy={cy} r={2} fill="var(--chart-freeze)" />
            <text
              x={cx}
              y={Math.min(cy + 14, height - 1)}
              textAnchor="middle"
              fontSize="13"
              fill="var(--chart-freeze-label)"
              fontWeight="bold"
            >
              {Math.round(levels[i])}m
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
            cy={yScale(levels[tappedHour], lo, hi, height)}
            r={3}
            fill="var(--chart-tapped)"
          />
        </>
      )}
    </svg>
  );
}
