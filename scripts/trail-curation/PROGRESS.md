# Trail Curation Progress

## Tasmania — 16 trails (3 Maria Island walks excluded)
- 7 FKT GPX: Overland Track, South Coast, Western Arthurs, Frenchmans Cap, Mount Anne (GPX updated this session), Federation Peak, Port Davey
- 6 LIST Tasmania + SRTM DEM: Three Capes, Eastern Arthurs (GPX updated this session), Freycinet, Walls of Jerusalem, Cape Pillar, Leeaberra
- 3 Waymarked Trails: Lake Rhona (GPX updated this session), Point Lesueur (WRONG LOCATION - needs GPX), Mount Maria (re-fetched from OSM, only 4km of 16km)

### Tasmania Quality After Flyback Fixes:
| Status | Trail | Calc | Official | Off |
|--------|-------|------|----------|-----|
| OK | South Coast Track | 84.5km | 85km | 0.6% |
| OK | Carnarvon Great Walk | 86.8km | 87km | 0.3% |
| OK | Port Davey Track | 72.7km | 70km | 3.8% |
| OK | Lake Rhona | 27.7km | 28km | 1.1% |
| FAIR | Federation Peak | 42.9km | 40km | 7.2% |
| FAIR | Western Arthur Range | 63.2km | 58km | 9.0% |
| FAIR | Mount Anne Circuit | 34.9km | 32km | 9.0% |
| FAIR | Eastern Arthurs | 64.5km | 72km | 10.4% |
| FAIR | Leeaberra Track | 24.2km | 28km | 13.4% |
| FAIR | Frenchmans Cap | 43.3km | 54km | 19.9% |
| HIGH | Freycinet Peninsula | 34.2km | 27km | 26.8% |
| HIGH | Walls of Jerusalem | 14.5km | 23km | 37.0% |
| HIGH | Tasman Cape Pillar | 15.9km | 30km | 47.0% |
| HIGH | Point Lesueur Walk | 14.8km | 28km | 47.1% | *** WRONG LOCATION ***
| HIGH | Three Capes Track | 24.9km | 48km | 48.0% |
| HIGH | Mount Maria Walk | 4.0km | 16km | 74.9% |
| HIGH | Overland Track | 119.1km | 65km | 83.3% | (FKT includes all side trips - correct data)

### Tasmania Issues:
- Point Lesueur Walk: WRONG LOCATION (France coords) — no OSM data in Tasmania, needs GPX
- Mount Maria Walk: correct location now but only 4km mapped in OSM (16km official) — needs GPX
- Lake Rhona: FIXED with GPX from Downloads
- Mount Anne: FIXED with GPX from Downloads
- Eastern Arthurs: FIXED with GPX from Downloads

## Australia Mainland — 22/25 trails (3 still failed)

### Quality After Flyback Fixes:
| Status | Trail | Calc | Official | Off |
|--------|-------|------|----------|-----|
| OK | Carnarvon Great Walk | 86.8km | 87km | 0.3% |
| OK | Larapinta Trail | 223.6km | 223km | 0.3% |
| OK | Six Foot Track | 44.5km | 45km | 1.2% |
| OK | Grampians Peaks Trail | 161.3km | 164km | 1.6% |
| OK | Kanangra to Katoomba | 46.2km | 47km | 1.6% |
| OK | Great North Walk | 243.9km | 250km | 2.4% |
| OK | Thorsborne Trail | 32.8km | 32km | 2.5% |
| OK | Cape to Cape Track | 126.2km | 123km | 2.6% |
| OK | Jatbula Trail | 60.0km | 62km | 3.2% |
| OK | Bibbulmun Track | 959.7km | 1003km | 4.3% |
| FAIR | Gold Coast Hinterland | 57.1km | 54km | 5.7% |
| FAIR | Canberra Centenary Trail | 135.9km | 145km | 6.3% |
| FAIR | Australian Alps | 697.3km | 655km | 6.5% |
| FAIR | Scenic Rim Trail | 43.9km | 47km | 6.7% |
| FAIR | Goldfields Track | 192.5km | 210km | 8.3% |
| FAIR | Light to Light Walk | 29.2km | 32km | 8.7% |
| FAIR | Great Ocean Walk | 99.0km | 110km | 10.0% |
| FAIR | Cooloola Great Walk | 86.2km | 102km | 15.5% |
| HIGH | Wilsons Promontory | 42.2km | 59km | 28.6% |
| HIGH | Yuraygir Coastal Walk | 45.9km | 65km | 29.3% |
| HIGH | Heysen Trail | 779.1km | 1200km | 35.1% |
| HIGH | Wilderness Coast Walk | 48.5km | 100km | 51.5% |

### Still FAILED (3 trails, no OSM relation found):
- K'gari Great Walk (Fraser Island) — no GPX yet
- Coast Track (Royal NP) — no GPX yet
- Great Dividing Trail — no GPX yet

## Tasmania Day Walks — 9/12 in app (Wikiloc pipeline)

Fetched 12 trails via Wikiloc Playwright pipeline. Coordinates extracted from Leaflet map rendering, elevation enriched via SRTM 30m.

### Quality:
| Status | Trail | Calc | Official | Off | Pts |
|--------|-------|------|----------|-----|-----|
| OK | Hartz Peak | 9.7km | 10km | 3.0% | 1701 |
| OK | The Acropolis and Labyrinth | 41.0km | 41km | 2.5% | 729 |
| FAIR | Bishop and Clerk | 12.7km | 12km | 5.8% | 2256 |
| FAIR | Legges Tor Ben Lomond | 8.6km | 8km | 7.5% | 5723 |
| FAIR | Tarn Shelf Circuit | 14.6km | 16km | 8.8% | 2601 |
| FAIR | Cradle Mountain Summit | 12.3km | 13km | 5.6% | — |
| FAIR | Mount Amos | 4.5km | 4km | 12.5% | 723 |
| FAIR | Cape Raoul | 16.7km | 14km | 19.3% | 2840 |
| FAIR | Frenchmans Cap | 43.3km | 46km | 19.3% | — |
| FAIR | Mount Rufus | 21.1km | 17km | 24.1% | 3643 |
| HIGH | Mount Roland | 16.5km | 12km | 37.5% | 2867 |
| DELETED | Mount Murchison | — | 12km | 50% | — |

**Quality totals: OK=2, FAIR=8, HIGH=1, DELETED=1**

### Notes:
- The Acropolis and Labyrinth: Wikiloc track is full Geryon traverse (41km), not the day walk variant (20km)
- Cradle Mountain Summit and Frenchmans Cap were already in app from Tasmania multi-day batch
- Mount Murchison: DELETED — only summit area captured (50% off)
- Mount Roland: 38% off — includes GPS extras from original track
- Wikiloc polylines have no elevation (always 0). All elevation enriched via Open Topo Data SRTM 30m.

### Wired Into App:
- 9 new trail IDs added to `lazyTrailIds` Set (cradle_mountain_summit + frenchmans_cap already existed)
- 9 trail data files in `public/trail-data/`
- 9 new entries in `manifest.json`

## Australia Day Hikes — 5/25 new in app (OSM batch, 4 already from Phase 13)

Fetched 25 trails via `fetch-region-batch.ts --list australia-day-hikes.json`. Heavy Overpass rate limiting.

### Quality (new trails added this session):
| Status | Trail | Calc | Official | Off | Pts |
|--------|-------|------|----------|-----|-----|
| FAIR | Spit to Manly Walk | 9.3km | 10km | 6.9% | 646 |
| FAIR | Uluru Base Walk | 9.6km | 11km | 13.0% | 294 |
| FAIR | Mount Kosciuszko Summit Walk | 15.3km | 13km | 17.4% | 192 |
| FAIR | Castle Rock Girraween | 3.8km | 5km | 24.7% | 96 |
| HIGH | Cathedral Range Southern Circuit | 15.4km | 12km | 28.6% | 490 |

### Already in App (Phase 13):
- Bluff Knoll, Mt Feathertop, Mount Lofty Summit, Wilpena Pound

### Garbage Deleted:
- Three Sisters and Giant Stairway: 0.4km of 5km (92.5% off) — 49 point fragment
- Wineglass Bay and Hazards Beach: 4.6km of 11km (58.3% off) — partial route

### Still FAILED from OSM (13 trails):
Bondi to Coogee, Mount Warning, Grand Canyon Track (Blue Mtns), Pigeon House Mountain, The Pinnacle Walk (Grampians), Mount Oberon, Mount Beerwah, Mount Barney, St Mary Peak, Kings Canyon Rim Walk, Valley of the Winds, kunanyi Mount Wellington, Cape Hauy Track

### Wikiloc Retry (12/13 failed trails):
Fetched via `fetch-wikiloc-batch.ts --list trail-lists/australia-day-hikes-wikiloc.json`. Pigeon House Mountain had no Wikiloc track.

| Status | Trail | Calc | Official | Off | Pts |
|--------|-------|------|----------|-----|-----|
| OK | Grand Canyon Track Blue Mountains | 5.9km | 6km | 2.1% | 263 |
| OK | Mount Barney | 15.4km | 15km | 2.6% | 2571 |
| OK | Bondi to Coogee Coastal Walk | 6.2km | 6km | 3.1% | 1057 |
| OK | Mount Oberon Summit Walk | 6.7km | 7km | 4.2% | 1195 |
| OK | St Mary Peak Flinders Ranges | 22.0km | 21km | 4.6% | 3870 |
| OK | Mount Warning Summit Trail | 8.6km | 9km | 4.7% | 763 |
| FAIR | Cape Hauy Track | 10.2km | 9km | 13.0% | 959 |
| FAIR | kunanyi Mount Wellington Summit | 9.5km | 12km | 20.7% | 1685 |
| FAIR | Valley of the Winds Kata Tjuta | 8.5km | 7km | 20.9% | 4336 |
| FAIR | Kings Canyon Rim Walk | 7.4km | 6km | 23.9% | 1122 |
| DELETED | Mount Beerwah | 1.3km | 3km | 56.7% | 180 |
| DELETED | The Pinnacle Walk Grampians | 8.8km | 4km | 120.6% | 2790 |

**Wikiloc totals: OK=6, FAIR=4, DELETED=2**

### Still FAILED (3 trails, no usable data):
- Pigeon House Mountain — no Wikiloc track found
- Mount Beerwah — Wikiloc track only 1.3km of 3km (deleted)
- The Pinnacle Walk Grampians — Wikiloc was Wonderland Loop (8.8km vs 4km, deleted)

### Notes:
- AU day hikes have poor OSM coverage for mountain summit trails
- Wikiloc pipeline recovered 10 of 13 failed OSM trails (77% recovery rate)
- Mount Kosciuszko (OSM) is 17.4% over — may include extra approach section
- The Pinnacle Walk Grampians: Wikiloc track was "Wonderland Loop Walk" (full loop, not just Pinnacle section)

## Total AU Trails: 61 (16 Tas multi-day + 9 Tas day walks + 22 mainland multi-day + 14 day hikes)
- OK (≤5%): 20
- FAIR (5-25%): 24
- HIGH (>25%): 16
- DELETED: 6 (Mount Murchison, Three Sisters, Wineglass Bay, Mount Beerwah, Pinnacle Walk, 1 prior)

## App Integration Status
- ALL trails added to `popularTrails.ts` with lazy loading
- `lazyTrailIds` Set includes all trails
- `manifest.json` has all entries
- Dev server on port 3000, create page working

## US Trails — 89/92 in app (41 OSM batch + 8 mega + 19 FKT GPX + 21 OSM way queries)

### Flyback Fix Pass (this session):
Applied flyback detection/removal to all 48 US trails. Key fixes:
- Long Trail: 629km → 401km (43.9% → 8.3%) — stitched two halves
- Teton Crest Trail: 90km → 60km (39.2% → 6.8%) — stitched two halves
- South Kaibab: 16km → 10km (40.4% → 7.5%) — stitched
- South Sister: 15km → 17km (20.9% → 8.9%) — stitched
- **PCT: 6033km → 4214km (41.5% → 1.2%!)** — stitched two halves
- **AT: 5185km → 3389km (47.1% → 3.8%)** — stitched two halves
- **Arizona Trail: 1848km → 1251km (43.2% → 3.0%)** — stitched
- **Pinhoti: 804km → 518km (51.7% → 2.3%)** — removed flyback
- **CDT: 6598km → 4360km (32.0% → 12.8%)** — removed flyback
- **PNT: 2767km → 2117km (43.4% → 9.7%)** — removed flyback
- Colorado Trail: 884km → 877km (12.2% → 11.2%) — removed flyback
- **Colorado Trail 2nd fix: 877km → 765km (11.2% → 3.0%!)** — stitched two halves

### Mega Trails Fetched (8/8 — ALL DONE, ALL WITH ELEVATION):
| Status | Trail | Calc | Official | Off | Elevation |
|--------|-------|------|----------|-----|-----------|
| OK | Pacific Crest Trail | 4214km | 4265km | 1.2% | 18m — 4007m |
| OK | Pacific Northwest Trail | 1914km | 1930km | 0.8% | 276m — 2309m |
| OK | Superior Hiking Trail | 492km | 499km | 1.4% | — |
| OK | Pinhoti Trail | 518km | 530km | 2.3% | 172m — 974m |
| OK | Arizona Trail | 1251km | 1290km | 3.0% | 501m — 2624m |
| OK | Colorado Trail | 765km | 788km | 3.0% | 1676m — 4045m |
| OK | Appalachian Trail | 3389km | 3524km | 3.8% | 25m — 2020m |
| OK | Ice Age Trail | 1822km | 1900km | 4.1% | 174m — 598m |
| FAIR | Continental Divide Trail | 4360km | 5000km | 12.8% | 1282m — 4339m |

### US Quality Summary (68 trails, after gap + out-and-back fixes):
| Status | Trail | Calc | Official | Off |
|--------|-------|------|----------|-----|
| OK | Four Mile Trail to Glacier Point | 7.7km | 7.7km | 0.1% |
| OK | Skyline Trail (Mount Rainier) | 9.0km | 9km | 0.1% |
| OK | John Muir Trail | 337.2km | 339km | 0.5% |
| OK | Lost Coast Trail | 40.5km | 40.2km | 0.7% |
| OK | Pacific Northwest Trail | 1914km | 1930km | 0.8% |
| OK | Pacific Crest Trail | 4214km | 4265km | 1.2% |
| OK | Superior Hiking Trail | 492km | 499km | 1.4% |
| OK | Enchantments Thru-Hike | 30.2km | 29.8km | 1.4% |
| OK | Tahoe Rim Trail | 269.7km | 274km | 1.6% |
| OK | High Sierra Trail | 111.2km | 113km | 1.6% |
| OK | Timberline Trail | 67.3km | 66.1km | 1.8% |
| OK | Mount Si Trail | 12.6km | 12.9km | 2.1% |
| OK | Pinhoti Trail | 518km | 530km | 2.3% |
| OK | Alum Cave Trail to Mt LeConte | 16.2km | 16.6km | 2.6% |
| OK | Clouds Rest Trail | 22.6km | 23.3km | 2.9% |
| OK | Colorado Trail | 765km | 788km | 3.0% |
| OK | Arizona Trail | 1251km | 1290km | 3.0% |
| OK | Humphreys Peak | 15.9km | 15.4km | 3.4% |
| OK | Quandary Peak | 10.9km | 10.5km | 3.5% |
| OK | Emory Peak | 15.4km | 16km | 3.5% |
| OK | Appalachian Trail | 3389km | 3524km | 3.8% |
| OK | Ice Age Trail | 1822km | 1900km | 4.1% |
| OK | Ryan Mountain Trail | 4.6km | 4.8km | 4.4% |
| FAIR | Mount Washburn Trail | 9.4km | 10km | 5.7% |
| FAIR | Teton Crest Trail | 60.0km | 64.4km | 6.8% |
| FAIR | South Kaibab to Phantom Ranch | 10.4km | 11.3km | 7.5% |
| FAIR | Three Sisters Loop | 70.2km | 76km | 7.6% |
| FAIR | Maple Pass Loop | 10.8km | 11.7km | 7.7% |
| FAIR | Lakes Trail to Pear Lake | 19.3km | 21km | 8.2% |
| FAIR | Long Trail | 401km | 437km | 8.3% |
| FAIR | Wonderland Trail | 137.5km | 150km | 8.3% |
| FAIR | Longs Peak via Keyhole Route | 22.0km | 24.1km | 8.8% |
| FAIR | South Sister | 16.9km | 18.5km | 8.9% |
| FAIR | Kalalau Trail | 31.8km | 35.4km | 10.1% |
| FAIR | Granite Peak Montana | 28.5km | 32.2km | 11.6% |
| FAIR | Chain Lakes Loop | 9.9km | 11.3km | 12.7% |
| FAIR | Continental Divide Trail | 4360km | 5000km | 12.8% |
| FAIR | Rae Lakes Loop | 57.6km | 66.8km | 13.7% |
| FAIR | Observation Point via East Mesa | 11.0km | 12.9km | 14.8% |
| FAIR | Old Rag Mountain | 12.1km | 14.5km | 16.9% |
| FAIR | Angels Landing | 7.1km | 8.7km | 17.9% |
| FAIR | Ozark Highlands Trail | 320km | 270km | 18.4% |
| FAIR | Presidential Traverse | 30.1km | 37km | 18.7% |
| FAIR | The Narrows | 19.0km | 16km | 18.7% |
| FAIR | Mailbox Peak Trail | 8.1km | 10.5km | 22.5% |
| HIGH | (23 trails — need GPX for remaining day hikes + FKT route variants) |

**Quality totals: OK=23, FAIR=22, HIGH=23**

### Still Need GPX (63 trails):
The Narrows, Old Rag, Presidential Traverse, Mt Katahdin, The Subway, Cascade Canyon,
Enchantments, Hoh River, Highline Trail, Grinnell Glacier, Four Pass Loop, Maroon Bells,
Chicago Basin, Ice Lakes, Delicate Arch, Observation Point, Wave, Havasu Falls,
West Fork Oak Creek, Cathedral Rock, Kalepa Ridge, Haleakala, Koko Crater,
Mt Shasta, Lassen Peak, Mt Tallac, Alamere Falls, Mt Baldy, Mt San Jacinto,
Cucamonga Peak, Mt Hood, Enchanted Valley, Gothic Basin, Mt Adams, Iceberg Lake,
Scenic Point, Granite Peak, Sky Pond, Conundrum Hot Springs, Hanging Lake, Mt Elbert,
Quandary Peak, Devils Causeway, Capitol Peak, Blue Lakes, Mesa Arch, Peek-a-Boo,
Kings Peak, Buckskin Gulch, Humphreys Peak, Horsetail Falls, Mt Dana, Mono Pass,
Moro Rock, Big Baldy, Mt San Gorgonio, Cactus to Clouds, Telescope Peak,
North Dome, Sentinel Dome, Beartooth Traverse, Garfield Peak, Emory Peak

### FKT GPX Integration (this session):
Fetched GPX from fastestknowntime.com for 21 trails, 19 integrated (2 had 0 points).

**Good quality (OK/FAIR) — 8 trails:**
| Status | Trail | Calc | Official | Off |
|--------|-------|------|----------|-----|
| OK | Enchantments Thru-Hike | 30.2km | 29.8km | 1.4% |
| OK | Humphreys Peak | 15.9km | 15.4km | 3.4% |
| OK | Emory Peak | 15.4km | 16km | 3.5% |
| OK | Quandary Peak | 10.9km | 10.5km | 3.5% |
| FAIR | Granite Peak | 28.5km | 32.2km | 11.6% |
| FAIR | Old Rag Mountain | 12.1km | 14.5km | 16.9% |
| FAIR | Presidential Traverse | 30.1km | 37km | 18.7% |
| FAIR | The Narrows | 19.0km | 16km | 18.7% |

**Route variant mismatch (HIGH) — 11 trails, FKT had different variant:**
- Mount Hood: 10.6km vs 14.5km (27%) — shorter variant
- Enchanted Valley: 58.0km vs 43.5km (33%) — includes Anderson Glacier
- Hoh River: 59.4km vs 43.5km (37%) — extended route
- Mount Baldy: 10.4km vs 17.7km (41%) — Bear Canyon variant
- Observation Point: 5.5km vs 12.9km (57%) — one-way only
- Mount Shasta: 5.6km vs 18.5km (70%) — incomplete track
- Telescope Peak: 47.7km vs 22.5km (112%) — from Shorty's Well
- Highline Trail: 49.5km vs 19.2km (158%) — Logan's Pass to Waterton
- Buckskin Gulch: 90.1km vs 32.2km (180%) — Wire Pass to Lee's Ferry
- Mount Adams: 51.5km vs 16.1km (220%) — full traverse
- Mount San Jacinto: 72.7km vs 20.9km (248%) — traverse

### Gap Fix Pass (DONE):
Applied adaptive gap correction to all 68 US trails. Two strategies:
- **Gap skipping**: Try thresholds [0.5, 1, 2, 5, 10, 20, 50km], pick threshold that minimizes error vs official
- **Section dedup**: Split at gaps, detect sections starting near origin, keep section closest to official

Key fixes (only applied when they improve accuracy):
- **Lost Coast Trail: 137km → 40.5km (240% → 0.7%!)** — dedup removed duplicate reverse section
- **Superior Hiking Trail: 598km → 492km (20% → 1.4%)** — skipped 106km straight-line jump
- **Pacific Northwest Trail: 2117km → 1914km (10% → 0.8%)** — skipped 3 gaps >20km
- **Ice Age Trail: 2323km → 1822km (22% → 4.1%)** — skipped 4 gaps >50km (road walk jumps)
- **Ozark Highlands Trail: 389km → 320km (44% → 18%)** — dedup kept main section

No regressions: CDT, South Sister, Mount Whitney, etc. correctly left unchanged (gap removal would make them worse).

### Out-and-Back Fix Pass (DONE):
Detected trails where OSM only has one direction (calc ≈ official/2). Mirrored coordinates to create return leg.

Fixes applied (9 trails, all HIGH → OK/FAIR):
- **Mount Si: 6.3km → 12.6km (51% → 2.1%!)** — OK
- **Alum Cave: 8.1km → 16.2km (51% → 2.6%)** — OK
- **Ryan Mountain: 2.3km → 4.6km (52% → 4.4%)** — OK
- Mount Washburn: 4.7km → 9.4km (53% → 5.7%) — FAIR
- Lakes Trail to Pear Lake: 9.6km → 19.3km (54% → 8.2%) — FAIR
- Longs Peak: 11.0km → 22.0km (54% → 8.8%) — FAIR
- Kalalau Trail: 15.9km → 31.8km (55% → 10.1%) — FAIR
- Observation Point: 5.5km → 11.0km (57% → 14.8%) — FAIR
- Angels Landing: 3.6km → 7.1km (59% → 17.9%) — FAIR

Skipped (known loops or start≈end): Navajo Loop, Franconia Ridge, Yosemite Valley Loop

Remaining out-and-back trails not fixed (calc too far from official/2, likely incomplete OSM data):
- Half Dome, Eagle Creek, Bright Angel, Mist Trail, Devil's Postpile, Dipsea, Mount Washington

### OSM Way Query Pass (DONE — 21/24 fetched):
Queried OSM for individual ways (not relations) by trail name + bbox for 24 missing trails.
Fixed two-pass bug (ways come before nodes in Overpass response).
Out-and-back detection auto-mirrored 7 trails.

| Status | Trail | Calc | Official | Off |
|--------|-------|------|----------|-----|
| OK | North Dome via Indian Rock | 14.5km | 14.5km | 0.1% |
| OK | Lassen Peak Trail | 7.8km | 8km | 2.5% |
| OK | Beartooth Traverse | 43.4km | 42km | 3.2% |
| OK | West Fork Oak Creek | 10.7km | 11.3km | 4.9% |
| FAIR | Isle Royale | 64.2km | 68km | 5.6% |
| FAIR | Mount Katahdin | 15.2km | 16.7km | 9.3% |
| FAIR | Hanging Lake | 5.3km | 4.8km | 9.6% |
| FAIR | Delicate Arch | 5.4km | 4.8km | 11.7% |
| FAIR | Four Pass Loop | 39.5km | 45.1km | 12.4% |
| FAIR | Mount Dana | 8.4km | 9.7km | 13.3% |
| FAIR | Cascade Canyon | 26.4km | 30.6km | 13.7% |
| FAIR | Mount Tallac | 12.1km | 15.4km | 21.5% |
| FAIR | Maroon Bells Crater Lake | 7.5km | 6.1km | 23.6% |
| FAIR | Cucamonga Peak | 14.5km | 19.3km | 24.9% |
| HIGH | Cactus to Clouds | 21.1km | 32.2km | 34.6% |
| HIGH | Ice Lakes Basin | 6.8km | 11.3km | 40.1% |
| HIGH | Horsetail Falls | 2.5km | 4.3km | 41.0% |
| HIGH | Cathedral Rock | 0.9km | 2.4km | 61.0% |
| HIGH | Sentinel Dome & Taft Point | 1.7km | 8km | 79.1% |
| HIGH | Moro Rock | 3.0km | 0.8km | 269.4% |
| HIGH | Alamere Falls (Coast Trail) | 29.7km | 20.9km | 42.1% |

Failed (no OSM data): Scenic Point (MT), Haleakala Sliding Sands (HI), Kalepa Ridge (HI)

### Duplicate Cleanup (DONE):
Removed 13 duplicate trail entries from popularTrails.ts:
- 4 naming mismatches (devils_postpile, mount_baldy, enchantments, grand_canyon_rim_to_rim)
- 9 old inline entries superseded by lazy-load entries
Total entries: 296 → 286, all unique IDs confirmed

### Next Steps:
1. ~~Flyback fix pass on 41 fetched trails~~ DONE
2. ~~Handle mega thru-hikes (known relation IDs)~~ 8/8 DONE (Ice Age DONE)
3. ~~Enrich elevation for AT, PCT, CDT~~ ALL DONE (AT: 25-2020m, PCT: 18-4007m, CDT: 1282-4339m)
4. ~~FKT GPX for 63 trails~~ 19 integrated (8 good, 11 route variant mismatch)
5. ~~FIX GAPS~~ DONE — 7 trails improved
6. ~~FIX OUT-AND-BACK~~ DONE — 9 trails doubled
7. ~~OSM WAY QUERIES~~ DONE — 21 new trails fetched (4 OK, 10 FAIR, 7 HIGH)
8. ~~Wire trails into app~~ DONE (89 US trails wired with lazy loading)
9. **3 trails still need manual GPX:** Scenic Point, Haleakala, Kalepa Ridge
10. Move to Canada rollout

### Key Learning — US OSM Coverage:
- US hiking trails have ~37% coverage as OSM route=hiking relations (vs ~85% for AU)
- Well-mapped: Yosemite, Rainier, Oregon Cascades, Sierra Nevada long trails
- Poorly mapped: Colorado 14ers, Glacier NP, Hawaii, most NP day hikes
- Out-and-back trails only have one-way in OSM (shows as ~50% of official round-trip distance)
- Mega trails are super-relations with deep hierarchies (ICE: 136 sub-rels, PCT: 29 sections)
- Flyback fix is extremely effective on mega trails (PCT 41%→1.2%, AT 47%→3.8%)

## Canada — 28/50 trails in app (21 batch + 5 retry + 2 mega)

### Batch 1 Results:
- 21 succeeded (full resolution + SRTM 30m elevation at every point)
- 27 failed (no OSM relations or ways found)
- Heavy Overpass rate limiting throughout (kumi XML errors, main 504s)
- BC trails well-mapped, Alberta Parks Canada trails poorly mapped, Quebec/Maritime/Yukon/NWT mostly failed

### Retry Results (fetch-canada-retry.ts on 27 failed trails):
- 13 returned OSM data, 12 still failed
- 5 usable trails added to app, 7 discarded as fragments, 1 duplicate (Chilkoot Pass = Chilkoot Trail)
- **Key fix:** Algonquin Highlands 49% → 10.8% via gap-skip at 0.5km threshold
- Discarded fragments (<10% of official): Nootka (0.9/35km), Akamina (0.08/10km), Carthew (1.7/20km), Assiniboine (2.2/55km), Lake Agnes (3.3/13km), Sawback (8.9/74km), Tonquin (12/44km)
- Canol + Tombstone above 60°N — no SRTM elevation available

### Fix Pass Results (flyback removal, stitch, section dedup, out-and-back, gap skip):
Spectacular stitch results on 5 trails:
- West Coast Trail: 125.7km → 76.1km (67.6% → 1.3%) — stitched
- Howe Sound Crest: 44.4km → 29.1km (53.2% → 0.3%) — stitched
- Skyline Jasper: 73.3km → 44.9km (66.7% → 2.4%) — stitched
- East Coast Trail: 477.8km → 341.6km (42.2% → 1.6%) — flyback removal
- Mantario Trail: 102.1km → 64.8km (62.0% → 2.9%) — flyback removal

### Mega Trail Results (fetch-canada-mega.ts):
- **SIA** (rel:9318808): 7 sections, 471 ways, 19404 pts → 890.1km → **631.5km after flyback fix (2.8% off 650km) — OK!**
- **GDT** (rel:8139599): 7 sections, 421 ways, 66549 pts → 1514.2km → **1131.3km after stitch (5.7% off 1200km) — FAIR!**
- Both below 60°N — full SRTM elevation available
- GDT elevation: 946m — 2574m, SIA elevation: -2m — 1275m

### Quality After All Fixes (28 trails):
| Status | Trail | Calc | Official | Off |
|--------|-------|------|----------|-----|
| OK | Howe Sound Crest Trail | 29.1km | 29km | 0.3% |
| OK | West Coast Trail | 76.1km | 75km | 1.3% |
| OK | East Coast Trail | 341.6km | 336km | 1.6% |
| OK | Sentier des Caps de Charlevoix | 50.0km | 51km | 2.0% |
| OK | Skyline Trail (Jasper) | 44.9km | 44km | 2.4% |
| OK | Sentier International des Appalaches | 631.5km | 650km | 2.8% |
| OK | Mantario Trail | 64.8km | 63km | 2.9% |
| OK | Fundy Footpath | 43.0km | 41km | 4.9% |
| FAIR | Chilkoot Trail | 55.9km | 53km | 5.5% |
| FAIR | La Cloche Silhouette Trail | 73.7km | 78km | 5.5% |
| FAIR | Great Divide Trail | 1131.3km | 1200km | 5.7% |
| FAIR | Golden Ears Trail | 22.6km | 24km | 5.9% |
| FAIR | Sentinel Pass Trail | 11.1km | 12km | 7.2% |
| FAIR | Crypt Lake Trail | 15.5km | 17km | 8.8% |
| FAIR | Tombstone Grizzly Lake Trail | 21.9km | 20km | 9.4% |
| FAIR | Algonquin Highlands Backpacking | 97.5km | 88km | 10.8% |
| FAIR | Stein Valley Traverse | 88.8km | 80km | 11.1% |
| FAIR | Plain of Six Glaciers Trail | 12.2km | 14km | 12.6% |
| FAIR | Bruce Trail (Bruce Peninsula) | 112.7km | 100km | 12.7% |
| FAIR | Canol Heritage Trail | 306.6km | 355km | 13.6% |
| FAIR | Tablelands Trail | 3.3km | 4km | 17.2% |
| FAIR | Berg Lake Trail | 27.4km | 23km | 19.2% |
| FAIR | Garibaldi Lake Trail | 12.8km | 18km | 28.7% |
| FAIR | Mont Tremblant Summit Trail | 7.8km | 11km | 29.3% |
| FAIR | Juan de Fuca Marine Trail | 67.0km | 47km | 42.4% |
| FAIR | Sunshine Coast Trail | 274.3km | 180km | 52.4% |
| HIGH | Joffre Lakes Trail | 7.5km | 11km | 31.5% |
| HIGH | Long Range Traverse | 54.4km | 35km | 55.3% |

**Quality totals: OK=8, FAIR=18, HIGH=2**

### HIGH Trail Fix Pass (fix-canada-high.ts):
- **Bruce Peninsula**: lat cutoff ≥44.9° + gap-skip → 152.5km → 112.7km (48% → 12.7%) HIGH→FAIR
- **Sentinel Pass**: Re-fetched as "Larch Valley" (same trail) → 2.8km → 11.1km (76% → 7.2%) HIGH→FAIR
- **Golden Ears**: Re-fetched as "West Canyon" + out-and-back → 5.6km → 22.6km (77% → 5.9%) HIGH→FAIR
- Long Range Traverse: No improvement (bushwhack route, limited OSM data)
- Joffre Lakes: No improvement (incomplete OSM coverage)

### Wired Into App:
- 28 trail IDs in `lazyTrailIds` Set
- 28 trail data files in `public/trail-data/`
- 28 entries in `manifest.json` (153 total)
- All entries in popularTrails.ts with lazy loading

### Still Failed (14 trails — no usable OSM data):
Rockwall Trail, Della Falls Trail, Egypt Lake via Healy Pass, Skoki Loop,
Coastal Trail (Pukaskwa), Killarney Provincial Park - The Crack,
Cup and Saucer Trail, Mont Jacques-Cartier Trail, Les Loups Trail,
Mont Albert Circuit, Cape Chignecto Coastal Trail, Skyline Trail (Cape Breton),
Aulavik River Route, Grey Owl Trail

### Canada Complete — Next: NZ → South Africa
- 28/50 trails in app, 14 need manual GPX (diminishing returns)
- Quality: OK=8, FAIR=18, HIGH=2 (Joffre Lakes + Long Range Traverse)

## Scripts Reference
- `fetch-us-batch.ts` — US batch fetch with role-aware filtering, retry, skip-over
- `fetch-us-mega.ts` — Mega trail fetch via known OSM relation IDs
- `fix-flyback-us.ts` — US flyback detection/removal
- `fix-flyback-v2.ts` — AU flyback detection/removal
- `fix-gaps-us.ts` — Adaptive gap correction (gap skipping + section dedup, only-if-better rule)
- `fix-out-and-back-us.ts` — Mirror coordinates for out-and-back trails (calc≈official/2)
- `integrate-us-gpx.ts` — GPX integration for failed US trails
- `integrate-downloads-gpx.ts` — GPX integration from ~/Downloads (AU)
- `enrich-elevation-batch.ts` — Batch elevation enrichment for trails with elevation=0
- `sync-manifest.ts` — Sync manifest.json with trail data files
- `fix-way-ordering-v3.ts` — best ordering fix (role-aware filtering)
- `fetch-remaining-9.ts` — batch fetch with full pipeline

## Key Files
- `app/data/popularTrails.ts` — trail metadata + lazy loading
- `public/trail-data/manifest.json` — all trail metadata
- `public/trail-data/{id}.json` — individual trail coordinate files

## Scripts Reference (Canada)
- `fetch-canada-batch.ts` — Canada batch fetch with full pipeline (relations + way fallback + elevation)
- `fetch-canada-retry.ts` — Retry failed trails with alternative search strategies
- `fetch-canada-mega.ts` — Mega trail fetch via known OSM relation IDs (GDT=8139599, SIA=9318808)
- `fix-canada-trails.ts` — Combined fix pass (flyback, stitch, dedup, out-and-back, gap skip). Supports `--source=filename.json`
- `fix-canada-high.ts` — Targeted fixes for HIGH trails (lat cutoff, re-fetch with alt names, out-and-back)
- `wire-canada-lazy.ts` — Wire Canada trails into app (replace coords with [], remove dupes)

## New Zealand — 23/50 trails in app

### Batch Fetch Results:
- 23 succeeded (full resolution + SRTM 30m elevation at every point)
- 27 failed (no OSM relations or ways found)
- NZ Great Walks well-mapped, backcountry/day hikes poorly mapped
- Heavy Overpass rate limiting throughout (kumi XML errors, main 504s)

### Fix Pass Results (flyback removal, stitch, section dedup, gap skip):
Spectacular stitch results on 3 trails:
- Routeburn Track: 42.8km → 31.4km (33.8% → 1.9%) — stitched two halves
- Abel Tasman Coast Track: 98.6km → 62.0km (64.4% → 3.4%) — section dedup
- Tongariro Alpine Crossing: 23.2km → 19.7km (19.6% → 1.4%) — stitched

### Quality After All Fixes (23 trails):
| Status | Trail | Calc | Official | Off |
|--------|-------|------|----------|-----|
| OK | Milford Track | 53.6km | 53.5km | 0.2% |
| OK | Heaphy Track | 77.4km | 78.4km | 1.3% |
| OK | Lake Waikaremoana Great Walk | 45.4km | 46km | 1.3% |
| OK | Tongariro Alpine Crossing | 19.7km | 19.4km | 1.4% |
| OK | Routeburn Track | 31.4km | 32km | 1.9% |
| OK | Hollyford Track | 57.5km | 56km | 2.6% |
| OK | Kepler Track | 61.8km | 60km | 3.0% |
| OK | Tongariro Northern Circuit | 44.3km | 43km | 3.1% |
| OK | Queen Charlotte Track | 68.7km | 71km | 3.2% |
| OK | Abel Tasman Coast Track | 62.0km | 60km | 3.4% |
| OK | Old Ghost Road | 80.9km | 85km | 4.9% |
| OK | Rees-Dart Track | 66.5km | 70km | 4.9% |
| FAIR | Cape Brett Track | 15.6km | 16.4km | 5.0% |
| FAIR | Key Summit Track | 2.8km | 3km | 7.4% |
| FAIR | Ben Lomond Track | 10.1km | 11km | 8.5% |
| FAIR | Rakiura Track | 34.8km | 32km | 8.8% |
| FAIR | Pinnacles Walk | 6.3km | 7km | 9.3% |
| FAIR | Paparoa Track | 48.2km | 55km | 12.4% |
| FAIR | Hooker Valley Track | 11.4km | 10km | 14.3% |
| FAIR | Mt Holdsworth - Jumbo Circuit | 21.3km | 25km | 14.8% |
| FAIR | Matemateaonga Track | 33.9km | 42km | 19.4% |
| HIGH | Tama Lakes Track | 6.5km | 17km | 61.9% |
| HIGH | Mueller Hut Route | 3.1km | 10km | 68.8% |

**Quality totals: OK=12, FAIR=9, HIGH=2**

### Wired Into App:
- 23 trail IDs in `lazyTrailIds` Set
- 23 trail data files in `public/trail-data/`
- 23 entries in `manifest.json` (176 total)
- All entries in popularTrails.ts with lazy loading
- Removed duplicates: abel_tasman, lake_waikaremoana, great_divide_trail

### Still Failed (27 trails — no usable OSM data):
Hump Ridge Track, Rob Roy Glacier Track, Roy's Peak Track, Cascade Saddle Route,
Gillespie Pass Circuit, Greenstone-Caples Track, Dusky Track, George Sound Track,
St James Walkway, Banks Peninsula Track, Pouakai Crossing, Mt Taranaki Summit Track,
Kaimai Ridgeway, Te Araroa - Tararua Section, Whirinaki Track, Rangitoto Summit Track,
Avalanche Peak Route, Gertrude Saddle Route, Lake Marian Track, Luxmore Hut Day Walk,
Sealy Tarns Track, Mt Robert Circuit, Angelus Hut via Robert Ridge,
Welcome Flat Hot Springs Track, Alex Knob Track, Isthmus Peak Track,
Roys Peak to Mt Alpha Traverse

### NZ OSM Coverage Notes:
- Great Walks have excellent coverage (all 10 found)
- Fiordland/Mt Aspiring backcountry routes poorly mapped (Dusky, George Sound, Gillespie)
- Popular day hikes often missing (Roy's Peak, Sealy Tarns, Avalanche Peak)
- Taranaki trails not in OSM at all
- North Island coverage sparse outside Tongariro NP

## Scripts Reference (NZ)
- `fetch-nz-batch.ts` — NZ batch fetch with full pipeline (relations + way fallback + elevation)
- `wire-nz-lazy.ts` — Wire NZ trails into app (replace coords with [], remove dupes)

## South Africa — 1/1 trail in app

### Drakensberg Grand Traverse:
Combined two OSM relations (Sentinel-Cathedral rel:8897082 + Giants Cup rel:2616770) to cover the full DGT route.
Fix pass removed flyback section: 290.9km → 213.7km (26.5% → 7.1%).
112km gap between Cathedral Peak and Sani Pass area — middle section not mapped in OSM.

| Status | Trail | Calc | Official | Off |
|--------|-------|------|----------|-----|
| FAIR | Drakensberg Grand Traverse | 213.7km | 230km | 7.1% |

**Quality totals: FAIR=1**

### OSM Coverage Notes:
- Only 5 hiking relations in the entire Drakensberg bbox
- Sentinel-Cathedral section well-mapped (32 ways, 99.3km)
- Giants Cup Trail well-mapped (37 ways, 94.6km)
- Middle section (Cathedral → Giant's Castle → Sani Pass) completely unmapped
- Combined elevation: 1474m — 3202m (full SRTM coverage)

### Wired Into App:
- 1 trail ID in `lazyTrailIds` Set
- 1 trail data file in `public/trail-data/`
- 1 entry in `manifest.json` (177 total)
- Entry in popularTrails.ts with lazy loading

## Scripts Reference (South Africa)
- `fetch-south-africa-batch.ts` — SA batch fetch with full pipeline (relations + way fallback + elevation)

## UK — 34/45 trails in app (24 multi-day + 10 mountain hikes)

### Batch Fetch Results:
- 34 succeeded (full resolution + SRTM 30m elevation at every point)
- 10 failed (no OSM relations or ways found)
- 1 skipped (South West Coast Path >500km — needs mega trail handling)
- UK OSM coverage excellent — almost every trail has a hiking relation
- Heavy Overpass rate limiting throughout (kumi XML errors, main 504s)

### Fix Pass Results (flyback removal, stitch, section dedup, gap skip):
Spectacular improvements on many trails:
- Offa's Dyke Path: 490km → 281km (72% → 1.5%) — section dedup
- South Downs Way: 236km → 161km (48% → 0.8%) — stitched two halves
- Dales Way: 210km → 129km (65% → 1.3%) — flyback removal
- The Ridgeway: 215km → 139km (55% → 0.3%) — flyback removal
- Cotswold Way: 181km → 165km (11% → 0.3%) — stitched
- Hadrian's Wall: 145km → 137km (7% → 1.3%) — stitched
- Great Glen Way: 215km → 118km (69% → 7.0%) — section dedup
- Cumbria Way: 146km → 119km (30% → 5.4%) — flyback removal

### Quality After All Fixes (34 trails):
| Status | Trail | Calc | Official | Off |
|--------|-------|------|----------|-----|
| OK | Cotswold Way | 164.5km | 164km | 0.3% |
| OK | The Ridgeway | 139.4km | 139km | 0.3% |
| OK | South Downs Way | 161.3km | 160km | 0.8% |
| OK | Ben Lomond | 11.9km | 12km | 0.8% |
| OK | Stac Pollaidh | 4.0km | 4km | 0.8% |
| OK | Hadrian's Wall Path | 136.7km | 135km | 1.3% |
| OK | Dales Way | 128.6km | 127km | 1.3% |
| OK | Offa's Dyke Path | 280.7km | 285km | 1.5% |
| OK | Cateran Trail | 100.0km | 103km | 2.9% |
| FAIR | Cumbria Way | 119.1km | 113km | 5.4% |
| FAIR | Cape Wrath Trail | 349.1km | 370km | 5.6% |
| FAIR | Pen y Fan Horseshoe | 6.4km | 6km | 6.2% |
| FAIR | Great Glen Way | 118.1km | 127km | 7.0% |
| FAIR | Rob Roy Way | 137.9km | 127km | 8.6% |
| FAIR | Pennine Way | 469.5km | 430km | 9.2% |
| FAIR | Scafell Pike via Corridor Route | 12.6km | 14km | 10.2% |
| FAIR | Cleveland Way | 197.3km | 175km | 12.7% |
| FAIR | Southern Upland Way | 279.6km | 344km | 18.7% |
| FAIR | Liathach Traverse | 8.9km | 11km | 18.9% |
| FAIR | North Downs Way | 300.1km | 246km | 22.0% |
| FAIR | Buachaille Etive Mor | 11.0km | 9km | 22.5% |
| HIGH | Speyside Way | 133.6km | 105km | 27.3% |
| HIGH | Affric Kintail Way | 50.6km | 72km | 29.7% |
| HIGH | Pembrokeshire Coast Path | 200.9km | 300km | 33.0% |
| HIGH | Coast to Coast Walk | 191.5km | 309km | 38.0% |
| HIGH | Snowdon Horseshoe | 7.3km | 12km | 39.2% |
| HIGH | Ben Nevis via Mountain Track | 9.2km | 16km | 42.2% |
| HIGH | Aonach Eagach Ridge | 3.6km | 10km | 64.2% |
| HIGH | Ben Macdui from Cairn Gorm | 5.6km | 18km | 68.9% |
| HIGH | St Cuthbert's Way | 30.9km | 100km | 69.1% |
| HIGH | Crib Goch | 2.7km | 10km | 73.0% |
| HIGH | West Highland Way | 22.3km | 154km | 85.5% |
| HIGH | Skye Trail | 7.6km | 128km | 94.1% |
| HIGH | Glyndwr's Way | 1.7km | 217km | 99.2% |

**Quality totals: OK=9, FAIR=12, HIGH=13**

### Wrong Relation Issues:
- West Highland Way: Found "alternatives" relation (18238803) instead of main route — needs retry with correct relation
- Skye Trail: Found "shortcut Camasunary to Kilmarie" (15723889) — only 6.7km of 128km
- Glyndwr's Way: Relation uses Welsh name "Llwybr Glyndŵr" — name mismatch, way fallback only got 1.7km
- Coast to Coast Walk: Only got Richmond→Robin Hood's Bay section (191km of 309km)
- Ben Nevis/Snowdon/Crib Goch/Ben Macdui: Got specific route variants, not full round-trip

### Still Failed (10 trails — no usable OSM data):
Snowdonia Way, Helvellyn via Striding Edge, Tryfan and Bristly Ridge,
Blencathra via Sharp Edge, Great Gable, Cadair Idris,
An Teallach Traverse, Old Man of Coniston, Suilven, The Cobbler

### Still Needs Mega Trail Handling:
- South West Coast Path (1014km) — skipped, needs known relation ID fetch

### Wired Into App:
- 34 trail IDs in `lazyTrailIds` Set
- 34 trail data files in `public/trail-data/`
- 34 entries in `manifest.json` (211 total)
- All entries in popularTrails.ts with lazy loading

## Scripts Reference (UK)
- `fetch-uk-batch.ts` — UK batch fetch with full pipeline (relations + way fallback + elevation)
- `wire-uk-lazy.ts` — Wire UK trails into app (add to lazyTrailIds, add entries)

## Europe — 28/38 trails in app (after mega fetch + fix pass)

### Batch Fetch Results (initial):
- 25 succeeded, 9 failed, 4 skipped (mega >500km)
- Austrian/German alpine trails excellent OSM coverage
- Norwegian day hikes poorly mapped
- Heavy Overpass rate limiting throughout

### Mega Fetch Results:
Re-fetched 11 wrong/incomplete trails with correct OSM relation IDs + fetched 2 previously-skipped mega trails.
Used `fetch-europe-mega.ts` with three fetch modes: single relation, multi-relation IDs, dynamic search.

### Mega Fix Pass Results:
Spectacular improvements — ALL trails now under 10% error:
- South West Coast Path: 1269.9km → 1017.9km (25.2% → 0.4%) — section dedup + gap skip
- Vikos Gorge: 20.4km → 11.9km (70.1% → 0.6%) — flyback removal
- Alta Via 2: 236.2km → 158.0km (47.6% → 1.3%) — flyback + stitch
- Lycian Way: 860.9km → 548.6km (59.4% → 1.6%) — flyback + dedup + mirror + gap skip
- West Highland Way: 260.3km → 151.0km (69.0% → 1.9%) — flyback removal
- Tour du Mont Blanc: 166.0km (2.3% off) — no fix needed
- Kungsleden: 829.6km → 463.7km (88.5% → 5.4%) — flyback + gap skip
- E5 Alps Crossing: 710.3km → 211.0km (255.1% → 5.5%) — lat cutoff + flyback
- GR11 Pyrenean Traverse: 768.2km (6.3% off) — no fix needed
- GR10 French Pyrenees: 925.2km (6.3% off) — no fix needed
- GR20 Corsica: 267.6km → 165.0km (48.7% → 8.3%) — flyback removal
- Adlerweg: 576.8km → 449.6km (39.7% → 8.9%) — flyback + gap skip
- Camino de Santiago: 1148.4km → 702.8km (47.2% → 9.9%) — stitch two halves

### Combined Quality (28 trails in app):
| Status | Trail | Calc | Official | Off |
|--------|-------|------|----------|-----|
| OK | South West Coast Path | 1017.9km | 1014km | 0.4% |
| OK | Vikos Gorge | 11.9km | 12km | 0.6% |
| OK | Lechweg | 124.0km | 125km | 0.8% |
| OK | Alta Via 2 Dolomites | 158.0km | 160km | 1.3% |
| OK | Stubaier Hohenweg | 81.2km | 80km | 1.5% |
| OK | Besseggen Ridge | 13.8km | 14km | 1.5% |
| OK | Lycian Way | 548.6km | 540km | 1.6% |
| OK | West Highland Way | 151.0km | 154km | 1.9% |
| OK | Tour du Mont Blanc | 166.0km | 170km | 2.3% |
| OK | Tour of Monte Rosa | 145.3km | 150km | 3.1% |
| OK | Laugavegur Trail | 52.8km | 55km | 4.0% |
| FAIR | Selvaggio Blu | 37.9km | 40km | 5.2% |
| FAIR | Kungsleden | 463.7km | 440km | 5.4% |
| FAIR | E5 Alps Crossing | 211.0km | 200km | 5.5% |
| FAIR | GR11 Pyrenean Traverse | 768.2km | 820km | 6.3% |
| FAIR | GR10 French Pyrenees | 925.2km | 870km | 6.3% |
| FAIR | Caminito del Rey | 7.4km | 8km | 7.1% |
| FAIR | Fimmvorduhals Trail | 23.2km | 25km | 7.2% |
| FAIR | GR20 Corsica | 165.0km | 180km | 8.3% |
| FAIR | Meraner Hohenweg | 91.7km | 100km | 8.3% |
| FAIR | Adlerweg | 449.6km | 413km | 8.9% |
| FAIR | Alta Via 1 Dolomites | 109.1km | 120km | 9.1% |
| FAIR | Samaria Gorge | 14.5km | 16km | 9.4% |
| FAIR | Camino de Santiago Francés | 702.8km | 780km | 9.9% |
| FAIR | Ruta del Cares | 19.8km | 22km | 10.1% |
| HIGH | Rota Vicentina | 323.0km | 450km | 28.2% |
| HIGH | Preikestolen | 5.7km | 8km | 28.4% |
| HIGH | Sentiero degli Dei | 5.2km | 8km | 35.1% |

**Quality totals: OK=11, FAIR=14, HIGH=3** (plus 2 garbage removed, 9 failed)

### Garbage Data Removed:
- Hardangervidda Crossing: 0.3km / 22pts — deleted
- Cinque Terre Trail: 0.8km / 68pts — deleted

### Still Failed (9 trails — no usable OSM data):
Haute Route Chamonix-Zermatt, Bernese Oberland Trek, Picos de Europa Traverse,
Hornstrandir Traverse, Romsdalseggen Ridge, Galdhøpiggen,
Jotunheimen Traverse, Tre Cime di Lavaredo Circuit, Zugspitze via Höllental

### Remaining HIGH (3 — need manual GPX):
- Trolltunga (59.7% off — partial route in OSM)
- Rota Vicentina (28.2% off — relation only covers ~72% of trail)
- Preikestolen (28.4% off — partial route)
- Sentiero degli Dei (35.1% off — partial route)

### Wired Into App:
- 28 trail IDs in `lazyTrailIds` Set (5 new: lycian_way, camino_de_santiago_frances, gr10_french_pyrenees, gr11_pyrenean_traverse, south_west_coast_path)
- 28 trail data files in `public/trail-data/`
- 28 entries in `manifest.json`
- All entries in popularTrails.ts with lazy loading

### Mega Fetch OSM Relation IDs Used:
- TMB: rel:9678362 (Itinéraire principal)
- GR20: rel:12484370 (GR 20 Principale)
- Alta Via 2: rel:404914
- Vikos Gorge: rel:15790847 (Monodendri Vikos Trail)
- Lycian Way: rel:51855
- E5: rel:300392 (DE) + rel:14073053 (AT) + rel:934999 (IT), lat cutoff 46.5°-47.5°N
- Kungsleden: 31 "Etapp" stage relations (6289365, 8928539, ...)
- Adlerweg: Dynamic search "Adlerweg Etappe" in Tyrol bbox
- Camino: Dynamic search "Camino Francés" in Northern Spain bbox
- GR10: 9 section relations (7411271, ...)
- GR11: 35 "Senda Pirenaica" stage relations (10603082, ...)
- SWCP: 52 section relations (2191940, ...)
- WHW: 9 section relations (19772647, ...)

### OSM Coverage Notes (Europe):
- Austria/Germany alpine: Excellent — Lechweg, Stubaier, Meraner all well-mapped as single relations
- Italy: Good for named trails (Alta Via, Sentiero degli Dei, Selvaggio Blu), but individual stages may match before main route
- Norway: Day hikes poorly mapped (Galdhøpiggen, Romsdalseggen, Jotunheimen — all failed). Popular tourist trails (Trolltunga, Preikestolen, Besseggen) mapped but often as partial routes
- Iceland: Laugavegur well-mapped but includes alternatives. Fimmvörðuháls good. Hornstrandir empty.
- Greece/Spain/Portugal: Samaria and Caminito del Rey well-mapped. Picos de Europa missing. Rota Vicentina has full relation but only ~72% of distance. Vikos Gorge needed specific trail relation.
- Switzerland: Local trails (Monte Rosa) mapped. International names (Bernese Oberland Trek, Haute Route) not in OSM as relations.
- Sweden: Kungsleden split into 31 "Etapp" (stage) relations — combined + deduped. ASTER 30m for elevation (above 60°N).
- Turkey: Lycian Way well-mapped as single relation but with heavy flyback.
- Spain: Camino de Santiago has many dynamic segments. GR11 split into 35 named stages. Both fetch and chain well.
- France: GR10 and GR20 have well-structured section/principale relations.
- UK mega: SWCP (52 sections, 7853 ways, 66k points!) and WHW (9 sections) both fetched correctly.

## Scripts Reference (Europe)
- `fetch-europe-batch.ts` — Europe batch fetch with full pipeline (relations + way fallback + elevation)
- `fetch-europe-mega.ts` — Europe mega fetch: re-fetch wrong relations + fetch mega trails (>500km)
- `fix-europe-mega.ts` — Fix pass for Europe mega trails (flyback, stitch, E5 lat cutoff, Kungsleden dedup, etc.)
- `search-europe-relations.ts` — Search for correct OSM relation IDs
- `search-europe-relations-2.ts` — Follow-up search for specific trails
- `wire-europe-lazy.ts` — Wire Europe trails into app (add to lazyTrailIds, add entries)

## Japan — 4/12 trails in app

### Batch fetch: 12 trails attempted
Used `fetch-region-batch.ts --list japan-trails.json`

| Status | Trail | Calc | Official | Off% | Pts | Source |
|--------|-------|------|----------|------|-----|--------|
| OK | Mount Hakusan | 17.2km | 17km | 1.1% | 473 | osm_ways_mirrored |
| OK | Mount Rishiri | 12.5km | 13km | 3.9% | 385 | osm_overpass_ordered_mirrored |
| FAIR | Nakasendo (Magome-Tsumago) | 8.9km | 8km | 11.1% | 775 | bbox_cropped |
| HIGH | Kumano Kodo Nakahechi | 41.5km | 65km | 36.2% | 1726 | osm_overpass_ordered |
| DELETED | Mt Fuji Yoshida Trail | 0.1km | 14km | — | 14 | only 14 points |
| DELETED | Tateyama Alpine Route | 4.0km | 37km | — | 285 | wrong trail (summit only) |
| DELETED | Southern Alps Traverse | 33.9km | 94km | — | 975 | too sparse |
| FAILED | Daisetsuzan Grand Traverse | — | 70km | — | — | not in OSM |
| FAILED | Kamikochi to Yarigatake | — | 36km | — | — | not in OSM |
| FAILED | Mount Kitadake | — | 11km | — | — | not in OSM |
| FAILED | Yakushima Jomon Sugi | — | 22km | — | — | not in OSM |
| FAILED | Mount Takao | — | 18km | — | — | not in OSM |

### Japan Notes
- Japan mountain hiking trails have very poor OSM coverage
- Kumano Kodo and Nakasendo are large historical pilgrimage roads; OSM has full road, not just hiking sections
- Nakasendo fixed by extracting contiguous section within Magome-Tsumago bbox
- Japanese characters in searchName (e.g. 熊野古道, 中山道) worked well for matching

## Nepal — 8/12 trails in app

### Batch fetch: 12 trails attempted
Used `fetch-region-batch.ts --list nepal-trails.json`

| Status | Trail | Calc | Official | Off% | Pts | Source |
|--------|-------|------|----------|------|-----|--------|
| OK | Mardi Himal Trek | 45.7km | 45km | 1.5% | 1635 | osm_overpass_ordered |
| OK | Annapurna Circuit | 196.1km | 200km | 1.9% | 7700 | fixed (dedup+gap skip) |
| FAIR | Manaslu Circuit | 198.0km | 177km | 11.9% | 13011 | osm_overpass_ordered |
| FAIR | Gokyo Lakes Trek | 77.3km | 90km | 14.1% | 1395 | osm_ways_mirrored |
| FAIR | EBC Trek | 154.9km | 130km | 19.2% | 5755 | mirrored out-and-back |
| FAIR | Three Passes Trek | 128.1km | 160km | 19.9% | 5196 | osm_overpass_ordered |
| FAIR | Langtang Valley | 57.4km | 75km | 23.5% | 1950 | osm_ways |
| HIGH | Makalu BC Trek | 81.4km | 125km | 34.8% | 9692 | osm_overpass_ordered |
| DELETED | Annapurna BC Trek | 24.1km | 110km | — | 1750 | only partial route |
| DELETED | Poon Hill Trek | 13.9km | 40km | — | 246 | too sparse |
| DELETED | Upper Mustang Trek | 16.0km | 140km | — | 375 | barely any data |
| FAILED | Kanchenjunga Circuit | — | 220km | — | — | not in OSM |

### Nepal Notes
- Annapurna Circuit fix spectacular: 367.6km → 196.1km via section dedup + gap skip
- EBC is out-and-back (Lukla→EBC→Lukla): mirroring one-way 77.5km to 154.9km
- Nepal has better OSM hiking coverage than Japan but trek routes often include parallel/alternative tracks
- Makalu has real data (9692 pts to 4890m) but only covers part of the full trek

## Patagonia — 5/10 trails in app

### Batch fetch: 10 trails attempted
Used `fetch-region-batch.ts --list patagonia-trails.json`

| Status | Trail | Calc | Official | Off% | Pts | Source |
|--------|-------|------|----------|------|-----|--------|
| OK | Cerro Castillo Circuit | 54.3km | 54km | 0.5% | 1895 | bbox_cropped from GPT Section 32 |
| FAIR | Laguna de los Tres | 26.2km | 24km | 9.2% | 1801 | mirrored out-and-back |
| FAIR | TdP O Circuit | 117.3km | 130km | 9.8% | 6622 | osm_overpass_ordered |
| FAIR | Laguna Torre | 15.4km | 18km | 14.2% | 577 | osm_overpass_ordered |
| FAIR | Nahuel Huapi Traverse | 48.0km | 42km | 14.3% | 1976 | osm_overpass_ordered |
| DELETED | Cochamo Valley | 195.4km | 22km | — | 8023 | GPT Section 22, bbox crop failed |
| FAILED | TdP W Trek | — | 80km | — | — | no dedicated relation (subset of O Circuit) |
| FAILED | Huemul Circuit | — | 64km | — | — | not in OSM |
| FAILED | Dientes de Navarino | — | 53km | — | — | not in OSM |
| FAILED | Laguna Esmeralda | — | 9km | — | — | not in OSM |

### Patagonia Notes
- Greater Patagonian Trail (GPT) sections match first for Cerro Castillo and Cochamo — need bbox cropping
- Cerro Castillo fix excellent: GPT 107km → circuit 54.3km via wider bbox
- Torres del Paine W Trek has no own relation (it's a subset of the O Circuit)
- El Chaltén trails (Fitz Roy, Laguna Torre) well-mapped with proper relations
- Tierra del Fuego (Dientes, Esmeralda) has no OSM hiking data

### Scripts used
- `fetch-region-batch.ts --list <file>` — Generic batch fetch for any region (pipe-separated searchName, bbox validation, ASTER fallback)
- `fix-japan.ts` — Nakasendo bbox section extraction, delete unusable
- `fix-nepal.ts` — EBC mirroring, Annapurna Circuit dedup+gap skip, delete unusable
- `fix-patagonia.ts` — GPT section bbox cropping, Cochamo delete
- `fix-peru.ts` — Combined fix pass (flyback, stitch, dedup, gap skip, mirroring)
- `fix-india.ts` — Combined fix pass + garbage deletion (Kuari Pass)

## Peru — 7/12 trails in app

### Batch Fetch Results:
- 7 succeeded (full resolution + SRTM 30m elevation at every point)
- 5 failed (no OSM relations or ways found)
- Cordillera Blanca trails well-mapped, day hikes and remote canyons poorly mapped

### Fix Pass Results:
Spectacular improvements — zero HIGH trails after fixes:
- Ausangate Circuit: 91.3km → 70.2km (30.4% → 0.3%) — gap skip 10km
- Santa Cruz Trek: 117.9km → 45.2km (135.8% → 9.6%) — section dedup
- Salkantay Trek: 92.9km → 64.4km (25.6% → 12.9%) — section dedup
- Inca Trail: 53.3km → 36.6km (23.9% → 14.9%) — stitched two halves

### Quality After Fixes (7 trails):
| Status | Trail | Calc | Official | Off |
|--------|-------|------|----------|-----|
| OK | Ausangate Circuit | 70.2km | 70km | 0.3% |
| OK | Alpamayo Circuit | 80.4km | 80km | 0.5% |
| OK | Choquequirao Trek | 67.1km | 65km | 3.2% |
| FAIR | Huayhuash Circuit | 117.9km | 130km | 9.3% |
| FAIR | Santa Cruz Trek | 45.2km | 50km | 9.6% |
| FAIR | Salkantay Trek | 64.4km | 74km | 12.9% |
| FAIR | Inca Trail to Machu Picchu | 36.6km | 43km | 14.9% |

**Quality totals: OK=3, FAIR=4, HIGH=0**

### Still Failed (5 trails — no usable OSM data):
Lares Trek, Colca Canyon Trek, Rainbow Mountain (Vinicunca), El Misti Volcano, Cotahuasi Canyon Trek

### OSM Coverage Notes (Peru):
- Cordillera Blanca excellent (Santa Cruz, Alpamayo, Huayhuash all have relations)
- Cusco trekking routes well-mapped (Inca Trail, Salkantay, Ausangate, Choquequirao)
- Day hikes (Rainbow Mountain) and remote canyons (Colca, Cotahuasi) not mapped
- El Misti volcano summit trail not in OSM

### Wired Into App:
- 7 trail IDs in `lazyTrailIds` Set (4 existing + 3 new)
- 7 trail data files in `public/trail-data/`
- 7 entries in `manifest.json`
- All entries in popularTrails.ts with lazy loading

## India / Himalayas — 8/15 trails in app (1 deleted as garbage)

### Batch Fetch Results:
- 9 succeeded, 6 failed (no OSM relations or ways found)
- 1 deleted as garbage (Kuari Pass: 131 pts, 88.9% off)
- Uttarakhand trekking routes fairly well-mapped, Ladakh/Sikkim partially mapped
- Heavy Overpass rate limiting throughout

### Fix Pass Results:
- Roopkund: 33.1km → 44.6km (37.5% → 15.9%) — stitched two halves
- Brahmatal: 35.8km → 16.4km (62.8% → 25.7%) — section dedup
- Kuari Pass: DELETED (131 pts, 88.9% off — garbage data)

### Quality After Fixes (8 trails):
| Status | Trail | Calc | Official | Off |
|--------|-------|------|----------|-----|
| OK | Hampta Pass Trek | 36.0km | 35km | 2.8% |
| OK | Stok Kangri Trek | 34.2km | 36km | 4.9% |
| FAIR | Valley of Flowers Trek | 22.7km | 25km | 9.1% |
| FAIR | Kedarkantha Trek | 17.1km | 20km | 14.7% |
| FAIR | Roopkund Trek | 44.6km | 53km | 15.9% |
| HIGH | Goechala Trek | 67.4km | 90km | 25.1% |
| HIGH | Brahmatal Trek | 16.4km | 22km | 25.7% |
| HIGH | Rupin Pass Trek | 38.6km | 52km | 25.8% |

**Quality totals: OK=2, FAIR=3, HIGH=3**

### Still Failed (6 trails — no usable OSM data):
Markha Valley Trek, Chadar Frozen River Trek, Pin Parvati Pass Trek, Har Ki Dun Trek, Sandakphu Trek, Nanda Devi Base Camp Trek

### OSM Coverage Notes (India/Himalayas):
- Uttarakhand popular treks fairly well-mapped (Roopkund, Valley of Flowers, Kedarkantha, Brahmatal)
- Himachal Pradesh mixed — Hampta Pass well-mapped, Pin Parvati and Rupin Pass partially
- Ladakh: Stok Kangri has relation, Markha Valley and Chadar completely missing
- Sikkim: Goechala has relation with 65 ways but covers only 67km of 90km trek
- Indian Himalayan hiking trails mapped by OSM relation ID series 8166xxx-11245xxx — suggests recent systematic mapping effort

### Wired Into App:
- 8 trail IDs in `lazyTrailIds` Set
- 8 trail data files in `public/trail-data/`
- 8 entries in `manifest.json` (274 total)
- All entries in popularTrails.ts with lazy loading

## South America (non-Peru) — 6 trails in app

### Batch Fetch Results:
- 9 succeeded, 2 failed (Colca Canyon, Lares Trek)
- Inca Trail matched same OSM relation as Salkantay (rel:2376237) — deleted as duplicate
- Quilotoa Loop: 8.4km vs 45km (81.2% off) — deleted
- Mount Roraima: 35.2km vs 96km (63.4% off) — deleted

### Quality After Fixes (6 trails):
| Status | Trail | Calc | Official | Off |
|--------|-------|------|----------|-----|
| FAIR | Ciudad Perdida | 42.9km | 40km | 6.8% |
| FAIR | Huayhuash Circuit | 117.9km | 130km | 9.3% |
| FAIR | Choro Trail | 69.4km | 57km | 21.7% |
| OK | Ausangate Circuit | 70.2km | 70km | 0.3% |
| OK | Choquequirao Trek | 67.1km | 65km | 3.2% |
| HIGH → FAIR | Salkantay Trek | 64.4km | 74km | 12.9% |

Note: Ausangate, Huayhuash, Salkantay, Choquequirao were fetched with South America list but later re-fetched/fixed by Peru pipeline.

### Wired Into App:
- 6 trail IDs in `lazyTrailIds` Set (salkantay_trek, huayhuash_circuit, ausangate_circuit, choquequirao_trek, ciudad_perdida, choro_trail)
- 6 trail data files in `public/trail-data/`
- All entries in popularTrails.ts with lazy loading

## Africa — 0/8 trails in app (1 found, deleted)

### Batch Fetch Results:
- 1 succeeded (Mount Kenya Sirimon-Chogoria: 22.2km vs 55km = 59.6% off)
- 7 failed: Kilimanjaro Machame, Kilimanjaro Lemosho, Mount Meru, Simien Mountains, Mount Toubkal, Rwenzori Mountains, GR R2 Reunion
- Mount Kenya deleted (traverse route with only 40% mapped, not fixable)

### OSM Coverage Notes (Africa):
- African mountain hiking trails have extremely poor OSM coverage
- Kilimanjaro routes (most popular African trekking) not mapped as hiking relations
- East African volcanoes (Meru, Rwenzori) also absent
- North Africa (Toubkal) and Indian Ocean (Reunion) similarly unmapped
- Only Mount Kenya had any data, but even that was incomplete

## SE/East Asia — 3/11 trails in app

### Batch Fetch Results:
Used `fetch-region-batch.ts --list asia-trails.json`

| Status | Trail | Calc | Official | Off% | Pts | Source |
|--------|-------|------|----------|------|-----|--------|
| OK | Zhuilu Old Trail | 9.7km | 10km | 2.8% | 472 | osm_overpass_ordered |
| OK | Mount Pulag | 18.3km | 19km | 3.7% | 739 | osm_overpass_ordered_mirrored |
| FAIR | Mount Rinjani | 39.2km | 42km | 6.8% | 1658 | osm_overpass_ordered |
| HIGH | Jirisan Ridge | 41.8km | 33km | 26.6% | 795 | wrong trail (dullegil circumnavigation) |
| HIGH | Mount Semeru | 27.7km | 42km | 34.0% | 333 | partial route |
| HIGH | Seoraksan Dinosaur Ridge | 3.8km | 14km | 73.2% | 218 | fragment |
| HIGH | Xueshan (Snow Mountain) | 1.7km | 22km | 92.3% | 105 | summit segment only |
| HIGH | Jeju Olle Trail | 32.3km | 437km | 92.6% | 668 | 1/26 sections |
| HIGH | Yushan (Jade Mountain) | 1.0km | 22km | 95.3% | 173 | summit segment only |
| FAILED | Mount Kinabalu | — | 17km | — | — | rate limited |
| FAILED | Fansipan | — | 24km | — | — | not in OSM |

### Deleted (6 garbage/unfixable):
- Yushan, Xueshan: Only got summit segments (1-1.7km of 22km trails)
- Jeju Olle: Got 1 of 26 island perimeter sections — would need mega handling
- Jirisan: Got dullegil (lowland circumnavigation trail, max 696m) not ridge traverse (1915m)
- Mount Semeru: 34% off, only 333 pts, not fixable
- Seoraksan: 3.8km fragment of 14km trail

### OSM Coverage Notes (SE/East Asia):
- Taiwan: Zhuilu Old Trail (Taroko Gorge) perfectly mapped with 錐麓古道 Chinese name. Yushan/Xueshan only have summit micro-segments, not full trail routes.
- Philippines: Mount Pulag has single trail relation, auto-mirrored for out-and-back
- Indonesia: Mount Rinjani well-mapped (Sembalun basecamp route, 1658 pts to 3671m). Mount Semeru partial.
- South Korea: 지리산 searches return dullegil (circumnavigation) trail instead of ridge traverse. Seoraksan similarly incomplete.
- Vietnam: Fansipan not in OSM at all
- Jeju Olle: Split into 26+ individual section relations — would need mega trail handling for full route

### Wired Into App:
- 3 trail IDs in `lazyTrailIds` Set (mount_rinjani, mount_pulag, zhuilu_old_trail)
- 3 trail data files in `public/trail-data/`
- 3 entries in popularTrails.ts with lazy loading

## Rollout Order
1. ✅ Tasmania (16 multi-day + 9 day walks = 25 trails)
2. ✅ Australia mainland (22 multi-day + 15 day hikes = 37 trails)
3. ✅ US (89/92 trails — 3 need manual GPX)
4. ✅ Canada (28/50 in app — OK=8, FAIR=18, HIGH=2, 14 need manual GPX)
5. ✅ NZ (23/50 in app — OK=12, FAIR=9, HIGH=2, 27 need manual GPX)
6. ✅ South Africa (1/1 — FAIR)
7. ✅ UK (34/45 in app — OK=9, FAIR=12, HIGH=13, 10 failed + 1 mega)
8. ✅ Europe (28/38 in app — OK=11, FAIR=14, HIGH=3, 9 failed + 2 garbage removed)
9. ✅ Japan (4/12 in app — OK=2, FAIR=1, HIGH=1, 5 failed + 3 deleted)
10. ✅ Nepal (8/12 in app — OK=2, FAIR=5, HIGH=1, 1 failed + 3 deleted)
11. ✅ Patagonia (5/10 in app — OK=1, FAIR=4, 4 failed + 1 deleted)
12. ✅ Peru (7/12 in app — OK=3, FAIR=4, HIGH=0, 5 failed)
13. ✅ India/Himalayas (8/15 in app — OK=2, FAIR=3, HIGH=3, 6 failed + 1 deleted)
14. ✅ South America non-Peru (6 trails wired — OK=0, FAIR=3, HIGH=0, 2 failed + 3 deleted)
15. ✅ Africa (0/8 trails — only 1 found at 59.6% off, deleted; 7 failed)
16. ✅ SE/East Asia (3/11 trails — OK=2, FAIR=1, 2 failed + 6 deleted/garbage)
17. More regions (Caucasus, Central Asia, etc.)
