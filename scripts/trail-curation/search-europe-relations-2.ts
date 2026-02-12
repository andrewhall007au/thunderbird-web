// Follow-up search for missing European trail relation IDs
// Usage: npx tsx scripts/trail-curation/search-europe-relations-2.ts

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const OVERPASS_API_FALLBACK = 'https://overpass.kumi.systems/api/interpreter';

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

async function main() {
  console.log('=== FOLLOW-UP SEARCH FOR EUROPEAN TRAIL IDs ===\n');

  // 1. Alta Via 2 — retry
  console.log('--- Alta Via 2 ---');
  try {
    const data = await overpassQuery(`[out:json][timeout:30];
      relation["route"="hiking"]["name"~"Alta Via.*2|Alta via.*n\\\\. 2",i](46.0,11.0,47.0,12.5);
      out tags;`);
    for (const el of data.elements || []) {
      console.log(`  rel:${el.id} — "${el.tags?.name}" ref=${el.tags?.ref || ''} type=${el.tags?.type}`);
    }
    if (!data.elements?.length) console.log('  No results');
  } catch (err: any) { console.log(`  ERROR: ${err.message}`); }
  await sleep(5000);

  // Also search for any "Alta Via" in Dolomites bbox
  console.log('--- All Alta Via relations ---');
  try {
    const data = await overpassQuery(`[out:json][timeout:30];
      relation["route"="hiking"]["name"~"Alta Via",i](46.0,11.0,47.0,12.5);
      out tags;`);
    for (const el of data.elements || []) {
      console.log(`  rel:${el.id} — "${el.tags?.name}" ref=${el.tags?.ref || ''} type=${el.tags?.type}`);
    }
  } catch (err: any) { console.log(`  ERROR: ${err.message}`); }
  await sleep(5000);

  // 2. Vikos Gorge — retry
  console.log('\n--- Vikos Gorge (wider search) ---');
  try {
    const data = await overpassQuery(`[out:json][timeout:30];
      relation["route"="hiking"](39.8,20.5,40.1,21.0);
      out tags;`);
    for (const el of data.elements || []) {
      console.log(`  rel:${el.id} — "${el.tags?.name}" ref=${el.tags?.ref || ''}`);
    }
    if (!data.elements?.length) console.log('  No relations found');
  } catch (err: any) { console.log(`  ERROR: ${err.message}`); }
  await sleep(5000);

  // 3. GR11 — search by ref
  console.log('\n--- GR11 by ref ---');
  try {
    const data = await overpassQuery(`[out:json][timeout:30];
      relation["route"~"hiking|foot"]["ref"~"GR.?11$"](42.0,-2.0,43.0,3.5);
      out tags;`);
    for (const el of data.elements || []) {
      console.log(`  rel:${el.id} — "${el.tags?.name}" ref=${el.tags?.ref || ''} type=${el.tags?.type}`);
    }
    if (!data.elements?.length) console.log('  No results');
  } catch (err: any) { console.log(`  ERROR: ${err.message}`); }
  await sleep(5000);

  // Also search for GR11 superroute
  console.log('--- GR11 superroute ---');
  try {
    const data = await overpassQuery(`[out:json][timeout:30];
      relation["type"="superroute"]["ref"~"GR.?11"](42.0,-2.0,43.0,3.5);
      out tags;`);
    for (const el of data.elements || []) {
      console.log(`  rel:${el.id} — "${el.tags?.name}" ref=${el.tags?.ref || ''} type=${el.tags?.type}`);
    }
    if (!data.elements?.length) console.log('  No superroutes found');
  } catch (err: any) { console.log(`  ERROR: ${err.message}`); }
  await sleep(5000);

  // 4. GR10 — search by ref
  console.log('\n--- GR10 by ref ---');
  try {
    const data = await overpassQuery(`[out:json][timeout:30];
      relation["route"~"hiking|foot"]["ref"="GR 10"](42.5,-2.0,43.5,3.5);
      out tags;`);
    for (const el of data.elements || []) {
      console.log(`  rel:${el.id} — "${el.tags?.name}" ref=${el.tags?.ref || ''} type=${el.tags?.type}`);
    }
    if (!data.elements?.length) console.log('  No results');
  } catch (err: any) { console.log(`  ERROR: ${err.message}`); }
  await sleep(5000);

  // GR10 superroute
  console.log('--- GR10 superroute ---');
  try {
    const data = await overpassQuery(`[out:json][timeout:30];
      relation["type"="superroute"]["ref"="GR 10"](42.5,-2.0,43.5,3.5);
      out tags;`);
    for (const el of data.elements || []) {
      console.log(`  rel:${el.id} — "${el.tags?.name}" ref=${el.tags?.ref || ''} type=${el.tags?.type}`);
    }
    if (!data.elements?.length) console.log('  No superroutes found');
  } catch (err: any) { console.log(`  ERROR: ${err.message}`); }
  await sleep(5000);

  // 5. Camino de Santiago Francés superroute
  console.log('\n--- Camino de Santiago Francés superroute ---');
  try {
    const data = await overpassQuery(`[out:json][timeout:30];
      relation["type"="superroute"]["name"~"Camino.*Franc",i](42.0,-9.0,43.5,-1.0);
      out tags;`);
    for (const el of data.elements || []) {
      console.log(`  rel:${el.id} — "${el.tags?.name}" ref=${el.tags?.ref || ''} type=${el.tags?.type}`);
    }
    if (!data.elements?.length) console.log('  No superroutes found');
  } catch (err: any) { console.log(`  ERROR: ${err.message}`); }
  await sleep(5000);

  // Broader Camino search
  console.log('--- Camino Francés ref search ---');
  try {
    const data = await overpassQuery(`[out:json][timeout:30];
      relation["ref"="66261"](42.0,-9.0,43.5,-1.0);
      out tags;`);
    for (const el of data.elements || []) {
      console.log(`  rel:${el.id} — "${el.tags?.name}" ref=${el.tags?.ref || ''} type=${el.tags?.type}`);
    }
    if (!data.elements?.length) console.log('  No results');
  } catch (err: any) { console.log(`  ERROR: ${err.message}`); }
  await sleep(5000);

  // 6. SWCP
  console.log('\n--- South West Coast Path ---');
  try {
    const data = await overpassQuery(`[out:json][timeout:30];
      relation["route"="hiking"]["name"~"South West Coast Path",i](50.0,-5.7,51.5,-1.0);
      out tags;`);
    for (const el of data.elements || []) {
      console.log(`  rel:${el.id} — "${el.tags?.name}" ref=${el.tags?.ref || ''} type=${el.tags?.type}`);
    }
    if (!data.elements?.length) console.log('  No results');
  } catch (err: any) { console.log(`  ERROR: ${err.message}`); }
  await sleep(5000);

  // 7. West Highland Way
  console.log('\n--- West Highland Way ---');
  try {
    const data = await overpassQuery(`[out:json][timeout:30];
      relation["route"="hiking"]["name"~"West Highland Way",i](55.8,-5.5,57.0,-4.0);
      out tags;`);
    for (const el of data.elements || []) {
      console.log(`  rel:${el.id} — "${el.tags?.name}" ref=${el.tags?.ref || ''} type=${el.tags?.type}`);
    }
    if (!data.elements?.length) console.log('  No results');
  } catch (err: any) { console.log(`  ERROR: ${err.message}`); }
  await sleep(5000);

  // 8. Skye Trail
  console.log('\n--- Skye Trail ---');
  try {
    const data = await overpassQuery(`[out:json][timeout:30];
      relation["route"="hiking"]["name"~"Skye Trail",i](57.0,-6.8,57.7,-5.8);
      out tags;`);
    for (const el of data.elements || []) {
      console.log(`  rel:${el.id} — "${el.tags?.name}" ref=${el.tags?.ref || ''} type=${el.tags?.type}`);
    }
    if (!data.elements?.length) console.log('  No results');
  } catch (err: any) { console.log(`  ERROR: ${err.message}`); }
  await sleep(5000);

  // 9. Check Adlerweg parent (rel:17810569) structure
  console.log('\n--- Adlerweg parent (rel:17810569) members ---');
  try {
    const data = await overpassQuery(`[out:json][timeout:30];
      relation(17810569);
      out body;`);
    const rel = data.elements?.[0];
    if (rel) {
      const ways = rel.members?.filter((m: any) => m.type === 'way').length || 0;
      const rels = rel.members?.filter((m: any) => m.type === 'relation').length || 0;
      console.log(`  "${rel.tags?.name}" — ${ways} ways, ${rels} sub-relations, type=${rel.tags?.type}`);
      // Show sub-relations
      for (const m of (rel.members || []).filter((m: any) => m.type === 'relation')) {
        console.log(`    sub-rel:${m.ref} role="${m.role || ''}"`);
      }
    }
  } catch (err: any) { console.log(`  ERROR: ${err.message}`); }
  await sleep(5000);

  // 10. Check TMB Itinéraire principal structure
  console.log('\n--- TMB Itinéraire principal (rel:9678362) members ---');
  try {
    const data = await overpassQuery(`[out:json][timeout:30];
      relation(9678362);
      out body;`);
    const rel = data.elements?.[0];
    if (rel) {
      const ways = rel.members?.filter((m: any) => m.type === 'way').length || 0;
      const rels = rel.members?.filter((m: any) => m.type === 'relation').length || 0;
      console.log(`  "${rel.tags?.name}" — ${ways} ways, ${rels} sub-relations, type=${rel.tags?.type}`);
    }
  } catch (err: any) { console.log(`  ERROR: ${err.message}`); }

  console.log('\n=== DONE ===');
}

main().catch(console.error);
