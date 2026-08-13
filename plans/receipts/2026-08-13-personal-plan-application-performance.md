# Personal Plan application performance receipt

Date: 2026-08-13
Environment: isolated Vercel preview
Deployment: `dpl_6aKA29nB8mzsRR9uB9Kn5p2DFv1h`
Preview: `https://hair-concierge-jtgnsyv50-nickrupprechter-gmailcoms-projects.vercel.app`
Mode: 30 fresh authenticated browser contexts per route; every non-GET/HEAD/OPTIONS request aborted

## Result

**FAIL** — application server p95 and meaningful-content p95 exceed the agreed thresholds.

| Route | Samples | HTTP/result | Meaningful p50 | Meaningful p95 | Internal p50 | Internal p95 |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| `/routine` | 30 | 30 × 200; no redirect | 2,589.26 ms | 3,349.96 ms | n/a | n/a |
| `/anwendung` | 30 | 30 × 200; no redirect | 2,808.21 ms | 4,046.28 ms | 1,235.38 ms | 2,057.95 ms |

Thresholds:

- `/anwendung` internal p95: at most 1,500 ms
- `/anwendung` meaningful-content p95: at most 2,000 ms
- unexpected same-origin application writes: zero

Write safety result: zero unexpected same-origin application write attempts. The harness blocked and reported 29 expected `POST /api/personal-plan/routine/sync` attempts plus 60 cross-origin telemetry requests. None executed.

## Diagnosis

The first exact-preview run exposed a serial Stage 5 read path. After the owner/frontier guard, the page re-read the plan before the active Routine version and waited for Routine adaptation before starting shared application-content reads. The corrected preview:

- keeps the fail-closed journey authorization first;
- reuses the owner-scoped active Routine version identity already established by that authorization;
- loads that immutable version and shared day/protocol content concurrently;
- retains owner scoping on the Routine version and refined-profile reads.

The change reduced internal median time from 1,456.92 ms to 1,235.38 ms. It did not make the agreed p95: 27/30 internal samples were below 1,500 ms, while the three slowest were 1,773.29 ms, 2,057.95 ms, and 5,419.26 ms. Normal Vercel phase logs still show the authorization prefix alone spending approximately 359–413 ms on entitlement, 119–182 ms on artifact/plan, and 120–142 ms on refined/draft reads. The remaining tail therefore requires a separate access/data-path performance decision rather than another copy or compiler patch.

Meaningful-content timing is a cold direct navigation (`page.goto`) in a fresh browser context, not an already-mounted Stage 4 → Stage 5 client transition. Response delivery and rendering add substantial time beyond the server marker; `/routine` also misses 2 seconds despite not compiling Stage 5 guidance. The receipt keeps the agreed measurement and threshold unchanged, but this distinction must be resolved before treating it as the product-navigation SLO.

## Cleanup

The disposable field-test campaign was revoked after capture. Its enrollment/access was revoked atomically. The authenticated browser storage state, generated test identity details, raw per-sample report, automation bypass token, and temporary helper scripts were not retained with the repository and were destroyed after this privacy-safe summary was written.
