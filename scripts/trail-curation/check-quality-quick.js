const fs = require('fs');
const path = require('path');

const TRAIL_DIR = path.join(__dirname, '../../public/trail-data');

const trails = [
  { id: 'spit_to_manly_walk', officialKm: 10 },
  { id: 'three_sisters_and_giant_stairway', officialKm: 5 },
  { id: 'mount_kosciuszko_summit_walk', officialKm: 13 },
  { id: 'mt_feathertop', officialKm: 22 },
  { id: 'cathedral_range_southern_circuit', officialKm: 12 },
  { id: 'bluff_knoll', officialKm: 6 },
  { id: 'castle_rock_girraween', officialKm: 5 },
  { id: 'wilpena_pound', officialKm: 17 },
  { id: 'mount_lofty_summit_via_waterfall_gully', officialKm: 6 },
  { id: 'uluru_base_walk', officialKm: 11 },
  { id: 'wineglass_bay_and_hazards_beach', officialKm: 11 },
];

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcDistance(coordinates) {
  let total = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const [lon1, lat1] = coordinates[i - 1];
    const [lon2, lat2] = coordinates[i];
    total += haversineKm(lat1, lon1, lat2, lon2);
  }
  return total;
}

console.log('trail_id                                  | points | calc_km | official_km | off%');
console.log('-'.repeat(90));

for (const t of trails) {
  const filePath = path.join(TRAIL_DIR, t.id + '.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const coords = data.coordinates;
  const calcKm = calcDistance(coords);
  const offPct = ((calcKm - t.officialKm) / t.officialKm) * 100;
  const sign = offPct >= 0 ? '+' : '';
  console.log(
    t.id.padEnd(42) + '| ' + String(coords.length).padStart(6) + ' | ' + calcKm.toFixed(2).padStart(7) + ' | ' + String(t.officialKm).padStart(11) + ' | ' + sign + offPct.toFixed(1) + '%'
  );
}
