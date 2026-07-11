# Funnel Attribution Pre-enable Baseline

Recorded on 2026-07-11 before enabling `FUNNEL_ATTRIBUTION_ENABLED`.

## Window

- Berlin calendar window: 2026-06-27 00:00 through 2026-07-11 00:00, exclusive end
- UTC query window: 2026-06-26 22:00 through 2026-07-10 22:00, exclusive end
- Duration: 14 complete days

## Results

| Funnel stage              |       Count | Unique users | Source and definition                                                               |
| ------------------------- | ----------: | -----------: | ----------------------------------------------------------------------------------- |
| Quiz starts               |         292 |          186 | PostHog `quiz_started` occurrences and distinct IDs                                 |
| Quiz completions          |          75 |           73 | PostHog `quiz_completed` occurrences and distinct IDs                               |
| Browser lead captures     |          76 |           73 | PostHog `quiz_lead_captured` occurrences and distinct IDs                           |
| Server lead rows          |          77 |          n/a | Supabase `leads.created_at` in the same UTC window                                  |
| Checkout starts           | unavailable |  unavailable | No PostHog `checkout_started` events existed in the window                          |
| Pricing views             |         100 |  not queried | PostHog `pricing_viewed`; diagnostic only, not a checkout proxy                     |
| Paid subscription records |           7 |          n/a | Supabase `billing_subscriptions.created_at`; all seven were Stripe and active       |
| Confirmed purchase events | unavailable |  unavailable | No `purchase_completed` PostHog events or billing-outbox rows existed in the window |

## Interpretation

The 77 server leads versus 76 browser events is an expected illustration of the old measurement gap:
client analytics can be blocked or fail while the operational lead write succeeds. The seven active
Stripe subscription rows are the closest available purchase baseline, but they are not equivalent to
a confirmed purchase-event ledger and may include operational or test accounts. Do not treat them as
clean ad-attributed purchases.

This baseline should be compared with the first 14 complete days after enablement using the same
Berlin/UTC boundaries. Post-enable reporting should use `funnel_sessions` for stage conversion and
`funnel_events` for event-level reconciliation. Stripe and PayPal confirmations remain the authority
for paid purchase.

## Query Sources

- PostHog project `126788`, HogQL grouped by event for `quiz_started`, `quiz_completed`,
  `quiz_lead_captured`, `checkout_started`, and `purchase_completed`.
- Supabase `leads`, exact row count by `created_at`.
- Supabase `billing_subscriptions`, grouped by provider and filtered by `created_at`.
- Supabase `billing_analytics_outbox`, grouped by event/provider; no rows in the window.

Customer.io was not used as a numerical source because this workspace has no Customer.io reporting
API credentials. Meta campaign/ad reporting remains a separate acquisition view and is not a source
for Chaarlie package assignment.
