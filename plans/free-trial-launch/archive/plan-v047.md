# Seven-day trial launch

Revision 0.47 — counterpart findings reconciled; annual-renewal decision exposed, 13 September 2026.
Worktree: `.worktrees/free-trial-launch`; branch: `codex/free-trial-launch`.
Decision coverage: **pending final complete-record acknowledgement**. Final designed journey: **pending**. Provider execution: **not yet verified**. This plan is not a production activation approval.

## Outcome

Replace the existing new-customer payment modules on `/result/[leadId]` and `/reactivate` with an authorization-required seven-day trial, followed by monthly or annual membership. Reuse account activation, quiz linking, plan provisioning and continuation. Keep the approved mobile offer and scanner image.

Done when the chosen implementation contracts are concrete, provider-dependent behavior has a viable verified mechanism, all meaningful downstream states are reviewable, independent findings are reconciled, and Nick confirms the complete customer journey. Do not confuse final plan readiness, code verification and production activation.

## Decision coverage

Status: **pending**.

### Confirmed with Nick

These are Nick's decisions from 11–12 September 2026; consolidation does not change their original acknowledgement dates. Full original wording and superseded discussion remain in [archive/plan-v041.md](archive/plan-v041.md) and [archive/interview-v036.md](archive/interview-v036.md).

| Area | Chosen behavior |
| --- | --- |
| Trial | Seven days on monthly and annual. Card through Stripe or PayPal recurring authorization required. Start from verified provider authorization/activation, never a redirect alone. |
| Monthly | EUR 9.99 after trial; no additional launch discount. |
| Annual | EUR 69.99 for the first paid year while the launch offer is available, then EUR 99.99/year. Automatic offer application; no coupon field or stacking. No deadline, cutoff or countdown. |
| Price display | Final customer prices including any applicable VAT. No VAT rate has been assumed; tax treatment remains an external launch dependency. |
| Offer UX | Approved Cal AI-inspired mobile hierarchy and existing scanner photo. Annual preselected, monthly alternative, compact renewal terms and monthly-equivalent comparison. No explanatory timeline. |
| Entry scope | Replace existing modules only on result and eligible reactivation pages. `/pricing` remains a router. No new homepage, quiz, email or protected-product paywalls. |
| Retirements | No new one-time Personal Plan purchases; preserve historic fulfillment/recovery. Sunset new waitlist signup; preserve existing records and historic promises. No outreach project. |
| Existing customers | Preserve existing terms and access, including quarterly subscriptions. No migration. Freemium stays parked. |
| Trial access | Current paid-product features and usage limits. Refinement locks deferred. |
| Eligibility | One trial per customer. Prior activated trial or paid subscription denies another trial. Match account, verified email, reliable Stripe card fingerprint or PayPal payer ID, including shared-method cases. Weak name/address/IP/device signals alone do not block. No invasive fingerprinting. Failed or abandoned unactivated attempts do not consume a trial. Denial offers explicitly chosen paid signup/support, never a silent charge. |
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

UTC instants and explicit offer/cohort snapshots; idempotent provider operations; database uniqueness and transactional eligibility claims; verified provider truth; no raw payment identities in clients or analytics. Detailed mechanisms are in [review-resolution.md](review-resolution.md). Do not invent permanent identifier retention after account deletion; verify compatibility with the existing privacy/deletion contract.

### Open consequential assumptions

| Item | Disposition | Affected work |
| --- | --- | --- |
| O4 — termination after the first annual term | **Resolve before handoff.** §309 no.9 generally permits automatic continuation only indefinitely with at most one month’s termination notice. Keep the agreed 99.99 annual rate; Nick has been asked whether to keep annual collection with a refund of unused prepaid time after effective termination, or require a fresh annual purchase. Neither settlement policy is approved yet. Confirm applicability and terms legally. | Year-two contract, cancellation, settlement/refund adapter and corresponding UI. |
| Withdrawal classification / minimal identity retention | **Resolve before handoff** of those dependent components. Ask whether an existing legal/privacy review provides the facts; otherwise obtain external validation. No invented withdrawal waiver, refund policy or permanent identity retention. | T1 migration/data lifecycle and T4 consent/withdrawal handling. |
| Provider mechanism proof | **Resolve before handoff** of dependent provider adapters through T0. Written docs and candidate requests are not merchant execution proof. Failed proof returns only the specific incompatibility to Nick. | T2/T4 clocks, changes and recovery. |
| VAT treatment | **Resolve before handoff** of production activation. The cofounder/tax discussion stays on the existing backlog. | T7 activation/provider tax configuration. |
| New evidence / final journey | **Resolve before handoff.** Review the downstream states and confirm the complete journey after O4 and any resulting UI correction. | All user-facing implementation. |
| Refinement locks; new freemium; deadline/cutoff; existing-customer migration | **Parked out of scope**, explicitly decided by Nick during the interview. | No work in this launch. |

**Coverage acknowledgement:** Nick confirmed individual commercial/flow decisions on 11–13 September and asked to finalize/research this plan on 13 September. Revision 0.47 and its new O4 were presented for review today; no complete-record or final-journey acknowledgement has been received. Internal research and review corrections are not user approval.

Undiscussed consequential assumptions affecting this handoff: O4, external withdrawal/retention facts and provider proof are explicitly listed above; there is no implementation handoff while they affect dependent scope.

### Remaining coverage and evidence

| Item | Status and next action |
| --- | --- |
| Commercial decisions, O1–O3 and prospective rollback | Confirmed individually. No new price, duration, reminder-marketing or migration question; the newly found year-two settlement issue is O4 above. |
| Provider mechanisms | Primary-source research complete in [Stripe](stripe-final-research.md) and [PayPal](paypal-final-research.md). T0 tests the exact authorization clock, trial switches and delayed-payment billing dates before dependent implementation. Documented support is not merchant execution proof. |
| Required notices and legal/privacy facts | [Research](notices-privacy-final-research.md) and [acceptance gates](verification-gates.md) distinguish required notices from optional campaigns. VAT treatment, withdrawal classification, lawful identity retention and the year-two cancellation/settlement model remain external or consequential facts. Visa’s later clarification supports the required initial confirmation for trials of seven days or less. Nick has been asked whether an existing legal/privacy review is available. Do not invent these answers. |
| Downstream design | [One review page](mockups/journey-review.html) contains cancellation, restoration, interval-change, recovery and required legal submission states. Profile styling uses inspected production CSS/fonts. Earlier `lifecycle-states.html` is superseded. These new states await Nick's review; the scanner offer remains approved. |
| Complete record / journey | Final explicit acknowledgement pending after concrete evidence and independent review. Original individual approvals remain intact. |
| Provider transaction verification | Deferred until needed in implementation. No test charge or payment-method authorization has been approved. The historical run sheet is not a prerequisite to finishing this written plan and is not a current permission request. |

Annual price is confirmed; year-two termination/settlement is not. The build order and pass/fail gates are concrete; this is not a claim that the unresolved provider behavior or legal facts have been verified. A failed T0 proof blocks its dependent adapter and brings back only the specific resulting product choice. It does not silently shorten trials, shift agreed charge dates, remove PayPal, or change renewal terms.

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

Final walkthrough, still to confirm after evidence review:

1. Existing result/reactivation entry → approved trial offer → monthly/annual selection → accurate selected terms → card/PayPal authorization.
2. Verified eligible authorization → existing account/quiz/plan continuation. Declined or abandoned authorization gives no access or consumed trial; repeat callbacks do not duplicate enrollment.
3. Current paid-product features during trial. Cancel in one confirmation, receive a durable receipt and keep access through the original deadline. Restore or switch with unchanged deadline and any required PayPal approval; show actual pending/abandoned outcomes. Provider delays do not require the customer to cancel again.
4. At original expiry, require successful first payment for product access. Failure/processing keeps recovery reachable without showing product content. Successful recovery starts a full month/year and matching next renewal date.
5. Returning used-trial customers expressly choose immediate paid signup; prior discounted-year eligibility is preserved. Existing subscribers keep their terms. Later renewal failures use seven-day grace.
6. Public cancellation remains reachable without login. A separate withdrawal function records receipt without falsely promising a refund outcome. Required confirmations/receipts are transactional; no optional reminder campaign.
7. If new enrollment is disabled, existing accepted trial terms, cancellation and recovery continue. Production activation remains separately controlled.

## Review and artifact disposition

Claude Opus 4.8 (high), read-only and terminal, reviewed revision 0.40. Verdict: acceptable planning artifact, not implementation handoff. Findings verified and reconciled into 0.41; 0.42 consolidates without reopening accepted decisions. See [review-resolution.md](review-resolution.md). Claude Opus 4.8 (high) reviewed revision 0.46: approve with revisions as a planning artifact, not implementation-ready. Revision 0.47 fixes the verified file-path, access-composition and coverage-format findings. Later primary-source verification corrects the Visa timing false blocker and exposes O4; these later findings were not claimed as approved by that review. See the ledger for accepted and rejected recommendations.

Retain this plan, implementation sequence, verification gates, final research notes, review-resolution ledger, entry coverage, interval research and canonical visual evidence with the eventual PR. Keep the historical live run sheet explicitly deferred. Archive historical plans and noncanonical comparisons; keep existing preview links intact until packaging. Lifecycle frames are proposed durable evidence, pending review. Raw counterpart output remains outside the repository and is discarded after final handoff.

No application code or migration has changed in this task. No sandbox resource, live test charge, optional email, trial activation or deployment has been performed. The separately authorized live coupon creation is the sole recorded live configuration mutation.
