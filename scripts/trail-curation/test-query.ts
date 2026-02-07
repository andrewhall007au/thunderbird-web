// Test script for Task 1 modules

import { buildTrailQuery, queryOverpass, extractCoordinates } from './overpass-query.js';
import { simplifyCoordinates } from './simplify-coordinates.js';
import { findElevationWaypoints } from './elevation-waypoints.js';
import { getFallbackSources } from './fallback-sources.js';

async function testModules() {
  console.log('=== Testing Trail Curation Modules ===\n');

  // Test 1: Query Tour du Mont Blanc from OSM
  console.log('Test 1: Querying Tour du Mont Blanc from OSM...');
  try {
    // bbox: [south, west, north, east] = [minLat, minLng, maxLat, maxLng]
    const query = buildTrailQuery('Tour du Mont Blanc', [45.5, 6.5, 46.5, 7.5]);
    console.log('Query built successfully');

    const response = await queryOverpass(query);
    console.log(`Overpass response received: ${response.elements.length} elements`);

    const coordinates = extractCoordinates(response);
    console.log(`Extracted ${coordinates.length} coordinates`);

    if (coordinates.length > 0) {
      console.log(`First coordinate: [${coordinates[0].join(', ')}]`);
      console.log(`Last coordinate: [${coordinates[coordinates.length - 1].join(', ')}]`);

      // Test simplification
      const simplified = simplifyCoordinates(coordinates, 100);
      console.log(`Simplified to ${simplified.length} points (target: 100)`);

      // Test elevation waypoints
      const waypoints = findElevationWaypoints(simplified);
      console.log(`Trail Low: ${waypoints.trailLow.name} at [${waypoints.trailLow.coordinates.join(', ')}]`);
      console.log(`Trail High: ${waypoints.trailHigh.name} at [${waypoints.trailHigh.coordinates.join(', ')}]`);
      console.log(`Elevation data available: ${waypoints.trailLow.elevationDataAvailable}`);
    }
  } catch (error) {
    console.error(`Test 1 failed: ${error}`);
  }

  console.log('\n---\n');

  // Test 2: Fallback sources for US
  console.log('Test 2: Fallback sources for US...');
  const usSources = getFallbackSources('US');
  console.log(`Found ${usSources.length} fallback sources for US:`);
  usSources.forEach((source) => {
    console.log(`  - ${source.id}: ${source.name} (${source.type})`);
  });

  console.log('\n---\n');

  // Test 3: Fallback sources for NZ
  console.log('Test 3: Fallback sources for NZ...');
  const nzSources = getFallbackSources('NZ');
  console.log(`Found ${nzSources.length} fallback sources for NZ:`);
  nzSources.forEach((source) => {
    console.log(`  - ${source.id}: ${source.name} (${source.type})`);
  });

  console.log('\n---\n');

  // Test 4: Fallback sources for unknown country
  console.log('Test 4: Fallback sources for unknown country (XX)...');
  const unknownSources = getFallbackSources('XX');
  console.log(`Found ${unknownSources.length} fallback sources for XX (should be 0)`);

  console.log('\n=== Tests Complete ===');
}

testModules().catch(console.error);
