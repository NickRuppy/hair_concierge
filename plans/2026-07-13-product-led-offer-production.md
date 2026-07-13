# Product-led Post-Quiz Offer — Production Implementation Plan

Status: Implementation complete and locally verified; Nick/Jonas visual review pending. Claude review unavailable due account limit, with failed output retained.

## Goal

Replace the current default post-quiz paid offer with the Product-led concept from
`.tmp-previews/offer-page-concepts/product-led.html`, implemented as production React code in the
existing `codex/offer-page-concepts` worktree. The branch is the release boundary: review locally
with Jonas, make small copy/order adjustments there, and merge only after approval and verification.

The finished page should make three things clear before pricing:

1. what Chaarlie already learned from the quiz;
2. what a plausible care structure and example products look like;
3. what the subscriber receives immediately and over time.

## Settled product decisions

- Replace the default offer on this feature branch; do not add a runtime feature flag or dormant
  production variant.
- Keep the current monthly, quarterly, and yearly plans, the quarterly default, and the existing
  Stripe/PayPal embedded checkout behavior.
- Remove the artificial countdown and unsupported expiring-offer framing.
- Use quiz-only data for a useful preview, but do not claim the pre-purchase products are the final
  recommendations.
- Show the shampoo and conditioner examples in full. Continue computing at most one optional third
  category and its named product, but reveal only the category title before purchase; keep its
  product, image, explanation, and frequency locked. Follow that computed locked card with two
  fully obscured, non-semantic routine-card placeholders to signal that the paid routine can contain
  further steps without inventing two additional quiz-only recommendations.
- Derive the free result and offer preview from one shared quiz-need lane so their recommended
  categories cannot disagree.
- Do not add a generic scalp-serum preview. Scalp conditions are handled through the shampoo route;
  one serum cannot safely stand in for dandruff, dry flakes, and irritation.
- Do not show dry shampoo from quiz data alone. The production engine requires an explicit
  between-wash/emergency bridge need and records `dry_shampoo_oily_scalp_alone_not_enough`; the quiz
  does not collect that context. Chaarlie may recommend it later after clarification.
- Label named products as examples. After purchase, Chaarlie still evaluates the products the user
  owns and finalizes products, alternatives, order, and application.
- Use a deterministic local selector. There is no LLM call, live catalog query, or recommendation
  API call in the offer-page render path.
- Maintain a curated, coverage-driven micro-catalog. Repository review proved that 27 modules are
  needed for truthful current coverage; reducing to roughly 20 would force known shampoo or
  conditioner fit gaps.
- Use actual product screenshots for the product demonstration section. The static HTML mockup's
  reconstructed UI panels are composition references, not production assets.
- Keep testimonial content data-driven. Until approved beta quotes are supplied, render no fake
  quotation as customer proof in the production page.

## Explicit non-goals

- No free trial, one-time purchase, price change, coupon, or plan-count experiment.
- No rewrite of Stripe, PayPal, subscription activation, or post-checkout onboarding.
- No full pre-purchase routine builder and no evaluation of the user's current products.
- No changes to the paid `/routine` CareBalance logic, post-paywall category selection, or
  suggestion-to-chat handoff. That alignment work is tracked in a separate task.
- No promise that the quiz-only preview will reproduce the final paid routine one-for-one. Named
  products are clearly labeled examples; the paid product finalizes the routine with the user.
- No call into the full catalog recommendation engine from the anonymous offer page.
- No LLM-generated headline, explanation, product choice, or frequency.
- No arbitrary numeric hair score.
- No attempt to ship all brainstormed Personal-value, Trust-led, or Hybrid concepts.
- No deletion of the local comparison mockups before the Jonas review is complete.

## Source context

### Visual source

- `.tmp-previews/offer-page-concepts/product-led.html`
- `.tmp-previews/offer-page-concepts/styles.css`
- `.tmp-previews/offer-page-concepts/concepts.js`

### Existing production flow to preserve

- `src/components/quiz/quiz-result-offer-page.tsx`
- `src/components/quiz/result-offer-pricing.tsx`
- `src/components/checkout/payment-method-checkout.tsx`
- `src/lib/stripe/pricing-plans.ts`
- `src/components/quiz/quiz-results.tsx`
- `src/app/result/[leadId]/page.tsx`
- `src/app/result/[leadId]/result-client.tsx`
- `src/funnels/offers/default.tsx`
- `src/funnels/types.ts`

The offer must continue to work in both entry paths:

- immediately after an anonymous user completes the quiz;
- from `/result/[leadId]`, including `?focus=unlock-plan` email links.

Authenticated users with current access must continue to bypass the paid offer.

## Offer preview domain model

Create a pure quiz-preview layer under `src/lib/quiz/`. It receives normalized `QuizAnswers` and
returns display-ready, fully validated data. It must not know about React, Supabase, Stripe, or the
full onboarding profile.

Suggested files:

- `src/lib/quiz/need-lane.ts` — shared primary-concern/goal resolution and category lane consumed by
  both the result narrative and offer preview.
- `src/lib/quiz/offer-preview.ts` — derive needs, frequency labels, copy fragments, and select modules.
- `src/lib/quiz/offer-preview-products.ts` — curated module registry and product metadata.
- `src/lib/quiz/offer-preview-types.ts` — only if the types make the main builder materially easier
  to read; otherwise keep them beside the builder.

### Derived need profile

```ts
type OfferPreviewNeedProfile = {
  shampoo: {
    scalpRoute: "balanced" | "oily" | "dry" | "dandruff" | "irritated"
    thickness: "fine" | "normal" | "coarse"
    cleansingIntensity: "gentle" | "regular"
    cadence: OfferPreviewCadence
  }
  conditioner: {
    weight: "light" | "medium" | "rich"
    balance: "protein" | "moisture" | "balanced"
    repairLevel: "low" | "medium" | "high"
    volumeBias: "lighter" | "neutral" | "smoother"
    cadence: OfferPreviewCadence
  }
  extra:
    | { category: "protein_mask" | "moisture_mask" | "leave_in" | "oil" | "bondbuilder"; cadence: OfferPreviewCadence }
    | null
}
```

Use the canonical vocabulary already present in the repo. Reuse `deriveShampooBucket` and extract a
small shared thickness/density-to-weight helper if that avoids duplicating the current conditioner
weight table. Do not construct a fake full `NormalizedProfile` merely to call the production engine.

### Shampoo derivation

Priority:

1. scalp condition overrides scalp type for dandruff, irritation, and dry flakes;
2. scalp type resolves balanced, oily, or dry when there is no overriding condition;
3. thickness is a compatibility axis for the example product;
4. cleansing intensity follows the canonical route (`gentle` for dry/irritated, otherwise
   `regular`, unless the selected module is explicitly a safe close match).
5. Colored/bleached treatment and the `color_protection` goal must not filter product modules or
   produce a Farbschutz/product-suitability claim. The current paid recommendation path does not have
   sufficiently broad structured color-safety data. The quiz may acknowledge Farbschutz as a user
   goal only in neutral transition copy that promises Chaarlie will clarify it later.

Coverage contract: all 5 scalp routes × 3 thicknesses must resolve to a selected module with no
known hard mismatch. The persisted `/result/[leadId]` route keeps its existing required-field
validation. Neutral fallbacks exist only for optional fields and direct component/test calls; this
plan does not broaden the historical-lead route schema.

### Conditioner derivation

- Weight comes from thickness and density using the same light/medium/rich table as the production
  recommendation engine.
- Balance comes from the normalized pull-test signal and resolves to protein, moisture, or balanced.
- Repair level reuses the quiz-care proxy defined below: `high` for either bond-builder eligibility
  lane; `medium` for chemical stress or any single direct damage/test signal; otherwise `low`.
  Repair goals may support the displayed rationale but must not raise repair level by themselves.
- `volume` biases toward the lighter compatible module and `less_volume` toward the smoother/richer
  compatible module. These are tie-breakers inside the hard thickness/density compatibility band,
  not permission to choose a mismatched weight.
- Colored/bleached treatment and `color_protection` do not change conditioner module eligibility and
  must not produce a verified Farbschutz claim in the preview.
- Conditioner cadence follows the shampoo/wash cadence; it is not independently invented.

Hair structure does not select a shampoo, third category, or named leave-in example by itself. A
resolved `curl_definition` goal chooses the curl-definition leave-in subtype when the shared lane
resolves to leave-in. Hair length affects dosage and application copy only; it must not change
category or product fit.

Coverage contract: every valid 3 thickness × 3 balance × 3 repair combination must resolve to a
selected module without crossing the recorded thickness or balance axes. Weight and repair strength
rank compatible candidates but are not presented as verified fit claims when the catalog only
supports the neighboring strength. A module may cover several combinations. Missing
optional inputs and typed direct-call gaps use a neutral fallback and omit unsupported rationale
fragments; required result-route inputs remain required.

### Optional third-category routing

Extract the existing concern scoring and concern-aware goal ordering from `result-narrative.ts` into
one pure shared lane resolver. The result narrative and offer preview must consume the same resolved
primary concern, primary goal, and `QuizNeedLane`; neither surface may maintain a parallel category
priority tree.

This is a merchandising proxy from fields the anonymous quiz actually observes, not a diagnosis
and not a replacement for the full post-purchase assessment.

```ts
type QuizCareProxy = {
  chemicalStress: "none" | "moderate" | "high"
  damageConcernSignals: Set<"hair_damage" | "breakage" | "dryness" | "split_ends">
  structuralTestSignals: Set<"rough_surface" | "overstretches" | "snaps">
  repairIntentSignals: Set<"anti_breakage" | "strengthen" | "healthier_hair">
  moistureIntentSignals: Set<"moisture">
}

type QuizNeedLane =
  | "scalp_focus"
  | "bond_repair"
  | "protein"
  | "deep_moisture"
  | "surface_support"
  | "ends_protection"
  | "base"
```

- `high` chemical stress means `blondiert`; `moderate` means `gefaerbt`, `dauerwelle`, or
  `chemisch_geglaettet`; `none` means `natur`.
- Damage concerns come only from the normalized concern set.
- Structural test signals come from `fingertest=rau`, `pulltest=stretches_stays`, and
  `pulltest=snaps` respectively.
- Goals are supporting intent signals. A goal alone must not be presented as proof of damage.
- Free-text `concerns_other_text` is retained for the subscriber journey but never parsed into a
  pre-purchase category. With no supported structured signal, render no third card and explain that
  Chaarlie will clarify the individual concern after purchase.

Apply this deterministic lane precedence:

1. **Scalp focus, no extra:** if `healthy_scalp` is the resolved goal, or there is no resolved length
   concern and the quiz reports dandruff, dry flakes, irritation, or dry scalp, resolve
   `scalp_focus`. The shampoo card carries the scalp recommendation; do not show a generic serum.
2. **Bond repair → bond-builder:**
   - high chemical stress plus resolved `hair_damage`, `breakage`, `dryness`, or `split_ends`;
   - moderate chemical stress plus resolved `hair_damage` or `breakage`;
   - moderate chemical stress plus resolved `dryness` or `split_ends` and either rough surface or an
     abnormal pull test;
   - natural hair plus resolved `hair_damage` or `breakage`, rough surface, and an abnormal pull
     test.
   Treatment alone never qualifies.
3. **Protein → protein mask:** `pulltest=stretches_stays` plus resolved `hair_damage`/`breakage` or a
   repair-intent goal. The pull test alone does not qualify.
4. **Deep moisture → moisture mask:** `pulltest=snaps` plus resolved `dryness` or the `moisture`
   goal. Snapping alone does not qualify.
5. **Surface support → leave-in:** resolved `dryness`, `frizz`, or `tangling`, or resolved
   `moisture`, `less_frizz`, or `curl_definition` goal. Only the explicit `curl_definition` goal
   chooses the curl-definition leave-in copy and module; texture alone does not assert that product
   fit.
6. **Ends protection → oil:** resolved `split_ends`, `shine`, or `less_split_ends`.
7. **Base:** no sufficiently specific signal → no third card. Oily scalp alone remains in this lane
   after the shampoo card has handled the scalp route; it is not enough to infer a dry-shampoo need.

Each optional category has one approved default module. Protein and moisture masks remain separate
because they represent materially different needs.

Add table-driven fixtures for every treatment, concern, pull-test, surface, scalp, and relevant goal
value plus overlapping signals. The fixtures must prove that treatment and pull tests alone do not
over-trigger repair/masks, colored-only hair does not reach bond repair, the full browser-review Lea
fixture resolves to `surface_support`/leave-in, oily scalp alone does not produce dry shampoo, and
every combination returns exactly one lane and at most one optional category.

### Result/offer consistency corrections

- Refactor `buildHeroHeadline` and `buildNeedsSection` in `result-narrative.ts` to consume the shared
  lane. Color treatment alone must stop producing Bondbuilder + Stärkende Maske.
- The free result's named need categories and the offer's optional third category must agree. The
  offer may additionally show its always-present shampoo and conditioner foundation, but it must
  not introduce a conflicting extra.
- For balanced-pull dryness/frizz, keep the result's Conditioner + Leave-in logic and show leave-in
  as the offer's third card. Reserve moisture mask for corroborated `deep_moisture`.
- For dandruff, dry flakes, or irritation, keep the result focused on a condition-aware shampoo and
  compatible conditioner; remove the generic scalp-serum promise.
- Replace the unsupported `In 4 Wochen` transformation label with non-numeric potential wording
  such as `Mit passender Routine`; do not carry a precise timeline into the new offer.

### Cadence rules

Cadence is a deterministic display suggestion, not a statement about current behavior.

- Shampoo: extract/reuse the canonical base scalp-to-target resolver from
  `src/lib/recommendation-engine/shampoo-cadence.ts`, without the routine-dependent modifiers the
  quiz cannot know. Display its preferred value as a quiz-only starting point, never as the user's
  current frequency.
- Conditioner: after every shampoo wash / same weekly cadence as shampoo.
- Protein or moisture mask: every 2–3 washes unless the selected module has a stricter approved
  instruction.
- Leave-in: after each wash.
- Oil: as needed for lengths/ends; do not force a weekly number.
- Bond-builder: follow the selected product's protocol; do not invent a universal cadence.

Put the exact German labels in one small typed map and cover them with tests. Any medically adjacent
scalp-condition cadence must remain conservative and must not imply treatment.

## Curated product-module registry

Use 27 modules, coverage-driven rather than count-driven. Repository truth supports:

- 12 shampoo modules for the populated scalp-route × thickness cells;
- 9 conditioner modules for thickness × protein/moisture/balanced cells;
- 6 optional modules: protein mask, moisture mask, general leave-in, curl-definition leave-in, oil,
  and bond-builder.

The checked-in shampoo matrix has no coarse + oily product cell. That one combination keeps a named
product visible only as a neutral, explicitly provisional example and removes the unsupported fit
claim; Chaarlie finalizes it after purchase.

Each module stores stable, reviewable data:

```ts
type OfferPreviewProductModule = {
  key: string
  catalogProductId: string
  category: "shampoo" | "conditioner" | "protein_mask" | "moisture_mask" | "leave_in" | "oil" | "bondbuilder"
  name: string
  imageUrl: string
  priority: number
  shampooFit?: {
    scalpRoutes: ScalpRoute[]
    thicknesses: HairThickness[]
    cleansingIntensity: CleansingIntensity
  }
  conditionerFit?: {
    weights: CareWeight[]
    balances: CareBalance[]
    repairLevels: RepairLevel[]
  }
  approvedCopy: {
    categoryLabel: string
    productNote: string
  }
}
```

Product identity and image URL must be copied from the checked-in catalog snapshot or an
implementation-time verified catalog export. Every selected record must have matching category,
`is_active=true`, `lifecycle_status=active`, and a usable image. Fit fields must come from current
structured product-spec rows or a small explicit manual-review artifact with review provenance. Do
not infer fit from product names or marketing copy. `cleansing_intensity` already exists in
`product_shampoo_specs` and the production selection path, but it must still be exported/verified
for each curated module. Keep tie-break priority explicit so identical quiz answers always return
the same preview.

### Selection algorithm

1. Filter to the requested category.
2. Classify every axis as hard, soft, or unknown before assigning weights. Reject every known hard
   mismatch, including thickness-incompatible shampoo and opposing conditioner thickness/balance
   values. Conditioner weight and repair strength are ranking axes because the verified local
   product grid is keyed by thickness and balance; unsupported strength claims must be omitted.
   Color safety is not a preview fit axis. Unknown neutral fallbacks may
   remain only when they omit the corresponding fit claim and no hard requirement is active.
3. Score exact and explicitly compatible matches on the remaining soft axes using named constants.
4. Sort by score, then stable priority, then key.
5. Return exactly one module and the matched rationale fragments.

The scorer operates over an in-memory array and is synchronous. It must never silently return the
first item because coverage is missing; uncovered canonical combinations should fail tests and
throw in development. Coverage tests must call the real selector for all 15 shampoo and 27
conditioner need profiles and assert that the chosen module, not merely some registry entry, does
not cross the verified hard axes.

## Deterministic copy composition

Use approved phrase modules, not 20 complete page bundles and not generated prose.

Examples of phrase axes:

- scalp: mild cleansing, balanced cleansing, oily-scalp cleansing, condition-aware wording;
- thickness/weight: light enough for fine hair, medium care weight, richer care for coarse/dense hair;
- balance: protein, moisture, balanced;
- repair: everyday support, moderate repair, stronger repair focus;
- volume: lighter/smoother compatible tie-break wording;
- length: dosage/application guidance without changing category fit;
- optional category: why this is the one additional focus.

The builder may combine at most two or three short fragments per card. Tests should snapshot the
final German strings for representative profiles and ensure missing inputs do not produce false
claims.

## Production page structure

Implement the Product-led mockup in this order:

1. compact Chaarlie header with result status and pricing anchor CTA;
2. personalized hero explaining that the quiz is the beginning, not the product;
3. signal-to-conclusion block using observed quiz facts only;
4. care preview with full shampoo and conditioner cards, an optional third locked category card,
   and two fully obscured continuation cards beneath it;
5. clear lock/transition copy explaining what is finalized after purchase;
6. “Chaarlie in Aktion” product story using real screenshots for chat, routine, and product choice;
7. catalog/independence proof band using approved wording (`erfasst`, not undefined `geprüft`);
8. immediate-to-ongoing timeline that explains the subscription;
9. optional approved beta testimonials;
10. existing plan selection and embedded checkout;
11. FAQ covering immediate value, subscription rationale, cancellation, independence, and product
    replacement concerns;
12. final CTA back to pricing.

Keep sections as separate small components so Jonas-driven ordering or copy adjustments remain
cheap. Do not introduce a generic page-builder or config-driven CMS.

Suggested components:

- `src/components/quiz/offer-preview-routine.tsx`
- `src/components/quiz/offer-product-story.tsx`
- `src/components/quiz/offer-timeline.tsx`
- `src/components/quiz/offer-faq.tsx`
- keep `src/components/quiz/quiz-result-offer-page.tsx` as the page composer and public wrapper.

## Prop and entry-path changes

The production shell needs normalized quiz answers in addition to the existing narrative.

- Add `quizAnswers: QuizAnswers` to `FunnelOfferVariantProps`.
- Pass `quizAnswers` from `ResultPageClient` into `renderOfferVariant`.
- Pass current quiz-store `answers` into `QuizResultOfferPage` in the immediate completion path.
- Pass the answers through `DefaultOfferVariant` into `QuizResultOfferPageShell`.
- Build the preview with `useMemo` or as a cheap pure call; do not fetch.

Preserve `name`, `narrative`, `pricingSlot`, `focusRoutine`, `leadId`, analytics envelope, and
checkout callbacks. Preserve both generations of return behavior:

- `?focus=unlock-plan` scrolls to `#unlock-plan`;
- `?focus=routine` scrolls to `#pricing` and retains visible “Weiter mit deiner Routine” context.

Both anchors must account for the fixed header offset and delayed client render.

## Pricing, checkout, trust, and analytics

- Reuse `ResultOfferPricing` rather than duplicating plan or payment UI.
- Keep recurring-price, renewal, cancellation, and guarantee wording aligned with the existing
  production/legal copy. Link to terms where the current component does.
- Remove `ResultOfferCountdown` from the offer page and remove special-offer language that implies a
  real expiry.
- Keep `offer_viewed`, plan selection, `checkout_started`, Stripe, PayPal, duplicate-access handling,
  and checkout errors intact.
- Leave the current Stripe prefetch and interaction-gated checkout-session creation unchanged.
- Move only `pricing_viewed` into a separate one-shot visibility observer effect; leave
  `offer_viewed` unchanged. Clean up the observer, provide a no-`IntersectionObserver` fallback,
  preserve the existing event payload, and test “not before intersection / exactly once after”.
- Ensure CTAs use anchors and do not initialize checkout until the user chooses to start checkout.

## Screenshot and testimonial assets

- Capture sanitized authenticated product screenshots for chat, routine, and a product
  recommendation using a seeded/test profile with no personal data.
- Store optimized local assets under `public/images/offer/product-led/` with descriptive names and
  alt text.
- Verify screenshots reflect current production behavior and do not promise UI that does not exist.
- Define testimonial data separately from markup. If no approved quotes are present, omit the
  section cleanly rather than showing placeholders in production React.

## Implementation checklist

### 1. Preserve the design source

- Keep all current `.tmp-previews/offer-page-concepts/` files untouched through the Jonas review.
- Do not stage scratch mockups with production code unless the user explicitly decides to preserve
  them in `docs/mockups/`.

### 2. Build and test the preview domain model

- Extract one typed shared quiz-need lane and make both `result-narrative.ts` and the offer preview
  consume it.
- Correct the existing color-only bond-builder, uncorroborated mask, generic scalp-serum, and
  unsupported four-week result claims while preserving the rest of the result experience.
- Add typed need-profile derivation from the shared lane.
- Add curated product modules using verified catalog identities.
- Add deterministic selection and stable tie-breaking.
- Add phrase composition and cadence labels.
- Add complete canonical-coverage tests plus optional-field/direct-call fallback tests; do not
  weaken persisted result-route validation.

### 3. Plumb quiz answers through both offer entry paths

- Update funnel offer props and default wrapper.
- Update immediate quiz completion and result-link paths.
- Preserve subscriber bypass, `focus=unlock-plan`, and legacy `focus=routine` behavior and copy.

### 4. Implement Product-led page components

- Translate the mockup hierarchy into production Tailwind/components.
- Reuse pricing/checkout.
- Preserve mobile-first max-width behavior and accessible headings/controls.
- Add `unlock-plan` and `pricing` anchors.

### 5. Add real product screenshots and conditional testimonials

- Capture, optimize, and add the three approved screenshots.
- Add testimonial config and production-safe empty behavior.

### 6. Remove fake urgency and fix pricing visibility analytics

- Remove countdown and expiry copy from the offer composition.
- Add one-shot pricing visibility tracking.
- Verify no duplicate offer/pricing events across rerenders.

### 7. Update regression coverage

- Rewrite `tests/result-offer-page.test.tsx` around the new product-led contract.
- Update `tests/result-page-client.test.tsx` and `tests/funnel-variants.test.ts` for quiz-answer props.
- Add focused unit tests for preview derivation, module coverage, selection, copy, and fallbacks.
- Add result/offer parity tests asserting the same extra category for every representative lane.
- Add the full browser-review Lea fixture and a negative oily-scalp-only dry-shampoo fixture.
- Add a deterministic scenario-distribution diagnostic over canonical quiz values; use it to flag
  unreachable categories or a broad treatment-only route, not as a claim about real customer mix.
- Update any countdown-specific tests only where the default offer no longer imports it; do not
  remove the component if another surface still uses it.

## Verification

Run from `/Users/nick/AI_work/hair_conscierge/.worktrees/offer-page-concepts`:

1. focused Node tests for offer preview and result offer;
2. affected funnel/result/pricing tests;
3. `npm run typecheck`;
4. `npm run lint`;
5. the repo's relevant CI test command for the offer/result path;
6. local browser verification for:
   - immediate post-quiz offer;
   - `/result/[leadId]`;
   - `?focus=unlock-plan` → preview lock/transition;
   - `?focus=routine` → pricing with legacy routine context;
   - mobile and desktop widths;
   - all three plans;
   - Stripe checkout opening;
   - PayPal path when enabled;
   - missing/legacy quiz fields;
   - result/offer category parity for bond-builder, protein mask, moisture mask, leave-in, oil,
     scalp focus, and no-extra cases;
   - authenticated subscriber bypass;
7. inspect console and network errors and verify no horizontal overflow;
8. run `ready-check` before claiming readiness.

Do not perform a real payment as part of local verification unless separately authorized.

## Review gates

1. Independent plan review before implementation; classify findings as accepted, rejected,
   deferred, or requiring a user decision.
2. Local visual review with Nick and Jonas before merge.
3. Whole-branch code review after tests and before staging/push.
4. Stop before commit, push, PR, merge, deployment, or worktree cleanup for explicit approval.

## Remaining inputs, not routing blockers

No further product-routing decision is open. Implementation still needs:

- normal Jonas copy/order review; the product identities, images, and fit provenance are now
  grounded in the checked-in catalog snapshot, migrations, and deterministic spec backfills;
- replacement screenshots later if Jonas prefers them; the existing sanitized local chat, routine,
  and product-choice images are used for the first production implementation;
- the exact German replacement for `In 4 Wochen` and normal Jonas copy/order review;
- approved beta quotes later; until then the testimonial section remains absent;
- the required Claude plan review remains unavailable until the local account limit resets; the
  failed review output is retained beside this plan and does not imply approval.

## Independent-review classification

The first required Claude review attempt could not run because the local Claude Code session limit
was reached. A read-only Codex reviewer inspected that draft and current repository instead. After
the quiz-proxy revision resolved the remaining user decision, Claude was retried on 2026-07-13 at
16:17 CEST with both the configured default model and an explicit Sonnet override. Both attempts
were rejected immediately by the same account-level limit (`resets 8:30pm Europe/Berlin`), before
Claude could inspect the plan. No Claude verdict is recorded or implied; retry after the reset before
implementation.

Claude was retried again on 2026-07-13 at 20:47 CEST after the branch was fast-forwarded to current
`origin/main` and the post-paywall scope was separated. The read-only review processed for several
minutes, then exited without a verdict because the account session limit had moved to
`resets 1:40am Europe/Berlin`. The literal failure output is retained in
`plans/2026-07-13-product-led-offer-production.claude-review.md`.

- Accepted: make optional routing set-based and deterministic; filter every known hard mismatch;
  reuse canonical base cadence; scope fallbacks without changing route validation; preserve both
  focus-link generations; isolate `pricing_viewed` observation from checkout behavior.
- Partly rejected: the review said cleansing intensity had no repository truth source. It is present
  in `product_shampoo_specs`, the shampoo backfill, and production selection. The valid part was
  accepted: curated registry values require a verified export or explicit review provenance.
- Resolved by full quiz-flow review: result and offer share one lane; treatment and pull tests alone
  do not qualify; high and moderate chemical stress use different corroboration; balanced-pull
  dryness/frizz resolves to leave-in; generic scalp serum is excluded; dry shampoo is excluded
  because the quiz lacks the production engine's required bridge context; volume may refine a core
  example, while color protection is retained only as an unverified user goal and not a product-fit
  claim; precise four-week outcome copy is removed.
- Confirmed sound: prop plumbing, checkout-slot reuse, branch-as-release-boundary, and the
  approximately twenty-module in-memory architecture.

## Implementation handoff contract

When implementation starts, use this goal contract:

> Implement `plans/2026-07-13-product-led-offer-production.md` in
> `/Users/nick/AI_work/hair_conscierge/.worktrees/offer-page-concepts` on
> `codex/offer-page-concepts`. Preserve the untracked mockups, keep pricing and checkout behavior
> stable, implement deterministic quiz-preview coverage with no LLM or render-time data call, run
> the listed verification and readiness review, and stop before staging, commit, push, PR, merge,
> deploy, or cleanup for explicit approval.
