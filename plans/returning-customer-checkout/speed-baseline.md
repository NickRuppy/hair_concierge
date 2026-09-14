# Checkout speed baseline — 2026-09-14

## Result

No paired **PayPal** provider-load baseline was found in the queried production lifecycle telemetry. This does not establish that all possible timing sources are empty.

The desired measure is the wall-clock difference between the first
`provider_load_started` and first `provider_ready` lifecycle event for the same
`checkout_attempt_id` and `open_index`. This deliberately does not use the
event's `elapsed_ms`, because that value starts at checkout-attempt opening and
therefore includes customer think time.

The available signed-out browser was also checked on `/reactivate`; it redirects to sign-in, so no controlled authenticated checkout timing was collected. No payment was initiated.

## Scope

- Source: PostHog production host `chaarlie.de`, `offer_checkout_lifecycle`.
- Window: `2026-08-14 00:00:00 UTC` through `2026-09-13 19:08:35 UTC`
  (the prior production deployment's ready time; endpoint exclusive).
- Provider: `paypal`.
- Surface split: `/reactivate` = reactivation; `/result/...` = old result
  paywall; all other paths isolated as `other`.

## Aggregate evidence

Across that window, PayPal recorded 10 `provider_ready` events on 10 attempts,
but **zero** `provider_load_started` events. The paired query returned zero
attempt/open-index pairs for reactivation, result paywall, and other paths.

This is historical instrumentation coverage, not a controlled browser speed
measurement. It cannot establish an old-vs-new latency comparison. A future
signed-in, non-paying browser simulation should measure the same start/ready
pair and record its environment separately.

## Current-production pre-deployment slice

The change under review has not been deployed. To avoid treating the older
historical slice as its baseline, the same aggregation was also run from the
current production deployment becoming ready (`2026-09-13 19:08:35 UTC`) to
the exact query cutoff (`2026-09-14 04:53:28 UTC`).

There were **zero** queried PayPal load-start/ready lifecycle events in this slice: zero
`provider_load_started`, zero `provider_ready`, and therefore zero paired
attempt/open-index observations for reactivation, result paywall, or other
paths. This is the applicable before-our-fix production result; it is empty,
not a measured latency.

```sql
SELECT surface, count() AS matched_attempt_open_pairs,
  round(avg(load_to_ready_ms)) AS mean_load_to_ready_ms,
  quantile(0.5)(load_to_ready_ms) AS median_load_to_ready_ms,
  quantile(0.95)(load_to_ready_ms) AS p95_load_to_ready_ms
FROM (
  SELECT
    if(properties.$pathname = '/reactivate', 'reactivation', if(startsWith(properties.$pathname, '/result/'), 'result_paywall', 'other')) AS surface,
    properties.checkout_attempt_id AS attempt_id,
    properties.open_index AS open_index,
    minIf(toUnixTimestamp64Milli(timestamp), properties.transition = 'provider_load_started') AS started_at_ms,
    minIf(toUnixTimestamp64Milli(timestamp), properties.transition = 'provider_ready') AS ready_at_ms,
    ready_at_ms - started_at_ms AS load_to_ready_ms
  FROM events
  WHERE event = 'offer_checkout_lifecycle'
    AND timestamp >= toDateTime('2026-09-13 19:08:35')
    AND timestamp < toDateTime('2026-09-14 04:53:28')
    AND properties.$host = 'chaarlie.de'
    AND properties.provider = 'paypal'
    AND properties.transition IN ('provider_load_started', 'provider_ready')
  GROUP BY surface, attempt_id, open_index
  HAVING started_at_ms > 0 AND ready_at_ms >= started_at_ms
)
GROUP BY surface
ORDER BY surface
```

## Exact aggregate query

```sql
SELECT surface, count() AS matched_attempt_open_pairs,
  round(avg(load_to_ready_ms)) AS mean_load_to_ready_ms,
  quantile(0.5)(load_to_ready_ms) AS median_load_to_ready_ms,
  quantile(0.95)(load_to_ready_ms) AS p95_load_to_ready_ms
FROM (
  SELECT
    if(properties.$pathname = '/reactivate', 'reactivation', if(startsWith(properties.$pathname, '/result/'), 'result_paywall', 'other')) AS surface,
    properties.checkout_attempt_id AS attempt_id,
    properties.open_index AS open_index,
    minIf(toUnixTimestamp64Milli(timestamp), properties.transition = 'provider_load_started') AS started_at_ms,
    minIf(toUnixTimestamp64Milli(timestamp), properties.transition = 'provider_ready') AS ready_at_ms,
    ready_at_ms - started_at_ms AS load_to_ready_ms
  FROM events
  WHERE event = 'offer_checkout_lifecycle'
    AND timestamp >= toDateTime('2026-08-14 00:00:00')
    AND timestamp < toDateTime('2026-09-13 19:08:35')
    AND properties.$host = 'chaarlie.de'
    AND properties.provider = 'paypal'
    AND properties.transition IN ('provider_load_started', 'provider_ready')
  GROUP BY surface, attempt_id, open_index
  HAVING started_at_ms > 0 AND ready_at_ms >= started_at_ms
)
GROUP BY surface
ORDER BY surface
```
