# Seven-day free-trial implementation plan

Revision 1.6 — full Stripe and PayPal production deployment authorized, 14 September 2026.
Worktree: `.worktrees/free-trial-launch`; branch: `codex/free-trial-launch`.

**This is the canonical plan.** It contains the agreed behavior, target files, ordered implementation tasks, reviewed journey and acceptance gates. Companion documents retain research and review evidence; archived discussions do not override this file.

**Status:** commercial and initial user-flow decisions confirmed. No further commercial decision is currently requested. Nick owns the tax review and has instructed engineering and shipping to continue. Provider correctness and data-lifecycle verification remain engineering dependencies; tax review is not an engineering publication blocker. Live testing after deployment is agreed in principle; exact payer/transaction and public activation scope must match the concrete release procedure.

**Latest execution direction:** on 14 September Nick canceled the isolated PayPal live test: “need no test - we ship this right away”. Do not create the separate API app or test subscription, and do not request their approval again. This supersedes earlier requirements to perform that experiment before continuing. Continue implementing and preparing publication using current provider documentation, read-only catalog/configuration checks and local verification. Record unexecuted provider timing as unverified; do not mark it passed. Actual missing or defective checkout, cancellation, fulfillment and recovery code must still be completed; skipping the experiment does not authorize a change to the agreed customer contract or represent incomplete code as ready. The current implementation receipt identifies those gaps.

**Full deployment confirmed:** Nick explicitly chose “a full deployment with Stripe and PayPal, now fully live in production” and production verification on 14 September. The smaller card-only/native-renewal alternative is closed. This authorizes the required publication, production deployment, scoped provider/catalog/environment and additive schema activation for this launch, once the implemented behavior is coherent. No further deployment permission is needed. Preserve existing customers and require Nick to personally complete any payer authorization. No separate test app, sandbox or invented timing concession. Internal revalidation: the complete product contract and reviewed journey remain unchanged; only the authorized release boundary expanded.

## 1. Outcome and chosen direction

Replace the existing new-customer payment modules on `/result/[leadId]` and eligible `/reactivate` with the approved trial-first offer. Both monthly and annual memberships start with seven days of current paid-product access after verified card or PayPal authorization, then charge the accepted price unless canceled. Reuse account ownership, authentication, quiz attachment, provisioning and continuation.

Finish by implementing and verifying the exact journey below, protecting existing customers, and shipping the reviewed release with its runbook. Nick explicitly authorized implementation on 13 September 2026: “Okay then we can start implementation.” The later full production authorization above controls the release boundary.

## 2. Authoritative product contract

| Area | Chosen behavior |
| --- | --- |
| Trial | Seven days on monthly and annual. Card through Stripe or PayPal recurring authorization required. Start from verified provider authorization/activation, never a redirect alone. |
| Monthly | EUR 9.99 after trial; no additional launch discount. |
| Annual | EUR 69.99 for the first paid year while the launch offer is available, then EUR 99.99/year. Automatic offer application; no coupon field or stacking. No deadline, cutoff or countdown. |
| O4 — after the first annual term | Confirmed 13 September: keep EUR 99.99 annual billing; indefinite continuation with cancellation on at most one month’s notice, refund unused prepaid time after effective termination. Legal validation remains. Nick allows later implementation before the first affected renewal; no fresh annual-purchase requirement. |
| Price display | Confirmed again 13 September: EUR 9.99 monthly, EUR 69.99 first paid annual year and EUR 99.99 renewal are final customer prices on Stripe and PayPal, including any applicable tax. Never add tax on top. Codex verifies inclusive checkout totals; Nick owns the tax-treatment follow-up with his co-founder. No rate or registration status is invented. |
| Offer UX | Approved Cal AI-inspired mobile hierarchy and existing scanner photo. Annual preselected, monthly alternative, compact renewal terms and monthly-equivalent comparison. No explanatory timeline. |
| Entry scope | Replace existing modules only on result and eligible reactivation pages. `/pricing` remains a router. No new homepage, quiz, email or protected-product paywalls. |
| Retirements | No new one-time Personal Plan purchases; preserve historic fulfillment/recovery. Sunset new waitlist signup; preserve existing records and historic promises. No outreach project. |
| Existing customers | Preserve existing terms and access, including quarterly subscriptions. No migration. Freemium stays parked. |
| Trial access | Current paid-product features and usage limits. Refinement locks deferred. |
| Eligibility | One trial per customer. Prior activated trial or paid subscription denies another trial. Match account, verified email, reliable Stripe card fingerprint or PayPal payer ID, including shared-method cases. Weak name/address/IP/device signals alone do not block. No invasive fingerprinting. Failed or abandoned unactivated attempts do not consume a trial. Denial offers explicitly chosen paid signup/support, never a silent charge. |
| Trial-use history after deletion | Confirmed 13 September: maintain a minimal server-only used-trial list separately from deletable profile content. Deleting/recreating an account or returning later does not restore trial eligibility. Retain approved strong matching claims, consumed status and minimum supporting timestamps/version; no raw card details or unnecessary profile data. Deny the free trial, not login or an explicitly chosen paid subscription. Legal retention validation remains an implementation obligation. |
| Account flow | Existing password/login-link, ownership, email-mismatch, signed-in bypass, quiz linking and continuation remain. Trial authorization starts this flow but is not paid revenue. |
| Trial cancellation | Stop future billing and retain product access through the original trial end. After expiry, product content locks; retained data and recovery remain. |
| Reversal and plan changes | Allowed within the original trial, with no extra days. Show and confirm changed payment terms. PayPal reapproval is accepted subject to provider proof; abandoned restoration leaves cancellation effective. |
| First payment failure | Product content locks at trial expiry without successful payment. Recover through fresh paid checkout. Full first month/year and next renewal run from verified payment success. Paid 23 September 2026 means annual renewal 23 September 2027, even if trial ended on 20 September. Avoid overlapping collection. |
| Later renewal failure | Seven-day access grace for the new cohort, then lock if unpaid. The first-payment reanchoring decision does not automatically reset later renewal dates. |
| Return after unpaid trial | Immediate paid checkout, no new trial. First annual launch discount remains available if no discounted paid year was previously received and the offer remains available. |
| Communications | Only legally/provider/network-required billing communications. Reuse existing sufficient delivery; no optional trial reminder campaign. Product onboarding remains use-focused. |
| Provider verification | Live configuration requested; no sandbox resources. Live coupon creation is authorized and complete. The isolated live transaction experiment is canceled by the owner; preserve read-only provider and local verification and report the evidence limits. |

Rollback and future offer changes apply only to new enrollment. Existing trials retain their accepted dates, selected plan, introductory price and disclosed renewal progression. A later coupon change does not rewrite an accepted trial. The introductory-to-renewal progression is not a perpetual founding-price promise.

### Scope and explicit exclusions

- Replace the payment modules on the result and reactivation pages; keep `/pricing` as a router. Include the profile membership section, existing checkout/account continuation, locked recovery, and required public cancellation/withdrawal paths.
- Preserve existing monthly/quarterly/annual subscribers, historic one-time fulfillment and recovery, manual grants, test cohorts and existing profile/plan retention. Do not migrate them to the new offer.
- Retire new one-time purchases and waitlist signup in both UI and server entry points. Preserve history and existing promises. No outreach.
- Defer refinement locks, new freemium behavior, additional acquisition paywalls and scanner-funnel activation. No coupon entry, offer cutoff/countdown, optional billing reminder campaign, new deletion/export UI or new usage-deduction/withdrawal waiver.
- Detailed year-two cancellation settlement and UI are explicitly deferred until before the first affected renewal; accurate launch terms remain in scope now.

## 3. Decision coverage and evidence boundaries

**Decision coverage: confirmed for implementation of the approved contract. Provider/data-dependent work retains the evidence gates below.** This distinguishes a completed product interview from verified provider and privacy mechanisms.

| Bucket | Record |
| --- | --- |
| Confirmed with Nick | The complete product table above; reviewed mobile scanner offer and profile/journey; persistent minimal used-trial list across account deletion; inclusive final prices and provider-total checks, with tax treatment owned by Nick; prospective rollback; deferred year-two automation. |
| Inherited from evidence or contract | Current account ownership/auth/quiz continuation, product usage limits, legacy entitlements and saved context; the current 14-day withdrawal/refund baseline, distinct from ordinary cancellation. See [existing-contract review](existing-terms-adversarial-review.md). |
| Implementation defaults | UTC instants, explicit cohort/offer version, server-controlled prices and provider IDs, idempotent provider operations/outboxes, atomic eligibility claims, server-only identity matching and exact expiry checks. New internal service/route names do not require another commercial interview. |
| Open consequential assumptions | No undiscussed product choice. Resolve before the dependent handoff: provider clock/change/recovery proof and lawful operation of the confirmed retained trial-use list. Resolve before activation: required notice delivery and verified inclusive totals. Tax-treatment review stays with Nick. A demonstrated incompatibility returns only its specific consequence to Nick. |
| Parked out of scope | Refinement locks and new freemium; year-two settlement automation/UI until before the earliest affected renewal. Nick explicitly approved these deferrals. Existing-customer migration and a discount cutoff are excluded. |

**Undiscussed consequential assumptions affecting this handoff: none.** The named unresolved evidence dependencies remain visible; this is not an assertion that provider behavior or legal compliance has been verified.

**Coverage acknowledgement:** Nick confirmed the commercial/flow decisions over 11–13 September; approved the mobile design and scanner image; accepted the reviewed initial journey on 13 September, explicitly cancellation; agreed to the year-two approach and its later implementation; explicitly included the terms update; then reaffirmed the persistent used-trial list and inclusive prices. After reviewing the consolidated plan and reconciled Claude findings, Nick explicitly authorized implementation. This is the execution acknowledgement; earlier product and journey approvals retain their original dates. Preserve these approvals; do not request them again for unchanged behavior. Original discussion is retained in `archive/`.

**Internal revalidation:** revision 1.0 consolidates revision 0.50, its implementation sequence, verification gates and review findings without changing the agreed product behavior. Prior provider/legal evidence has the dates and limitations recorded in its source notes. No new counterpart verdict or live verification is inferred from this editorial consolidation.

## 4. Target map

Paths below are relative to the task worktree. Refresh the implementation base and confirm composed callers before editing; existing seam/line references in evidence can drift.

| Area | Main targets |
| --- | --- |
| Cohort, eligibility and access | `src/lib/billing/types.ts`, `subscriptions.ts`, `entitlements.ts`; new `src/lib/billing/trial-policy.ts`; `src/lib/entitlements/access.ts`; additive `supabase/migrations/` change. |
| Stripe | `src/lib/stripe/checkout-session-params.ts`, `checkout-activation.ts`, `subscription-plan-change.ts`, `webhook-handlers.ts`; `src/app/api/stripe/create-checkout-session/route.ts`; existing webhook and portal routes. |
| PayPal | `src/lib/paypal/plans.ts`, `subscription-shapes.ts`, `checkout-activation.ts`, `webhook-handlers.ts`; existing create-intent/approval/cancel/plan-change routes. |
| Application admission | `src/lib/supabase/middleware.ts`, `src/lib/personal-plan/navigation-access.ts`, billing access consumers and `src/lib/billing/checkout-success-redirect.ts`; existing welcome/auth completion. |
| Scanner offer integration | `src/app/result/[leadId]/result-client.tsx`, `src/funnels/offers/scan-regal-v1.tsx`, `src/components/scan-regal-offer/scan-regal-offer.tsx`; existing shared pricing slot, not a new commercial offer. |
| Offer and profile | `src/components/quiz/result-offer-pricing.tsx`, `src/components/personal-plan-offer/personal-plan-offer.tsx`, `src/components/checkout/payment-method-checkout.tsx`; composed offer overlay, profile membership actions and `src/components/reactivation/membership-reactivation-page.tsx`. |
| Contract management | `src/lib/billing/plan-change.ts`, provider management services, durable declaration/outbox service; public cancellation route; `src/app/agb/page.tsx`, `src/app/widerruf/page.tsx`, `src/app/datenschutz/page.tsx`; footer links and support deletion instructions. |
| Communications and analytics | `src/lib/billing/analytics-events.ts`, typed event union, analytics outbox/destinations; `src/lib/customerio/stripe-lifecycle.ts`; existing receipt/delivery adapters. |
| Retirement and rollout | Existing one-time checkout creation and waitlist handlers/callers located through [entry-point coverage](entry-point-coverage.md); enrollment flag/catalog preflight; `docs/free-trial-launch-runbook.md`. |

## 5. Reviewed design and user journey

### Accepted design evidence

| Evidence | Decision settled |
| --- | --- |
| [Mobile offer](mockups/mobile.html), [offer markup](mockups/cal-ai.html), [scanner background](mockups/scanner-hero.webp) | Trial-first mobile hierarchy inspired by Cal AI, compact plan selection, annual preselection and monthly comparison; reduced copy/font-size variation; no explanatory timeline. The previously created scanner image is locked in. |
| [Membership preview](mockups/membership-trial.html), [production-based profile markup](mockups/profile-trial-production.html), [production evidence](mockups/profile-production-evidence.md) | Match the current profile design, simplify current-plan information, omit the payment-provider row and preserve production primary/secondary button styling. |
| [Journey review](mockups/journey-review.html), [review evidence](mockups/journey-review-evidence.md) | Cancellation, receipt/pending/error, restoration, plan changes, payment recovery and public cancellation/withdrawal states. Nick accepted the displayed initial flow, explicitly cancellation. |

Evidence review and initial journey sign-off are confirmed. The journey preview contains 18 alternative states, not 18 sequential screens. Customer-frame buttons are static planning evidence; hosted provider screens are not fabricated. Later substantive customer-facing changes require review only of those changes; year-two states belong to their deferred delivery.

### Ordered user journey

1. Existing result/reactivation entry → approved trial offer → monthly/annual selection → accurate selected terms → card/PayPal authorization.
2. Verified eligible authorization → existing account/quiz/plan continuation. Declined or abandoned authorization gives no access or consumed trial; repeat callbacks do not duplicate enrollment.
3. Current paid-product features during trial. Cancel in one confirmation, receive a durable receipt and keep access through the original deadline. Restore or switch with unchanged deadline and any required PayPal approval; show actual pending/abandoned outcomes. Provider delays do not require the customer to cancel again.
4. At original expiry, require successful first payment for product access. Failure/processing keeps recovery reachable without showing product content. Successful recovery starts a full month/year and matching next renewal date.
5. Returning used-trial customers expressly choose immediate paid signup; prior discounted-year eligibility is preserved. Existing subscribers keep their terms. Later renewal failures use seven-day grace.
6. Public cancellation remains reachable without login. A separate withdrawal function records receipt and follows the inherited statutory 14-day withdrawal/refund baseline. The free trial ends after seven days; it does not erase a still-open withdrawal right. Required confirmations/receipts are transactional; no optional reminder campaign.
7. If new enrollment is disabled, existing accepted trial terms, cancellation and recovery continue. Production activation remains separately controlled.

## 6. Provider implementation contract

### Stripe

Use existing subscription Checkout, mandatory payment-method collection, seven days and **flexible** billing mode supported by the pinned API. Grant access only from a retrieved authorized trial subscription with resolved setup requirements. The full-price annual Price plus the EUR 30 once coupon models 69.99 then 99.99; Stripe's changelog explicitly says zero invoices do not redeem coupons, but actual invoice boundaries remain acceptance evidence.

During a trial, first use a narrow direct item-price update with unchanged billing anchor and no proration, preserving immutable `trial_end`; apply/remove the launch coupon according to the selected interval. Flexible-mode documentation explicitly preserves the anchor when the interval changes. Keep the legacy discounted paid-plan guard. Do not introduce schedule machinery unless evidence defeats the simpler documented path. Cancel at the immutable deadline; reversal clears cancellation. See [the final Stripe research](stripe-final-research.md) for API/source details and mandatory post-update assertions.

Fresh paid recovery must neutralize/reconcile the old collection first. Checkout creation is not proof of the actual payment-success timestamp or next annual boundary. Delayed success must satisfy T0 before this recovery adapter ships. Concrete payment-then-continuation candidate: [recovery-provider-candidates.md](recovery-provider-candidates.md); it changes receipt/fulfillment representation, not the approved price or duration.

### PayPal

The free-seven-day → discounted-annual → full-annual cycle shape is documented, but the start of those seven days relative to delayed approval is not established. Do not assume a default `start_time` created while `APPROVAL_PENDING` is the authorization clock.

First prove whether the simple free-cycle plan satisfies the agreed clock. If not, the documented candidate is a **no-free-cycle future-start** agreement: provisional start at creation + seven days, payer approval before that date, verified authorization timestamp, then a supported future `start_time` PATCH to authorization + seven days. Confirm provider billing facts before activating the trial. Never advance collection earlier than a consented date; the accepted terms and durable confirmation must explain the final date consistently. Do not extend only the app deadline while PayPal can charge earlier. Expired/failed/ambiguous attempts are neutralized and reconciled, not activated. This candidate is not yet verified against the merchant account.

No-free-cycle plans are monthly 9.99 indefinitely, or annual 69.99 once then 99.99 indefinitely (PayPal calls that first paid annual phase `TRIAL`; Chaarlie records it as paid). Existing draft `P-2XJ97149EE510364NNKSAIRA` is not the complete launch offer.

Cancellation uses immediate provider cancellation with app access to the original deadline. Restoration uses a new no-free-cycle agreement starting at that deadline and requires renewed approval. For active-trial interval changes, prove the existing `/revise` path first; abandonment must preserve the old agreement, and approval must preserve the original deadline. Do not invent cancellation-before-approval or a two-collectible-agreement swap. Fresh paid recovery requires a verified sale and matching full next period, not `ACTIVE` alone. For strict paid-period recovery also evaluate the documented setup-fee/future-start candidate in [recovery-provider-candidates.md](recovery-provider-candidates.md), subject to truthful provider terminology and execution proof. Exact sequences and uncertainty: [PayPal research](paypal-final-research.md), [T0 gates](verification-gates.md).

### Inclusive pricing and retained trial-use records

Use the confirmed behavior in [trial-history-and-inclusive-tax.md](trial-history-and-inclusive-tax.md). The customer total never increases because tax is added at checkout. Stripe uses explicit inclusive price tax behavior; PayPal supports inclusive plan taxes with a verified applicable percentage. Verify discount, first charge, renewal and recovery receipt totals. Documentation support is not proof of actual live configuration. Nick reports no VAT registration; do not infer a tax exemption or invent a rate/registration. Codex owns checking the provider settings and available merchant facts, with any missing business facts remaining on the cofounder/tax backlog.

Keep consumed-trial matching claims independently of deletable profile content so account recreation or time passing does not automatically restore eligibility. Use the approved strong identifiers and minimum supporting facts; no raw card data, retained hair profile or extra tracking. HMAC remains personal data. Validate necessity, lawful retention criteria, disclosure and erasure/objection handling before the dependent data lifecycle ships. If an actual legal limitation conflicts with the confirmed business rule, surface that specific limitation. Do not silently grant a new trial or claim an unlimited retention right.

### Existing provider resources: verify before use

These are recorded observations from earlier planning, not a fresh live inventory:

- Stripe product `prod_UMfRHJ3yh8l0bV`; full-price annual Price `price_1TNw7QGiGHTGZcKBv8jPk1MJ`; authorized EUR 30 once coupon `8KSV9CZz`.
- Existing Stripe `price_1TzMm3GiGHTGZcKBP1McmRA9` repeats EUR 69.99 indefinitely and must not be mistaken for the new introductory offer.
- PayPal product `PROD-1DJ37758SY227805K`; draft `P-2XJ97149EE510364NNKSAIRA` lacks the EUR 69.99 introductory phase and must not be activated as the complete offer.
- Historical live transaction proposal remains deferred and unapproved. No sandbox resources; no test charge or authorization is inferred from creating this plan.

## 7. Ordered implementation tasks

The following tasks contain the concrete files, consumed/produced contracts and proof of completion. Tasks use the authoritative commercial values in section 2. Begin with T0; a failed proof blocks only its dependent adapter/data work. Routine technical details are implementation work, not another product interview.

### T0 — Resolve mechanism and contract dependencies first

**Consumes:** confirmed behavior and the three final research notes.

**Produces:** evidence for each row in [verification-gates.md](verification-gates.md), with exact requests, provider timestamps/amounts, expected versus actual results and pass/fail status. Separate documentation, local fixtures, noncharging provider previews and authorized real transactions. No resource creation, live authorization or charge is implied by research approval.

**Order:** establish PayPal authorization clock and both-provider trial switches first; prove late first-payment recovery dates before implementing that adapter. Use the current published service/14-day withdrawal promise as the launch baseline, with no waiver or usage deduction. Following the reconciled Opus 5 review, local empty schema and synthetic-data tests may proceed under the confirmed trial-history policy. Validate the necessity and lawful retention criteria before the first real claim write, including migration/backfill/webhook/support paths; an enrollment flag alone is not sufficient. Do not encode an invented retention period or automated eligibility reset. Do not ask again whether an external adviser exists. Keep dependent provider work blocked when proof fails; local pure construction is not execution proof.

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

**Acceptance:** mobile 360/390px and desktop review against canonical evidence; no horizontal overflow; selected amount/CTA/terms agree; auth/account mismatch and cancellation/reapproval/payment-failure states tested in existing component/browser suites. Extend `stripe-offer-elements-checkout.test.tsx`, existing one-time checkout regression tests and reactivation UI checks. Include `tests/scan-funnel-offer.test.tsx`, `tests/scan-funnel-journey.spec.ts` and `tests/scanner-funnel-arrival.test.tsx`: scan-regal-v1 uses the shared ResultOfferPricing slot under /result/[leadId], not a separate /lp/scan/angebot paywall. Preserve scanner attribution, arrival and private-content locks. Scope excludes new homepage/quiz/email paywalls and scanner-funnel activation.

### T6 — Required communications and truthful analytics

**Consumes:** T3 canonical events, T4 durable declaration events, T5 accepted terms and the verified notice matrix in `notices-privacy-final-research.md`.

**Files:** `src/lib/billing/types.ts` (`BillingAnalyticsEventName` closed union), `src/lib/billing/analytics-events.ts`, analytics outbox/destinations, Stripe webhook purchase emission, `src/lib/customerio/stripe-lifecycle.ts` and existing delivery adapters.

**Produces:** `trial_started` distinct from `purchase_completed`; first nonzero successful payment counted once; equivalent PayPal first-paid-year tracking despite its `TRIAL` cycle name. Reuse mandatory confirmation/delivery where sufficient, with terms version, amount, dates and delivery evidence. No optional reminder campaign. Verify prompt contract confirmation, successful-payment receipts, cancellation/withdrawal receipts and applicable annual advance-renewal notices. Visa’s later clarification expressly covers trials of seven days or less in the initial confirmation; verify that content/delivery and the required transaction descriptor. No separate timing workaround or optional campaign is needed. Preserve unrelated product onboarding.

**Acceptance:** extend `billing-analytics-outbox.test.ts`, `billing-analytics-destinations.test.ts`, `stripe-purchase-analytics.spec.ts`, `customerio-stripe-lifecycle.test.ts`; prove zero trial revenue/purchase, exactly one paid conversion, no duplicated required confirmation, accurate cancellation and annual-renewal notice coverage. No actual messages sent by tests or during planning.

### T7 — Cohort rollout and release verification

**Consumes:** passing T1–T6, current decision coverage, reviewed journey, provider proof, inclusive-total/required-notice verification and explicit publication/activation scope.

**Produces:** `docs/free-trial-launch-runbook.md`, new-cohort enrollment flag, catalog preflight and rollback receipt. Confirmed rollback stops new trial enrollment but continues accepted trial terms, pricing, cancellation, collection and recovery; it never converts existing trials to immediate payment. Original acknowledgement: Nick, 13 September 2026, changes apply only going forward.

Use Node 22 and the repository's current checks. Task base refreshed to 5a3e33f1 on 13 September. Preserve the already-active scan_v1 source configuration and merged partner-access changes. Recheck any remaining subscription-renewal-recovery integration before related edits; do not merge unrelated sibling work or change its flags implicitly. Additive schema changes leave legacy rows unchanged. Run migration preflight through repository tooling; no production database push during planning.

Separate local fixtures/browser proof, live catalog/noncharging previews, and actual authorized transaction evidence. No sandbox creation. Live coupon setup is complete; it is not proof of trial execution. An outstanding provider behavior test stays a release blocker rather than being represented as passed. Production charges require a concrete scoped test; existing customers are never test fixtures.

**Acceptance:** ready-check plus one counterpart whole-branch review; verify one-time retirement, legacy/flag-off parity, required webhook subscriptions, event replay, first/year-two totals, recovery routes and rollback continuation. Commit/push, merge and production activation follow their separate existing authorization boundaries.

## 8. Verification and failure handling

### Provider proof matrix

| Gate | Documented starting mechanism | Evidence required / stop condition | Dependent work |
| --- | --- | --- | --- |
| Stripe trial clock and pricing | Subscription Checkout; required payment method; seven-day trial; flexible mode; 99.99 annual Price plus 30 EUR once coupon. Zero invoices do not redeem coupons according to Stripe's changelog. | Retrieved authorized subscription and setup status, provider trial timestamps, zero due at authorization, first nonzero annual invoice 69.99 and following recurring amount 99.99. Denied/unresolved setup gives no access. | T2 activation/catalog acceptance. |
| Stripe in-trial changes | Update the existing item with `billing_cycle_anchor=unchanged`, `proration_behavior=none`; annual coupon only for annual. | Both directions: same original trial end, one item, no immediate nonzero collection, correct selected first/renewal totals. Flexible-mode docs preserve the anchor; do not apply a classic-mode assumption. Preserve paid/legacy guards. | T4 switch/reversal adapter. |
| PayPal authorization clock | First evaluate the simpler documented seven-day free-cycle shape. If it does not start at verified approval, evaluate no-free-cycle future start and post-approval future-date PATCH. | Delay approval deliberately. Prove authoritative activation timestamp and first collection exactly seven days later. The candidate provisional creation+7 date can only move later to authorization+7, never earlier than consented. Hosted approval, Chaarlie terms and durable confirmation must agree; no false initial fixed charge-date promise. If unsupported or ambiguous, stop and report the exact incompatibility. | T2 PayPal adapter. |
| PayPal restore and trial switches | Restore canceled agreement with a no-free-cycle future-start replacement. Existing `/revise` is first candidate for an active agreement. | Original deadline and accepted offer retained; reapproval abandonment leaves cancellation/old active plan as appropriate; approved change adds no days or immediate collection. Verify no overlap and correct 69.99→99.99 paid phase. Future-start candidate changes must be tested on that actual shape, not only a free-cycle fixture. | T4 PayPal management. |
| First-payment recovery, both providers | Reconcile old collection; evaluate the exact [Stripe payment-then-continuation / PayPal fee-then-future-start candidates](recovery-provider-candidates.md); verify nonzero payment. | Delayed authentication/success must produce a full calendar month/year and matching renewal from the actual success timestamp. Establish provider-supported mechanics, not an arbitrary app-only date. Any old successful payment takes precedence over another charge; processing remains locked and reconciled. An unresolved in-flight payment prohibits replacement. | T4 recovery. |
| Annual progression | Provider invoices/schedules/preview and live catalog facts. | First paid annual term 69.99, next 99.99; once coupon not spent on zero trial invoice; paid PayPal `TRIAL` phase counted as paid. A preview is not an observed annual renewal. | T2/T6, activation. |

Research: [Stripe mechanism and sources](stripe-final-research.md), [PayPal mechanism and sources](paypal-final-research.md). The old transaction run sheet is deferred and unapproved; only bring a concrete revised request when an actual provider test is needed. Do not charge, create sandbox resources, or treat synthetic events as provider proof.

### Durable cancellation and public declarations

Required by the researched [§ 312k BGB](https://www.gesetze-im-internet.de/bgb/__312k.html) path, and consistent with the chosen cancellation behavior:

1. Authenticated membership action opens one confirmation with the original access end and no paid conversion. Final button: `Jetzt kündigen`. No survey or retention offer.
2. Atomically persist the declaration, receipt timestamp, requested/effective end, contract reference and idempotent operation; enqueue the transactional receipt. The customer can save their declaration and time.
3. Acknowledgement is of the declaration, not the provider's API response. A slow/failed provider call must not undo timely cancellation or ask the customer to cancel again. Keep access to the original trial deadline and process provider cancellation through a durable retry/reconciliation path.
4. The accepted intent prevents further merchant-initiated collection. Reconcile charges already in flight. If a provider still collects contrary to a timely accepted cancellation, reconcile and reverse that erroneous charge under the existing billing-support process; never mark it as a new intentional conversion. A reversal is a separately authorized operational action, not something executed during planning.
5. Only failure to save the declaration durably shows the retry error. Saved but provider-pending shows `Deine Kündigung ist eingegangen` and that no further customer action is needed. A queued receipt must not be described as delivered without delivery evidence.
6. Restoration or replacement must wait for a safely reconciled provider state. Unknown provider status cannot open a second collectible agreement.

The public, easily available cancellation form also works without login: customer/contract identification, cancellation type, extraordinary reason when applicable, requested end and receipt address, then `Jetzt kündigen`. Do not require login or an OTP before accepting the declaration. Do not expose whether arbitrary submitted identities have accounts. Immediately acknowledge the submitted declaration; securely match it to the contract before changing another account or disclosing its details. Ambiguous submissions go to the existing support process with the receipt timestamp preserved. For verified matches, confirm the effective end; do not invent it for an unknown contract. Cancellation links remain reachable even when product access is locked.

Receipt delivery uses an idempotent outbox and monitored retries; a send failure does not erase the customer's declaration. No new marketing flow.

### Required notices, contracts, privacy and tax

| Item | Concrete work | Gate / owner |
| --- | --- | --- |
| Mandatory transaction messages | Verify existing provider or merchant delivery for contract confirmation, payment receipts and cancellation/withdrawal receipt. Record exact content, date, terms version and delivery status. Avoid duplicates when existing delivery is sufficient. | T6 acceptance; engineering can inspect; no messages sent during planning. |
| Annual card renewal notice | Stripe's current Mastercard guidance scopes the 7–30-day advance event to billing periods longer than 180 days. The monthly plan is not subject to that particular annual rule. | Required notice, not optional reminder marketing. [Stripe guidance](https://support.stripe.com/questions/guidance-for-mastercard-recurring-billing-compliance-updates). |
| Seven-day Visa confirmation | The later Visa clarification expressly covers seven days or less in the initial confirmation. Verify expiry/cancellation content, durable delivery and the required transaction descriptor. | Existing exact-seven-day timing blocker withdrawn; no extra reminder campaign. [Later Visa clarification](https://usa.visa.com/dam/VCOM/global/support-legal/documents/recurring-vbn-public.pdf). |
| Binding subscription action | Keep the approved free-trial offer CTA for a non-binding transition. At the actual contract-forming action verify prominent terms and explicit payment-obligation wording, including hosted Stripe/PayPal screens. | T2/T5 consent acceptance. [§312j BGB](https://www.gesetze-im-internet.de/bgb/__312j.html). |
| Year-two termination and prepaid settlement | O4 confirmed: keep 99.99 annual collection; at-most-one-month termination notice after the first term; refund unused prepaid time after effective termination. | Nick explicitly defers detailed automation/UI until before the first affected renewal. Launch disclosure and legal validation remain; later delivery includes a reviewed settlement state and provider refund proof. [§309 no.9 BGB](https://www.gesetze-im-internet.de/bgb/__309.html). |
| Withdrawal baseline | The current AGB call this a digital service; Stripe hosted consent preserves the 14-day right and the public notice promises reimbursement. Preserve that baseline; do not claim the digital-content exception applies merely because a user scanned or opened a plan. | Adversarially reviewed against code/live promises and primary sources. Verify actual checkout, contract-formation evidence, legal deadline and refund handling; no new waiver or usage deduction. See `existing-terms-adversarial-review.md`. |
| Online withdrawal submission | Current enacted § 356a provides an online withdrawal function where a right exists, during its applicable period. Separate form and durable receipt; receipt is not an automatic promise of refund amount/decision. | Required platform compliance integration, not a new paywall or retention flow. [Official law](https://www.gesetze-im-internet.de/bgb/__356a.html). |
| Minimal anti-repeat identity retention | Nick confirmed a persistent minimal used-trial list, including after account deletion; no routine expiry resets eligibility. Versioned server-only HMAC remains personal data. Document necessity, lawful retention criteria, restricted access and statutory erasure/objection handling. Do not infer unlimited lawful storage from invoice retention or the one-trial business rule. | Product rule confirmed; privacy validation before the dependent T1 data lifecycle ships. See [current contract](trial-history-and-inclusive-tax.md). |
| VAT | Nick confirms tax-inclusive final prices on both providers and assigns verification to Codex. Stripe uses inclusive price tax behavior; PayPal supports inclusive plan taxes when applicable. Verify merchant facts, correct tax treatment, discount totals and actual settings. No guessed VAT rate or registration. | Engineering verifies inclusive final totals. Nick owns the tax-treatment follow-up with his co-founder; it is not an engineering publication gate. See the 14 September owner direction below. |

[Detailed primary-source research and code seams](notices-privacy-final-research.md). Public cancellation/withdrawal shortcomings are broader existing contract-management issues; the trial launch must integrate the required minimum. They do not justify rewriting unrelated existing customer terms. If legal validation changes a customer-visible withdrawal/refund or data-retention policy, bring that specific consequence back to Nick before implementation.

### Local, browser and release verification

- **Automated:** the named T1–T6 suites cover eligibility races, post-deletion matching, exact expiry, trial-versus-paid events, provider retries/ordering, late payment recovery, cancellation receipts, required communications and legacy preservation. Use Node 22 and current repository checks. Add behavior tests where necessary; avoid repetitive tests that merely mirror markup.
- **Browser:** compare 360/390px mobile and desktop against the accepted offer/profile/journey. Verify selected terms at every binding checkout surface, account mismatch, failed/abandoned authorization, cancellation/restore/switch, payment processing/failure/recovery, public declarations and access to management while product content is locked. No horizontal overflow or private routine preview after expiry.
- **Migration/live state:** use additive cohort/identity schema and repository migration preflight; preserve legacy rows, test/manual grants and deletion constraints. Verify real provider configuration/webhook subscriptions, accepted terms, inclusive amounts and required delivery. Synthetic events and previews must be labeled as such.
- **Release:** pass the implementation-loop's ready-check and one whole-branch counterpart review. Inspect full composed paths, including middleware, UI/API consumers and flag-off behavior. Correct any material review findings and revalidate only changed behavior.

### Rollout and rollback

Ship the new cohort behind an enrollment flag. Before enabling it, verify the T0–T7 evidence, provider configuration, required notices, inclusive customer totals and documented privacy handling. Disabling enrollment stops new trials only: already authorized users retain their original trial, prices, cancellation, payment and recovery behavior. Do not rewrite their agreement or immediately charge them. Preserve old subscriber terms and historical fulfillment.

The runbook records the earliest affected annual renewal when enrollment begins. Before that date, deliver the deferred year-two indefinite-continuation cancellation and proportional prepaid settlement behavior, with correct provider refunds, receipts and reviewed UI. This is a release checkpoint, not a scheduled Codex task.

## 9. Review, artifacts and execution handoff

Prior Claude Opus 4.8 high, read-only reviews and verified dispositions are recorded in [review-resolution.md](review-resolution.md). The latest retained [existing-contract adversarial review](existing-terms-adversarial-review.md) established the inherited withdrawal baseline, launch terms scope, public declaration/receipt requirements and the privacy-validation gap. Accepted defects are reflected above; rejected suggestions include an unsupported subscription withdrawal waiver and reopening already agreed product decisions. Year-two detailed implementation is explicitly deferred. These reviews are advisory and do not certify provider execution or legal compliance.

Revision 1.0 was a consolidation of those findings and subsequent explicit user decisions, not a claim of a new independent review. No further review is run solely to change an approval label. If T0 reveals a material incompatibility, validate the finding, update only the affected contract and obtain counterpart review where that substantive change warrants it.

| Artifact | Disposition |
| --- | --- |
| This plan, current supporting research/gates/review ledger, entry coverage and retained provider candidates | Commit with the eventual task PR as durable decision/evidence records. `plan.md` controls if an older companion summary differs. |
| Accepted offer/scanner assets, production profile evidence, journey states/assets and their evidence notes | Commit as reviewed design evidence. |
| `archive/`, historic interview/revisions, older comparison drafts and historical live run sheet | Archive as non-authoritative historical evidence; retain current preview URLs until packaging so user links continue working. No historical proposal is executable authorization. |
| Temporary reviewer outputs, generator scripts and redundant scratch captures outside the task folder | Discard after the implementation handoff once useful findings are retained. No unrelated user files are included. |

**Next execution step:** use `implementation-loop` on the existing task branch, refresh the current base and reconcile relevant sibling changes, then start T0 and proceed in dependency order. Product choices and the unchanged initial journey do not need another approval round. A concrete provider/privacy incompatibility is reported with evidence and its specific consequence. An evidence gate is never marked passed merely to finish the plan.

**Publication boundary:** Nick has now authorized local implementation of this plan. Commit/push, merge, production activation and live transaction testing retain their separate authorization boundaries. Local implementation is not evidence that provider execution or tax/privacy checks passed. The authorized live coupon creation from earlier planning remains the recorded exception.


## Execution intake — 13 September 2026

Outcome: implement this approved trial flow locally and produce a verified review-ready branch. Scope and confirmed behavior: sections 2–5. Inherited contracts and technical defaults: section 3. Undiscussed consequential assumptions affecting the initial handed-off slice: none. Nick’s explicit implementation request is the execution authorization; unchanged design/journey approvals remain intact.

Internal revalidation: fast-forwarded task branch from 469d41f5 to 5a3e33f1, preserving untracked plan/mockup artifacts; recorded the accepted scanner regression-coverage correction from the reconciled Claude review. Rejected repeated commercial approval and a nonexistent scanner offer-page fork. No independent review claim beyond the completed Opus 4.8 high pass.

Initial scope: pure provider-independent `resolveTrialAccess(facts, now)` and its behavior tests; no route integration, provider mutation, identity persistence, migration or activation. Verified provider snapshots will feed this function later. This isolated policy slice does not depend on unresolved provider mechanics or the identity-retention assessment. Stripe/PayPal T0 audits run in parallel. Database identity storage and provider adapters remain gated by their respective evidence.

Verification: Node 22 focused red/green policy tests and parent review; later integration follows T0–T7 plus ready-check and whole-branch review. Stop: local review-ready changes; no commit/push, production writes or live test charge without the existing explicit scope.

First execution receipt: [implementation-preflight.md](implementation-preflight.md). Pure policy slice implemented and locally verified; provider/persistence/integration tasks remain open.

### Continued implementation authorization

Nick reaffirmed: “You can start implementation with that,” and explicitly selected **Opus 5 at high effort** for independent reviews. Use the task-local invocation override `CLAUDE_CODE_REVIEW_MODEL=claude-opus-5` (or the corresponding plan-review variable), effort `high`, and no fallback. Do not change global Claude configuration. Earlier Opus 4.8 reviews retain their actual model attribution. The identifier is documented by [Claude Code model configuration](https://support.claude.com/en/articles/11940350-claude-code-model-configuration); a successful local invocation must still establish availability.

Independent local work now includes the immutable accepted-offer contract, pure eligibility policy, standalone approved offer component, and Stripe request construction using documented API parameters. These have no enrollment route or live provider side effects. Request-shape tests prove local construction only; they do not satisfy T0 execution proof. Atomic admission, provider activation/change/recovery, application access integration and retained-identity migration keep their stated dependencies. Enrollment remains unavailable until those parts are integrated and verified.

Opus 5 high completed the initial foundation review; [parent findings and dispositions](foundation-review-resolution.md) record fixes and rejected inferences. Internal revalidation in revision 1.3 preserves the original product/journey acknowledgement and narrows the data evidence gate to actual processing rather than local empty schema authoring. No new commercial choice or live-processing approval is inferred. Next local work is additive enrollment/atomic-claim schema and its tests; real provider lifecycle work retains T0 proof requirements.

### Execution update — 14 September

**Latest owner direction takes precedence over earlier tax-gate wording:** Nick is handling the flagged tax review with his co-founder and explicitly instructed Codex to focus on product/engineering and ship. Tax treatment is now an owner follow-up, not a blocker imposed on engineering publication. Preserve the approved inclusive prices and existing settings; no exemption, registration or rate change is inferred. Remaining engineering checks concern implementation correctness, provider collection behavior, data lifecycle and exact live-operation scope. The existing product/journey approval remains valid, and the current request authorizes verified commit/push/draft PR under the repository shipping contract.

Nick authorized continued implementation and a separate task for tax, retention and provider checks. [The independent report](independent-launch-checks-2026-09-14.md) was returned and inspected; its read-only evidence does not pass activation or real-processing gates. The original commercial and journey acknowledgement remains unchanged.

The local [admission persistence contract](admission-persistence-contract.md) now accompanies an additive empty migration, server-only persistence helpers and versioned HMAC projection. Synthetic SQL tests cover reservation, activation, conflicts, immutable terms, late callbacks, account deletion and service-only permissions. Shared billing access and middleware integration are now implemented and tested. Real provider writers, privacy rights operations, account provisioning and management integration, and multi-session PostgreSQL proof remain outstanding. See the latest [implementation receipt](implementation-preflight.md) for exact verification; this is not a final ready-check or new Opus verdict.

Nick subsequently requested a concrete retention proposal and expressed intent to deploy and review the live flow. The [policy proposal](trial-history-policy-proposal.md) is prepared for review, not accepted processing. Live verification should use a restricted operator cohort after local verification and deployment, before broad enrollment; exact live payer/commitment, migration/provider changes and activation scope remain to be recorded when the executable test is ready. This does not authorize using ordinary customers as fixtures or charging an unspecified amount.
