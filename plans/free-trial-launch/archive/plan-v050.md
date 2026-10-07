# Seven-day trial launch

Revision 0.50 — persistent trial-use record and inclusive pricing reaffirmed, 13 September 2026.
Worktree: `.worktrees/free-trial-launch`; branch: `codex/free-trial-launch`.
Product decisions: **confirmed, including persistent trial-use history and inclusive pricing**. Technical/privacy validation and complete decision coverage: **pending the named evidence checks**. Reviewed initial customer flow: **accepted by Nick on 13 September**, with cancellation explicitly confirmed. Complete implementation handoff: **pending**, without reopening unchanged reviewed screens. Provider execution: **not yet verified**. This plan is not a production activation approval.

## Outcome

Replace the existing new-customer payment modules on `/result/[leadId]` and `/reactivate` with an authorization-required seven-day trial, followed by monthly or annual membership. Reuse account activation, quiz linking, plan provisioning and continuation. Keep the approved mobile offer and scanner image.

Done when the chosen implementation contracts are concrete, provider-dependent behavior has a viable verified mechanism, all meaningful downstream states are reviewable, independent findings are reconciled, and Nick confirms the complete customer journey. Do not confuse final plan readiness, code verification and production activation.

## Decision coverage

Status: **product choices confirmed; technical/privacy evidence checks pending**.

### Confirmed with Nick

These are Nick's decisions from 11–12 September 2026; consolidation does not change their original acknowledgement dates. Full original wording and superseded discussion remain in [archive/plan-v041.md](archive/plan-v041.md) and [archive/interview-v036.md](archive/interview-v036.md).

| Area | Chosen behavior |
| --- | --- |
| Trial | Seven days on monthly and annual. Card through Stripe or PayPal recurring authorization required. Start from verified provider authorization/activation, never a redirect alone. |
| Monthly | EUR 9.99 after trial; no additional launch discount. |
| Annual | EUR 69.99 for the first paid year while the launch offer is available, then EUR 99.99/year. Automatic offer application; no coupon field or stacking. No deadline, cutoff or countdown. |
| O4 — after the first annual term | Confirmed 13 September: keep EUR 99.99 annual billing; indefinite continuation with cancellation on at most one month’s notice, refund unused prepaid time after effective termination. Legal validation remains. Nick allows later implementation before the first affected renewal; no fresh annual-purchase requirement. |
| Price display | Confirmed again 13 September: EUR 9.99 monthly, EUR 69.99 first paid annual year and EUR 99.99 renewal are final customer prices on Stripe and PayPal, including any applicable tax. Never add tax on top. Codex owns checking provider settings and applicable treatment; no rate or registration status is invented. |
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
| Provider verification | Live configuration requested; no sandbox resources. Live coupon creation is authorized and complete. Live transaction testing is separately proposed and remains unapproved. |

Original rollback acknowledgement, 13 September 2026: Nick says “we will only change it going forward” and that existing customers “keep their trial” and “the agreed price will not change for them during their trial.” Preserve the already agreed introductory-to-renewal progression; this is no new perpetual founding-price promise.

### Inherited from evidence or contract

Keep existing profile/plan retention, paid-period terms and refund policy. Required cancellation/withdrawal submission and receipt paths need the bounded compliance work below; do not assume current UI satisfies it. Add no feedback gate, retention promotion or invented deletion/export policy. Preserve existing one-time/manual/test access guards. The saved-context promise is in `src/components/reactivation/membership-reactivation-page.tsx:48`; its personal `<OfferPreviewRoutine>` at line 172 must not expose product content to a locked new-trial customer.

### Implementation defaults

UTC instants and explicit offer/cohort snapshots; idempotent provider operations; database uniqueness and transactional eligibility claims; verified provider truth; no raw payment identities in clients or analytics. Detailed mechanisms are in [review-resolution.md](review-resolution.md). Implement the explicitly confirmed minimal trial-use list across account deletion; no routine expiry resets eligibility. Document necessity, lawful retention criteria, access controls, privacy disclosure and erasure/objection handling before the dependent data lifecycle ships. HMAC identifiers remain personal data; the business rule does not itself prove unrestricted permanent storage is lawful.

### Open consequential assumptions

| Item | Disposition | Affected work |
| --- | --- | --- |
| O4 — year-two settlement implementation | **Parked out of initial launch implementation with Nick’s explicit acknowledgement, 13 September.** The annual-billing/refund approach above is confirmed. Deliver and verify its cancellation, settlement and UI before the earliest affected year-two renewal. Launch terms must already state the agreed continuation/cancellation policy accurately; legal validation is not waived. | Deferred year-two automation/UI, with a required pre-renewal release checkpoint; initial launch consent remains in scope. |
| Trial-use list validation | **Product policy confirmed 13 September:** retain a minimal used-trial list, including after account deletion, and deny repeat trials whenever the same approved strong identity is recognized later. No arbitrary expiry or renewed eligibility by account recreation. Codex must validate and document necessity, lawful retention criteria and erasure/objection handling before the dependent migration/data lifecycle ships. Bring back only a concrete conflict, not another generic retention-period interview. | T1 identity claims, privacy disclosure and support deletion procedure. |
| Provider mechanism proof | **Resolve before handoff** of dependent provider adapters through T0. Written docs and candidate requests are not merchant execution proof. Failed proof returns only the specific incompatibility to Nick. | T2/T4 clocks, changes and recovery. |
| Provider tax verification | Inclusive final prices are confirmed. **Codex owns verification before production activation:** inspect actual merchant facts, applicable tax treatment and both provider settings. Documentation confirms inclusive-price support; this is not proof of current live configuration or tax obligations. Preserve the cofounder backlog for any business/tax facts unavailable from the account. | T7 activation/provider tax configuration. |
| Reviewed flow and any resulting corrections | Nick reviewed `journey-review.html` and accepted the flow, explicitly the cancellation. Preserve that acknowledgement; do not ask again for unchanged screens. **Resolve before handoff** only a substantive customer-facing change not covered by that review. Deferred year-two states belong to their later delivery. | Any changed customer-facing contract after this review; complete handoff still depends on the explicit retention/provider items. |
| Refinement locks; new freemium; deadline/cutoff; existing-customer migration | **Parked out of scope**, explicitly decided by Nick during the interview. | No work in this launch. |

**Coverage acknowledgement:** Nick confirmed individual commercial/flow decisions on 11–13 September and asked to finalize/research this plan on 13 September. Nick saw revision 0.47 and confirmed O4 in the next message: “these decisions are so far away … let’s go with your recommendation for now.” Revision 0.48 records that choice and the authorized deferral. In his next message Nick requested our adversarial policy review and said “the flow, I checked. That looks okay if you quit it like this.” Record visual/flow acceptance, explicitly cancellation. That earlier acknowledgement did not settle post-deletion history. Nick subsequently explicitly confirmed keeping a list so the same user is blocked from another trial even much later, and assigned the provider tax checks to Codex while reaffirming inclusive prices. This settles the business rule; it does not certify legal compliance or authorize unrelated production changes. Internal research and review corrections are not new product approval.

Undiscussed consequential assumptions affecting this handoff: none currently identified in the product choices. Provider mechanism proof, lawful operation of the retained trial-use list and actual tax configuration remain explicit evidence dependencies for their affected work. O4 behavior is confirmed and its later implementation explicitly deferred. Do not call the complete handoff verified while these checks are open.

### Remaining coverage and evidence

| Item | Status and next action |
| --- | --- |
| Commercial decisions, O1–O4 and prospective rollback | Confirmed individually. O4’s later implementation is explicitly deferred. No new price, duration, reminder-marketing or migration question. |
| Provider mechanisms | Primary-source research complete in [Stripe](stripe-final-research.md) and [PayPal](paypal-final-research.md). T0 tests the exact authorization clock, trial switches and delayed-payment billing dates before dependent implementation. Documented support is not merchant execution proof. |
| Required notices and legal/privacy facts | [Research](notices-privacy-final-research.md) and [acceptance gates](verification-gates.md) distinguish required notices from optional campaigns. The [adversarial review](existing-terms-adversarial-review.md) establishes the inherited 14-day withdrawal baseline from the current service terms and Stripe disclosure. Keep it; no digital-content waiver or usage deduction is added. Actual tax configuration, privacy validation of the confirmed retained trial-use list and legal validation of the selected year-two policy remain explicit checks. Visa’s later clarification supports the required initial confirmation for trials of seven days or less. Nick has asked us to perform the review ourselves; that is completed in the linked report. Do not substitute a generic counsel-availability question for a concrete remaining fact. |
| Downstream design | [One review page](mockups/journey-review.html) contains cancellation, restoration, interval-change, recovery and required legal submission states. Profile styling uses inspected production CSS/fonts. Earlier `lifecycle-states.html` is superseded. Nick has now reviewed and accepted this flow, with cancellation explicitly confirmed. The scanner offer remains approved; genuinely changed states need only their own review. |
| Complete record / journey | Reviewed flow acceptance recorded. Overall handoff stays pending for provider proof and data-policy validation; original individual and visual approvals remain intact. |
| Provider transaction verification | Deferred until needed in implementation. No test charge or payment-method authorization has been approved. The historical run sheet is not a prerequisite to finishing this written plan and is not a current permission request. |

Annual price and year-two termination/settlement approach are confirmed; its detailed implementation is deferred as above. The build order and pass/fail gates are concrete; this is not a claim that the unresolved provider behavior or legal facts have been verified. A failed T0 proof blocks its dependent adapter and brings back only the specific resulting product choice. It does not silently shorten trials, shift agreed charge dates, remove PayPal, or change renewal terms.

## Current provider resources

Verified live on 12 September 2026, not rechecked as of this consolidation:

- Stripe merchant `acct_1TH0lOGiGHTGZcKB`, product `prod_UMfRHJ3yh8l0bV`.
- Full annual EUR 99.99 inclusive price `price_1TNw7QGiGHTGZcKBv8jPk1MJ`.
- Separate legacy launch annual EUR 69.99 price `price_1TzMm3GiGHTGZcKBP1McmRA9` repeats indefinitely. Do not use it as though it automatically increases after year one.
- Newly authorized live EUR 30 once coupon `8KSV9CZz`, product-restricted, no expiry or public promotion code. Its product includes monthly prices, so annual-only eligibility is enforced server-side. It is not yet wired into a trial checkout. The existing 50% beta coupon was preserved.
- PayPal product `PROD-1DJ37758SY227805K`; draft `P-2XJ97149EE510364NNKSAIRA` has a free seven-day trial then EUR 99.99/year, lacking the EUR 69.99 introductory phase. Do not activate it as the final offer.
- Nick reports no VAT registration. Backlog: `/Users/nick/Documents/Codex/2026-09-11/trial-billing-backlog.md`.

## Implementation and verification

The dependency-ordered implementation contract is [implementation-sequence.md](implementation-sequence.md), supplemented by the concrete transaction/provider contracts in [review-resolution.md](review-resolution.md):

0. T0: prove the provider clock/change/recovery mechanisms and resolve required contract/data facts in [verification-gates.md](verification-gates.md).
1. T1: cohort, atomic eligibility and access policy.
2. T2: provider checkout and correct trial/introductory schedule.
3. T3: activation, events, account continuation and product/API guards.
4. T4: durable cancellation/withdrawal declarations, provider reconciliation, interval changes and payment recovery.
5. T5: approved offer and minimal membership/recovery UI; one-time/waitlist retirement.
6. T6: required communications and truthful typed analytics.
7. T7: cohort flag, provider/migration checks, rollout and rollback receipt.

Named file seams, Consumes/Produces contracts, local/provider/browser tests and stop conditions live with each task. Use Node 22. Recheck current base and sibling integration before product edits. Generate migrations using current repository tooling and verify version uniqueness; do not create placeholder migrations or change production schema while planning.

Preserve legacy and flag-off behavior. Test trial expiry without the legacy 24-hour grace, duplicate/out-of-order callbacks, competing identities, first-payment processing/failure/success, failed handover and stale old agreement collection. Local fixtures and invoice previews are not real payment execution evidence.

## Reviewed design and proposed final journey

Approved: `mockups/cal-ai.html`, `mockups/mobile.html`, `mockups/scanner-hero.webp`, `mockups/cal-ai-mobile-scanner.png`. Nick approved the mobile hierarchy and then specifically locked the previous scanner image on 12 September 2026. The current canonical-design README supersedes older comparison notes.

Proposed downstream evidence: [journey-review.html](mockups/journey-review.html), 18 static states, plus [membership-trial.html](mockups/membership-trial.html). These preserve the reviewed profile design and use the existing reactivation source for locked recovery. Provider-hosted screens are not fabricated; buttons inside customer frames are inert. See [visual evidence](mockups/journey-review-evidence.md) for checks and limits.

The public cancellation and withdrawal forms are required contract-management paths, not new paywalls. A cancellation declaration is acknowledged when durably received; a slow provider response cannot invalidate it. Provider reconciliation is separate, with retries and late-charge handling. See the exact acceptance contract in [verification-gates.md](verification-gates.md).

Reviewed initial journey, accepted by Nick on 13 September (cancellation explicitly confirmed):

1. Existing result/reactivation entry → approved trial offer → monthly/annual selection → accurate selected terms → card/PayPal authorization.
2. Verified eligible authorization → existing account/quiz/plan continuation. Declined or abandoned authorization gives no access or consumed trial; repeat callbacks do not duplicate enrollment.
3. Current paid-product features during trial. Cancel in one confirmation, receive a durable receipt and keep access through the original deadline. Restore or switch with unchanged deadline and any required PayPal approval; show actual pending/abandoned outcomes. Provider delays do not require the customer to cancel again.
4. At original expiry, require successful first payment for product access. Failure/processing keeps recovery reachable without showing product content. Successful recovery starts a full month/year and matching next renewal date.
5. Returning used-trial customers expressly choose immediate paid signup; prior discounted-year eligibility is preserved. Existing subscribers keep their terms. Later renewal failures use seven-day grace.
6. Public cancellation remains reachable without login. A separate withdrawal function records receipt and follows the inherited statutory 14-day withdrawal/refund baseline. The free trial ends after seven days; it does not erase a still-open withdrawal right. Required confirmations/receipts are transactional; no optional reminder campaign.
7. If new enrollment is disabled, existing accepted trial terms, cancellation and recovery continue. Production activation remains separately controlled.

## Review and artifact disposition

Claude Opus 4.8 (high), read-only and terminal, reviewed revision 0.40. Verdict: acceptable planning artifact, not implementation handoff. Findings verified and reconciled into 0.41; 0.42 consolidates without reopening accepted decisions. See [review-resolution.md](review-resolution.md). Claude Opus 4.8 (high) reviewed revision 0.46: approve with revisions as a planning artifact, not implementation-ready. Revision 0.47 fixes the verified file-path, access-composition and coverage-format findings. Later primary-source verification corrects the Visa timing false blocker and exposes O4; these later findings were not claimed as approved by that review. See the ledger for accepted and rejected recommendations.

Retain this plan, implementation sequence, verification gates, final research notes, review-resolution ledger, entry coverage, interval research and canonical visual evidence with the eventual PR. Keep the historical live run sheet explicitly deferred. Archive historical plans and noncanonical comparisons; keep existing preview links intact until packaging. Lifecycle frames are durable evidence reviewed by Nick for the initial flow; later substantive revisions retain separate review status. Raw counterpart output remains outside the repository and is discarded after final handoff.

No application code or migration has changed in this task. No sandbox resource, live test charge, optional email, trial activation or deployment has been performed. The separately authorized live coupon creation is the sole recorded live configuration mutation.

## Existing-contract review disposition

See [existing-terms-adversarial-review.md](existing-terms-adversarial-review.md). Add the new-cohort trial/renewal wording to the existing legal pages, preserve the existing 14-day withdrawal promise and ordinary-cancellation distinction, deliver the required public declarations/receipts, and document support-operated deletion. Do not add a self-service deletion feature or a withdrawal waiver as an inferred requirement. Post-deletion trial-use history is now explicitly confirmed by Nick; validate its lawful retention criteria and disclosure, without borrowing invoice retention or inventing an automatic new-trial entitlement. These corrections are planning work, not edits to the live legal pages.

## Findings walkthrough — item 1: terms

13 September 2026: Nick requests walking through the findings one by one. Item 1 in the user-facing findings list is the terms update (finding 2 in the detailed adversarial report). Its product scope is already defined by confirmed decisions; no new commercial approval is inferred or required.

At initial launch, T4 updates the new-cohort terms to state: seven days from verified authorization; monthly 9.99 or annual 69.99 for the first paid year then 99.99; cancellation during trial prevents the first charge and preserves access to the original trial end; the confirmed post-initial-term annual continuation/cancellation/refund policy. T5 and T6 use the same accepted terms in checkout and confirmation. Preserve existing customers’ agreed pricing/benefits and distinguish historical offers. Detailed year-two automation remains deferred until before the first affected renewal.

Nick explicitly confirmed inclusion in the plan: “ok do include that in the plan”. The terms update is part of initial launch scope; detailed year-two automation remains deferred until before the first affected renewal.

Status: **confirmed for implementation; not yet implemented or published**. Statutory withdrawal is the next finding in the walkthrough and is not conflated with ordinary cancellation.


## Latest confirmation — trial-use list and final prices

13 September 2026: Nick says to keep a list because there is only one trial per user, and to block another trial even if attempted much later. He explicitly identifies this as the existing agreed policy. Account deletion must not automatically erase the independent eligibility claim or reset the trial. This is not a new request for a retained customer profile or a blanket claim that a natural person can always be recognized across unrelated payment providers or changed identifiers.

Nick also assigns Stripe/PayPal tax verification to Codex and reaffirms that tax belongs inside the price. Implementation/configuration evidence and limitations are in [trial-history-and-inclusive-tax.md](trial-history-and-inclusive-tax.md). No additional commercial choice is requested. Provider proof, privacy validation and actual applicable tax facts remain checks, not evidence already obtained.
