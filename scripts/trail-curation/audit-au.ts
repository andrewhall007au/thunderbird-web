import fs from 'fs';
import path from 'path';

const dir = 'public/trail-data';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'manifest.json');

const auTrails: any[] = [];
for (const f of files) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    if (d.country === 'AU') {
      auTrails.push({
        id: d.id,
        name: d.name,
        region: d.region,
        distance: d.distance_km,
        days: d.typical_days,
        points: d.coordinates?.length || 0
      });
    }
  } catch(e) {}
}

auTrails.sort((a: any, b: any) => (a.region || '').localeCompare(b.region || '') || (a.name || '').localeCompare(b.name || ''));

const groups: Record<string, any[]> = {};
for (const t of auTrails) {
  const r = t.region || 'Unknown';
  if (!groups[r]) groups[r] = [];
  groups[r].push(t);
}

let total = 0;
let multiDay = 0;
for (const [region, trails] of Object.entries(groups).sort()) {
  console.log('\n' + region + ':');
  for (const t of trails) {
    const days = t.days || '?';
    const isMulti = days.includes('-') || parseInt(days) > 1;
    const marker = isMulti ? '[MULTI-DAY]' : '[DAY]';
    const pts = t.points > 0 ? t.points + 'pts' : 'NO DATA';
    console.log(`  ${t.name} (${t.distance}km, ${days}d) — ${pts} ${marker}`);
    total++;
    if (isMulti) multiDay++;
  }
}
console.log(`\n=== TOTAL: ${total} AU trails (${multiDay} multi-day) ===`);
