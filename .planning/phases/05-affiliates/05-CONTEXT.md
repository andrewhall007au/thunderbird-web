# Phase 5: Affiliates - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Affiliate program with trailing commissions driving growth. Admins create affiliates, configure per-affiliate terms (discount %, commission %, trailing duration), affiliates earn on initial purchases and top-ups. Includes payout tracking and performance analytics.

</domain>

<decisions>
## Implementation Decisions

### Commission Structure
- Trailing duration configurable per affiliate (6mo, 1yr, 2yr, forever options)
- Commission calculated on actual paid price (post-discount)
- Default commission rate: 20% (admin can adjust per affiliate)
- No caps or limits on earnings — affiliates can earn unlimited
- All commission terms configurable in admin portal per affiliate

### Payout Handling
- Manual approval required for all payouts (admin reviews each request)
- $50 minimum threshold before payout can be requested
- Payout methods: PayPal or bank transfer (affiliate chooses)
- Bank transfers processed manually by admin (not Stripe Connect)
- 30-day hold before commissions become available (refund protection)
- Commission states: Pending → Available → Requested → Paid
- Full claw back on refunds — deduct from affiliate's available balance
- Affiliates see full transparency: pending, available, paid amounts and history

### Analytics Dashboard
- Detailed metrics for affiliates: clicks, signups, conversion rate, earnings by period, top-ups
- Aggregate data only — no per-user breakdown (privacy)
- Preset time periods: Today, 7 days, 30 days, all-time
- Daily data updates (not real-time)
- Milestone email alerts when affiliates hit earning thresholds
- Sub-ID support for tracking different campaigns
- Simple counts (clicks → conversions), not full funnel visualization
- Numbers only — no charts or graphs
- Admin dashboard: basic overview with totals per affiliate (no cross-affiliate comparison)

### Claude's Discretion
- Discount code stacking rules with launch pricing
- Specific milestone thresholds for email alerts
- Sub-ID implementation approach
- Admin UI layout and organization

</decisions>

<specifics>
## Specific Ideas

- Affiliates should feel in control with full visibility into their earnings and payout status
- Keep analytics simple — numbers and tables, not fancy dashboards
- Sub-IDs let affiliates track which YouTube video or blog post drives signups

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-affiliates*
*Context gathered: 2026-01-21*
