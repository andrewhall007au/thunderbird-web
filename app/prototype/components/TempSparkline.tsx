'use client';

import type { HourlyData } from '../lib/types';
import type { TimeRange } from '../lib/chartUtils';
import { xScale, yScale, buildPolylinePoints, buildAreaPolygonPoints, getCalendarDayGroups } from '../lib/chartUtils';

interface TempSparklineProps {
  hourlyData: HourlyData[];
  width: number;
  height?: number;
  tappedHour: number | null;
  onTap: (idx: number) => void;
  dayBoundaries?: number[];
  tickIndices?: number[];
  timeRange?: TimeRange;
}

export default function TempSparkline({
  hourlyData,
  width,
  height = 48,
  tappedHour,
  onTap,
  dayBoundaries,
  tickIndices,
  timeRange,
}: TempSparklineProps) {
  if (hourlyData.length === 0 || width <= 0) return null;

  const temps = hourlyData.map(h => h.temperature);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const pad = (max - min) * 0.2 || 1;
  const lo = min - pad;
  const hi = max + pad;

  const areaPoints = buildAreaPolygonPoints(temps, width, height, lo, hi);
  const linePoints = buildPolylinePoints(temps, width, height, lo, hi);

  // Daily min/max for 7d mode — grouped by calendar day
  const dailyExtremes: { minIdx: number; maxIdx: number; midIdx: number }[] = [];
  if (timeRange === '7d') {
    const dayGroups = getCalendarDayGroups(hourlyData);
    for (const group of dayGroups) {
      let dayMin = Infinity, dayMax = -Infinity;
      let dayMinIdx = group.startIdx, dayMaxIdx = group.startIdx;
      for (let i = group.startIdx; i <= group.endIdx; i++) {
        if (temps[i] < dayMin) { dayMin = temps[i]; dayMinIdx = i; }
        if (temps[i] > dayMax) { dayMax = temps[i]; dayMaxIdx = i; }
      }
      const midIdx = (group.startIdx + group.endIdx) / 2;
      dailyExtremes.push({ minIdx: dayMinIdx, maxIdx: dayMaxIdx, midIdx });
    }
  }

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
        <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-temp)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--chart-temp)" stopOpacity="0.05" />
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
      <polygon points={areaPoints} fill="url(#tempGrad)" />

      {/* Line */}
      <polyline points={linePoints} fill="none" stroke="var(--chart-temp)" strokeWidth={1.5} />

      {/* 7d mode: daily min/max labels — dots at actual extremes, text centered per day */}
      {timeRange === '7d' && dailyExtremes.map((de, d) => {
        const maxCx = xScale(de.maxIdx, hourlyData.length, width);
        const maxCy = yScale(temps[de.maxIdx], lo, hi, height);
        const minCx = xScale(de.minIdx, hourlyData.length, width);
        const minCy = yScale(temps[de.minIdx], lo, hi, height);
        // Center text labels at the day midpoint to prevent cross-day overlap
        const labelX = xScale(de.midIdx, hourlyData.length, width);
        return (
          <g key={`day-${d}`}>
            {/* Max dot at actual position */}
            <circle cx={maxCx} cy={maxCy} r={2} fill="var(--chart-temp-max)" />
            {/* Max label centered on day */}
            <text x={labelX} y={4} textAnchor="middle" fontSize="13" fill="var(--chart-temp-max-label)" fontWeight="bold">
              {Math.round(temps[de.maxIdx])}°
            </text>
            {/* Min dot at actual position */}
            <circle cx={minCx} cy={minCy} r={2} fill="var(--chart-temp-min)" />
            {/* Min label centered on day */}
            <text x={labelX} y={height - 1} textAnchor="middle" fontSize="13" fill="var(--chart-temp-label)" fontWeight="bold">
              {Math.round(temps[de.minIdx])}°
            </text>
          </g>
        );
      })}

      {/* Value labels at tick points (12h/24h only — 7d uses daily min/max instead) */}
      {timeRange !== '7d' && tickIndices?.map(i => {
        if (i >= temps.length) return null;
        const cx = xScale(i, hourlyData.length, width);
        const cy = yScale(temps[i], lo, hi, height);
        return (
          <g key={`tick-${i}`}>
            <circle cx={cx} cy={cy} r={2} fill="var(--chart-temp)" />
            <text
              x={cx}
              y={cy - 5}
              textAnchor="middle"
              fontSize="13"
              fill="var(--chart-temp-label)"
              fontWeight="bold"
            >
              {Math.round(temps[i])}°
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
            cy={yScale(temps[tappedHour], lo, hi, height)}
            r={3}
            fill="var(--chart-tapped)"
          />
        </>
      )}
    </svg>
  );
}
