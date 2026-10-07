# Seven-day trial launch

Revision 0.45 — profile membership hierarchy simplified after feedback, 13 September 2026.
Worktree: `.worktrees/free-trial-launch`; branch: `codex/free-trial-launch`.
Decision coverage: **pending final complete-record acknowledgement**. Final designed journey: **pending**. Provider execution: **not yet verified**. This plan is not a production activation approval.

## Outcome

Replace the existing new-customer payment modules on `/result/[leadId]` and `/reactivate` with an authorization-required seven-day trial, followed by monthly or annual membership. Reuse account activation, quiz linking, plan provisioning and continuation. Keep the approved mobile offer and scanner image.

Done when the chosen implementation contracts are concrete, provider-dependent behavior has a viable verified mechanism, all meaningful downstream states are reviewable, independent findings are reconciled, and Nick confirms the complete customer journey. Do not confuse final plan readiness, code verification and production activation.

## Confirmed decisions

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

### Inherited behavior

Keep existing profile/plan retention and current cancellation/refund/withdrawal/account-management handling; add no feedback gate, retention promotion or new deletion/export policy. Preserve existing one-time/manual/test access guards. The saved-context promise is in `src/components/reactivation/membership-reactivation-page.tsx:48`; its personal `<OfferPreviewRoutine>` at line 172 must not expose product content to a locked new-trial customer.

### Implementation defaults

UTC instants and explicit offer/cohort snapshots; idempotent provider operations; database uniqueness and transactional eligibility claims; verified provider truth; no raw payment identities in clients or analytics. Detailed mechanisms are in [review-resolution.md](review-resolution.md). Do not invent permanent identifier retention after account deletion; verify compatibility with the existing privacy/deletion contract.

### Remaining coverage and evidence

| Item | Status and boundary |
| --- | --- |
| O1 first-payment recovery, O2 waitlist retirement, O3 PayPal reapproval | Individually confirmed. Do not re-interview these choices. |
| Provider schedule/recovery mechanism | Unverified. Direct trial-plus-once-coupon behavior, PayPal original-deadline preservation and delayed-success billing anchors need proof. No substitution of guessed behavior. |
| Live test scope | Proposed maximum EUR 159.96 across four owner-controlled paid cases, then cancel/refund, with possible retained fees. [Run sheet](live-verification-run-sheet.md). Not approved. Assistant withdrew this as a prerequisite to finishing the plan after Nick challenged the proposal; defer transaction-test permission until implementation verification needs it. Do not repeat now. |
| Tax and mandatory-notice coverage | External/prelaunch evidence obligations. No assumed zero rate, tax-disabled launch, omitted required notice or optional reminder added. |
| Rollback contract | Confirmed by Nick on 13 September 2026: changes apply only going forward. Existing customers keep any remaining trial and the pricing agreed at enrollment. Disabling new trials does not change existing trial dates, agreed first/renewal pricing, cancellation or recovery. |
| Downstream visual evidence | Active-trial content accepted in principle; Nick requested production fidelity. Live signed-in `/profile` inspected on desktop and at 390 × 844 on 13 September. `mockups/membership-trial.html` now uses live CSS/fonts, existing settings context and sample trial/account data; mobile and desktop renders inspected. See `mockups/profile-production-evidence.md`. Provider row removed in the proposed revision; plan name, trial badge and grouped payment terms replace the label list. Revised visual approval and other lifecycle states remain pending. |
| Full journey / complete-record acknowledgement | Pending final post-review walkthrough. Original individual decisions stay confirmed; no blanket approval inferred. |

Undiscussed consequential assumptions affecting this handoff: provider-specific execution mechanisms and proof limits, privacy/deletion compatibility where current rules do not determine it, remain explicitly open as above; the prospective-only rollback contract is now confirmed. No additional commercial fork is introduced by this revision.

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

1. T1: cohort, atomic eligibility and access policy.
2. T2: provider checkout and correct trial/introductory schedule.
3. T3: activation, events, account continuation and product/API guards.
4. T4: cancellation, interval changes and first-payment/later-renewal recovery.
5. T5: approved offer and minimal membership/recovery UI; one-time/waitlist retirement.
6. T6: required communications and truthful typed analytics.
7. T7: cohort flag, provider/migration checks, rollout and rollback receipt.

Named file seams, Consumes/Produces contracts, local/provider/browser tests and stop conditions live with each task. Use Node 22. Recheck current base and sibling integration before product edits. Generate migrations using current repository tooling and verify version uniqueness; do not create placeholder migrations or change production schema while planning.

Preserve legacy and flag-off behavior. Test trial expiry without the legacy 24-hour grace, duplicate/out-of-order callbacks, competing identities, first-payment processing/failure/success, failed handover and stale old agreement collection. Local fixtures and invoice previews are not real payment execution evidence.

## Reviewed design and proposed final journey

Approved: `mockups/cal-ai.html`, `mockups/mobile.html`, `mockups/scanner-hero.webp`, `mockups/cal-ai-mobile-scanner.png`. Nick approved the mobile hierarchy and then specifically locked the previous scanner image on 12 September 2026. The current canonical-design README supersedes older comparison notes.

Proposed downstream evidence: [lifecycle-states.html](mockups/lifecycle-states.html). It recreates the current profile membership card and reactivation layout from source and shows current-reference, trial-active, canceled, PayPal restoration-abandoned, first-payment-failed, paid-recovery, processing and trial-plan-change frames. Static buttons do nothing. No provider-hosted PayPal screen is fabricated.

Final walkthrough, still to confirm after evidence review:

1. Existing result/reactivation entry → approved trial offer → monthly/annual selection → accurate selected terms → card/PayPal authorization.
2. Verified eligible authorization → existing account/quiz/plan continuation. Declined or abandoned authorization gives no access or consumed trial; repeat callbacks do not duplicate enrollment.
3. Current paid-product features during trial. Cancel while retaining access to the original deadline. Restore or switch with unchanged deadline and any required PayPal approval; show actual pending/abandoned outcomes.
4. At original expiry, require successful first payment for product access. Failure/processing keeps recovery reachable without showing product content. Successful recovery starts a full month/year and matching next renewal date.
5. Returning used-trial customers expressly choose immediate paid signup; prior discounted-year eligibility is preserved. Existing subscribers keep their terms. Later renewal failures use seven-day grace.
6. If new enrollment is disabled, existing accepted trial terms, cancellation and recovery continue. Production activation remains separately controlled.

## Review and artifact disposition

Claude Opus 4.8 (high), read-only and terminal, reviewed revision 0.40. Verdict: acceptable planning artifact, not implementation handoff. Findings verified and reconciled into 0.41; 0.42 consolidates without reopening accepted decisions. See [review-resolution.md](review-resolution.md). Another review is justified after substantive provider/mechanism or evidence changes, not solely to obtain a cleaner verdict.

Commit this plan, implementation sequence, review-resolution ledger, entry coverage, interval research, live run sheet and canonical reviewed visual evidence. Archive historical plans and noncanonical comparisons; keep existing preview links intact until packaging. Lifecycle frames are proposed durable evidence, pending review. Raw counterpart output remains outside the repository and is discarded after final handoff.

No application code or migration has changed in this task. No sandbox resource, live test charge, optional email, trial activation or deployment has been performed. The separately authorized live coupon creation is the sole recorded live configuration mutation.
