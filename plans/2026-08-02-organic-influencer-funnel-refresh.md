# Organic and influencer funnel refresh

## Outcome and source context

Refresh the existing legacy funnel from landing page through quiz and post-quiz offer so it becomes a shorter, calmer route into the same core diagnosis used by the Personal Plan funnel. Keep the ten-question organic structure and existing lead, result, and checkout boundaries while harmonizing the visible concern and goal vocabularies around the Personal Plan quiz.

Source context:

- User direction: use the new quiz as the source of truth for concern and goal choices and for the three-row offer diagnosis, while keeping the organic flow compressed and free of artificial urgency, micro-commitments, intermediate result screens, and the before/after hero image.
- Full-flow review prototype: [`2026-08-02-organic-influencer-full-flow-mockup.html`](./2026-08-02-organic-influencer-full-flow-mockup.html)
- Earlier three-screen direction study: [`2026-08-02-organic-influencer-funnel-mockup.html`](./2026-08-02-organic-influencer-funnel-mockup.html)
- Current organic package: `default_organic` -> `default` landing -> `legacy-quiz-v1` -> `guided-story` offer. The legacy result renderer also exposes `default`, `app-value-stack`, `guided-story-locked`, `guided-story-founder-letter`, and `guided-story-potential`; the latter two are the founder-letter and score experiences Nick explicitly chose to sunset.
- The Personal Plan prepared artifact currently combines two systems: `assessPersonalPlanHair`/`buildPersonalPlanAssessmentRows` produce the three public diagnosis rows from Personal Plan answers, while the existing guided-story engine still derives priorities, products, and the locked plan through an adapter. The organic offer should reuse the first system through a shared diagnostic input, not fabricate the Personal Plan funnel's missing persuasion/context answers or adopt its prepared-artifact/payment lifecycle.

## Chosen direction

Keep the organic funnel short, but harmonize its diagnostic core with the Personal Plan quiz:

1. A new organic landing variant gets a clearer, more editorial promise and explicitly separates the free analysis from the optional paid plan. It becomes the only landing experience for the legacy quiz. The root uses it directly; retired campaign entry URLs resolve into this same calmer flow rather than preserving a third visible journey.
2. `legacy-quiz-v1` keeps its current ten question groups, factual answer fields, branching, draft behavior, lead API, and checkout boundary. It adopts the Personal Plan quiz's visual language and uses its concern and goal families on questions 9 and 10. Concern and goal values are translated into a shared diagnostic input; the existing legacy fields remain the persistence boundary.
3. The quiz remains a direct sequence. A single-select answer advances to the next existing question; multi-select answers retain one explicit Continue action. There are no commitment prompts, persuasion screens, midpoint profiles, loading commitments, or intermediate results.
4. Extract a small canonical diagnostic-input contract from the current Personal Plan hair assessment. The Personal Plan quiz and legacy quiz each adapt their native answer fields into it. Both funnels then use the same assessment and explanation-row logic, while retaining their own state machines, persistence envelopes, lead APIs, and checkout lifecycles.
5. The Personal Plan concern and goal sets are the source of truth with two deliberate corrections: add a separate `hair_damage` concern alongside `frizz_flyaways`, and make the visible volume goal neutral (`Ausgewogenes Volumen`) so its downstream direction is never the opposite of the wording shown to the user. The organic Frizz label becomes `Frizz oder viele abstehende Haare` while retaining its legacy-compatible projection.
6. The concern screen offers all shared concern families and no longer asks the visitor to pre-rank only three. Every selected concern is persisted; the assessment ranks the evidence and selects the three public rows. The goals screen uses and persists the Personal Plan's eight goal-family IDs—moisture, Frizz/surface, shine, strength/ends, scalp balance, manageability/styling, shape/definition, and volume balance—with no arbitrary five-item cap. Legacy-only `Gesünderes Haar` and `Farbschutz` values remain readable for existing drafts/results and continue to project into paid-plan logic, but they are not selectable for new starts.
7. A new owner-controlled offer variant renders the shared three-row Personal Plan diagnosis in the Personal Plan offer hierarchy. Because the photographic hero proof is removed, the plan highlights move directly after the diagnosis and before plan selection/pricing, so visitors see what they receive before choosing an option. It does not invent missing Personal Plan context answers or use the Personal Plan prepared-artifact/payment lifecycle.
8. The new organic offer omits the before/after hero image. Existing prepared Personal Plan artifacts remain immutable; only newly completed Personal Plan quizzes use the harmonized concern semantics.
9. Product architecture has exactly two user-visible quiz flows: (a) the Personal Plan quiz with its current one-time/membership commercial choices and (b) this calmer ten-question legacy quiz with one linear organic offer. Guided-story, locked, founder-letter, potential-score, app-value-stack, and default legacy offer surfaces receive no new traffic and no longer render as distinct experiences.
10. Historical funnel/package/offer IDs remain stored for attribution. Old result links resolve through compatibility aliases to the calmer organic offer, so no saved or emailed result link breaks. Analytics retains every non-null originally stored offer arm; historical null arms honestly resolve to `organic-plan-v1` rather than inventing a cohort. No database rows are rewritten.

The selected implementation is brand-first. The creator-specific handoff shown as a comparison in the mockup is deferred because the current funnel-package schema has no creator identity field and the landing has no creator-context seam. Influencer traffic uses the same organic landing and existing UTM/funnel attribution; adding approved creator identity or assets is a separate product decision and must not be invented during implementation.

`meta_routine_v1` and `scalp_check_placeholder` stop being active acquisition flows. `/lp/routine` newly redirects into the calmer organic entry while preserving safe campaign query parameters; `/lp/scalp-check`, which is currently reachable despite its placeholder status, becomes unavailable. `meta_personal_plan_v1` is the only campaign-specific quiz flow and retains its existing feature gates, prepared-artifact lifecycle, and one-time/membership pricing behavior.

## Scope and non-goals

### In scope

- A new root/default-organic landing variant that is also the destination for retired legacy campaign entry links.
- The shared `legacy-quiz-v1` route at `/quiz`, including mobile/desktop presentation, progress, transitions, lead capture, preparation, and recovery states.
- The shared concern and goal option families used by both the legacy and Personal Plan quizzes, including a separate `hair_damage` concern and clarified Frizz copy.
- A canonical diagnostic-input seam with explicit adapters from both native quiz answer contracts into the current Personal Plan assessment and explanation-row logic.
- A new linear organic offer variant for legacy quiz results.
- Funnel-package routing, compatibility aliases, offer revision/section tracking, and regression tests required to stop new legacy-variant assignment while preserving old result links and historical attribution.
- Retirement of the guided-story three-way experiment, its feature flag/assignment path, founder-letter and score presentation code, and obsolete labs/docs/tests that exist only for those offer surfaces.
- Reviewable browser evidence at narrow mobile widths and desktop.

### Must remain unchanged

- The `QuizAnswers` field names: `structure`, `thickness`, `density`, `hair_length`, `fingertest`, `pulltest`, `scalp_type`, `has_scalp_issue`, `scalp_condition`, `concerns`, `concerns_other_text`, `treatment`, and `goals`. Questions 1-8 keep their existing serialized values; questions 9-10 intentionally receive additive/mapped vocabulary changes.
- `QUIZ_QUESTION_STEPS`, conditional scalp behavior, `/api/quiz/lead`, `quiz_kind="legacy"`, result-artifact identity, profile linking, checkout/payment behavior, pricing catalog behavior, and authenticated-result behavior.
- The Personal Plan state machine, persuasion/context questions, lead/preparation flow, prepared-artifact ownership and locking, `/lp/haarplan`, pricing experiment, and offer-page composition. Existing prepared artifacts must continue to parse and render exactly as stored.
- Existing provider identifiers, entitlements, Personal Plan and legacy result-email flows, Customer.io delivery/consent semantics, and payment monitoring. Existing result links inside emails remain valid through the compatibility renderer; email copy/template changes are a separate follow-up.

### Explicit non-goals

- No new quiz screens, persuasion/context questions, answer field names, or independent scoring system. Concern/goal enums and their draft normalization intentionally change; this is an explicit exception to the earlier unchanged-values constraint.
- No unification of the legacy and Personal Plan quiz state machines.
- No synthetic defaults for `routineClarity`, `resultReliability`, `adaptationConfidence`, `previousAttempts`, `blockers`, `routineStyle`, or `meaningfulMoment` when the organic quiz has not asked them.
- No artificial urgency, countdown, scarcity, discount, forced assent, micro-commitment, or progressive reveal gate.
- No intermediate result, midpoint profile, or loading commitment screen.
- No before/after hero image in the new organic offer.
- No import or rendering of `src/components/quiz/result-offer-countdown.tsx` in the new offer.
- No checkout redesign, pricing change, deployment, experiment activation, result-email/template redesign, or production write in this task.

### Resolved product decision: no optional Personal Plan beats in this version

- On 2026-08-03, Nick chose to keep the compressed ten-question path and defer all omitted Personal Plan screens. There is no recurrence question, profile-summary screen, generic commitment, or loading commitment popover in this version.
- The recurrence question remains the strongest later candidate because it can affect diagnosis tie-break ordering, while a compact factual profile summary remains the strongest non-scoring payoff candidate. Either can be reconsidered as a separately reviewed follow-up.
- The Personal Plan loading visual system is retained without commitment popovers.

## Target map

### Landing

- `src/app/page.tsx`
- `src/app/lp/[slug]/page.tsx`, `src/lib/funnel/packages.ts`, and `src/proxy.ts` enforce active package status, route `/lp/routine` to the calm organic entry without issuing an archived funnel assignment, and make `/lp/scalp-check` unavailable.
- Add `src/funnels/landing/organic-refresh.tsx` and its generated landing-registry entry.
- Retain `src/funnels/landing/default.tsx` as an internal/template compatibility dependency: root currently imports it directly, the package generator uses it as its landing template, and archived package validation still expects the registered `default` landing ID. It is not selectable for a live public package after activation.
- Add or change a shared landing component only when `organic-refresh.tsx` cannot compose the approved hierarchy without it; every such edit must be named in the implementation contract before writing.

### Legacy quiz presentation

- `src/app/quiz/page.tsx`
- `src/app/quiz/layout.tsx`
- `src/components/quiz/quiz-question.tsx`
- `src/components/quiz/quiz-option-card.tsx`
- `src/components/quiz/quiz-progress-bar.tsx`
- `src/components/quiz/quiz-scalp-question.tsx`
- `src/components/quiz/quiz-concerns-question.tsx`
- `src/components/quiz/quiz-goals.tsx`
- `src/components/quiz/quiz-lead-capture.tsx`
- `src/components/quiz/quiz-preparation.tsx`
- Reuse `src/components/quiz/hair-portrait.tsx`, `src/lib/quiz/hair-portrait-assets.ts`, and the canonical assets under `public/images/quiz/hair-portrait/` rather than copying Personal Plan asset resolution.
- `src/lib/quiz/questions.ts`, `src/lib/quiz/types.ts`, `src/lib/quiz/normalization.ts`, and the draft/store seams update questions 9-10 to the approved shared visible choices while retaining all existing factual keys and values.
- `src/lib/quiz/validators.ts` accepts every unique displayed concern and goal; UI, normalization, lead API, and persistence all remove the old three-concern/five-goal truncation. The only maximum is the finite count of displayed options.
- Define quiz-owned concern and goal value unions rather than changing onboarding option ordering by accident. New q9/q10 starts persist the shared Personal Plan family IDs; old `ProfileConcern`/`Goal` values remain accepted as historical input.
- Add one explicit compatibility projection from quiz-owned values into the legacy `ProfileConcern`/`Goal` vocabulary used by paid routine, result narrative, profile/reactivation, and recommendation consumers. `manageability_styling` projects deliberately to the existing manageability/Frizz lane for legacy calculation, while the canonical diagnostic retains its distinct goal ID.
- Update the exhaustive/profile consumers reached by these types, including `src/lib/vocabulary/concerns-goals.ts`, `src/lib/agent/orchestrator/current-turn-context.ts`, `src/lib/recommendation-engine/care-balance/evaluators.ts`, `src/lib/quiz/need-lane.ts`, `src/lib/reactivation/profile-quiz-answers.ts`, `src/lib/quiz/link-to-profile.ts`, `src/lib/customerio/quiz-traits.ts`, and `src/app/profile/page.tsx`, only through the compatibility projection. Do not add the new quiz-only families to onboarding's selectable `GOALS` list.
- Keep `src/lib/onboarding/goal-flow.ts`, `src/lib/vocabulary/onboarding-goals.ts`, and `src/components/goals/goals-screen.tsx` on the existing profile/onboarding goal catalog. `src/components/quiz/quiz-goals.tsx` gets its own eight-family source so q10 changes cannot alter onboarding.
- Existing draft values map deterministically into the new visible goal families on resume. Historical leads/results are never rewritten, and `healthier_hair`, `color_protection`, and other old values remain accepted for historical reads and paid-plan computation even though they are hidden from new starts.

### Shared diagnostic taxonomy and assessment

- `src/lib/personal-plan-quiz/types.ts` adds `hair_damage` as a concern without merging or renaming `frizz_flyaways`.
- `src/components/personal-plan-quiz/quiz-data.ts` adds the Haarschäden card, keeps the improved Frizz wording, and uses neutral `Ausgewogenes Volumen` goal wording for every texture. No other Personal Plan screen is added or removed.
- Extract a canonical diagnostic input under `src/lib/quiz/` or `src/lib/personal-plan-quiz/` with the minimum fields consumed by the existing assessment: texture, thickness, density, goals, concerns, optional concern recurrence, length, surface, elasticity, treatments, scalp oiliness, and scalp concerns.
- Add explicit legacy-to-diagnostic and Personal-Plan-to-diagnostic adapters. Equivalent visible choices map to the same diagnostic concern/goal IDs even where the native persistence values differ (`dryness`/`dry_lengths`, `frizz`/`frizz_flyaways`, and the legacy goal names).
- Lock the factual legacy crosswalk in one fixture/table: `structure -> texture`; thickness and density unchanged; `hair_length -> hairLength`; `glatt|leicht_uneben|rau -> smooth|slightly_uneven|rough`; pull-test values unchanged; `natur|gefaerbt|blondiert|dauerwelle|chemisch_geglaettet -> natural|colored|lightened|permed|chemically_straightened`; `fettig|ausgeglichen|trocken -> oily|balanced|dry`; and `schuppen|trockene_schuppen|gereizt -> oily_dandruff|dry_dandruff|irritated`.
- Refactor `src/lib/personal-plan-quiz/hair-assessment.ts` and `assessment-copy.ts` to consume the canonical diagnostic input. Generic Haarschäden activates the structural/stability dimension with damage-specific copy; Frizz activates only the surface/Frizz dimension. Selecting both can make both rows eligible.
- Treat generic Haarschäden as an alternative primary signal for the existing structural/stability dimension, not a tenth dimension and not an additive second weight when Haarbruch is also selected. Prefer the more specific Haarbruch explanation when both are selected. Spliss remains its existing independent ends dimension, so Haarschäden and Spliss may both be eligible without double-counting one dimension.
- Version the assessment/public-offer model only if the persisted public model shape or interpretation changes; old Personal Plan prepared artifacts must remain readable without backfill. Do not force the organic route through `personalPlanPrepareRequestSchema`.
- Keep the existing Personal Plan prepared-plan composition for priorities/products/locked-plan construction. Update its actual mapping seam in `src/lib/personal-plan-quiz/offer-adapter.ts` so the existing `frizz_flyaways -> frizz` mapping remains and the new `hair_damage -> hair_damage` mapping is added independently.
- Preserve Personal Plan `concernRecurrence` as the optional canonical tie-break input. The legacy adapter supplies it as absent; the Personal Plan adapter supplies the stored value, so live Personal Plan row ordering cannot drift.

### Organic offer

- Add a dedicated offer variant under `src/funnels/offers/`, then run `npm run funnel:check -- --write` to regenerate the scan-owned landing/offer registries; never edit `registry.generated.ts` by hand.
- Build the organic public diagnosis from the shared assessment and `buildPersonalPlanAssessmentRows`, using only answers the organic visitor actually supplied. Continue to use the existing legacy guided-story/product seams where needed behind the paid-plan boundary; do not present those priorities as the public diagnosis.
- Reuse `src/components/quiz/result-offer-pricing.tsx` and `src/components/quiz/offer-tracking-provider.tsx` without changing checkout semantics.
- Register the new revision and retired-ID claim behavior in `src/components/quiz/offer-tracking-provider.tsx` and `src/lib/analytics/offer-tracking-claims.ts`; do not leave retired IDs on guided-story-only interaction semantics.
- Compose the new organic offer directly. Reuse already-public pricing, tracking, FAQ, and other isolated components where available, but do not extract sections from or refactor `src/components/personal-plan-offer/personal-plan-offer.tsx` in this task. Minor presentation duplication is accepted to avoid regression risk on the live Personal Plan revenue surface.
- Render the same three diagnostic-row model as the Personal Plan offer. The organic adapter may use a generic plan-fit statement because it does not collect the Personal Plan context answers; it must not fabricate those answers or claim they influenced the diagnosis.
- `src/funnels/packages.json` leaves only `default_organic` and `meta_personal_plan_v1` as active quiz flows. `meta_routine_v1` and `scalp_check_placeholder` become archived definitions so historical package keys remain valid for attribution, but they cannot create a distinct landing/quiz/offer journey.
- Add a compatibility alias table in `src/funnels/offers/registry.ts` (or an equally narrow owner seam) mapping `default`, `app-value-stack`, `guided-story`, `guided-story-locked`, `guided-story-founder-letter`, and `guided-story-potential` to the new calmer organic offer renderer. Keep the original stored ID in the offer/tracking props; only renderer selection is canonicalized.
- Remove active guided-story experiment resolution from `src/app/result/[leadId]/page.tsx` and `src/lib/funnel/server.ts`. New sessions use `organic-plan-v1`; old sessions keep their stored historical ID but render the compatibility alias. Delete `GUIDED_STORY_OFFER_EXPERIMENT_ENABLED`, assignment/hash/observability code, and dedicated founder/score offer files after source searches prove no remaining runtime caller.
- Retain only guided-story/app-value-stack calculation modules that still have a verified non-offer consumer, such as paid-plan preparation or result-artifact construction. Delete presentation-only components and tests once their imports reach zero; do not remove deterministic recommendation logic merely because its old offer UI is retired.
- `src/lib/analytics/offer-section-order.ts`, `src/lib/analytics/events.ts`, and offer tracking docs/tests explicitly register the new section order/IDs and revision. The implementation must not fall through to `DEFAULT_SECTION_ORDER`.

## Designed user journey

Status: explicitly signed off by Nick on 2026-08-03 with implementation authorization.

1. A visitor arrives on the brand-first regular landing page from search, a direct visit, or an influencer link. The page explains that the ten-question analysis is free and that a fuller routine/product plan is an optional paid next step. Attribution may differ, but the visible experience does not depend on a creator identity in this version.
2. The visitor starts `/quiz`. If a compatible local draft exists, the existing resume/new-start choice appears in the refreshed visual shell. Otherwise the first existing question appears immediately.
3. The visitor answers the same ten question groups in the same order. Visual questions use image or portrait cards; non-visual questions use compact option rows. Single answers auto-advance after restrained selection feedback. Multi-select questions show a selection count and one Continue action.
4. On the problems screen, the visitor can select every concern that repeatedly applies. The visible options match the Personal Plan concern families, with Haarschäden and Frizz as separate choices and texture-aware wording for definition and volume. On the goals screen, the visitor sees the Personal Plan's eight goal families, including neutral `Ausgewogenes Volumen`; there is no arbitrary three-concern or five-goal cap.
5. Progress is communicated as compact sections and the current question count. The system never asks the visitor to agree with a claim, confirm motivation, or view an intermediate result.
6. The visitor supplies name and email through the existing lead-capture steps. Consent remains a separate, optional marketing decision. Invalid or undeliverable email behavior, correction suggestions, retry, and back navigation remain intact.
7. The existing preparation state runs once in the Personal Plan visual language: animated progress, three truthful preparation stages, settled checks, and a ready state. It does not ask for a commitment or show a fabricated intermediate finding. Existing timeout and recovery behavior remain available, and reduced-motion users receive an immediate, non-animated equivalent.
8. The result route shows the three highest-priority rows selected by the same assessment used for new Personal Plan results. Each row explains the observed signal and useful direction. Generic Haarschäden and Frizz remain separate evidence families. No answer from an unasked Personal Plan context screen is inferred, and no before/after image is shown.
9. The page then presents the optional plan in a revised Personal Plan order: plan highlights first, then plan selection/pricing, method, supporting evidence/proof, testimonials, guarantee, FAQ, and final CTA. The full page is visible linearly; there are no “yes, continue” gates or progressively revealed chapters.
10. There are only two live entry families. `/lp/haarplan` continues into the existing Personal Plan quiz and its current one-time/membership offer logic. Root, direct, search, influencer, and retired `/lp/routine` entries resolve into this calmer ten-question flow; `/lp/scalp-check` remains unavailable rather than creating a third path.
11. A saved or emailed legacy result link remains valid. Its historical package and any non-null stored offer ID are preserved in storage and tracking, but every retired default/app-value-stack/guided-story/locked/founder-letter/potential-score ID selects the calmer organic renderer and section order. A historical null arm records `organic-plan-v1`. The visitor therefore never sees the founder letter or score page again, and no historical row is rewritten.
12. If the visitor chooses a plan, the existing Stripe/PayPal checkout opens with unchanged plan, legal, dismissal, retry, and entitlement behavior. If the visitor does not buy, the free result remains readable and reloadable through the existing result URL behavior.
13. Returning authenticated users with access continue through the existing paid-result/onboarding path; the new organic sales offer is not shown to them.

### Important recovery and accessibility states

- Draft resume versus new start.
- Back navigation across normal and conditional scalp substeps.
- Unlimited concern/goal selection, `Nichts davon`, and custom-concern behavior; selecting `Nichts davon` clears concern selections but not the free-text note unless the current contract intentionally preserves it.
- Invalid email, deliverability suggestion, request failure, and retry.
- Preparation access timeout and missing-lead recovery.
- Reduced-motion behavior, keyboard focus, screen-reader names, sticky action safe-area containment, and cookie-banner coexistence.
- Checkout loading, provider error, dismissal, and return-to-result behavior remain owned by existing checkout components.

## Mockup evidence

- Durable interactive full-flow prototype: [`2026-08-02-organic-influencer-full-flow-mockup.html`](./2026-08-02-organic-influencer-full-flow-mockup.html)
- Earlier three-screen comparison: [`2026-08-02-organic-influencer-funnel-mockup.html`](./2026-08-02-organic-influencer-funnel-mockup.html)
- Selected direction: compressed Personal Plan visual language and shared Personal Plan diagnostic core, adapted into the existing organic route/lead/checkout contract.
- Feedback incorporated:
  - removed intermediate-result messaging from the quiz;
  - explicitly excludes micro-commitments and additional screens;
  - expanded the offer hierarchy to follow the Personal Plan page;
  - removed before/after imagery from the proposed organic offer;
  - retained the existing ten question groups while explicitly harmonizing the concern and goal choices with the Personal Plan quiz.
  - revised every quiz and lead screen to use the Personal Plan quiz's visual card language: Personal Plan texture and thickness imagery, canonical texture-aware length portraits, semantic icon tiles for non-photographic options, richer test cues, and illustrated lead states while preserving the legacy content and values.
  - replaced the organic result/offer mockup with the current Personal Plan offer's section order and visual system. The photographic before/after hero figure is the sole removed visual; the later text-only transformation contrasts remain. The mockup's three diagnosis-style cards now represent the shared Personal Plan assessment rather than restyled legacy guided-story rows.
  - harmonized questions 9-10 around the Personal Plan concern and goal families; Haarschäden and `Frizz oder viele abstehende Haare` are separate, concerns/goals allow all applicable selections, and the volume goal uses neutral wording.
  - moved `Die Highlights deines Plans` above plan selection/pricing because the photographic hero proof is absent;
  - aligned the preparation mockup and screen transitions with the Personal Plan motion language while explicitly omitting loading commitment popovers and preserving reduced-motion behavior.
  - confirmed the final compressed version does not add recurrence, profile-summary, or commitment screens; those ideas are deferred for possible later testing.
  - consolidated the product to exactly two user-visible quiz flows. Founder-letter, potential-score, locked, guided-story, app-value-stack, and default legacy offer pages are retired; old result IDs remain attribution-only compatibility inputs to the calmer offer.
- Full-flow coverage: landing sections, draft recovery, all ten question groups and the conditional scalp subflow, the harmonized problems/goals screens, name/email/optional consent, invalid-email recovery, preparation, three Personal Plan-style diagnosis rows, the complete linear offer hierarchy, and the unchanged pre-payment checkout boundary.
- Selected entry treatment: brand-first. The creator-handoff toggle remains in the planning artifact only as a reviewed/deferred comparison and is not implementation scope.
- Mockup review status: confirmed. On 2026-08-03, Nick approved the complete landing and quiz direction, harmonized q9/q10 screens, highlights-before-pricing offer order, and Personal Plan-style preparation/loading motion without commitment popovers.

## Recommended delivery shape

Status: confirmed by Nick on 2026-08-03 together with final journey sign-off and implementation authorization.

- PR A is additive and not user-visible: introduce support for the quiz-owned q9/q10 taxonomy, historical projections, canonical diagnostic input including `hair_damage`, optional recurrence preservation, and regression fixtures. It does not expose the new Personal Plan concern/card copy or activate the organic landing, quiz styling/options, offer, routing, or retirement.
- PR B is one coherent public switch: expose the approved Personal Plan Haarschäden/Frizz correction and neutral volume wording; add the approved organic landing/quiz/offer presentation; activate `organic-plan-v1`; retire old entry packages and experiment assignment; map saved legacy result IDs to the calm renderer; and prune presentation-only legacy surfaces.
- PR A must be deployed and verified before PR B is merged. Until PR B activates, the existing user-visible funnels remain unchanged; after PR B activates, exactly two user-visible flows exist. Do not deploy a partial PR B state.
- This keeps the risky shared diagnostic refactor independently reversible while avoiding a temporary third public funnel. It does not make landing-versus-quiz-versus-offer conversion impact separately attributable; that is an accepted tradeoff of launching the reviewed organic journey as one coherent experience.

## Ordered tasks

### 1. Lock the unchanged route contract and the intentional taxonomy delta

- Add a contract fixture asserting the exact ordered question steps, factual answer keys/values for questions 1-8, conditional scalp fields, lead payload kind, and result-route handoff.
- Add explicit fixtures for the approved quiz-owned concern/goal sets, all-option lead validation, old-draft normalization, and deterministic projection into legacy paid-plan/profile vocabulary. Make the intentional q9/q10 additions visible rather than hiding them behind a generic unchanged-contract claim.
- Preserve `healthier_hair`, `color_protection`, old dryness/Frizz codes, and every other historical concern/goal value on the read path. New starts write only the approved shared-family IDs, and existing routine-planner/narrative/need-lane output for historical fixtures stays byte-for-byte stable where serialized.
- Completion criterion: a deliberately changed factual key/value/order or lead kind fails, while every approved old draft maps deterministically and historical result fixtures remain unchanged.

### 2. Build the compressed visual shell and harmonized concern/goal screens

- Introduce reusable section progress and visual option presentation for the legacy quiz.
- Reuse canonical portrait assets for structure and other genuinely visual choices; use compact rows for questions where imagery would add ambiguity.
- Keep current single-select and multi-select behavior, but reduce the single-select transition to the approved restrained timing and honor `prefers-reduced-motion`.
- Reuse the Personal Plan's direction-aware forward/back screen motion, option-selection settle, multi-select count feedback, progress-settle behavior, and restrained timing. Do not copy payoff/intermediate-result animations into screens that the organic flow does not contain.
- Replace question 9's visible choices with the shared concern families, keep Haarschäden and Frizz separate, use the approved Frizz copy, and allow every applicable selection. Remove the UI, normalizer, and lead-schema cap together; never accept a choice in the browser and silently drop it before persistence.
- Give q10 a quiz-owned eight-family option source, separate from onboarding. Allow every applicable goal and persist each shared family ID; remove the old UI/normalizer/schema five-goal cap together. Neutral volume wording keeps one `volume_balance` selection in the diagnostic input, while its legacy paid-plan projection remains factual-profile-dependent.
- Migrate/resume old local drafts without silently turning an old aspiration into a current problem. Preserve historical-only values for result reloads even when they are no longer selectable for new starts.
- Refresh lead, consent, preparation, draft-resume, and error states in the same shell. Restyle the existing organic `QuizAnalysis` lifecycle with the Personal Plan loading card, animated progress/stage checks, ready state, and error/retry treatment, but keep its truthful readiness gate and omit all commitment overlays.
- Completion criterion: questions 1-8 yield the same values; q9/q10 yield the approved harmonized projection; old drafts recover deterministically; and all states match the approved mobile hierarchy at 320 px and 390 px.

### 3. Share the Personal Plan diagnosis without sharing quiz state machines

- Define the minimal canonical diagnostic input and write adapter fixtures for equivalent legacy/Personal Plan answer sets.
- Add `hair_damage` to the Personal Plan concern screen and assessment. It activates structural-damage evidence and damage-specific explanation copy; `frizz_flyaways` remains isolated to surface/Frizz evidence.
- Change the visible Personal Plan volume goal to neutral `Ausgewogenes Volumen`; keep any more/less legacy projection evidence-based and never contradict visible copy.
- Refactor the assessment and explanation-row functions to consume the canonical input, including optional `concernRecurrence`, thickness, and density. Do not create fake answers for unasked organic context questions or route organic leads through the Personal Plan preparation API.
- Preserve old prepared artifacts and backfill parsers. Update Customer.io labels, draft validators, profile summaries, offer adapters, exhaustive masks, and focused tests for the additive concern value.
- Prove the exactly-three-row invariant explicitly: mandatory surface, elasticity, and scalp answers always provide active or positive-eligible dimensions. A future change that makes one optional must fail a focused contract test before it can cause the result renderer to throw.
- Completion criterion: equivalent core answers from both quizzes produce identical dimension evidence and three public rows when optional recurrence is absent or equal; Personal Plan recurrence still breaks ties exactly as before; Haarschäden+Frizz can coexist without structural double-counting; old Personal Plan artifacts and V2/V3 data still parse; and no organic artifact contains invented context answers.

### 4. Add the isolated organic landing variant

- Add the `organic-refresh` landing hierarchy and copy to distinguish the free analysis from the optional plan.
- Retain one primary CTA contract and current landing analytics.
- Keep creator-specific copy/data out of scope. Route root/direct and organic/influencer traffic to this landing; make `/lp/routine` resolve into the same calmer entry while preserving allow-listed attribution query parameters, and leave `/lp/scalp-check` unavailable.
- Archive `meta_routine_v1` and `scalp_check_placeholder` as non-selectable package definitions rather than deleting their historical keys. Add actual status enforcement because package status is currently descriptive only: active slug lookup may render, `/lp/routine` uses an explicit migration redirect, and the archived scalp placeholder returns not-found. Keep `/lp/haarplan` and the Personal Plan package unchanged.
- Completion criterion: root/direct, organic/influencer UTM, and retired `/lp/routine` entries resolve into one visible legacy landing/quiz/offer journey with correct attribution; `/lp/scalp-check` cannot start a quiz; and `/lp/haarplan` still renders the Personal Plan flow.

### 5. Create the linear organic plan offer from the shared diagnosis

- Add the new owner-controlled offer variant and offer revision.
- Render the exactly-three shared diagnostic rows together without tabs, continue buttons, or progressive reveal.
- Use the Personal Plan section hierarchy while composing the organic offer independently of the live Personal Plan component.
- Place `personal_plan_complete_plan` immediately after the diagnosis and before `pricing`; register and test this revised section order explicitly.
- Omit the before/after hero image and do not route the organic lead through the Personal Plan prepared-artifact lifecycle.
- Do not import or render `result-offer-countdown.tsx`.
- Keep pricing and checkout components unchanged.
- Completion criterion: representative legacy answer fixtures and the sparsest valid organic answer set render exactly three diagnostic rows; the sparse fixture currently resolves to the neutral scalp, surface, and stability rows. Equivalent cross-quiz fixtures match when recurrence is absent/equal, and the complete linear offer contains no hidden/reveal-gated content.

### 6. Enforce two live flows and retire legacy offer surfaces safely

- Register `organic-refresh` and `organic-plan-v1` with `npm run funnel:check -- --write`; configure `default_organic` to use them and allow only `default_organic` plus `meta_personal_plan_v1` to create live quiz journeys.
- Remove guided-story experiment assignment/resolution and its flag. New legacy sessions persist `organic-plan-v1`; they never receive a default, app-value-stack, guided-story, locked, founder-letter, or potential-score offer ID.
- Add one compatibility resolver at the offer-registry boundary. Every retired legacy offer ID resolves to the `organic-plan-v1` component while the original non-null stored ID remains the analytics/attribution value passed into tracking. Do not mutate existing `funnel_sessions`, leads, or result artifacts. A historical session whose `offer_variant` is null legitimately resolves and records `organic-plan-v1`; the plan does not invent an arm it never stored.
- Extend the server event seam narrowly so the result route can pass the trusted, database-resolved session offer ID into `recordFunnelEventWithRpc`; browser cookie events still use their package definition. Test that reopened stored arms emit their historical ID and that null arms emit `organic-plan-v1`.
- Resolve section order through the same canonical renderer mapping: retired IDs use the new organic section order and revision rather than `DEFAULT_SECTION_ORDER`, while emitted event context continues to contain the historical stored offer ID.
- Remove founder-letter, potential-score, and other presentation-only legacy offer components, labs, experiment helpers, docs, and tests after a zero-import/source check. Current source shows the guided-story preview tree has only the retired guided-story renderer as a non-test consumer, so delete that tree and its dedicated presentation tests unless implementation finds a new current consumer. Preserve lower-level deterministic routine/planner logic that still serves paid plans.
- Keep result-email copy, delivery/consent semantics, and paid-routine return behavior unchanged in this task. Links inside old and new emails resolve through the calmer compatibility renderer.
- Document rollback at both boundaries. Reverting PR B restores the previously live funnels but leaves PR A's additive, non-visible compatibility support in place; reverting PR A as well restores the prior shared diagnostic code. Any rollback is a reviewed redeploy, not an ad hoc reactivation of founder-letter or score cohorts; there is no runtime kill switch in scope.
- Completion criterion: package validation exposes exactly two live quiz journeys; new legacy sessions store only `organic-plan-v1`; every retired/pinned non-null result fixture renders the calmer offer while preserving its original tracking ID, null fixtures record `organic-plan-v1`, founder-letter and score copy/DOM are absent, and `/lp/routine`, `/lp/scalp-check`, `/lp/haarplan`, root, and old result URLs all satisfy the routing contract above.

### 7. Verify the complete rendered journey

- Run focused unit/component tests, typecheck, lint, and affected Playwright journeys.
- Complete a synthetic legacy quiz at 320 px, 390 px, and desktop, then inspect the canonical result and checkout pre-payment boundary.
- Test one conditional scalp issue, no scalp issue, multi-treatment, no concern/custom concern, email correction, draft resume, browser Back, reduced motion, cookie banner, and returning-access path.
- Confirm no horizontal overflow, clipped action, console error, failed request, duplicate lead, or duplicate offer section.
- Completion criterion: screenshots and journey notes match the approved mockup and designed journey; any physical-device gap is stated explicitly.

## Verification

### Automated

- Focused quiz contract and normalization tests.
- `tests/quiz-option-card.test.tsx`
- `tests/quiz-motivation-copy.test.ts`
- `tests/quiz-draft.test.ts`
- `tests/quiz-lead-lifecycle.test.ts`
- Quiz q9/q10 option-source, all-selection schema/normalization, historical projection, profile/reactivation, need-lane, result-narrative, and routine-planner regression tests. Apply the repo's required test-first workflow to `src/lib/routines/planner.ts` if its compatibility seam changes.
- `tests/personal-plan-quiz.test.ts`
- `tests/personal-plan-quiz-server-draft.test.ts`
- `tests/personal-plan-hair-assessment.test.ts`
- `tests/personal-plan-prepared-plan.test.ts`
- Cross-quiz diagnostic-equivalence fixtures covering every shared concern/goal family, Haarschäden+Frizz together, volume wording/projection, the exact factual value crosswalk, recurrence absent/equal, the sparsest valid organic answer set, and old draft/result compatibility.
- New organic offer component/section-order/tracking tests.
- Compatibility fixtures for every retired legacy offer ID, proving the calmer renderer/section order is selected while the original stored ID remains in analytics context.
- Negative source/render assertions proving no new session receives or displays the founder-letter, potential-score, locked, guided-story, app-value-stack, or default legacy surface.
- Route/package tests proving exactly two live quiz journeys: calm organic at root and retired `/lp/routine`, unavailable `/lp/scalp-check`, and unchanged Personal Plan at `/lp/haarplan`.
- `tests/funnel-packages.test.ts`
- `tests/funnel-variants.test.ts`
- `tests/funnel-server.test.ts`
- `tests/offer-experiment.test.ts` is deleted or rewritten around retirement; no active guided-story assignment assertion remains.
- `tests/funnel-cookie.test.ts`
- `tests/analytics-tracking.test.ts`
- `tests/billing-analytics-destinations.test.ts`
- `tests/stripe-checkout-session-params.spec.ts`
- `npm run funnel:check`
- `tests/result-page-client.test.tsx`
- `tests/result-offer-pricing-tracking.test.ts`
- `tests/offer-section-engagement.test.ts`
- `tests/quiz-onboarding-e2e.spec.ts`
- `tests/quiz-result-routing.e2e.spec.ts`
- `npm run typecheck`
- `npm run lint`

### Manual/browser

- Current/proposed screenshot comparison at 320 px, 390 px, and desktop.
- Full synthetic visitor journey from each relevant landing entry through the pre-payment checkout boundary.
- Old saved-result fixtures for every retired offer ID, confirming all reopen into the calmer offer with no founder-letter or score content.
- Direct comparison of equivalent organic and Personal Plan core-answer fixtures, including separate structural-damage and surface/Frizz rows.
- Reload and return-link checks on the created result.
- No payment submission.
- Physical iPhone Safari/Chrome remains a residual verification item if not available during implementation.

### Migration/live-state

- No database migration or production write is expected. The implementation must prove that the additive concern/goal vocabulary fits existing JSON storage and that old envelopes/artifacts remain parseable; if current persisted-version guards cannot support that safely, stop and revise the plan before introducing a version migration.
- Package/variant activation occurs only through the reviewed code release. Merge does not imply deployment.
- Existing PostHog/Meta event names and provider checkout metadata remain unchanged unless a new offer revision property is explicitly required.
- For historical sessions with a stored non-null retired offer ID, reopened result events retain that ID while renderer/section order use `organic-plan-v1`. Historical null arms record `organic-plan-v1`; no cohort is fabricated. Dashboard labels and queries must document this boundary.
- Rollback is a reviewed code/config revert plus redeploy, not a runtime flag.

### Evidence-sensitive review

- `ready-check` owns repo and rendered-journey readiness.
- `request-code-review` owns the final whole-branch review.
- Reviewer findings that propose new screens, urgency, synthetic context answers, or Personal Plan lead/payment-lifecycle adoption must be classified as product/scope decisions and not accepted silently.

## Review and handoff

- Worktree: `.worktrees/organic-influencer-funnel-refresh`
- Branch: `codex/organic-influencer-funnel-refresh`
- Planning artifacts: commit the plan and approved HTML mockup with PR A; PR B links back to the same approved artifacts and implements the activation/retirement half.
- Transient screenshots and counterpart-review output: discard after recording accepted findings unless Nick asks to retain them.
- Mockup review: confirmed for the landing, full quiz shell, revised harmonized q9/q10 screens, highlights-before-pricing result/offer, and preparation/loading motion.
- User-journey sign-off: confirmed on 2026-08-03 after the two-flow retirement/compatibility walkthrough; old result-link behavior and the two-stage delivery structure were included in the implementation authorization.
- Counterpart review: fresh read-only review completed after the two-flow retirement revision; grounded blockers and tradeoffs are reconciled below.
- Implementation begins only through `implementation-loop` after mockup confirmation, counterpart findings reconciliation, and explicit user-journey sign-off.
- Publication, merge, deployment, experiment activation, and production writes are outside this planning handoff.

## Counterpart findings ledger

| ID  | Type                   | Evidence                                                                                                                                                                          | Decision                        | Plan change                                                                                                                                                                                        | Revalidation                                                                        |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| C1  | scope/product decision | Funnel package types and `DefaultLandingVariant` have no creator identity/context seam.                                                                                           | accepted: defer                 | Removed creator handoff from implementation; selected brand-first and retained existing attribution only.                                                                                          | Confirm in final journey sign-off.                                                  |
| C2  | defect                 | Generated registries are scan-owned; `npm run funnel:check -- --write` is the supported update path.                                                                              | accepted                        | Added the exact generator command and verification.                                                                                                                                                | Run `npm run funnel:check`.                                                         |
| C3  | defect                 | Unregistered variants silently use `DEFAULT_SECTION_ORDER`; new IDs must also exist in `OfferSectionId`.                                                                          | accepted                        | Made explicit analytics union/order wiring a task and acceptance criterion.                                                                                                                        | Focused section-order/tracking tests.                                               |
| C4  | defect                 | Current guided-story offer consumes `buildQuizGuidedStoryPreview`, which guarantees the presentation-ready three priorities.                                                      | superseded by user direction    | The new organic offer uses shared Personal Plan assessment rows. Retired offer IDs use compatibility rendering; keep the old calculation contract only where a non-offer runtime consumer remains. | Zero-import/source proof plus new cross-quiz diagnostic-equivalence fixtures.       |
| C5  | tradeoff               | Extracting large sections from the live Personal Plan component risks an unrelated revenue-surface regression.                                                                    | accepted                        | Chose independent organic composition with limited reuse of existing public components.                                                                                                            | Personal Plan focused suite remains unchanged and passes.                           |
| C6  | scope/product decision | `meta_routine_v1` shares `/quiz` but has its own landing/offer package.                                                                                                           | resolved by user direction      | Archive it as a distinct acquisition package and make `/lp/routine` resolve into the same calmer organic flow, leaving only two live quiz journeys.                                                | Route/package tests plus final journey sign-off.                                    |
| C7  | defect                 | Package config changes do not alter already locked offer snapshots; the plan's “new sessions” wording was imprecise.                                                              | accepted with compatibility     | Preserve the stored pinned ID but canonicalize renderer and section-order selection so old links show the calmer offer without rewriting attribution.                                              | Test pinned/unpinned fixtures and original tracking IDs.                            |
| C8  | defect                 | No runtime flag exists for the package swap.                                                                                                                                      | accepted                        | Added explicit config-revert-and-redeploy rollback.                                                                                                                                                | Verify rollback diff in release checklist.                                          |
| C9  | defect                 | A countdown component exists near the reused offer stack despite urgency being out of scope.                                                                                      | accepted                        | Explicitly prohibited importing/rendering it.                                                                                                                                                      | Source assertion and rendered DOM check.                                            |
| C10 | scope/product decision | A July offer-page exploration recorded three concepts as pending, while also recording “no score” and moving founder story away from the page.                                    | superseded by current direction | The 2026-08-03 reviewed mockup is the source direction; Nick explicitly sunsets all older legacy offer pages. Existing result-email content remains outside this task.                             | Final two-flow journey sign-off.                                                    |
| C11 | scope/product decision | Nick explicitly chose harmonization based on the new quiz and a new-quiz-derived offer diagnosis, with Haarschäden and Frizz separate.                                            | accepted                        | Replaced the visual-only/legacy-priority plan with a shared diagnostic input, harmonized q9/q10 choices, and Personal Plan assessment rows for the organic offer.                                  | Fresh counterpart review, revised q9/q10 mockup review, and final journey sign-off. |
| C12 | defect                 | `buildPersonalPlanAssessmentRows` requires exactly three selected dimensions; sparse organic answers needed proof.                                                                | accepted and verified           | Added the sparsest valid organic fixture to the plan. A current-source check produced scalp, surface, and stability neutral rows.                                                                  | Commit the fixture and keep the three-row assertion in offer tests.                 |
| C13 | defect                 | Personal Plan recurrence can break a ranking tie while the organic quiz does not collect recurrence, so unconditional cross-quiz row identity was overclaimed.                    | accepted                        | Scoped equivalence to cases where recurrence is absent or equal; recurrence remains optional and no organic screen is added.                                                                       | Cross-quiz fixtures plus a Personal Plan recurrence-only ordering fixture.          |
| C14 | scope/product decision | The reviewer proposed deferring the q1-q8 visual refresh.                                                                                                                         | rejected                        | Nick already reviewed the full-flow visual refresh, said the rest was fine, and explicitly asked to apply the new quiz styling across those screens.                                               | Retain the approved full-flow browser checks.                                       |
| C15 | scope/product decision | Generic Haarschäden could overlap with Haarbruch and Spliss in the structural assessment.                                                                                         | accepted with semantics         | Haarschäden is separately selectable but an alternative signal for the existing structural dimension. It does not add a second weight beside Haarbruch; Spliss remains independent.                | Exhaustive Haarschäden/Haarbruch/Spliss/Frizz combination tests.                    |
| C16 | defect                 | Neutral volume wording changes live Personal Plan copy and needs projection proof.                                                                                                | accepted                        | Kept neutral wording as the smallest fix for the current visible-copy/projection mismatch and added direct projection fixtures across factual profile cases.                                       | Personal Plan rendered-copy test plus adapter fixtures.                             |
| C17 | defect                 | The plan named `prepared-plan.ts` as the concern mapping site, but the concrete map is in `offer-adapter.ts`.                                                                     | accepted                        | Corrected the target and added `hair_damage -> hair_damage` beside the current `frizz_flyaways -> frizz` mapping.                                                                                  | Focused offer-adapter fixture.                                                      |
| C18 | scope/product decision | Nick wants exactly two quiz flows and explicitly sunsets the founder-letter and score/potential experiences along with the other legacy offer variants.                           | accepted                        | Added package retirement, old-entry routing, compatibility rendering for saved results, removal of active experiment assignment, and presentation-code pruning.                                    | Fresh counterpart review, route/compatibility tests, and final journey sign-off.    |
| C19 | defect                 | Q9 is capped at three in UI metadata, normalization, and the lead API; q10 is capped at five in UI, normalization, and schema.                                                    | accepted                        | Remove every cap together, persist all unique displayed selections, and add all-option lead fixtures; no accepted browser choice may be silently truncated.                                        | UI/store/schema/lead lifecycle tests with all options selected.                     |
| C20 | defect                 | Three Personal Plan concern families and the manageability goal have no lossless current legacy persistence value, and the current goal source is shared with onboarding.         | accepted                        | Introduce quiz-owned new-start family IDs plus an explicit legacy-calculation projection; fork q10's option source and preserve onboarding/profile catalogs.                                       | Typecheck plus exhaustive projection/onboarding regression fixtures.                |
| C21 | defect                 | Removing `healthier_hair` from new choices can alter paid routine, need-lane, and result-narrative logic if the historical read path is contracted in the same release.           | accepted                        | Hide it only for new starts; keep historical values readable and preserve their existing deterministic outputs through fixtures.                                                                   | Routine/need-lane/narrative historical fixtures.                                    |
| C22 | defect                 | The proposed canonical diagnostic input omitted Personal Plan `concernRecurrence`, thickness, and density even though assessment ranking/volume logic consumes them.              | accepted                        | Add all three; recurrence remains optional and is absent only in the organic adapter.                                                                                                              | Personal Plan ordering fixture with a recurrence-only tie break.                    |
| C23 | defect                 | Server funnel events currently write the package's current offer variant, not a stored session arm; historical null sessions were never pinned.                                   | accepted with honest boundary   | Pass a trusted DB-resolved non-null variant for result events; keep package fallback for null arms/browser events and state that null history becomes `organic-plan-v1`.                           | RPC argument fixtures for stored retired, null legacy, and Personal Plan sessions.  |
| C24 | defect                 | Package `status` currently does not gate slug lookup, so `/lp/scalp-check` is reachable and archiving `/lp/routine` alone would not retire it.                                    | accepted                        | Enforce active slug lookup, add the explicit routine migration redirect, and make the scalp placeholder return not-found.                                                                          | Route/package tests for all three slugs and safe query preservation.                |
| C25 | defect                 | Experiment/package IDs appear in broader funnel, cookie, analytics, billing, and checkout fixtures; the guided-story preview tree is presentation-only once its offer is retired. | accepted                        | Expanded the regression list and made deletion/rewrite of obsolete guided-story presentation tests part of the zero-import cleanup.                                                                | Full focused list, source search, typecheck, and lint.                              |
| C26 | tradeoff               | One release would mix a shared Personal Plan diagnostic refactor with every visible organic change and offer retirement, with revert-only rollback.                               | accepted by Nick                 | Use an additive non-visible foundation PR followed by one coherent organic activation/retirement PR; never expose a partial second PR.                                                             | PR-A production verification, then PR-B readiness gate.                             |
