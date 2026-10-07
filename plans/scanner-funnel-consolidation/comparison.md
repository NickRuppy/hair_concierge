# Scanner funnel consolidation: #534 and #535

Status: comparison and findings documented; design decisions pending. This is not an implementation-ready plan.

## Scope and evidence

Nick requested documentation and a discussion to consolidate his #534 funnel with Jonas's #535 design reference. No application changes, publishing, provider configuration or messages to Jonas are authorized by this assessment.

- Current main inspected: `5a3e33f1f641a8693209017ad25c4c9c69870df2` (13 September 2026).
- [#534](https://github.com/NickRuppy/hair_concierge/pull/534), merged as `f8c28328b6b7d374f627d6edc1951701de109e58`, implements the scanner funnel.
- [#536](https://github.com/NickRuppy/hair_concierge/pull/536), merged as `27882a9578058ef42cbf6c8a5779960bcaa3947f`, changes `scan_v1` to active and updates product-tour assets. Package activation in code is confirmed; production deployment, runtime configuration and a production purchase were not reverified here.
- [#535](https://github.com/NickRuppy/hair_concierge/pull/535), latest inspected head `d7de91a02a5435a031b233b27a7444bcd0592f1d`, is a reference, explicitly not intended for direct merge. Since the original review of `4f646fb2`, it adds a 29-second Steffi video, poster and handover notes. The three original content issues remain unchanged.
- Trial plan consulted live from the other task: `.worktrees/free-trial-launch/plans/free-trial-launch/plan.md`, revision 0.50, 13 September 2026. It records confirmed commercial and initial UX decisions, with technical/provider/privacy evidence still pending. That task owns trial implementation planning; this comparison must not overwrite it.

Outcome: agree one post-quiz offer experience using the existing scanner funnel and selected design input. Constraints: preserve correct attribution, shared checkout ownership, partner/test behavior and truthful product examples. Non-goals for this assessment: implementation, freemium activation, commercial-policy changes and production actions. Done for this step: documented comparison and findings, followed by one consequential decision at a time.

## Answer to Jonas's architecture question

Yes, #534 already covers the post-quiz scanner-offer step. The implementation to improve is `ScanRegalOffer`, reached through the existing result route and funnel registry. #535 should supply design/copy/proof input to that surface rather than introduce a competing production route.

The paid scanner funnel is:

`/lp/scan` → legacy `/quiz` with three scanner examples → `/result/[leadId]` using `scan-regal-v1` → shared checkout → `/plan-bereit` with profile/need provisioning → `/scan?welcome=scan`.

Evidence at inspected main:

- `src/funnels/packages.json:39-45`: active package and variant identities.
- `src/app/result/[leadId]/page.tsx:430-453`, `src/app/result/[leadId]/result-client.tsx:222-249`, `src/funnels/offers/scan-regal-v1.tsx:3-7`: offer resolution and rendering.
- `src/components/scan-regal-offer/scan-regal-offer.tsx:234,239,414`: partner/test fallback, tracking provider and one route-owned pricing slot.
- `src/app/plan-bereit/readiness.ts:580-605,779-791` and `src/app/plan-bereit/personal-plan-ready-client.tsx:78-81,299-303`: provisioning and scanner continuation.

`freemiumScannerFirst` is a different path: the Personal Plan quiz can redirect to `/registrierung`, then free scanner access, behind the freemium flag. It is documented as parked, and the legacy quiz still lacks that handoff (`docs/freemium-parked.md:3-15,26-31`; `src/lib/auth/free-registration.ts:60-72`). Turning that flag on is neither necessary nor sufficient to integrate #535 into #534. Live flag state was not read.

## Comparison

| Area | #534 / current merged scanner funnel | #535 design reference | Consolidation implication |
| --- | --- | --- | --- |
| First screen after quiz | “Nie wieder raten vorm Regal”, compact hair-profile sentence, animated scanner demo | Full hair profile, chips, three diagnostic cards and encouragement, then scanner introduction | Meaningful hierarchy choice. Recommendation: scanner value first with compact personal context; review a mockup before deciding final layout. |
| Quiz | Existing ten questions plus three answer-aware example inserts | Mockup proposes axis progress, a tappable example scan, a product-count question and revised lead/reveal copy | Both teach the scanner, but these are different journeys. Do not import the entire quiz mockup as a small copy change. |
| Product truth | Named example products, answer-aware illustrative tables; no engine call and no product supplied by the visitor | Fixed-profile, labeled example screenshot | Both can satisfy “no visitor-owned product assessed”. Choose fixed vs answer-aware examples separately and keep examples distinct from actual scanner results. |
| Scanner proof | Animated hero plus four product-tour screenshots | Shelf photo, large result screenshot, now Steffi customer video | Candidate additions: readable result explanation and customer proof; retain useful app context without stacking both complete pages. |
| Personalization | Profile sentence and scanner criteria derived from saved quiz answers | Profile chips, diagnostic rows and manually supplied encouragement | Use existing data contracts; do not invent individualized diagnosis or claims merely to fill the layout. |
| Pricing ownership | Shared `pricingSlot` supplied by the result/checkout flow | Local two-plan selector and `onUnlock` callback; no real checkout | Retain shared checkout authority. Adopt selected presentation through that integration rather than duplicate payment logic. |
| Crossed-out reference prices | Result client supplies `referencePrices`; shared selector renders them with `<s>` (`result-client.tsx:239-243`, `subscription-plan-selector.tsx:102-109`) | No crossed-out prices | A real presentation difference to settle in the shared pricing work; do not remove them globally as an incidental offer-component change. |
| Trial | Ordinary subscription checkout at present | Seven free days, monthly/annual, annual selected | The dedicated trial work is the integration dependency; this is not already supplied by freemium. |
| Unknown product | One category tap, review, notification in chat | Photo of packaging, result by email within 48 hours | Keep current truthful journey unless new capability is separately approved. |
| Footer | Scanner offer and inspected result wrappers do not render shared legal footer | `SiteFooter` includes legal/contact links and cookie settings | Jonas's observation is valid. Carry this into the proposed consolidated design. |
| Mobile controls | Sticky top offer link and final CTA | Sticky top CTA, bottom CTA after pricing exits viewport, WhatsApp button | Candidate controls; evaluate overlap, accessibility and checkout behavior in the chosen mockup. |
| Measurement | `OfferTrackingProvider`, package identity and existing offer-section/event contracts | Proposed new names, including replacing `offer_viewed` | Preserve canonical funnel measurement; add/change events through the central typed event contract and update section-order consumers. |

## Findings ledger and correction to the first review

| ID | Type / priority | Evidence | Disposition and action |
| --- | --- | --- | --- |
| F01 | Scope clarification | Jonas's message: reference, not intended to merge; fork path check fails as designed | **Reclassified.** Remove the earlier P1 framing as a defect to fix in #535. No need to relocate its code or weaken CI for reference use. Consolidated implementation will use an owner-controlled task. |
| F02 | Content defect / P2 | #535 `src/components/scanner-offer/scanner-offer.tsx:114,399-424`; `device-scan-example.webp` | **Accepted, fix before reuse.** Screenshot shows a fine-hair product dot against a medium-hair target; text describes a product for medium hair and a fine-haired example. Scanner semantics are explicit in current `scan-dimension-bar.tsx:8-10` and `result-presentation.ts:94-123`. Align fixture/image/profile/explanation, including retained mockup. |
| F03 | Content defect / P2 | #535 component `:97-100`; current `scan-unknown-flow.tsx:18-22,58-62`, `scan-flow.tsx:1165`; #534 offer `:427-428` | **Accepted.** Packaging-photo and email promise does not match the category-tap/chat journey. Reuse #534's truthful expectation. No live turnaround SLA verified. |
| F04 | Handover timing defect / P2 | #535 README `:49`; Stripe `customer.subscription.trial_will_end` event contract | **Accepted, trial task dependency.** Event fires three days before trial end, not at the promised day-5 point in a today/day-7 schedule. Do not wire the sentence literally. Align any required notice timing with the existing trial plan and verified provider obligations. Source: https://docs.stripe.com/api/events/types#event_types-customer.subscription.trial_will_end . |
| F05 | Missing product surface / P2 | Current `scan-regal-offer.tsx:568-588`, result layout/client; #535 uses `SiteFooter` | **Accepted for proposed design.** Shared legal footer is absent from the merged scanner offer. Add it to the eventual consolidated mockup/implementation scope. This assessment does not independently certify legal compliance. |
| F06 | Commercial conflict | #535 annual label/README says EUR 69.99/year without renewal step; trial plan rev 0.50 `:24-28` | **Follow existing confirmed trial contract unless Nick changes it:** EUR 9.99/month; EUR 69.99 first paid annual year, then EUR 99.99/year, final inclusive prices. #535's annual copy is incomplete for that contract. |
| F07 | UX/communication conflict | #535 timeline and mandatory day-5 reminder; trial plan rev 0.50 `:28,41` | **Needs reconciliation, not silent override.** Existing accepted trial design has no explanatory timeline and no optional reminder campaign, while retaining required billing notices. Treat Jonas's proposal as input, not Nick's superseding approval. |
| F08 | Eligibility/integration gap | #535 README `:43`; current `checkout-session-params.ts:62-99`; trial plan `:33-34` | **Keep with trial task.** A Stripe metadata flag alone does not implement confirmed repeat-trial prevention across account recreation, identity/payment matches and PayPal. Trialing access compatibility does not prove trial creation and complete lifecycle correctness. |
| F09 | Measurement compatibility | #535 README `:54` proposes replacing `offer_viewed`; current `OfferTrackingProvider` and funnel envelope | **Preserve existing event continuity.** Do not adopt standalone event names by copying the reference. Trial start and paid conversion must remain distinguishable. |
| F10 | Product/scope decision | #535 README `:75,78` adds automatic trial restriction below 25% annual share and no quantity limit; trial plan `:32` preserves current paid-feature limits | **Unapproved proposal.** Do not infer an automatic experiment rule or unlimited new entitlements from the reference. Confirm only if these are genuinely wanted in consolidation; otherwise omit. |
| F11 | Design asset follow-up | Latest #535 component `:428-451`, README `:61-64` | **Candidate evidence.** Steffi video added since initial review. Captions and production delivery remain documented follow-ups. No full video-content review or production player decision completed here. |

Current price caveat: #534's lab passes `StaticPricingPreview`, so it is not proof of production prices. The real result flow chooses a pricing catalog/mode; `src/lib/stripe/pricing-plans.ts` defines both standard and launch catalogs, including quarterly legacy offers. No live price catalog was queried in this assessment. Resolve new-customer terms through the trial task rather than treating the lab or old funnel brief as financial authority.

## Proposed direction for discussion, not approval

Use #534's existing route, package identity, checkout slot, provisioning and scanner continuation as the technical foundation. Preserve the existing quiz initially while we settle the post-quiz offer. Consider #535's clearer result explanation, customer proof, legal footer and mobile CTA behavior. Prefer a compact personalized introduction so the scanner value appears early; avoid simply concatenating both long pages. Keep payment and eligibility behavior under the existing trial plan.

This is a recommendation from implementation evidence, not conversion evidence. No experiment establishes which layout performs best.

## Decision coverage

Status: **pending**.

- **Confirmed with Nick in this task:** document findings, compare #534 and #535, and discuss consolidation; Jonas's message clarifies #535 is a reference. No application implementation or sending a reply to Jonas requested.
- **Inherited from current evidence:** #534 already owns the post-quiz offer; #536 marks its package active; no real visitor product is submitted in either quiz; existing shared checkout, attribution and partner/test semantics must be preserved. Existing trial plan records Nick's commercial/UX decisions; this task has not superseded them.
- **Implementation defaults:** a dedicated documentation worktree; pin compared revisions; keep references and findings in one file.
- **Open consequential choices:** first-screen hierarchy; extent of quiz changes; fixed vs answer-aware example; proof/video placement and mobile controls; conflict with Jonas's trial timeline/reminder/renewal/limits proposals; rollout and measurement design. All affected implementation remains pending. These are not silently parked with Nick's approval.
- **First question sent:** scanner value first with compact profile (recommended), or full profile/diagnosis first?
- **Original acknowledgement:** Nick's 13 September message requested documentation and consolidation discussion. It does not establish a selected layout or journey sign-off.
- **Internal revalidation:** current main, latest #535 delta, and trial plan rev 0.50 inspected on 13 September. No older approval has been expanded to cover this document.

Next discussion: settle the first-screen hierarchy, then inspect current rendered surfaces and create a reviewable consolidated mockup. Continue one consequential question at a time. Only then write the chosen implementation plan, run its counterpart review and obtain the final designed-journey sign-off. No new counterpart implementation-plan review is required for this comparison-only receipt.

## Verification and artifact disposition

Read current callers, offer implementations, source-controlled activation, #535's delta, relevant product behavior and current trial decisions. A bounded read-only agent independently mapped the paid/freemium routes. The original #535 review's focused mapping/access checks and image inspection remain usable for unchanged content; its reviewed hash is not misrepresented as the latest head. No full new branch review, application test suite, provider query, deployment or charge was performed in this comparison. The subsequent static preview was browser-checked as described below.

Retain this document in `codex/scanner-funnel-consolidation` for the planning discussion; it is uncommitted and unpublished. No app code or configuration changed. Existing trial-task artifacts remain owned by that task. No memory update or message to Jonas was sent.


## Side-by-side visual evidence — 13 September follow-up

Nick requested a comparison preview before selecting elements. [Open the preview](preview/index.html); [source and adapter notes](preview/README.md). This shows actual source-rendered offer components and the differing quiz examples, with focused views for all comparison areas. It also separates current pricing from the trial-plan proposals. Both columns remain independently scrollable.

Browser checks covered the opening, pricing switches, quiz controls, scanner media, mobile CTA positioning and legal footer. The original images and 29.6-second customer video loaded. This is comparison evidence, not a proposed consolidated mockup or approval of any of its copy. The hierarchy question remains pending while Nick reviews the alternatives.


## Current refinement decisions

The subsequent visual decisions are maintained in [refinement-plan.md](refinement-plan.md). That record supersedes the earlier open hierarchy question and landing recommendation here. This document and its original comparison preview remain historical source evidence.
