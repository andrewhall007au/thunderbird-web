# US Trail GPX Download Status

## Successfully Downloaded Automatically

| Trail | Points | Source | File |
|-------|--------|--------|------|
| Appalachian Trail | 312,036 | TopoFusion | `us/at_centerline_full.gpx` |

## Requires Manual Download (Login/Account)

These sites have free GPX downloads but require account creation:

### Hiking Project (REI) - FREE account
URL: https://www.hikingproject.com
Trails available:
- Franconia Ridge Loop: https://www.hikingproject.com/trail/gpx/7002742
- Wallace Falls: https://www.hikingproject.com/trail/gpx/7003986
- Colchuck Lake: https://www.hikingproject.com/trail/gpx/7026025
- Maple Pass Loop: https://www.hikingproject.com/trail/gpx/7013152
- Mt Si: https://www.hikingproject.com/trail/gpx/7001016
- Royal Arch: https://www.hikingproject.com/trail/gpx/7000331
- Lake Blanche: https://www.hikingproject.com/trail/gpx/7002420

### AllTrails+ - PAID ($35.99/year)
~40% of top 100 trails have their best GPX on AllTrails
Major trails requiring AllTrails+:
- Angels Landing
- Delicate Arch
- Emerald Lake (RMNP)
- Avalanche Lake (Glacier)
- Bright Angel Trail
- South Kaibab Trail
- The Enchantments
- Most Grand Teton trails

### Gaia GPS - FREE account (limited) or PAID
URL: https://www.gaiagps.com
Trails available:
- Rattlesnake Ledge
- Flatiron via Siphon Draw
- Saint Mary's Glacier
- Red Rocks Trading Post

## Blocked by Cloudflare/Bot Protection

- Wikiloc (all trails)
- Some trail organization sites

## JavaScript-Only Downloads (Can't Automate)

### Official Trail Organizations
- **PCTA** (Pacific Crest Trail): https://www.pcta.org/discover-the-trail/maps/pct-data/
  - Has official GPX but download requires JavaScript interaction

- **CDTC** (Continental Divide Trail): https://cdtcoalition.org/explore-the-trail/maps-and-data/
  - Uses Avenza Maps format, not raw GPX

### State/Regional
- **COTREX** (Colorado): https://trails.colorado.gov
  - Full Colorado trail database but JavaScript-based interface

- **14ers.com**: https://www.14ers.com
  - All Colorado 14ers but JavaScript download

## Recommended Manual Download Priority

### Tier 1 - Official Sources (Highest Quality)
1. **Pacific Crest Trail** - PCTA.org (create free account)
2. **Continental Divide Trail** - Use FarOut/Guthook app or CDTC
3. **John Muir Trail** - Included in PCT data

### Tier 2 - Hiking Project (Free Account)
Create account at hikingproject.com, then download:
- All Washington trails (Mt Si, Colchuck, Rattlesnake, etc.)
- Colorado Front Range trails
- New Hampshire/White Mountains

### Tier 3 - AllTrails+ (If Budget Allows)
For comprehensive coverage of National Park trails

## Instructions for Manual Downloads

1. Create folder: `app/data/gpx/us/manual/`
2. Download GPX files from sources above
3. Name files: `{trail-slug}.gpx` (e.g., `angels-landing.gpx`)
4. Tell Claude: "Process GPX files in app/data/gpx/us/manual/"

I will then:
- Parse each GPX file
- Extract coordinates with elevation
- Update popularTrails.ts with real data
- Report confidence scores based on point density
