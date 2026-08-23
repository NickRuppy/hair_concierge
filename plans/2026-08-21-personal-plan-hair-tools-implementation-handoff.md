# Personal Plan Hair Tools — implementation handoff

## Start here

Implement the approved **Phase 1 Hair Tools integration** in the existing task worktree.

```text
Outcome: Hair Tools become a parallel, saved Personal Plan domain across Idealplan, Feinschliff, Produkte, Routine, and Anwendung.
Scope: Phase 1 only — generic/behavior-only Tool guidance, visual inventory, owned-generic handling, Routine V2 assets/occurrences, Anwendung, rollout, analytics, and verification.
Verification: focused task tests, full Personal Plan gates, responsive authenticated journey evidence, ready-check, and request-code-review over the exact final tree.
Stop: review-ready local branch only. Do not commit, push, open a PR, merge, deploy, apply migrations, publish catalog content, or activate rollout without separate authorization.
```

Work only here:

- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/personal-plan-hair-tools-current-shape`
- Branch: `codex/personal-plan-hair-tools-current-shape`
- Approved base: successful production/main `2efd080afe9af98fb4b41d54c3d26a5446b6bd95`
- Primary plan: `plans/2026-08-12-personal-plan-hair-tools-current-shape.md`

The planning artifacts are currently untracked but task-owned. Preserve them and include them in the eventual implementation diff. Do not create a clean worktree that omits them.

If `origin/main` advances before the first implementation edit, inspect the incoming commits and fast-forward this worktree only when they do not conflict with the approved Personal Plan surfaces. Record the new base in the plan and handoff; do not silently implement from an unknown/stale base.

## Required workflow

1. Read the repository `AGENTS.md`.
2. Use `.agents/skills/implementation-loop/SKILL.md` as the owning workflow.
3. Reuse this worktree; run `branch-gate` before editing.
4. Use test-first development for deterministic logic under `src/lib/routines/`, `src/lib/quiz/`, and the new Tool compilation seams.
5. Implement in bounded dependency order. Update the plan only when repository evidence requires a concrete deviation; do not reopen confirmed product decisions.
6. Run `ready-check` over the complete tree, then `request-code-review` as the single repository review router. The meaningful whole-branch review also requires the configured Claude counterpart lane at high effort.
7. Stop at a verified, review-ready local branch. Shipping and all production actions are separate authorizations.

Do not create a formal Goal unless Nick explicitly requests one.

## Read order and authority

Read these before editing:

1. `plans/2026-08-12-personal-plan-hair-tools-current-shape.md` — controlling production-current implementation plan, user journey, tasks, tests, rollout, and review ledger.
2. `plans/mockups/2026-08-12-personal-plan-hair-tools-current-shape.html` — approved responsive layout and hierarchy. Its vector silhouettes are layout proxies, not final production artwork.
3. `docs/personal-plan/categories/tools/decision.md` — confirmed need tiers, routes, ownership, lifecycle, safety, and 123 deterministic fixture intents.
4. `docs/personal-plan/categories/tools/conditional-guidance-matrix.md` — category rules and cross-category deduplication.
5. `docs/personal-plan/categories/tools/option-pool.md` — eight product-led categories and recognizable forms.
6. `docs/personal-plan/categories/tools/product-spec.md` — future exact-product shape and capability vocabulary. Phase 1 consumes the vocabulary but does not build the exact catalog subsystem.
7. `docs/personal-plan/categories/tools/evidence.md` — conservative claim strengths and medically adjacent limits.
8. `docs/personal-plan/categories/tools/product-candidates.md` — unapproved Phase 2 research only; do not publish or recommend these as approved exact products.

If an older document conflicts with the primary plan or current production source, the primary plan wins.

## Confirmed product contract

### Domain and taxonomy

Hair Tools is one user-facing umbrella and a **parallel plan domain**, not an eleventh care-product category.

Never add `tools` to:

- `STAGE1_CATEGORY_ORDER`
- `PERSONAL_PLAN_PRODUCT_CATEGORIES`
- `personalPlanCategorySchema`
- exhaustive care-product consumers

The eight persisted product-led Tool families are:

1. Haartrockner & Luftstyler
2. Hitzestyling-Tools
3. Heatless Styling & Setzen
4. Bürsten & Kämme
5. Clips, Haargummis & Fixierhilfen
6. Wasch- & Auftragshilfen
7. Nachtschutz
8. Handtücher & Trocknungsmaterialien

Purpose labels are mappings or presentation headers, never persisted subcategory keys.

### Resolution and ownership

Every active route resolves as exactly one of:

- `behavior_only`
- `tool_type`
- `exact_tool` — Phase 2 only

Keep these states distinct:

- `unknown`
- `explicit_none`
- `owned_generic`
- `selected_exact` — Phase 2 only
- `owned_exact` — future supported path
- `catalog_gap`
- `executable_occurrence`

Never coerce `unknown` to none or ownership. Viewing a card, product detail, affiliate link, or alternative never changes selection.

One physical Tool has one asset identity and may own multiple capabilities and occurrences. Render it once in Routine even when several steps use it.

Tools are durable assets. They never enter depletion cadence, replacement cadence, low-stock nudges, reorder, commerce state, acquisition confirmation, or care-product role assignment. Timing belongs to occurrences, not assets.

## Approved user journey

### Stage 1 — Idealplan

- Keep the current concrete care-product cards and tier pages.
- Add a compact `Deine Tools` block after the care-product cards on both `Basis` and `Optional` pages.
- Show generic Tool type, recognizable image, purpose, and a quiet inventory-check state.
- Do not reuse care-product price, cadence, catalog-disclaimer, or commerce anatomy.
- Do not add a standalone third Idealplan page.

### Direct accept

- Keep the current two-action transition shape.
- Add no Tool disclaimer, Tool panel, or extra bullet.
- Replace only the current Night Protection assumption with:
  - `Keine weiteren Tools oder besonderer Nachtschutz eingeplant`
- Keep the current air-dry and no-heat assumption lines.
- Save relevant Tool state as `unknown`; do not assert ownership.
- Run behavior-only guidance immediately. Tool-dependent occurrences remain conditional until ownership is resolved.
- The existing refinement nudge is the recovery path.

### Stage 2 — Feinschliff

- Reuse the large two-column image-card grammar from the production Personal Plan hair-texture question.
- First show four **presentation-only** sections:
  - Trocknen & Stylen
  - Entwirren & Fixieren
  - Waschen & Auftragen
  - Tücher & Nachtschutz
- Selected sections open short product-form pages with no more than four large visual options per page.
- Persist only the eight product families and concrete product forms, never the presentation headers.
- Reuse existing drying, heat, towel, and Night Protection answers and visually preselect them. Do not ask the same fact twice.
- `Nichts davon` is explicit. Skipped or migrated state stays `unknown`.
- Do not ask brand, model, price, technique, or exhaustive attachments.
- The only behavioral exception remains the existing towel `rubbeln` versus `sanft` answer.

Visual reference:

- `src/components/personal-plan-quiz/personal-plan-quiz-first-screen.tsx`
- `src/components/personal-plan-quiz/texture-question.ts`

### Stage 3 — Produkte

- Add the Tool checkpoint after existing care-product decisions.
- `owned_generic` leads as one minimal image card with `Nutze deins`; do not run an exact-product comparison.
- An explicit missing route shows a useful generic product type in Phase 1 and an honest `Konkretes Produkt folgt`/catalog-gap state.
- When the user has a genuine choice, use equal whole-card selectors, the current selection ring/check, and one full-width sticky action. No small inline CTA.
- Keep heat and heatless routes neutral. Show both only when both genuinely serve the same target; an owned viable route remains primary.
- Do not manufacture care-product comparison dimensions.

Interaction reference:

- `src/components/personal-plan-products/product-fit-comparison.tsx`
- Current action grammar: whole-card selection plus the single sticky CTA.

### Stage 4 — Routine

Keep the current order:

1. Deine Basis
2. Optional
3. Später ergänzen
4. Deine Tools

Each Tool row has a recognizable thumbnail, type/name, short purpose, and honest state. One physical Tool appears once.

Persist `toolAssets` and `toolOccurrences` in strict Routine V2 during Phase 1. Nick explicitly chose this over temporary read-time projection so Routine, diff/editor/source reconciliation, and Anwendung share one stable versioned authority.

Keep strict Routine V1 unchanged and expose a strict discriminated V1/V2 union. Every current direct `routinePayloadV1Schema.parse` reader must accept the union, including:

- all `src/lib/personal-plan/routine/load-view.ts` sites
- `src/lib/personal-plan/routine/proposal-service.ts`
- `src/lib/personal-plan/routine/source-sync-service.ts`

### Stage 5 — Anwendung

- Keep existing day types and day-card architecture.
- Place needed Tool images as objects on the existing product shelf; do not add a Tool pill row.
- In day detail, behavior-only transitions remain normal steps.
- Each Tool use becomes its own image-led use section in the correct sequence, analogous to a product-use block.
- Add no capability pills or subordinate Tool-callout chips.
- Guidance is proactive but never evidence of what the user already does.
- Verified exact protocol will override generic guidance in Phase 2.
- Unknown settings, temperatures, attachments, wet/dry allowance, or tension fail closed locally without blocking unrelated steps.

## Phase boundary

Implement Phase 1 now:

- plan tasks 1–4 and 7–9;
- generic and behavior-only routing;
- visual inventory and `owned_generic`;
- Routine V2 assets/occurrences;
- Routine and Anwendung UI;
- rollout, analytics, tests, and review.

Defer Phase 2:

- plan tasks 5–6;
- `product_tool_specs` migration/catalog subsystem;
- exact Tool product publication;
- exact fit authority and exact selection;
- candidate approval or product intake;
- activation of any exact-product rails.

Do not silently pull Phase 2 into Phase 1 because candidate records exist in the research document.

## Production seams

- Stage 1 computation/presentation:
  - `src/lib/personal-plan/types.ts`
  - `src/lib/personal-plan/needs.ts`
  - `src/lib/personal-plan/compute-stage1.ts`
  - `src/lib/personal-plan/decision-presentation.ts`
  - `src/components/personal-plan-start/**`
- Direct accept:
  - `src/lib/personal-plan/direct-acceptance/defaults.ts`
  - `src/lib/personal-plan/direct-acceptance/accept.ts`
  - `src/components/personal-plan-journey/plan-fork-screen.tsx`
- Stage 2:
  - `src/lib/personal-plan/refinement/{types,question-path,stage1-adapter}.ts`
  - `src/components/personal-plan-refinement/**`
- Stage 3:
  - `src/lib/personal-plan/products/**`
  - `src/components/personal-plan-products/**`
- Routine:
  - `src/lib/personal-plan/routine/{contracts,load-view,diff,editor,source-reconciler,proposal-service,source-sync-service}.ts`
  - `src/lib/personal-plan/routine-candidate-compiler.ts`
  - `src/components/routine/personal-plan/**`
- Anwendung:
  - `src/lib/personal-plan/routine/application-adapter.ts`
  - `src/lib/routines/personal-plan/application/**`
  - `src/components/application/**`
- Rollout/analytics:
  - `src/lib/personal-plan/release.ts`
  - journey loaders and existing typed stage analytics

Use repository discovery to locate all downstream exhaustive consumers; the list above is a starting map, not permission to skip callers.

## Recommended implementation slices

Follow the plan's detailed tasks and acceptance commands. A practical dependency order is:

1. Parallel Tool contracts, fixtures, and default-off rollout skeleton.
2. Stage-1 route computation, tier-local presentation, and quiet direct accept.
3. Stage-2 visual section/product-form inventory and persistence.
4. Phase-1 Stage-3 `owned_generic`, generic missing-route, and recovery states.
5. Strict Routine V2, all V1/V2 readers, compiler/diff/editor/source-sync/proposal behavior, and Tool list UI.
6. Anwendung compiler/adapter, Tool shelf objects, ordered Tool-use sections, and conditionality.
7. Analytics, off/internal behavior, production-shaped fixtures, browser proof, full verification, and review.

Each slice must leave current care-product behavior unchanged when Tools rollout is off.

## Verification and review

The controlling plan contains the exact focused commands for all nine tasks. At minimum, the final tree must pass:

```bash
npm run test:personal-plan
npm run test:personal-plan:nested
npm run test:playwright:personal-plan-stage3
npm run ci:verify
```

Also run every focused command named under the implemented plan tasks. The Routine slice must include:

```bash
node --import ./tests/server-only-register.cjs --import tsx --test \
  tests/personal-plan-tools-routine.test.tsx \
  tests/personal-plan-routine-candidate-compiler.test.ts \
  tests/personal-plan-stage4-ui.test.tsx \
  tests/personal-plan-stage4-persistence.test.ts \
  tests/personal-plan-stage4-source-sync-api.test.ts
```

Manual/browser evidence must cover desktop and 390×844 mobile plus the smaller plan viewports named in the plan, including:

- tier-local Stage-1 Tool blocks;
- unchanged direct-accept hierarchy and exact combined line;
- four image sections and at-most-four product forms per page;
- reused known answers, explicit none, resume, conflict, retry, and unknown;
- minimal `Nutze deins` and generic catalog-gap state;
- one Routine row per physical Tool;
- Tool images on the existing Anwendung shelf;
- one image-led section per Tool use and no pills;
- no horizontal overflow, safe-area CTA containment, keyboard/focus, and reduced motion;
- proof that viewing a Tool card/link does not select it or imply ownership;
- Tools-off parity with the current Personal Plan.

Use `ready-check`, retain its exact content fingerprint, then use `request-code-review`. Any content change after a receipt invalidates that receipt until refreshed.

## Rollout and safety boundaries

- Add one server-owned fail-closed `PERSONAL_PLAN_TOOLS_ROLLOUT=off|internal|all` boundary using the existing internal/admin identity precedent.
- Default/invalid is `off`; browser answers and query parameters never grant access.
- This implementation may prove `off` and `internal`; it must not activate `all`.
- Schema/code must be additive and safe with zero Tool rows.
- Disabling Tools removes new projections but preserves additive stored facts.
- Do not apply migrations or write production state in this implementation task.
- Keep cosmetic guidance separate from medically adjacent scalp/hair-loss guidance.
- Preserve conservative evidence: towel technique is stronger than material claims; Night Protection benefits remain modest; no growth or diagnostic claims.

## Asset handling

The mockup's inline silhouettes demonstrate layout only. Production requires recognizable, consistent Tool photos or photorealistic cut-outs with meaningful alt text.

If no approved image set exists during implementation:

- implement the stable asset slots and local fallback behavior;
- create or source a coherent reviewable local set without external hotlinks;
- label it as pending visual approval in the verification receipt;
- do not represent placeholder art as final approved content;
- do not block nonvisual contract/tests, but do not claim the user-facing feature fully ready until the final assets are reviewed.

## Known traps from counterpart review

- Expanding the closed care-product enums breaks exhaustive consumers.
- Weakening strict Routine V1 instead of adding a discriminated union breaks compatibility.
- Missing `proposal-service.ts` or `source-sync-service.ts` from V2 reader conversion causes runtime parse failures.
- Sending Tool assets through cadence/nudge/commerce/reorder code creates false consumable behavior.
- Treating unselected or migrated inventory as explicit none invents user input.
- Adding exact Tool rails before approved catalog content creates empty or dishonest recommendations.
- Reintroducing dense option rows, inline micro-CTAs, or Anwendung pills violates the approved visual journey.

## Handoff status

- Planning evidence: confirmed.
- Designed user journey: confirmed.
- Product decisions: resolved.
- Architecture decisions: resolved.
- Claude plan review: approve with revisions; technical findings incorporated.
- Residual risks: production image-set approval, broad V1/V2 reader coverage, exact Tools deferred to Phase 2.
- Authorized next action: run `implementation-loop` in this worktree through a verified, review-ready local branch.
