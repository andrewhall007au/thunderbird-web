# Phase 4: User Flows - Research

**Researched:** 2026-01-21
**Domain:** Conversion funnels, phone simulator, analytics, content pages
**Confidence:** HIGH

## Summary

This phase implements two conversion paths ("create first" vs "buy now") with a phone simulator driving purchase decisions, analytics to track path effectiveness, and content pages for competitive positioning.

The existing codebase already has strong foundations to build on:
- Landing page (`app/page.tsx`) with inline phone mockups showing SMS format
- Checkout page (`app/checkout/page.tsx`) with account creation + payment
- Route creation page (`app/create/page.tsx`) with GPX upload and waypoint editing
- SMS formatting in `tools/sms-preview.html` with realistic phone frames

**Primary recommendation:** Extract and enhance the existing phone mockup CSS from the landing page into a reusable `<PhoneSimulator>` component, implement path tracking via URL parameters and localStorage, and use simple cookie-based A/B assignment with event logging to the existing database.

## Research Areas

### 1. Phone Simulator Component

**Finding (HIGH confidence):** The codebase already contains excellent phone mockup CSS.

The landing page (`app/page.tsx` lines 45-135) includes realistic iPhone and Apple Watch Ultra mockups:
- iPhone: 280x560px frame with notch, proper border radius (36px), white screen area
- Apple Watch Ultra: 180x220px frame with digital crown detail
- Both show scrolling SMS preview content

**Existing SMS format discovered:**
```
LAKEO Lake Oberon (863m)
24hr from 06:00 Mon

06h 5-7o Rn15% W12-20 Cld40% CB18 FL22

08h 7-10o Rn18% W14-22 Cld45% CB17 FL21

...

Rn=Rain W=Wind Cld=Cloud
CB=CloudBase(x100m)
FL=Freeze(x100m)
```

The `tools/sms-preview.html` file contains additional format variations including:
- Pipe-delimited format (old)
- Labeled format with spacing
- Imperial units (Fahrenheit/feet)
- Bad weather example with danger indicators

**Recommendation:** Create a React `<PhoneSimulator>` component that:
1. Extracts CSS from landing page into reusable component
2. Accepts `content: string` prop for SMS message
3. Includes typing animation for "receiving message" effect
4. Can show either iPhone or Watch variant
5. Uses real waypoint names from user's route

### 2. Conversion Flow Patterns

**Finding (HIGH confidence):** Two paths need session-level state tracking.

**"Create First" Path (FLOW-02):**
```
Landing -> Create Route -> Add Waypoints -> See Simulator -> Paywall -> Checkout -> Success
```
User builds emotional investment in their route before paying.

**"Buy Now" Path (FLOW-03):**
```
Landing -> Checkout -> Success -> Create Route
```
Fast path for users ready to purchase immediately.

**Implementation approach:**
- Track entry path in URL param: `?path=create` or `?path=buy`
- Persist to localStorage on first page load: `entry_path`
- Carry through to checkout and payment metadata
- Log to orders table for analysis

**Existing patterns in codebase:**
- `app/checkout/page.tsx` redirects to `/create` after purchase
- Route creation already handles `?id=` param for editing
- Login redirects use `?redirect=` parameter pattern

**State flow recommendation:**
```typescript
// On landing page or entry
const path = searchParams.get('path') || 'organic';
if (!localStorage.getItem('entry_path')) {
  localStorage.setItem('entry_path', path);
  localStorage.setItem('entry_time', Date.now().toString());
}

// At checkout - include in Stripe metadata
metadata: {
  entry_path: localStorage.getItem('entry_path'),
  ...
}
```

### 3. Analytics Implementation

**Finding (MEDIUM confidence):** Lightweight custom tracking is sufficient for MVP.

Options researched:
| Tool | Pros | Cons |
|------|------|------|
| PostHog | Full-featured, A/B native | External dependency, cost |
| Vercel Analytics | Built-in, simple | Limited A/B, no funnel |
| Google Analytics | Free, powerful | Complex, cookie consent |
| Custom DB logging | Full control, no cost | Manual analysis |

**Recommendation:** Use custom database logging initially.

The existing codebase already has:
- `message_log` table for SMS analytics
- `orders` table with metadata JSON field
- Database access patterns in place

**Simple A/B implementation:**
```typescript
// Assign variant on first visit
function getVariant(): 'A' | 'B' {
  let variant = localStorage.getItem('ab_variant');
  if (!variant) {
    variant = Math.random() < 0.5 ? 'A' : 'B';
    localStorage.setItem('ab_variant', variant);
  }
  return variant as 'A' | 'B';
}

// Log events to backend
async function trackEvent(event: string, properties: Record<string, any>) {
  await fetch('/api/analytics', {
    method: 'POST',
    body: JSON.stringify({
      event,
      variant: getVariant(),
      entry_path: localStorage.getItem('entry_path'),
      ...properties
    })
  });
}
```

**Events to track:**
- `page_view` with path
- `route_created` with waypoint count
- `simulator_viewed` with route_id
- `checkout_started`
- `purchase_completed` with amount

### 4. Paywall UX Patterns

**Finding (HIGH confidence):** Paywall should appear after value demonstration.

Best practices from research:
1. Show full value before asking for payment
2. Make it clear what they're getting
3. Reduce friction for logged-in users
4. Offer clear call-to-action

**User states at paywall:**
| State | Experience |
|-------|------------|
| Not logged in | Show email/password + payment form (like current checkout) |
| Logged in, no purchase | Show payment only, pre-fill email |
| Logged in, has purchase | Route already activated, no paywall |

**Flow for "Create First" path:**
1. User creates route (allowed without auth)
2. User adds waypoints (allowed without auth)
3. User clicks "Preview SMS" -> sees simulator
4. Simulator shows: "This is what you'll receive for [waypoint name]"
5. CTA: "Activate Route - $29.99" -> paywall modal
6. If not logged in: create account + pay
7. If logged in: just pay
8. Success: route activated, SMS number assigned

**Existing checkout page pattern:**
The current `app/checkout/page.tsx` combines account creation and payment in one flow. This can be reused for the paywall modal.

### 5. Landing Page Competitive Messaging

**Finding (HIGH confidence):** Current landing page already has good comparison section.

**Garmin inReach Pricing (as of 2026):**
- Device: $339.90 (Mini 2)
- Plans: $8-50/month depending on tier
  - Enabled: $8/month (SOS only, per-message fees)
  - Standard: $30/month (150 messages)
  - Premium: $50/month (unlimited)
- Weather: $1-2 per request on top of subscription
- New: Can suspend for 12 months, but costs $8/month or $40 reactivation fee

Source: [Garmin inReach Plans](https://www.garmin.com/en-US/p/837461/)

**Zoleo Pricing (as of 2026):**
- Device: $149
- Plans: Starting at $20/month
- Suspend: $4/month
- Location tracking: +$6/month add-on

Source: [Zoleo Plans](https://www.zoleo.com/en-us/plans)

**Current landing page comparison (accurate):**
```
Thunderbird: $0 device, $0/month, $29.99 total
Garmin: $399 device, $14.95-64.95/month, $413.95 first month
Zoleo: $199 device, $20-50/month, $219 first month
```

**Messaging angles to emphasize:**
1. No device to buy - use phone you already have
2. No monthly subscription - pay only when you use it
3. Credits never expire - no use-it-or-lose-it pressure
4. Works with existing satellite SMS capability
5. Per-forecast cost vs per-month cost comparison

### 6. Satellite SMS Compatibility

**Finding (HIGH confidence):** Multi-carrier support is growing rapidly.

**Apple Devices (Globalstar network):**
- iPhone 14+ for Emergency SOS via satellite
- iPhone with iOS 18+ for Messages via satellite
- Apple Watch Ultra 3 for satellite messaging
- Free for 2 years from activation (extended through Nov 2026)
- SMS via satellite requires carrier support

**Carrier Support (US):**
| Carrier | Partner | Status | iPhones Supported |
|---------|---------|--------|-------------------|
| T-Mobile | Starlink | Active | iPhone 14+, Galaxy S24+, Pixel 9+ |
| Verizon | Skylo | Active | Galaxy S25 series, Pixel 9+ |
| AT&T | AST SpaceMobile | Coming | TBD |

**International:**
- Messages via satellite: US, Canada, Mexico, Japan
- Emergency SOS: 18+ countries including UK, Australia, NZ, most of Europe

**Android Support:**
- Google Pixel 9+: Satellite SOS, US only
- Samsung Galaxy S25+: Via carrier (Verizon/T-Mobile)
- Samsung Galaxy S26: May include satellite voice calls

Sources:
- [Apple Messages via Satellite](https://support.apple.com/en-us/120930)
- [Apple Carrier Satellite Features](https://support.apple.com/en-us/122339)
- [T-Mobile T-Satellite](https://www.t-mobile.com/support/coverage/satellite-support)

**Content page structure recommendation:**
```
/compatibility
- iPhone section (14+, any carrier in supported countries)
- Apple Watch section (Ultra 3)
- Android section (Pixel 9+, Samsung S25+ with T-Mobile/Verizon)
- Carrier requirements by country
- FAQ: "Will my phone work?"
```

### 7. Existing SMS Format Analysis

**Finding (HIGH confidence):** Multiple formats exist in codebase.

From `backend/app/services/formatter.py`:

**Labeled Spaced Format (recommended):**
```
CAST LAKEO 863m
Light 06:00-20:51

17h 21-23o Rn0% W20-33 Cld38% CB12 FL48

18h 20-22o Rn0% W20-33 Cld49% CB12 FL46

...

Rn=Rain W=Wind Cld=Cloud CB=CloudBase(x100m) FL=Freeze(x100m)
```

**Key formatting rules:**
- `o` instead of `°` for GSM-7 compatibility
- CB/FL in hundreds of meters
- Danger indicators: `!`, `!!`, `!!!`
- Key legend at end for reference
- Blank lines between periods for readability

**Imperial support available:**
- Temperatures in Fahrenheit (`f` suffix)
- Elevations in feet
- CB/FL in hundreds of feet

**For simulator:**
- Use the labeled spaced format (most readable on phone)
- Include 3-4 hours of data (not full 12)
- Show one representative waypoint from user's route
- Personalize with actual waypoint name and elevation

## Standard Stack

### Core (already in codebase)
| Library | Version | Purpose | Already Present |
|---------|---------|---------|-----------------|
| Next.js | 14.x | React framework | Yes |
| Tailwind CSS | 3.x | Styling | Yes |
| Lucide React | latest | Icons | Yes |
| localStorage | native | Client state | Yes |

### New for Phase 4
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| None required | - | Custom implementation | Reuse existing patterns |

**Installation:** No new dependencies needed.

## Architecture Patterns

### Phone Simulator Component
```typescript
// app/components/simulator/PhoneSimulator.tsx
interface PhoneSimulatorProps {
  content: string;
  variant?: 'iphone' | 'watch';
  animateTyping?: boolean;
  className?: string;
}

export function PhoneSimulator({ content, variant = 'iphone', animateTyping = true }: PhoneSimulatorProps) {
  // Extract CSS from existing landing page
  // Add typing animation if enabled
  // Render phone frame with message bubble
}
```

### Path Tracking Pattern
```typescript
// app/lib/analytics.ts
export function initPathTracking(searchParams: URLSearchParams) {
  const path = searchParams.get('path') || 'organic';
  if (!localStorage.getItem('tb_entry_path')) {
    localStorage.setItem('tb_entry_path', path);
    localStorage.setItem('tb_entry_time', Date.now().toString());
    localStorage.setItem('tb_variant', Math.random() < 0.5 ? 'A' : 'B');
  }
}

export function getTrackingContext() {
  return {
    entry_path: localStorage.getItem('tb_entry_path'),
    variant: localStorage.getItem('tb_variant'),
    entry_time: localStorage.getItem('tb_entry_time'),
  };
}
```

### Paywall Modal Pattern
```typescript
// app/components/paywall/PaywallModal.tsx
interface PaywallModalProps {
  routeId: number;
  routeName: string;
  waypointCount: number;
  onSuccess: () => void;
  onClose: () => void;
}

// Reuse checkout form logic
// Show route details in summary
// Track conversion event on success
```

### Recommended Project Structure
```
app/
├── components/
│   ├── simulator/
│   │   └── PhoneSimulator.tsx    # Reusable phone mockup
│   └── paywall/
│       └── PaywallModal.tsx      # Purchase modal
├── lib/
│   └── analytics.ts              # Path tracking utilities
├── compatibility/
│   └── page.tsx                  # Carrier/device info (CONT-02)
└── create/
    └── page.tsx                  # Add simulator step (modify existing)
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phone CSS frame | Custom from scratch | Extract from landing page | Already tested, looks good |
| SMS formatting | New format | Existing formatter.py output | Consistency with actual SMS |
| A/B assignment | Complex system | localStorage + Math.random | Simple, sufficient for MVP |
| Analytics backend | Full analytics system | Existing orders.metadata | Already tracking purchases |
| Payment form | New checkout | Existing checkout page | Already handles all edge cases |

## Common Pitfalls

### Pitfall 1: Over-engineering Analytics
**What goes wrong:** Building complex funnel tracking, real-time dashboards
**Why it happens:** Wanting data from day one
**How to avoid:** Start with order metadata, build dashboards later when you have users
**Warning signs:** Considering PostHog, Mixpanel, Amplitude before having 100 users

### Pitfall 2: Simulator Shows Wrong Format
**What goes wrong:** Simulator shows format different from actual SMS
**Why it happens:** Frontend team doesn't know backend format
**How to avoid:** Use exact output from formatter.py, test with actual examples
**Warning signs:** Hardcoded simulator content that doesn't match spec

### Pitfall 3: Lost Path Attribution
**What goes wrong:** Entry path not reaching purchase metadata
**Why it happens:** localStorage cleared, different browser, tracking not implemented
**How to avoid:** Set tracking on first page load, verify it reaches Stripe metadata
**Warning signs:** Orders without entry_path in metadata

### Pitfall 4: Paywall After Login, Before Route
**What goes wrong:** User logs in, immediately sees paywall before creating anything
**Why it happens:** Auth check triggers paywall prematurely
**How to avoid:** Paywall only after simulator view, not on login
**Warning signs:** Paywall appearing on /create before any waypoints added

## Code Examples

### Phone Simulator CSS (from landing page)
```css
/* iPhone Frame */
.iphone-frame {
  width: 280px;
  height: 560px;
  background: #000;
  border-radius: 36px;
  padding: 12px;
  position: relative;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}

.iphone-notch {
  width: 100px;
  height: 22px;
  background: #000;
  border-radius: 0 0 12px 12px;
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.iphone-screen {
  width: 100%;
  height: 100%;
  background: #fff;
  border-radius: 26px;
  overflow: hidden;
}

.iphone-bubble {
  background: #e5e5ea;
  color: #000;
  padding: 8px 12px;
  border-radius: 16px;
  border-bottom-left-radius: 4px;
  max-width: 90%;
  font-size: 13px;
  line-height: 1.4;
  white-space: pre-wrap;
}
```

### Sample SMS Content for Simulator
```typescript
function generateSimulatorContent(waypoint: Waypoint): string {
  return `CAST ${waypoint.smsCode}
${waypoint.name} (${waypoint.elevation}m)
Light 06:00-20:51

06h 5-7o Rn15% W12-20 Cld40% CB18 FL22

08h 7-10o Rn18% W14-22 Cld45% CB17 FL21

10h 10-14o Rn22% W16-26 Cld52% CB15 FL19

12h 12-16o Rn25% W18-30 Cld60% CB14 FL18 !

Rn=Rain W=Wind Cld=Cloud
CB=CloudBase(x100m) FL=Freeze(x100m)`;
}
```

### Path Tracking Implementation
```typescript
// app/layout.tsx or app/providers.tsx
'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export function AnalyticsProvider({ children }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    // Only set on first visit
    if (typeof window !== 'undefined' && !localStorage.getItem('tb_entry_path')) {
      const path = searchParams.get('path') || 'organic';
      const variant = Math.random() < 0.5 ? 'A' : 'B';

      localStorage.setItem('tb_entry_path', path);
      localStorage.setItem('tb_variant', variant);
      localStorage.setItem('tb_session_start', new Date().toISOString());
    }
  }, [searchParams]);

  return children;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dedicated A/B tools | Simple localStorage | 2024 | Lower complexity for early stage |
| Full analytics suite | Event logging to DB | 2025 | Build dashboards when needed |
| Device mockup libraries | CSS-only frames | 2024 | No dependency, full control |
| Separate landing pages | URL params | 2025 | Simpler tracking, less content duplication |

**Current best practice:** Start with minimal tracking, instrument key events, build dashboards when you have 100+ users to analyze.

## Open Questions

1. **A/B variant assignment server-side?**
   - What we know: Client-side is simpler but can be manipulated
   - What's unclear: Does server-side assignment add meaningful value?
   - Recommendation: Start client-side, move to server if fraud detected

2. **Simulator content - static or dynamic?**
   - What we know: Dynamic from user's route is more engaging
   - What's unclear: API cost of generating preview forecasts
   - Recommendation: Use static template with dynamic waypoint name/elevation

3. **Compatibility page maintenance**
   - What we know: Carrier support changing rapidly
   - What's unclear: How to keep updated without manual effort
   - Recommendation: Add "Last updated" date, review monthly

## Sources

### Primary (HIGH confidence)
- Existing codebase: `app/page.tsx`, `app/checkout/page.tsx`, `app/create/page.tsx`
- Existing codebase: `backend/app/services/formatter.py`, `tools/sms-preview.html`
- Apple Support: [Messages via satellite](https://support.apple.com/en-us/120930)
- Apple Support: [Carrier satellite features](https://support.apple.com/en-us/122339)

### Secondary (MEDIUM confidence)
- [Garmin inReach Plans](https://www.garmin.com/en-US/p/837461/)
- [Zoleo Plans](https://www.zoleo.com/en-us/plans)
- [T-Mobile T-Satellite](https://www.t-mobile.com/support/coverage/satellite-support)
- [PostHog Next.js A/B Testing](https://posthog.com/tutorials/nextjs-ab-tests)

### Tertiary (LOW confidence)
- [react-device-mockup](https://github.com/jung-youngmin/react-device-mockup) - considered but CSS-only approach preferred
- [Flowbite Device Mockups](https://flowbite.com/docs/components/device-mockups/) - Tailwind CSS patterns

## Metadata

**Confidence breakdown:**
- Phone simulator: HIGH - existing code in codebase to extract
- Conversion flows: HIGH - patterns clear, existing checkout works
- Analytics: MEDIUM - simple approach validated, may need iteration
- Paywall: HIGH - reuse existing checkout
- Competitor pricing: HIGH - verified on official sites
- Satellite compatibility: HIGH - official Apple/carrier docs

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (competitor pricing may change)
