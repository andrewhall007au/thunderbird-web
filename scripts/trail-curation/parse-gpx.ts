#!/usr/bin/env node

/**
 * GPX Parser for Tasmanian Trails
 *
 * Parses GPX files from fastestknowntime.com and extracts trail data
 * including coordinates, elevation, and statistics.
 *
 * Usage: npx tsx scripts/trail-curation/parse-gpx.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface TrailCoordinate {
  lng: number;
  lat: number;
  ele: number;
}

interface TrailStats {
  points: number;
  distanceKm: number;
  elevationLow: number;
  elevationHigh: number;
  elevationGain: number;
}

interface ParsedTrail {
  name: string;
  source: string;
  license: string;
  coordinates: [number, number, number][];
  stats: TrailStats;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate total elevation gain
 */
function calculateElevationGain(coordinates: TrailCoordinate[]): number {
  let totalGain = 0;

  for (let i = 1; i < coordinates.length; i++) {
    const elevationDiff = coordinates[i].ele - coordinates[i - 1].ele;
    if (elevationDiff > 0) {
      totalGain += elevationDiff;
    }
  }

  return totalGain;
}

/**
 * Calculate total distance along the trail
 */
function calculateTotalDistance(coordinates: TrailCoordinate[]): number {
  let totalDistance = 0;

  for (let i = 1; i < coordinates.length; i++) {
    const dist = haversineDistance(
      coordinates[i - 1].lat,
      coordinates[i - 1].lng,
      coordinates[i].lat,
      coordinates[i].lng
    );
    totalDistance += dist;
  }

  return totalDistance;
}

/**
 * Extract value from simple XML tag
 */
function extractTagValue(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}>([^<]+)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Parse GPX file and extract coordinates with elevation
 */
function parseGPX(gpxContent: string, filename: string): ParsedTrail {
  const coordinates: TrailCoordinate[] = [];

  // Extract trail name from metadata or filename
  let trailName = extractTagValue(gpxContent, 'name');
  if (!trailName) {
    trailName = filename.replace('.gpx', '').replace(/-/g, ' ');
  }

  // Match trackpoints: <trkpt lat="..." lon="..."><ele>...</ele></trkpt>
  const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>[\s\S]*?<ele>([^<]+)<\/ele>[\s\S]*?<\/trkpt>/gi;
  let match;

  while ((match = trkptRegex.exec(gpxContent)) !== null) {
    coordinates.push({
      lat: parseFloat(match[1]),
      lng: parseFloat(match[2]),
      ele: parseFloat(match[3])
    });
  }

  // Also match route points: <rtept lat="..." lon="..."><ele>...</ele></rtept>
  const rteptRegex = /<rtept\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>[\s\S]*?<ele>([^<]+)<\/ele>[\s\S]*?<\/rtept>/gi;

  while ((match = rteptRegex.exec(gpxContent)) !== null) {
    coordinates.push({
      lat: parseFloat(match[1]),
      lng: parseFloat(match[2]),
      ele: parseFloat(match[3])
    });
  }

  if (coordinates.length === 0) {
    throw new Error(`No coordinates found in ${filename}`);
  }

  // Calculate statistics
  const elevations = coordinates.map(c => c.ele);
  const elevationLow = Math.min(...elevations);
  const elevationHigh = Math.max(...elevations);
  const elevationGain = calculateElevationGain(coordinates);
  const distanceKm = calculateTotalDistance(coordinates);

  // Convert to output format
  const coordinateArray: [number, number, number][] = coordinates.map(c => [
    c.lng,
    c.lat,
    c.ele
  ]);

  return {
    name: trailName,
    source: 'fastestknowntime.com',
    license: 'CC-BY-SA (user-contributed GPS tracks)',
    coordinates: coordinateArray,
    stats: {
      points: coordinates.length,
      distanceKm: Math.round(distanceKm * 100) / 100,
      elevationLow: Math.round(elevationLow),
      elevationHigh: Math.round(elevationHigh),
      elevationGain: Math.round(elevationGain)
    }
  };
}

/**
 * Main execution
 */
function main() {
  const gpxDir = path.join(__dirname, 'gpx-downloads');
  const outputDir = path.join(gpxDir, 'parsed');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Get all GPX files
  const files = fs.readdirSync(gpxDir).filter(f => f.endsWith('.gpx'));

  if (files.length === 0) {
    console.log('No GPX files found in', gpxDir);
    return;
  }

  console.log(`\nParsing ${files.length} GPX file(s)...\n`);

  files.forEach(filename => {
    const filePath = path.join(gpxDir, filename);
    const gpxContent = fs.readFileSync(filePath, 'utf-8');

    try {
      const parsed = parseGPX(gpxContent, filename);

      // Calculate bounding box
      const lngs = parsed.coordinates.map(c => c[0]);
      const lats = parsed.coordinates.map(c => c[1]);
      const bbox = {
        minLng: Math.min(...lngs),
        maxLng: Math.max(...lngs),
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats)
      };

      // Report
      console.log(`📍 ${filename}`);
      console.log(`   Name: ${parsed.name}`);
      console.log(`   Trackpoints: ${parsed.stats.points.toLocaleString()}`);
      console.log(`   Distance: ${parsed.stats.distanceKm.toFixed(2)} km`);
      console.log(`   Elevation: ${parsed.stats.elevationLow}m - ${parsed.stats.elevationHigh}m`);
      console.log(`   Elevation Gain: ${parsed.stats.elevationGain}m`);
      console.log(`   Bounding Box: [${bbox.minLng.toFixed(6)}, ${bbox.minLat.toFixed(6)}] to [${bbox.maxLng.toFixed(6)}, ${bbox.maxLat.toFixed(6)}]`);

      // Save to JSON
      const outputFilename = filename.replace('.gpx', '.json');
      const outputPath = path.join(outputDir, outputFilename);
      fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));
      console.log(`   ✓ Saved to ${outputFilename}\n`);

    } catch (error) {
      console.error(`   ✗ Error parsing ${filename}:`, error);
    }
  });

  console.log('Done!\n');
}

main();
