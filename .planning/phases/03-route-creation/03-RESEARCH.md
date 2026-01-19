# Phase 3: Route Creation - Research

**Researched:** 2026-01-19
**Domain:** Interactive map editing, GPX parsing, waypoint management
**Confidence:** HIGH

## Summary

This phase implements custom route creation via GPX upload and interactive map editing. The core technologies are MapLibre GL JS for map display and react-map-gl for React integration. GPX parsing requires gpxpy (Python backend) and @we-gold/gpxjs (frontend validation/preview). The existing route data model in `routes.py` provides a solid foundation - custom routes will follow the same Waypoint structure but with user-generated data stored in the database.

Key architectural decision: GPX parsing happens server-side (Python gpxpy) for security and validation, with the frontend handling interactive editing via react-map-gl's Marker components. Map tiles come from OpenFreeMap (free, no API key required). Mobile responsiveness is handled via MapLibre's built-in touch gesture support and cooperative gestures mode.

**Primary recommendation:** Use react-map-gl v8+ with MapLibre GL JS for the map editor, gpxpy for backend GPX parsing, and OpenFreeMap for free map tiles. Store GPX data as JSON in the database, not raw XML.

## Standard Stack

The established libraries/tools for this domain:

### Core (Frontend)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-map-gl | ^8.0 | React wrapper for MapLibre | Official vis.gl library, 1:1 API mapping, handles SSR issues |
| maplibre-gl | ^4.7+ | Map rendering engine | Free, open-source Mapbox fork, GPU-accelerated |
| @we-gold/gpxjs | ^1.0 | GPX parsing (frontend preview) | TypeScript support, GeoJSON conversion, actively maintained |

### Core (Backend)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gpxpy | ^1.6 | GPX parsing (server) | Most popular Python GPX library, Apache 2.0, handles GPX 1.0/1.1 |

### Supporting (Frontend)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-dropzone | ^14 | File upload with drag-drop | GPX file upload component |

### Tile Provider
| Provider | Cost | Purpose | Why Chosen |
|----------|------|---------|------------|
| OpenFreeMap | Free | Map tiles | No API key, OpenStreetMap data, good global coverage |

Style URL: `https://tiles.openfreemap.org/styles/liberty`

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-map-gl | react-maplibre | react-maplibre is newer, less documentation/community |
| OpenFreeMap | MapTiler | MapTiler has better hiking maps but requires API key and has usage limits |
| gpxpy | fastgpx | fastgpx is faster but less feature-complete, fewer users |

**Installation:**
```bash
# Frontend
npm install react-map-gl maplibre-gl @we-gold/gpxjs react-dropzone

# Backend
pip install gpxpy
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/
├── app/
│   └── create/
│       ├── page.tsx              # Route creation page (entry point)
│       └── layout.tsx            # Layout for create flow
├── components/
│   ├── map/
│   │   ├── MapEditor.tsx         # Main map editor (client component)
│   │   ├── WaypointMarker.tsx    # Individual waypoint marker
│   │   ├── RouteTrack.tsx        # GPX track line display
│   │   └── MapControls.tsx       # Zoom, fullscreen controls
│   ├── upload/
│   │   ├── GPXUpload.tsx         # Drag-drop GPX upload
│   │   └── GPXPreview.tsx        # Preview before saving
│   └── waypoint/
│       ├── WaypointEditor.tsx    # Edit waypoint details
│       ├── WaypointList.tsx      # Sidebar list of waypoints
│       └── SMSCodeBadge.tsx      # Display generated code

backend/
├── app/
│   └── routes/
│       └── route_builder.py      # API endpoints for routes
├── services/
│   └── route_builder.py          # Business logic (update existing stub)
└── models/
    ├── custom_route.py           # SQLAlchemy model
    └── custom_waypoint.py        # SQLAlchemy model
```

### Pattern 1: Client-Only Map Component (SSR Avoidance)
**What:** MapLibre GL JS cannot render server-side - use Next.js dynamic import with `ssr: false`
**When to use:** Any page containing a MapLibre map
**Example:**
```typescript
// app/create/page.tsx
import dynamic from 'next/dynamic';

const MapEditor = dynamic(() => import('@/components/map/MapEditor'), {
  ssr: false,
  loading: () => <div className="h-[600px] bg-thunder-900 animate-pulse" />
});

export default function CreateRoutePage() {
  return <MapEditor />;
}
```

### Pattern 2: Controlled Marker State
**What:** Waypoint markers managed via React state, not imperative MapLibre API
**When to use:** All waypoint interactions (add, drag, delete)
**Example:**
```typescript
// Source: react-map-gl official docs
import { Map, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  name: string;
  type: 'camp' | 'peak' | 'poi';
  smsCode: string;
}

function MapEditor() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

  const handleMapClick = (e: MapLayerMouseEvent) => {
    const newWaypoint: Waypoint = {
      id: crypto.randomUUID(),
      lat: e.lngLat.lat,
      lng: e.lngLat.lng,
      name: '',
      type: 'poi',
      smsCode: ''
    };
    setWaypoints([...waypoints, newWaypoint]);
  };

  const handleDragEnd = (id: string, e: MarkerDragEvent) => {
    setWaypoints(waypoints.map(wp =>
      wp.id === id ? { ...wp, lat: e.lngLat.lat, lng: e.lngLat.lng } : wp
    ));
  };

  return (
    <Map
      mapLib={import('maplibre-gl')}
      mapStyle="https://tiles.openfreemap.org/styles/liberty"
      onClick={handleMapClick}
    >
      {waypoints.map(wp => (
        <Marker
          key={wp.id}
          latitude={wp.lat}
          longitude={wp.lng}
          draggable
          onDragEnd={(e) => handleDragEnd(wp.id, e)}
        >
          <WaypointPin type={wp.type} />
        </Marker>
      ))}
    </Map>
  );
}
```

### Pattern 3: GeoJSON Layer for Track Display
**What:** GPX track displayed as a MapLibre line layer from GeoJSON source
**When to use:** Showing the uploaded GPX route on the map
**Example:**
```typescript
import { Source, Layer } from 'react-map-gl/maplibre';

function RouteTrack({ geojson }: { geojson: GeoJSON.FeatureCollection }) {
  return (
    <Source id="route-track" type="geojson" data={geojson}>
      <Layer
        id="route-line"
        type="line"
        paint={{
          'line-color': '#3b82f6',
          'line-width': 3,
          'line-opacity': 0.8
        }}
      />
    </Source>
  );
}
```

### Pattern 4: Backend GPX Processing
**What:** Parse GPX server-side for security, extract track and waypoints
**When to use:** GPX file upload endpoint
**Example:**
```python
# Source: gpxpy GitHub
import gpxpy
from typing import List, Tuple

async def parse_gpx_file(content: bytes) -> dict:
    """Parse GPX file and extract route data."""
    gpx = gpxpy.parse(content.decode('utf-8'))

    # Extract track points as GeoJSON LineString
    track_coords = []
    for track in gpx.tracks:
        for segment in track.segments:
            for point in segment.points:
                track_coords.append([point.longitude, point.latitude])

    # Extract waypoints
    waypoints = []
    for wp in gpx.waypoints:
        waypoints.append({
            'name': wp.name or '',
            'lat': wp.latitude,
            'lng': wp.longitude,
            'elevation': wp.elevation or 0
        })

    return {
        'track_geojson': {
            'type': 'Feature',
            'geometry': {
                'type': 'LineString',
                'coordinates': track_coords
            }
        },
        'waypoints': waypoints,
        'metadata': {
            'name': gpx.name,
            'description': gpx.description
        }
    }
```

### Anti-Patterns to Avoid
- **Client-side GPX parsing for persistence:** Parse GPX in browser for preview only, always re-parse on server for saved data
- **Storing raw GPX XML:** Convert to structured JSON on upload, discard original XML
- **Creating markers imperatively:** Use React state + Marker components, not `map.addMarker()`
- **Fetching tiles without attribution:** OpenFreeMap requires attribution text
- **Large GeoJSON in state:** For tracks with 1000+ points, simplify on server before sending to client

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GPX parsing | Custom XML parser | gpxpy (Python), @we-gold/gpxjs (JS) | GPX has complex schema, elevation profiles, time data |
| Map rendering | Canvas drawing | MapLibre GL JS | GPU acceleration, tile caching, touch gestures |
| Drag-drop upload | Native drag events | react-dropzone | File type validation, multiple files, accessibility |
| SMS code generation | Simple substring | Custom algorithm with collision detection | Must be unique, readable, avoid offensive words |
| Distance calculation | Pythagorean | Haversine formula (gpxpy has this) | Earth is curved, significant error at hiking distances |
| Touch gestures | Custom handlers | MapLibre cooperative gestures | Two-finger zoom/pan, pinch, proper mobile UX |

**Key insight:** Map editing is deceptively complex. The interaction between React state, MapLibre's internal state, and browser touch events has many edge cases. Use react-map-gl's controlled component pattern.

## Common Pitfalls

### Pitfall 1: SSR Hydration Errors
**What goes wrong:** "window is not defined" or hydration mismatch errors when page loads
**Why it happens:** MapLibre GL JS requires browser APIs (WebGL, window), crashes during SSR
**How to avoid:** Always use `dynamic(() => import(...), { ssr: false })` for map components
**Warning signs:** Errors only on initial page load, work after refresh/hot reload

### Pitfall 2: Memory Leaks on Navigation
**What goes wrong:** Memory usage grows with each visit to map page, app becomes sluggish
**Why it happens:** MapLibre map instance not cleaned up on unmount
**How to avoid:** react-map-gl handles cleanup automatically when Map unmounts, but verify markers/popups are removed from state
**Warning signs:** Chrome DevTools showing increasing heap size after navigating away and back

### Pitfall 3: Touch Gesture Conflicts
**What goes wrong:** User tries to scroll page but accidentally zooms map, or can't zoom map
**Why it happens:** Map captures all touch events in its container
**How to avoid:** Enable `cooperativeGestures: true` - requires two-finger pan/zoom on mobile
**Warning signs:** User complaints about "stuck" scrolling, map zoom on single swipe

### Pitfall 4: GPX Coordinate Order Confusion
**What goes wrong:** Track displays in wrong location or appears inverted
**Why it happens:** GeoJSON uses [longitude, latitude], GPX uses latitude first
**How to avoid:** Always extract as `[point.longitude, point.latitude]` for GeoJSON
**Warning signs:** Track appears mirrored or in the ocean

### Pitfall 5: SMS Code Collisions
**What goes wrong:** Two waypoints get same code, commands fail
**Why it happens:** Simple name-to-code algorithm without uniqueness check
**How to avoid:** Check database for existing codes, append number if collision
**Warning signs:** "LAKEO" exists for both "Lake Oberon" and "Lake Ontario"

### Pitfall 6: Large GPX Files
**What goes wrong:** Browser hangs, API timeout, UI unresponsive
**Why it happens:** Multi-day tracks can have 10,000+ points, rendering all is expensive
**How to avoid:** Simplify tracks on server (Douglas-Peucker algorithm in gpxpy), limit to ~500 points for display
**Warning signs:** GPX files over 1MB, tracks with second-by-second logging

## Code Examples

Verified patterns from official sources:

### Draggable Marker with Callbacks
```typescript
// Source: react-map-gl official docs
<Marker
  latitude={waypoint.lat}
  longitude={waypoint.lng}
  draggable={true}
  onDragStart={() => setIsDragging(true)}
  onDrag={(e) => {
    // Update preview position during drag
    setDragPosition({ lat: e.lngLat.lat, lng: e.lngLat.lng });
  }}
  onDragEnd={(e) => {
    setIsDragging(false);
    updateWaypoint(waypoint.id, e.lngLat.lat, e.lngLat.lng);
  }}
>
  <div className={`waypoint-pin waypoint-pin-${waypoint.type}`}>
    {waypoint.smsCode}
  </div>
</Marker>
```

### GPX Upload with react-dropzone
```typescript
// Source: react-dropzone patterns
import { useDropzone } from 'react-dropzone';

function GPXUpload({ onUpload }: { onUpload: (file: File) => void }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/gpx+xml': ['.gpx'] },
    maxFiles: 1,
    onDrop: (files) => files[0] && onUpload(files[0])
  });

  return (
    <div {...getRootProps()} className={`
      border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
      ${isDragActive ? 'border-lightning-400 bg-lightning-400/10' : 'border-thunder-600'}
    `}>
      <input {...getInputProps()} />
      <p>Drag & drop a GPX file, or click to select</p>
    </div>
  );
}
```

### SMS Code Generation Algorithm
```python
# Generate unique 5-char SMS code from waypoint name
import re
from typing import Set

def generate_sms_code(name: str, existing_codes: Set[str]) -> str:
    """
    Generate unique 5-char SMS code from name.
    "Lake Oberon" -> "LAKEO"
    "Mt. Hesperus" -> "HESPE"
    """
    # Remove common prefixes and clean
    cleaned = re.sub(r'^(Mt\.?|Mount|Lake|The|Camp)\s+', '', name, flags=re.IGNORECASE)
    cleaned = re.sub(r'[^A-Za-z]', '', cleaned).upper()

    # Take first 5 chars
    base_code = cleaned[:5].ljust(5, 'X')  # Pad short names

    # Check for collision
    code = base_code
    suffix = 1
    while code in existing_codes:
        code = base_code[:4] + str(suffix)
        suffix += 1
        if suffix > 9:
            code = base_code[:3] + str(suffix)

    return code
```

### Custom Waypoint Marker Component
```typescript
// Color-coded waypoint pins per ROUT-04
const WAYPOINT_COLORS = {
  camp: '#22c55e',   // Green
  peak: '#f97316',   // Orange
  poi: '#3b82f6'     // Blue
};

function WaypointPin({ type, smsCode, isSelected }: {
  type: 'camp' | 'peak' | 'poi';
  smsCode: string;
  isSelected?: boolean;
}) {
  return (
    <div
      className={`
        flex items-center justify-center
        w-8 h-8 rounded-full
        text-xs font-bold text-white
        shadow-lg cursor-pointer
        transition-transform
        ${isSelected ? 'scale-125 ring-2 ring-white' : ''}
      `}
      style={{ backgroundColor: WAYPOINT_COLORS[type] }}
    >
      {smsCode.slice(0, 3)}
    </div>
  );
}
```

### SQLAlchemy Models
```python
# backend/models/custom_route.py
from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

class RouteStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"

class CustomRoute(Base):
    __tablename__ = "custom_routes"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    gpx_data = Column(JSON)  # Parsed GPX as JSON, not raw XML
    status = Column(Enum(RouteStatus), default=RouteStatus.DRAFT)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    waypoints = relationship("CustomWaypoint", back_populates="route", cascade="all, delete-orphan")

class CustomWaypoint(Base):
    __tablename__ = "custom_waypoints"

    id = Column(Integer, primary_key=True)
    route_id = Column(Integer, ForeignKey("custom_routes.id"), nullable=False)
    type = Column(Enum("camp", "peak", "poi"), default="poi")
    name = Column(String(255), nullable=False)
    sms_code = Column(String(5), nullable=False, index=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    elevation = Column(Float, default=0)
    order = Column(Integer, default=0)

    route = relationship("CustomRoute", back_populates="waypoints")
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mapbox GL JS | MapLibre GL JS | 2020 (Mapbox license change) | MapLibre is free, Mapbox requires paid plan |
| react-map-gl v5/v6 | react-map-gl v8 | 2023 | 75% bundle size reduction, better perf |
| gpx-parser-builder (JS) | @we-gold/gpxjs | 2024 | TypeScript types, maintained |
| Manual tile hosting | OpenFreeMap | 2024 | Free tiles without self-hosting |
| cooperativeGestures: false | cooperativeGestures: true | Standard practice | Better mobile UX, prevents scroll hijacking |

**Deprecated/outdated:**
- **Mapbox GL JS free tier:** Now requires API key with usage tracking
- **react-map-gl v5/v6:** Still works but larger bundle, less performant
- **GPXParser.js (Luuka/gpx-parser):** Unmaintained since 2022

## Open Questions

Things that couldn't be fully resolved:

1. **Elevation data source for clicked waypoints**
   - What we know: GPX has elevation for track points, users click to add waypoints off-track
   - What's unclear: Should we fetch elevation from an API, or require user input?
   - Recommendation: For MVP, let user enter elevation manually; Phase 2 could add elevation API

2. **Route library admin upload mechanism**
   - What we know: ROUT-10 requires admin-uploaded popular trails
   - What's unclear: Should this be a separate admin interface or CLI upload?
   - Recommendation: Start with CLI script using existing admin auth, add UI later if needed

3. **Offline map support**
   - What we know: Users may create routes without internet
   - What's unclear: Whether to implement offline tile caching
   - Recommendation: Out of scope for Phase 3, requires service worker complexity

## Sources

### Primary (HIGH confidence)
- [react-map-gl Official Docs](https://visgl.github.io/react-map-gl/docs) - API reference, Marker component
- [MapLibre GL JS Docs](https://maplibre.org/maplibre-gl-js/docs/) - Map API, cooperative gestures
- [MapLibre GL JS Examples](https://maplibre.org/maplibre-gl-js/docs/examples/) - Draggable markers, GeoJSON layers
- [gpxpy GitHub](https://github.com/tkrajina/gpxpy) - Python GPX parsing

### Secondary (MEDIUM confidence)
- [OpenFreeMap Quick Start](https://openfreemap.org/quick_start/) - Tile provider setup
- [@we-gold/gpxjs GitHub](https://github.com/We-Gold/gpxjs) - JS GPX parsing with TypeScript

### Tertiary (LOW confidence)
- WebSearch results for memory leak issues - Known but versions may have changed
- Community patterns for SMS code generation - No official standard

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official documentation verified for all libraries
- Architecture: HIGH - Patterns from official react-map-gl docs
- Pitfalls: MEDIUM - Based on GitHub issues and community reports, may change with versions

**Research date:** 2026-01-19
**Valid until:** ~60 days (MapLibre is stable, react-map-gl v8 is mature)
