# Free-trial implementation sequence

> Supporting detail retained from revision 0.50. The consolidated [plan.md](plan.md), revision 1.0, is authoritative for current scope, decisions, task order and handoff status.

Revision 0.49, 13 September 2026. Companion to `plan.md`, which owns commercial values and original acknowledgements. **Planning, not a release-ready approval.** Nick has requested progress toward implementation; no application code, migrations or production enrollment changed in this pass.

Independent review reconciled in [review-resolution.md](review-resolution.md), including concrete admission/provider operation contracts and the remaining provider-verification boundary. Individual O1–O3 decisions are confirmed; reviewed-flow acceptance is now recorded; complete handoff remains pending on the provider proof and trial-list privacy validation.

## Outcome and boundaries

Replace the existing payment modules on `/result/[leadId]` and `/reactivate` with the approved trial offer for eligible new customers. Keep the current account, quiz attachment and product continuation. Existing subscriber terms, one-time fulfillment, manual grants and test cohorts remain unchanged. `/pricing` remains a router. Freemium stays parked; refinement locks stay deferred.

Use the approved `mockups/cal-ai.html` and `scanner-hero.webp`; do not reopen its layout. Monthly and annual get the same trial. Treat verified authorization as sufficient for trial onboarding, never as paid revenue.

## Decision coverage at this revision

**Confirmed:** seven-day trial; card or PayPal mandate; monthly EUR 9.99; annual EUR 69.99 first paid year then EUR 99.99; no launch cutoff; one trial per customer with the approved strong-identity checks; original trial end survives cancellation reversal and interval changes; trial access through original expiry after cancellation; immediate lock without first payment; full first paid period starts at successful payment; later-renewal seven-day access grace; only required billing communications; existing-customer preservation; one-time offer retirement; approved scanner offer design. Original user acknowledgements remain in `archive/plan-v041.md` and the unmodified `archive/interview-v036.md`; `plan.md` now holds the current compact decision record.

**Inherited:** existing account ownership and continuation, retained profile/plan data, current product usage limits, existing paid-period terms/refund policy and protected manual/test cohorts. Required cancellation/withdrawal submission and receipts are addressed in T4/T6. No new feedback gate, retention promotion or deletion/export policy. The reactivation screen currently promises saved context (`membership-reactivation-page.tsx:48–50`); its `<OfferPreviewRoutine>` at line 172 must be hidden for the expired new-trial cohort, matching Nick's content-lock decision.

**Engineering defaults:** UTC instants; server-controlled catalog IDs and prices; explicit cohort version; stable provider operation keys; reconciliation from verified provider truth; no secrets in metadata/logging; exact expiry comparisons independent of cron delivery.

**Latest customer-flow decisions:**

| ID | Concrete issue | Dependent scope |
| --- | --- | --- |
| O1 — confirmed | Nick explicitly chooses fresh paid checkout after failed first payment on 12 September 2026, with a complete year/month from verified successful payment. Example: paid 23 September 2026 → annual renewal 23 September 2027, even if the trial expired on 20 September. | Implement the approved first-failure recovery and matching service/renewal dates; provider execution and race handling still require proof. |
| O2 — confirmed | Nick approves sunsetting the waitlist on 12 September 2026 and reports no traffic is directed there anymore. Retire new signup; retain existing records and do not infer withdrawal of historic promises. No outreach requested. | Include waitlist retirement in T5; no further sunset decision needed. |
| O3 — confirmed, feasibility pending | Nick accepts the described PayPal reapproval flow on 12 September 2026: restore via PayPal approval, retain the original deadline/price, and leave cancellation effective if restoration is abandoned. Required reapproval for trial interval changes is also accepted. Nick explicitly expects the mechanism to be verified. | Implement only a proven reversal/switch mechanism; provider verification is still a release gate. |

**Evidence/launch gates, not additional pricing interviews:** exact Stripe trial-plus-once-coupon behavior; PayPal cycle and replacement execution; minimal required notice coverage; Codex-owned verification of inclusive pricing and actual applicable tax configuration; authorized live transaction test scope; final rollout/kill-switch behavior. No sandbox resources under Nick's instruction. Tax backlog does not prevent flag-off code preparation, but guessed tax treatment must not be activated.

Overall decision coverage remains **pending** on provider proof and trial-list privacy validation. Nick has accepted the reviewed initial flow, explicitly cancellation; preserve that scoped acknowledgement. Internal revalidation 0.50 preserves O1, O2 and O3 approval and incorporates verified counterpart findings; it does not manufacture a new approval from the instruction to continue. These three customer-flow forks are resolved. Counterpart review can now inspect the concrete plan and flag remaining technical/design readiness gaps; the reviewed initial flow has since been accepted. Any substantive new customer-facing correction needs only its own review; no blanket re-approval of unchanged screens.

**O4 — confirmed, implementation deferred:** Nick accepts continued EUR 99.99 annual billing, cancellation on at most one month’s notice after the first term, and a refund of unused prepaid time after effective termination. On 13 September he explicitly allows later implementation. Keep launch terms accurate now; finish the year-two settlement/UI and verify them before the earliest affected renewal. Legal validation remains; no new annual-purchase requirement. See `plan.md` and `verification-gates.md`.

## Provider findings and uncertainty

### Stripe

Use existing subscription Checkout, mandatory payment-method collection, seven days and **flexible** billing mode supported by the pinned API. Grant access only from a retrieved authorized trial subscription with resolved setup requirements. The full-price annual Price plus the EUR 30 once coupon models 69.99 then 99.99; Stripe's changelog explicitly says zero invoices do not redeem coupons, but actual invoice boundaries remain acceptance evidence.

During a trial, first use a narrow direct item-price update with unchanged billing anchor and no proration, preserving immutable `trial_end`; apply/remove the launch coupon according to the selected interval. Flexible-mode documentation explicitly preserves the anchor when the interval changes. Keep the legacy discounted paid-plan guard. Do not introduce schedule machinery unless evidence defeats the simpler documented path. Cancel at the immutable deadline; reversal clears cancellation. See [the final Stripe research](stripe-final-research.md) for API/source details and mandatory post-update assertions.

Fresh paid recovery must neutralize/reconcile the old collection first. Checkout creation is not proof of the actual payment-success timestamp or next annual boundary. Delayed success must satisfy T0 before this recovery adapter ships. Concrete payment-then-continuation candidate: [recovery-provider-candidates.md](recovery-provider-candidates.md); it changes receipt/fulfillment representation, not the approved price or duration.

### PayPal

The free-seven-day → discounted-annual → full-annual cycle shape is documented, but the start of those seven days relative to delayed approval is not established. Do not assume a default `start_time` created while `APPROVAL_PENDING` is the authorization clock.

First prove whether the simple free-cycle plan satisfies the agreed clock. If not, the documented candidate is a **no-free-cycle future-start** agreement: provisional start at creation + seven days, payer approval before that date, verified authorization timestamp, then a supported future `start_time` PATCH to authorization + seven days. Confirm provider billing facts before activating the trial. Never advance collection earlier than a consented date; the accepted terms and durable confirmation must explain the final date consistently. Do not extend only the app deadline while PayPal can charge earlier. Expired/failed/ambiguous attempts are neutralized and reconciled, not activated. This candidate is not yet verified against the merchant account.

No-free-cycle plans are monthly 9.99 indefinitely, or annual 69.99 once then 99.99 indefinitely (PayPal calls that first paid annual phase `TRIAL`; Chaarlie records it as paid). Existing draft `P-2XJ97149EE510364NNKSAIRA` is not the complete launch offer.

Cancellation uses immediate provider cancellation with app access to the original deadline. Restoration uses a new no-free-cycle agreement starting at that deadline and requires renewed approval. For active-trial interval changes, prove the existing `/revise` path first; abandonment must preserve the old agreement, and approval must preserve the original deadline. Do not invent cancellation-before-approval or a two-collectible-agreement swap. Fresh paid recovery requires a verified sale and matching full next period, not `ACTIVE` alone. For strict paid-period recovery also evaluate the documented setup-fee/future-start candidate in [recovery-provider-candidates.md](recovery-provider-candidates.md), subject to truthful provider terminology and execution proof. Exact sequences and uncertainty: [PayPal research](paypal-final-research.md), [T0 gates](verification-gates.md).

## Recovery practice evidence — checked 12 September 2026

- [Apple: reducing involuntary subscriber churn](https://developer.apple.com/documentation/StoreKit/reducing-involuntary-subscriber-churn?changes=_6_2&language=swift%2Cobjc) documents preserving the billing cycle when recovery happens during uninterrupted grace, and starting a new cycle at recovery after grace has expired. This is platform behavior, not proof of a specific app's grace configuration.
- [Google Play subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions) explicitly preserves the renewal date for grace-period recovery and resets it on recovery from account hold, when access was blocked. This supports Nick's chosen first-payment policy as an established approach for interrupted access; it is not evidence that most web apps use it.
- [PayPal payment failure/retry](https://developer.paypal.com/subscriptions/payment-failure-retry/) keeps outstanding failed payments within the existing billing cycles. Provider defaults do not necessarily implement the customer policy selected here.
- No reliable market-wide count or verified Cal AI/RiseGuide-specific late-payment policy was established. Do not claim either billing-date model is universal or the numerical majority. Recommendation for Chaarlie: use the newly confirmed recovery-date anchor for the strict first-payment lock; keep the separately approved later-renewal grace contract.
- Stripe documentation verification note: installed CLI lacks `stripe docs`, so official web documentation was used as fallback. The current generic `/billing/subscriptions/trials` page now describes a preview Trial Offer API that does not support Checkout; implementation must verify the version-compatible Checkout free-trial documentation rather than silently adopting that preview API.

## Ordered implementation tasks

### T0 — Resolve mechanism and contract dependencies first

**Consumes:** confirmed behavior and the three final research notes.

**Produces:** evidence for each row in [verification-gates.md](verification-gates.md), with exact requests, provider timestamps/amounts, expected versus actual results and pass/fail status. Separate documentation, local fixtures, noncharging provider previews and authorized real transactions. No resource creation, live authorization or charge is implied by research approval.

**Order:** establish PayPal authorization clock and both-provider trial switches first; prove late first-payment recovery dates before implementing that adapter. Use the current published service/14-day withdrawal promise as the launch baseline, with no waiver or usage deduction. Validate the necessity and lawful retention criteria for Nick’s confirmed persistent trial-use list before its migration; see the adversarial review. Do not ask again whether an external adviser exists. Keep dependent work blocked when proof fails; routine flag-off code can only follow final plan/journey approval and the relevant dependency resolution.

**Acceptance:** no unexplained first-charge-date mismatch, duplicate collectible agreement, shortened paid year or silently discarded payment. Do not reopen commercial choices unless a verified failure makes the agreed behavior unattainable.

### T1 — Cohort, eligibility and access policy

**Consumes:** confirmed commercial values, account ownership checks, existing `BillingSubscriptionRow` and checkout reservations.

**Files:** `src/lib/billing/types.ts`, `subscriptions.ts`, `entitlements.ts`, `src/lib/entitlements/access.ts`; new `src/lib/billing/trial-policy.ts`; scoped additive migration under `supabase/migrations/`; provider identity projections.

**Produces:** explicit `trial_v1` cohort facts: immutable original trial start/end, enrollment identity, first successful payment time, paid-through boundary, cancellation state, renewal-grace deadline, selected interval/offer snapshot and provider linkage. Keep legacy rows on existing semantics. Define pure `resolveTrialAccess(facts, now)` and `evaluateTrialEligibility(history, verifiedIdentity)` contracts before adapters consume them.

Reserve trial admission atomically across account/verified identity/payment-method claims. Activate the entitlement only for the winning verified enrollment. Failed or abandoned authorization does not consume a trial; a conflicting provider agreement must not remain capable of charging. Do not expose raw card fingerprints to clients. Reuse current denial of active membership, one-time paid/pending access and manual grants; preserve test bypasses outside trial enrollment.

Persist the minimal consumed-trial claims independently of profile/account cascade deletion. Support deletion removes profile content under the existing contract without silently resetting eligibility; statutory erasure/objection handling follows the documented assessment. Do not retain raw card data, hair profiles or unnecessary provider payloads in this list. Verify deletion/recreation, later strong-identity matches and denied-trial-to-paid-signup behavior.

**Acceptance:** new `tests/billing-trial-policy.test.ts` proves exact expiry, first-payment strictness, canceled trial access, seven-day later-renewal grace, no reset from repeated events, and explicit paid-versus-trial distinction. `tests/billing-trial-eligibility.test.ts` covers concurrent claims, abandoned authorization, strong/weak identity evidence and legacy preservation. Existing `billing-subscriptions-access-grace.test.ts` continues passing for legacy rows.

### T2 — Trial checkout and provider schedule adapters

**Consumes:** T1 eligibility/reservation contract and pinned offer snapshot; resolved provider pricing proof.

**Files:** `src/lib/stripe/checkout-session-params.ts`, `checkout-activation.ts`, `subscription-plan-change.ts`; `src/app/api/stripe/create-checkout-session/route.ts`; `src/lib/paypal/plans.ts`, `subscription-shapes.ts`, `checkout-activation.ts`; PayPal create-intent/approve routes and catalog validation scripts.

**Produces:** idempotent provider-created trial agreement, verified authorization timestamp, authoritative original trial end and schedule identity bound to the checkout attempt. Newly selected month/year only; no client-controlled amount, extra promotion field or stacking. Pin accepted offer terms so changing the launch coupon later cannot silently rewrite an enrolled trial.

If provider authorization occurs before a reliable payment-method identity becomes available, finalize eligibility before granting app access and neutralize any losing agreement without charging. Provider callbacks and redirects must converge on the same enrollment result.

**Acceptance:** extend `stripe-checkout-session-params.spec.ts`, `stripe-checkout-session-route-contract.test.ts`, `paypal-create-resources.test.ts`, `paypal-email-identity.test.ts`, `paypal-checkout-intent-payment-classification.test.ts`; prove zero due today, mandatory authorization, approved first/renewal amounts and quarterly rejection only for new cohort. Local fixtures do not substitute for provider execution proof.

### T3 — Activation, payment lifecycle and product guards

**Consumes:** T1 policy and T2 verified agreement/offer facts; existing account/quiz/provisioning contracts.

**Files:** both provider `checkout-activation.ts` and `webhook-handlers.ts`, Stripe webhook route, billing reconciliation, `src/lib/supabase/middleware.ts`, `src/lib/entitlements/access.ts`, `src/lib/personal-plan/navigation-access.ts`, billing entitlement consumers, `src/lib/billing/checkout-success-redirect.ts`, welcome and existing auth completion routes.

**Produces:** trial account activation through the existing flow; separate nonzero paid conversion; correct server/UI/API access at every lifecycle boundary. A legacy profile `active` fallback must not bypass the new trial policy. Keep recovery reachable after expiry without exposing saved product content. Delayed provisioning retries retain the original clock.

**Acceptance:** extend `checkout-activation.spec.ts`, `auth-post-checkout-routes.spec.ts`, `checkout-success-redirect.test.ts`, `stripe-webhook-handlers.spec.ts`, `paypal-webhook-handlers.test.ts`, `reactivation-routing.test.ts`. Cover no redirect-only access, zero-payment versus payment success, PayPal activation-before-sale, duplicate/out-of-order events, canceled trial expiry, first-invoice pending/failure, renewal grace and authenticated direct API requests. Trace all `hasCurrentAppAccess`, `hasCurrentPaidAppAccess` and `resolvePaidAppAccess` consumers, including `/result/[leadId]`, `/reactivate`, `/pricing`, `/api/billing/access`, `plan-bereit` and `navigation-access.ts`. The 24-hour legacy fallback is `EXPIRED_ENTITLEMENT_GRACE_MS` at `subscriptions.ts:35,356`; bypass it for expired new-cohort trials only. A verified active trial resolves to full premium feature access and the existing Chat/Routine/Scan/Anwendung/Profil navigation, including existing premium Merkliste, previews and refinement access under current usage/provisioning limits. It shows no freemium lock markers or PremiumSheet upsell. Normal incomplete-plan/provisioning guards remain. At expiry without payment the cohort locks product content instead of falling back to free previews; legacy/free/manual/test behavior remains unchanged. Feature access is not evidence of paid revenue. This makes Nick’s already-approved full-access decision concrete, rather than asking it again.

### T4 — Cancellation, interval change and payment recovery

**Consumes:** T1–T3; confirmed O1/O3; proven provider mutation ordering.

**Files:** `src/lib/billing/plan-change.ts`, provider plan-change services, PayPal cancel route, Stripe portal-session route, profile membership actions, `/reactivate` route/component; `src/app/agb/page.tsx`, `src/app/widerruf/page.tsx`, `src/app/datenschutz/page.tsx`; shared durable declaration service/outbox; public cancellation route and existing `/widerruf` surface. Exact new route names are an implementation default, not a commercial decision.

**Produces:** durable cancellation declaration and immediate receipt, separately reconciled provider cancellation, app access through original deadline; reversal and trial interval change with unchanged deadline; O1-approved first-payment recovery; later-renewal seven-day app grace independent of provider retry timing. Reuse existing paid-period management unless introductory schedule ownership makes it incompatible; report a new tradeoff rather than silently disabling an approved action.

Persist accepted cancellation intent before provider mutation. Send the receipt with submission time/effective end independently of the provider response. A provider timeout is reconciliation-pending, not customer cancellation failure. Only failure to durably save the declaration asks for resubmission. Public submission must not require login, but must not expose account facts or let arbitrary inputs mutate another customer’s subscription. Unmatched submissions get a declaration receipt and secure matching/support resolution. Withdrawal receipt does not itself determine refund entitlement. Apply the existing 14-day withdrawal/full-refund promise where applicable, including valid withdrawal after the trial-end charge. No first-use waiver or new usage deduction. Keep the contract-formation/legal deadline distinct from the seven-day trial clock; assess a genuinely new recovery contract separately from automatic conversion. Extend support deletion instructions to coordinate provider collection, existing cascade/restrict records and the approved retention rule; no new automated self-service delete UI. See the full contract in `verification-gates.md`.

Recovery must choose a single collectible agreement/invoice. If cancellation/void loses a race to a successful payment, reconcile that success before offering another checkout. Never simply discard a successful old payment. Resolve original pending payment states before replacements. A replacement that is only authorized does not unlock paid content. Detailed year-two termination/settlement is a deferred delivery consuming the confirmed O4 approach and legal validation. Do not reuse anniversary-only cancellation or silently change the selected refund approach. Launch terms disclose the agreed policy from the start. Establish paid period from provider evidence; a newly created immediate subscription's creation time is not automatically identical to a delayed authentication/payment-success time.

**Acceptance:** extend `billing-plan-change.test.ts`, `billing-plan-change-route.test.ts`, `paypal-cancel.test.ts`, `reactivation-helpers.test.ts`; add `billing-trial-recovery.test.ts` for cancellation/reversal at expiry, day-three interval change, approval abandonment, interrupted replacement, delayed success, duplicate submissions and old/new agreement races. Include accepted cancellation with provider timeout, submission just before expiry, public unknown/mismatched identity, durable receipt retries and no account enumeration. Cover valid withdrawal after charge, before charge and during unresolved collection, plus idempotent refund reconciliation; no live refund is authorized by tests. Do not ship an unverified cancellation-and-replacement workaround.

### T5 — Approved offer and minimal lifecycle UI

**Consumes:** approved offer markup/image, T1–T4 status/eligibility/amount contracts and reviewed downstream states.

**Files:** `src/components/quiz/result-offer-pricing.tsx`, `src/components/personal-plan-offer/personal-plan-offer.tsx`, `src/components/checkout/payment-method-checkout.tsx`, the invoked offer-overlay/payment components, `membership-reactivation-page.tsx`, profile membership section, welcome copy; `/warteliste` retirement under confirmed O2.

**Produces:** one consistent trial-first offer at the two existing payment modules, annual preselection, accurate monthly-selected terms, compact renewal disclosure, required final authorization terms and unchanged scanner visual. Bind every invoked credential/confirmation surface to the same server-controlled accepted-terms snapshot: selected interval, trial duration/end, first amount and later renewal amount/cadence. Verify the composed parent/overlay/provider step, not just a detached legal footer line. Legal-page updates are explicitly owned by T4. Eligible visitors see trial signup; ineligible visitors must expressly select paid signup. Retire new one-time purchases server-side as well as in UI while keeping historic fulfillment/recovery. Remove personal routine previews from locked new-cohort reactivation.

**Acceptance:** mobile 360/390px and desktop review against canonical evidence; no horizontal overflow; selected amount/CTA/terms agree; auth/account mismatch and cancellation/reapproval/payment-failure states tested in existing component/browser suites. Extend `stripe-offer-elements-checkout.test.tsx`, existing one-time checkout regression tests and reactivation UI checks. Scope excludes new homepage/quiz/email paywalls and scanner-funnel activation.

### T6 — Required communications and truthful analytics

**Consumes:** T3 canonical events, T4 durable declaration events, T5 accepted terms and the verified notice matrix in `notices-privacy-final-research.md`.

**Files:** `src/lib/billing/types.ts` (`BillingAnalyticsEventName` closed union), `src/lib/billing/analytics-events.ts`, analytics outbox/destinations, Stripe webhook purchase emission, `src/lib/customerio/stripe-lifecycle.ts` and existing delivery adapters.

**Produces:** `trial_started` distinct from `purchase_completed`; first nonzero successful payment counted once; equivalent PayPal first-paid-year tracking despite its `TRIAL` cycle name. Reuse mandatory confirmation/delivery where sufficient, with terms version, amount, dates and delivery evidence. No optional reminder campaign. Verify prompt contract confirmation, successful-payment receipts, cancellation/withdrawal receipts and applicable annual advance-renewal notices. Visa’s later clarification expressly covers trials of seven days or less in the initial confirmation; verify that content/delivery and the required transaction descriptor. No separate timing workaround or optional campaign is needed. Preserve unrelated product onboarding.

**Acceptance:** extend `billing-analytics-outbox.test.ts`, `billing-analytics-destinations.test.ts`, `stripe-purchase-analytics.spec.ts`, `customerio-stripe-lifecycle.test.ts`; prove zero trial revenue/purchase, exactly one paid conversion, no duplicated required confirmation, accurate cancellation and annual-renewal notice coverage. No actual messages sent by tests or during planning.

### T7 — Cohort rollout and release verification

**Consumes:** passing T1–T6, current decision coverage, reviewed journey, provider proof, tax/notice clearance and explicit publication/activation scope.

**Produces:** `docs/free-trial-launch-runbook.md`, new-cohort enrollment flag, catalog preflight and rollback receipt. Confirmed rollback stops new trial enrollment but continues accepted trial terms, pricing, cancellation, collection and recovery; it never converts existing trials to immediate payment. Original acknowledgement: Nick, 13 September 2026, changes apply only going forward.

Use Node 22 and the repository's current checks. Refresh the task base and check scanner-funnel and subscription-renewal-recovery sibling integration before implementation; do not merge sibling work or enable its flags implicitly. Additive schema changes leave legacy rows unchanged. Run migration preflight through repository tooling; no production database push during planning.

Separate local fixtures/browser proof, live catalog/noncharging previews, and actual authorized transaction evidence. No sandbox creation. Live coupon setup is complete; it is not proof of trial execution. An outstanding provider behavior test stays a release blocker rather than being represented as passed. Production charges require a concrete scoped test; existing customers are never test fixtures.

**Acceptance:** ready-check plus one counterpart whole-branch review; verify one-time retirement, legacy/flag-off parity, required webhook subscriptions, event replay, first/year-two totals, recovery routes and rollback continuation. Commit/push, merge and production activation follow their separate existing authorization boundaries.

## Reviewed initial walkthrough and remaining dependencies

1. Existing result/reactivation entry → trial-first scanner offer → choose annual or monthly → see selected post-trial and renewal terms → authorize card/PayPal.
2. Declined/abandoned authorization gives no trial. Verified eligible authorization starts seven days and reuses current account/profile/plan setup; duplicate redirects do not duplicate enrollment.
3. Trial user gets current paid-product features and limits. Membership management shows original expiry and chosen amount. Cancellation stops the charge and retains access until original expiry; reversal/interval change preserve the date, including any PayPal reapproval.
4. Successful first payment starts paid access. At trial expiry without successful payment, product content is locked and recovery remains reachable. Confirmed O1 uses fresh paid checkout and grants a full calendar month/year from verified successful payment, with the next renewal aligned to that date. Saved profile/plan stay retained.
5. Already-used trials return to explicitly paid signup; first annual launch discount remains available only if not already used. Existing subscribers keep old terms. Later failed renewals get the approved seven-day grace, followed by lock if unpaid.

Nick has now reviewed the downstream flow and explicitly accepted the cancellation behavior. Record the initial reviewed flow as accepted; do not re-request approval for unchanged screens. Complete handoff remains pending on provider proof and trial-list privacy validation and any genuinely new customer-visible correction.

## Artifact and review status

Retain the controlling plan/sequence, verification gates, final provider/notice research, concrete recovery candidates, entry coverage and canonical offer/profile/journey evidence with the eventual PR. Historical interviews and noncanonical comparisons are archived evidence. The old live transaction run sheet is deferred and unapproved; it is not a current permission request.

Claude Opus 4.8 (high) reviewed revision 0.46 as a planning artifact, approve with revisions. Verified path/access/coverage findings are corrected in 0.47. Later Visa clarification, O4 and recovery candidates are explicitly recorded as later research, not claims about that verdict. Full dispositions: `review-resolution.md`.

Current downstream review: `mockups/journey-review.html` and 18 alternative states in `mockups/journey/`. Representative mobile and desktop renders were inspected; evidence and limits: `mockups/journey-review-evidence.md`. The earlier `lifecycle-states.html` is superseded. Nick’s acceptance of the reviewed initial flow is recorded, explicitly cancellation. Remaining handoff dependencies are provider proof and privacy validation of the confirmed trial-use list. O4’s later settlement/UI delivery remains explicitly deferred.

## Deferred delivery — year-two settlement (O4)

Nick explicitly accepts this deferral on 13 September 2026. Keep it out of the initial-launch UI/automation build. Before launch, disclose the selected continuation and cancellation terms accurately and keep ordinary cancellation before the first renewal working.

The rollout runbook must record the earliest affected new-cohort annual renewal when real enrollment begins. Before that renewal, implement and verify at-most-one-month termination notice, access ending on the effective cancellation date, proportional refund of the prepaid remainder, duplicate-safe provider refunds and confirmation/UI. Exact calculation and receipt details are settled in that bounded later delivery after legal validation. Do not automatically substitute another fixed year, convert to monthly billing, or change existing accepted terms. This is a documented release checkpoint, not a newly scheduled automation.
