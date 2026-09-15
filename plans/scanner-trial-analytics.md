# Scanner acquisition and trial lifecycle analytics

## Outcome and source context

Nick requested correct scanner Meta tracking, detailed offer interactions, and a PostHog dashboard matching the other funnels. On 2026-09-15 he expanded the request to distinguish payment-method verification from free-trial-to-paid conversion and show cancellation timing, including trial day 3.

Baseline: origin/main `8a5e42c2`; branch `codex/scanner-trial-analytics`. Existing dashboard: https://eu.posthog.com/project/126788/dashboard/953895. Local implementation follows this confirmed contract; deployment remains outside this receipt.

## Chosen direction

Join acquisition and billing by a durable enrollment-level acquisition snapshot. Use verified billing facts for trial activation and money received. Preserve cancellation history separately from current cancellation status and access expiry. Enhance the existing dashboard with trial-start cohorts whose subsequent outcomes can occur outside the selected acquisition date range.

### Measurement contract

| Measure                           | Definition                                                                                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visitor to trial                  | Scanner funnel session that reaches verified trial activation; verification contributes zero revenue.                                                                                  |
| Trial to paid                     | Enrollment with a verified successful first paid charge; count once using canonical payment evidence. Reuse `purchase_completed`, rather than emit a second purchase-equivalent event. |
| Cancellation by trial day         | First cancellation submitted while still unpaid and inside the trial, measured from authorization. Day 1 is [0,24h), day 3 is [48h,72h). Show later requests/restorations separately.  |
| Cancellation source               | Customer submission vs provider-observed cancellation. Do not label webhook observation time as exact customer submission time.                                                        |
| Cancellation confirmation         | Provider acknowledgement, separate from the customer's request and effective access end.                                                                                               |
| First-charge failure and recovery | Verified first-charge failure, followed by a later verified successful first charge when present. Preserve the history even after recovery.                                            |
| Ongoing trial                     | Authorized enrollment whose original trial end has not arrived, without first payment. Exclude from a completed-trial conversion denominator.                                          |
| Trial ended, unpaid so far        | Original trial end passed without verified first payment as of the report cutoff. This is a time-dependent state, not an irreversible lost-customer event.                             |
| Paid conversion timing            | Show time to first charge and state the observation cutoff. Compare cohorts only at equal follow-up duration; never call an immature cohort's observed rate final.                     |

Cancellation, restored cancellation, and eventual paid conversion overlap as historical facts. They must not be added as mutually exclusive totals. Dashboard status counts must instead use an explicit as-of state projection.

## Scope and non-goals

Accepted scope: acquisition attribution through activation, cancellation history, first charge/failure/recovery; offer interaction gaps; existing scanner dashboard. This implementation follows trials through first payment and recovery; later paid retention is outside the accepted initial scope. No changes to checkout, trial duration, pricing, access, billing decisions, or customer-visible copy. No ad-campaign optimization change, deployment, or historical production replay is implied by this local implementation.

## Target map and source evidence

- `src/app/api/stripe/webhook/route.ts`: trial activation and first-paid outbox writers omit funnel attribution; standard purchase writer is a reference.
- `src/lib/paypal/trial-webhook.ts`: activation omits attribution; first-paid writer already resolves original/linked intent attribution.
- `src/lib/billing/analytics-outbox.ts`, `types.ts`, `analytics-destinations/posthog-server.ts`, `analytics-destinations/meta-capi.ts`: typed event contract, destination routing, delivery and deduplication.
- `src/lib/billing/trial-checkout-attempt.ts`, Stripe checkout creation, PayPal intent creation: persist original acquisition at enrollment creation; frozen Stripe params and PayPal intent are possible exact historical recovery sources.
- Trial admission/cancellation/payment/management migrations: `trial_enrollments`, private cancellation declarations/operations, payment ledger, effective agreement revisions. Implement additive migrations; preserve existing billing state transitions and fencing.
- `src/components/billing/scanner-trial-offer.tsx`, `src/components/scan-regal-offer/`, offer tracking provider: trial Continue, example dialog, carousel, video, WhatsApp interactions. Existing pricing anchors are already tracked.
- `scripts/posthog/`, `scripts/analytics/`, `docs/analytics/offer-page-tracking.md`: version dashboard definitions and event documentation following existing conventions.

## Decision coverage — confirmed for implementation scope

### Confirmed with Nick

- Separate initial payment-method verification from later actual paid conversion.
- Include cancellation timing within the free trial, including day 3.
- Improve scanner tracking, offer detail, and its PostHog dashboard.

### Inherited from evidence or contract

- Authorization and first successful payment are provider-backed facts. Original trial duration is seven days.
- Cancellation declarations retain an immutable `submitted_at`; cancellation does not immediately terminate trial access.
- PostHog `trial_started` currently exists; Meta explicitly excludes it. `purchase_completed` represents first successful paid payment.
- Both providers lose activation funnel attribution; Stripe also loses first-paid trial attribution. Existing analytics alone cannot reliably provide the requested cohort view.

### Implementation defaults

- Use enrollment identity and deterministic source/event keys; replay-safe delivery via the existing outbox. Include bounded non-PII properties and original funnel identity.
- Preserve original acquisition across plan/provider changes. Unknown historical acquisition stays unknown; do not infer scanner identity from the latest user session.
- Compute day numbers from elapsed time, not calendar midnights. Show dashboard timezone and reporting cutoff.
- Retain canonical purchase event names, avoiding double counting. Keep diagnostic cancellation/failure events PostHog-only.

### Confirmed scope and boundaries

- On 2026-09-15 Nick answered “Yeah exactly” to the proposed full trial lifecycle through first payment and recovery and explicitly confirmed Meta StartTrial as the initial optimization signal, with later purchase rate tracked separately.
- Emit Meta `StartTrial` only on verified activation with zero value. Emit `Purchase` on verified first paid charge. Keep cancellation/failure diagnostics PostHog-only. Existing paid renewal semantics outside trial acquisition are unchanged.
- Document historical recoverability and bounded rollout diagnostics; do not execute a production history replay as part of local implementation. Preserve unknown history explicitly. No campaign configuration, deployment, or migration execution is implied by this tracking implementation.

### Open consequential assumptions

None affecting the local implementation handoff. Live Meta receipt requires authenticated access. Production rollout and any historical replay remain concrete operational handoffs after verification, not hidden implementation assumptions.

### Coverage acknowledgement

Original improvement request included free-trial-to-paid conversion and cancellation timing. Nick then confirmed the proposed direction and explicitly said Meta should have StartTrial because it initially optimizes for trial starts while the business works on purchase rate. Accepted scope: acquisition/offer detail, verified StartTrial and subsequent Purchase, cancellation timing and first-charge failure/recovery, and the scanner dashboard through first payment.

### Internal revalidation

2026-09-15: latest acknowledgement resolves event mapping and initial lifecycle scope. No checkout/access/copy changes are introduced. Technical seams hardened and counterpart review incorporated below; local implementation may proceed. Undiscussed consequential assumptions affecting this handoff: none. No customer-facing evidence or separate journey sign-off is applicable to telemetry-only changes.

## Operator outcome and planning evidence

Nick opens the existing scanner dashboard, chooses a trial-start cohort, and sees acquisition conversion, activated trials, payment conversion, cancellation-day distribution, failure/recovery, ongoing trials, and unpaid-after-trial counts with their cutoffs. Provider and acquisition breakdowns expose attribution gaps. Offer interactions explain the earlier acquisition drop-off. No customer surface, copy, timing, or feedback changes; no customer mockup is required.

Evidence: read-only provider lifecycle source audit; existing immutable declaration and payment-ledger schemas; live PostHog inspection and saved dashboard baseline. Source code establishes intended emission, not production delivery. Read-only production counts at planning: five Stripe enrollments, one authorized, zero first-paid charges, zero cancellation declarations and zero applied payment failures. All five have a durable checkout source session; no historical Meta marketing permission/browser context was recorded, so historical Meta StartTrial must not be replayed as consented. Meta Events Manager was signed out; CAPI secrets are configured but read-protected, so enabled state and receipt are not verified.

## Concrete implementation contracts

- Freeze private enrollment analytics context before any provider creation call, independently of the exact-shape `accepted_offer`. Context holds a validated acquisition snapshot and separately stored, allowlisted Meta matching fields. The original checkout request supplies browser matching data; webhook request headers never do. New StartTrial marketing delivery follows explicit browser marketing permission; missing permission is not consent. Private matching data must never enter PostHog or the general outbox payload.
- Use the existing outbox/delivery tables, deterministic source keys and atomic database lifecycle capture. Prefer narrow triggers on durable fact transitions over replacing guarded billing functions. Cover both insert and reconciliation updates in the payment ledger. A narrow BEFORE ledger trigger freezes nullable `attempt_phase` on first transition to applied, using the locked enrollment state for failed rows and canonical successful phase for successful rows; preserve it on duplicate updates and leave unknown historical failures null. First failure uses applied failed evidence while first-payment state is absent; the ledger currently uses phase `none` for both first and renewal failures. Add no entitlement rule changes.
- Cancellation declaration, provider confirmation and committed restore each have distinct source identity. Provider-only cancellation needs an explicitly labelled observation fact at the guarded provider update seam. Derive unpaid expiry as an as-of report state, without a scheduled synthetic terminal event.
- Shared payload: `trial_enrollment_id`, `trial_authorized_at`, `trial_end_at`, `trial_cohort`, `trial_offer_version`, `interval`, original funnel session/package/variants/test identity, `lifecycle_source`. Preserve existing `trial_started` and `purchase_completed`; diagnostics: `trial_cancellation_requested`, `trial_cancellation_confirmed`, `trial_cancellation_restored`, `trial_cancellation_observed`, `trial_first_payment_failed`.
- Keep canonical provider purchase keys unchanged and remove competing trial TypeScript writers when database capture becomes authoritative. Retrying an existing delivery must not emit a second PostHog fact (`$insert_id` stable) or Meta conversion (stable `event_id`). Historical preexisting outbox payloads require explicit reconciliation planning, not automatic live replay.
- Offer content uses two PostHog-only events: `offer_content_interacted` (bounded content type/action/placement) and `offer_content_viewed` (one qualifying static benefit-card exposure per offer view). Use existing provider envelope and 25%/750ms visibility observer. For floating/footer contact, use a placement identifier and omit section rather than invent a section visited. The tracking hook must execute beneath its provider. Trial Continue reuses `pricing_primary` CTA attributes; do not duplicate header/bottom anchor tracking.
- Dashboard dates select activation cohorts. Follow their outcomes up to the report's current cutoff, including after the date-picker end. Show raw observed outcomes and a separately labelled first-charge conversion within 14 elapsed days, restricted to enrollments with 14 full days of observation. Fourteen days is a comparison window (seven-day trial plus seven-day follow-up), not a retry/access deadline. Empty denominators display unavailable, never 0% success. Test fixture cancellation/restore/paid histories and outcomes outside the acquisition date range.

## Ordered deliverables

1. **Attribution contract:** persist immutable enrollment acquisition and recover only exact existing checkout/intent bindings. Consumes original funnel session/package; produces one source for all lifecycle writers. Completion: Stripe/PayPal fixtures preserve acquisition across retries, continuations and provider changes; missing identity remains explicitly unknown.
2. **Lifecycle facts:** implement idempotent, durable PostHog emission for verified activation, requested/observed cancellation, confirmation/restoration and first-charge failure/recovery. Consumes source ledger/declaration identity and attribution contract; produces bounded event schema. Completion: tests cover duplicate/out-of-order webhooks, cancel on day 3, cancellation restored then paid, provider-origin cancellation and lost-delivery retry without changing billing decisions. Verify atomicity/recovery against current RPC boundaries before finalizing migration design.
3. **Meta and offer detail:** implement distinct authorized Meta trial/paid mapping and deduplication; add bounded offer interactions and trial Continue CTA. Completion: tests prove zero verification revenue, one Purchase per canonical payment, no diagnostic event leakage into Meta, and correct offer/view/revision IDs without duplicate existing anchor events.
4. **Dashboard cohort queries:** consume verified events, replace unavailable trial placeholders, and add lifecycle charts with explicit observation windows and historical coverage. Completion: deterministic cohort fixtures include outcomes after acquisition date range, recent trials, recovered payments and repeat cancellation; saved PostHog queries match source aggregates and chart labels.
5. **Operational receipt:** document live-vs-local verification and a concrete deployment/backfill proposal with source counts and exclusions. Completion: no claims of production completeness from local tests or inaccessible Meta settings.

## Verification

- Automated: focused billing analytics, Stripe invoice, PayPal activation/payment, cancellation/revision and outbox tests on Node 22; repository-required checks after implementation. Add only tests proving behavior and invariants.
- Migration: isolated database checks for additive schema, service-role access, deduplication, transaction failure/retry and concurrency boundaries; no production migration during planning.
- Dashboard: compare enrollment counts and exact known attribution with read-only authoritative aggregates; run saved queries with multiple date ranges and known edge-case cohorts. Never test by generating real paid charges.
- Meta/browser: verify test events and browser/server identifiers when authenticated access and a safe test environment are available. Do not claim ads optimization or live CAPI receipt without evidence.

## Counterpart review disposition (2026-09-15)

Claude Opus 4.8/high returned approve with revisions. The reviewer read an earlier draft while concrete contracts were being added. Verified each concern against current source:

- **Acquisition persistence:** keep `funnel_sessions` and the original checkout binding as source authority. Use one private enrollment context as an immutable delivery snapshot alongside consented Meta request fields, frozen from validated existing funnel data before provider creation. Exact frozen Stripe params / original PayPal intent are recovery evidence for preexisting attempts; never infer from current user sessions. This does not transfer data ownership or replace billing truth. A private context table is needed for consented browser matching anyway; including the immutable acquisition snapshot prevents provider switches and mutable later intent metadata from changing analytics. This is an internal persistence choice within the accepted tracking scope, not a new business attribution model. The alternative of repeated lookup alone does not resolve the confirmed early PayPal webhook race or hold private consent context.
- **Meta routing:** reroute the existing `trial_started` canonical event to PostHog plus consented Meta, map it to `StartTrial`, stable event ID `provider:trial_started:enrollmentId`; keep Customer.io blocked. Update outbox routing, Meta guard/map/source, destination tests and trial exclusion tests. Preserve existing first-paid provider keys and paid-renewal behavior; renewals are not additional trial conversions.
- **Failure isolation:** no PostHog/Meta HTTP delivery or live attribution lookup in an activation transaction. Durable fact/outbox insertion is atomic; database failures roll back and retry rather than silently losing facts. HTTP delivery stays in existing retry dispatcher/cron. Preserve durable capture when provider webhook handlers are skipped on verified replay. The review suggestion to swallow all analytics persistence errors is rejected because it can permanently lose the requested history.
- **Historical tooling:** no speculative replay engine. Include an aggregate read-only readiness report and exact documented recovery boundary; the production cohort is one activation and no payments/cancellations, superseding reviewer's stale memory. No live replay.
- **Dashboard convention:** TypeScript definitions and guarded `scripts/posthog/ensure-scanner-trial-dashboard.ts`; JSON file is only the verified original dashboard baseline for drift checks.
- **Offer corrections:** plan selections are already tracked; only Continue's generic CTA annotation is missing. Keep existing anchors and plan-selection event ownership.

Coverage revalidated: approved scope and original acknowledgement unchanged; no open consequential assumption affects this local implementation. Reviewer output is transient/discard after incorporation. No second reviewer dispatched.

## Review and handoff

Plan review completed and coverage confirmed. Continue in implementation-loop with the concrete contracts above. Run ready-check and the single counterpart whole-branch review before any authorized publication. Production rollout and historical replay need a concrete reviewed proposal. Commit the chosen plan, code, tests and durable dashboard definitions; discard transient reviewer output after incorporating findings. Current status: local implementation and verification completed; counterpart code review disposition recorded in the handoff receipt. Production rollout not performed.

## Final internal revalidation and code review

2026-09-15: original acknowledgement and scope remain confirmed. Local implementation complete; no customer journey, payment decision, or campaign setting changed. Independent Claude Opus 4.8/high whole-tree correctness/structural review found no hard defects. Consent-gated trial purchases are the documented contract, including lower Meta signal from non-consenting traffic; no external marketing stakeholder or additional approval was introduced. Delayed PayPal dispatch is documented, the Customer.io diagnostic was clarified, and generated Playwright state is restored. Main reviewed the subsequent cancellation-before-payment predicate, payment-timing column, unused-binding cleanup and documentation delta. Verification and rollout limits: `docs/analytics/scanner-trial-tracking.md`. Transient review output discarded after incorporation.
