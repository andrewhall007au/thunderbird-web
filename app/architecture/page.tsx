'use client';

import React from 'react';

export default function ArchitecturePage() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-emerald-400">
          Thunderbird Global - Technical Architecture
        </h1>
        <p className="text-gray-400 mb-8">
          SMS-based precision weather forecasts for hikers worldwide
        </p>

        {/* System Overview */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-emerald-300">System Overview</h2>
          <div className="bg-gray-800 rounded-lg p-6 font-mono text-sm">
            <pre className="text-emerald-200 whitespace-pre-wrap">{`
┌─────────────────────────────────────────────────────────────────────────────┐
│                         THUNDERBIRD GLOBAL                                   │
│                    Precision Hiking Weather System                           │
└─────────────────────────────────────────────────────────────────────────────┘

User Input                    Processing                      Output
─────────────                ──────────                      ──────

┌──────────────┐     ┌─────────────────────────┐     ┌──────────────────┐
│  GPX File    │────▶│  Route Parser           │────▶│  Waypoint List   │
│  (required)  │     │  - Extract waypoints    │     │  - lat, lon      │
│              │     │  - Parse <ele> tags     │     │  - elevation     │
└──────────────┘     └─────────────────────────┘     └────────┬─────────┘
                                                              │
                                                              ▼
┌──────────────┐     ┌─────────────────────────┐     ┌──────────────────┐
│  Country     │────▶│  Weather Router         │────▶│  Provider        │
│  Detection   │     │  - Maps country→API     │     │  Selection       │
│  (from GPS)  │     │  - Best resolution      │     │                  │
└──────────────┘     └─────────────────────────┘     └────────┬─────────┘
                                                              │
                                                              ▼
                     ┌─────────────────────────┐     ┌──────────────────┐
                     │  Weather API Call       │────▶│  Raw Forecast    │
                     │  - NWS / BOM / EC /etc  │     │  + Grid Elevation│
                     └─────────────────────────┘     └────────┬─────────┘
                                                              │
                                                              ▼
┌──────────────┐     ┌─────────────────────────┐     ┌──────────────────┐
│  GPX         │────▶│  Elevation Correction   │────▶│  Adjusted Temps  │
│  Elevation   │     │  Lapse Rate: 6.5°C/km   │     │  (accurate for   │
│  (accurate)  │     │                         │     │   user's point)  │
└──────────────┘     └─────────────────────────┘     └────────┬─────────┘
                                                              │
                                                              ▼
                     ┌─────────────────────────┐     ┌──────────────────┐
                     │  SMS Formatter          │────▶│  Forecast SMS    │
                     │  - Compact encoding     │     │  Delivered to    │
                     │  - Danger ratings       │     │  User's Phone    │
                     └─────────────────────────┘     └──────────────────┘
`}</pre>
          </div>
        </section>

        {/* Weather Provider Resolution */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-emerald-300">Weather Provider Resolution</h2>
          <div className="overflow-x-auto">
            <table className="w-full bg-gray-800 rounded-lg">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-4 text-emerald-400">Country</th>
                  <th className="text-left p-4 text-emerald-400">Primary Provider</th>
                  <th className="text-left p-4 text-emerald-400">Resolution</th>
                  <th className="text-left p-4 text-emerald-400">Fallback</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-b border-gray-700">
                  <td className="p-4">US</td>
                  <td className="p-4">NWS (National Weather Service)</td>
                  <td className="p-4 text-yellow-400">2.5km</td>
                  <td className="p-4">Open-Meteo</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="p-4">AU</td>
                  <td className="p-4">BOM (Bureau of Meteorology)</td>
                  <td className="p-4 text-yellow-400">2.2km</td>
                  <td className="p-4">Open-Meteo</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="p-4">CA</td>
                  <td className="p-4">Environment Canada (HRDPS)</td>
                  <td className="p-4 text-yellow-400">2.5km</td>
                  <td className="p-4">Open-Meteo</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="p-4">GB</td>
                  <td className="p-4">Met Office (IMPROVER)</td>
                  <td className="p-4 text-green-400">1.5km</td>
                  <td className="p-4">Open-Meteo</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="p-4">FR</td>
                  <td className="p-4">Open-Meteo (Meteo-France AROME)</td>
                  <td className="p-4 text-green-400">1.5km</td>
                  <td className="p-4">-</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="p-4">CH</td>
                  <td className="p-4">Open-Meteo (MeteoSwiss ICON-CH2)</td>
                  <td className="p-4 text-green-400">2km</td>
                  <td className="p-4">-</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="p-4">NZ, ZA</td>
                  <td className="p-4">Open-Meteo (ECMWF)</td>
                  <td className="p-4 text-orange-400">9km</td>
                  <td className="p-4">-</td>
                </tr>
                <tr>
                  <td className="p-4">Other</td>
                  <td className="p-4">Open-Meteo (best_match)</td>
                  <td className="p-4 text-red-400">~25km</td>
                  <td className="p-4">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Elevation Correction - Critical Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-emerald-300">
            Elevation Correction (Critical for Accuracy)
          </h2>

          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold mb-3 text-yellow-400">The Problem</h3>
            <p className="text-gray-300 mb-4">
              Weather APIs return temperatures valid for their <strong>grid cell elevation</strong>,
              not the user's exact point. In mountainous terrain, a 2.5km grid cell can have
              1,000+ meters of elevation variance.
            </p>

            <div className="bg-gray-900 rounded p-4 font-mono text-sm mb-4">
              <p className="text-red-400">Example: Mt Elbert Trailhead, Colorado</p>
              <p className="text-gray-400">├─ User's GPX elevation: 3,048m (accurate from GPS)</p>
              <p className="text-gray-400">├─ NWS grid cell elevation: 4,043m (includes mountain)</p>
              <p className="text-gray-400">├─ Difference: +995m</p>
              <p className="text-gray-400">└─ Temperature error without correction: <span className="text-red-400">-6.5°C too cold!</span></p>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold mb-3 text-green-400">The Solution</h3>
            <div className="bg-gray-900 rounded p-4 font-mono text-sm">
              <pre className="text-emerald-200">{`
┌─────────────────────────────────────────────────────────────────┐
│                   ELEVATION CORRECTION FLOW                      │
└─────────────────────────────────────────────────────────────────┘

1. GPX File Provides:
   └─ Exact elevation for each waypoint (GPS-derived, accurate)

2. Weather API Returns:
   ├─ grid_elevation: Average elevation of the 2.5km grid cell
   └─ raw_temperature: Valid at 2m above grid_elevation

3. Lapse Rate Correction Applied:
   ┌────────────────────────────────────────────────────────────┐
   │  adjustment = (grid_elevation - gpx_elevation) × 0.0065   │
   │                                                            │
   │  adjusted_temp = raw_temp + adjustment                     │
   └────────────────────────────────────────────────────────────┘

4. Example Calculation:
   ├─ grid_elevation = 4,043m (from NWS /gridpoints API)
   ├─ gpx_elevation = 3,048m (from GPX <ele> tag)
   ├─ difference = 995m
   ├─ adjustment = 995 × 0.0065 = +6.47°C
   │
   ├─ raw_temp from NWS = -13°C (valid at 4,043m)
   └─ adjusted_temp = -13 + 6.47 = -6.5°C (valid at user's 3,048m)
`}</pre>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-3 text-blue-400">Provider Elevation Behavior</h3>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-3 text-emerald-400">Provider</th>
                  <th className="text-left p-3 text-emerald-400">Elevation Type Returned</th>
                  <th className="text-left p-3 text-emerald-400">Correction Needed?</th>
                </tr>
              </thead>
              <tbody className="text-gray-300 text-sm">
                <tr className="border-b border-gray-700">
                  <td className="p-3">NWS (US)</td>
                  <td className="p-3">Grid cell midpoint/average (2.5km)</td>
                  <td className="p-3 text-yellow-400">YES - apply lapse rate</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="p-3">BOM (AU)</td>
                  <td className="p-3">Model orography (2.2km grid average)</td>
                  <td className="p-3 text-yellow-400">YES - apply lapse rate</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="p-3">Environment Canada</td>
                  <td className="p-3">Model orography (2.5km HRDPS)</td>
                  <td className="p-3 text-yellow-400">YES - apply lapse rate</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="p-3">Met Office (UK)</td>
                  <td className="p-3">Point elevation (IMPROVER corrects)</td>
                  <td className="p-3 text-green-400">NO - already site-specific</td>
                </tr>
                <tr>
                  <td className="p-3">Open-Meteo</td>
                  <td className="p-3">90m DEM (with lapse rate pre-applied)</td>
                  <td className="p-3 text-yellow-400">MAYBE - DEM can be wrong near peaks</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Data Flow */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-emerald-300">Complete Data Flow</h2>
          <div className="bg-gray-800 rounded-lg p-6 font-mono text-sm">
            <pre className="text-emerald-200 whitespace-pre-wrap">{`
STEP 1: USER UPLOADS GPX
────────────────────────
User uploads GPX file (or selects pre-configured trail)
  ↓
Parse GPX → Extract waypoints with:
  - Latitude, Longitude (GPS coordinates)
  - Elevation (from <ele> tag - GPS-derived, accurate)
  - Name/Type (camp, peak, trailhead, etc.)


STEP 2: COUNTRY DETECTION & PROVIDER ROUTING
────────────────────────────────────────────
Detect country from GPS coordinates
  ↓
Weather Router selects optimal provider:
  - US → NWS (2.5km resolution)
  - AU → BOM (2.2km resolution)
  - CA → Environment Canada (2.5km)
  - GB → Met Office IMPROVER (1.5km)
  - FR → Open-Meteo Meteo-France (1.5km)
  - CH → Open-Meteo MeteoSwiss (2km)
  - etc.


STEP 3: WEATHER API CALL
────────────────────────
Call selected provider's API with lat/lon
  ↓
API Returns:
  - grid_elevation: Elevation the temps are valid for
  - temperature, precipitation, wind, etc.
  - 7-16 day forecast depending on provider


STEP 4: ELEVATION CORRECTION
────────────────────────────
For each waypoint:
  ↓
  diff = grid_elevation - gpx_elevation
  adjustment = diff × 0.0065 (°C per meter)
  adjusted_temp = raw_temp + adjustment


STEP 5: DANGER RATING CALCULATION
─────────────────────────────────
Analyze conditions for hiking hazards:
  - Wind speed > threshold → Wind danger
  - Freezing level < waypoint elevation → Ice danger
  - Cloud base < waypoint elevation → Whiteout risk
  - Heavy precipitation → Exposure risk
  - CAPE > 400 → Thunderstorm risk


STEP 6: SMS FORMATTING & DELIVERY
─────────────────────────────────
Compact the forecast into SMS format:
  ↓
Day|Tmp|%Rn|Rn|Sn|Wa|Wm|%Cd|CB|FL|D
7a |12 |30 |0-2|0 |25|40|60 |15|32|!
  ↓
Send via Twilio to user's phone
`}</pre>
          </div>
        </section>

        {/* API Endpoints */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-emerald-300">Key API Endpoints</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-yellow-400 mb-2">Backend (FastAPI)</h3>
              <ul className="text-gray-300 text-sm space-y-1">
                <li><code className="text-emerald-400">POST /webhook/sms/inbound</code> - Twilio SMS handler</li>
                <li><code className="text-emerald-400">GET /api/routes</code> - List available routes</li>
                <li><code className="text-emerald-400">GET /api/forecast/{'{route_id}'}/{'{cell_id}'}</code> - Get forecast</li>
                <li><code className="text-emerald-400">GET /admin</code> - Admin dashboard</li>
                <li><code className="text-emerald-400">POST /admin/push/{'{phone}'}</code> - Manual forecast push</li>
              </ul>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-yellow-400 mb-2">External APIs</h3>
              <ul className="text-gray-300 text-sm space-y-1">
                <li><code className="text-emerald-400">api.weather.gov</code> - NWS (US)</li>
                <li><code className="text-emerald-400">api.weather.bom.gov.au</code> - BOM (AU)</li>
                <li><code className="text-emerald-400">api.open-meteo.com</code> - Open-Meteo (Global)</li>
                <li><code className="text-emerald-400">data.hub.api.metoffice.gov.uk</code> - Met Office (UK)</li>
                <li><code className="text-emerald-400">api.opentopodata.org</code> - Elevation lookup</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-emerald-300">Technology Stack</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-yellow-400 mb-2">Backend</h3>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>Python 3.11+</li>
                <li>FastAPI</li>
                <li>SQLite / PostgreSQL</li>
                <li>APScheduler</li>
                <li>httpx (async HTTP)</li>
              </ul>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-yellow-400 mb-2">Frontend</h3>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>Next.js 14</li>
                <li>React 18</li>
                <li>TypeScript</li>
                <li>Tailwind CSS</li>
                <li>Mapbox GL JS</li>
              </ul>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-yellow-400 mb-2">Infrastructure</h3>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>Twilio (SMS)</li>
                <li>Vercel (Frontend)</li>
                <li>Railway/Render (Backend)</li>
                <li>GitHub Actions (CI/CD)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-gray-500 text-sm pt-8 border-t border-gray-700">
          <p>Thunderbird Global - Precision Weather for Hikers</p>
          <p className="mt-2">
            Demo running locally at{' '}
            <code className="text-emerald-400">localhost:3000</code> (frontend) and{' '}
            <code className="text-emerald-400">localhost:8001</code> (backend)
          </p>
        </footer>
      </div>
    </div>
  );
}
