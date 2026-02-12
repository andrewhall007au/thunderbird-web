// Quick search for correct OSM relation IDs for European mega trails
// Usage: npx tsx scripts/trail-curation/search-europe-relations.ts

const OVERPASS_API = 'https://overpass.kumi.systems/api/interpreter';
const OVERPASS_API_FALLBACK = 'https://overpass-api.de/api/interpreter';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function overpassQuery(query: string): Promise<any> {
  for (const api of [OVERPASS_API, OVERPASS_API_FALLBACK]) {
    const label = api.includes('kumi') ? 'kumi' : 'main';
    try {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (res.status === 429 || res.status >= 500) {
        console.log(`  ${label}: HTTP ${res.status}, trying next...`);
        continue;
      }
      if (!res.ok) continue;
      const text = await res.text();
      if (text.startsWith('<?xml')) {
        console.log(`  ${label}: XML response (rate limited), trying next...`);
        continue;
      }
      return JSON.parse(text);
    } catch (err: any) {
      console.log(`  ${label}: ${err.message}, trying next...`);
    }
  }
  throw new Error('Overpass API failed');
}

interface Search {
  label: string;
  namePattern: string;
  bbox: string;
  filter?: string;
}

const SEARCHES: Search[] = [
  // Trails needing correct parent relations
  { label: 'Tour du Mont Blanc', namePattern: 'Tour du Mont Blanc|TMB', bbox: '45.5,6.5,46.2,7.5' },
  { label: 'GR20 Corsica', namePattern: 'GR.?20', bbox: '41.7,8.5,42.5,9.5' },
  { label: 'Alta Via 2', namePattern: 'Alta Via.*2|Alta via.*2', bbox: '46.0,11.0,47.0,12.5' },
  { label: 'Kungsleden', namePattern: 'Kungsleden', bbox: '65.5,14.0,69.0,21.0' },
  { label: 'Adlerweg', namePattern: 'Adlerweg', bbox: '46.8,10.0,47.8,13.0' },
  { label: 'E5 European', namePattern: '^E.?5$|E5 ', bbox: '46.0,9.5,48.0,12.5', filter: '["ref"~"E ?5"]' },
  { label: 'Vikos Gorge', namePattern: 'Vikos|Βίκος', bbox: '39.8,20.5,40.1,21.0' },
  { label: 'Rota Vicentina', namePattern: 'Rota Vicentina|Trilho dos Pescadores', bbox: '37.0,-9.0,38.0,-8.0' },
  // 4 mega trails
  { label: 'Camino de Santiago', namePattern: 'Camino de Santiago|Camino Francés', bbox: '42.0,-9.0,43.5,-1.0' },
  { label: 'GR11 Pyrenees', namePattern: 'GR.?11', bbox: '42.0,-2.0,43.0,3.5' },
  { label: 'GR10 Pyrenees', namePattern: 'GR.?10', bbox: '42.5,-2.0,43.5,3.5' },
  { label: 'Lycian Way', namePattern: 'Likya Yolu|Lycian Way', bbox: '36.0,29.0,37.0,31.0' },
  // UK mega trails needing correct IDs
  { label: 'South West Coast Path', namePattern: 'South West Coast Path', bbox: '50.0,-5.7,51.5,-1.0' },
  { label: 'West Highland Way', namePattern: 'West Highland Way', bbox: '55.8,-5.5,57.0,-4.0' },
  { label: 'Skye Trail', namePattern: 'Skye Trail', bbox: '57.0,-6.8,57.7,-5.8' },
];

async function main() {
  console.log('=== SEARCHING FOR EUROPEAN TRAIL RELATION IDs ===\n');

  for (const s of SEARCHES) {
    console.log(`\n--- ${s.label} ---`);

    // Search for route=hiking relations with matching name
    let query: string;
    if (s.filter) {
      // Use ref filter instead of name
      query = `[out:json][timeout:30];
        relation["route"="hiking"]${s.filter}(${s.bbox});
        out tags;`;
    } else {
      query = `[out:json][timeout:30];
        relation["route"="hiking"]["name"~"${s.namePattern}",i](${s.bbox});
        out tags;`;
    }

    try {
      const data = await overpassQuery(query);
      const elements = data.elements || [];

      if (elements.length === 0) {
        // Try without hiking filter (some use route=foot)
        const query2 = `[out:json][timeout:30];
          relation["route"~"hiking|foot"]["name"~"${s.namePattern}",i](${s.bbox});
          out tags;`;
        const data2 = await overpassQuery(query2);
        elements.push(...(data2.elements || []));
      }

      // Deduplicate by ID
      const seen = new Set<number>();
      const unique = elements.filter((e: any) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });

      // Sort by number of members (more members = likely the parent/super relation)
      unique.sort((a: any, b: any) => (b.members?.length || 0) - (a.members?.length || 0));

      for (const el of unique) {
        const name = el.tags?.name || 'unnamed';
        const ref = el.tags?.ref || '';
        const type = el.tags?.type || '';
        const network = el.tags?.network || '';
        const note = el.tags?.note || '';
        console.log(`  rel:${el.id} — "${name}" ${ref ? `ref=${ref}` : ''} type=${type} ${network ? `net=${network}` : ''} ${note ? `note="${note}"` : ''}`);
      }

      if (unique.length === 0) {
        console.log('  No relations found');

        // Also try superroute
        const query3 = `[out:json][timeout:30];
          relation["type"="superroute"]["name"~"${s.namePattern}",i](${s.bbox});
          out tags;`;
        try {
          const data3 = await overpassQuery(query3);
          for (const el of data3.elements || []) {
            const name = el.tags?.name || 'unnamed';
            console.log(`  SUPERROUTE rel:${el.id} — "${name}" type=${el.tags?.type}`);
          }
        } catch {}
      }

    } catch (err: any) {
      console.log(`  ERROR: ${err.message}`);
    }

    await sleep(4000);
  }

  console.log('\n=== DONE ===');
}

main().catch(console.error);
