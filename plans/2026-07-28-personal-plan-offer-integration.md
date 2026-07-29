# Personal Plan Quiz V1 — Offer, Checkout, and Unlock Integration

Status: approved for implementation
Mockup review: confirmed by Nick on 2026-07-28
Designed-user-journey sign-off: confirmed by Nick on 2026-07-28
Implementation authorization: granted, subject to the required journey sign-off
Publication authorization: draft PR granted on 2026-07-29; merge and deployment remain separate

## Outcome and source context

Complete the parallel paid-ad funnel so a personal-plan quiz submission:

- prepares a real deterministic hair plan during the existing preparation sequence;
- saves the V2 lead and opens the canonical lead-bound result route;
- shows the approved personal-plan offer without exposing the locked routine or products;
- reuses the stable subscription checkout, pricing, access, and account-activation path;
- attaches the prepared plan to the paid account;
- shows a short post-payment future-pacing transition;
- keeps the existing onboarding mandatory; and
- sends completed onboarding to the Routine page instead of Chat.

Source artifacts:

- approved quiz refinement:
  `plans/2026-07-28-personal-plan-quiz-refinement.md`;
- implementation decisions:
  `plans/2026-07-27-personal-plan-quiz-v1-decisions.md`;
- approved offer mockup:
  `plans/mockups/2026-07-28-personal-plan-offer-integration.html`;
- co-founder reference implementation:
  [NickRuppy/hair_concierge#252](https://github.com/NickRuppy/hair_concierge/pull/252);
- current legacy result and offer route:
  `src/app/result/[leadId]/page.tsx` and
  `src/app/result/[leadId]/result-client.tsx`;
- current deterministic offer computation:
  `src/lib/quiz/guided-story-priorities.ts`,
  `src/lib/quiz/hair-potential.ts`,
  `src/lib/quiz/offer-preview.ts`, and
  `src/lib/quiz/guided-story-products.ts`;
- current stable checkout and activation path:
  `src/components/quiz/result-offer-pricing.tsx`,
  `src/app/welcome/page.tsx`, and
  `src/lib/quiz/link-to-profile.ts`.

## Chosen direction

### One canonical result route, two explicit quiz contracts

Keep `/result/[leadId]` as the only real lead-bound result and offer route.
It explicitly dispatches by `leads.quiz_kind`:

- `legacy` keeps the current parser, experiment resolver, offer registry, and
  entitled result behavior;
- `personal_plan` validates the versioned V2 envelope, loads its attached
  prepared-plan artifact, and renders the dedicated personal-plan offer.

Do not coerce the V2 answer shape into the legacy funnel registry merely to
reuse its UI. The V2 computation may adapt into legacy deterministic inputs,
but the result route and client retain a discriminated presentation model.
The existing `/lp/[slug]/angebot` page remains a safe placeholder/stale-link
fallback and is no longer a successful quiz destination.

### Prepare once, reveal in layers

Create a server-only prepared-plan artifact before email capture. The
preparation endpoint validates the complete V2 answer envelope, adapts it to
the existing deterministic diagnosis model, builds the public teaser and
locked plan, and stores them separately.

The artifact contains:

- a versioned canonical diagnostic projection;
- three ranked diagnostic priorities and their raw internal scores;
- the safe public offer model:
  plan title, three diagnostic rows, visible thirds, and one plan-fit statement;
- the locked plan:
  shampoo, conditioner, optional treatment, tools/styling direction, routine
  order, application guidance, and target frequency;
- explicit fallback metadata for unknown elasticity or scalp classification;
- an answer hash used to prove that the artifact belongs to the subsequently
  saved lead.

Before lead creation, the browser receives only a high-entropy claim credential
and preparation status. It never receives the locked plan. When the email step
saves the lead, the server verifies the claim credential and answer hash,
atomically attaches the artifact to that lead, and revokes the anonymous claim.
The result route reads only the safe public model until access is confirmed.

This pre-email snapshot is intentional, not a cache optimization: Nick wants
the plan genuinely prepared during the reviewed loading sequence. Claim and
lead persistence therefore use one database transaction. A repeat with the
same canonical answer hash is idempotent:

- an already attached matching artifact succeeds;
- if an equivalent second artifact was prepared during retry, the first
  attached artifact remains canonical and the duplicate becomes `superseded`;
- a different answer hash, wrong token, expired token, or artifact attached to
  another lead fails without mutating either row.

The prepare and lead endpoints both hash
`canonicalizePersonalPlanAnswers(...)`, including the same omission rules for
conditional keys. Expired and superseded anonymous rows are purged through a
bounded server-side cleanup function invoked best-effort by preparation; an
indexed expiry keeps cleanup independent from the user-facing response.

The prepared artifact is a baseline snapshot. After payment it is linked to the
account and projects the canonical V2 diagnostics into `hair_profiles`. The
mandatory onboarding then adds the user's existing products and care habits.
The Routine page continues to derive the live routine from that canonical
profile plus onboarding inputs, so the post-onboarding plan is a refinement of
the prepared baseline rather than a second unrelated computation.

### Reuse the current deterministic gold standard

Add a V2-only adapter and builder:

```text
PersonalPlanQuizAnswers
  -> canonical legacy computation input
  -> ranked priorities
  -> hair-potential rows
  -> shampoo + conditioner + optional-care direction
  -> public teaser + locked prepared plan
```

Reuse:

1. `rankGuidedStoryPriorities`;
2. `calculateHairPotential`;
3. `deriveGuidedStoryNeedProfile`;
4. `buildGuidedStoryProductCards`.

The adapter maps texture, thickness, density, length, surface, elasticity,
chemical treatment, scalp type/complaint, concerns, and goals deliberately.
When a user selects every concern or goal, it ranks the most diagnostic inputs
before applying the legacy limits instead of relying on silent truncation.

Concrete fallback substitutions:

- `elasticResponse: unknown` computes as `stretches_bounces` and records
  `elasticityFallback: true`;
- `scalpOiliness: unknown` computes as `ausgeglichen` and records
  `scalpFallback: true`.

These values are used both for offer computation and the post-payment profile
projection. This ensures `calculateHairPotential` returns three rows and
`hasCompletedQuizDiagnostics` classifies the paid user as `needs_onboarding`
rather than redirecting them into the legacy quiz. The fallback flags remain
available for later refinement and prevent the neutral substitutions from
being misrepresented as observed facts.

The taxonomy translation is fixed as follows:

| V2 signal                    | Canonical computation signal                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `moisture`                   | goal `moisture`                                                                                                           |
| `frizz_surface`              | goal `less_frizz`                                                                                                         |
| `shine`                      | goal `shine`                                                                                                              |
| `shape_definition`           | goal `curl_definition`                                                                                                    |
| `strength_ends`              | goal `anti_breakage`                                                                                                      |
| `scalp_balance`              | goal `healthy_scalp`                                                                                                      |
| `manageability_styling`      | goal `less_frizz`                                                                                                         |
| `volume_balance`             | goal `volume` for fine or low-density hair; goal `less_volume` for coarse, high-density, or textured hair; otherwise omit |
| `dry_dull_lengths`           | concern `dryness`                                                                                                         |
| `frizz_flyaways`             | concern `frizz`                                                                                                           |
| `tangling`                   | concern `tangling`                                                                                                        |
| `breakage_or_split_ends`     | concern `breakage`; add `split_ends` when long/very long, rough, or treated                                               |
| `low_shine`                  | goal `shine`                                                                                                              |
| `lost_shape`                 | goal `curl_definition`                                                                                                    |
| `low_volume_or_weighed_down` | the same factual volume rule as `volume_balance`                                                                          |
| `scalp_imbalance`            | goal `healthy_scalp`                                                                                                      |

Canonical concern priority is `breakage`, eligible `split_ends`, `dryness`,
`tangling`, then `frizz`; retain the first three present. Goal retention first
keeps an explicit scalp need, then goals associated with retained concerns,
then definition/volume direction, and fills remaining slots in the table order.
If no goal survives, use `healthier_hair` only as a neutral computation
fallback. This mapping, not user selection order or legacy enum order,
determines the three visible diagnostic priorities.

The offer shows exactly three ranked dimensions. Raw scores never appear in the
UI and map to the reviewed visual thirds:

- `40–60` → one segment;
- `65–80` → two segments;
- `85–100` → three segments.

A dimension that is already strong may remain `3/3 → 3/3` with maintenance
copy. `Dein Potenzial` is always rendered as three segments as a directional
goal, accompanied by the symbolic-results disclaimer; it is not presented as a
guaranteed measured outcome. No overall percentage or average is shown.

### Dedicated offer, shared pricing and checkout

Implement the approved mockup as a dedicated personal-plan offer component.
It uses:

- one generic, fully visible Routine-page example;
- one symbolic before/after image pair;
- three personalized diagnostic rows;
- one personalized plan-fit statement;
- the complete-plan value stack;
- the existing diagnostic-method section;
- current subscription prices only;
- quarterly as the default;
- Chat and hair diary only as secondary inclusions;
- the approved survey proof, three beta testimonials, guarantee, and FAQ.

There is no timer, temporary discount, crossed-out price, or one-time purchase.
The later generic transformation-card set from PR #252 is intentionally
omitted because the three diagnostic rows replace it.

Reuse `ResultOfferPricing` and its current payment overlay, provider locking,
duplicate-access handling, and checkout-attempt semantics. Add only the
smallest imperative seam needed for the sticky offer CTA to open that same
checkout instance immediately. It opens the currently selected interval;
quarterly is selected initially.

### Stable post-payment activation with one new transition

Preserve the existing Stripe and PayPal account-activation pattern. Extend the
quiz-to-profile linker so a `personal_plan` lead:

- links the prepared artifact to the authenticated user;
- projects the canonical diagnostics into `hair_profiles`; and
- leaves the account in `needs_onboarding`, not `needs_quiz`.

All first-time successful **V2** purchase paths converge on one authenticated
post-payment transition route:

- already-authenticated checkout return;
- password creation;
- magic-link confirmation.

Legacy purchases and reactivation keep their existing destinations and do not
show the new transition. The welcome server resolves `quiz_kind` from the
checkout's lead and passes one validated post-checkout destination through
password and magic-link flows; the generic redirect helper does not guess from
client state.

The transition shows:

1. `Heute startest du mit deinem persönlichen Haarplan.`
2. `In einer Woche kennst du deine Routine ganz genau.`
3. `In vier Wochen sieht dein Haar sichtbar schöner und gesünder aus.`

It advances in roughly six to eight seconds. The page polls the authenticated
readiness endpoint every 1.5 seconds for up to 30 seconds to cover deferred
Stripe-webhook linking. If account/artifact activation is still settling, the
final state stays visible with restrained loading feedback. At the timeout it
shows a manual retry without discarding payment or quiz state. When ready it
changes to `Dein Plan ist bereit` with
`Meinen Plan verfeinern`, which opens the mandatory existing onboarding.
An activation error offers a retry and never bypasses onboarding.

Onboarding screens, questions, storage, and explicit `returnTo` behavior remain
unchanged. The V2 transition opens `/onboarding?returnTo=/routine`, so this
funnel completes at Routine while every legacy and general onboarding default
remains unchanged.

## Scope and non-goals

### In scope

- V2 answer adapter and deterministic prepared-plan builder;
- anonymous preparation endpoint, storage, claim, expiry, and lead attachment;
- V2 result-route dispatch and locked-offer model;
- approved offer UI and local image assets;
- current subscription pricing and shared payment overlay;
- V2 profile/artifact linking during current checkout activation;
- post-payment future-pacing transition;
- V2-only mandatory onboarding handoff with an explicit Routine return;
- V2 result/offer/checkout analytics parity without answer values or PII;
- focused unit, route, component, and browser regression coverage.

### Non-goals

- changing the existing `/quiz` questions, result, offer experiment, or email;
- changing legacy checkout, onboarding, or authenticated `/auth` destinations;
- one-time purchases, new Stripe/PayPal products, discounts, timers, or urgency;
- redesigning the payment overlay or changing payment-provider ownership;
- final transactional V2 result-email layout or activation;
- redesigning or shortening the existing paid onboarding;
- exposing exact products, steps, application, or frequencies before payment;
- replacing the mature recommendation engine or inventing unsupported mappings;
- deployment, environment activation, migration application, commit, push, PR,
  or merge.

## Target map

### Quiz preparation and lead attachment

- `src/components/personal-plan-quiz/personal-plan-quiz.tsx`
  - start real preparation during the current three-stage loading sequence;
  - retain the reviewed testimonials and commitments;
  - keep one automatic preparation retry;
  - preserve the draft and expose a retry state after a second failure;
  - submit the claim credential with the final lead request;
  - consume the returned `leadId` and navigate directly to
    `/result/[leadId]?entry=quiz_completion`;
  - do not prefetch the result route.
- `src/app/api/quiz/personal-plan-prepare/route.ts`
  - validate V2 answers, compute and persist the artifact, and return only its
    claim credential/status.
- `src/app/api/quiz/personal-plan-lead/route.ts`
  - atomically save/reuse the lead and attach the matching prepared artifact;
  - keep failure retryable and Customer.io/result email non-blocking.
- `src/lib/personal-plan-quiz/persistence.ts`
  - export one durable-answer validator/canonicalizer used by both endpoints;
  - extend the validated request/response contract without persisting
    conversion-only answers.
- new migration following `20260728120000_add_leads_quiz_kind.sql`
  - add the server-only prepared-artifact table, indexes, expiration,
    best-effort purge function, and one transactional
    `save_personal_plan_lead_with_artifact` RPC;
  - define idempotent first-matching-artifact-wins behavior for dedupe/retry;
  - no browser-readable RLS policy and no locked fields in lead JSON.

### Deterministic computation

- new `src/lib/personal-plan-quiz/offer-adapter.ts`
  - map the V2 taxonomy to the current deterministic quiz vocabulary;
  - rank/reduce unlimited V2 concerns and goals deliberately;
  - record neutral fallbacks rather than fabricate precision.
- new `src/lib/personal-plan-quiz/prepared-plan.ts`
  - build and validate the public offer model and locked plan;
  - map score bands to visible thirds;
  - derive the lightweight tools/styling direction.
- reuse without changing legacy contracts:
  `src/lib/quiz/guided-story-priorities.ts`,
  `src/lib/quiz/hair-potential.ts`,
  `src/lib/quiz/offer-preview.ts`, and
  `src/lib/quiz/guided-story-products.ts`.

### Result and offer

- `src/app/result/[leadId]/page.tsx`
  - parse by `quiz_kind`;
  - preserve legacy behavior;
  - load only the V2 public offer model before access;
  - render an explicit recovery state for a missing/malformed artifact;
  - preserve the current server-owned funnel `offer_viewed`.
- `src/app/result/[leadId]/result-client.tsx`
  - render the dedicated V2 offer model or the entitled V2 continuation;
  - do not pass V2 through legacy `FunnelOfferVariantProps`.
- new `src/components/personal-plan-offer/*`
  - implement the approved responsive offer;
  - render one offer-tracking provider and one pricing slot;
  - add the sticky CTA to the existing checkout controller.
- `src/components/quiz/result-offer-pricing.tsx`
  - add a narrow external-open request prop or equivalent public controller;
  - keep the current internal selected interval and checkout-attempt ownership.
- `public/images/funnels/personal-plan-offer/*`
  - store the approved symbolic before/after assets locally;
  - verify crop, responsive rendering, alt text, and provenance before release.
- `src/app/lp/[slug]/angebot/page.tsx`
  - retain a safe fallback or send stale direct visits back to the quiz;
  - never render an unbound real offer.

### Checkout activation and post-payment

- `src/lib/quiz/link-to-profile.ts`
  - add a discriminated V2 path while preserving the legacy path;
  - attach the prepared artifact to the user and project canonical diagnostics.
- `src/lib/stripe/checkout-activation.ts`
- `src/lib/paypal/checkout-activation.ts`
  - keep current subscription activation and use the expanded linker.
- V2 linker call-site audit:
  `src/app/api/auth/set-checkout-password/route.ts`,
  `src/app/api/auth/callback/route.ts`,
  `src/app/auth/actions.ts`,
  `src/app/welcome/page.tsx`,
  `src/lib/stripe/checkout-activation.ts`, and
  `src/lib/paypal/checkout-activation.ts`
  - prove every existing caller safely accepts the discriminated V2 linker;
  - do not duplicate profile-link logic at individual call sites.
- `src/lib/billing/checkout-success-redirect.ts`
- `src/app/welcome/page.tsx`
- `src/app/welcome/welcome-client.tsx`
- `src/app/api/auth/set-checkout-password/route.ts`
- `src/app/api/auth/send-magic-link/route.ts`
- `src/app/api/auth/callback/route.ts`
- `src/app/auth/actions.ts`
- `src/app/auth/confirm/route.ts`
  - converge first-time V2 purchases on the protected transition route while
    leaving legacy purchases and reactivation behavior unchanged;
  - carry a server-resolved, sanitized V2 destination instead of asking the
    generic redirect helper to infer quiz kind.
- new `src/app/plan-bereit/*`
  - render the three future-pacing states;
  - verify entitlement, V2 profile link, and prepared artifact readiness;
  - hold, retry, or continue to mandatory onboarding.
- `src/app/onboarding/page.tsx`
- `src/components/onboarding/onboarding-flow.tsx`
  - preserve existing behavior and verify that the V2 transition's explicit
    `returnTo=/routine` survives to completion.

### Analytics

- `src/app/api/analytics/meta-offer-view/route.ts`
  - allow the V2 lead kind for the same offer-view event without loading or
    emitting quiz answers.
- `src/app/api/analytics/offer-engaged/route.ts`
  - allow V2 engagement without loading or forwarding answer content.
- `src/lib/analytics/events.ts`
- `src/lib/analytics/offer-section-order.ts`
  - add the personal-plan section/CTA IDs and one explicit ordered section map.
- new V2 structural offer-tracking provider, or a discriminated mode in the
  existing provider
  - emit section and CTA behavior without `conditionerModuleId`,
    `shampooModuleId`, `suggestedCategory`, `needLane`, product IDs, or another
    reversible locked-plan identity;
  - accept losing legacy product-lane segmentation for V2 in order to preserve
    the hardgate;
  - preserve one mounted provider, one fresh-handoff offer view, one explicit
    `InitiateCheckout` owner per checkout attempt, and route-owned milestones.
- `src/app/api/quiz/result-artifact/route.ts`
- `src/lib/customerio/result-artifact-service.ts`
  - remain explicitly legacy-only until the separate V2 result-email work.
- `src/funnels/packages.json`
  - keep `meta_personal_plan_v1` as `placeholder` and its legacy
    `offerVariant` inert during implementation; publication decides when to
    flip status, and `npm run funnel:check` must remain green.

## Designed user journey

Actor: a new visitor who enters through `/lp/haarplan`, completes the personal
plan quiz, purchases a subscription, creates or resumes an account, completes
the mandatory onboarding, and opens the Routine page.

1. The existing refined V2 quiz runs through the agreed diagnostic,
   recognition, reassurance, commitment, and profile-summary sequence.
2. On the preparation screen, the existing three processing stages and
   testimonials continue. The system concurrently validates the durable
   answers and prepares the real baseline plan on the server. The visual
   progress has checkpoints but no numeric percentage.
3. If preparation succeeds quickly, the storytelling sequence still completes
   without revealing products or steps. If it fails, the system retries once.
   After a second failure, the user remains on the same flow, keeps all answers,
   and gets a clear retry action. The email step is not shown until a valid
   artifact can be claimed.
4. The user enters an email and chooses the optional marketing-consent state.
   The server saves or deduplicates the V2 lead, atomically attaches the
   prepared artifact, and returns the stable lead ID. A save failure keeps the
   entered email, consent choice, quiz answers, and retry action.
5. The browser navigates directly, without prefetch, to
   `/result/[leadId]?entry=quiz_completion`.
6. The offer opens with:
   - one headline: `[Name, ]dein Haarplan ist bereit`;
   - one short personalized profile line;
   - no duplicate overline or plan-title pill;
   - a generic, fully visible example rendered with the real Routine-card
     component, generic product names, representative product imagery, order,
     and example cadence without implying these are the user's actual
     recommendations.
7. The next section shows one symbolic before/after image pair and exactly
   three ranked, personalized diagnostic rows. The image pair is visually split
   and labeled `Heute` and `Dein Ziel`, matching RiseGuide's `Now` and
   `Your Goal`. Every diagnostic row uses the same three-level vocabulary:
   `Viel Potenzial`, `Gute Basis`, and `Optimal`. Only the row title and
   personalized explanation change. The rows continue the image's purple-left
   and green-right comparison without repeating `Heute` and `Dein Ziel` inside
   every dimension or adding a second column header. A strong dimension may
   remain `Optimal` rather than showing artificial improvement. A separate
   statement explains how the plan will help with the user's behavioral
   friction.
8. The page then explains the complete plan, diagnostic method, current
   subscription choices, secondary Chat/diary benefits, survey proof,
   guarantee, testimonials, and FAQ exactly in the approved hierarchy. The
   method section visibly explains Zugtest, Oberflächentest, Kopfhaut-Check,
   and Produktabgleich and connects them to products, order, and application.
   The FAQ contains exactly the five approved objections: why shampoo alone is
   insufficient, personal fit, exact contents, existing-product reuse, and the
   immediate post-purchase journey. Personalized product names and
   user-specific routine details remain absent from the browser payload.
9. The sticky `Plan sichern` button opens the same payment overlay as the
   pricing CTA, immediately and without scrolling. Quarterly is initially
   selected. If the user changes the interval in pricing, later CTAs use that
   selected interval. One explicit click owns one checkout attempt and one
   `InitiateCheckout`.
10. Stripe or PayPal completes through the current stable activation flow. The
    V2 lead, canonical diagnostics, and prepared artifact link to the paid
    account. Payment errors, duplicate-access handling, and retry behavior stay
    in the existing checkout surface.
11. A first-time V2 purchaser reaches the protected post-payment transition
    whether they were already authenticated, created a password, or used a
    magic link. Legacy and reactivating customers keep their prior destination.
12. The transition shows the three reviewed future-pacing messages over about
    six to eight seconds. If activation still needs time, the final message
    remains with subtle progress. If readiness fails, the user can retry; the
    app does not bypass onboarding or pretend the plan is ready.
13. Once ready, the state changes to `Dein Plan ist bereit` and the user clicks
    `Meinen Plan verfeinern`.
14. The CTA opens `/onboarding?returnTo=/routine`. The existing mandatory
    onboarding collects existing products and care
    habits without new, removed, reordered, or redesigned screens. Explicit
    edit/retake `returnTo` values continue to win.
15. This V2 onboarding completion opens `/routine`, where the live routine is
    derived from the prepared canonical profile and refined with the products
    and habits just collected. Other onboarding entries retain their current
    defaults. This fully loaded Routine page is completion.

Meaningful variants and recovery:

- an entitled visitor who revisits the result never sees locked plan data;
- malformed V2 answers or an absent artifact do not fall through to a legacy
  offer and do not display invented recommendations;
- ordinary cosmetic scalp complaints retain the regular offer with the
  approved light safety boundary;
- unknown elasticity/scalp values use recorded neutral fallbacks;
- selecting every goal/concern produces stable ranked output;
- checkout duplicate access uses the existing dialog;
- payment reactivation does not enter the first-time onboarding journey;
- explicit onboarding `returnTo` values remain unchanged.

## Mockup evidence

Selected direction:

- [personal-plan offer integration mockup](./mockups/2026-07-28-personal-plan-offer-integration.html)

Initial mockup review: **confirmed by Nick on 2026-07-28**.

Live-page refinement review and journey sign-off: **confirmed by Nick on
2026-07-29** after reviewing the implemented result page end to end.

Feedback incorporated:

- no urgency timer, temporary discount, or one-time option;
- preserve current prices and quarterly default;
- sticky CTA opens the current payment overlay;
- preserve the generic, unlocked example plan in commit `07537cc` for a later
  offer test, but omit it from the first shipping version so the hero leads
  directly into the before/after diagnosis;
- one compact symbolic before/after pair with a visible split, direction, and
  the short labels `Heute` and `Dein Ziel`;
- center the directional arrow as an icon inside an evenly padded circular
  control rather than relying on the font metrics of a text arrow;
- three dynamic diagnostic rows using the existing score computation, mapped
  to thirds and without an overall score, using one fixed vocabulary across all
  dimensions: `Viel Potenzial`, `Gute Basis`, `Optimal`;
- show `Heute` and `Dein Ziel` only once on the image comparison; the three
  diagnostic rows inherit the same left/right colour grammar without repeating
  either label;
- remove the duplicated generic transformation-card set;
- retain the original 30-day promise;
- complete routine and products are primary, Chat and diary secondary;
- restore the diagnostic-method explanations omitted in the first
  implementation and connect them visually to the plan output;
- retain survey proof, guarantee, and testimonials with consistent content
  width, padding, and desktop card alignment;
- use exactly the five approved objection-handling FAQ questions and omit the
  separate Chat/diary FAQ;
- prepare the real plan during loading;
- keep mandatory onboarding and add the post-payment future-pacing transition.

The mockup uses example diagnostic values. Production must verify representative
straight, wavy, curly, and coily profiles and all score states in the real
component.

## Ordered tasks

1. Add failing computation and security contracts.
   - Test the fixed V2-to-canonical table, deliberate concern/goal reduction,
     score-to-thirds mapping, exact unknown substitutions/flags, and all-goals
     case.
   - Test that the public model contains no products, routine steps,
     application, or frequency.
   - Completion: tests fail against the current code and precisely define the
     artifact boundary.

2. Implement the V2 adapter and prepared-plan builder.
   - Reuse the four current deterministic functions in the chosen order.
   - Preserve current shampoo, conditioner, optional-care, and fallback logic.
   - Add only lightweight tools/styling direction from texture, goals, and
     routine style.
   - Completion: the deterministic matrix passes and all existing legacy
     computation tests remain unchanged and green.

3. Add anonymous prepared-artifact persistence.
   - Add the server-only table, claim-token hashing, answer hashing, expiry,
     lead/user attachment state, and an atomic claim function.
   - Add the preparation API and extend V2 lead save to attach the artifact in
     the same RPC transaction as lead create/reuse.
   - Make re-claim idempotent: an already attached matching artifact succeeds,
     first matching artifact wins, and an equivalent retry artifact becomes
     superseded.
   - Add indexed expiry and bounded best-effort garbage collection.
   - Never return locked-plan JSON from either endpoint.
   - Completion: route tests prove valid claim, wrong token, mismatched
     canonical answers, expired claim, idempotent re-claim, equivalent retry
     artifact, deduplicated lead, garbage collection, and database failure
     behavior.

4. Connect real preparation to the existing loading sequence.
   - Start preparation exactly once per stable answer set.
   - Keep the reviewed stages, testimonials, and commitments.
   - Implement one automatic retry, then an explicit retry state that
     preserves draft and contact data.
   - Use the returned lead ID for direct canonical result navigation without
     prefetch.
   - Completion: component tests prove one request per answer hash, retry
     behavior, no advance without an artifact, and no result prefetch.

5. Add the V2 result dispatch and offer model.
   - Keep the legacy parser/offer path intact.
   - Load only the public artifact fields for anonymous V2 visitors.
   - Add missing/malformed-artifact recovery.
   - Bypass the legacy offer experiment for V2 while preserving funnel context
     and one server/client offer-view ownership path.
   - Completion: route tests cover legacy, valid V2, entitled V2, invalid V2,
     missing artifact, and repeat visit behavior.

6. Implement the approved personal-plan offer.
   - Build the real responsive hierarchy and localize the symbolic images.
   - Render three dynamic rows, maintenance state, plan-fit statement, value
     stack, method, pricing, proof, guarantee, testimonials, FAQ, and footer.
   - Reuse one `ResultOfferPricing` instance and add the narrow external-open
     seam for the sticky CTA. With the payment-overlay flag enabled it opens
     the overlay; with the flag disabled it invokes the existing inline
     checkout fallback and scroll behavior rather than pretending an overlay
     exists.
   - Completion: component tests prove one pricing slot/provider, quarterly
     default, interval retention, locked data absence, and correct CTA
     ownership; browser captures match the approved 320/375 mobile and desktop
     hierarchy.

7. Extend V2 checkout activation and account linking.
   - Add a discriminated V2 path to `linkQuizToProfile`.
   - Link the prepared artifact to the user and project the canonical
     diagnostic fields needed by auth intake and the routine engine.
   - Audit all seven existing linker call sites, including checkout password,
     auth callback, and auth action paths.
   - Preserve legacy linking and Stripe/PayPal activation behavior.
   - Completion: focused tests show V2 becomes `needs_onboarding`, legacy stays
     unchanged, and a V2 artifact cannot attach to a different account.

8. Add the post-payment transition.
   - Have the welcome server resolve V2 from the checkout lead and carry one
     sanitized destination through authenticated checkout return, password
     creation, magic-link confirmation, auth callback, and auth action paths.
   - Converge only first-time V2 purchasers on the protected route.
   - Implement the three messages, reduced-motion behavior, readiness hold,
     1.5-second polling, 30-second timeout, retry state, and ready CTA to
     `/onboarding?returnTo=/routine`.
   - Preserve legacy and reactivation destinations.
   - Completion: route/component tests cover all three auth entries, delayed
     readiness, failure/retry, reduced motion, and reactivation.

9. Finish this funnel at Routine without changing onboarding defaults.
   - Thread the V2 transition's explicit, sanitized `returnTo=/routine` through
     mandatory onboarding.
   - Preserve legacy defaults plus edit and retake return behavior.
   - Completion: V2 onboarding reaches Routine; legacy, edit, and retake
     navigation tests remain unchanged and pass.

10. Complete analytics and browser regression coverage.
    - Add personal-plan section and CTA unions plus a deterministic section
      order.
    - Allow V2 Meta offer view and offer engagement without reading/sending
      answers.
    - Use structural V2 tracking only; do not send product module IDs,
      suggested category, need lane, or another reversible locked identity.
    - Preserve screen diagnostics without answer values, one fresh-handoff
      offer view, one checkout-attempt owner, and existing purchase events.
    - Add a V2 happy-path browser fixture from loading through offer and from
      paid readiness through onboarding to Routine.
    - Completion: analytics contracts, ordinary and entitled result tests,
      Stripe/PayPal activation tests, and the focused V2 browser journey pass.

## Verification

### Automated

- V2 adapter and prepared-plan deterministic matrix:
  neutral; fine/oily/low-density; coarse/oily fallback;
  dry/rough/lightened/snapping; treated/overstretching/breakage;
  curly/frizz/lost shape; long/split ends; each scalp complaint;
  unknown values; all goals and concerns.
- public-versus-locked artifact serialization tests;
- prepare/claim/attach API tests, including expiry and replay;
- V2 result dispatch, missing artifact, access, and legacy regression tests;
- offer component, sticky checkout, selected interval, and tracking tests;
- Stripe and PayPal V2 lead resolution and activation tests;
- checkout password, magic-link, auth callback/action, authenticated return,
  legacy, reactivation, and transition tests;
- onboarding completion and explicit-return regressions;
- relevant existing node suites, then `npm run test:node`;
- `npm run ci:verify`.

### Manual/browser

- complete `/lp/haarplan` on 320, 375, and desktop widths;
- verify preparation stages, real request, retry, email save, and direct result
  navigation;
- verify the offer against the approved mockup, including one symbolic image
  pair, three diagnostic rows, maintenance state, and no horizontal overflow;
- inspect page source/network payloads to prove locked products and routine are
  absent before access;
- verify sticky and pricing CTAs open the same overlay with quarterly selected;
- verify the flag-disabled environment uses the existing inline fallback
  honestly;
- verify interval changes persist across later CTAs;
- exercise Stripe test checkout and a PayPal fixture through the transition,
  mandatory onboarding, and Routine destination;
- verify keyboard focus, screen-reader labels, reduced motion, console output,
  and recovery states.

### Migration and live-state checks

- review generated SQL and type impact without applying the migration;
- prove the artifact table has no browser-readable policy and claim tokens are
  stored only as hashes;
- prove V2 deduplication attaches only the matching answer hash;
- verify prepared artifacts expire and failed/replayed claims remain safe;
- do not enable the funnel flag, deploy, apply migrations, create billing
  products, or perform a production checkout in this task.

### Evidence-sensitive review

- confirm the product mapping still uses the current internal gold standard
  and does not invent a rule for unsupported oily/coarse shampoo coverage;
- confirm cosmetic scalp copy remains within the agreed non-medical boundary;
- confirm the local before/after images have acceptable provenance and are
  explicitly labeled as symbolic with individual results varying.

## Review and handoff

Implementation worktree:

`/Users/nick/AI_work/hair_conscierge/.worktrees/personal-plan-quiz-v1`

Branch:

`codex/personal-plan-quiz-v1`

The worktree already contains the accepted quiz implementation and related
same-task changes. Preserve them. The branch is currently behind
`origin/main`; do not rebase or merge while it is dirty. Reconcile upstream
only as a separately reviewed step if required before publication.

Required gates:

1. approved mockup — **confirmed**;
2. read-only Claude plan review — **completed and reconciled**;
3. reconciled post-review designed-journey walkthrough — **completed**;
4. explicit journey sign-off — **confirmed by Nick on 2026-07-28**;
5. implementation-loop verification, including ready-check and whole-branch
   request-code-review;
6. stop before commit, push, draft PR, migration application, feature-flag
   activation, deployment, or production writes.

Known rollout risks:

- the existing result route records offer views during server render, so V2
  result prefetch is forbidden;
- V2 `name` is intentionally empty, so all offer and activation copy is
  name-independent;
- all first-time V2 auth return variants must converge on the transition or
  some V2 buyers will skip it;
- a V2 lead currently fails legacy-only profile linking and must not be marked
  ready until the new linker succeeds;
- the prepared baseline and the post-onboarding live routine must share one
  canonical profile mapping or they can contradict each other;
- the offer must render one tracking provider and one pricing/checkout owner.

## Counterpart review findings

Read-only review:

[Claude plan review](./2026-07-28-personal-plan-offer-integration.claude-review.md)

Verdict: **approve with revisions**.

Reconciled findings:

- **Kept pre-email artifact preparation.** The reviewer proposed recomputing
  after lead creation to remove the claim mechanism. Rejected because Nick
  explicitly chose real plan preparation during the pre-email loading stages.
  Added transactional claim, canonical hashing, idempotent retry, expiry, and
  garbage-collection behavior.
- **Kept a separate post-payment transition.** The reviewer proposed folding it
  into onboarding. Rejected because the reviewed journey places the
  future-pacing sequence before mandatory onboarding. Narrowed it to V2 only
  and defined every auth return path, polling, timeout, and retry.
- **Fixed unknown-answer behavior.** Added the exact neutral substitutions and
  fallback metadata used by both potential computation and profile completion.
- **Fixed taxonomy ambiguity.** Added the complete V2 concern/goal translation,
  volume direction, and deterministic retention order.
- **Fixed linker coverage.** Added every known linker/auth call site to the
  audit and verification map.
- **Fixed analytics omissions.** Added `offer_engaged`, typed section/CTA IDs,
  personal-plan section ordering, and an explicitly structural V2 tracker.
  Locked-plan secrecy wins over legacy product-lane analytics for this funnel.
- **Fixed onboarding scope.** Removed the proposed global Chat-to-Routine
  change. Only this V2 flow supplies `returnTo=/routine`; legacy defaults remain
  unchanged.
- **Fixed transition scope.** Only first-time V2 purchasers enter the new
  transition; legacy purchases and reactivations retain current behavior.
- **Fixed overlay assumption.** The reviewed overlay is the intended enabled
  state, while flag-disabled environments retain the truthful inline fallback.
- **Recorded deliberate legacy-only services.** V2 result-email artifact and
  Customer.io template work remain deferred rather than accidentally widened.
- **Kept the placeholder fallback.** The reviewer recommended deletion.
  Retaining a feature-gated, non-checkout stale-link fallback is harmless and
  avoids broadening this integration task.
- **Did not commit the dirty branch.** The reviewer recommended committing the
  accepted quiz as a rollback point. Publication authority has not been given;
  this task therefore preserves the existing worktree and stops before commit.
  The whole working-tree diff, not only `origin/main...HEAD`, is the required
  later code-review scope.
