# Personal Plan Hair Tools — production-current implementation plan

Status: approved implementation handoff on 2026-08-21 against successful production/main SHA `2efd080afe9af98fb4b41d54c3d26a5446b6bd95`. The newer commits since the reviewed Personal Plan baseline affect only Product Scan and Vercel deployment configuration; they do not alter this journey. Nick reviewed the revised mockup, resolved every product/architecture fork, confirmed the designed Stage 1–5 journey by explicitly requesting implementation handoff, and authorized implementation in this task worktree. Commit, push, PR, merge, deployment, production migration, catalog publication, and rollout activation remain separate gates.

## Outcome

Integrate Hair Tools into the released five-stage Personal Plan without treating durable assets like consumable care products, inventing what the user owns or how they currently use it, or weakening the current exact-product authority.

The user should receive:

- a compact, product-led Tool recommendation in the Idealplan;
- one paginated visual inventory flow backed by eight recognizable Tool categories;
- `Nutze deins` when a broadly reported Tool safely covers the route;
- one exact option plus a genuinely different alternative when a route is missing;
- one deduplicated `Deine Tools` section in Routine;
- proactive Tool guidance inside the normal Anwendung sequence.

## Durable authorities

The prior planning artifacts were recovered from the older planning worktree and preserved in this current worktree. They remain the category-policy base; this plan owns the production-shape reconciliation.

| Artifact                                                               | Authority                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `docs/personal-plan/categories/tools/decision.md`                      | confirmed need tiers, routes, ownership, lifecycle, safety, and 123 deterministic fixture intents |
| `docs/personal-plan/categories/tools/conditional-guidance-matrix.md`   | category-by-category conditional guidance and cross-category deduplication decisions              |
| `docs/personal-plan/categories/tools/option-pool.md`                   | eight product-named categories and recognizable product types beneath them                        |
| `docs/personal-plan/categories/tools/product-spec.md`                  | canonical multi-capability Tool facts and route-readiness requirements                            |
| `docs/personal-plan/categories/tools/evidence.md`                      | evidence strength, conservative claims, and medically adjacent boundaries                         |
| `docs/personal-plan/categories/tools/product-candidates.md`            | proposed, unapproved exact-product research pool                                                  |
| `plans/mockups/2026-08-12-personal-plan-hair-tools-current-shape.html` | current-shape review artifact                                                                     |

The older documents' stage labels and release assumptions are subordinate to this plan where they conflict with current production.

## Production baseline — verified 2026-08-21

- GitHub's latest successful Production deployment records exact SHA `2efd080afe9af98fb4b41d54c3d26a5446b6bd95`, created 2026-08-21 14:24 CEST; this worktree was fast-forwarded to that SHA before handoff. The commits after the reviewed `c999cd53` baseline change only Product Scan flows and Vercel deployment configuration; they do not alter Personal Plan behavior or the target map.
- `/lp/haarplan` serves the live Personal Plan quiz. An unauthenticated `/plan-start` correctly redirects to `/quiz`; authenticated Stage 1–5 behavior was therefore inspected from the exact deployed source plus the repository's production-shaped Labs fixtures, not claimed from an unauthenticated browser.
- Personal Plan Stage 1–4 and the app rollout are now canonical-on: `release.ts` deliberately ignores the obsolete app/stage launch flags. Stage 5 is available to every eligible Personal Plan owner. The old “app off / Stage 5 off” assumptions in the August 12 plan are retired.
- Remaining live switches relevant to this plan are narrower: product thumbnails are enabled; regular-quiz cutover and Stage-3 inventory-authority-v2 are not enabled. They do not gate the five-stage app itself.
- The live Stage 1 Idealplan now shows concrete catalog products with price and detail sheets, groups multiple roles by each role's own `Basis`/`Optional` tier, and offers a direct-accept fast path after the Idealplan.
- The direct-accept fork discloses synthetic Stage-2 defaults, activates the normal Routine, and leaves a refinement nudge. It currently assumes air drying, no heat tools, gentle microfiber handling, and no Night Protection.
- Stage 3 now uses coverage-ranked exact recommendations and explicit fit comparisons. Choosing a catalog product means it is immediately a full Routine member; there is no purchase-confirmation or provisional-product state.
- Stage 4 canonically activates the initial Routine and renders `Deine Basis`, `Optional`, then `Später ergänzen`. Stage 5 is a day overview with product shelves and ordered application blocks.
- Cross-stage mobile navigation, readable chapter transitions, safe-area action containment, and the product-first hierarchy are current contracts, not optional polish.

## What production changes in the Tools design

| Earlier assumption                      | Current contract                                                  | Tools consequence                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Stage 1 shows generic product examples  | Stage 1 shows concrete care products and can be accepted directly | Tool types stay visibly separate from exact care-product cards and need an honest fast-path state         |
| Every user reaches Stage 2              | The user may choose `Plan direkt übernehmen`                      | Tools must not depend on interactive inventory to create a coherent Routine                               |
| Planned products wait for acquisition   | A selected exact product is immediately a Routine member          | An exact Tool selected in Stage 3 follows the same immediate-membership rule; no purchase-confirmation UI |
| App/stages are release-gated            | Five-stage Personal Plan is released                              | Tools require their own bounded rollout gate rather than reusing retired stage flags                      |
| Stage 4 can foreground a new plan block | Routine has a compact product-first hierarchy                     | `Deine Tools` comes after all product sections and remains compact                                        |
| Stage 5 was mainly a step list          | Anwendung now has a day overview, shelf, then detailed steps      | Tools appear in a compact day-level set and again only where a step needs them                            |

## Confirmed category structure

Hair Tools is one user-facing and engine-level umbrella with eight product-led families. It is a **parallel Tool domain**, not an eleventh care-product enum member: implementation must not add `tools` to `STAGE1_CATEGORY_ORDER`, `PERSONAL_PLAN_PRODUCT_CATEGORIES`, `personalPlanCategorySchema`, or their exhaustive care-product consumers. The curated catalog may still use the separate database key `product_categories.key = 'tools'`. Jobs and purposes are mappings; they are never the subcategory labels.

| User-facing family                 | Recognizable forms in V1                                           | Main engine role                                 |
| ---------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| Haartrockner & Luftstyler          | Föhn, Diffusor, Konzentrator, Föhnbürste, Heißluft-Multistyler     | drying, airflow shaping, pre-dry                 |
| Hitzestyling-Tools                 | Glätteisen, Lockenstab/-zange, Welleneisen, Thermowickler          | straightening, curl/wave creation, heated volume |
| Heatless Styling & Setzen          | heatless band, Wickler, Flexi-Rods, former/set                     | heatless curl/wave/volume route                  |
| Bürsten & Kämme                    | grobzinkiger Kamm, Entwirrbürste, Styling-/Rundbürste, Verteilkamm | detangling, distribution, shaping                |
| Clips, Haargummis & Fixierhilfen   | sectioning clips, soft ties, scrunchies, securing aids             | sectioning and low-tension securing              |
| Wasch- & Auftragshilfen            | scalp brush, applicator bottle/comb                                | targeted wash or product application             |
| Nachtschutz                        | bonnet, pillowcase, loose tie/pineapple, length/tip cover          | optional low-friction containment                |
| Handtücher & Trocknungsmaterialien | microfiber towel/wrap, soft T-shirt, turban/wrap                   | gentle water removal, optional plopping          |

Non-jobs remain unchanged: no cutting tools, extensions/wigs, medical hair-loss devices, diagnostic claims, scalp-cooling devices, water-treatment devices, or generic standalone `Protection` family in V1.

## Cross-stage state contract

### Recommendation resolution

Every active route resolves to exactly one of:

- `behavior_only`: useful guidance with no required physical Tool, for example gentle pressing instead of rubbing;
- `tool_type`: a recognizable generic form is sufficient, for example a grobzinkiger Kamm;
- `exact_tool`: a verified catalog identity is selected because compatibility, attachment, safety, or protocol facts matter.

### Ownership and execution

Keep these states distinct across every stage:

1. `unknown` — inventory was skipped or not yet answered;
2. `explicit_none` — user confirmed no qualifying Tool;
3. `owned_generic` — a broad product type/capability was reported, but no model is known;
4. `selected_exact` — the user selected a verified catalog Tool; under current product semantics it is immediately a Routine member;
5. `owned_exact` — an exact identity is known from a later supported path;
6. `catalog_gap` — a route is legitimate but no exact candidate clears readiness;
7. `executable_occurrence` — the route may compile into Anwendung.

`unknown` never becomes `explicit_none`, `owned_generic`, or `selected_exact`. Opening a product detail, affiliate link, or alternative never changes state.

### One physical Tool, several jobs

One physical product owns one asset identity and one visible Routine row. Capabilities and application occurrences are arrays. A hot-air multi-styler may cover airflow shaping, curl creation, and volume without three cards, three shopping items, or three ownership decisions.

Tool assets are durable and are explicitly outside consumable-product machinery:

- no depletion cadence, replacement cadence, “läuft bald aus” nudge, reorder, or acquisition-confirmation flow;
- no care-product category inclusion, role assignment, or commerce state;
- event timing belongs to `toolOccurrences`, never the physical asset;
- the existing refinement nudge may invite the user to resolve unknown inventory, but it does not imply depletion or purchase.

## Chosen product direction

### Stage 1 — Idealplan

Use a separate compact `Deine Tools` block inside each existing tier page, after that page's care-product cards:

- Basis Tool routes appear after `Deine Basis` products;
- optional Tool routes appear after optional products;
- cards show recognizable generic Tool types, purpose, and `Bestand im Feinschliff prüfen`;
- they do not reuse the exact care-product card anatomy, price promise, cadence row, or catalog disclaimer;
- the same Tool asset is not repeated if it serves several route targets.

This direction is confirmed. A standalone third Idealplan page is rejected because it adds a new chapter inside Stage 1 and separates Tool routes from their `Basis`/`Optional` tier.

### Direct acceptance

Direct acceptance must remain available even when Tools are relevant. The confirmed presentation contract is:

- do not add a new Tool disclaimer, Tool panel, or extra bullet to the transition page;
- fold the Tool default into the existing Night Protection assumption as one quiet line: `Keine weiteren Tools oder besonderer Nachtschutz eingeplant`;
- the line expresses a planning default only; it does not assert ownership, exact settings, attachment compatibility, or current technique;
- accepted generic Tool recommendations enter Routine as `unknown`, not owned and not purchased;
- safe `behavior_only` guidance may execute immediately;
- Tool-dependent occurrences stay conditional/non-executable until broad ownership is reported or an exact Tool is selected;
- the existing refinement nudge is the recovery path and opens the first unresolved Tool inventory question;
- direct acceptance is blocked only when a route requires an exact safety/compatibility fact, not merely because generic ownership is unknown.

This preserves `accepted plan = plan seen` without forcing an exact Tool purchase or fabricating possession.

### Stage 2 — Feinschliff

The existing Routine/Feinschliff vocabulary is the base. Replace the dense eight-row inventory with a visual overview and short product-form pages; do not ask brand, model, price, technique, or full attachment inventory.

- Current towel handling, drying route, additional heat tools, heat-event, heat-protection, and Night Protection questions remain canonical sources.
- The first Tool screen uses the same large, two-column image-card pattern as the production Personal Plan hair-texture question. It asks which broad sections contain something the user already owns; existing canonical answers preselect the relevant sections.
- The mockup's vector silhouettes are layout proxies only. Production requires a reviewed, consistent set of recognizable Tool photos or photorealistic cut-outs with meaningful alt text; generic text icons do not satisfy the visual contract.
- The four overview labels are presentation-only section headers, not persisted Tool categories: `Trocknen & Stylen`, `Entwirren & Fixieren`, `Waschen & Auftragen`, and `Tücher & Nachtschutz`.
- Each selected section opens one or more short pages with no more than four large visual options. Those pages use the eight confirmed product-family names and recognizable product forms, for example `Haartrockner & Luftstyler` followed by `Föhn`, `Föhn + Diffusor`, `Föhnbürste`, and `Heißluft-Multistyler`.
- A section-level `Nichts davon` is an explicit answer. Skipped/migrated sections remain `unknown`; they are never silently converted to none.
- Section headers and page progress remain visible throughout the Tool trip so the user knows which group they are refining.
- The overview and drilldowns reuse known towel, heat, drying, and Night Protection answers; they do not ask the same fact again.
- Net-new broad ownership is collected for heatless styling, brush/comb forms, clips/ties, wash/application aids, and uncovered airflow forms.
- Current questions may become conditional drilldowns beneath the overview, but their product-need semantics and heat-event behavior must not change.
- Only selected overview sections open product-form pages; persisted facts remain family/product-type based, never purpose-header based.
- Application technique is not asked. The only behavior exception is the existing towel `rubbeln` versus `sanft` answer.

### Stage 3 — Produkte

Add a compact Tools checkpoint after the current care-product decisions. It inherits the current Stage-3 interaction pattern: selectable cards are equal peers, the entire card is the selector, and one full-width sticky CTA commits the marked choice.

- `owned_generic`: show one minimal image card with `Nutze deins`, recognizable type/capability, and only compatibility facts that change guidance; do not run an exact-product comparison or add explanatory filler.
- missing Basis route: show one or two equal-height selectable image cards. Each exact card contains identity, product-type/capability array, relevant attachment, and price; no card has a smaller inline action.
- when a genuinely different heat/heatless route can serve the same target, show it below as an equally valid approach with concise similarities/differences; do not ask a preference question first.
- if the user already owns one viable approach, make it primary and keep the other route secondary.
- do not reuse the care-product dimension table merely to create comparison rows. Compare exact Tools only when two real candidates differ on a route-critical fact.
- the selected card receives the current Stage-3 selection ring/check; the single sticky CTA reads `Dieses Tool einplanen` and makes the exact Tool a full Routine member immediately, matching current product semantics.
- show an honest catalog gap when no candidate qualifies. Never promote a candidate with unknown required facts.

### Stage 4 — Routine

Keep the released product-first hierarchy:

1. `Deine Basis`
2. `Optional`
3. `Später ergänzen`
4. `Deine Tools`

`Deine Tools` is a compact list, not a second Routine system. Each physical Tool appears once with a recognizable thumbnail, product type/name, short purpose, and one honest state:

- `Nutze deins` for broad reported ownership;
- no provisional/purchase badge for a selected exact Tool;
- `Im Feinschliff abgleichen` for direct-accept unknowns;
- `Katalogoption fehlt` for an unresolved legitimate route.

Unknown Tools do not block the whole Anwendung destination. Only the affected Tool-dependent occurrence is conditional; product steps and behavior-only guidance stay available.

### Stage 5 — Anwendung

Keep the existing day overview and detailed-step architecture, but make Tools visually analogous to care products rather than metadata pills.

- A Tool needed that day appears as its own image item on the existing shelf, alongside the care-product items. Do not add a pill row beneath the shelf and do not create another day type.
- In the opened day, each Tool use is its own image-led use section, analogous to a product-use block, positioned at the correct point in the ordered application sequence. A behavior-only transition remains a normal text step and has no fake Tool card.
- Do not introduce Tool pills, capability pills, or subordinate Tool callout chips in Anwendung.
- Generic guidance is proactive after broad reported ownership or exact selection; it is never evidence that the user already applies the technique.
- Verified exact protocol overrides generic guidance.
- Unknown settings, temperatures, attachment compatibility, wet/dry allowance, or tension stay conditional/fail closed.
- Gentle towel handling and loosen-if-it-pulls cautions remain firm. Material and Night Protection outcome claims remain modest.

## Designed user journey

Status: confirmed by Nick on 2026-08-21 through the explicit implementation-handoff request after reviewing the revised rendered mockup and walkthrough.

1. An eligible Personal Plan owner enters the current Idealplan. On both the `Basis` and `Optional` pages, care-product cards remain first. A compact `Deine Tools` block then shows only the relevant generic Tool types for that tier, with recognizable images and no care-product price/cadence anatomy.
2. At the existing plan fork, the user can still start Feinschliff or accept immediately. The page gains no Tool disclaimer or panel. The current Night Protection assumption becomes `Keine weiteren Tools oder besonderer Nachtschutz eingeplant`; the current air-dry and no-heat lines remain. Direct acceptance saves relevant Tool state as `unknown`, executes only behavior-only guidance, and keeps the normal refinement recovery path.
3. In Feinschliff, the user first sees four large image-led presentation sections. Known drying, heat, towel, and Night Protection answers are preselected. Each selected section opens short pages with no more than four recognizable product-form images. The eight product-led families remain the persisted taxonomy. `Nichts davon` is explicit; skipped/migrated state remains unknown. No technique, brand, model, price, or exhaustive attachment questionnaire is introduced.
4. After the current care-product decisions, Stage 3 shows the Tool checkpoint. A viable owned generic Tool leads as one minimal `Nutze deins` image card. A missing route remains visible as a useful generic Tool type in Phase 1; exact catalog choices are added only after Phase-2 content approval. When two choices exist, both are equal whole-card selectors and one sticky CTA commits the marked Tool. Viewing a card or link never changes ownership or selection.
5. On Routine, products retain the current `Basis`, `Optional`, and `Später ergänzen` hierarchy. `Deine Tools` follows as one compact image-led asset list. Each physical Tool appears once even if it supports several jobs. The Tool assets and occurrences are saved in the versioned Routine V2 authority; they never enter depletion, reorder, cadence, or acquisition machinery.
6. On Anwendung, the day cards keep their current shape. Required Tools appear as image objects on the existing shelf alongside products, with no Tool pill row. Opening a day shows behavior-only transitions as ordinary steps and each Tool use as its own image-led section in sequence. Guidance is proactive but never claims that the user already follows it; unverified exact settings fail closed without blocking unrelated product steps.
7. Loading, retry, conflict, unknown-inventory, catalog-gap, and partial-day recovery remain local to the affected stage or occurrence. The completed experience is a stable Routine plus actionable Anwendung that prefers owned Tools, exposes missing routes honestly, and does not manufacture possession, technique, or exact-product fit.

Meaningful variants:

- direct accept versus full Feinschliff;
- `unknown`, `explicit_none`, `owned_generic`, and later `selected_exact` Tool state;
- heat and heatless alternatives when both genuinely serve the target;
- Phase 1 generic guidance versus Phase 2 exact product selection;
- mobile and desktop use with the same ordering and safe-area action hierarchy.

## Planning evidence

- Rendered artifact: `plans/mockups/2026-08-12-personal-plan-hair-tools-current-shape.html`.
- Question answered: how the confirmed Tool taxonomy and engine states fit the exact released five-stage product without crowding the transition, refinement, Routine, or Anwendung.
- Selected direction: tier-local Stage-1 blocks; quiet direct accept; paginated image-led Feinschliff; current Stage-3 whole-card/sticky-action grammar; Tool thumbnails in Routine; Tool objects and image-led Tool-use sections in Anwendung.
- Feedback incorporated: remove the standalone Idealplan page; do not add a transition disclaimer; split refinement into visual pages; minimize Stage-3 copy and equalize actions; add recognizable Tool images; remove Anwendung pills; keep product-led persisted categories; ship generic first; persist Tools in Routine V2.
- Visual assets: the mockup silhouettes are layout proxies. Production art requires a separately reviewed, consistent Tool photo/cut-out set.
- Verification: rendered at 1440×900 and 390×844 on 2026-08-21 with zero horizontal overflow and zero page errors.
- Evidence-review status: confirmed on 2026-08-21.

## Catalog and product-spec boundary

The source Sheet's Dryer, Brush, Heat-Tool, and Hairstyle-Tool tabs are research input, not runtime authority. Exact product content remains a separate approval gate.

Canonical product identity retains brand, product name/model, image, price, and purchase destination. `product_tool_specs` supplies:

- `productTypes[]` and `capabilities[]`;
- typed attachments and compatibility evidence;
- supported use state, heat behavior, wet/dry allowance, size/diameter/tension facts only where route-critical;
- protocol and fact-evidence references.

Customer exact-owned-Tool intake remains out of scope for V1. `tools` is curated-catalog supported but public-intake unsupported. Availability is not a fit criterion and is not required on the minimal user card.

## Rollout and migration direction

Because the Personal Plan is now live, Tools needs one new server-owned rollout boundary: `PERSONAL_PLAN_TOOLS_ROLLOUT=off|internal|all`, invalid/absent values fail closed. Reuse the existing server-owned internal/admin identity; browser answers or query parameters never grant access.

Release order:

1. additive contracts/schema and zero-row readiness, Tools off;
2. code deployed with current ten-category journey unchanged;
3. internal rollout with production-shaped authenticated Stage 1–5 proof;
4. exact Tool content approved and published through its separate gate;
5. final readiness audit and separately authorized `all` activation.

Disabling Tools removes the new projections while preserving stored additive facts; it does not require destructive rollback.

### Recommended delivery split

For the leanest safe first implementation, Phase 1 delivers `behavior_only`, `tool_type`, `unknown`, `explicit_none`, `owned_generic`, the visual section/product-form inventory, Routine assets, and Anwendung occurrences. Missing routes remain a useful generic product-type recommendation with an honest exact-catalog gap.

Phase 2 adds `product_tool_specs`, exact Tool content, exact Stage-3 selection, and curated catalog publication after the candidate pool is approved. This avoids building an empty exact-tool subsystem before any content can use it. Nick confirmed this generic-first sequence on 2026-08-21.

### Confirmed Phase-1 Routine authority

Nick confirmed on 2026-08-21 that generic Tool assets and occurrences are persisted in Routine V2 during Phase 1 rather than computed as a temporary projection at read time.

| Option                                          | Easier                                                                                                                                           | Harder / residual risk                                                                                                         | Recommendation |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| Persist Routine V2 in Phase 1                   | Routine, diff/editor/source reconciliation, and Anwendung share one durable authority from day one; Phase 2 exact Tools extend the same contract | Larger first implementation and more V1/V2 consumer work before exact products exist                                           | **Confirmed**  |
| Project Phase-1 Tools from Stage 1 + refinement | Smaller first schema change; generic Tools can appear sooner                                                                                     | Creates a temporary second Routine source, defers lifecycle/diff/editor behavior, and needs a later projection-to-V2 migration | Rejected       |

## Target map

| Surface                          | Current production seam                                                                                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stage 1 computation/presentation | `src/lib/personal-plan/{types,needs,compute-stage1,decision-presentation}.ts`, `src/components/personal-plan-start/**`                                                                                                                |
| Direct accept                    | `src/lib/personal-plan/direct-acceptance/{defaults,accept}.ts`, `src/components/personal-plan-journey/plan-fork-screen.tsx`                                                                                                           |
| Stage 2 inventory                | `src/lib/personal-plan/refinement/{types,question-path,stage1-adapter}.ts`, `src/components/personal-plan-refinement/**`; visual reference `src/components/personal-plan-quiz/{personal-plan-quiz-first-screen,texture-question}.tsx` |
| Stage 3 resolution               | `src/lib/personal-plan/products/**`, `src/components/personal-plan-products/**`; interaction reference `product-fit-comparison.tsx`                                                                                                   |
| Curated catalog                  | additive `tools`/`product_tool_specs`, Product Intake internal validators, catalog-authority audits                                                                                                                                   |
| Stage 4 assets                   | `src/lib/personal-plan/routine/{contracts,load-view,diff,editor,source-reconciler,proposal-service,source-sync-service}.ts`, `routine-candidate-compiler.ts`, Routine components                                                      |
| Stage 5 occurrences              | `src/lib/personal-plan/routine/application-adapter.ts`, `src/lib/routines/personal-plan/application/**`, Application components                                                                                                       |
| Release/analytics                | `src/lib/personal-plan/release.ts`, journey loaders, existing typed stage analytics, production-shaped Labs/Playwright                                                                                                                |

## Ordered implementation tasks

### 1. Lock the parallel cross-stage Tool contracts test-first

Define a parallel Tool plan contract, eight families, product types, capabilities, route targets, ownership states, generic/exact assets, and occurrences. Do not extend the two closed care-product category enums or their Zod schema. Preserve all 123 policy fixtures and add direct-accept unknown-state fixtures.

Completion command: `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan/tools-contracts.test.ts tests/personal-plan-tools.test.ts` exits 0. Exhaustive tests reject duplicate physical assets, invented capabilities, unknown-to-none coercion, silent exact selection, care-product enum expansion, and category drift.

### 2. Add Stage 1 computation, tier-local presentation, and direct accept

Compute initial route needs from existing quiz facts, render the confirmed compact Basis/Optional Tool blocks, fold the quiet Tool default into the existing Night Protection assumption without a new disclaimer or panel, and keep generic unknown assets non-executable.

Completion command: `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-tools-stage1.test.tsx tests/personal-plan-direct-acceptance.test.ts tests/personal-plan-fork-screen.test.tsx tests/personal-plan-start-ui.test.tsx` exits 0. Role-tier placement, grouping/deduplication, exact care-product disclaimers, fork seen-state, direct-accept identity, refinement nudge, resume/back, and current Stage-1 regressions pass.

### 3. Add the paginated visual Stage 2 Tool inventory without duplicate questions

Extend the canonical path/session/persistence contract, project existing towel/drying/heat/night answers, add missing broad forms, and implement the four-section visual overview plus selected product-form pages.

Completion command: `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage2-tools.test.tsx tests/personal-plan-stage2-question-path.test.ts tests/personal-plan-stage2-session.test.ts tests/personal-plan/persistence/stage2-refinement-service.test.ts` exits 0. Every known/unknown/none transition is deterministic; no page presents more than four image choices; presentation sections never leak into persisted category keys; existing heat-protection and need projections are unchanged; resume, conflict, retry, progress, and direct-accept refinement-entry tests pass.

### 4. Add the Phase-1 Stage 3 Tool checkpoint

Project `owned_generic` as one minimal image card with `Nutze deins`. For an explicit missing route, show the recommended generic product type, a concise viable route alternative when one exists, and an honest `Konkretes Produkt folgt` state. Use whole-card selection plus one sticky action where a user choice exists; do not use care-product comparison dimensions, exact selection, catalog rows, or inline micro-CTAs in this slice.

Completion command: `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-tools-stage3-generic.test.tsx tests/personal-plan-stage3-flow.test.tsx` exits 0. Generic ownership never gains an exact-fit verdict; link/card views do not mutate state; missing routes remain visible and useful without product content.

### 5. Add curated Tool schema and internal readiness — Phase 2 candidate

Create additive `tools` catalog support, `product_tool_specs`, identity/spec validators, RLS/grants, and zero-row audits without public Tool submission or product rows.

Completion command: `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-tools-catalog-migration.test.ts tests/admin-product-category-write-policy.test.ts tests/catalog-authority-audit.test.ts` exits 0. Clean migration, RLS, lifecycle, catalog-authority, Product Intake non-expansion, and zero-row readiness checks pass.

### 6. Add Stage 3 exact Tool authority — Phase 2 candidate

Extend entry/draft/authority snapshots and UI with image-led `Nutze deins`, one or two peer exact-option cards, neutral route alternative, immediate exact selection through the single sticky action, and catalog gaps.

Completion command: `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-tools-stage3.test.tsx tests/personal-plan-product-fit-comparison.test.tsx tests/personal-plan-direct-acceptance.test.ts` exits 0. No exact fit exists without exact identity; no dimension-table filler is manufactured; multi-role deduplication, forged action, stale snapshot, link-no-selection, exact-readiness, and responsive UI tests pass.

### 7. Version and render Routine Tool assets

Add strict `routinePayloadV2Schema` with required `toolAssets` and `toolOccurrences`, then expose `routinePayloadSchema = z.discriminatedUnion('schemaVersion', [routinePayloadV1Schema, routinePayloadV2Schema])`. Keep the existing strict V1 schema unchanged; readers accept the union, V1 writers remain V1 while Tools are off, and V2 canonical hashing preserves V1 parity when no Tool data exists. Follow the existing Application `contracts.ts`/`contracts-v2.ts` precedent. Enumerate every direct `routinePayloadV1Schema.parse` consumer and route it through the union, including all `load-view.ts` sites plus `proposal-service.ts` and `source-sync-service.ts`. Update diffing, staging, source reconciliation, load/edit/proposal/source-sync services, and compact UI. Tool assets bypass cadence/nudge/commerce/reorder/acquisition code; only occurrences own event timing.

Completion command: `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-tools-routine.test.tsx tests/personal-plan-routine-candidate-compiler.test.ts tests/personal-plan-stage4-ui.test.tsx tests/personal-plan-stage4-persistence.test.ts tests/personal-plan-stage4-source-sync-api.test.ts` exits 0. Strict V1 payloads still load unchanged through every reader; proposal/source-sync paths accept V2; strict V2 hashes and diffs deterministically; one asset supports many occurrences; no Tool enters cadence/nudge/commerce; direct-accept unknowns, active/successor lifecycle, retry, and product-first ordering pass.

### 8. Compile image-led Tools into the current Anwendung architecture

Extend the application adapter/compiler and day/detail views with Tool shelf items and ordered, image-led Tool-use sections. Reuse the product-use visual grammar; add no pill row or Tool-callout chips.

Completion command: `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-tools-application.test.tsx tests/personal-plan-stage5-compiler.test.ts tests/personal-plan-stage5-view-adapter.test.ts` exits 0. Behavior-only guidance, unknown conditionality, exact-over-generic precedence, no duplicate multi-role steps, ordering anchors, towel/tension safety, partial-day behavior, reload, and current Stage-5 suites pass.

### 9. Integrate rollout, analytics, and readiness

Add the default-off Tool rollout, reuse existing typed stage events with Tool dimensions where sufficient, and add only missing entry/completion/gap events. Prove the complete journey off, internal, and all-ready without activating `all` in this task.

Completion commands: `npm run test:personal-plan`, `npm run test:personal-plan:nested`, `npm run test:playwright:personal-plan-stage3`, and `npm run ci:verify` all exit 0. Current ten-category behavior is identical with Tools off; authenticated mobile/desktop Stage 1–5 proof passes internally; exact content fingerprint/readiness is separate; `ready-check` and one whole-branch review are clean.

## Verification contract

Automated:

- 123 preserved policy fixtures plus direct-accept, unknown, catalog-gap, and multi-tool fixtures;
- Stage 1 snapshot/product-preview/direct-accept tests;
- Stage 2 path/session/persistence/projection tests;
- Stage 3 authority, comparison, recovery, and action tests;
- Routine schema/compiler/hash/diff/persistence/editor/source-settlement tests;
- Stage 5 contracts/compiler/adapter/view tests;
- migration, RLS, catalog-authority, Product Intake, typecheck, lint, build, and full Personal Plan suites.

Browser/manual:

- exact deployed component composition at 390×844, 375×667, 320×700, and desktop;
- tier-local Tool blocks, long German labels, the unchanged-shape direct-accept fork, four-section visual overview, at-most-four-option image pages, `Nutze deins`, exact selection, catalog gap, and alternative route;
- Routine product-first order, recognizable thumbnails, and one Tool row per physical asset;
- Anwendung Tool images on the existing day shelf and one image-led section per Tool use, with no pills;
- loading, empty, conflict, retry, partial, unknown compatibility, keyboard/focus, reduced motion, safe-area CTA containment, and no horizontal overflow;
- explicit proof that viewing a Tool card/link does not select it or imply ownership.

## Counterpart review reconciliation — 2026-08-20 and 2026-08-21

| Finding                                                           | Classification                                | Resolution                                                                                                                                                                     |
| ----------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tools` was ambiguous against the two closed care-product enums   | accepted technical blocker                    | Tools is now explicitly a parallel plan domain; the care-product enums and their exhaustive consumers must not expand                                                          |
| strict Routine V1 could reject V2 additions                       | accepted technical blocker, mechanism refined | keep strict V1 unchanged and add a strict V1/V2 discriminated union; do not weaken V1 with loose unknown keys                                                                  |
| Tool assets could accidentally enter cadence/nudge/commerce       | accepted technical blocker                    | durable assets are explicitly exempt; event timing belongs only to occurrences                                                                                                 |
| completion criteria lacked runnable commands and server-only shim | accepted                                      | each task now pins the repository-supported Node invocation or full npm gate                                                                                                   |
| exact Tool rails may be premature with zero approved rows         | valid scope tradeoff                          | resolved: Phase 1 ships generic/behavior-only first; exact schema, selection, and catalog content follow after candidate approval                                              |
| Routine V2 readers omitted proposal/source-sync services          | accepted technical blocker                    | Task 7 and the target map now enumerate all direct V1 parse consumers, including `proposal-service.ts` and `source-sync-service.ts`                                            |
| Phase 1 could project Tools instead of persisting Routine V2      | valid architecture tradeoff                   | resolved: persist Tool assets and occurrences in Routine V2 during Phase 1 so Routine and Anwendung share one stable, versioned authority                                      |
| combined Tool/Night Protection copy overlaps existing assumptions | valid product/copy decision                   | resolved: replace only the existing Night Protection line with `Keine weiteren Tools oder besonderer Nachtschutz eingeplant`; keep current air-dry and no-heat lines           |
| planning authorities are untracked                                | accepted workflow risk                        | all recovered artifacts stay in this task worktree and must be committed with the first approved implementation slice; no task may start from a clean checkout that lacks them |
| split Stage-1 computation/presentation/direct-accept task         | optional execution refinement                 | keep one product outcome in the plan; implementation-loop may split disjoint worker briefs, but one integrated verification gate owns the result                               |

Counterpart verdict: **approve with revisions**. All hard technical findings are incorporated, and Nick has since resolved the Phase sequencing, Routine-authority, and direct-accept copy decisions.

## Current decision status

1. **Confirmed:** tier-local compact Tool blocks on both Idealplan pages; no standalone third Idealplan page.
2. **Confirmed with correction:** direct accept keeps Tool state internally `unknown`, but the transition screen gets no new disclaimer, Tool panel, or extra bullet. One quiet combined Tool/Night Protection assumption is sufficient; only behavior-only guidance runs until refinement.
3. **Confirmed presentation:** Stage 2 uses section headers, pages, large image cards, and no more than four options per screen; persisted categories remain the eight product-led families.
4. **Confirmed presentation:** Stage 3 uses minimal copy, whole-card selection, equal peer cards, and one sticky CTA; Routine and Anwendung use recognizable Tool images; Anwendung adds no pills.
5. **Confirmed:** implement the lean generic/behavior-only Phase 1 first and defer exact Tool schema/selection (Tasks 5–6) until the candidate pool is approved.
6. **Confirmed:** persist Tool assets and occurrences in Routine V2 during Phase 1; reject the temporary computed projection.
7. **Confirmed:** replace the existing Night Protection assumption with `Keine weiteren Tools oder besonderer Nachtschutz eingeplant`. The existing air-dry and no-heat lines remain; no new disclaimer, panel, or bullet is added.

All other category decisions remain inherited from the confirmed policy artifacts.

## Review and stop contract

- Worktree: `.worktrees/personal-plan-hair-tools-current-shape`
- Branch: `codex/personal-plan-hair-tools-current-shape`
- Baseline: exact production/main SHA `2efd080afe9af98fb4b41d54c3d26a5446b6bd95`
- Durable artifacts: this plan, current mockup, six category-policy files, and the implementation handoff are `commit` with the implementation branch.
- Transient screenshots/reviewer output: discard unless explicitly selected as evidence.
- Evidence review: confirmed by Nick's explicit request to hand the reviewed current-shape implementation to another agent.
- Counterpart review: new high-effort pass completed 2026-08-21; one V2-consumer blocker accepted and fixed in the plan, two owner tradeoffs exposed, no structural category/rollout/schema precedent was rejected.
- Designed-user-journey sign-off: confirmed on 2026-08-21 through the explicit implementation-handoff request after the final walkthrough.
- Implementation handoff: `plans/2026-08-21-personal-plan-hair-tools-implementation-handoff.md`.
- Stop point for the implementing agent: finish a verified, whole-branch-reviewed worktree and stop before commit/push/PR/merge/deploy/migration application/catalog publication/rollout activation unless Nick separately authorizes the named action.
