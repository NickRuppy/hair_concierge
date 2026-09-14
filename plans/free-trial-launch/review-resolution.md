# Independent plan review resolution

12 September 2026; review of revision 0.40, reconciled into revision 0.41. Reviewer: Claude Opus 4.8, high, read-only and terminal. Raw output: `/tmp/free-trial-plan-v040-review.md` (transient; discard after final handoff). Verdict: appropriate planning artifact, not an implementation handoff. No product code changed.

| Finding | Local verification / disposition |
| --- | --- |
| Provider execution proof unavailable under current constraints | Accepted. Live catalog setup is authorized, but it is not authority to charge a test payment or change an existing subscription. No sandbox resources. Provider-validation contract below defines what can be proven now and what needs a separately scoped live transaction. This is an external verification dependency, not a reason to claim readiness or silently launch untested. |
| Migration collision risk | Accepted with correction: a hard-coded timestamp during planning can become stale. At implementation, generate with `supabase migration new free_trial_enrollments` after checking local and refreshed target migration versions. Reject duplicate versions and versions not later than the relevant tip; record actual filename in the plan before migration review. Current task tip is `20260911090000_paypal_checkout_intents_premium_sheet_source.sql`. Do not create an empty placeholder migration merely to reserve a version. |
| Atomic eligibility and losing-agreement behavior underspecified | Accepted. Concrete transaction and provider-operation contracts below supplement T1–T4. Provider behavior still needs proof; an explicit call name is not that proof. |
| Preview citation | Accepted: retained-context FAQ is at `membership-reactivation-page.tsx:48–50`; actual `<OfferPreviewRoutine>` is at line 172. Suppress the latter for locked new-cohort recovery. |
| Typed `trial_started` event | Accepted: extend the closed `BillingAnalyticsEventName` union in `src/lib/billing/types.ts`, all destination exhaustiveness/filter logic and their tests. Do not widen to arbitrary strings. |
| Coverage sync | Accepted. Individual O1–O3 choices are confirmed; the complete record and final journey have not been signed off. Both controlling documents must say this. Historical pending statements are historical, not new interview questions. |
| Ship Stripe first instead of both providers | Not adopted. Nick expressly selected card and PayPal and approved provider-specific reapproval. Keep dual-provider scope. Return only if proven incompatibility makes that scope unattainable. |
| Ask again whether card/payer identity can prevent repeat trials | Not adopted as a new product question. Nick explicitly approved those strong identifiers and accepted shared-card false positives. Data minimization, access restrictions and compatibility with existing deletion/privacy handling remain verification obligations; this is not approval of indefinite new retention after account deletion. |
| VAT launch choice | Keep existing external dependency. No assumed VAT rate or tax-disabled launch is authorized. Code can be prepared flag-off; activation awaits verified applicable treatment. |
| Rollback continuation | Keep the concrete proposal for final journey/release sign-off: disable only new enrollment, honor already accepted trials and prices, leave cancellation and recovery operational. Never convert an in-flight trial to immediate payment. |
| Explicit old 24-hour grace regression | Accepted: trial expiry without successful first payment denies access at the exact expiry timestamp even when legacy grace would still admit a legacy subscription. |

## Concrete admission transaction

T1 introduces server-only `billing_trial_enrollments` and `billing_trial_identity_claims` with RLS enabled, no direct `anon`/`authenticated` table privileges, and restricted service-role transaction entry points. Follow repository auth ownership verification before the transaction; do not trust user-editable metadata for identity or entitlement.

- An enrollment has a unique checkout-attempt ID, immutable offer snapshot, operation state and provider reference. Provider agreement ownership has a unique `(provider, provider_subscription_id)` constraint. The same attempt with different account, interval or offer inputs is a conflict, not a retry.
- Identity claims have a unique `(identity_kind, identity_digest)` constraint. `identity_digest` is a versioned HMAC of the verified identity, never a raw payment-method fingerprint sent to clients or analytics. It permits approved matching; it does not make the data anonymous. Only account ID, verified email, provider card fingerprint and PayPal payer ID are eligible kinds. Provider-specific values are namespaced so coincidental strings across providers cannot match.
- `acquire_trial_enrollment` runs one transaction: insert/get the attempt, acquire claims in a deterministic sorted order, and return the existing enrollment for an identical retry. A unique violation belonging to another consumed enrollment denies the free trial; a claim owned by a still-pending attempt returns a recoverable pending/conflict result, not a permanent trial-use decision.
- `finalize_trial_enrollment` locks that enrollment, verifies its expected operation revision, attaches newly available verified payment-method identity claims in the same transaction and records immutable provider trial dates only if every claim is owned. Retries return the same result. Browser return, verified webhook and reconciliation all call this entry point after fetching provider state.
- A pending claim is released only after the associated provider attempt is verified non-collectible/abandoned; expiry of a local lease alone cannot release a claim while an old agreement could still charge. Successfully activated claims remain consumed under the existing account-data retention contract. Account deletion/privacy handling must be verified before migration approval; do not silently add permanent retention after deletion.
- No database lock is held across a network call. Provider mutations use an operation ledger, then a compare-and-set transition on the enrollment revision. A crash leaves a durable `reconciliation_required` state. The existing reactivation reservation unique-index and transaction pattern is reusable precedent, not a reason to share reservations across unrelated commerce types.

Proof: concurrent same-account and shared-payment-method enrollments; different callbacks on the same attempt; changed-input retry; claim acquired only after provider authorization; provider creation succeeds but response is lost; neutralization fails; local lease expires while provider remains collectible. A failed attempt must not consume lifetime eligibility, and its replacement must not leave duplicate billing.

## Concrete provider operation contract

Persist `(enrollment_id, action, revision)` as a unique operation key with provider reference, request fingerprint, state, result and last verified provider status. Suggested stable key: `trial:{enrollmentId}:{action}:{revision}`; the identical logical operation always uses the identical key and payload. For provider endpoints without idempotency-header support, serialize via the ledger and reconcile state before retrying; do not assume arbitrary headers provide idempotency.

- Stripe losing trial agreement: retrieve subscription and latest invoice/payment state; cancel via `stripe.subscriptions.cancel` with no proration or final usage charge. If a finalized open invoice exists, use `stripe.invoices.voidInvoice` only after confirming it was not paid and has no unresolved successful/processing collection. Paid state diverts to reconciliation; do not drop that payment or start another charge. Retrieve again to prove terminal/non-collectible state. Match SDK/API-version options during implementation.
- PayPal losing trial agreement: use existing `cancelPayPalSubscription` (`POST /v1/billing/subscriptions/{id}/cancel`), then retrieve authoritative subscription and transaction state. Confirm cancellation and no unresolved collection before enabling replacement payment. Do not assume `CANCELLED` means a sale already in flight cannot settle; unresolved sale state stays in reconciliation.
- PayPal restoration is different from switching: restoration's old agreement is already canceled. Create a replacement without another free cycle, using the original trial-end timestamp as the candidate future start and requiring renewed payer approval. Approval abandonment leaves cancellation intact.
- PayPal interval switching requires an overlap-safe handover and proof that abandonment keeps the currently accepted agreement effective. Neither cancellation-before-approval nor two independently collectible agreements satisfies that promise. Validate supported revision first; use replacement only if its concrete staged activation/neutralization ordering is proven. Do not implement an invented atomic swap across provider calls.
- First-payment recovery cannot equate subscription creation time with payment-success time. Verify both first-payment occurrence and the provider's next renewal boundary. If authentication completes later, period and next charge must still match the full month/year from success. Any necessary calendar adjustment must prevent duplicate/prorated extra collection and is a provider-proof gate.

## Provider-validation contract and remaining external boundary

**No-charge preparation now:** static request/response fixtures and state-machine tests; official API/version compatibility; read-only live catalog and webhook/config checks; draft request review; any provider-supported invoice previews that do not create subscriptions, collect payments or change customer data. These prove construction and expected totals only. Keep isolated fixtures separate from real provider receipts.

**Actual provider proof still needed:** mandatory card/PayPal authorization, cancellation reversal/abandonment, trial interval-change deadline, first annual EUR 69.99 and next EUR 99.99 schedule, confirmed failed-first-charge recovery and exact new paid-period boundary, and no duplicate collectible agreement. A full annual elapsed renewal cannot be observed quickly in live mode; document the narrower proof from supported previews/schedules rather than pretend a year elapsed. Local synthetic events do not prove provider execution.

**Before asking for live-test permission:** produce a concrete run sheet specifying merchant environment and QA account, exact provider resources to create, maximum charge/exposure, owner of the payment method, expected cancellation/refund behavior and fees, cleanup, and which assertions remain unproven. No payment details in chat. Nick's earlier live coupon authorization does not cover this run sheet. Do not offer “accept untested launch” as the default workaround.

**Current remaining gap:** payment-authorization and time-dependent execution cannot be fully verified from live catalog data alone. Sandbox creation remains forbidden and no live transaction run sheet is authorized. This does not justify reopening pricing or PayPal scope; it constrains when provider-dependent tasks can be marked verified.

## Historical next planning work after revision 0.41

Complete the minimal downstream visual evidence in the current product layout and the scoped provider run sheet. Consolidate historical decision narration into the archived record so the final chosen plan has one current coverage table. Revalidate the implementation contracts after provider proof; run another counterpart pass only when substantive changes or resolved findings justify it. Final complete journey sign-off remains pending.

## Revision 0.46 research reconciliation — 13 September 2026

- Stripe flexible billing documentation explicitly preserves the anchor on interval changes. Rejected the classic-mode blanket warning and unnecessary schedule recommendation; use a narrow trial-specific direct update with unchanged anchor/no proration, guarded by provider invoice/date acceptance. Existing paid discounted-plan guards stay.
- Stripe's zero-invoice coupon changelog supports the simpler once-coupon construction. Corrected the earlier unresolved textual contradiction, while keeping actual first/renewal invoice verification separate.
- PayPal's initial free-cycle clock is not proven to start at authorization. Added a first technical proof, with a documented future-start/PATCH candidate only if consent, timestamp and billing facts agree. Neither app-only extension nor cancellation-before-approval is an accepted fallback.
- Corrected Mastercard notice interpretation: current Stripe guidance scopes the 7–30-day advance-renewal event to billing periods longer than 180 days. The annual plan is relevant; monthly is not required by that rule. Exactly-seven-day Visa timing remains a provider proof item, not solved by delaying app access.
- Corrected cancellation semantics: receipt of a durably stored declaration is acknowledged independently of provider completion. A provider timeout is reconciliation-pending; only failure to save the declaration requests another submission. Public submission must avoid login gating, account enumeration and unverified third-party mutation.
- Added the legally required public cancellation/withdrawal paths as bounded contract-management work. Withdrawal classification and minimal identity retention require existing or external legal/privacy facts; this does not reopen pricing or authorize a new refund/retention policy.
- Replaced unapproved generic lifecycle evidence with `mockups/journey-review.html` and its production-grounded states. Review of the new screens remains pending.
- The prior prospective-rollback proposal is now individually confirmed by Nick; earlier review wording above is historical.

A new read-only counterpart pass is justified by these material changes. Its verdict and locally verified dispositions will be appended here; raw review output remains outside the repository.

## Counterpart verdict and final local corrections — revision 0.47

Claude Opus 4.8, high, read-only/terminal, completed review of revision 0.46. Verdict: approve with revisions as a planning artifact; no implementation handoff. Raw output `/tmp/free-trial-plan-v046-review.md` remains transient until final handoff.

| Finding / recommendation | Verified disposition |
| --- | --- |
| Personal Plan offer path ambiguous/wrongly grouped with quiz | Verified real path `src/components/personal-plan-offer/personal-plan-offer.tsx`; made the T5 path fully explicit. |
| Access coverage missed `hasCurrentAppAccess` and composite navigation | Verified entry routes and `src/lib/entitlements/access.ts:104`, `navigation-access.ts:14,145,165`. Expanded T1/T3 to both access functions, composite and navigation consumers; added exact legacy grace location. |
| Trial-versus-freemium product choice | Rejected as a new interview question: Nick already chose current full paid access and deferred refinement locks. Made this explicit for five-tab navigation, existing premium Merkliste/previews/refinements and usage/provisioning limits; no freemium upsell during trial or free-preview fallback after strict expiry. Freemium activation remains out of scope. |
| Coverage format | Accepted. Added named four-bucket coverage, disposition/affected-work rows and truthful acknowledgement status. No blanket approval inferred. |
| Ask again whether required legal paths belong in scope | Not reopened. Nick explicitly selected required-only work. Include the researched minimum needed for the subscription launch; no unrelated terms rewrite or optional retention campaign. Any new refund/retention policy remains an explicit decision. |
| Ask for test-charge approval now | Not adopted. Nick specifically deferred the old proposal. T0 separates documentation from provider evidence; bring a concrete transaction request only when implementation verification needs it. No “accept untested launch” choice is offered. |
| Stripe-only alternative | Not adopted; both providers remain the approved scope. |

Later primary-source verification found Visa’s 20 February 2020 clarification explicitly covers trials of **seven days or less** in the initial confirmation. Removed the false exact-seven-day timing blocker based on the older source; descriptor/content/delivery still require verification.

Later legal research exposed O4: annual billing price does not imply another fixed-year automatic commitment under §309 no.9. Asked Nick to choose the proposed year-two settlement approach; do not silently extend an anniversary-only cancellation policy. Added §312j binding-action wording as an explicit hosted-checkout acceptance check.

Late targeted recovery research produced documented candidate sequences in `recovery-provider-candidates.md`. They are not real provider proof and were not in the revision 0.46 review verdict. Their adapter design needs revalidation after T0 and O4; do not repeat a counterpart pass now merely to obtain a cleaner verdict while the consequential question is pending.

## Revision 0.48 — O4 decision receipt

13 September 2026: Nick says “these decisions are so far away … let’s go with your recommendation for now.” Record continued 99.99 annual billing, at-most-one-month termination notice after the first term and proportional refund of unused prepaid time after effective termination. Detailed year-two implementation/UI is explicitly deferred, with a completion checkpoint before the first affected renewal. Initial terms must reflect the selected policy and legal validation remains. This closes O4 as a product decision; it does not constitute blanket plan/journey approval or permission to change existing customers’ agreed terms. No new counterpart pass is needed merely to record this acknowledgement; the later delivery will receive its own bounded review.

## Revision 0.49 — adversarial existing-contract review

At Nick’s request, inspected current live AGB/privacy/withdrawal text, recurring-checkout code and deletion/cancellation seams. Claude Opus 4.8 (high) performed one read-only terminal counterpart pass against revision 0.48; output `/tmp/free-trial-existing-terms-adversarial-review.md` stays transient until final handoff. Full retained findings: `existing-terms-adversarial-review.md`.

- **Accepted F1:** the plan needed explicit ownership of legal-page edits. T4 now names AGB/privacy/withdrawal, with the agreed trial and O4 terms before launch; deferred year-two automation stays deferred.
- **Accepted F2 with narrowed claim:** the trial disclosure must reach every composed binding surface, not only the offer. T5 now names `payment-method-checkout.tsx` and the invoked overlay/hosted steps. Rejected the absolute claim that a withdrawal line is the only company-authored disclosure: the component also receives plan labels and has surrounding parents not disproven by that excerpt. Current hard-paywall copy lacking future trial terms is an implementation task, not evidence that an unlaunched trial has already violated a contract.
- **F3 consequence accepted; waiver recommendation rejected:** current published membership terms/Stripe disclosure preserve the 14-day right. Keep that baseline and honor valid withdrawal after the day-seven charge. Do not generalize the one-time purchase-context row into waiver evidence or invent a digital-content waiver for the ongoing service. Primary-source verification by the main agent distinguishes §356(4)/(5), §357a and the Sofatutor ruling; §356a is an online withdrawal-function rule, not itself a waiver rule. A legal classification permitting a waiver is not a prerequisite to preserving the existing right.
- **Accepted F4:** no established post-deletion retention period/criteria exists for the proposed identity claims. HMAC is not anonymization. Record the remaining necessity/retention decision instead of repeatedly asking whether a lawyer exists. Do not assert that erasure is unconditional or that email-only support violates GDPR.
- **Accepted F5 as implementation coverage:** current local controls do not establish public declaration storage and durable receipt delivery. Keep the reviewed cancellation flow; implement its backing contract. Correct the legal attribution: cancellation §312k, withdrawal §356a. Presence of a mailto link does not prove external support performance, and absence of an app email call does not prove a provider never sends a receipt; delivery remains to be verified.
- The counterpart did not independently fetch current statutory text and is not legal certification. The main agent verified primary law/CJEU/GDPR sources and rejected the unsupported blanket conclusions above. Its out-of-scope VAT observation does not change the existing tax dependency.

Nick’s message also accepts the reviewed initial flow, explicitly cancellation. Preserve that acknowledgement. The review does not reopen that UI or authorize new product behavior; post-deletion retention and provider proof still prevent a complete implementation-ready claim. No new app code, policy publication, email, charge, refund or deletion occurred.


## Revision 0.50 — explicit decision follow-up, 13 September 2026

Nick explicitly confirms a retained trial-use list to deny later repeat trials, including the account-deletion scenario just discussed. Earlier entries saying post-deletion retention lacks product approval are historical and superseded. The rule is settled; necessity, lawful retention criteria and erasure/objection handling still need evidence. Do not label HMAC anonymous or claim one-ever is enforceable for an unrecognized identity.

Inclusive final prices are reaffirmed, with Codex owning Stripe/PayPal configuration and tax-treatment verification. Documentation confirms support; no live settings or actual VAT obligations were verified in this pass. See [implementation contract and sources](trial-history-and-inclusive-tax.md). Existing UI approval is unchanged. This records user decisions and updates dependent tasks; it is not a fresh counterpart verdict or production mutation.
