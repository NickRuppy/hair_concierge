# PostHog Offer Dashboard Presentation

## Outcome and source

Make the live PostHog dashboard `859068` understandable at a glance without
changing its event semantics, session scoping, package/revision filters, or
metric calculations.

Source inputs:

- Nick's review of the current production dashboard on 2026-07-30.
- The approved presentation mockup:
  `/Users/nick/.codex/visualizations/2026/07/30/019fb14f-6002-76c1-a87e-888503eb5e3a/offer-dashboard-presentation-mockup.svg`
- The production insight and dashboard responses from PostHog project `126788`.

## Chosen direction

Use PostHog's native dashboard editor/API for a summary-first layout:

1. Offer-to-purchase progression first.
2. Section reach second.
3. Sticky-pricing navigation and checkout-intent CTAs compared visually.
4. Checkout/provider/payment detail below the decision metrics.
5. Tracking quality and the currently empty FAQ diagnostic demoted to compact
   guardrail tiles.

Keep the existing session-scoped HogQL as the metric source of truth. Prefer
native chart presentation over converting the calculations to a native funnel
query when that conversion would change the denominator or deduplication rules.
Capture read-only before/after snapshots as the proof and rollback reference;
do not build a new reusable mutation framework for this one presentation edit.

## Scope

- Reorder and resize the six existing dashboard tiles.
- Change chart presentation settings where the existing result shape supports
  a clearer visualization.
- Make CTA navigation versus checkout intent visually distinct.
- Compact low-frequency diagnostics.
- Capture the exact live tile layout and source-query text before and after.
- Apply the verified presentation to live PostHog.

## Non-goals

- No product instrumentation changes.
- No event, campaign, quiz-kind, package-key, or offer-revision changes.
- No changes to the SQL/HogQL calculations or time-window behavior.
- No production application deployment.
- No GitHub publication without a later explicit ship instruction.

## Target map

| Order | Existing insight | Reader purpose | Intended presentation |
| --- | --- | --- | --- |
| 01 | `5235347` | Offer-to-purchase progression | `sm: x0 y0 w12 h5`; primary full-width progression |
| 02 | `5235348` | Section reach and checkout exposure | `sm: x0 y5 w12 h5`; full-width reach |
| 03 | `5235350` | CTA comparison | `sm: x0 y10 w12 h4`; click-rate bar, sticky remains pricing navigation |
| 04 | `5245339` | Checkout path detail | `sm: x0 y14 w12 h4`; grouped progression with readable German labels |
| 05 | `5250265` | Tracking quality | `sm: x0 y18 w12 h2`; compact guardrail |
| Hidden | `5235351` | FAQ interaction detail | Detach the tile while empty; preserve the underlying insight |

## Designed operator journey

Entry state: the operator opens dashboard `859068` with the desired time range.

1. Read the primary progression to see offer reach, checkout intent, checkout
   opening, provider initialization, payment-option exposure, and purchases.
2. Scan section reach to identify where the offer page loses attention.
3. Compare sticky pricing jumps with the two checkout-intent placements. The
   sticky percentage is interpreted as navigation to pricing, not checkout
   intent.
4. Inspect checkout detail only when the primary progression shows a gap between
   checkout intent and payment-option exposure.
5. Use tracking quality as a guardrail. Open the FAQ diagnostic only after FAQ
   events exist or when diagnosing that interaction.

Recovery state: if a native chart cannot faithfully render an existing result
shape, retain the table or current chart and improve only its placement and
title. Never alter the query to make the chart easier to draw.

Completion: the live dashboard renders the same underlying values as before,
but the reading order and visual weight match the journey above.

## Mockup and approval evidence

- Mockup status: confirmed by Nick through the instruction to set it up in
  PostHog.
- User-journey status: confirmed by the same explicit implementation request
  after the walkthrough.
- The approved mockup is directional; native PostHog constraints may require a
  faithful approximation rather than custom KPI cards.

## Ordered tasks

1. Run a read-only spike against the live PostHog API: enumerate every attached
   tile, capture the concrete layout schema, identify whether chart display is
   insight-scoped or tile-scoped, and inspect server normalization.
2. Save a before-state snapshot outside the repository containing the full tile
   records and each insight's exact `source.query` text.
3. Define the smallest native presentation patch. Hard-stop if a chart-type
   change would touch shared insight query envelopes or materially diverge from
   the approved mockup; fall back to layout hierarchy for that tile.
4. Apply the reviewed grid layouts and the O3/O5 chart-envelope settings through
   the native PostHog API/editor. Keep each `source.query` string identical and
   abort if any tile identity, source-query text, or captured layout pre-state
   has drifted since the snapshot. Detach the empty FAQ tile only after the
   rendered compact version proves unreadable; preserve its underlying insight.
5. Capture the after state and compare every `source.query` text byte-for-byte.
6. Re-query the live insights to reconcile the values and inspect the rendered
   dashboard in the signed-in browser at desktop width.
7. Preserve the snapshots as the rollback reference; do not add a repository
   write utility unless repeated dashboard publication becomes a real need.

## Verification

- Every existing insight's HogQL query text is byte-for-byte unchanged.
- The complete pre-edit tile set is enumerated; five expected live insight IDs
  remain attached. FAQ insight `5235351` is preserved but intentionally detached
  while it has no rows.
- The live dashboard tile order and dimensions match the target map.
- A second read confirms the exact intended normalized layout.
- Current headline counts reconcile with the pre-change snapshot.
- Browser inspection confirms that charts, tables, titles, and compact
  diagnostics are legible without overlap or misleading grouping.

## Review and handoff

- Run the repository's focused tests and implementation-loop verification.
- Obtain one read-only Claude plan review before implementation and one
  whole-branch review before any later publication.
- Report the live dashboard URL, the exact presentation changes, verification,
  and any PostHog-native limitation that remains.
