# Organic offer media A/B test

## Outcome and source context

Create a planning-approved A/B test for the regular organic quiz result offer. The current
`organic-plan-v1` experience remains the video control. A new treatment keeps the entire offer page
unchanged except that the video-specific instruction and Wistia media block are replaced by the
existing symbolic before/after figure.

Source context:

- Current hero and video seam: `src/components/organic-plan-offer/organic-plan-offer.tsx`
- Current isolated Wistia player: `src/components/organic-plan-offer/wistia-video.tsx`
- Existing before/after figure: `src/components/personal-plan-offer/personal-plan-offer.tsx`
- Existing asset: `public/images/funnels/personal-plan-offer/before-after-generic.webp`
- Sticky assignment precedent: `src/lib/funnel/personal-plan-pricing-experiment.ts` and
  `src/lib/funnel/server.ts`
- Attribution contract: `docs/funnel-attribution.md` and `docs/analytics/offer-page-tracking.md`

## Chosen direction

Use one coherent same-package, server-assigned experiment:

- experiment ID: `organic_offer_media_v1`
- revision: `1`
- eligible package: `default_organic`
- control arm: `organic-plan-v1`
- treatment arm: `organic-plan-before-after-v1`
- allocation: deterministic 50/50 from experiment ID, revision, and funnel session ID
- activation flag: `ORGANIC_OFFER_MEDIA_EXPERIMENT_ENABLED`, default off
- assignment authority: `funnel_sessions.offer_variant`, persisted before the first
  `offer_viewed`
- failure or missing-session fallback: `organic-plan-v1`

The treatment reuses the shared organic offer implementation with a typed hero-media choice; it does
not copy the complete page. The image treatment removes `Schau dir zuerst das Video an:` and places
the existing `Heute` / `Dein Ziel` split figure directly below the personalized profile line. It
retains `Symbolbild · Ergebnisse sind individuell`, uses the same 720 px media width as the video,
and does not introduce a new transformation claim.

Both arms retain `offer_revision=organic_plan_v3`. The experiment arm is represented by
`offer_variant`; no tracked section is added, removed, renamed, or reordered.

## Scope and non-goals

In scope:

- shared hero-media composition for the organic offer;
- one new registered offer variant and Lab preview;
- sticky server-side assignment with safe rollout and rollback;
- experiment-specific automated, browser, and analytics coverage;
- a PostHog experiment readout with raw counts and rates.

Must remain unchanged:

- organic landing, quiz questions, result profile line, sticky header, CTA labels, section order,
  pricing slot, checkout overlay, plan IDs, Stripe, PayPal, billing fulfillment, Customer.io and Meta
  semantics;
- `default_organic` as the canonical package and `organic-plan-v1` as the historical control;
- one rendering of the supplied pricing slot in each arm;
- existing Wistia loading and recovery behavior in the control.

Non-goals:

- a new route or second funnel package;
- pricing, membership, one-time-payment or payment-provider experiments;
- Wistia play/progress/completion instrumentation;
- replacing or regenerating the approved before/after asset;
- a broader offer-page redesign or copy test;
- production activation, deployment, merge or experiment winner selection.

No database schema migration is expected. The existing text `offer_variant` snapshot and purchase
attribution path are sufficient.

## Target map

- `src/components/organic-plan-offer/organic-plan-offer.tsx`
  - accept the internal typed hero-media selection and render either the current video block or the
    treatment figure;
  - keep `OfferTrackingProvider` supplied with the actual assigned `offerVariant`.
- `src/components/personal-plan-offer/personal-plan-offer.tsx` and a new shared offer-media component
  - extract/adapt the current private `BeforeAfterFigure` without changing the Personal Plan visual;
  - separate common figure styling from Personal Plan short-viewport grid placement.
- `src/funnels/offers/organic-plan-v1.tsx`
  - explicitly select the video control.
- `src/funnels/offers/organic-plan-before-after-v1.tsx`
  - select the before/after treatment while preserving the supplied pricing slot.
- `src/funnels/offers/registry.generated.ts`
  - regenerate with `npm run funnel:check -- --write`; never hand-edit.
- `src/lib/funnel/organic-offer-media-experiment.ts`
  - own stable experiment constants, arm types, eligibility and deterministic assignment.
- `src/lib/funnel/flags.ts`
  - add the default-off server activation flag.
- `src/lib/funnel/server.ts`
  - persist/read back the arm with compare-and-set protection before first offer view;
  - preserve already-viewed arms across reloads and rollback;
  - capture sanitized persistence failures through the existing experiment observability boundary.
- `src/app/result/[leadId]/page.tsx`
  - replace only the no-access organic fallback at the current
    `resolveLegacyResultOfferVariant(funnelContext)` branch with the organic experiment resolver;
  - keep `hasAccess ? "organic-plan-v1"` unchanged and resolve the treatment before
    `recordLeadOfferView`;
  - reuse the existing session shape: session ID, package key, stored offer variant, offer-view time,
    checkout-start time and internal-test status.
- `src/app/labs/offer-page/page.tsx`
  - expose both arms without production assignment or analytics writes.
- `scripts/analytics/` and `scripts/posthog/`
  - define and install the experiment readout without changing the Personal Plan dashboards.
- `docs/analytics/offer-page-tracking.md`
  - record arm authority, eligibility, KPI, exclusions, rollback and interpretation rules.
- focused tests under `tests/`
  - add rendering, assignment, rollback, tracking, registry, section-order and dashboard-contract
    coverage;
  - assert the treatment already uses the organic section order through the existing default branch;
    do not change `src/lib/analytics/offer-section-order.ts` unless implementation evidence disproves
    that current behavior.

## Designed user journey

Evidence review: **confirmed by Nick on 2026-08-31**

User-journey sign-off: **confirmed by Nick on 2026-08-31**

1. A visitor enters the normal organic funnel and completes the existing regular quiz.
2. Before the first offer view, an eligible attributed funnel session is assigned once to the video
   control or before/after treatment. The user does not choose or see the assignment.
3. Both users see the same sticky `chaarlie` header, `Angebot ansehen` CTA, analysis-ready label,
   `Dein Haarplan ist bereit.` heading and personalized hair-profile line.
4. The control sees `Schau dir zuerst das Video an:` and the current muted-autoplay Wistia player,
   including its existing load-failure recovery.
5. The treatment instead sees the `Heute` / `Dein Ziel` image card, centered at the same maximum
   media width, with an arrow and `Symbolbild · Ergebnisse sind individuell`. It has no extra
   transformation claim and does not load Wistia scripts.
6. Both continue into the unchanged `Deine Ausgangslage` section and the identical remainder of the
   offer, including the same pricing and checkout experience.
7. Reloading or reopening a saved result preserves the viewed arm. If assignment is unavailable or
   persistence fails, the user receives the video control. Disabling the experiment sends new or
   safely unviewed sessions to the control while preserving an arm already exposed to a user.
8. Completing checkout attributes the purchase to the same durable funnel session and assigned
   offer arm. Nothing about payment or access fulfillment differs between arms.

Meaningful variants:

- desktop and mobile keep the same content order; the treatment uses two adjacent image halves at
  both widths;
- the treatment static image has no loading or interaction state beyond normal local asset loading;
- regular field-test/moderator surfaces retain their existing access CTA semantics and are not part
  of the production experiment cohort. They remain on the video control because their
  `Kostenlos fortfahren` activation journey is not comparable to paid offer conversion.

Completion state: the user either continues through the unchanged offer and checkout, leaves, or
returns later to the same assigned presentation.

## Planning evidence

- Mockup: `plans/mockups/2026-08-31-organic-offer-before-after-hero.html`
- Desktop capture: `plans/mockups/2026-08-31-organic-offer-before-after-hero-desktop.jpg`
- Mobile capture: `plans/mockups/2026-08-31-organic-offer-before-after-hero-mobile.jpg`
- Question answered: how the existing split-image component fits the current organic hero when the
  video instruction and player are removed.
- Recommended direction: direct image placement with no new intermediate headline or claim.
- Feedback incorporated: Nick confirmed the shown direct-image, full-portrait treatment without
  requesting copy, crop, label, spacing or disclaimer changes.
- Evidence source: recreated from the exact current JSX/CSS tokens and existing 1200 x 900 asset.
  The in-app Browser backend was unavailable during planning, so this is a deterministic rendered
  HTML artifact rather than a live Lab capture. Implementation must revalidate the real Lab in
  Chromium and WebKit before review-ready handoff.
- Evidence review status: **confirmed by Nick on 2026-08-31**.

The artifact is durable decision evidence and should be committed with the eventual implementation
PR. It is not production code or implementation authorization.

## Ordered tasks

### 1. Add the shared hero-media treatment and preview

Consumes:

- approved mockup and hero-copy decision;
- current `OrganicPlanOffer` props and supplied `pricingSlot` contract;
- current private `BeforeAfterFigure` and approved image asset.

Work:

- extract a reusable before/after figure with layout-specific class hooks;
- render the current Personal Plan figure through it without visual regression, with tests pinning
  its current short-viewport placement and aspect-ratio classes;
- add a typed `video | before_after` composition to the organic offer;
- add the thin treatment wrapper, regenerate the offer registry with
  `npm run funnel:check -- --write` and add an explicit Lab selector;
- preserve the control exactly, including Wistia scripts and fallback;
- ensure treatment markup contains the local figure and no Wistia player or scripts.

Tests:

- update `tests/organic-funnel-surface.test.tsx` to assert both arms, their media exclusivity, the
  treatment disclaimer and exactly one pricing slot;
- update `tests/personal-plan-offer-page.test.tsx` to guard the extracted figure's existing output;
- update `tests/funnel-variants.test.ts` and Lab source-contract coverage for the new registered arm.

Completion criterion: both Lab variants render the approved desktop/mobile hierarchy; the control is
unchanged; the treatment differs only in the hero-media block; each renders pricing exactly once.

Produces:

- registered renderable treatment `organic-plan-before-after-v1`;
- safe arm-selectable Lab fixtures for later browser verification.

### 2. Assign and preserve the experiment arm

Consumes:

- the registered control and treatment IDs from Task 1;
- existing funnel session, compare-and-set and observability seams.

Work:

- add the experiment constants and deterministic session-ID assignment;
- add the default-off flag;
- implement a package-scoped resolver that assigns only eligible `default_organic` sessions before
  `offer_viewed`, reads back concurrent winners and fails closed to the control;
- exclude organic moderator, regular field-test and unavailable field-test states from assignment and
  force the video control; keep the existing authenticated-access branch hardcoded to the control;
- preserve viewed assignments; safely reset only unviewed treatment assignments when the flag is
  off;
- replace only the no-access organic `resolveLegacyResultOfferVariant(funnelContext)` call with the
  experiment resolver, using the same six-field session projection as the Personal Plan resolver,
  before trusted offer-view recording;
- reuse the existing shared Sentry fingerprint and distinguish organic failures by the existing
  `offer_experiment.id` tag rather than creating new observability infrastructure;
- do not expose a user-selectable production query override.

Tests:

- add a focused experiment suite covering stable 50/50 assignment, package eligibility, no-session
  fallback, flag-off behavior, compare-and-set race/readback, persistence failure, viewed-arm
  preservation, unviewed rollback, authenticated-access control and field-test/moderator exclusion;
- extend result-route ordering and offer-presentation compatibility tests;
- verify sanitized Sentry payloads contain no lead, visitor, session, name, email or quiz-answer data.

Completion criterion: one eligible funnel session can contribute to only one arm; failures and
rollback cannot flip an already exposed visitor or block the offer.

Produces:

- durable `offer_variant` arm authority consumed by rendering, browser analytics and purchase
  attribution.

### 3. Add the experiment readout and operating contract

Consumes:

- durable arm identities and existing funnel event/purchase attribution.

Work:

- add a PostHog insight/dashboard installer scoped to `default_organic` and the two exact arms;
- define eligibility from the first valid `offer_viewed` with non-empty `funnel_session_id`;
- require exactly one arm per session and exclude internal/test traffic when marked;
- show raw offer views, pricing reach, checkout opens, purchases and purchase rate by arm;
- add a sample-ratio/mixed-arm quality check and document minimum sample/uncertainty interpretation;
- keep Meta event names and campaign optimization semantics identical across arms;
- update the analytics runbook with activation, rollback and winner-selection boundaries.

This readout ships with the default-off implementation rather than being deferred to activation. An
A/B-test branch is not activation-ready without its denominator, outcome and data-quality checks,
even though installing or activating production PostHog assets remains separately authorized.

Tests:

- add source-contract tests for arm filters, package scope, unique-session denominators, purchase join,
  internal-test exclusion, mixed-arm rejection and raw-count presentation.

Completion criterion: an operator can distinguish valid exposure, data-quality failures and
conversion outcomes without treating checkout initialization or small samples as purchases.

Produces:

- reviewable organic offer-media experiment dashboard and documented readout contract.

### 4. Verify the complete flow and prepare activation handoff

Consumes:

- Tasks 1-3 and explicit evidence/journey approval.

Work:

- run repository checks and focused suites;
- inspect both Lab arms at 320 px, 390 px and desktop in Chromium and WebKit;
- verify figure crop, labels, arrow, disclaimer, no horizontal overflow, next-section transition,
  sticky CTA and reduced-motion neutrality;
- verify the control still autoplays muted where browser policy permits and retains native
  click-for-sound/failure recovery;
- verify treatment does not request Wistia resources;
- exercise deterministic assignment/reload/return behavior in a non-production environment;
- verify shared pricing and checkout rendering without changing or reauthorizing payment behavior;
- prepare a default-off deployment receipt and activation/rollback checklist.

Automated checks:

- `npm run funnel:check`
- `npm run funnel:check -- --write` is the implementation-time registry regeneration step and must
  leave the subsequent check clean
- focused node suites from Tasks 1-3
- `npm run test:node`
- `npm run ci:verify` using the existing worktree environment

Completion criterion: the branch is review-ready with both visual arms, sticky attribution,
dashboard proof and default-off rollout verified; production activation remains a separate explicit
authorization.

Produces:

- implementation-loop review-ready handoff, screenshots and verification receipt.

## Verification

Automated:

- deterministic assignment, eligibility, race, rollback and fail-closed unit tests;
- registry, renderer, one-pricing-slot, section-order, tracking and observability tests;
- dashboard query/source contract tests;
- complete node, lint, typecheck and production build gates.

Manual/browser:

- current/proposed hero comparison in the real Lab after implementation;
- treatment desktop, 390 px and 320 px screenshots;
- Chromium and WebKit layout/overflow checks;
- image semantics and disclaimer accessible to assistive technology;
- control-only Wistia requests and treatment absence of Wistia requests;
- sticky assignment across reload and saved-result return.

Migration/live state:

- no database migration or production data write expected;
- before activation, verify the production flag state, exact deployed commit, registered arms and
  dashboard availability;
- activation and later winner selection require separate explicit approval;
- after activation, check sample ratio, missing arm/session identity and mixed-arm sessions before
  reading conversion differences.

Evidence-sensitive review:

- Nick reviewed and approved the retained HTML direction and desktop/mobile captures on 2026-08-31;
- the selected treatment is direct image plus full portrait, with no requested copy, crop, label,
  spacing or disclaimer correction;
- Nick explicitly confirmed the designed journey and authorized implementation on 2026-08-31;
- one read-only Claude Opus 4.8 plan review ran at high effort on 2026-08-31; its material findings are
  classified below and its transient report remains outside the repository.

## Counterpart findings ledger

| ID   | Type                   | Evidence                                                                                                                     | Decision | Plan change                                                                                                                                                      | Revalidation                                                                         |
| ---- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| CP-1 | defect                 | The organic result branch has separate `hasAccess` control and no-access legacy fallback paths before `recordLeadOfferView`. | accepted | Name the exact no-access call site, preserve the access branch and reuse the existing six-field session projection.                                              | Verified in `src/app/result/[leadId]/page.tsx`; plan Tasks 2 and target map updated. |
| CP-2 | defect                 | `npm run funnel:check` validates but does not regenerate a stale registry.                                                   | accepted | Name `npm run funnel:check -- --write` in Task 1 and verification.                                                                                               | Verified against `scripts/funnels/new-package.mjs`; plan updated.                    |
| CP-3 | tradeoff               | Non-Personal-Plan variants already fall through to `ORGANIC_PLAN_SECTION_ORDER`.                                             | accepted | Remove the proposed production edit and add treatment coverage only.                                                                                             | Verified in `src/lib/analytics/offer-section-order.ts`; target map updated.          |
| CP-4 | scope/product decision | Moderator and regular field-test users have a free activation CTA rather than paid checkout.                                 | accepted | Exclude them from assignment and force the video control.                                                                                                        | Confirmed by Nick with the final designed-journey sign-off.                          |
| CP-5 | tradeoff               | The dashboard can ship with implementation or be deferred until activation.                                                  | accepted | Keep the readout in the implementation plan because measurement readiness is part of a valid A/B-test handoff; production installation remains separately gated. | Scope and Task 3 updated; no new architecture introduced.                            |
| CP-6 | tradeoff               | Organic and pricing assignment failures share one Sentry fingerprint and differ by experiment tags.                          | accepted | Reuse the existing observability boundary and document tag-based distinction.                                                                                    | Verified in `src/lib/observability/offer-experiment.ts`; Task 2 updated.             |

## Review and handoff

- Worktree: `.worktrees/offer-media-ab-test`
- Branch: `codex/offer-media-ab-test`
- Evidence review: **confirmed on 2026-08-31**
- User-journey sign-off: **confirmed on 2026-08-31**
- Counterpart plan review: **complete — approve with revisions; verified revisions incorporated**
- Implementation authorization: **granted on 2026-08-31**
- Publication, merge, deployment and activation: **out of scope and separately gated**

Artifact disposition:

- commit with eventual implementation PR: this plan, HTML mockup and selected desktop/mobile
  captures;
- discard after reconciliation: transient Claude review output and temporary screenshot tooling;
- archive: none currently.

Residual risks:

- the treatment figure is taller than the 16:9 video and moves the diagnosis section lower; Nick
  accepted this in the planning mockup, while implementation browser review must still catch any
  unexpected clipping or disproportionate spacing;
- a static symbolic transformation can be interpreted more literally than intended despite the
  approved disclaimer; retain the exact confirmed trust framing during implementation;
- in-app Browser was unavailable during planning, so live Lab parity remains an implementation gate;
- low experiment volume can produce misleading conversion differences; raw counts and uncertainty
  are mandatory.

Implementation may now proceed through the local review-ready handoff. Stop before commit, push,
PR creation, merge, deployment, production dashboard installation or experiment activation unless
separately authorized.
