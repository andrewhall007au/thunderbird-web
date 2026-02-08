# Satellite-to-Phone Data Services: Market Research (Feb 2026)

Research conducted 2026-02-08. Covers all Thunderbird launch markets.

## Summary

Satellite-to-phone data apps are live in US, Canada, and NZ. All other launch markets launching 2026. Two competing approaches (Starlink DTC vs AST SpaceMobile). SMS remains highest-priority traffic. A 5KB JSON forecast payload is ideal for satellite constraints.

## Commercially Available NOW

| Carrier | Country | Partner | Data Apps |
|---------|---------|---------|-----------|
| T-Mobile | US | Starlink | AccuWeather, AllTrails, Google Maps via SDK |
| Verizon | US | Skylo | SMS only (NB-NTN, ~1,200 byte payloads) |
| Rogers | Canada | Starlink | WhatsApp, Google Maps, AccuWeather |
| Telstra | Australia | Starlink | SMS only, data coming |
| One NZ | New Zealand | Starlink | WhatsApp calling, AllTrails, AccuWeather, Plan My Walk |
| Orange | France | Skylo | SMS (Google Pixel 9/10) |
| Kyivstar | Ukraine | Starlink | SMS only |

## Launching 2026

| Carrier | Country | Partner | Timeline | Capability |
|---------|---------|---------|----------|------------|
| AT&T | US | AST SpaceMobile | Beta Q1-Q2 2026 | Full broadband — up to 120 Mbps per cell (see debunk below) |
| Verizon | US | AST SpaceMobile | 2026 | Full broadband |
| Bell | Canada | AST SpaceMobile | Late 2026 | Full broadband |
| Spark | NZ | Likely Starlink | April 2026 | Data + SMS + WhatsApp calling |
| 2degrees | NZ | AST SpaceMobile | Mid-2026 | Full 4G/5G broadband |
| Vodafone AU | Australia | AST SpaceMobile | 2026 | Full broadband |
| O2 | UK | Starlink | Early 2026 | SMS + data |
| Vodafone UK | UK | AST SpaceMobile | 2026 | Voice, data, video |
| Deutsche Telekom | Germany | Skylo + Iridium | 2026 | SMS + IoT |
| MasOrange | Spain | Starlink | 2026 (trial) | Direct to cell |

## Two Competing Approaches

### Starlink Direct to Cell (SpaceX) — "Power through numbers"
- 650+ DTC satellites deployed, 15,000 V3 planned
- 4G-based, works with existing phones
- Currently: SMS + curated app data (developer SDK: SatelliteApps@T-Mobile.com)
- V3 satellites: full 5G (2026-2027), 100x capacity increase (700 Gbps vs 7 Gbps per sat)
- Partners: T-Mobile, Rogers, Telstra, One NZ, O2, Optus (delayed), MasOrange

### AST SpaceMobile — "Power through size"
- 6 satellites launched, 45-60 by end 2026
- Largest commercial communications array in LEO (2,400 sq ft phased array)
- Partners: AT&T, Verizon, Bell, Vodafone (global), 2degrees, Rakuten (Japan)
- 50+ MNO agreements covering ~3 billion subscribers

## AST SpaceMobile "120 Mbps" Debunked

**120 Mbps is the theoretical peak capacity per coverage cell — shared among ALL users.**

| Metric | Claim | Reality |
|--------|-------|---------|
| "Up to 120 Mbps" | Per user | Per cell, shared among all users |
| Tested speeds (BlueWalker 3) | — | 10-21 Mbps peak (entire cell) |
| Realistic per-cell capacity | — | ~20 Mbps shared (analyst estimate) |
| Per-user with 10 concurrent | — | ~2 Mbps |
| Per-user with 20 concurrent | — | ~1 Mbps |
| Cost per GB | — | $5-9 (20x terrestrial) |

Source: Joe Madden (Mobile Experts) independent analysis. Scotiabank downgraded stock to "Underperform."

## Real-World Performance

| Metric | Starlink DTC (now) | AST SpaceMobile (2026) | Starlink V3 (H2 2026) |
|--------|-------------------|----------------------|---------------------|
| Per-beam throughput | 3-4 Mbps shared | ~20 Mbps shared | 10-20 Mbps projected |
| Per-user realistic | 100 Kbps - 2 Mbps | 1-5 Mbps | 5-20 Mbps |
| Latency | 20-50ms | 20-50ms | 20-50ms |
| Reliability | Spotty (beta) | Unknown | Improved |
| Our payload (5KB JSON) | < 1 second | < 1 second | Instant |

### T-Mobile T-Satellite Real User Reports
- Under open sky: messages deliver in 5-10 seconds
- Under trees/in car: 15-30 seconds
- One Death Valley tester: 0/10 messages over 4 days
- Battery drain concerns reported
- Signal: -121 dBm (24 dB weaker than cell tower)

### Physics Constraints
- Phone: ~200mW transmit (vs Starlink dish 50-100W)
- Distance: 500+ km to satellite (vs 1-20km to cell tower)
- Spectrum: T-Mobile allocates only 5 MHz PCS G Block to DTC
- Elon Musk: DTC "could have 10% of the speed of broadband satellite service"

## Traffic Priority: SMS > Voice > Data

No provider formally documents priority, but it's implicit:

| Priority | Traffic Type | Basis |
|----------|-------------|-------|
| 1 (highest) | Emergency 911/SOS | FCC mandated |
| 2 | First responder (FirstNet/T-Priority) | AT&T FirstNet explicitly preempts commercial |
| 3 | SMS | Smallest payload, launched first everywhere |
| 4 | Voice | Higher bandwidth, launched second |
| 5 (lowest) | Data apps | Whitelisted, best effort, throttled under congestion |

### Key Details
- **AT&T FirstNet:** Only provider with documented hard priority — "priority and preemption on all AT&T spectrum bands including satellite"
- **AST SpaceMobile:** Uses standard 3GPP LTE QCI classes (voice QCI 1-4 above data QCI 6-9)
- **Starlink DTC:** Data apps are whitelisted (allowed vs blocked), no tiers within approved apps
- **Congestion handling:** Apps throttled/queued, not dropped. Dynamic beamforming shifts resources.
- **No evidence** of differential QoS between weather/safety apps vs social media within approved apps

### Developer Requirements
- Android: `NET_CAPABILITY_NOT_BANDWIDTH_CONSTRAINED` + manifest declaration
- iOS: `com.apple.developer.networking.carrier-constrained.app-optimized` entitlement
- T-Mobile whitelisting: email SatelliteApps@T-Mobile.com

## Market Timeline for Thunderbird

| Market | When satellite data apps become mainstream |
|--------|------------------------------------------|
| US | NOW (T-Mobile), H2 2026 (AT&T/Verizon broadband) |
| Canada | NOW (Rogers), Late 2026 (Bell broadband) |
| New Zealand | NOW (One NZ), April 2026 (Spark), Mid-2026 (2degrees) |
| Australia | Mid-Late 2026 (Vodafone AU broadband) |
| UK | Early-Mid 2026 (O2, Vodafone) |
| Europe | 2026-2027 (Deutsche Telekom, Orange expanding) |

## Competitive Note

AccuWeather is already delivering structured weather data via T-Mobile T-Satellite. Plan My Walk (NZ hiking app) is whitelisted on One NZ satellite. These are Thunderbird's direct competitors in this space.
