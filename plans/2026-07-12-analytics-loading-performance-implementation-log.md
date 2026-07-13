# Analytics Loading Performance Implementation Log

## Phase 0 Baseline

Captured on 2026-07-13 from `codex/analytics-loading-performance-plan` at `e0d8484`, equal to then-current `origin/main`.

### Verification baseline

- Clean `npm run build`: passed on Next.js 16.2.4.
- Focused tests: 29 passed across `tests/analytics-tracking.test.ts`, `tests/acquisition-funnel-tracking.test.ts`, `tests/meta-pixel.test.ts`, and `tests/editorial-pages.test.tsx`.

### First-load JavaScript

Values are `firstLoadUncompressedJsBytes` from `.next/diagnostics/route-bundle-stats.json`.

| Route | Bytes | Chunks |
| --- | ---: | ---: |
| `/` | 1,736,005 | 19 |
| `/methodik` | 1,687,188 | 17 |
| `/quiz` | 1,908,926 | 22 |
| `/result/[leadId]` | 1,830,878 | 22 |
| `/welcome` | 1,752,576 | 20 |

Chunk-content searches confirmed that initial route chunks contain PostHog, Customer.io, Supabase/auth, and Sentry markers. Several chunks contain markers from more than one category, so marker-bearing totals overlap and are not additive. Route-total deltas after the import-boundary changes are the acceptance source of truth.

### Mobile Lighthouse medians

Three equivalent simulated-mobile runs used:

```sh
LH_BASE_URL=http://localhost:3513 \
LH_PATHS=/,/methodik,/quiz \
LH_OUTPUT_DIR=tmp/lighthouse/analytics-baseline/run-<n> \
LH_FAIL_ON_THRESHOLD=0 \
npm run perf:mobile
```

| Route | LCP | CLS | TBT | SEO |
| --- | ---: | ---: | ---: | ---: |
| `/` | 5,294 ms | 0.125 | 162 ms | 100 |
| `/methodik` | 4,993 ms | 0.000 | 165 ms | 100 |
| `/quiz` | 6,395 ms | 0.000 | 168 ms | 100 |

The baseline threshold failures are expected evidence. Raw reports are under `tmp/lighthouse/analytics-baseline/` and are not intended for source control.

## Implementation Checkpoint

### First-load JavaScript after restructuring

Captured from a clean production build after the provider split and post-paint runtime changes.

| Route | Bytes | Chunks | Reduction from baseline |
| --- | ---: | ---: | ---: |
| `/` | 1,194,680 | 15 | 31.2% |
| `/methodik` | 1,148,882 | 13 | 31.9% |
| `/quiz` | 1,611,315 | 20 | 15.6% |
| `/result/[leadId]` | 1,289,508 | 18 | 29.6% |
| `/welcome` | 1,454,965 | 18 | 17.0% |

The emitted PostHog SDK chunk is 190,945 bytes. The emitted Customer.io SDK chunks are 48,817 and 46,851 bytes. Chunk-content signatures confirm that none of these three SDK chunks are in the initial chunk graph for any route above. Lightweight queue and loader wrappers remain where tracking is required.

Supabase/auth is absent from the initial landing, Methodik, and result graphs. It remains on quiz and welcome, where authentication is intentionally part of the existing route composition.

### Focused implementation verification

- Analytics, acquisition, editorial, Meta, Customer.io, and checkout-focused suite: 50 passed.
- Runtime/source-boundary follow-up suite: 14 passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with seven pre-existing warnings in unrelated modules and no errors.
- Clean `npm run build`: passed on Next.js 16.2.4.
- `git diff --check`: passed.

### Mobile Lighthouse after restructuring

Three equivalent simulated-mobile runs used the same command and production server as the baseline, with output under `tmp/lighthouse/analytics-after/`.

| Route | Median LCP | Change | CLS | TBT | SEO |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/` | 4,243 ms | 19.9% faster | 0.125 | 263 ms | 100 |
| `/methodik` | 3,940 ms | 21.1% faster | 0.000 | 125 ms | 100 |
| `/quiz` | 5,706 ms | 10.8% faster | 0.000 | 249 ms | 100 |

The critical-path and bundle changes produce material LCP improvements, but the public-page medians remain above the plan's 3-second stretch target. Per the agreed stop rule, further LCP work requires a separately aligned scope decision rather than expansion inside this analytics-loading change. Landing CLS is unchanged from baseline.

### Production-browser checkpoint

- Repository Chromium smoke: 10 passed across landing, pricing redirect, quiz, and auth.
- Request-level production smoke confirmed Meta and PostHog each load once with absent, accepted, denied, and changed-to-denied consent.
- Methodik loads neither Meta nor PostHog and retains first-party funnel context.
- Customer.io does not have a local write key in this checkout, so its real network load was not exercised; its queue, dynamic loader, single-flight, FIFO, and failure behavior are covered by focused runtime tests.

### Repository gate

- `npm run test:node`: 1,251 passed, 0 failed.
- `npm run ci:verify`: passed (`typecheck`, lint with the seven pre-existing warnings noted above, and production build).

## Post-Deploy Measurement Checklist

Deployment remains a separately authorized action. After deployment:

1. Confirm first-party funnel events continue arriving for landing, quiz, offer/result, checkout start, and checkout return.
2. Confirm Meta, Customer.io, and PostHog event names, event IDs, payload fields, and landing-to-checkout ratios remain within expected traffic-normalized ranges.
3. Expect Methodik Meta/Customer.io/PostHog pageviews and its former false `landing_viewed` milestone to be zero. Do not classify those intentional drops as tracking regressions.
4. Annotate any small vendor-only landing pageview decrease as the accepted fast-bounce gap unless first-party milestones also decline.
5. Check Sentry health for new client initialization, hydration, checkout-return, or navigation errors without attributing unrelated existing issues to this change.
6. Compare field Core Web Vitals after enough traffic accumulates, and compare the agreed 30-day SEO/GEO snapshot separately. Do not report the intentional measurement changes as a conversion or search lift.

## Final Review

- Read-only Codex judgment review: no blocking correctness or structural findings.
- The review covered deferred queue ordering, auth identity/reset behavior, checkout-return Subscribe/Purchase ordering, funnel-context readiness, Methodik/404 boundaries, failure isolation, lifecycle races, and focused coverage.
- Claude whole-worktree review was attempted with the configured default model and `xhigh` effort, but Claude Code reported that its session limit was reached until 20:30 Europe/Berlin. No fallback model was silently substituted.
