// Trail deduplication using fuzzy name matching and geographic proximity

import { haversineDistance } from './validate-trails.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface TrailCandidate {
  id?: string;
  name: string;
  coordinates: [number, number, number][];
  [key: string]: any;
}

/**
 * Normalize trail name for comparison
 * @param name Trail name
 * @returns Normalized name (lowercase, removed common suffixes)
 */
export function normalizeTrailName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(trail|track|path|way|route|circuit|loop)$/i, '')
    .replace(/\s*\([^)]*\)/g, '') // Remove parenthetical qualifiers
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings
 * @param a First string
 * @param b Second string
 * @returns Levenshtein distance
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity ratio between two strings (0-1)
 * @param a First string
 * @param b Second string
 * @returns Similarity ratio (1 = identical, 0 = completely different)
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - distance / maxLength;
}

/**
 * Calculate distance between trail start points
 * @param coords1 First trail coordinates
 * @param coords2 Second trail coordinates
 * @returns Distance in kilometers
 */
export function geographicProximity(
  coords1: [number, number, number][],
  coords2: [number, number, number][]
): number {
  if (coords1.length === 0 || coords2.length === 0) {
    return Infinity;
  }

  const start1: [number, number] = [coords1[0][0], coords1[0][1]];
  const start2: [number, number] = [coords2[0][0], coords2[0][1]];

  return haversineDistance(start1, start2);
}

export interface DeduplicationResult {
  unique: TrailCandidate[];
  duplicates: Array<{
    trail: TrailCandidate;
    duplicateOf: string;
    reason: string;
  }>;
}

/**
 * Deduplicate trails based on name similarity and geographic proximity
 * @param trails Array of trail candidates
 * @returns Unique trails and duplicates list
 */
export function deduplicateTrails(trails: TrailCandidate[]): DeduplicationResult {
  const unique: TrailCandidate[] = [];
  const duplicates: DeduplicationResult['duplicates'] = [];
  const seen = new Set<string>();

  for (const trail of trails) {
    let isDuplicate = false;
    const normalizedName = normalizeTrailName(trail.name);

    for (const existing of unique) {
      const existingNormalized = normalizeTrailName(existing.name);

      // Check 1: Exact name match
      if (trail.name === existing.name) {
        isDuplicate = true;
        const reason = 'exact_name_match';
        const keepExisting = existing.coordinates.length >= trail.coordinates.length;

        if (!keepExisting) {
          // Replace existing with this trail (more coordinates)
          const index = unique.indexOf(existing);
          unique[index] = trail;
          duplicates.push({
            trail: existing,
            duplicateOf: trail.name,
            reason: `${reason} (kept version with more coordinates)`,
          });
        } else {
          duplicates.push({
            trail,
            duplicateOf: existing.name,
            reason,
          });
        }
        break;
      }

      // Check 2: Fuzzy name match + geographic proximity
      const similarity = levenshteinSimilarity(normalizedName, existingNormalized);
      const distance = geographicProximity(trail.coordinates, existing.coordinates);

      if (similarity > 0.85 && distance < 5) {
        isDuplicate = true;
        const reason = `fuzzy_match (${(similarity * 100).toFixed(0)}% similar, ${distance.toFixed(1)}km apart)`;
        const keepExisting = existing.coordinates.length >= trail.coordinates.length;

        if (!keepExisting) {
          // Replace existing with this trail (more coordinates)
          const index = unique.indexOf(existing);
          unique[index] = trail;
          duplicates.push({
            trail: existing,
            duplicateOf: trail.name,
            reason: `${reason} (kept version with more coordinates)`,
          });
        } else {
          duplicates.push({
            trail,
            duplicateOf: existing.name,
            reason,
          });
        }
        break;
      }
    }

    if (!isDuplicate) {
      unique.push(trail);
      seen.add(trail.name);
    }
  }

  return { unique, duplicates };
}

/**
 * Deduplicate trails from all JSON files in a directory
 * Scans directory for *.json files, merges all trails, and deduplicates
 * @param dirPath Path to directory containing trail JSON files
 * @returns Deduplicated trails and duplicates found
 */
export async function deduplicateFromDirectory(
  dirPath: string
): Promise<DeduplicationResult> {
  const allTrails: TrailCandidate[] = [];

  try {
    const files = await fs.readdir(dirPath);
    const jsonFiles = files.filter((file) => file.endsWith('.json'));

    console.log(`Scanning ${jsonFiles.length} JSON files in ${dirPath}...`);

    for (const file of jsonFiles) {
      const filePath = path.join(dirPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Handle different JSON structures
      let trails: TrailCandidate[] = [];
      if (Array.isArray(data)) {
        trails = data;
      } else if (data.trails && Array.isArray(data.trails)) {
        trails = data.trails;
      } else if (data.results && Array.isArray(data.results)) {
        trails = data.results;
      }

      // Validate that trails have required properties
      trails = trails.filter((trail) => {
        return trail && typeof trail === 'object' && trail.name && trail.coordinates;
      });

      console.log(`  ${file}: ${trails.length} trails`);
      allTrails.push(...trails);
    }

    console.log(`\nTotal trails scanned: ${allTrails.length}`);
  } catch (error) {
    throw new Error(`Failed to read directory: ${error}`);
  }

  return deduplicateTrails(allTrails);
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const targetPath = process.argv[2];

  if (!targetPath) {
    console.error('Usage: npx tsx deduplicate-trails.ts <file-or-directory-path>');
    process.exit(1);
  }

  (async () => {
    try {
      const stats = await fs.stat(targetPath);

      let result: DeduplicationResult;

      if (stats.isDirectory()) {
        console.log('Directory mode: scanning all JSON files...\n');
        result = await deduplicateFromDirectory(targetPath);
      } else if (stats.isFile()) {
        console.log('File mode: processing single file...\n');
        const content = await fs.readFile(targetPath, 'utf-8');
        const data = JSON.parse(content);

        let trails: TrailCandidate[] = [];
        if (Array.isArray(data)) {
          trails = data;
        } else if (data.trails && Array.isArray(data.trails)) {
          trails = data.trails;
        } else if (data.results && Array.isArray(data.results)) {
          trails = data.results;
        }

        console.log(`Total trails: ${trails.length}`);
        result = deduplicateTrails(trails);
      } else {
        console.error('Error: Path is neither a file nor a directory');
        process.exit(1);
      }

      console.log('\n=== DEDUPLICATION RESULTS ===');
      console.log(`Unique trails: ${result.unique.length}`);
      console.log(`Duplicates found: ${result.duplicates.length}`);

      if (result.duplicates.length > 0) {
        console.log('\nDuplicates:');
        result.duplicates.forEach((dup) => {
          console.log(`  - "${dup.trail.name}" is duplicate of "${dup.duplicateOf}" (${dup.reason})`);
        });
      }
    } catch (error) {
      console.error(`Error: ${error}`);
      process.exit(1);
    }
  })();
}
