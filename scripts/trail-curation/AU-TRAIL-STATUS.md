# Australian Trail Data Curation Status

Last updated: 2026-02-11
Total AU trails: 59

## Summary

| Status | Count | Description |
|--------|-------|-------------|
| CLEAN | 20 | Data matches official distance, no gaps |
| CLEANED | 16 | Had gap jumps, now split at gaps (visual fix) |
| BBOX-CLEANED | 10 | Had junk paths, best segments selected |
| NEEDS-GPX | 13 | Incomplete or poor data, need official GPX |

---

## CLEAN (20) - No action needed

| Trail | Region | Pts | Official | Calc | Ratio |
|-------|--------|-----|----------|------|-------|
| Australian Alps Walking Track | VIC/NSW/ACT | 19,269 | 655km | 697km | 1.06 |
| Cape to Cape Track | WA | 7,001 | 123km | 126km | 1.03 |
| Carnarvon Great Walk | QLD | 2,084 | 87km | 87km | 1.00 |
| Castle Rock Granite Skywalk | Porongurup, WA | 462 | 4km | 3.5km | 0.88 |
| Cooloola Great Walk | QLD | 2,368 | 102km | 86km | 0.84 |
| Eastern Arthur Range Traverse | TAS | 2,873 | 72km | 65km | 0.90 |
| Grampians Peaks Trail | VIC | 31,271 | 164km | 161km | 0.98 |
| Jatbula Trail | NT | 1,685 | 62km | 60km | 0.97 |
| Kanangra to Katoomba | NSW | 1,920 | 47km | 46km | 0.98 |
| Lake Rhona | TAS | 1,217 | 28km | 28km | 0.99 |
| Larapinta Trail | NT | 17,378 | 223km | 224km | 1.00 |
| Leeaberra Track | TAS | 2,321 | 28km | 24km | 0.87 |
| Light to Light Walk | NSW | 1,556 | 32km | 29km | 0.91 |
| Mt Lofty Summit via Waterfall Gully | SA | 337 | 6km | 3.9km | 0.66 |
| Mt Magog | Stirling Range, WA | 156 | 4km | 1.5km | 0.37 |
| Mt Toolbrunup | Stirling Range, WA | 105 | 4km | 1.9km | 0.48 |
| Scenic Rim Trail | QLD | 1,619 | 47km | 44km | 0.93 |
| Six Foot Track | NSW | 1,781 | 45km | 45km | 0.99 |
| Wilsons Promontory Southern Circuit | VIC | 1,767 | 59km | 42km | 0.71 |
| Yuraygir Coastal Walk | NSW | 742 | 65km | 46km | 0.71 |

---

## CLEANED (16) - Gap jumps split, data retained

These trails had 1-3 gaps >1km creating straight-line artifacts. Gaps are now split into separate segments for rendering. All trail data points retained.

| Trail | Region | Pts | Official | Calc | Gaps | Notes |
|-------|--------|-----|----------|------|------|-------|
| Bald Head Walk | Albany, WA | 509 | 12km | 6.2km | 1 | Short but gap at midpoint |
| Bibbulmun Track | WA | 22,796 | 1003km | 960km | 2 | Excellent data, 2 minor jumps |
| Bluff Knoll | Stirling Range, WA | 174 | 6km | 4.6km | 1 | Minor gap near summit |
| Canberra Centenary Trail | ACT | 5,177 | 145km | 136km | 7 | Multiple disconnected sections |
| Gold Coast Hinterland Great Walk | QLD | 1,628 | 54km | 57km | 1 | 1 gap, otherwise good |
| Goldfields Track | VIC | 6,877 | 210km | 193km | 2 | Good data, 2 jumps |
| Great North Walk | NSW | 2,953 | 250km | 244km | 1 | 1 gap |
| Great Ocean Walk | VIC | 4,791 | 110km | 99km | 1 | 1 gap |
| Hakea Trail | Stirling Range, WA | 261 | 8km | 6.3km | 1 | 1 gap |
| Mount Anne Circuit | TAS | 2,027 | 32km | 35km | 1 | 1 gap |
| Mt Bogong | Alpine NP, VIC | 207 | 16km | 12.4km | 2 | Good route, 2 disconnects |
| Razorback Ridge | Alpine NP, VIC | 869 | 22km | 20km | 2 | Good data |
| Thorsborne Trail | QLD | 445 | 32km | 33km | 1 | 1 gap, excellent match |
| Three Capes Track | TAS | 2,232 | 48km | 25km | 1 | Missing ~half the trail |
| Walls of Jerusalem | TAS | 2,259 | 23km | 14.5km | 1 | Partial data |
| Wilderness Coast Walk | VIC | 703 | 100km | 49km | 2 | Missing ~half |

---

## BBOX-CLEANED (10) - Best segments selected from noisy data

These trails were fetched via bbox-only Overpass queries that grabbed ALL paths in the area. Best segments were selected to match official distance, junk paths discarded.

| Trail | Region | Before | After | Official | Notes |
|-------|--------|--------|-------|----------|-------|
| Blue Gum Forest Walk | Blue Mtns, NSW | 396pts/26km | 394pts/17km | 14km | Reasonable after cleanup |
| Falls to Hotham Alpine Crossing | Alpine, VIC | 1,257pts/84km | 889pts/70km | 37km | Still too high, multiple routes |
| Fraser Island Great Walk | QLD | 4,241pts/1069km | 756pts/134km | 90km | Still noisy, **NEED GPX** |
| Grand Canyon Track | Blue Mtns, NSW | 673pts/29km | 439pts/11km | 6km | Better but still 2x official |
| Mt Talyuberlup | Stirling Range, WA | 121pts/18km | 105pts/1.9km | 3km | OK for short summit track |
| Nancy Peak & Devils Slide | Porongurup, WA | 691pts/32km | 561pts/6km | 5km | Reasonable after cleanup |
| Royal Coast Track | Royal NP, NSW | 1,561pts/79km | 364pts/17km | 26km | **NEED GPX** |
| Stirling Ridge Walk | Stirling Range, WA | 969pts/63km | 392pts/8.3km | 12km | **NEED GPX** |
| Tree in the Rock | Porongurup, WA | 578pts/8.4km | 561pts/6km | 3km | OK for short walk |
| Whitsunday Ngaro Sea Trail | QLD | 512pts/77km | 276pts/14km | 14km | Good after cleanup |

---

## NEEDS-GPX (13) - Manual curation required

These trails need official GPX files from trail authorities. Data is either incomplete, uses a different schema (old pipeline), or has fundamental quality issues.

| Trail | Region | Issue | GPX Source to Try |
|-------|--------|-------|-------------------|
| Federation Peak | TAS | calc=43km, official=40km but schema issue | Tasmania Parks |
| Frenchmans Cap | TAS | No official distance set | Tasmania Parks |
| Freycinet Peninsula Circuit | TAS | 170pts, 2 gaps of 21km | Tasmania Parks |
| Heysen Trail | SA | 779km calc vs 1200km official, 24 gaps | Friends of the Heysen Trail |
| Mount Maria Walk | TAS | 150pts, 4km calc vs 16km official | Tasmania Parks |
| Mt Feathertop | Alpine, VIC | 9km calc vs 22km official (Bungalow Spur only) | Parks Victoria |
| Overland Track | TAS | 119km calc vs 65km official (schema) | Tasmania Parks |
| Point Lesueur Walk | TAS | 15km calc vs 28km official | Tasmania Parks |
| Port Davey Track | TAS | 73km calc vs 70km official (schema) | Tasmania Parks |
| South Coast Track | TAS | 85km calc vs 85km official (schema) | Tasmania Parks |
| Tasman Cape Pillar | TAS | 16km calc vs 30km official | Tasmania Parks |
| Western Arthur Range Traverse | TAS | 63km calc vs 58km (schema) | Tasmania Parks |
| Wilpena Pound | SA | 63pts, 2km calc vs 17km official | SA Parks |

### Priority for GPX sourcing

**High priority** (popular trails, bad data):
1. Fraser Island Great Walk - QLD Parks
2. Royal Coast Track - NSW NPWS
3. Heysen Trail - heysentrail.asn.au
4. Three Capes Track - Tasmania Parks
5. Mt Feathertop - Parks Victoria

**Medium priority** (usable but incomplete):
6. Canberra Centenary Trail - ACT Gov
7. Stirling Ridge Walk - WA DBCA
8. Freycinet Peninsula Circuit - Tasmania Parks
9. Wilderness Coast Walk - Parks Victoria

**Low priority** (short walks, data is acceptable):
10. Wilpena Pound - SA Parks
11. Mount Maria Walk - Tasmania Parks
12. Grand Canyon Track - NSW NPWS

---

## GPX Sources Found

### Official GPX/KMZ available (download now)
| Trail | Source | Format | URL |
|-------|--------|--------|-----|
| Heysen Trail | Friends of the Heysen Trail | GPX + KML | https://heysentrail.asn.au/heysen-trail/interactive-map/ |
| Canberra Centenary Trail | Parks ACT | KMZ (250KB) | https://parks.act.gov.au/find-a-nature-park/canberra-centenary-trail |

### Third-party GPX (free or cheap)
| Trail | Source | Notes |
|-------|--------|-------|
| Royal Coast Track | Wildwalks / BeyondTracks | Free track notes + GPX |
| K'gari Great Walk | Wikiloc | User-generated, multiple day sections |
| Grand Canyon Track | Wildwalks | Free GPX download |
| Mt Feathertop | AllTrails | Needs AllTrails+ ($18/yr AUD) |
| Freycinet Peninsula | AllTrails / user-generated | User tracks available |

### App-based / alternative format
| Trail | Source | Notes |
|-------|--------|-------|
| Stirling Ridge Walk | WA DBCA via Avenza/Smartreka | Geo-referenced, not GPX |
| Nancy Peak / Porongurup | WA DBCA via Avenza/Smartreka | Geo-referenced, not GPX |
| NSW trails | NSW National Parks app | Download maps for offline |

### No digital source found
| Trail | Notes |
|-------|-------|
| Three Capes Track | May be available upon booking, contact Tasmania Parks |
| Whitsunday Ngaro Sea Trail | PDF maps only confirmed |
| Wilpena Pound | Heysen Trail GPX covers nearby sections |

---

## Backups

Original (pre-cleanup) trail JSON files backed up to:
`scripts/trail-curation/backups/`
