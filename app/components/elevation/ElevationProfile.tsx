'use client';

import { useMemo } from 'react';

interface ElevationProfileProps {
  trackGeojson: GeoJSON.Feature;
  waypoints?: { name: string; lat: number; lng: number }[];
  height?: number;
}

interface ElevationPoint {
  distance: number; // km from start
  elevation: number; // meters
}

// Haversine distance between two points in km
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Find closest point on track to a waypoint
function findClosestDistance(
  waypoint: { lat: number; lng: number },
  points: ElevationPoint[],
  coords: number[][]
): number | null {
  let minDist = Infinity;
  let closestIdx = -1;

  for (let i = 0; i < coords.length; i++) {
    const d = haversine(waypoint.lat, waypoint.lng, coords[i][1], coords[i][0]);
    if (d < minDist) {
      minDist = d;
      closestIdx = i;
    }
  }

  // Only show if within 2km of the track
  if (minDist > 2 || closestIdx < 0) return null;
  return points[closestIdx]?.distance ?? null;
}

export default function ElevationProfile({
  trackGeojson,
  waypoints = [],
  height = 140
}: ElevationProfileProps) {
  const { points, coords, stats } = useMemo(() => {
    const geometry = trackGeojson.geometry;
    if (geometry.type !== 'LineString' && geometry.type !== 'MultiLineString') {
      return { points: [], coords: [], stats: null };
    }

    const rawCoords: number[][] = geometry.type === 'LineString'
      ? geometry.coordinates
      : geometry.coordinates.flat();

    // Check if elevation data exists (3rd element in coords)
    const hasElevation = rawCoords.some(c => c.length >= 3 && c[2] !== 0);
    if (!hasElevation || rawCoords.length < 2) {
      return { points: [], coords: rawCoords, stats: null };
    }

    // Build elevation points with cumulative distance
    const pts: ElevationPoint[] = [];
    let cumulativeDistance = 0;
    let totalAscent = 0;
    let totalDescent = 0;

    for (let i = 0; i < rawCoords.length; i++) {
      if (i > 0) {
        cumulativeDistance += haversine(
          rawCoords[i - 1][1], rawCoords[i - 1][0],
          rawCoords[i][1], rawCoords[i][0]
        );
        const elevDiff = (rawCoords[i][2] || 0) - (rawCoords[i - 1][2] || 0);
        if (elevDiff > 0) totalAscent += elevDiff;
        else totalDescent += Math.abs(elevDiff);
      }
      pts.push({
        distance: cumulativeDistance,
        elevation: rawCoords[i][2] || 0
      });
    }

    // Downsample if too many points (keep it smooth but performant)
    const maxPoints = 300;
    let sampled = pts;
    if (pts.length > maxPoints) {
      const step = Math.floor(pts.length / maxPoints);
      sampled = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
    }

    const elevations = sampled.map(p => p.elevation);
    return {
      points: sampled,
      coords: rawCoords,
      stats: {
        minElev: Math.round(Math.min(...elevations)),
        maxElev: Math.round(Math.max(...elevations)),
        totalAscent: Math.round(totalAscent),
        totalDescent: Math.round(totalDescent),
        totalDistance: Math.round(cumulativeDistance * 10) / 10
      }
    };
  }, [trackGeojson]);

  if (points.length === 0 || !stats) {
    return (
      <div className="w-full bg-gray-100 rounded-lg p-4 text-center text-gray-500 text-sm">
        No elevation data available in this GPX file
      </div>
    );
  }

  // SVG dimensions
  const padding = { top: 10, right: 12, bottom: 24, left: 44 };
  const width = 800;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Scales
  const maxDist = points[points.length - 1].distance;
  const minElev = stats.minElev - 20;
  const maxElev = stats.maxElev + 20;
  const elevRange = maxElev - minElev || 1;

  const xScale = (d: number) => padding.left + (d / maxDist) * chartWidth;
  const yScale = (e: number) => padding.top + chartHeight - ((e - minElev) / elevRange) * chartHeight;

  // Build SVG path for the area
  const linePath = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(p.distance).toFixed(1)} ${yScale(p.elevation).toFixed(1)}`
  ).join(' ');

  const areaPath = `${linePath} L ${xScale(maxDist).toFixed(1)} ${yScale(minElev).toFixed(1)} L ${xScale(0).toFixed(1)} ${yScale(minElev).toFixed(1)} Z`;

  // Y-axis ticks (3-4 labels)
  const yTicks: number[] = [];
  const tickStep = Math.ceil(elevRange / 4 / 100) * 100;
  for (let t = Math.ceil(minElev / tickStep) * tickStep; t <= maxElev; t += tickStep) {
    yTicks.push(t);
  }

  // X-axis ticks
  const xTicks: number[] = [];
  const xStep = Math.ceil(maxDist / 5);
  for (let t = 0; t <= maxDist; t += xStep || 1) {
    xTicks.push(t);
  }

  // Waypoint markers on the profile
  const waypointMarkers = waypoints.map(wp => {
    const dist = findClosestDistance(wp, points, coords);
    if (dist === null) return null;
    // Find elevation at this distance
    const closest = points.reduce((prev, curr) =>
      Math.abs(curr.distance - dist) < Math.abs(prev.distance - dist) ? curr : prev
    );
    return { ...wp, x: xScale(dist), y: yScale(closest.elevation) };
  }).filter(Boolean);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-700">Elevation Profile</span>
        <div className="flex gap-4 text-xs text-gray-500">
          <span>{stats.totalDistance} km</span>
          <span>+{stats.totalAscent}m / -{stats.totalDescent}m</span>
          <span>{stats.minElev}m - {stats.maxElev}m</span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full bg-gray-50 rounded border border-gray-200"
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {yTicks.map(t => (
          <g key={`y-${t}`}>
            <line
              x1={padding.left} x2={width - padding.right}
              y1={yScale(t)} y2={yScale(t)}
              stroke="#e5e7eb" strokeWidth="0.5"
            />
            <text
              x={padding.left - 4} y={yScale(t) + 3}
              textAnchor="end" fontSize="8" fill="#6b7280"
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
            textAnchor="middle" fontSize="8" fill="#6b7280"
          >
            {t}km
          </text>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="rgba(234, 88, 12, 0.15)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke="#ea580c" strokeWidth="1.5" />

        {/* Waypoint markers */}
        {waypointMarkers.map((wp, i) => wp && (
          <g key={i}>
            <circle cx={wp.x} cy={wp.y} r="3" fill="#ea580c" stroke="white" strokeWidth="1" />
            <text
              x={wp.x} y={wp.y - 6}
              textAnchor="middle" fontSize="6" fill="#374151" fontWeight="bold"
            >
              {wp.name.length > 10 ? wp.name.slice(0, 10) + '...' : wp.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
