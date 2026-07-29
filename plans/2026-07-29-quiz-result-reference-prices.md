# Quiz-Result Offer Reference Prices

Status: approved for implementation

## Outcome

Show the same crossed-out, display-only reference prices on both live quiz-result
offer versions:

- monthly: crossed-out `€19,99`, charged price `€14,99`;
- quarterly: crossed-out `€44,49`, charged price `€34,99`;
- yearly: crossed-out `€149,99`, charged price `€99,99`.

The two in-scope result paths are:

1. the legacy quiz result, including the active guided-story offer family;
2. the dedicated `personal_plan` quiz result and `PersonalPlanOffer`.

Stripe and PayPal products, provider IDs, charged amounts, checkout labels,
analytics values, billing intervals, savings labels, and all non-quiz pricing
surfaces remain unchanged.

## Approval evidence

Nick reviewed the responsive stacked treatment on 2026-07-29 and said it
"Looks good." He then explicitly expanded the implementation from the new
personal-plan result to "both of our quiz results pages, on both versions" so
the presentation is coherent for all quiz users.

Mockup evidence:

- current pricing capture:
  `/Users/nick/.codex/visualizations/2026/07/29/019fad92-e3b9-74f2-a84e-3ec1e82852cc/personal-plan-pricing-current.png`;
- reviewed proposed treatment:
  `/Users/nick/.codex/visualizations/2026/07/29/019fad92-e3b9-74f2-a84e-3ec1e82852cc/personal-plan-price-anchor-proposed.png`;
- exact responsive HTML:
  `/Users/nick/.codex/visualizations/2026/07/29/019fad92-e3b9-74f2-a84e-3ec1e82852cc/personal-plan-price-anchor-mockup.html`.

Mockup review: confirmed by Nick on 2026-07-29.

Designed-user-journey sign-off: confirmed by Nick on 2026-07-29, with the same
journey explicitly extended to both result versions.

## Chosen implementation

Keep reference prices out of `STRIPE_PRICING_PLANS`. Define a narrowly typed
numeric display configuration and derive each exact German label from it.

1. `SubscriptionPlanSelector` accepts an optional reference-price map.
2. `ResultOfferPricing` accepts the same optional map and forwards it only to
   the selector.
3. The legacy result path passes the map to its `ResultOfferPricing`.
4. `PersonalPlanOffer` passes the same map to its `ResultOfferPricing`.
5. Membership reactivation and all other shared-selector callers omit the map.

This explicit opt-in keeps the shared component reusable and proves that
backend/provider pricing remains independent.

## Presentation

When a reference price exists, the selector stacks a small, muted crossed-out
value directly above the existing bold charged value. Use semantic `<s>`
markup and add a screen-reader-only `Vergleichspreis` qualifier. Do not add a
visible disclaimer or explanatory sentence.

Keep unchanged:

- quarterly selected by default;
- “Beliebteste Wahl” badge;
- `22% sparen` and `44% sparen`;
- plan detail lines and CTA labels;
- card selection behavior and responsive dimensions;
- checkout overlay price, provider price, and successful activation flow.

## Designed user journey

1. A visitor completes either current quiz and reaches its corresponding
   result offer.
2. The pricing section opens with quarterly selected.
3. Each card shows its crossed-out reference value above its actual price.
4. The existing savings/detail copy stays visible without added explanation.
5. Selecting monthly, quarterly, or yearly works as before.
6. Opening checkout uses the selected plan's existing actual amount.
7. Stripe and PayPal display and charge only that actual amount.
8. Membership reactivation and non-quiz pricing show no crossed-out reference
   prices.

Completion remains the existing successful checkout and activation path.

## Files and ownership

Runtime worker:

- `src/components/checkout/plan-reference-prices.ts`;
- `src/components/checkout/subscription-plan-selector.tsx`;
- `src/components/quiz/result-offer-pricing.tsx`;
- `src/components/personal-plan-offer/personal-plan-offer.tsx`;
- `src/app/result/[leadId]/result-client.tsx`.

Test worker:

- `tests/subscription-plan-selector.test.tsx`;
- `tests/personal-plan-offer-page.test.tsx`;
- `tests/result-offer-page.test.tsx`;
- `tests/funnel-variants.test.ts`;
- focused existing pricing/reactivation tests only when necessary.

The main session owns integration, plan updates, full-diff review, browser
verification, readiness, and final review.

## Verification

Automated:

- selector render with the map contains all three `<s>` reference labels;
- selector render without the map contains no `<s>` or reference labels;
- each configured reference amount is greater than its actual plan amount;
- production legacy result and personal-plan result each opt in;
- canonical pricing still equals `14.99`, `34.99`, and `99.99`;
- analytics continues to use those canonical amounts;
- focused result, pricing, checkout, and reactivation tests pass;
- TypeScript and lint pass for the final tree.

Browser:

- inspect the personal-plan lab at desktop and 390 px;
- exercise all three selections and open checkout without submitting payment;
- verify the production legacy result path by rendering `ResultPageClient` with
  a legacy quiz fixture; the guided-story lab intentionally uses a static
  pricing duplicate and is not valid evidence for this runtime seam;
- verify membership reactivation contains no reference price;
- inspect accessible markup for the comparison-price qualifier.

Commands:

- `npx tsx --test tests/subscription-plan-selector.test.tsx tests/result-offer-page.test.tsx tests/personal-plan-offer-page.test.tsx tests/funnel-variants.test.ts tests/result-offer-pricing-tracking.test.ts tests/analytics-tracking.test.ts tests/profile-subscription-reactivation.test.ts`;
- `npm run typecheck`;
- `npx eslint` over the touched TypeScript and TSX files;
- the repository readiness commands selected by `ready-check` on the final
  integrated tree.

## Boundaries

- No Stripe, PayPal, database, migration, environment, flag, analytics, or
  entitlement changes.
- No coupons, timers, eligibility, introductory billing, or renewal changes.
- No non-quiz pricing changes.
- The test-only `StaticPricingPreview` duplicates in
  `quiz-result-offer-page.tsx` and `app/labs/offer-page/page.tsx` remain
  unchanged. Production always injects `ResultOfferPricing`; the personal-plan
  lab already exercises that real runtime component.
- The exact values `€19,99`, `€44,49`, and `€149,99`, the existing
  `22% sparen` and `44% sparen` labels, and the absence of visible explanatory
  copy are explicit owner decisions. Implementers must not recompute or alter
  them.
- The presentation applies coherently to all current quiz-result offers rather
  than creating a new guided-story experiment arm. Do not bump the guided-story
  assignment revision or pricing analytics revision.
- Revert and redeploy is the accepted rollback path; do not introduce an
  environment flag for this small presentation-only change.
- No commit, push, PR, merge, deployment, or production write without separate
  authorization.

## Counterpart review decisions

The read-only counterpart review approved the core shape with revisions.

- Accepted: add `tests/funnel-variants.test.ts` and make its source assertion
  resilient to formatter line wrapping.
- Accepted: render the production legacy `ResultPageClient` instead of relying
  on `QuizResultOfferPageShell`'s static fallback.
- Accepted: state that the guided-story lab is not a valid runtime verification
  surface and rely on the production-wrapper render test plus personal-plan
  browser evidence.
- Accepted: name exact test commands and mark the selector test as a new file.
- Accepted after whole-tree review: derive each visible label from its numeric
  reference amount so the rendered value and ordering invariant cannot drift.
- Rejected: putting the reference values in `STRIPE_PRICING_PLANS`; a separate
  display-only map better preserves the canonical charge model.
- Rejected as already decided: changing the exact values, removing the existing
  savings labels, or adding visible explanatory copy.
- Rejected as outside the requested coherent rollout: a new feature flag,
  guided-story experiment revision, or analytics pricing revision.
