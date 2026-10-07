# Seven-day trial launch

Revision: 0.36 — remaining work distinguishes confirmed behavior from provider verification; live-only provider setup recorded, 12 September 2026.
Decision coverage: **pending**. This is a planning draft, not an implementation-ready handoff.
Worktree: `.worktrees/free-trial-launch`; branch: `codex/free-trial-launch`; initial base: `469d41f5`.

## Outcome and source context

Replace the selected new-customer purchase journey with an authorization-required seven-day free trial, followed by the selected monthly or annual subscription. Define the complete customer lifecycle and provide an executable, reviewed implementation plan with German mockups and explicit journey sign-off.

Sources: Nick's decisions in this task on 11 September 2026; existing billing and offer code (target mapping in progress); `docs/freemium-parked.md`; the local discussion note `/Users/nick/Documents/Codex/2026-09-11/trial-billing-backlog.md`.

Done when every consequential choice affecting implementation is resolved, current surfaces have been inspected, mockups reviewed, provider feasibility established, ordered tasks and tests are concrete, counterpart findings reconciled, and Nick confirms the final designed journey.

## Chosen direction

The new customer chooses monthly or annual billing and authorizes recurring payment through card or PayPal. Both options receive seven free days. The annual option then charges EUR 69.99 for the first paid year under the launch offer and renews at EUR 99.99 per year thereafter. Monthly billing is EUR 9.99 after the trial, with no additional monthly launch discount. These amounts are final customer prices inclusive of any applicable VAT. Existing customer pricing and access are preserved.

The trial starts from verified provider authorization/activation, using authoritative provider timestamps; the exact cross-provider implementation remains to be specified. Product access should feel complete from the start. Refinement locks are a later, separate change.

### Authoritative commercial values

| Field | Value |
| --- | --- |
| Trial duration | 7 days for both monthly and annual |
| Payment authorization | Card or PayPal recurring authorization required |
| Confirmed paid intervals | Monthly and annual only for new customers; existing quarterly subscribers keep their terms |
| Monthly price | EUR 9.99/month after the trial; no additional monthly launch discount |
| First paid year during launch offer | EUR 69.99 |
| Subsequent paid years | EUR 99.99/year |
| Displayed price | Final amount, any applicable VAT included |
| Existing customers | Preserve pricing/access; no migration |

### Provider catalog evidence

- Authorized live adjustment on 12 September 2026: Nick explicitly requests live configuration rather than sandbox and says to adjust the offer. Created coupon [`8KSV9CZz`](https://dashboard.stripe.com/acct_1TH0lOGiGHTGZcKB/coupons/8KSV9CZz), name `Launch-Rabatt: 30 € im ersten Jahr`, EUR 30 fixed amount off, duration `once`, restricted to Chaarlie Premium (`prod_UMfRHJ3yh8l0bV`), no redemption deadline or total-redemption cap, no customer-facing promotion codes. The live catalogue shows the new coupon with EUR 30 off once and zero redemptions, alongside unchanged `beta_testers`. The product restriction includes all six product prices; annual-only use and eligibility must therefore be enforced by the new server checkout logic. Live catalogue also reconfirmed the distinct EUR 69.99/year and EUR 99.99/year prices. Existing prices, subscriptions and beta coupon were not changed. Current checkout remains on its existing direct-price implementation; coupon creation does not wire the trial or first-year progression into production. No sandbox resources, test customers, subscriptions or charges were created. Provider execution verification remains outstanding and must respect Nick's live-only instruction; do not treat resource creation as a billing test.
- Live read-only coupon check on 12 September 2026: Stripe dashboard account `acct_1TH0lOGiGHTGZcKB` (Haarmony, LLC), Coupons catalogue, displayed one item: `beta_testers`, ID `go5Jd9xk`, **50% off once**, 17 redemptions, no expiry shown in the table. This cannot produce the approved EUR 69.99 first-paid-year price from EUR 99.99. Preserve the beta coupon for its existing purpose; no compatible EUR 30 launch coupon was visible. `src/lib/stripe/checkout-session-params.ts` currently supplies a price directly with no coupon/discount parameter. Implementation therefore needs an appropriate EUR 30 first-paid-annual-invoice discount configuration and explicit trial-compatible application, not unchanged reuse of the beta coupon. Verify the zero-value trial invoice and first/second paid invoices in sandbox once implemented; this read-only check is not an end-to-end billing test. Stripe connector required reauthentication, so the existing signed-in dashboard was used; no provider settings, coupons or subscriptions were changed.
- Stripe product `prod_UMfRHJ3yh8l0bV`; full annual price `price_1TNw7QGiGHTGZcKBv8jPk1MJ` exists at EUR 99.99/year with inclusive tax behavior. Existing launch annual price `price_1TzMm3GiGHTGZcKBP1McmRA9` is a separate recurring EUR 69.99 price; it must not be used as though it automatically becomes EUR 99.99 at renewal.
- PayPal product `PROD-1DJ37758SY227805K`; newly prepared full-price trial plan `P-2XJ97149EE510364NNKSAIRA` is DRAFT, one EUR 0 seven-day cycle then EUR 99.99 every 12 months. It does not yet implement the launch schedule or VAT calculation.
- Existing provider resources and subscriptions must not be mutated to implement this new cohort.
- PayPal's UI supports "Include tax in price" but requires a numeric tax percentage. The rate is unresolved; no assumed zero or German-only rate is authorized. A restored-session check confirmed this validation and was canceled without saving.
- Nick reports no current VAT registration. Cofounder/accountant discussion of obligations, registration, effective dates, historical sales, reporting, and country-dependent treatment remains on the backlog. Tax-inclusive price display alone does not establish tax compliance or calculation.

## Scope and non-goals

In scope for planning: offer entry, checkout, authorization, account activation, access during and after trial, cancellation/reversal, paid conversion, failed payment recovery, retention of customer data, notices, pricing/tax integration, analytics, cohort rollout, provider verification, and rollback.

Excluded: migration of existing customer subscriptions; reactivation of the parked freemium program; refinement locks (Nick deferred them); native iOS/App Store billing; unrelated recommendation changes. Exact acquisition routes and handling of returning customers remain open below.

## Target map

Surface and billing lifecycle mapping completed against the initial base; named regression-suite mapping remains in progress under E01.

| Surface | Current seam and evidence | Trial work to specify |
| --- | --- | --- |
| Offer routing | `src/app/result/[leadId]/result-client.tsx:84`, `:222`; `src/components/organic-plan-offer/organic-plan-offer.tsx:285`, `:395` | Select covered Personal Plan/organic/funnel entry points; replace central pricing slot consistently |
| Pricing and catalog | `src/components/quiz/result-offer-pricing.tsx:341`, `:383`; `src/lib/stripe/pricing-plans.ts:43`, `:79`; `src/lib/paypal/plans.ts:43` | Existing launch catalog repeats EUR 69.99 indefinitely; introduce first-paid-year offer semantics without repricing legacy subscriptions |
| Checkout | `src/components/checkout/payment-method-checkout.tsx:69`, `:168`, `:305`; `src/components/checkout/paypal-subscription-button.tsx:406` | Existing Stripe Elements subscription checkout and PayPal subscription/vault authorization; add reviewed trial/first-charge/renewal disclosure |
| Product access | `src/lib/billing/subscriptions.ts:316`; `src/lib/supabase/middleware.ts:30`, `:580` | Existing active/past-due access includes 24-hour grace after period end; do not silently inherit this for free trials. Expired user pages redirect to reactivation and APIs reject |
| Pricing redirect/reactivation | `src/app/pricing/page.tsx:17`; `src/app/reactivate/page.tsx:29`, `:67`; `src/components/reactivation/membership-reactivation-page.tsx:53` | Existing reactivation promises immediate payment; settle returning-user eligibility and preserve correct disclosure |
| Billing self-service | `src/app/profile/page.tsx:2252`; `src/components/profile/manage-subscription-button.tsx:18` | Provider/interval/end-date/plan-switch UI; Stripe portal versus PayPal in-app cancellation; define equivalent trial experience |
| Lifecycle and analytics | `src/app/api/stripe/webhook/route.ts:41`; `src/lib/customerio/stripe-lifecycle.ts:26`, `:107`, `:157`; `src/components/quiz/result-offer-pricing.tsx:796` | Separate trial activation from purchase/paid revenue, add confirmed notice events and owner; no dedicated trial reminder scheduler found in targeted scan |
| Existing access promise | `src/components/personal-plan-offer/personal-plan-offer.tsx:148` | FAQ currently says cancellation anytime and access through paid period; trial semantics need an explicit decision |

Current visual references for forthcoming mockups: cream background, plum display headings, coral accents and rounded white cards in `src/components/reactivation/membership-reactivation-page.tsx:85`, `:127`. Render/capture actual surfaces before creating mockup evidence.

### Billing implementation traps found during mapping

- `src/lib/stripe/checkout-session-params.ts:62`, `:93`: current subscription builder uses one recurring price and automatic tax, without the required trial configuration. Preserve automatic-tax behavior intentionally; registration/configuration remains a separate unresolved dependency.
- `src/lib/stripe/checkout-activation.ts:841`, `:873`: initial activation requires provider status `active`; the later status mapper accepts `trialing`. Change the admission contract and tests together; simply adding trial days would fail activation.
- `src/app/api/paypal/create-subscription-intent/route.ts:238`, `src/app/api/paypal/approve-subscription/route.ts:42`: existing intent/approval flow and pinned plan metadata should carry the new schedule identity.
- `src/lib/paypal/subscription-shapes.ts:182`, `scripts/paypal/personal-plan-launch-plans.ts:52`: existing launch validation requires no trial/tax and an infinite regular cycle. Do not weaken existing-plan checks indiscriminately to admit new trial plans.
- `src/lib/billing/types.ts:15`, `supabase/migrations/20260527_add_billing_subscriptions.sql:1`: mapped billing model lacks explicit trial dates/eligibility/first-paid-year state. Specify authoritative lifecycle fields and migration after interview; preserve legacy interpretation.
- `src/lib/stripe/webhook-handlers.ts:565`, `:718`, `src/lib/paypal/webhook-handlers.ts:186`, `:288`: provider status persistence and failure handling differ. The Stripe `invoice.payment_failed` handler itself only logs; inspect surrounding lifecycle delivery before claiming no notification exists. First-charge failure needs an explicit policy.
- `src/app/api/stripe/portal-session/route.ts:37`, `src/app/api/paypal/cancel-subscription/route.ts:61`: Stripe delegates cancellation to its portal; PayPal cancels immediately at provider and preserves paid-through access in the app. Confirm trial/reversal parity rather than assuming matching provider APIs.
- `src/app/api/stripe/create-checkout-session/route.ts:686`, `supabase/migrations/20260714200000_membership_reactivation_checkout_reservations.sql:1`: reuse protected reactivation reservations where appropriate, without implicitly granting another trial.
- `src/lib/stripe/subscription-plan-change.ts:78`: existing interval-change service rejects discounts and scheduled cancellation. Decide which plan-switch actions remain visible for the new annual trial cohort and prevent interference with its price progression.
- `tests/stripe-checkout-session-params.spec.ts:65`: existing no-discount assumptions need cohort-aware regression coverage.

`docs/freemium-parked.md` establishes the parked flag and migration-ledger constraints. Do not enable `FREEMIUM_SCANNER_FIRST_ENABLED` as an incidental way of obtaining trial account access. Production migrations, if required, must use the repository's `supabase db push` workflow.

## Decision coverage

### Confirmed with Nick

- D10 coupon setup confirmed on 12 September 2026: in response to the proposed automatic annual launch discount, no additional coupon-entry field and no discount stacking, Nick says “Yeah we can take the existing coupon.” Reuse the existing coupon where compatible rather than introduce a new customer-facing promotion flow. Preserve EUR 69.99 for the first paid annual year and EUR 99.99/year afterward, with no offer cutoff. Existing coupon identity/configuration and compatibility with a seven-day trial remain to verify; do not mistake the existing indefinitely recurring EUR 69.99 price for a first-paid-year coupon, consume the discount on a zero-value trial invoice, or apply it indefinitely. Specify equivalent PayPal introductory pricing using supported provider mechanisms. No provider configuration was changed by this decision.

- D06 delayed first-payment recovery confirmed on 12 September 2026: Nick explicitly confirms that the first paid month/year starts once payment succeeds. If the trial expires on 20 September and the first payment succeeds on 23 September, access stays locked in between, resumes after verified successful payment, and the full paid period starts on 23 September. Do not backdate that paid period to trial expiry or count locked days as paid access. Establish consistent provider billing/renewal dates and authoritative successful-payment timing, not webhook arrival time; verify Stripe and PayPal feasibility before implementation. This approval concerns the first payment after trial, not resetting the billing period for later renewals that already received the confirmed seven-day access grace. Prevent stale invoices/retries from collecting twice during any required schedule adjustment.

- D03 enforcement confirmed on 12 September 2026: Nick approves the proposed account-and-payment-method policy, including the shared-card tradeoff, while requesting proportionate implementation consistent with established practice. Deny another free trial when the same Chaarlie account, verified email, Stripe card fingerprint or PayPal payer ID is reliably linked to a previously activated trial or paid subscription. Card/payer matches apply even across different emails, so legitimate shared payment methods can also be ineligible. Same name, billing address, IP/network or device alone must not deny a trial; this does not authorize invasive device fingerprinting or additional identity collection. Failed authorization or an abandoned checkout that never activated a trial does not consume eligibility. Trial denial leaves an explicitly chosen paid signup and support correction available; never silently turn trial authorization into an immediate charge. Use verified provider data and existing account ownership checks. Cross-provider identity cannot be assumed and wallet tokenization can prevent card matching. This is an approved product policy, not a claim that every competitor follows it. Historical one-time/manual/test access remains to reconcile with existing cohort rules.

- D09 reaffirmed after requirements review on 12 September 2026: Nick explicitly confirms “Yes only the required stuff please.” Implement only billing communications/disclosures required by applicable law or payment-provider/card-network rules for this trial launch; no optional trial reminder. Reuse existing delivery where it satisfies the requirements and avoid duplicate notices. Required checkout disclosure and contract confirmation remain included. Exact provider coverage and minimum delivery/timing are verification tasks, not a further product choice. This approval does not authorize sending messages now or changing production settings, and does not retire unrelated existing product onboarding.

- D09 confirmed on 12 September 2026: Nick rejects the proposed extra trial-start billing email and three-days-before-charge reminder unless required by applicable law or payment-provider/card-network rules. No optional trial billing-reminder campaign is approved; product onboarding should focus on using the plan. No emails have been sent or enabled. Preserve mandatory disclosures and notices, using existing confirmation/delivery where sufficient and avoiding duplicate messages. The preference does not establish that billing information can be omitted from checkout or required contractual confirmation. Verify actual provider/account requirements before finalizing the minimal notification implementation.

- D05/D10 confirmed and corrected on 12 September 2026: a customer returning after an expired, unpaid trial can receive EUR 69.99 for their first paid annual year while the launch offer is available, then EUR 99.99/year. Return after trial expiry requires immediate payment and never grants another trial. A customer who already received the discounted paid year cannot claim it again. Nick explicitly withdraws the proposed 1 October deadline: the current launch discount stays available until he changes the coupon/offer. No deadline, cutoff date, scheduled expiration or countdown is approved. Future offer changes and their cutover rules are deferred; do not require a deadline decision for this launch or silently alter terms already agreed with enrolled customers.

- D02 trial plan changes confirmed on 12 September 2026: Nick approves switching monthly ↔ annual before the first charge. Keep the original trial deadline and first-charge date; switching never grants extra trial days. Clearly show and confirm the new first-charge amount and applicable renewal terms. Verify Stripe and PayPal support, including any required renewed authorization, before implementation; surface a material provider limitation rather than silently changing the approved behavior. Paid-period plan changes and returning-customer promotion eligibility are not settled by this approval.

- D04 confirmed on 12 September 2026: Nick explicitly approves preserving and adapting the existing payment flow, including its existing account logic. Verified trial authorization takes the role of completed payment for starting account activation, quiz linking, access provisioning and the existing onboarding/plan continuation. Preserve password versus email-login-link choice, existing-account handling, matching signed-in-account bypass, provider-email mismatch handling, and current abandonment/duplicate/recovery safeguards where applicable. No additional account form, repeated quiz or separate trial-onboarding flow. This equivalence concerns access/onboarding, not accounting: the trial remains unpaid, and paid conversion/revenue requires a successful nonzero payment. Only newly discovered trial-specific consequential differences require further decisions.

- D02 retirement proportionality, 12 September 2026: Nick considers old-link purchase risk negligible and believes nobody previously bought the one-time offer. Do not create a separate old-link cleanup, outreach or migration project. Retire the offer through the normal updated offer/checkout rules and preserve existing purchase/recovery infrastructure. Zero completed purchases has not been verified (the prior read counted checkout starts only); the belief does not authorize deleting records or disabling fulfillment. Any genuinely in-flight payment can use preserved existing recovery rather than a bespoke migration.

- D02 one-time retirement on 12 September 2026: Nick says the separate EUR 29.99 one-time offer should be retired for now. Exclude it from new public purchases in the trial rollout, including obsolete one-time offers on revisited results; keep existing purchases, access, fulfillment/recovery and provider references intact. This is a planning decision, not deletion of one-time infrastructure. Previously created/in-flight checkout cutover remains to specify.

- D02 page placement confirmed on 12 September 2026 after Nick corrected the broader entry inventory: adapt the existing subscription payment modules on `/result/<leadId>` (organic and Personal Plan versions) and `/reactivate` (trial-eligible customers only). Nick explicitly agrees to these two placements. `/pricing` remains a routing/compatibility check, not a third payment page. Homepage, quiz, email and protected product routes receive no new trial/paywall modules. The [entry-point coverage](entry-point-coverage.md) is a navigation and regression inventory, not authorization to redesign all listed surfaces. One-time retirement is separately confirmed below; old founding-price promises, in-flight checkout cutover and plan switching remain open.

- D06 renewal grace confirmed on 12 September 2026: Nick answered “perfect” after reviewing seven days versus shorter grace periods. For later failed renewals on the new monthly/annual subscriptions, retain product access for seven days while attempting payment recovery; lock product access afterward if still unpaid. First payment after the trial has no access grace. Existing customers retain their current terms. Collection retry duration is distinct from access grace and remains to specify; provider event timing and exact deadline semantics must be covered in the implementation contract and final journey.

- D06 reaffirmed on 12 September 2026: Nick explicitly confirms a recovery flow and requires product access to remain restricted after a failed first payment until payment succeeds. He distinguishes this from later recurring payments; no specific renewal grace period or retry schedule is approved by this reaffirmation. Existing customer terms remain preserved.

- D06 partial confirmation on 12 September 2026: Nick accepts locking product access when the trial has ended and the first payment fails, while retaining the payment-update/recovery screen. Restore access after verified successful payment. No access grace period is granted for that failed first charge. This does not approve immediate subscription cancellation or settle retry duration, recovery-period billing dates, or failed renewals for existing paying customers. Nick also asked whether this is best practice; the evidence below establishes a defensible product policy, not a universal provider recommendation.

- D05 partial confirmation on 12 September 2026: Nick agrees that a customer can undo trial cancellation before the original trial expires. The original expiry and first-charge date remain unchanged; no new seven-day trial is granted. Example: cancellation on day two reversed on day five still leads to billing at the original day-seven boundary. This is confirmed customer behavior; provider feasibility and any required renewed payment authorization must be specified before implementation.

- New-customer interval set confirmed on 12 September 2026: Nick answered “yes” to offering only monthly and annual, removing quarterly from the new offer, while existing quarterly subscribers keep their terms. This settles the interval set, not which acquisition routes switch or plan-change behavior.

- Monthly price confirmed on 12 September 2026: Nick answered “Yes that sounds good” to EUR 9.99/month after the seven-day trial, with no additional monthly launch discount. This acknowledgement does not settle quarterly availability or other coupon rules.

- Monthly and annual both receive the same seven-day free trial, confirmed and explicitly reaffirmed by Nick on 12 September 2026 after reviewing the competitor research: “Let's keep it simple and just do 7-day trials for both.” The [12-app comparison](trial-by-billing-interval-research.md) finds same-length trials, different-length trials, annual-only trial enrollment and unresolved offers. Correction: Headway's broader official features page explicitly documents seven days on all paid plans; its annual-focused FAQ was incomplete evidence. No market-majority claim is established. Quarterly exclusion from the new-customer offer is now separately confirmed above.

- Final offer design locked on 12 September 2026: Nick explicitly confirms “Yes excellent. We can lock this in” after reviewing the scanner-image correction. Canonical markup: `mockups/cal-ai.html`; canonical visual: `mockups/cal-ai-mobile-scanner.png`; image: `mockups/scanner-hero.webp`; mobile review entry: `mockups/mobile.html`. Preserve the single-page Cal AI-style hierarchy, scanner hero and crop, trial headline, annual trial strip and emphasis, compact monthly alternative, rounded CTA, typography, spacing and small billing terms. This supersedes all earlier offer-layout proposals and pending visual-review notes. Separate unresolved commercial assumptions and downstream lifecycle/journey decisions are not implicitly approved by this design lock.

- Commercial values and grandfathering above.
- Card or PayPal authorization accepted.
- Full-feeling product access during the trial; refinement locks deferred.
- D02 visual choice confirmed on 12 September 2026: Nick approved the Cal AI-style mobile offer in `mockups/cal-ai.html` / `mockups/cal-ai-mobile.png` (“Excellent. That looks good.”). Retain the product photo, trial headline, annual trial strip and strong annual emphasis, compact monthly alternative, rounded trial CTA and small terms. This approves the rendered offer design. Exact commercial duration set, shorter-plan prices/trials and downstream lifecycle decisions remain unresolved; this is not full user-journey sign-off.
- D01 confirmed on 11 September 2026: cancellation during the trial stops the upcoming charge immediately; product access continues until the original trial expiry, then ends. Cancellation does not reset or extend the seven-day clock. Reversal before expiry is now confirmed under D05; return-after-expiry offer details remain open.
- D03 baseline confirmed on 11 September 2026: one trial per customer ever. A previously used trial disqualifies the customer even if canceled without any payment. Previous paid subscribers do not receive another trial on return. An existing account with neither prior trial nor paid subscription can qualify. Cross-account enforcement, one-time buyers, and internal/test entitlements remain unresolved below.
- Product content becomes inaccessible once entitlement ends; preserve existing customers.
- VAT registration/reporting discussion placed on a cofounder backlog; final prices remain fixed.

### Inherited from evidence or contract

- D09 research, 12 September 2026: [Mastercard's recurring-payments FAQ](https://www.mastercard.com/content/dam/mccom/ca/en/business/documents/subscription-recurring-payments-and-negative-option-billing-merchants%E2%80%93faqs.pdf), question 27, exempts digital trials of seven days or less from the separate 3–7-day trial reminder; its rules still require upfront terms/acceptance and electronic subscription confirmation. [Visa's published clarification](https://usa.visa.com/dam/VCOM/global/support-legal/documents/recurring-vbn-public.pdf) says that for trials of seven days or less, initial confirmation should include reminder details. This supports investigating one combined required confirmation, not approving zero billing disclosure. [BGB §312f(2)](https://www.gesetze-im-internet.de/bgb/__312f.html) requires distance-contract confirmation on a durable medium; [§312j](https://www.gesetze-im-internet.de/bgb/__312j.html) requires clear payment information and explicit payment-obligation acknowledgement at final ordering. Verify final checkout placement/button and actual existing confirmation content. Stripe's generic reminder guidance is broader than the Mastercard short-trial exception; resolve the applicable integration requirements before configuration. PayPal-specific merchant/account notice coverage is not yet established. Annual renewal and the end of the discounted paid year require separate notice analysis.
- Freemium remains parked (`docs/freemium-parked.md`). Its endpoints/data are not implicit authority for the new trial.
- All customer-facing text is German (`AGENTS.md`).
- Payment provider events and verified provider state must determine billing truth; browser redirects alone cannot grant access. Current implementation mapping must identify how to preserve this contract.

### Implementation defaults

- Store authoritative instants consistently; show human-readable dates in the customer interface.
- Make retryable provider/event processing idempotent and explicitly test delayed/out-of-order delivery.
- Keep provider identifiers and the introductory schedule server-controlled.

These do not decide grace periods, eligibility, refunds, retention, tax rates, or rollout policy.

### Open consequential assumptions — resolve before handoff

| ID | Decision to settle | Affected work |
| --- | --- | --- |
| D02 | Two payment-page placements, one-time retirement and monthly ↔ annual switching during the original trial are confirmed. Verify provider support for trial switching. Settle founding-price promises and any trial-specific incompatibility with existing paid-period switching; keep in-flight checkout handling within the confirmed proportionate reuse contract. Ensure revisited unpaid one-time results cannot open a new retired offer. Scanner sibling compatibility and deployed/external links are verification/integration items, not extra paywall placements or authorization to launch another funnel. | Acquisition scope, checkout routing and profile billing |
| D03 | Account, verified-email, Stripe-card-fingerprint and PayPal-payer-ID blocking are confirmed, including shared payment methods, with paid-signup/support fallback and no silent charge. Weak identity signals alone do not block and unactivated attempts do not consume eligibility. Verify provider availability, concurrent admission and reliable history linkage; reconcile one-time purchasers and historical/manual/test access without assuming cross-provider identity equivalence. | Trial admission and recovery |
| D04 | Flow and ordering confirmed: preserve existing account/onboarding and recovery logic, triggered by verified trial authorization. Implementation verification must adapt provider checks and entitlement facts without re-asking settled behavior; surface only a new material incompatibility. | Auth, provisioning, continuation; verification, not an open product choice |
| D05 | Return after expiry is confirmed: immediate paid signup, no further trial, first-paid-year launch price available while the offer is live if not previously received. Before-expiry reversal with the original clock is confirmed; verify cross-provider feasibility and surface any materially different reauthorization journey for review. No launch-offer cutoff is defined. | Reactivation and pricing |
| D06 | First-charge failure lock, full first paid period starting on successful payment, and seven-day later-renewal access grace are confirmed for the new cohort. Verify provider billing-date parity after delayed first payment. Resolve collection window/retries, any trial-specific incompatibility in later-renewal recovery, pending payment versus confirmed failure, and exact grace deadline/event-timing semantics. | Entitlement and dunning |
| D07 | Retain account/profile/plan after entitlement ends? Which billing, export/deletion, and reactivation screens remain accessible? | Data lifecycle and access matrix |
| D08 | Cancellation experience: direct route, optional feedback/retention offer, confirmations, paid-year cancellation and renewal terms, refund/withdrawal handling. | Billing self-service and legal copy |
| D09 | No optional trial billing emails or three-day reminder. Determine the minimum mandatory checkout disclosures, contract confirmation and provider/network notices; reuse existing delivery and avoid duplicates. Check required cancellation, failure and annual-renewal notices separately; do not assume a short-trial reminder exception also exempts annual renewal. This is evidence/implementation work, not a renewed request to approve optional reminders. | Messaging and operations |
| D10 | Automatic application, no additional coupon-entry field and no stacking are confirmed. Live verification found the existing beta coupon incompatible; Nick authorized the live adjustment and EUR 30 once coupon `8KSV9CZz` was created and verified. Offer stays available until Nick changes it; no deadline or scheduled expiration. First-paid-year eligibility on return is confirmed under D05. Wire annual-only eligibility and verify first-paid-invoice behavior and equivalent PayPal schedule; future offer changes/cutover rules remain deferred. | Catalog, promotions and disclosure |
| D11 | VAT treatment and registration; determine what can be implemented before resolution and what blocks activation. | Tax/invoices and launch readiness |
| D12 | Rollout scope, QA/live payment authority, support visibility, success metrics, kill switch and behavior for already-started trials after rollback. | Release/operations |
| D13 | Exact full-access scope, any current usage limits, and treatment of internal QA/field-test accounts. Refinement locks explicitly remain out of this release. | Entitlement parity and trial promise |

Do not interpret an interview recommendation as a decision. Update this table after each answer and checkpoint after 2–4 substantive decisions.

Coverage acknowledgement: Nick has confirmed the commercial decisions and D01 in conversation on 11 September 2026; he has not yet reviewed this complete record. Remaining assumptions above are disclosed for interview, not settled. Undiscussed consequential assumptions affecting this handoff: unresolved; discovery and interview are ongoing. No handoff is authorized by this draft.

Internal revalidation, revision 0.16: monthly EUR 9.99 without an additional monthly launch discount and exclusion of quarterly from the new-customer offer are confirmed through separate original acknowledgements above. Existing quarterly terms are preserved. Overall coverage remains pending for the other listed decisions. Earlier mockup/research notes describing monthly pricing or quarterly availability as provisional are historical and superseded by the authoritative values. No provider or product changes.

Internal revalidation, revision 0.17: cancellation reversal within the original trial is confirmed; trial dates never reset. Other decisions and the full journey remain pending. No product or provider changes.

Internal revalidation, revision 0.18: first-charge failure access policy is confirmed; recovery details and paid renewal failures remain pending. Verified official provider documentation supports configurable retries, not a universal immediate-lock rule. No product/provider changes.

Internal revalidation, revision 0.19: strict first-payment gating and accessible payment recovery are reaffirmed; later-renewal grace duration, recovery limits and pending-payment behavior remain open. This updates planning only.

Internal revalidation, revision 0.20: seven-day later-renewal access grace confirmed, while the first post-trial payment remains strict. Prior revalidation entries record historical open states; the current decision record controls. Collection/recovery details and complete journey remain pending. No provider/product changes.

Internal revalidation, revision 0.22: two payment-page placements confirmed; broader route inventory is regression coverage only. No new payment modules on homepage, quiz, emails or product pages. Provider/backend work and existing membership-management lifecycle remain required; remaining consequential choices and full journey sign-off stay pending.

Internal revalidation, revision 0.23: one-time retirement is confirmed for the new trial rollout. Live settings and aggregate session counts show the experiment is enabled and has public assignment history; no production configuration was changed. Previously created checkout treatment remains open.

Internal revalidation, revision 0.24: old-link handling should remain proportionate and within ordinary retirement, without a separate cleanup workstream. No production changes or purchase-history assumptions were introduced.

## Reuse contract

Adapt the existing flow rather than implement parallel trial plumbing:

| Existing capability | Reuse / required adaptation |
| --- | --- |
| Result-page and reactivation payment modules | Keep existing integration surfaces and shared provider components; use approved trial offer and authoritative schedule. |
| Provider return verification and account provisioning | Reuse `src/app/welcome/page.tsx`, Stripe `verifyCheckoutSessionForActivation` / `ensureCheckoutAccount`, and PayPal `ensurePayPalCheckoutAccount`. Accept a verified eligible trial subscription explicitly; do not treat a browser redirect or bare PayPal approval as access authority. |
| Account login / activation | Reuse `src/app/welcome/welcome-client.tsx` and `/api/auth/set-checkout-password`, existing email-login-link handling, password policy, account ownership checks and matching-session bypass. Adapt payment-specific wording and checks to trial authorization. |
| Quiz/profile attachment and plan readiness | Reuse linking and server-derived continuation through `src/lib/billing/checkout-success-redirect.ts`; trial enrollment must satisfy the appropriate provisioning contract without fabricating a paid timestamp. Preserve readiness/pending recovery. |
| Failures, duplicate attempts and support | Reuse existing attempt/activation protections and recovery components, adapting their trial-specific messages/states. |
| Lifecycle messages and analytics infrastructure | Reuse delivery/tracking infrastructure; separate trial activation from `purchase_completed` and collected revenue. Actual first payment remains a separate verified event. |

Targeted verification: Stripe activation currently rejects subscription status other than active (`src/lib/stripe/checkout-activation.ts:842`) even though zero-payment session status is already accepted (`:937`). PayPal activation requires ACTIVE and treats APPROVED as pending (`src/lib/paypal/checkout-activation.ts:176`). Thus reuse requires explicit provider-compatible trial state handling, not relabeling every authorization as payment. Existing welcome destinations include onboarding, plan readiness and plan start; preserve those decisions and account ownership boundaries.

Internal revalidation, revision 0.25: existing account/order flow is explicitly approved for reuse. D04 is no longer an undecided product interview topic; provider/entitlement adaptations remain implementation work. Other genuinely new trial decisions and final journey sign-off remain pending.

## Designed user journey

Account setup/order is confirmed through reuse; remaining lifecycle choices and full reviewed journey sign-off are pending. The working sequence is existing offer entry → trial disclosure → required payment authorization → verified activation → product → cancellation or first paid conversion → renewal/expiry/recovery. Each transition needs its error/recovery state and account variants before sign-off.

Confirmed cancellation example: the customer cancels on day 2, receives confirmation that the upcoming charge is canceled and the original trial-end date still applies, continues using the product until that date, then loses product access without being charged. Exact confirmation layout and delivery channel await mockup review and D09.

Confirmed reversal example: after canceling on day two, the customer can undo cancellation on day five. Access continues without interruption, and the original day-seven first charge applies. Display the unchanged charge date and selected-plan terms; no additional free days. Provider-specific authorization and failure/recovery states still require feasibility evidence and journey review.

Confirmed first-charge failure example: the trial ends and the first charge fails. Product content locks; the customer can still reach payment recovery. Verified successful payment restores access. A pending or delayed provider event must not be mislabeled as a confirmed decline; its access/timing behavior and delayed-payment period treatment remain to resolve under D06.

Confirmed later-renewal example: a customer in the new cohort has already successfully paid for a subscription period. A subsequent renewal fails; product access continues during seven days of grace while payment recovery is offered. If still unpaid when grace ends, product content locks and payment recovery remains available. This does not extend the trial or change existing customer terms.

## Planning evidence

### One-time production exposure check

Read-only check on 12 September 2026:

- Vercel project `hair-concierge`, production alias `chaarlie.de`, deployment `dpl_AypqLhb2Wgpo5tkNs3YNvE8eD3rJ`, deployed commit `4935b271f2f734e7b3150732d171c85ac67fefa8`.
- Current production configuration: `PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED=true`, `PERSONAL_PLAN_QUIZ_V1_ENABLED=true`, `PERSONAL_PLAN_ONE_TIME_QA_ENABLED=false`. Current configuration was read using a temporary production env pull, printing only those booleans; temporary file removed automatically. This is current project configuration, not a captured deployment-time environment snapshot.
- Aggregate production `funnel_sessions` for `meta_personal_plan_v1`: 241 one-time-assigned sessions not flagged internal, all with an offer-view timestamp; four with checkout-start timestamps. Latest recorded first view: 25 August 2026. Zero recorded first views in the last seven days. Four additional one-time sessions are flagged internal. These are session counts, not unique people, purchases or proof of absence of repeat page visits.
- Deployed-equivalent resolver `src/lib/funnel/server.ts:146` allows public assignment when enabled. It also preserves previously viewed/checkout-started experiment arms at `:159` even when assignment is disabled. One-time checkout authorization at `:443` checks stored assignment, not the global experiment flag. Therefore switching the experiment off alone is insufficient to retire already-exposed unpaid offers.
- Conclusion: one-time purchase is enabled for public experiment assignment and has actual public-assignment history; it is not QA-only. No payment was attempted. Existing provider checkout success was not tested.
- Retirement implementation must stop new one-time assignment and fresh retired-offer checkout from old result links, while preserving existing purchase fulfillment and explicitly handling in-flight provider sessions. No production flag/provider/database mutation occurred during this check.

### Renewal grace duration evidence

Checked 12 September 2026: [PayPal](https://developer.paypal.com/subscriptions/payment-failure-retry/) documents retries at five-day intervals; a seven-day access grace can accommodate the first scheduled retry, unlike a three-day grace. [Stripe Smart Retries](https://docs.stripe.com/billing/revenue-recovery/smart-retries) recommends eight attempts over two weeks, a collection window rather than a required access period. [Apple](https://developer.apple.com/help/app-store-connect/manage-subscriptions/enable-billing-grace-period-for-auto-renewable-subscriptions) offers three, sixteen or twenty-eight days for monthly/longer subscriptions; comparator only, as native billing is out of scope. Seven days is the confirmed Chaarlie policy, not a demonstrated market optimum.

### First-charge failure policy evidence

Checked 12 September 2026. [Stripe subscription guidance](https://docs.stripe.com/billing/subscriptions/overview) distinguishes retryable past-due invoices from unpaid subscriptions and explicitly recommends revoking access at unpaid status after retry attempts. [PayPal recovery guidance](https://developer.paypal.com/subscriptions/payment-failure-retry/) documents retries and a configurable failure threshold before provider suspension. Neither establishes immediate product locking on the first post-trial decline as a universal best practice. Chaarlie deliberately separates product access from provider collection: the trial has ended and no paid access has yet been funded, so immediate content locking is the chosen policy, with recovery still available. Retry duration and paid-renewal grace remain separate decisions.

### Offer mockups — revised comparison, review pending

**Final offer design and scanner asset: LOCKED by Nick, 12 September 2026.** The reviewed artifact is `mockups/cal-ai-mobile-scanner.png`, rendered from `mockups/cal-ai.html` with `mockups/scanner-hero.webp`. The lock covers the corrected design visible through `mockups/mobile.html`. The preceding product-shopping photo and all earlier layouts remain historical evidence only. Further design changes require explicit feedback; remaining commercial terms and full lifecycle planning continue separately.

Image correction after visual approval: Nick explicitly requests the previously generated scanner image rather than the older product-shopping/chat photo. The selected asset is `.worktrees/scanner-funnel/public/images/funnels/scan/regal-scan-flasche.webp`, copied unchanged to `mockups/scanner-hero.webp` and used in `cal-ai.html`. Its CSS crop keeps the phone and held product visible within the approved hero dimensions. Verified at 390×844 and captured as `mockups/cal-ai-mobile-scanner.png`. Retain this scanner asset in the production design handoff; `cal-ai-product-visual.jpg` and its earlier capture are historical only.

**Current offer evidence review: confirmed.** Nick approved the rendered Cal AI-style mobile variant on 12 September 2026. The selected artifact is `mockups/cal-ai.html`, captured in `mockups/cal-ai-mobile.png` and presented through `mockups/mobile.html`. Earlier statements below that this variant awaits visual review are superseded. Checkout, activation, cancellation and expiry evidence and the final end-to-end journey remain pending. Approval of the visual design does not silently settle the previously marked provisional monthly terms.

Latest request: mirror the Cal AI version directly. `mockups/cal-ai.html` is now the proposed mobile paywall shown in `mockups/mobile.html`, following the captured Cal AI visual hierarchy: product photo, bold trial headline, selected annual row with a trial strip and first-year savings, secondary monthly row, rounded trial CTA and compact billing terms. There is no standalone instruction bridging trial to plan selection. Captured in `mockups/cal-ai-mobile.png`; 390×844 and 360×740 checks show no horizontal overflow and a visible CTA. Existing project product photo reused unchanged. This is a requested comparison variant, not final design sign-off. The 42% first-year savings depends on the provisional EUR 9.99 monthly price; duration set and shorter-plan trial availability remain unresolved. Checkout is static and no production behavior changed.

Latest mobile feedback: Nick rejects the desktop-oriented presentation and requests a directly reviewable mobile view. `mockups/mobile.html` now embeds the actual draft at 390 × 844 px. The mobile illustration is reduced to a compact horizontal product preview, bringing the CTA bottom from approximately 827px to 697px without changing the approved type sizes or plan styling. Checked for overflow and visually captured in `mockups/draft-mobile-compact.png`. This is the current mobile proposal, pending Nick's review; the commercial assumptions and static-checkout limitations still apply.

Latest correction, 12 September: Nick clarifies that trial invitation and plan choice belong on one page. He approves the existing layout treatment, type sizes and positioning but rejects the unexplained bridge from free trial to choosing a subscription. This supersedes the separate-screen interpretation below. `mockups/draft.html` now uses one shared page, one trial CTA, the retained product illustration and compact plan cards. The bridge reads “Wähle jetzt dein Abo für die Zeit nach den 7 Gratistagen.” The trial remains the primary message; the choice describes subsequent billing. Desktop uses two columns within one shared surface; mobile stacks them. `draft-two-screens.html` and earlier screenshots are superseded historical evidence.

Simulated user review (Lea, unauthenticated, local design preview): major flow issue — the first trial CTA merely led to a second identical CTA; major clarity issue — “Du hast die Wahl” did not name what the choice changes or when it applies. Both are addressed in the one-page draft. Strengths retained: readable type hierarchy, concise product-value message, directly comparable monthly prices with the first-year total nearby. Recommendation fit is not evaluated because this is an offer illustration rather than a generated recommendation. Checked the revised desktop view and 390px mobile view (no horizontal overflow, exactly one trial CTA); retained `mockups/draft-one-page-desktop.png` and `mockups/draft-one-page-mobile.png`. This review covers visual comprehension only, not functioning selection, checkout or real user research. Monthly terms remain provisional and final rendered-design review/journey sign-off remain pending.

12 September 2026: Nick accepted the proposed trial-first direction (“proposition sounds good”) and requested the actual latest mockup. `mockups/draft.html` now renders the invitation and subsequent plan choice side by side on desktop and stacked on mobile. Product illustration, concise German value copy, a trial CTA, compact annual/monthly comparison and small renewal terms replace the previous selector-led hierarchy. Captures: `mockups/draft-desktop.png` and `mockups/draft-mobile.png`. Verified in Chrome at desktop and 390px (no horizontal overflow); the invitation link jumps to the plan-choice frame. This is a static layout comparison: plan rows and the final checkout action do not perform a purchase. Monthly pricing/trial availability and final duration set remain provisional. The rendered design still requires Nick's review; acceptance of the proposal is not final journey sign-off. No production code or provider settings changed.

Latest direction from Nick supersedes the hierarchy hypotheses below: lead with a free-trial CTA and a brief explanation of product value (including scanning first products), then let the user select a subscription. Remove the billing/authorization timeline. This confirms the intended sequence, not a final layout or all plan choices. A separate page versus an inline next step, exact copy, alternative durations/prices/trial availability and the final journey remain pending.

Visually reviewed five public archived screens on 11 September 2026: Cal AI trial invitation, reminder and plan picker (August 2026); Headway trial guide (May 2023 filename); Blinkist trial offer (capture date unverified). All five images loaded with nonzero natural widths in Chrome. [Review gallery](mockups/references.html) retains sources and screen-specific takeaways; `mockups/references-reviewed.png` captures the gallery. These are historical observations, not verified current universal offers or conversion evidence. RiseGuide's complete paywall was not publicly accessible; its official pricing describes a paid introductory offer, so no visual comparison is claimed for it.

Recommended adaptation: product visual plus one sentence and “7 Tage kostenlos testen” on the invitation; compact duration choice next, emphasizing annual with EUR 5.83/month equivalent for the first paid year and EUR 69.99 actual first-year total. Put EUR 99.99 annual renewal thereafter in small readable supporting copy before authorization. Retain readable alternatives and avoid duplicating the trial explanation. Trial activation still occurs only after verified provider authorization, never on the invitation click. Skip Cal AI's separate reminder screen and Headway/Blinkist's timelines for this direction. No new rendered Chaarlie design or journey sign-off is implied by the reference gallery.

Further feedback after revision 2: Nick questions why plan selection dominates a trial-start experience and requests actual surrounding competitor screens before another redesign. Offer hierarchy remains unresolved. Cal AI's [August 2026 sequence](https://www.lazyweb.com/company/cal-ai/app-tree) separates trial invitation, reminder reassurance, plan choice and App Store confirmation. [Headway's official FAQ](https://makeheadway.com/faq/) documents a trial offer with alternatives behind “View other plans.” An [archived Blinkist screen](https://www.paywallscreens.com/apps/blinkist-mobile-paywall-4913) similarly subordinates alternatives to a trial CTA; its capture date is not established and pricing is historical. New comparison to consider: primary trial invitation with compact annual terms and a secondary “Andere Laufzeiten” control. This is a design hypothesis, not Nick's approval to hide alternatives or add a separate step. Do not treat the earlier approval of offering multiple durations as approval of a large selector on the information page.

Nick requested the stronger Cal AI-inspired option on 11 September 2026. [Open the comparison](mockups/index.html); [evidence and assumptions](mockups/README.md).

- A: monthly and annual, calm presentation with annual recommended and selected.
- B: the same presentation with a quarterly alternative, isolating the additional choice.
- C: monthly and annual, annual first in a dark card, prominent EUR 5.83/month equivalent versus EUR 9.99/month, and a 42% first-paid-year saving badge. Exact first-year billed total remains on the card; renewal details appear in one readable note below the CTA.

Nick rejected the first comparison as too text-heavy: remove the authorization timeline, repeated free-trial/zero-price explanations and excessive type sizes; emphasize the monthly-equivalent comparison and reduce renewal prominence. Applied across A/B/C. The revised product surface uses four main text sizes (headline, comparison price, body/action and 12px supporting copy). Revised captures: `mockups/a-mobile-v2.png`, `mockups/b-mobile-v2.png`, `mockups/c-mobile-v2.png` and `mockups/c-desktop-v2.png`. Unsuffixed mockup screenshots are superseded historical evidence, not approved designs. Revision 2 still awaits Nick's visual review.

All three are static snapshots of annual selection, with desktop and mobile review controls. No provider calls or functioning checkout. The annual schedule and trial-cancellation wording use confirmed decisions. Shorter-plan prices use the current launch catalog provisionally (EUR 9.99/month, EUR 19.99/quarter); trial availability on those plans is explicitly an unapproved comparison assumption. No reminder delivery promise, urgency timer or popularity statistic is introduced. The 42% saving is rounded from 1 - 69.99 / (9.99 × 12), applies only to the first paid year, and depends on the provisional monthly price.

Grounding: inspected and captured the actual development offer harness at `/labs/offer-page?variant=personal-plan&pricingArm=membership&pricingCatalog=personal_plan_launch_v1` on this task branch. [Current offer](mockups/current-offer.png) records the reference. Retained cream/plum/coral palette, serif hierarchy, rounded plan rows and payment-provider note; lightweight HTML uses system font approximations.

Verification: original comparison checked in desktop and 390px mobile Chrome. Revision 2 checked across the mobile variants and C desktop, with fresh screenshots; variant/view controls continue to work and temporary viewport overrides were reset. These checks establish presentation only. Remaining checkout, authorization failure/recovery, account activation, cancellation and expired-access mockups follow their unresolved decisions. Visual selection and evidence-review confirmation are pending; no final journey sign-off is implied.

### Plan choice alongside trials — D02 research

Checked official sources on 11 September 2026 after Nick challenged the annual-only recommendation. These are documented offerings, not a representative market share sample or evidence of causal conversion/revenue uplift. Offers can differ by region, channel, eligibility and promotion.

| Product | Documented subscription/trial pattern | Source |
| --- | --- | --- |
| Headspace | Monthly and annual; support documentation maps seven trial days to monthly and fourteen to annual | [Purchase guidance](https://help.headspace.com/hc/en-us/articles/215758647-How-do-I-purchase-a-Headspace-subscription) |
| Strava | Monthly and annual alternatives under "More Billing Options" in website/app signup; eligible customers are charged after trial | [Subscribe guidance](https://support.strava.com/en-us/articles/15401704-how-do-i-subscribe-to-strava) |
| Fitbod | Customer opts into monthly or yearly; seven-day trial before billing | [Subscriptions help, How the Trial Works](https://help.fitbod.me/hc/en-us/sections/1500000506081-Subscriptions) |
| Blinkist | Documents seven-day trials with yearly plans when offered; current overview includes multiple feature tiers. This does not prove a monthly option is shown in every new-user checkout | [Trial](https://support.blinkist.com/en/articles/10033386-do-you-offer-a-trial-how-does-it-work), [plans](https://support.blinkist.com/en/articles/10033366-what-are-the-different-blinkist-subscription-plans-and-their-benefits) |

The previous annual-only recommendation is superseded as a recommendation, not as a user decision: D02 was never confirmed. Multiple billing intervals are compatible with an authorization-required trial. The useful distinction is available plans versus their prominence in the offer UI.

Meaningful options for Nick:

| Option | Benefit | Tradeoff |
| --- | --- | --- |
| Annual trial only | One choice and one schedule to explain/maintain | No shorter paid commitment for users who want it |
| Monthly and annual shown equally | Both commitments are immediately visible | Adds a choice before trial; may shift plan mix toward monthly |
| Annual trial prominent, monthly clearly available as a secondary choice | Preserves a focused annual offer and a lower-commitment alternative | Requires two clear schedules and discovery of the alternative |

Current recommendation, pending Nick: annual prominent with a clearly available shorter commitment. Monthly plus annual is a reasonable starting proposal; monthly plus quarterly plus annual also merits comparison in planning evidence. Research does not settle which earns most for Chaarlie, nor whether every interval should include a trial. The confirmed annual trial and price progression remain unchanged. Alternative-plan prices, promotions, trial eligibility and quarterly availability require confirmation. No alternative-plan scope or price is approved by this research.

### Growth-focused competitors — D02 follow-up

Checked 11 September 2026 at Nick's request. Sources distinguish official published terms, a dated third-party screen capture, and promotional case studies from a vendor involved in the experiments. They are not a representative performance ranking.

| Product | Observed mechanism | Evidence and limits |
| --- | --- | --- |
| RiseGuide | Three durations: 4, 12 and 24 weeks; discounted first subscription period, then standard renewal | [Official pricing help](https://support.riseguide.com/hc/en-001/articles/26280398976924-How-much-does-RiseGuide-cost), updated 23 March 2026. This establishes a paid introductory offer, not a standard free trial. Four/twelve weeks are not calendar months/quarters. Prices vary by region and promotion. |
| Cal AI | August 2026 capture reports annual and monthly choices; annual selected, savings emphasis and a three-day trial, followed by annual billing confirmation | [Dated capture report](https://www.lazyweb.com/research/cal-ai-paywall-annual-plan-and-trial), published 9 September 2026. Secondary evidence of one offer, not a universal current checkout; no proof that the monthly choice includes a trial. |
| Cal AI experimentation | Tests across weekly, monthly, quarterly, annual and lifetime combinations; checkout-abandonment recovery, win-back offers, discount wheels and video paywalls | [Superwall case study](https://superwall.com/case-studies/cal-ai), 15 April 2026, reports 123 experiments and 424 variants. Vendor-reported aggregate gains cannot identify the winning effect of one duration or design. |
| BetterMe | Terms allow weekly, four-week, twelve-week, annual and other periods; trial or introductory offers depend on checkout | [Official subscription terms](https://betterme.world/en/subscription-terms), updated 29 July 2026. Does not establish that all durations appear together, or one universal free-trial duration. |
| Preu AI | Monthly-only trial offer compared with monthly plus discounted annual | [Superwall case study](https://superwall.com/case-studies/preu-ai), 8 February 2026, reports 80% higher proceeds per user and 22% higher trial conversion for the latter. Vendor-reported, context-specific; sample sizes and confidence intervals not supplied. |
| Rash ID | Monthly/yearly control compared with weekly/monthly/yearly plus annual highlighted as best offer | [Superwall case study](https://superwall.com/case-studies/rash-id), 9 January 2026, reports approximately 20% higher ARPU. Adding a duration and changing emphasis happened together; cannot isolate the effect of three choices. |

Planning inference: offering alternatives and steering toward a longer commitment are compatible. These examples do not justify an annual-only rule or automatic removal of quarterly. Compare a monthly/annual presentation with a monthly/quarterly/annual presentation, keeping annual prominent in both, before final D02 confirmation. This is a proposed mockup comparison, not authorization for a production experiment or additional plan setup. Evaluate future commercial results using collected revenue and subsequent retention/refunds, rather than trial starts alone.

### Trial eligibility research

Quick eligibility research, checked 11 September 2026:

- [Spotify official eligibility](https://support.spotify.com/us/article/charged-for-free-trial/): excludes customers who already had a trial or purchased Premium, also previous Family/Duo members. This directly supports the chosen baseline. Its immediate cancellation access policy differs from our confirmed D01 and is not adopted.
- [Calm official web trial guidance](https://support.calm.com/hc/en-us/articles/360003084493-Calm-Web-Free-Trial-Sign-Up-Cancellation-Steps): previous trial users are ineligible for another standard trial; early cancellation retains access through the trial. Supports both one-time eligibility and D01. Its separate 24-hour cancellation-deadline wording is not a decision for Chaarlie.
- These examples demonstrate an established acquisition policy, not evidence that it maximizes revenue for every product. Public rules do not establish their technical anti-abuse implementation. Our enforcement must be specified separately.

| ID | Evidence needed | Status |
| --- | --- | --- |
| E01 | Current code and tests: Stripe/PayPal creation, activation, events, access, cancellation, billing UI, communication and analytics | In progress |
| E02 | Current entry and billing surfaces captured; grounded German mobile/desktop mockups of offer, checkout disclosure, trial status, cancellation and expiry/payment failure | Pending decisions; not yet created or reviewed |
| E03 | Provider schedule feasibility: seven free days → first paid year EUR 69.99 → annual EUR 99.99, cancellation parity, reminders and tax treatment | Partial catalog evidence; sandbox verification pending |
| E04 | Counterpart review by Claude; read-only, terminal reviewer; material findings ledger | Pending coherent plan |

Evidence review: pending. User-journey sign-off: pending.

## Ordered tasks

Implementation decomposition is deliberately pending the interview and E01. The following acceptance areas must be converted into concrete independently testable deliverables, with named files and Consumes/Produces interfaces, before review:

1. Cohort/offer eligibility and server-authoritative provider schedule; preserve legacy purchase paths outside the agreed rollout.
2. Verified trial activation, account/provisioning recovery and access state; no charge or grant on redirect alone.
3. Consistent cancellation/reactivation and expired/failed-payment behavior across providers.
4. Reviewed acquisition and billing UI, transactional messages, and analytics separating trial authorization from paid revenue.
5. Catalog/environment/migration preflight, local automated/browser proof, authorized live provider verification, production activation and rollback runbook. Nick requests live provider setup rather than sandbox; do not create sandbox resources. Live resource configuration is distinct from executing customer charges or testing the full subscription lifecycle.

These are planning acceptance areas, not execution instructions; final tasks must resolve D01–D13 and E01–E03 first.

## Verification

- Automated: state/eligibility boundaries; provider schedule contracts; late/duplicate/out-of-order events; cancellation-versus-payment races; exact trial expiry; first-year discount versus second-year full charge; provisioning retry; legacy/flag-off parity; server route access.
- Browser: agreed mobile/desktop offer through activation on both providers; canceled/failed authorization; returning account; pending activation; cancellation, reversal and expiry; payment update; exact first charge and renewal disclosure; transactional message links.
- Provider: inspect live resources and validate the complete three-phase schedule, first nonzero invoice and PayPal cycle/tax semantics with local fixtures and available non-charging provider previews. No sandbox resources per Nick's instruction. Do not claim those checks prove actual charge/renewal execution; any remaining live transaction verification requires a concrete test scope without modifying existing customers.
- Release: diff/migration review, provider ID/environment matching, customer-cohort check, support observability, rollout and rollback behavior. Confirm separately which external changes are authorized when publishing.
- Local setup uses Node 23 but repository requires Node 22. Use a compatible runtime for subsequent test/dev verification; dependency installation succeeded, no product tests run during interview setup.

## Review and handoff

Before counterpart review: resolve product decisions, make tasks concrete, self-review coverage/consistency/order, create and review mockups. Then invoke `claude-plan-review` with read-only instructions and reconcile each material finding.

Findings ledger: no counterpart review yet. Record ID, type (defect/tradeoff/scope decision), evidence, disposition, plan change, and revalidation.

Final handoff requires current confirmed decision coverage and Nick's explicit confirmation of the post-review designed journey. Execution then uses `implementation-loop`, including ready-check and repository code review. Publication uses `ship-it`; merging and production activation remain explicit release steps.

Artifacts: this plan and durable mockups/evidence are intended for commit with the eventual PR. Transient counterpart logs remain outside the repository and are discarded or archived explicitly at handoff. No production code has changed. Authorized provider preparation is recorded above, including the live EUR 30 launch coupon; this does not activate the new trial checkout.
