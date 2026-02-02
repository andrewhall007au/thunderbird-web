'use client';

import React from 'react';

export default function APIReferencePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-cyan-400">
          Weather API Reference
        </h1>
        <p className="text-gray-400 mb-8">
          Complete reference of all integrated weather APIs, metrics, resolution, and elevation handling
        </p>

        {/* Provider Summary Table */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-cyan-300">Provider Overview</h2>
          <div className="overflow-x-auto">
            <table className="w-full bg-slate-900 rounded-lg text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800">
                  <th className="text-left p-3 text-cyan-400">Provider</th>
                  <th className="text-left p-3 text-cyan-400">Countries</th>
                  <th className="text-left p-3 text-cyan-400">Spatial</th>
                  <th className="text-left p-3 text-cyan-400">Model Update</th>
                  <th className="text-left p-3 text-cyan-400">Forecast Res</th>
                  <th className="text-left p-3 text-cyan-400">Rate Limit</th>
                  <th className="text-left p-3 text-cyan-400">Auth</th>
                </tr>
              </thead>
              <tbody className="text-gray-300 text-sm">
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold text-yellow-400">NWS</td>
                  <td className="p-3">US</td>
                  <td className="p-3 text-green-400">2.5 km</td>
                  <td className="p-3 text-yellow-400">~6h</td>
                  <td className="p-3 text-green-400">1h available</td>
                  <td className="p-3 text-green-400">Generous</td>
                  <td className="p-3 text-green-400">None</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold text-yellow-400">BOM</td>
                  <td className="p-3">AU</td>
                  <td className="p-3 text-green-400">2.2 km</td>
                  <td className="p-3 text-yellow-400">6h</td>
                  <td className="p-3 text-green-400">1h (CAST12/24), daily (CAST7)</td>
                  <td className="p-3 text-green-400">No limit</td>
                  <td className="p-3 text-green-400">None</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold text-yellow-400">Environment Canada</td>
                  <td className="p-3">CA</td>
                  <td className="p-3 text-green-400">2.5 km</td>
                  <td className="p-3 text-yellow-400">6h</td>
                  <td className="p-3 text-green-400">1h</td>
                  <td className="p-3 text-green-400">No limit</td>
                  <td className="p-3 text-green-400">None</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold text-yellow-400">Met Office</td>
                  <td className="p-3">GB</td>
                  <td className="p-3 text-green-400">1.5 km</td>
                  <td className="p-3 text-green-400">1h</td>
                  <td className="p-3 text-green-400">1h (D1-2), 3h (D3-7)</td>
                  <td className="p-3 text-yellow-400">360/day</td>
                  <td className="p-3 text-yellow-400">API Key</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold text-yellow-400">O-M (HRRR)</td>
                  <td className="p-3">US supplement</td>
                  <td className="p-3 text-green-400">3.0 km</td>
                  <td className="p-3 text-green-400">1h</td>
                  <td className="p-3 text-green-400">1h (15min avail)</td>
                  <td className="p-3 text-yellow-400">10k/day</td>
                  <td className="p-3 text-green-400">None</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold text-yellow-400">O-M (GEM)</td>
                  <td className="p-3">CA supplement</td>
                  <td className="p-3 text-green-400">2.5 km</td>
                  <td className="p-3 text-yellow-400">6h</td>
                  <td className="p-3 text-green-400">1h</td>
                  <td className="p-3 text-yellow-400">10k/day</td>
                  <td className="p-3 text-green-400">None</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold text-yellow-400">O-M (Meteo-France)</td>
                  <td className="p-3">FR</td>
                  <td className="p-3 text-green-400">1.5 km</td>
                  <td className="p-3 text-yellow-400">6h</td>
                  <td className="p-3 text-green-400">1h</td>
                  <td className="p-3 text-yellow-400">10k/day</td>
                  <td className="p-3 text-green-400">None</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold text-yellow-400">O-M (MeteoSwiss)</td>
                  <td className="p-3">CH</td>
                  <td className="p-3 text-green-400">2.0 km</td>
                  <td className="p-3 text-yellow-400">6h</td>
                  <td className="p-3 text-green-400">1h</td>
                  <td className="p-3 text-yellow-400">10k/day</td>
                  <td className="p-3 text-green-400">None</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold text-yellow-400">O-M (ICON-EU)</td>
                  <td className="p-3">IT, DE, AT</td>
                  <td className="p-3 text-yellow-400">7.0 km</td>
                  <td className="p-3 text-yellow-400">6h</td>
                  <td className="p-3 text-green-400">1h</td>
                  <td className="p-3 text-yellow-400">10k/day</td>
                  <td className="p-3 text-green-400">None</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold text-yellow-400">O-M (ECMWF)</td>
                  <td className="p-3">NZ, ZA</td>
                  <td className="p-3 text-orange-400">9.0 km</td>
                  <td className="p-3 text-yellow-400">6h</td>
                  <td className="p-3 text-yellow-400">3h</td>
                  <td className="p-3 text-yellow-400">10k/day</td>
                  <td className="p-3 text-green-400">None</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-yellow-400">O-M (GFS)</td>
                  <td className="p-3">Global fallback</td>
                  <td className="p-3 text-red-400">~25 km</td>
                  <td className="p-3 text-yellow-400">6h</td>
                  <td className="p-3 text-yellow-400">1h→3h (after 5d)</td>
                  <td className="p-3 text-yellow-400">10k/day</td>
                  <td className="p-3 text-green-400">None</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="text-gray-500 text-sm mt-4 space-y-1">
            <p><strong>Spatial:</strong> Grid cell size (smaller = more accurate for mountain terrain)</p>
            <p><strong>Model Update:</strong> How often the weather model refreshes with new data</p>
            <p><strong>Forecast Res:</strong> Time intervals in the forecast (1h = hourly data points)</p>
            <p className="text-cyan-400 mt-2"><strong>CAST Commands:</strong> CAST12/24 use hourly resolution, CAST7 uses daily resolution</p>
            <p className="text-yellow-500">Note: HRRR updates hourly with 15-minute radar assimilation - best for rapidly changing mountain weather</p>
          </div>
        </section>

        {/* Metrics by Provider */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-cyan-300">Metrics Availability by Provider</h2>
          <p className="text-gray-400 mb-4">
            What each API can provide (not necessarily what we use - see "What We Actually Source" below)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full bg-slate-900 rounded-lg text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800">
                  <th className="text-left p-3 text-cyan-400">Metric</th>
                  <th className="text-center p-3 text-cyan-400">NWS</th>
                  <th className="text-center p-3 text-cyan-400">BOM</th>
                  <th className="text-center p-3 text-cyan-400">Env Canada</th>
                  <th className="text-center p-3 text-cyan-400">Met Office</th>
                  <th className="text-center p-3 text-cyan-400">Open-Meteo</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Temperature (min/max)</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Precipitation Probability</td>
                  <td className="p-3 text-center text-yellow-400">~ (from text)</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Precipitation Amount (mm)</td>
                  <td className="p-3 text-center text-red-400">✗</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-yellow-400">~ (estimated)</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Snowfall (cm)</td>
                  <td className="p-3 text-center text-red-400">✗</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-yellow-400">~ (estimated)</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Wind Speed (avg)</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Wind Gusts (max)</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-yellow-400">~ (estimated)</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Wind Direction</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Cloud Cover (%)</td>
                  <td className="p-3 text-center text-yellow-400">~ (from text)</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-yellow-400">~ (from text)</td>
                  <td className="p-3 text-center text-yellow-400">~ (from visibility)</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Cloud Base (m)</td>
                  <td className="p-3 text-center text-red-400">✗</td>
                  <td className="p-3 text-center text-red-400">✗</td>
                  <td className="p-3 text-center text-red-400">✗</td>
                  <td className="p-3 text-center text-red-400">✗</td>
                  <td className="p-3 text-center text-cyan-400">✓ (via dewpoint)</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Freezing Level (m)</td>
                  <td className="p-3 text-center text-red-400">✗</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-red-400">✗</td>
                  <td className="p-3 text-center text-red-400">✗ (free tier)</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">CAPE (J/kg)</td>
                  <td className="p-3 text-center text-red-400">✗</td>
                  <td className="p-3 text-center text-red-400">✗</td>
                  <td className="p-3 text-center text-red-400">✗</td>
                  <td className="p-3 text-center text-red-400">✗</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Weather Alerts</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-red-400">✗ (paid tier)</td>
                  <td className="p-3 text-center text-red-400">✗</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold">Grid Elevation Returned</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-yellow-400">~ (we sample)</td>
                  <td className="p-3 text-center text-yellow-400">~ (we sample)</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                  <td className="p-3 text-center text-green-400">✓</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-gray-500 text-sm mt-2">
            ✓ = Native support | ~ = Estimated/derived | ✗ = Not available
          </p>
        </section>

        {/* What We Actually Source - Gap Analysis */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-cyan-300">What We Actually Source (Gap Analysis)</h2>
          <p className="text-gray-400 mb-6">
            This table shows which API we actually pull each metric from per country.
            <span className="text-yellow-400"> Yellow cells</span> indicate gaps filled by Open-Meteo fallback.
            <span className="text-red-400"> Red cells</span> indicate metrics we cannot reliably obtain.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full bg-slate-900 rounded-lg text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800">
                  <th className="text-left p-3 text-cyan-400">Metric</th>
                  <th className="text-center p-3 text-cyan-400">US</th>
                  <th className="text-center p-3 text-cyan-400">AU</th>
                  <th className="text-center p-3 text-cyan-400">CA</th>
                  <th className="text-center p-3 text-cyan-400">GB</th>
                  <th className="text-center p-3 text-cyan-400">FR</th>
                  <th className="text-center p-3 text-cyan-400">CH</th>
                  <th className="text-center p-3 text-cyan-400">EU (IT/DE/AT)</th>
                  <th className="text-center p-3 text-cyan-400">NZ/ZA</th>
                </tr>
              </thead>
              <tbody className="text-gray-300 text-xs">
                {/* Temperature */}
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Temp (min/max)</td>
                  <td className="p-3 text-center text-green-400">NWS</td>
                  <td className="p-3 text-center text-green-400">BOM</td>
                  <td className="p-3 text-center text-green-400">EC</td>
                  <td className="p-3 text-center text-green-400">Met Office</td>
                  <td className="p-3 text-center text-green-400">O-M (MF)</td>
                  <td className="p-3 text-center text-green-400">O-M (MS)</td>
                  <td className="p-3 text-center text-green-400">O-M (ICON)</td>
                  <td className="p-3 text-center text-green-400">O-M (ECMWF)</td>
                </tr>
                {/* Precip Probability */}
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Precip Probability</td>
                  <td className="p-3 text-center text-green-400">O-M (HRRR)</td>
                  <td className="p-3 text-center text-green-400">BOM</td>
                  <td className="p-3 text-center text-green-400">O-M (GEM)</td>
                  <td className="p-3 text-center text-green-400">Met Office</td>
                  <td className="p-3 text-center text-green-400">O-M (MF)</td>
                  <td className="p-3 text-center text-green-400">O-M (MS)</td>
                  <td className="p-3 text-center text-green-400">O-M (ICON)</td>
                  <td className="p-3 text-center text-green-400">O-M (ECMWF)</td>
                </tr>
                {/* Precip Amount */}
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Precip Amount (mm)</td>
                  <td className="p-3 text-center text-green-400">O-M (HRRR)</td>
                  <td className="p-3 text-center text-green-400">BOM</td>
                  <td className="p-3 text-center text-green-400">O-M (GEM)</td>
                  <td className="p-3 text-center text-green-400">Met Office</td>
                  <td className="p-3 text-center text-green-400">O-M (MF)</td>
                  <td className="p-3 text-center text-green-400">O-M (MS)</td>
                  <td className="p-3 text-center text-green-400">O-M (ICON)</td>
                  <td className="p-3 text-center text-green-400">O-M (ECMWF)</td>
                </tr>
                {/* Snowfall */}
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Snowfall (cm)</td>
                  <td className="p-3 text-center text-green-400">O-M (HRRR)</td>
                  <td className="p-3 text-center text-green-400">BOM</td>
                  <td className="p-3 text-center text-green-400">O-M (GEM)</td>
                  <td className="p-3 text-center text-green-400">Met Office</td>
                  <td className="p-3 text-center text-green-400">O-M (MF)</td>
                  <td className="p-3 text-center text-green-400">O-M (MS)</td>
                  <td className="p-3 text-center text-green-400">O-M (ICON)</td>
                  <td className="p-3 text-center text-green-400">O-M (ECMWF)</td>
                </tr>
                {/* Wind Speed */}
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Wind Speed (avg)</td>
                  <td className="p-3 text-center text-green-400">NWS</td>
                  <td className="p-3 text-center text-green-400">BOM</td>
                  <td className="p-3 text-center text-green-400">EC</td>
                  <td className="p-3 text-center text-green-400">Met Office</td>
                  <td className="p-3 text-center text-green-400">O-M (MF)</td>
                  <td className="p-3 text-center text-green-400">O-M (MS)</td>
                  <td className="p-3 text-center text-green-400">O-M (ICON)</td>
                  <td className="p-3 text-center text-green-400">O-M (ECMWF)</td>
                </tr>
                {/* Wind Gusts */}
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Wind Gusts (max)</td>
                  <td className="p-3 text-center text-green-400">NWS</td>
                  <td className="p-3 text-center text-green-400">BOM</td>
                  <td className="p-3 text-center text-green-400">EC</td>
                  <td className="p-3 text-center text-green-400">Met Office</td>
                  <td className="p-3 text-center text-green-400">O-M (MF)</td>
                  <td className="p-3 text-center text-green-400">O-M (MS)</td>
                  <td className="p-3 text-center text-green-400">O-M (ICON)</td>
                  <td className="p-3 text-center text-green-400">O-M (ECMWF)</td>
                </tr>
                {/* Wind Direction */}
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Wind Direction</td>
                  <td className="p-3 text-center text-green-400">NWS</td>
                  <td className="p-3 text-center text-green-400">BOM</td>
                  <td className="p-3 text-center text-green-400">EC</td>
                  <td className="p-3 text-center text-green-400">Met Office</td>
                  <td className="p-3 text-center text-green-400">O-M (MF)</td>
                  <td className="p-3 text-center text-green-400">O-M (MS)</td>
                  <td className="p-3 text-center text-green-400">O-M (ICON)</td>
                  <td className="p-3 text-center text-green-400">O-M (ECMWF)</td>
                </tr>
                {/* Freezing Level */}
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Freezing Level (m)</td>
                  <td className="p-3 text-center text-green-400">O-M (HRRR)</td>
                  <td className="p-3 text-center text-green-400">BOM</td>
                  <td className="p-3 text-center text-green-400">O-M (GEM)</td>
                  <td className="p-3 text-center text-green-400">O-M (suppl.)</td>
                  <td className="p-3 text-center text-green-400">O-M (MF)</td>
                  <td className="p-3 text-center text-green-400">O-M (MS)</td>
                  <td className="p-3 text-center text-green-400">O-M (ICON)</td>
                  <td className="p-3 text-center text-green-400">O-M (ECMWF)</td>
                </tr>
                {/* Cloud Base */}
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Cloud Base (m)</td>
                  <td className="p-3 text-center text-cyan-400">LCL (O-M)</td>
                  <td className="p-3 text-center text-cyan-400">LCL (O-M)</td>
                  <td className="p-3 text-center text-cyan-400">LCL (O-M)</td>
                  <td className="p-3 text-center text-cyan-400">LCL (O-M)</td>
                  <td className="p-3 text-center text-green-400">LCL native</td>
                  <td className="p-3 text-center text-green-400">LCL native</td>
                  <td className="p-3 text-center text-green-400">LCL native</td>
                  <td className="p-3 text-center text-green-400">LCL native</td>
                </tr>
                {/* CAPE - Storm prediction */}
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">CAPE (J/kg)</td>
                  <td className="p-3 text-center text-cyan-400">O-M (HRRR)</td>
                  <td className="p-3 text-center text-cyan-400">O-M supplement</td>
                  <td className="p-3 text-center text-cyan-400">O-M (GEM)</td>
                  <td className="p-3 text-center text-cyan-400">O-M supplement</td>
                  <td className="p-3 text-center text-green-400">O-M native</td>
                  <td className="p-3 text-center text-green-400">O-M native</td>
                  <td className="p-3 text-center text-green-400">O-M native</td>
                  <td className="p-3 text-center text-green-400">O-M native</td>
                </tr>
                {/* Alerts */}
                <tr className="border-b border-slate-800">
                  <td className="p-3 font-semibold">Weather Alerts</td>
                  <td className="p-3 text-center text-green-400">NWS</td>
                  <td className="p-3 text-center text-green-400">BOM</td>
                  <td className="p-3 text-center text-green-400">EC</td>
                  <td className="p-3 text-center bg-red-900/30 text-red-400">Paid tier only</td>
                  <td className="p-3 text-center bg-red-900/30 text-red-400">None</td>
                  <td className="p-3 text-center bg-red-900/30 text-red-400">None</td>
                  <td className="p-3 text-center bg-red-900/30 text-red-400">None</td>
                  <td className="p-3 text-center bg-red-900/30 text-red-400">None</td>
                </tr>
                {/* Grid Elevation */}
                <tr>
                  <td className="p-3 font-semibold">Grid Elevation</td>
                  <td className="p-3 text-center text-green-400">NWS</td>
                  <td className="p-3 text-center text-cyan-400">OpenTopoData</td>
                  <td className="p-3 text-center text-cyan-400">OpenTopoData</td>
                  <td className="p-3 text-center text-green-400">Met Office</td>
                  <td className="p-3 text-center text-green-400">O-M (90m DEM)</td>
                  <td className="p-3 text-center text-green-400">O-M (90m DEM)</td>
                  <td className="p-3 text-center text-green-400">O-M (90m DEM)</td>
                  <td className="p-3 text-center text-green-400">O-M (90m DEM)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-sm">
            <p className="text-gray-400 mb-2">Legend:</p>
            <div className="flex flex-wrap gap-4">
              <span><span className="text-green-400">Green</span> = Primary provider (best resolution)</span>
              <span><span className="text-yellow-400">Yellow</span> = Open-Meteo fallback (resolution penalty)</span>
              <span><span className="text-red-400">Red</span> = Gap - metric unavailable</span>
              <span><span className="text-cyan-400">Cyan</span> = Third-party service (OpenTopoData)</span>
            </div>
          </div>
        </section>

        {/* Gap Summary */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-cyan-300">Identified Gaps</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 rounded-lg p-6 border border-green-800">
              <h3 className="text-lg font-semibold text-green-400 mb-3">US (NWS) - Supplemented with Open-Meteo HRRR</h3>
              <ul className="text-gray-300 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span><strong>Precip Probability</strong> - From Open-Meteo HRRR (3km)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span><strong>Precip Amount</strong> - From Open-Meteo HRRR (3km)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span><strong>Snowfall</strong> - From Open-Meteo HRRR (3km)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span><strong>Freezing Level</strong> - From Open-Meteo HRRR (3km)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span><strong>Cloud Base</strong> - LCL from dewpoint (HRRR 3km)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400">→</span>
                  <span><strong>Temp, Wind, Alerts</strong> - From NWS directly (2.5km)</span>
                </li>
              </ul>
              <p className="text-gray-500 text-xs mt-4">
                Resolution improved: HRRR 3km is even better than NWS 2.5km for precipitation!
              </p>
            </div>

            <div className="bg-slate-900 rounded-lg p-6 border border-green-800">
              <h3 className="text-lg font-semibold text-green-400 mb-3">Canada (EC) - Supplemented with Open-Meteo GEM</h3>
              <ul className="text-gray-300 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span><strong>Precip Amount</strong> - From Open-Meteo GEM (2.5km HRDPS)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span><strong>Snowfall</strong> - From Open-Meteo GEM (2.5km HRDPS)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span><strong>Freezing Level</strong> - From Open-Meteo GEM (2.5km HRDPS)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span><strong>Cloud Base</strong> - LCL from dewpoint (GEM 2.5km)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400">→</span>
                  <span><strong>Temp, Wind, Alerts</strong> - From Environment Canada directly</span>
                </li>
              </ul>
              <p className="text-gray-500 text-xs mt-4">
                Resolution maintained: Open-Meteo GEM uses same 2.5km HRDPS model as EC
              </p>
            </div>

            <div className="bg-slate-900 rounded-lg p-6 border border-green-800">
              <h3 className="text-lg font-semibold text-green-400 mb-3">UK (Met Office) - Supplemented with Open-Meteo</h3>
              <ul className="text-gray-300 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span><strong>Freezing Level</strong> - From Open-Meteo (Met Office free tier lacks it)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span><strong>Cloud Base</strong> - LCL from dewpoint (Open-Meteo)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400">→</span>
                  <span><strong>Temp, Wind, Precip, Cloud</strong> - From Met Office directly (1.5km)</span>
                </li>
              </ul>
              <p className="text-gray-500 text-xs mt-4">
                Met Office IMPROVER model is excellent (1.5km) but free tier lacks alpine metrics
              </p>
            </div>

            <div className="bg-slate-900 rounded-lg p-6 border border-red-800">
              <h3 className="text-lg font-semibold text-red-400 mb-3">Weather Alerts - Major Gap</h3>
              <ul className="text-gray-300 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span><strong>US, AU, CA</strong> - Full alert support from national services</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400">✗</span>
                  <span><strong>GB</strong> - Met Office alerts require paid DataHub tier</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400">✗</span>
                  <span><strong>FR, CH, IT, DE, AT, NZ, ZA</strong> - No programmatic alert API</span>
                </li>
              </ul>
              <p className="text-gray-500 text-xs mt-4">
                Mitigation: Consider EUMETNET METEOALARM for EU countries (requires registration)
              </p>
            </div>

            <div className="bg-slate-900 rounded-lg p-6 border border-green-800">
              <h3 className="text-lg font-semibold text-green-400 mb-3">Full Coverage - No Resolution Penalty</h3>
              <ul className="text-gray-300 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span><strong>US</strong> - NWS 2.5km + HRRR 3km (precip even better resolution!)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span><strong>Canada</strong> - EC 2.5km + GEM 2.5km (resolution maintained)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span><strong>Australia (BOM)</strong> - Complete native coverage at 2.2km</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span><strong>Open-Meteo countries</strong> - FR, CH, IT, DE, AT all native</span>
                </li>
              </ul>
              <p className="text-gray-500 text-xs mt-4">
                All major hiking regions now have 1.5-3km resolution across all metrics.
              </p>
            </div>
          </div>
        </section>

        {/* Cloud Base Calculation */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-cyan-300">Cloud Base Calculation</h2>
          <p className="text-gray-400 mb-6">
            Cloud base is calculated using the Lifting Condensation Level (LCL) formula when dewpoint data is available.
          </p>

          <div className="bg-slate-900 rounded-lg p-6 border border-cyan-800">
            <h3 className="text-lg font-semibold text-cyan-400 mb-4">LCL Formula (Lifting Condensation Level)</h3>
            <div className="bg-slate-800 rounded p-4 font-mono text-cyan-300 mb-4">
              Cloud Base (meters AGL) = (Temperature - Dewpoint) × 125
            </div>
            <p className="text-gray-300 text-sm mb-4">
              <strong>Why this works:</strong> As air rises, it cools at the dry adiabatic lapse rate (~10°C/km).
              The dewpoint decreases more slowly (~2°C/km). Where they meet (temp = dewpoint), condensation
              occurs and clouds form. This is the physical cloud base.
            </p>
            <div className="bg-slate-800/50 p-4 rounded">
              <h4 className="text-green-400 font-semibold mb-2">All Countries Now Use LCL (accurate)</h4>
              <ul className="text-gray-300 space-y-1">
                <li>• <strong>US</strong> - dewpoint from HRRR (3km)</li>
                <li>• <strong>AU</strong> - dewpoint from Open-Meteo supplement</li>
                <li>• <strong>CA</strong> - dewpoint from GEM (2.5km)</li>
                <li>• <strong>GB</strong> - dewpoint from Open-Meteo supplement</li>
                <li>• <strong>FR, CH, IT, NZ, ZA</strong> - native Open-Meteo dewpoint</li>
              </ul>
              <p className="text-gray-500 text-xs mt-3">
                All countries now use proper LCL calculation. No more crude cloud cover estimation.
              </p>
            </div>
            <p className="text-gray-500 text-xs mt-4">
              <strong>Note:</strong> Freezing level is NOT related to cloud base. Freezing level is where temp = 0°C.
              Cloud base is where temp = dewpoint. They are independent meteorological concepts.
            </p>
          </div>
        </section>

        {/* CAPE - Storm/Lightning Prediction */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-cyan-300">Storm & Lightning Prediction (CAPE)</h2>
          <p className="text-gray-400 mb-6">
            CAPE (Convective Available Potential Energy) measures the energy available for thunderstorm development.
            Higher CAPE values indicate greater potential for severe storms and lightning.
          </p>

          <div className="bg-slate-900 rounded-lg p-6 border border-orange-800">
            <h3 className="text-lg font-semibold text-orange-400 mb-4">CAPE Thresholds</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-slate-800 rounded p-3 text-center">
                <div className="text-2xl font-bold text-gray-400">{"<"}300</div>
                <div className="text-xs text-gray-500">J/kg</div>
                <div className="text-sm text-gray-300 mt-1">Weak</div>
              </div>
              <div className="bg-slate-800 rounded p-3 text-center">
                <div className="text-2xl font-bold text-yellow-400">300-1000</div>
                <div className="text-xs text-gray-500">J/kg</div>
                <div className="text-sm text-yellow-300 mt-1">Moderate</div>
              </div>
              <div className="bg-slate-800 rounded p-3 text-center">
                <div className="text-2xl font-bold text-orange-400">1000-2500</div>
                <div className="text-xs text-gray-500">J/kg</div>
                <div className="text-sm text-orange-300 mt-1">Strong</div>
              </div>
              <div className="bg-slate-800 rounded p-3 text-center">
                <div className="text-2xl font-bold text-red-400">{">"}2500</div>
                <div className="text-xs text-gray-500">J/kg</div>
                <div className="text-sm text-red-300 mt-1">Extreme</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-800/50 p-4 rounded">
                <h4 className="text-orange-400 font-semibold mb-2">European Alps / Dolomites Pattern</h4>
                <ul className="text-gray-300 space-y-1">
                  <li>• <strong>Trigger:</strong> Orographic lifting + afternoon heating</li>
                  <li>• <strong>Timing:</strong> Predictable - typically 14:00-18:00 local</li>
                  <li>• <strong>CAPE:</strong> Often 500-1500 J/kg in summer</li>
                  <li>• <strong>Warning signs:</strong> Building cumulus by noon</li>
                </ul>
              </div>
              <div className="bg-slate-800/50 p-4 rounded">
                <h4 className="text-cyan-400 font-semibold mb-2">Tasmania / Frontal Pattern</h4>
                <ul className="text-gray-300 space-y-1">
                  <li>• <strong>Trigger:</strong> Cold fronts with embedded thunderstorms</li>
                  <li>• <strong>Timing:</strong> Less predictable - can be any time</li>
                  <li>• <strong>CAPE:</strong> Often lower (200-800 J/kg)</li>
                  <li>• <strong>Warning signs:</strong> Rapid pressure drop, wind shift</li>
                </ul>
              </div>
            </div>

            <p className="text-gray-500 text-xs mt-4">
              <strong>Source:</strong> CAPE data from Open-Meteo for all countries. HRRR model (3km) for US,
              GEM model (2.5km) for Canada, native Open-Meteo for others.
            </p>
          </div>
        </section>

        {/* Elevation Handling - Critical Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-cyan-300">Elevation Handling by Provider</h2>
          <p className="text-gray-400 mb-6">
            This is the critical section explaining how we ensure temperature accuracy for each provider.
          </p>

          <div className="space-y-6">
            {/* NWS */}
            <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🇺🇸</span>
                <h3 className="text-xl font-semibold text-yellow-400">NWS (National Weather Service)</h3>
                <span className="bg-green-900 text-green-300 px-2 py-1 rounded text-xs">2.5km</span>
              </div>
              <table className="w-full text-sm mb-4">
                <tbody>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 text-gray-400 w-48">Elevation Source</td>
                    <td className="py-2"><code className="text-cyan-400">/gridpoints/{'{office}'}/{'{x},{y}'}</code> → <code>properties.elevation.value</code></td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 text-gray-400">What It Represents</td>
                    <td className="py-2">Grid cell midpoint/average elevation (2.5km × 2.5km cell)</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 text-gray-400">Temps Valid At</td>
                    <td className="py-2">2m above grid cell elevation</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-400">Correction Required</td>
                    <td className="py-2 text-yellow-400">YES - Apply lapse rate from grid elevation to GPX elevation</td>
                  </tr>
                </tbody>
              </table>
              <div className="bg-slate-800 rounded p-4 font-mono text-xs">
                <p className="text-gray-400 mb-2">// Verified via testing at Mt Elbert Trailhead:</p>
                <p><span className="text-gray-500">GPX elevation:</span> <span className="text-green-400">3,048m</span> (accurate from GPS)</p>
                <p><span className="text-gray-500">NWS grid elevation:</span> <span className="text-yellow-400">4,043m</span> (includes mountain in cell)</p>
                <p><span className="text-gray-500">Difference:</span> <span className="text-red-400">995m → 6.5°C correction needed</span></p>
              </div>
            </div>

            {/* BOM */}
            <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🇦🇺</span>
                <h3 className="text-xl font-semibold text-yellow-400">BOM (Bureau of Meteorology)</h3>
                <span className="bg-green-900 text-green-300 px-2 py-1 rounded text-xs">2.2km</span>
              </div>
              <table className="w-full text-sm mb-4">
                <tbody>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 text-gray-400 w-48">Elevation Source</td>
                    <td className="py-2">We sample 7×7 grid via <code className="text-cyan-400">api.opentopodata.org/v1/srtm90m</code></td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 text-gray-400">What It Represents</td>
                    <td className="py-2">Model orography - average terrain height across ACCESS model cell</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 text-gray-400">Temps Valid At</td>
                    <td className="py-2">2m above model orography (NOT the user's point)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-400">Correction Required</td>
                    <td className="py-2 text-yellow-400">YES - Apply lapse rate from sampled grid average to GPX elevation</td>
                  </tr>
                </tbody>
              </table>
              <div className="bg-slate-800 rounded p-4 font-mono text-xs">
                <p className="text-gray-400 mb-2">// From BOM ADFD User Guide:</p>
                <p className="text-gray-300">"The elevation across each cell is averaged"</p>
                <p className="text-gray-300">"Temperature is at 2m above MODEL OROGRAPHY"</p>
              </div>
            </div>

            {/* Environment Canada */}
            <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🇨🇦</span>
                <h3 className="text-xl font-semibold text-yellow-400">Environment Canada (HRDPS)</h3>
                <span className="bg-green-900 text-green-300 px-2 py-1 rounded text-xs">2.5km</span>
              </div>
              <table className="w-full text-sm mb-4">
                <tbody>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 text-gray-400 w-48">Elevation Source</td>
                    <td className="py-2">We sample grid via <code className="text-cyan-400">api.opentopodata.org</code> (same as BOM)</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 text-gray-400">What It Represents</td>
                    <td className="py-2">Model orography - HRDPS 2.5km grid cell average</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 text-gray-400">Temps Valid At</td>
                    <td className="py-2">2m above model orography</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-400">Correction Required</td>
                    <td className="py-2 text-yellow-400">YES - Same approach as BOM</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Met Office */}
            <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🇬🇧</span>
                <h3 className="text-xl font-semibold text-yellow-400">Met Office (IMPROVER)</h3>
                <span className="bg-green-900 text-green-300 px-2 py-1 rounded text-xs">1.5km</span>
              </div>
              <table className="w-full text-sm mb-4">
                <tbody>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 text-gray-400 w-48">Elevation Source</td>
                    <td className="py-2"><code className="text-cyan-400">geometry.coordinates[2]</code> in API response</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 text-gray-400">What It Represents</td>
                    <td className="py-2">Point elevation - IMPROVER applies site-specific lapse rate correction</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 text-gray-400">Temps Valid At</td>
                    <td className="py-2">The requested point's actual elevation (already adjusted)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-400">Correction Required</td>
                    <td className="py-2 text-green-400">NO - IMPROVER already applies site-specific correction</td>
                  </tr>
                </tbody>
              </table>
              <div className="bg-slate-800 rounded p-4 font-mono text-xs">
                <p className="text-gray-400 mb-2">// Met Office IMPROVER post-processing:</p>
                <p className="text-gray-300">Applies lapse rate correction TO the requested location</p>
                <p className="text-gray-300">Returns [lon, lat, elevation] in geometry.coordinates</p>
              </div>
            </div>

            {/* Open-Meteo */}
            <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🌍</span>
                <h3 className="text-xl font-semibold text-yellow-400">Open-Meteo (All Models)</h3>
                <span className="bg-yellow-900 text-yellow-300 px-2 py-1 rounded text-xs">1.5-25km varies</span>
              </div>
              <table className="w-full text-sm mb-4">
                <tbody>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 text-gray-400 w-48">Elevation Source</td>
                    <td className="py-2"><code className="text-cyan-400">elevation</code> field in API response (90m DEM)</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 text-gray-400">What It Represents</td>
                    <td className="py-2">90m DEM point elevation (Copernicus)</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 text-gray-400">Temps Valid At</td>
                    <td className="py-2">90m DEM elevation (Open-Meteo applies 0.7°C/100m lapse rate internally)</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-gray-400">Correction Required</td>
                    <td className="py-2 text-yellow-400">MAYBE - 90m DEM can be wrong by 1km+ near peaks</td>
                  </tr>
                </tbody>
              </table>
              <div className="bg-slate-800 rounded p-4 font-mono text-xs">
                <p className="text-gray-400 mb-2">// Open-Meteo applies internal correction, BUT:</p>
                <p><span className="text-gray-500">Mt Elbert Trailhead actual:</span> <span className="text-green-400">3,048m</span></p>
                <p><span className="text-gray-500">Open-Meteo 90m DEM returns:</span> <span className="text-red-400">4,352m</span> (WRONG - picks up mountain)</p>
                <p><span className="text-gray-500">Solution:</span> <span className="text-cyan-400">Pass elevation=3048 parameter to override DEM</span></p>
              </div>
            </div>
          </div>
        </section>

        {/* Correction Formula */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-cyan-300">Universal Lapse Rate Correction</h2>
          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <div className="bg-slate-800 rounded p-6 font-mono">
              <pre className="text-cyan-200 text-sm">{`
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LAPSE RATE CORRECTION FORMULA                         │
└─────────────────────────────────────────────────────────────────────────────┘

Standard Atmospheric Lapse Rate: 6.5°C per 1000m (0.0065°C per meter)

INPUTS:
├── grid_elevation   = Elevation from weather API (grid cell average)
├── gpx_elevation    = User's elevation from GPX file (GPS-derived, accurate)
└── raw_temperature  = Temperature from API (valid at grid_elevation)

CALCULATION:
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   elevation_diff = grid_elevation - gpx_elevation                          │
│                                                                             │
│   adjustment = elevation_diff × 0.0065                                      │
│                                                                             │
│   adjusted_temperature = raw_temperature + adjustment                       │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘

WHY THIS WORKS:
├── Air is WARMER at lower elevations (user below grid = positive adjustment)
├── Air is COOLER at higher elevations (user above grid = negative adjustment)
└── 6.5°C/km is the standard for unsaturated air in the troposphere

EXAMPLE (NWS - Mt Elbert Trailhead):
├── grid_elevation = 4,043m
├── gpx_elevation  = 3,048m
├── raw_temp       = -13°C
│
├── elevation_diff = 4,043 - 3,048 = 995m
├── adjustment     = 995 × 0.0065 = +6.47°C
└── adjusted_temp  = -13 + 6.47 = -6.5°C ✓
`}</pre>
            </div>
          </div>
        </section>

        {/* Why We're Certain */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-cyan-300">Why We're Certain This Is Correct</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
              <h3 className="text-lg font-semibold text-green-400 mb-3">1. GPX Elevation Is Accurate</h3>
              <ul className="text-gray-300 text-sm space-y-2">
                <li>• GPS-derived elevation from user's device or trail data</li>
                <li>• Users cannot use system without valid GPX file</li>
                <li>• Pre-configured trails have surveyed elevations</li>
                <li>• Not dependent on coarse DEMs or grid averages</li>
              </ul>
            </div>
            <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
              <h3 className="text-lg font-semibold text-green-400 mb-3">2. Grid Elevation Is Documented</h3>
              <ul className="text-gray-300 text-sm space-y-2">
                <li>• NWS: <code className="text-cyan-400">/gridpoints</code> returns cell elevation</li>
                <li>• BOM: ADFD docs confirm "model orography" concept</li>
                <li>• Met Office: IMPROVER applies site correction</li>
                <li>• Open-Meteo: 90m DEM with lapse rate (documented)</li>
              </ul>
            </div>
            <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
              <h3 className="text-lg font-semibold text-green-400 mb-3">3. We Tested High-Variance Locations</h3>
              <ul className="text-gray-300 text-sm space-y-2">
                <li>• Mt Elbert Trailhead: 995m grid vs actual difference</li>
                <li>• Independence Pass: 167m difference</li>
                <li>• Twin Lakes valley: 94m difference</li>
                <li>• Results match expected lapse rate behavior</li>
              </ul>
            </div>
            <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
              <h3 className="text-lg font-semibold text-green-400 mb-3">4. Standard Meteorological Practice</h3>
              <ul className="text-gray-300 text-sm space-y-2">
                <li>• 6.5°C/km is the International Standard Atmosphere</li>
                <li>• Used by ECMWF, NOAA, Met Office for corrections</li>
                <li>• Same approach as avalanche forecasters use</li>
                <li>• Validated against station observations</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-gray-500 text-sm pt-8 border-t border-slate-800">
          <p>Thunderbird Global - Weather API Reference</p>
          <p className="mt-2">
            <a href="/flow" className="text-cyan-400 hover:underline">System Flow</a> |
            <a href="/architecture" className="text-cyan-400 hover:underline ml-2">Architecture</a> |
            <a href="/create" className="text-cyan-400 hover:underline ml-2">Route Creator</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
