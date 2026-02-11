import { haversineKm, findClosestTrail, trailheads } from './trailMatch';

describe('haversineKm', () => {
  it('returns 0 for same point', () => {
    expect(haversineKm(-42, 146, -42, 146)).toBe(0);
  });

  it('calculates known distance correctly', () => {
    // Sydney to Melbourne is ~714km
    const dist = haversineKm(-33.87, 151.21, -37.81, 144.96);
    expect(dist).toBeGreaterThan(700);
    expect(dist).toBeLessThan(730);
  });
});

describe('findClosestTrail', () => {
  it('matches Perth to Bibbulmun Track', () => {
    // Perth: -31.96, 115.86
    expect(findClosestTrail(-31.96, 115.86)).toBe('bibbulmun_track');
  });

  it('matches Cradle Mountain to Overland Track', () => {
    // Cradle Mountain: -41.64, 145.94
    expect(findClosestTrail(-41.64, 145.94)).toBe('overland_track');
  });

  it('matches Yosemite Village to a Yosemite trail', () => {
    // Yosemite Village: 37.75, -119.59
    const trail = findClosestTrail(37.75, -119.59);
    expect(trail).toBeTruthy();
    expect(trail).toMatch(/yosemite|half_dome|mist_trail|clouds_rest|four_mile|sentinel_dome|north_dome/);
  });

  it('matches Queenstown NZ to a nearby track', () => {
    // Queenstown: -45.03, 168.66
    const trail = findClosestTrail(-45.03, 168.66);
    expect(trail).toBeTruthy();
    expect(trail).toMatch(/routeburn|kepler|milford|ben_lomond_track|key_summit|hollyford|reesdart/);
  });

  it('returns null for middle of Pacific Ocean', () => {
    expect(findClosestTrail(0, -160)).toBeNull();
  });

  it('returns null for location outside 50km radius', () => {
    // Darwin, Australia — no trails within 50km
    expect(findClosestTrail(-12.46, 130.84)).toBeNull();
  });

  it('respects custom radius', () => {
    // Perth is ~19km from Bibbulmun, should NOT match with 10km radius
    expect(findClosestTrail(-31.96, 115.86, 10)).toBeNull();
    // But should match with 25km
    expect(findClosestTrail(-31.96, 115.86, 25)).toBe('bibbulmun_track');
  });

  it('picks closest trail when multiple are nearby', () => {
    // Grand Canyon Village — near both Bright Angel and South Kaibab
    const trail = findClosestTrail(36.06, -112.14);
    expect(trail).toBe('bright_angel_trail_to_plateau_point');
  });
});

describe('trailheads data integrity', () => {
  it('has 252 trailheads', () => {
    expect(trailheads.length).toBe(252);
  });

  it('all entries have valid format [string, number, number]', () => {
    for (const entry of trailheads) {
      expect(entry).toHaveLength(3);
      expect(typeof entry[0]).toBe('string');
      expect(typeof entry[1]).toBe('number');
      expect(typeof entry[2]).toBe('number');
    }
  });

  it('all latitudes are between -90 and 90', () => {
    for (const [id, lat] of trailheads) {
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
    }
  });

  it('all longitudes are between -180 and 180', () => {
    for (const [id, , lng] of trailheads) {
      expect(lng).toBeGreaterThanOrEqual(-180);
      expect(lng).toBeLessThanOrEqual(180);
    }
  });

  it('has no duplicate trail IDs', () => {
    const ids = trailheads.map(([id]) => id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
