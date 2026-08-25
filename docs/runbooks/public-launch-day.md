# Public Launch Day

Use this receipt for the influencer publication window. It verifies the existing monitoring and rollback system; it does not redesign it.

## Ownership and immutable references

- Primary operator: Nick.
- Backup operator: **TBD before go**.
- Influencer publication window: **TBD before go**.
- Reviewed production Git SHA: **TBD after merge**.
- Production Vercel deployment: **TBD after deployment**.
- Verified rollback deployment: **TBD before go**.
- Supabase project: `pqdkhefxsxkyeqelqegq`.

No-go while any **TBD** above remains unresolved.

## Pre-publication gate

- [ ] PR checks are green and the reviewed head matches the production deployment.
- [ ] The production function region is verified as Dublin (`dub1`).
- [ ] Supabase backup/PITR status and database metrics are visible.
- [ ] Vercel runtime logs, function metrics, and firewall events are visible.
- [ ] Sentry receives one safe test notification through the real alert-delivery route.
- [ ] PostHog landing, quiz-start, prepare, lead, result, offer, and checkout events are visible.
- [ ] Stripe and PayPal dashboards show the intended live/test modes and healthy webhook delivery.
- [ ] Customer.io delivery and queue health are visible.
- [ ] The influencer forecast does not materially exceed the historical peak hour of 152 landing pageviews, 61 quiz starts, and 27 leads.
- [ ] The accepted residual risk is recorded: database write saturation, shared-IP contention, and 2x/5x capacity are not load-proven.
- [ ] A mobile production golden journey passes at human volume.
- [ ] Nick explicitly records **GO**.

## Human-volume production smoke

```bash
K6_BASE_URL=https://chaarlie.de \
K6_PRODUCTION_SMOKE_ACK=human-volume-read-only \
npm run stress:production-smoke
```

Do not run production spike, safety, soak, deliberate limiter, or synthetic write traffic.

## Watch during promotion

- Vercel: 5xx, function duration/timeouts, throttling, cold starts, firewall mitigation.
- Supabase: CPU/IO, active connections, lock waits, PostgREST errors, auth and database 429s.
- Sentry: new user-facing clusters and alert delivery.
- PostHog: landing-to-quiz, quiz-to-lead, result/offer, and checkout conversion continuity.
- Payments: checkout creation, webhook delivery, entitlement lag, duplicate or failed events.
- Customer.io: profile-sync queue, delivery failures, and unexpected bursts.

## Stop conditions

Pause the promotion and preserve evidence on any of:

- critical journey failure or lost/duplicate lead;
- critical-path 5xx above 1% for one minute;
- material p95 regression from the reviewed Dublin baseline;
- unexpected 429 for ordinary users;
- Vercel function throttle, timeout, or firewall mitigation affecting normal browsing;
- sustained database CPU/IO warning, connection pressure, lock waits, timeouts, or PostgREST saturation;
- payment succeeds but entitlement is delayed or missing;
- unintended Meta, Customer.io, or payment side effects;
- a new high-volume Sentry error cluster.

## Rollback

1. Stop or pause the influencer traffic source if possible.
2. Promote the pre-recorded rollback deployment; do not rebuild during the incident.
3. Verify `/lp/haarplan`, `/quiz`, `/pricing`, auth redirect behavior, and one database-backed read.
4. Confirm error rate and latency return to the prior baseline.
5. Record the rollback deployment, timestamp, reason, and remaining data reconciliation.

Rollback does not authorize database reversal. Any production data repair requires its own bounded preflight and approval.
