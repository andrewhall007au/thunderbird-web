'use client';

import type { HourlyData } from '../lib/types';
import { xScale, yScale, buildPolylinePoints } from '../lib/chartUtils';

interface WindSparklineProps {
  hourlyData: HourlyData[];
  width: number;
  height?: number;
  tappedHour: number | null;
  onTap: (idx: number) => void;
  dayBoundaries?: number[];
  tickIndices?: number[];
}

export default function WindSparkline({
  hourlyData,
  width,
  height = 44,
  tappedHour,
  onTap,
  dayBoundaries,
  tickIndices,
}: WindSparklineProps) {
  if (hourlyData.length === 0 || width <= 0) return null;

  const speeds = hourlyData.map(h => h.windSpeed);
  const gusts = hourlyData.map(h => h.windGusts);
  const allVals = [...speeds, ...gusts];
  const lo = 0;
  const hi = Math.max(...allVals) * 1.15 || 10;

  // Band between sustained and gusts
  const topEdge = gusts
    .map((g, i) => `${xScale(i, hourlyData.length, width)},${yScale(g, lo, hi, height)}`)
    .join(' ');
  const bottomEdge = speeds
    .map((s, i) => `${xScale(i, hourlyData.length, width)},${yScale(s, lo, hi, height)}`)
    .reverse()
    .join(' ');
  const bandPoints = `${topEdge} ${bottomEdge}`;

  const speedLine = buildPolylinePoints(speeds, width, height, lo, hi);
  const gustLine = buildPolylinePoints(gusts, width, height, lo, hi);

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

      {/* Wind band fill */}
      <polygon points={bandPoints} fill="var(--chart-wind-fill)" fillOpacity={0.3} />

      {/* Sustained wind line */}
      <polyline points={speedLine} fill="none" stroke="var(--chart-wind)" strokeWidth={1.5} />

      {/* Gust line (dashed) */}
      <polyline points={gustLine} fill="none" stroke="var(--chart-wind)" strokeWidth={1} strokeDasharray="4,2" />

      {/* Value labels at tick points */}
      {tickIndices?.map(i => {
        if (i >= speeds.length) return null;
        const cx = xScale(i, hourlyData.length, width);
        const cy = yScale(speeds[i], lo, hi, height);
        const gustVal = Math.round(gusts[i]);
        const speedVal = Math.round(speeds[i]);
        const label = gustVal > speedVal + 5 ? `${speedVal}-${gustVal}` : `${speedVal}`;
        return (
          <text
            key={`tick-${i}`}
            x={cx}
            y={Math.min(cy - 4, height - 10)}
            textAnchor="middle"
            fontSize="13"
            fill="var(--chart-wind-label)"
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
