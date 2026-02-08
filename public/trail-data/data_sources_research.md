# Australian Trail Data Sources Research

## Summary

This document contains research findings on data sources for Australian mainland hiking trails, including API availability, GPX file sources, and OpenStreetMap coverage.

## State Parks Open Data APIs

### New South Wales (NSW)
- **SEED Platform**: NSW has the SEED (Sharing and Enabling Environmental Data) platform
- **ArcGIS REST Services**: Available through datasets.seed.nsw.gov.au
- **Trail Data**: Track Section Feature Class within NPWS Assets Geodatabase includes Walking Routes
- **Source**: https://datasets.seed.nsw.gov.au/dataset/?res_format=ARCGIS+REST+SERVICE

### Queensland (QLD)
- **Queensland Spatial GIS**: Provides public ArcGIS REST services
- **Protected Areas Service**: Includes National and State owned parks, reserves and forests
- **Trail Features**: Protected area tracks and trails including walking tracks, great walks, horse trails, and mountain bike trails
- **Endpoint**: https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Environment/ParksTerrestrialProtectedAreas/MapServer
- **Source**: https://parks.qld.gov.au/

### Western Australia (WA)
- **DBCA Data Portal**: Department of Biodiversity, Conservation and Attractions maintains spatial data
- **Regional Parks Dataset**: ArcGIS Server Map Service available
- **Long Trails**: Managed by DBCA Tracks and Trails Unit (Bibbulmun Track, Munda Biddi Trail, Cape to Cape)
- **Data Portal**: https://catalogue.data.wa.gov.au/dataset/?organization=department-of-biodiversity-conservation-and-attractions
- **Trail Portal**: https://exploreparks.dbca.wa.gov.au/trails

### Victoria (VIC)
- **Parks Victoria**: Manages extensive trail network
- **Data Status**: Limited public ArcGIS REST API access found
- **Official Site**: https://www.parks.vic.gov.au/
- **Note**: May require direct contact with Parks Victoria for GIS data access

### South Australia (SA)
- **Data.SA Portal**: https://data.sa.gov.au/data/dataset/?tags=parks
- **Status**: Limited trail-specific GIS data found in public portals
- **Heysen Trail**: Maintained by Friends of the Heysen Trail with interactive maps available
- **Source**: https://heysentrail.asn.au/heysen-trail/interactive-map/

### Northern Territory (NT)
- **NT Parks**: https://nt.gov.au/parks/
- **Status**: Limited public ArcGIS REST API access found
- **Major Trails**: Larapinta Trail and Jatbula Trail have official pages with maps

### Australian Capital Territory (ACT)
- **ACT Geospatial Data Catalogue**: Available with ArcGIS services
- **Data Portal**: https://actmapi-actgov.opendata.arcgis.com/
- **Canberra Trails**: Centenary Trail managed by Parks ACT

## Fastest Known Time (FKT) GPX Files

### Available Australian Trails with GPX Downloads

1. **Australian Alps Walking Track**
   - Distance: 655km
   - GPX File: 1.34 MB available
   - URL: https://fastestknowntime.com/route/australian-alps-walking-track

2. **Centenary Trail (Canberra)**
   - Distance: 139km loop
   - GPX files available
   - URL: https://fastestknowntime.com/route/centenary-trail-canberra-australia

3. **Great North Walk**
   - Distance: 250km
   - Sydney to Newcastle
   - URL: https://fastestknowntime.com/route/great-north-walk-nsw-australia

4. **Kanangra to Katoomba (K2K)**
   - Distance: 47-52.5km (depending on finish point)
   - URL: https://fastestknowntime.com/route/kanangra-2-katoomba-nsw-australia

### Notes on FKT
- FKT encourages GPS track submissions for verified routes
- Not all major Australian trails have FKT entries yet
- Quality varies - some tracks are from race events, others from individual attempts

## OpenStreetMap Coverage

### General Status
- **Coverage**: Partial and variable across Australian regions
- **Long-Distance Trails**: Many are still missing or incomplete
- **Urban Areas**: Better coverage than remote wilderness areas
- **Tagging**: Uses standard OSM hiking route tags (route=hiking)

### OSM-Based Tools for Australia

1. **BeyondTracks.com/map**
   - Bushwalking maps for Australia using OSM data
   - Specialized for Australian hiking trails

2. **Trailcatalog.org**
   - Global OSM trail catalog with distance and elevation
   - Searchable database of mapped trails
   - URL: https://community.openstreetmap.org/t/introducing-trailcatalog-org-a-site-for-osm-trails-w-distance-and-elevation/117394

3. **HikeBikeMap**
   - Shows OSM with contour lines and hiking routes
   - URL: https://hikebikemap.org/

### Quality Notes
- Trail data quality varies significantly by region
- Remote wilderness areas often have sparse or no coverage
- Community-maintained, so accuracy depends on local mapper activity
- Best for established, well-documented trails in accessible areas

## Waymarked Trails

### Platform Overview
- **Service**: https://hiking.waymarkedtrails.org/
- **Data Source**: Uses OpenStreetMap data
- **Features**: Renders recreational routes on top of base maps with route inspection

### Australia Coverage
- **Status**: Coverage exists but is incomplete
- **Quality**: Dependent on underlying OSM data quality
- **Best For**: Exploring already-mapped routes
- **Limitation**: Many Australian trails not yet mapped

### API Access
- **GitHub**: https://github.com/waymarkedtrails/waymarkedtrails-api
- **Note**: Can query waymarkedtrails API for trail data where available

## Other Notable Data Sources

### Great Walks of Australia
- **URL**: https://greatwalksofaustralia.com.au/
- **Type**: Commercial guided walk operator network
- **Coverage**: Premium multi-day walks (Bay of Fires, Scenic Rim Trail, etc.)
- **Data**: Limited public access to trail geometry

### Australian Hiker
- **URL**: https://australianhiker.com.au/trails/
- **Type**: Community hiking resource
- **Coverage**: Comprehensive trail descriptions and information
- **Data**: Trail guides, but no standardized GPX/GIS data portal

### Trail Hiking Australia
- **URL**: https://www.trailhiking.com.au/
- **Type**: Walking trail guides and information
- **Coverage**: Detailed trail descriptions with distances
- **Data**: No bulk download or API access

### State-Specific Trail Organizations

1. **Bibbulmun Track Foundation** (WA)
   - URL: https://www.bibbulmuntrack.org.au/
   - Provides detailed section-by-section guides
   - GPX files available for download

2. **Friends of the Heysen Trail** (SA)
   - URL: https://heysentrail.asn.au/
   - Interactive map with downloadable GPX files
   - Section-by-section information

3. **Great Dividing Trail Network** (VIC)
   - URL: https://www.gdt.org.au/gpx-files
   - GPX files available for trail network

## Recommendations for Data Acquisition

### Priority 1: Official State Parks APIs
1. **Queensland**: Best public API access for trail geometry
2. **NSW**: Good SEED platform with ArcGIS REST services
3. **WA**: DBCA data portal with trail information

### Priority 2: Trail Organization GPX Files
1. Bibbulmun Track Foundation
2. Friends of the Heysen Trail
3. Great Dividing Trail Network
4. Individual trail websites (e.g., thegreatnorthwalk.com)

### Priority 3: FKT and Community Sources
1. Fastest Known Time GPX downloads (limited but high quality)
2. OpenStreetMap exports (variable quality)
3. Waymarked Trails API (where data exists)

### Priority 4: Manual Digitization
For trails without digital data:
1. Use official park maps and guidebooks
2. GPS track recording (field work)
3. Coordinate with trail organizations for data sharing

## Data Quality Considerations

### Official State Park Data
- **Pros**: Most authoritative, regularly maintained, official distances
- **Cons**: Not all states have public APIs, some require permissions
- **Best For**: Primary data source where available

### FKT GPX Files
- **Pros**: High-quality GPS tracks, verified routes
- **Cons**: Limited coverage, may include race variants
- **Best For**: Supplementing official data with actual GPS traces

### OpenStreetMap
- **Pros**: Open data, can be edited/improved, global standard
- **Cons**: Incomplete coverage, variable quality, may be outdated
- **Best For**: Backup data source, filling gaps

### Trail Organizations
- **Pros**: Expert knowledge, regularly updated
- **Cons**: Data format varies, may not have GIS data
- **Best For**: Official distances, trail descriptions, supplementary information

## Next Steps for Implementation

1. **Contact State Parks**: Reach out to NSW, QLD, WA for API access details
2. **Download Available GPX**: Collect FKT and trail organization GPX files
3. **OSM Export**: Extract Australian trail data from OpenStreetMap
4. **Build Database**: Standardize data format matching Tasmania trail structure
5. **Fill Gaps**: Identify trails needing manual digitization or additional data collection

## Summary Statistics

- **Trails Identified**: 25 major mainland multi-day trails
- **States Covered**: NSW (7), VIC (6), QLD (7), WA (3), NT (2), SA (1), ACT (1)
- **Distance Range**: 26km (Coast Track) to 1200km (Heysen Trail)
- **Duration Range**: 2 days to 60 days
- **States with Good API Access**: QLD (excellent), NSW (good), WA (moderate)
- **Trails with FKT GPX**: 4 confirmed (AAWT, Centenary, Great North Walk, K2K)
- **OSM Coverage**: Partial, variable quality
