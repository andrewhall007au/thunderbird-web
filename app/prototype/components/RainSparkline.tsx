'use client';

import type { HourlyData } from '../lib/types';
import { xScale, yScale, buildAreaPolygonPoints } from '../lib/chartUtils';

interface RainSparklineProps {
  hourlyData: HourlyData[];
  width: number;
  height?: number;
  tappedHour: number | null;
  onTap: (idx: number) => void;
  dayBoundaries?: number[];
  tickIndices?: number[];
}

export default function RainSparkline({
  hourlyData,
  width,
  height = 44,
  tappedHour,
  onTap,
  dayBoundaries,
  tickIndices,
}: RainSparklineProps) {
  if (hourlyData.length === 0 || width <= 0) return null;

  const probs = hourlyData.map(h => h.rainProbability);
  const precips = hourlyData.map(h => h.precipitation);
  const maxPrecip = Math.max(...precips, 2); // floor at 2mm
  const barW = Math.max(1, width / hourlyData.length - 1);

  const probAreaPoints = buildAreaPolygonPoints(probs, width, height, 0, 100);

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

      {/* Rain probability area */}
      <polygon points={probAreaPoints} fill="var(--chart-rain-prob)" fillOpacity={0.3} />

      {/* Precipitation bars */}
      {precips.map((p, i) => {
        if (p <= 0) return null;
        const barH = (p / maxPrecip) * height;
        const bx = xScale(i, hourlyData.length, width) - barW / 2;
        return (
          <rect
            key={i}
            x={bx}
            y={height - barH}
            width={barW}
            height={barH}
            fill="var(--chart-rain-bar)"
            fillOpacity={0.6}
            rx={0.5}
          />
        );
      })}

      {/* Value labels at tick points */}
      {tickIndices?.map(i => {
        if (i >= probs.length) return null;
        const cx = xScale(i, hourlyData.length, width);
        const cy = yScale(probs[i], 0, 100, height);
        const label = precips[i] > 0
          ? `${probs[i]}%/${precips[i].toFixed(1)}`
          : `${Math.round(probs[i])}%`;
        return (
          <text
            key={`tick-${i}`}
            x={cx}
            y={Math.min(cy - 3, height - 12)}
            textAnchor="middle"
            fontSize="13"
            fill="var(--chart-rain-prob)"
            fontWeight="bold"
          >
            {label}
          </text>
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
