# Scanner trial tracking

## Meaning of conversion

- **Meta StartTrial / PostHog `trial_started`:** verified activation of the seven-day trial, zero revenue. Server admission is authoritative; neither opening checkout nor a return URL is proof.
- **Meta Purchase / PostHog `purchase_completed`:** the first successful paid charge, classified as `system_generated` because trial billing happens automatically. Existing paid renewal events remain `payment_completed`; they never increase the trial-to-first-payment denominator or numerator.
- **Trial cancellation day:** elapsed time from verified activation to the customer's immutable cancellation submission. Day 1 is [0h,24h); day 3 is [48h,72h). Provider observation/confirmation does not establish the exact customer decision time.

## Lifecycle events

| PostHog event                  | Source                                         | Interpretation                                          |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------------------- |
| `trial_started`                | Canonical enrollment activation                | Payment method verified, trial active                   |
| `trial_cancellation_requested` | Cancellation declaration                       | Customer submitted cancellation                         |
| `trial_cancellation_confirmed` | Provider operation confirmation                | Provider acknowledged cancellation                      |
| `trial_cancellation_observed`  | Guarded provider cancellation update           | Cancellation observed; customer submission time unknown |
| `trial_cancellation_restored`  | Committed restore operation                    | Cancellation restored; keep the earlier history         |
| `trial_first_payment_failed`   | Applied failed first-payment ledger record     | First collection failed, no revenue                     |
| `purchase_completed`           | Applied successful first-payment ledger record | Free trial converted to first paid period               |

There is no synthetic terminal “never paid” event. The dashboard derives “trial ended, unpaid so far” at its report cutoff; later recovery can change that state. A cancellation, restoration, failure and purchase can all describe one enrollment. Historical event counts are overlapping, not mutually exclusive states.

Every new lifecycle payload carries `trial_analytics_version=1`, `trial_enrollment_id`, authorization/end times, original funnel attribution, test identity, and lifecycle source. The durable outbox and its destination rows are captured in the same database transaction as the fact. Provider retries and reconciliations preserve event identities; destination delivery is retried separately. PostHog receives a stable `$insert_id`; Meta StartTrial uses `provider:trial_started:enrollmentId`. Existing purchase identities are preserved.

## Attribution and consent

The original canonical funnel session is frozen in a private enrollment context before Stripe or PayPal creates its provider object. Plan/provider operations cannot replace that acquisition. Frozen Stripe checkout parameters or the original PayPal intent can recover an exact older source; absent evidence stays unknown.

Only an explicit browser marketing choice permits new trial Meta delivery. The original checkout request supplies allowlisted browser matching identifiers and user agent. Those fields stay private and are excluded from PostHog/outbox event properties. No IP address is newly persisted. Diagnostics go only to PostHog; marked tests/partner journeys do not produce trial Meta events.

Lead and offer-view CAPI include the server-resolved package key behind the existing `FUNNEL_META_CUSTOM_DATA_ENABLED` flag. Offer attribution uses the signed session and its lead binding, never a package supplied in a request body or an unrelated latest session.

Meta's public SDK documents the separation between event fields and user matching fields: [server events](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/serverside/server-event.js), [parameter builder](https://github.com/facebook/capi-param-builder/blob/main/nodejs/README.md). Production receipt and campaign optimization must be checked in Events Manager/Ads Manager; code and a configured token are not receipt evidence.

## Offer details

`offer_cta_clicked` now includes the trial Continue button (`pricing_primary`, destination `checkout`, selected interval). Existing header/bottom anchors and plan-selection events retain their owners.

- `offer_content_interacted`: example open/close, carousel previous/next, video play/completion/failure, WhatsApp clicks.
- `offer_content_viewed`: one qualifying exposure per fixed benefit card per offer view, using 25% visibility for 750ms.
- WhatsApp placement distinguishes pricing inline, footer and floating controls. Floating/footer clicks do not claim a page section was viewed.

All content events use the shared offer/session/revision envelope and are PostHog-only. Visibility does not prove reading; video events do not prove how much was watched between play and end.

## Dashboard

Existing dashboard: [Scanner — Funnel & Offer-Details](https://eu.posthog.com/project/126788/dashboard/953895).

Definitions: `scripts/analytics/scanner-trial-dashboard.ts`; audited predecessor: `scanner-dashboard-baseline.json`; guarded installer: `scripts/posthog/ensure-scanner-trial-dashboard.ts`.

The proposed dashboard has 16 charts, including activation/paid/ongoing/unpaid states, start-date cohorts, cancellation-day distribution, failures/restorations, Stripe vs PayPal and offer content interactions. Its trial date filter selects **activation cohorts**. Outcomes are followed through now, including after the selected date-range end. Other acquisition/offer charts use their stated event windows.

The comparable paid rate is **first charge within 14 elapsed days / trials observed for at least 14 elapsed days**. The window is seven trial days plus seven follow-up days; it is not a payment retry or access deadline. The cohort table also reports mean elapsed days to first payment among paid enrollments. Recent cohorts keep an empty comparison rate. Raw observed paid totals can include later recoveries.

```sh
# Local declaration; no network or writes.
node --import tsx scripts/posthog/ensure-scanner-trial-dashboard.ts

# Read-only live preflight, using a PostHog personal API key from the environment.
node --import tsx scripts/posthog/ensure-scanner-trial-dashboard.ts --inspect

# Publish live queries after deployment, before the first new activation; empty cohorts stay unavailable.
node --import tsx scripts/posthog/ensure-scanner-trial-dashboard.ts --apply --confirm-project=126788 --publish-awaiting-telemetry

# Normal guarded update after v1 scanner activation is received.
node --import tsx scripts/posthog/ensure-scanner-trial-dashboard.ts --apply --confirm-project=126788
```

The installer verifies the exact dashboard and audited/current chart definitions, refuses shared/drifted charts, checks for received v1 scanner trial telemetry, and runs changed queries before saving them. Reruns do not create duplicate insights. The explicit pre-telemetry publication saves the real queries, so new events populate automatically without a later activation step. Empty trial cohorts return no aggregate rows; offer trial/payment counts remain unavailable until a matching activation exists. Existing acquisition/offer charts retain their live data.

## Verification and release boundary

Synthetic histories execute the same cohort SQL in PostHog without inserting events. The checked fixture has five eligible trials: one paid, one ongoing, three ended/unpaid; two day-3 customer cancellations; one failed-then-paid recovery; two mature trials with a 50% 14-day conversion rate. Legacy, unknown, other-funnel and test enrollments are excluded. Clipping follow-up to the cohort date range incorrectly reports zero paid, proving the regression guard. A second fixture verifies that cancellation after an early first payment is excluded from free-trial cancellation days.

Planning read-only production snapshot (2026-09-15): five Stripe enrollment attempts, one authorized, zero first payments/cancellation declarations/applied payment failures. All five attempts have a durable source session. This does not establish that all five belong to scanner traffic. There is no historical marketing-consent/browser context to justify replaying Meta StartTrial. No historical events were replayed.

Release requires the additive migration before application code. The default dashboard installer requires a verified v1 activation; the explicitly authorized `--publish-awaiting-telemetry` rollout publishes final queries early, with empty trial charts that automatically fill when matching events arrive. Inspect delivery rows and provider receipt during rollout, especially any events handled by an older deployment. Do not infer successful Meta delivery from PostHog, or infer actual payment from trial activation. The local implementation itself performs no production writes; the separately authorized production rollout is recorded below.

### Mixed deployment handling

The database delivery guard silently skips forbidden v1 destination inserts, including an older application writer trying to attach Meta without frozen marketing consent. Existing non-trial destinations retain their behavior.

An older adapter can permanently reject a newly queued, consented StartTrial with the exact error `trial_started is restricted to PostHog`. After the new application deployment is verified, inspect only rows matching all of these conditions: Meta destination; `failed_permanent`; that exact error; outbox event `trial_started`; payload version 1; matching private enrollment context with marketing consent; no internal, field-test or partner identity. Do not broadly reset failed deliveries. Any repair must be separately authorized and bounded to the reviewed delivery IDs, rechecking those predicates while setting status to `pending`, attempts to zero, next attempt to now, and clearing processing/error fields. No repair was executed during implementation.

Immediate webhook dispatch targets the event key for that request. A PayPal effective-agreement switch can defer delivery to the existing billing reconciliation sweep if the immediate key differs; inspect both the outbox key and sweep before diagnosing a missing conversion. Confirm frozen `funnel_session_id` on the paid event during rollout.

### Local review result

No blocking findings in the independent Claude Opus 4.8/high correctness and structural review. The combined main-session focused suite passed 81/81; production build and lint passed (unrelated warnings remain). Real offer-event browser assertions have passing Chromium and mobile WebKit cases; one local hydration failure passed on an unchanged rerun. Removing Continue tracking caused the expected missing-event failure. Migration tests use PGlite and do not establish independent two-session concurrency. Meta receipt and deployment are still unverified.

## Authorized production rollout — 2026-09-15

Nick authorized shipping and making this live for dashboard review. Supabase migration `20260915113126_trial_lifecycle_analytics` was applied first through the migration API; the local filename matches its recorded server version. All seven lifecycle triggers are enabled. Private-context RLS is enabled and browser roles cannot read the context or call its read RPC. No historical conversions were replayed. Application deployment and final dashboard publication are verified separately in the release receipt.
