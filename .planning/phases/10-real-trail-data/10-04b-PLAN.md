---
phase: 10-real-trail-data
plan: 04b
type: execute
wave: 2
depends_on: ["10-01"]
files_modified:
  - scripts/trail-curation/trail-lists/nz-trails.json
  - scripts/trail-curation/results/nz-trails.json
autonomous: true

must_haves:
  truths:
    - "50 curated New Zealand trails have real coordinate data from OSM or DOC/LINZ fallback sources"
    - "All 9 DOC Great Walks are included"
    - "Each trail has 50-200 simplified coordinate points"
    - "Distance validation completed for all trails"
    - "Both North Island and South Island have significant representation"
    - "Each trail result records its data source for attribution"
  artifacts:
    - path: "scripts/trail-curation/trail-lists/nz-trails.json"
      provides: "Curated list of 50 top New Zealand hiking trails with metadata"
    - path: "scripts/trail-curation/results/nz-trails.json"
      provides: "Fetched and validated trail data for 50 New Zealand trails with source attribution"
  key_links:
    - from: "scripts/trail-curation/trail-lists/nz-trails.json"
      to: "scripts/trail-curation/batch-fetch.ts"
      via: "input file argument"
      pattern: "nz-trails.json"
---

<objective>
Curate and fetch real coordinate data for the top 50 New Zealand hiking trails, including all DOC Great Walks, iconic multi-day treks, and popular day hikes across both islands, with automatic fallback to DOC and LINZ data sources.

Purpose: New Zealand is a world-class hiking destination and a launch market. The DOC (Department of Conservation) manages an extensive track network and publishes track data via ArcGIS (geoportal.doc.govt.nz). LINZ provides additional topo track data. The fallback chain to DOC/LINZ should achieve near-100% coverage since DOC is the authoritative source for virtually all NZ hiking tracks.

Output: Validated trail data JSON file for 50 NZ trails with source attribution, ready for integration.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/10-real-trail-data/10-RESEARCH.md

# Pipeline built in Plan 01 (includes fallback-sources.ts with DOC and LINZ endpoints)
@.planning/phases/10-real-trail-data/10-01-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Curate NZ trail list and fetch batch 1 (trails 1-25)</name>
  <files>
    scripts/trail-curation/trail-lists/nz-trails.json
    scripts/trail-curation/results/nz-trails-batch1.json
  </files>
  <action>
1. Create `scripts/trail-curation/trail-lists/nz-trails.json` with exactly 50 TrailInput entries. For each trail, provide: name, searchName (OSM/DOC name if different), region (region name), country ("NZ"), officialDistanceKm, typicalDays, bbox.

**THE COMPLETE 50 NEW ZEALAND TRAILS LIST:**

**DOC GREAT WALKS (1-9):**
1. Milford Track (Fiordland, South Island)
2. Routeburn Track (Fiordland/Mt Aspiring, South Island)
3. Kepler Track (Fiordland, South Island)
4. Abel Tasman Coast Track (Nelson/Tasman, South Island)
5. Tongariro Northern Circuit (Tongariro, North Island)
6. Heaphy Track (Kahurangi, South Island)
7. Paparoa Track (West Coast, South Island)
8. Hump Ridge Track (Southland, South Island)
9. Lake Waikaremoana Great Walk (Te Urewera, North Island)

**SOUTH ISLAND MULTI-DAY TREKS (10-25):**
10. Rakiura Track (Stewart Island)
11. Mueller Hut Route (Aoraki/Mt Cook, Canterbury)
12. Hooker Valley Track (Aoraki/Mt Cook, Canterbury)
13. Rob Roy Glacier Track (Mt Aspiring, Otago)
14. Roy's Peak Track (Wanaka, Otago)
15. Ben Lomond Track (Queenstown, Otago)
16. Cascade Saddle Route (Mt Aspiring, Otago)
17. Gillespie Pass Circuit (Mt Aspiring, Otago)
18. Rees-Dart Track (Mt Aspiring, Otago)
19. Greenstone-Caples Track (Fiordland, Otago)
20. Hollyford Track (Fiordland, Southland)
21. Dusky Track (Fiordland, Southland)
22. George Sound Track (Fiordland, Southland)
23. St James Walkway (Canterbury)
24. Banks Peninsula Track (Canterbury)
25. Queen Charlotte Track (Marlborough)

2. Split the JSON so batch 1 contains trails 1-25. Run batch-fetch:
   ```
   npx tsx scripts/trail-curation/batch-fetch.ts scripts/trail-curation/trail-lists/nz-trails-batch1.json scripts/trail-curation/results/nz-trails-batch1.json
   ```

3. The fallback chain is extremely strong for NZ:
   - DOC Tracks ArcGIS service (geoportal.doc.govt.nz/arcgis/rest/services/GeoportalServices/DOC_Tracks/MapServer/0) -- the authoritative source for virtually ALL NZ tracks. DOC manages the entire track network.
   - LINZ Topo50 track centrelines (data.linz.govt.nz, layer 50329) -- comprehensive NZ topo data. Requires free LINZ API key (set LINZ_API_KEY env var).

   Between OSM (strong NZ mapper community), DOC, and LINZ, expect near-100% success for NZ trails.

4. Review the batch summary. All 9 Great Walks should succeed on the first try (either via OSM or DOC). For any rare failures:
   - NZ uses "Track" not "Trail" -- ensure searchName uses NZ convention
   - Try the te reo Maori name if available
   - The DOC source should catch anything OSM misses

5. Target: at least 24/25 successful on first pass (OSM + DOC + LINZ combined).
  </action>
  <verify>
Check batch 1 results: at least 24/25 successful. All 9 Great Walks should be present. Print source breakdown: how many via OSM, how many via DOC, how many via LINZ. Print per-region breakdown.
  </verify>
  <done>
50 NZ trails curated in trail list. First batch of 25 (including all Great Walks) fetched with near-100% success using OSM + DOC/LINZ fallback chain.
  </done>
</task>

<task type="auto">
  <name>Task 2: Fetch NZ trails batch 2 (trails 26-50) and resolve failures</name>
  <files>
    scripts/trail-curation/results/nz-trails-batch2.json
    scripts/trail-curation/results/nz-trails.json
  </files>
  <action>
1. The remaining 25 trails in the trail list (trails 26-50):

**NORTH ISLAND TRAILS (26-38):**
26. Tongariro Alpine Crossing (Tongariro, North Island) -- NOTE: This is a day hike section of the Northern Circuit, use distinct OSM relation
27. Pouakai Crossing (Taranaki, North Island)
28. Mt Taranaki Summit Track (Taranaki, North Island)
29. Pinnacles Walk (Coromandel, North Island)
30. Kaimai Ridgeway (Bay of Plenty/Waikato, North Island)
31. Te Araroa Trail - Tararua Section (Wellington, North Island)
32. Old Ghost Road (West Coast, but accessed from North Island side)
33. Matemateaonga Track (Whanganui, North Island)
34. Whirinaki Track (Bay of Plenty, North Island)
35. Rangitoto Summit Track (Auckland, North Island)
36. Cape Brett Track (Northland, North Island)
37. Mt Holdsworth - Jumbo Circuit (Wairarapa, North Island)
38. Tama Lakes Track (Tongariro, North Island)

**SOUTH ISLAND DAY HIKES & SHORT TREKS (39-50):**
39. Avalanche Peak Route (Arthur's Pass, Canterbury)
40. Key Summit Track (Fiordland)
41. Gertrude Saddle Route (Fiordland)
42. Lake Marian Track (Fiordland)
43. Luxmore Hut Day Walk (Fiordland) -- first section of Kepler Track to Luxmore Hut
44. Sealy Tarns Track (Aoraki/Mt Cook)
45. Mt Robert Circuit (Nelson Lakes)
46. Angelus Hut via Robert Ridge (Nelson Lakes)
47. Welcome Flat Hot Springs Track (West Coast)
48. Alex Knob Track (West Coast)
49. Isthmus Peak Track (Wanaka, Otago)
50. Roys Peak to Mt Alpha Traverse (Wanaka, Otago)

2. Run batch-fetch for trails 26-50:
   ```
   npx tsx scripts/trail-curation/batch-fetch.ts scripts/trail-curation/trail-lists/nz-trails-batch2.json scripts/trail-curation/results/nz-trails-batch2.json
   ```

3. The fallback chain handles most failures. For NZ-specific notes:
   - Tongariro Alpine Crossing is extremely popular and well-mapped in both OSM and DOC
   - Smaller DOC tracks may be mapped as ways rather than relations in OSM -- if OSM fails, DOC source should have them
   - Old Ghost Road is a mountain bike/walking track, search for both route types in OSM; DOC definitely has it

4. Target: at least 48/50 successful across both batches (OSM + DOC + LINZ). NZ should have the highest success rate of any country due to DOC's comprehensive track database.

5. Merge both batch results into a single `scripts/trail-curation/results/nz-trails.json`:
   - Combine successful results from batch 1 and batch 2
   - Include any retried trails
   - Run deduplication to catch any overlapping trail sections (e.g., Tongariro Alpine Crossing vs Northern Circuit)

6. Verify both islands are represented:
   - South Island: should have ~30+ trails (Great Walks + multi-day + day hikes)
   - North Island: should have ~13+ trails
   - Stewart Island: 1 trail (Rakiura Track)

7. Print final source attribution summary for NZ:
   ```
   === NZ TRAILS FINAL SUMMARY ===
   Total: 50
   Via OSM: ~35
   Via DOC: ~12
   Via LINZ: ~2
   Manual needed: ~1
   ```
  </action>
  <verify>
Count total successful NZ trails across both batches. At least 48/50 (up from previous 42 target, since DOC/LINZ fallback covers the gap). All 9 Great Walks present. Both islands represented. Run deduplication -- no internal duplicates. Print source breakdown.
  </verify>
  <done>
50 NZ trails fetched. At least 48 have real data from OSM or DOC/LINZ fallback. All Great Walks included. Both islands well-represented. Source attribution recorded. Failures (likely 0-2) documented -- these would be genuinely obscure routes not in any source.
  </done>
</task>

</tasks>

<verification>
1. nz-trails.json contains exactly 50 trail entries
2. All 9 DOC Great Walks are present and successful
3. At least 96% success rate combining OSM + DOC/LINZ fallback (up from 84% OSM-only)
4. Each trail result includes `dataSource` field
5. Both North Island and South Island have meaningful representation
6. No duplicate trails (especially Tongariro Alpine Crossing vs Northern Circuit handled correctly)
7. All trail entries have officialDistanceKm populated
</verification>

<success_criteria>
- 50 New Zealand trails curated with at least 48 having real data (OSM + DOC/LINZ fallback)
- All 9 DOC Great Walks successfully fetched
- Each successful trail has 50-200 simplified coordinate points
- Each trail records its data source for attribution
- Distance validation completed for all successful trails
- Both North Island and South Island represented
- Only trails that exhausted ALL sources (OSM + DOC + LINZ) are flagged as failures
</success_criteria>

<output>
After completion, create `.planning/phases/10-real-trail-data/10-04b-SUMMARY.md`
</output>
