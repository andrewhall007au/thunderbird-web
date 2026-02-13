'use client';

import { useMemo } from 'react';
import { computeTrailStats, haversineKm } from '../lib/trailStats';

interface ElevationProfileProps {
  geojson: GeoJSON.Feature;
  height?: number;
}

interface ElevationPoint {
  distance: number;
  elevation: number;
}

export default function ElevationProfile({ geojson, height = 140 }: ElevationProfileProps) {
  const { points, stats } = useMemo(() => {
    const geometry = geojson.geometry;
    if (geometry.type !== 'LineString' && geometry.type !== 'MultiLineString') {
      return { points: [], stats: null };
    }

    const rawCoords: number[][] = geometry.type === 'LineString'
      ? geometry.coordinates
      : geometry.coordinates.flat();

    const hasElevation = rawCoords.some(c => c.length >= 3 && c[2] !== 0);
    if (!hasElevation || rawCoords.length < 2) {
      return { points: [], stats: null };
    }

    const pts: ElevationPoint[] = [];
    let cumulativeDistance = 0;

    for (let i = 0; i < rawCoords.length; i++) {
      if (i > 0) {
        cumulativeDistance += haversineKm(rawCoords[i - 1], rawCoords[i]);
      }
      pts.push({
        distance: cumulativeDistance,
        elevation: rawCoords[i][2] || 0
      });
    }

    // Downsample if too many points
    const maxPoints = 300;
    let sampled = pts;
    if (pts.length > maxPoints) {
      const step = Math.floor(pts.length / maxPoints);
      sampled = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
    }

    return {
      points: sampled,
      stats: computeTrailStats(geojson),
    };
  }, [geojson]);

  if (points.length === 0 || !stats) return null;

  // SVG dimensions — match website's ElevationProfile padding
  const padding = { top: 10, right: 12, bottom: 24, left: 44 };
  const width = 800;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Scales
  const maxDist = points[points.length - 1].distance;
  const elevations = points.map(p => p.elevation);
  const minElev = Math.min(...elevations) - 20;
  const maxElev = Math.max(...elevations) + 20;
  const elevRange = maxElev - minElev || 1;

  const xScale = (d: number) => padding.left + (d / maxDist) * chartWidth;
  const yScale = (e: number) => padding.top + chartHeight - ((e - minElev) / elevRange) * chartHeight;

  // Build SVG paths
  const linePath = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(p.distance).toFixed(1)} ${yScale(p.elevation).toFixed(1)}`
  ).join(' ');

  const areaPath = `${linePath} L ${xScale(maxDist).toFixed(1)} ${yScale(minElev).toFixed(1)} L ${xScale(0).toFixed(1)} ${yScale(minElev).toFixed(1)} Z`;

  // Y-axis ticks (3-4 labels like website)
  const yTicks: number[] = [];
  const tickStep = Math.ceil(elevRange / 4 / 100) * 100 || 100;
  for (let t = Math.ceil(minElev / tickStep) * tickStep; t <= maxElev; t += tickStep) {
    yTicks.push(t);
  }

  // X-axis ticks
  const xTicks: number[] = [];
  const xStep = Math.ceil(maxDist / 5) || 1;
  for (let t = 0; t <= maxDist; t += xStep) {
    xTicks.push(t);
  }

  return (
    <div className="w-full bg-white dark:bg-zinc-800 px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Elevation Profile</span>
        <div className="flex gap-4 text-sm text-zinc-500">
          <span>{stats.distanceKm} km</span>
          <span>+{stats.totalAscent}m / -{stats.totalDescent}m</span>
          <span>{stats.minElev}m - {stats.maxElev}m</span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full bg-zinc-50 dark:bg-zinc-900/50 rounded border border-zinc-200 dark:border-zinc-700"
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {yTicks.map(t => (
          <g key={`y-${t}`}>
            <line
              x1={padding.left} x2={width - padding.right}
              y1={yScale(t)} y2={yScale(t)}
              stroke="var(--chart-grid)" strokeWidth="0.5"
            />
            <text
              x={padding.left - 4} y={yScale(t) + 3}
              textAnchor="end" fontSize="8" fill="var(--chart-axis-text)"
            >
              {t}m
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {xTicks.map(t => (
          <text
            key={`x-${t}`}
            x={xScale(t)} y={height - 4}
            textAnchor="middle" fontSize="8" fill="var(--chart-axis-text)"
          >
            {t}km
          </text>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="var(--chart-elev-area)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke="var(--chart-elev)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
