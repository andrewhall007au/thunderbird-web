# Global Trail Triage — 78 Problem Trails

## Summary

| Action | Count | Description |
|--------|-------|-------------|
| REMOVE | 7 | <30% coverage, data is misleading |
| GPX-HUNT | 6 | 31-65% coverage, popular trails worth fixing |
| BBOX-TRIM | 5 | >250% coverage, too much data captured |
| KEEP | 60 | 65-150% coverage, usable with gaps |

---

## REMOVE (7 trails)

Data too poor to be useful. Show incorrect trail shapes on map.

| Trail | Country | Coverage | Points | Official km |
|-------|---------|----------|--------|-------------|
| Ben Macdui from Cairn Gorm | GB | 0% | 8 | 18 |
| Glyndwr's Way | GB | 1% | 54 | 217 |
| Skye Trail | GB | 6% | 190 | 128 |
| Half Dome via Mist Trail | US | 14% | 236 | 22.5 |
| Mount Washington via Tuckerman Ravine | US | 18% | 100 | 13.6 |
| Sentinel Dome and Taft Point | US | 21% | 63 | 8 |
| Crib Goch | GB | 27% | 174 | 10 |

**Action:** Remove from `popularTrails.ts`, delete JSON, update trailMatch.ts count.

---

## GPX-HUNT (6 trails)

Popular/important trails worth fixing. Priority GPX sources to try.

| Trail | Country | Coverage | Points | Official km | GPX strategy |
|-------|---------|----------|--------|-------------|--------------|
| St Cuthbert's Way | GB | 31% | 115 | 100 | Waymarked Trails (UK national trail) |
| Coast to Coast Walk | GB | 62% | 4437 | 309 | FKT / Waymarked Trails (Wainwright classic) |
| Kumano Kodo Nakahechi | JP | 64% | 1599 | 65 | UNESCO heritage, gov tourism site |
| Mount Whitney Trail | US | 64% | 1834 | 35.4 | FKT (very popular) |
| Cactus to Clouds Trail | US | 65% | 800 | 32.2 | FKT |
| Makalu Base Camp Trek | NP | 65% | 9642 | 125 | Waymarked Trails / hiking blogs |

---

## BBOX-TRIM (5 trails)

Too much data — OSM/GPX captured side trails, parking lots, etc. No gaps to split.

| Trail | Country | Coverage | Points | Official km | Source |
|-------|---------|----------|--------|-------------|--------|
| Highline Trail (Glacier NP) | US | 257% | 10508 | 19.2 | gpx_user |
| Buckskin Gulch | US | 279% | 32632 | 32.2 | gpx_user |
| Yosemite Valley Loop Trail | US | 283% | 1263 | 11.5 | osm_overpass |
| Mount Adams South Climb | US | 319% | 11948 | 16.1 | gpx_user |
| Mount San Jacinto via Marion Mountain | US | 347% | 3304 | 20.9 | gpx_user |

**Action:** For gpx_user trails, need to extract main track from GPX (multi-track issue). For Yosemite, try Waymarked Trails or re-fetch from OSM with tighter query.

---

## KEEP (60 trails)

Usable data with some gaps. Coverage 65-150%. Trail shape is recognizable on map. Sorted by coverage ascending — lower coverage = more room for improvement.

### Marginal (65-80% coverage) — would benefit from GPX

| Trail | Country | Cov% | Gaps | MaxGap km |
|-------|---------|------|------|-----------|
| Makalu Base Camp Trek | NP | 65% | 2 | 26.7 |
| Rota Vicentina Fishermans Trail | PT | 72% | 6 | 32.4 |
| Goechala Trek | IN | 75% | 11 | 6.3 |
| Langtang Valley Trek | NP | 76% | 3 | 14.1 |
| Everest Three Passes Trek | NP | 80% | 3 | 10.3 |

### Acceptable (80-100% coverage)

| Trail | Country | Cov% | Gaps | MaxGap km |
|-------|---------|------|------|-----------|
| Roopkund Trek | IN | 84% | 1 | 17.3 |
| Canol Heritage Trail | CA | 86% | 2 | 20.4 |
| Gokyo Lakes Trek | NP | 86% | 8 | 12.1 |
| Laguna Torre | AR | 86% | 1 | 6.7 |
| Continental Divide Trail | US | 87% | 23 | 3.1 |
| Four Pass Loop | US | 87% | 1 | 12.2 |
| Manaslu Circuit Trek | NP | 87% | 1 | 6.9 |
| Torres del Paine O Circuit | CL | 90% | 2 | 22.8 |
| Crypt Lake Trail | CA | 91% | 1 | 5.1 |
| Huayhuash Circuit | PE | 91% | 2 | 8.6 |
| South Sister via Green Lakes | US | 91% | 1 | 7.6 |
| Plain of Six Glaciers Trail | CA | 92% | 1 | 5.8 |
| Ciudad Perdida | CO | 93% | 1 | 7.4 |
| Drakensberg Grand Traverse | ZA | 93% | 4 | 78.1 |
| Mount Rinjani | ID | 93% | 3 | 5.2 |
| Cape Wrath Trail | GB | 94% | 4 | 41.9 |
| GR11 Pyrenean Traverse | ES | 94% | 1 | 9.9 |
| Selvaggio Blu | IT | 95% | 2 | 6.3 |
| Clouds Rest Trail | US | 97% | 1 | 7.4 |
| Tour of Monte Rosa | IT | 97% | 2 | 16.8 |
| Annapurna Circuit | NP | 98% | 10 | 3.8 |
| High Sierra Trail to Mount Whitney | US | 98% | 1 | 34.0 |
| Pinhoti Trail | US | 98% | 2 | 6.4 |
| Sentier des Caps de Charlevoix | CA | 98% | 2 | 20.2 |
| Pacific Crest Trail | US | 99% | 4 | 1.7 |
| Alpamayo Circuit | PE | 100% | 2 | 17.6 |

### Good data, minor issues (100-150% coverage)

| Trail | Country | Cov% | Gaps | MaxGap km |
|-------|---------|------|------|-----------|
| Mardi Himal Trek | NP | 101% | 2 | 10.1 |
| Stubaier Hohenweg | AT | 101% | 1 | 5.1 |
| Beartooth Traverse | US | 103% | 2 | 7.3 |
| Cateran Trail | GB | 103% | 2 | 6.1 |
| Hampta Pass Trek | IN | 103% | 1 | 10.8 |
| Sentier International des Appalaches | CA | 104% | 2 | 45.4 |
| E5 Alps Crossing | DE | 105% | 2 | 25.9 |
| Fundy Footpath | CA | 105% | 1 | 5.1 |
| Pacific Northwest Trail | US | 109% | 10 | 87.6 |
| Pennine Way | GB | 109% | 2 | 44.7 |
| The Ridgeway | GB | 109% | 1 | 12.7 |
| Rees-Dart Track | NZ | 112% | 2 | 12.2 |
| Cleveland Way | GB | 113% | 2 | 29.4 |
| Ruta del Cares | ES | 116% | 1 | 5.7 |
| Kepler Track | NZ | 117% | 1 | 8.5 |
| Everest Base Camp Trek | NP | 119% | 4 | 23.3 |
| East Coast Trail | CA | 120% | 7 | 32.8 |
| Lake Waikaremoana Great Walk | NZ | 120% | 2 | 10.0 |
| Superior Hiking Trail | US | 120% | 2 | 105.5 |
| Ice Age Trail | US | 121% | 86 | 181.9 |
| Choro Trail | BO | 122% | 1 | 24.7 |
| North Downs Way | GB | 122% | 1 | 115.0 |
| Dales Way | GB | 126% | 2 | 28.5 |
| Cumbria Way | GB | 129% | 1 | 27.3 |
| Ausangate Circuit | PE | 130% | 2 | 21.0 |
| Adlerweg | AT | 135% | 15 | 44.2 |
| Alamere Falls via Coast Trail | US | 142% | 1 | 6.7 |
| Sunshine Coast Trail | CA | 146% | 11 | 25.3 |
| Algonquin Highlands Backpacking Trail | CA | 149% | 6 | 12.3 |
| Laugavegur Trail | IS | 150% | 2 | 30.0 |
