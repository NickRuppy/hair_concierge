# Launch Traffic Checks

The repository has two deliberately separate k6 paths:

- `scripts/k6/launch-flow.js` can model **read-only landing traffic on a non-production target**. It refuses Chaarlie production aliases and has no POST requests, provider calls, authentication bypass, or database writes.
- `scripts/k6/production-smoke.js` performs one human-volume, read-only production smoke. It has exact route expectations and cannot enable a higher-volume profile.

The current launch does not have an eligible isolated target because Supabase preview branching requires a paid organization upgrade. Do not point a Vercel preview at production Supabase merely to make the non-production harness runnable.

## Current evidence and limitation

Historical PostHog traffic provides the launch envelope:

- peak day: 1,074 `/lp/haarplan` pageviews;
- peak hour: 152 landing pageviews, 61 quiz starts, and 27 leads;
- peak minute: 7 landing pageviews.

Twenty sequential read-only production samples were collected on 2026-08-25:

| Target                                       | Status         |    p50 |    p95 |      p99 |
| -------------------------------------------- | -------------- | -----: | -----: | -------: |
| `/lp/haarplan`                               | 20/20 HTTP 200 | 207 ms | 356 ms | 1,140 ms |
| nonexistent `/result/<uuid>` database lookup | 20/20 HTTP 404 | 401 ms | 664 ms | 1,313 ms |

These are unloaded health and latency observations, not capacity proof. Database write saturation, shared-IP contention, and 2x/5x capacity remain untested. The simpler launch path is acceptable only while the influencer forecast does not materially exceed the historical envelope and the launch-day monitoring and rollback gate is complete.

## Optional non-production read-only profiles

Use these only if a genuinely isolated non-production target exists later. First inspect without sending traffic:

```bash
k6 inspect \
  -e K6_BASE_URL=https://isolated-preview.example \
  -e K6_ISOLATED_TARGET_ACK=read-only-nonproduction-confirmed \
  scripts/k6/launch-flow.js
```

The command names remain stable:

| Command                  |  Landing arrival rate | Default duration |
| ------------------------ | --------------------: | ---------------: |
| `npm run stress:smoke`   |              1/minute |         1 minute |
| `npm run stress:average` | 152/hour (historical) |       15 minutes |
| `npm run stress:spike`   |           304/hour 2x |        5 minutes |
| `npm run stress:safety`  |           760/hour 5x |        5 minutes |
| `npm run stress:soak`    |           304/hour 2x |       30 minutes |

Every profile uses `constant-arrival-rate` and GETs only `/lp/haarplan`. The harness exits before traffic when the target is absent, is not HTTPS, is a production alias, or lacks the exact acknowledgement.

Do not treat a read-only landing pass as evidence that lead persistence, email delivery, payment preparation, rate limiting, or database write capacity passed.

## Production smoke

Production permits only one read-only, one-iteration smoke:

```bash
K6_BASE_URL=https://chaarlie.de \
K6_PRODUCTION_SMOKE_ACK=human-volume-read-only \
npm run stress:production-smoke
```

Run it once before launch and once after the reviewed Dublin deployment. Record the deployment SHA, timestamp, route statuses, and any edge mitigation. Never run the non-production average, spike, safety, or soak profiles against production.

## Reopen the staging decision when needed

Use a Supabase Pro preview branch or another fully isolated environment before launch if the forecast materially exceeds the historical envelope, if a new write-heavy journey ships, or if monitoring shows saturation risk. Any future write-capacity test needs isolated data, disabled real provider delivery, explicit cleanup, and a fresh reviewed plan; it must not add a dormant load-test authorization path to production routes.
