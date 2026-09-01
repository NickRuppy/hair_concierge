# Heat-protectant refinement guard

Status: implemented and verified locally; evidence reviewed; designed user journey confirmed 31 August 2026

## 1. Outcome and source context

Fix the production refinement failure seen on 28 August 2026 and make the heat-protection result epistemically honest:

- an owned `heat_protectant` must never make Stage 3 bootstrap fail merely because the Idealplan has no qualifying heat route;
- assumptions from an unfinished habits module must not become a user-facing “not in your routine” or “you can skip this” verdict;
- after the user confirms heat habits, direct-contact heat remains `basis`, shaping hot airflow remains `optional`, and confirmed no qualifying heat may produce “Kein separater Hitzeschutz nötig”;
- the Routine headline stays “Deine Routine”; the explanation belongs to the affected product.

Source evidence:

- the field screenshot at 17:38 showed the generic Stage-3 preparation error after the products module;
- production request evidence showed four `GET /api/personal-plan/stage-3` responses with `409 stage_not_ready` after a successful products-module completion;
- a production-shaped replay failed in `buildStage3EntryContext` with `Stage 3 Heat Protectant entry requires qualifying routes`;
- the stored product answer included `heat_protectant`, while the projected no-heat facts (`air_dry`, no extra tools) were assumption-derived because the habits module was still open.

No external hair-care research is needed: this plan preserves the existing internal rule that direct heat is Basis, shaping hot airflow is Optional, and confirmed no qualifying heat is Not needed.

## 2. Chosen direction

Preserve the existing two-module flow and carry knowledge state into the Stage-3 authority boundary.

When the products module is completed before the habits module, the partial refined Need projection must keep `heat_tool_use` unknown instead of converting assumption-filled heat answers into known absence. Stage 3 may open, capture the owned heat-protection product, and retain it in inventory, but it must stop before a fit/exclusion verdict and offer the existing `/plan-start?refine=habits` path. Once the user completes the heat questions, the new refined authority deterministically resumes one of two existing paths:

1. qualifying heat exists: assess the product for the required/optional heat-protection role;
2. no qualifying heat exists: show the product-level “Kein separater Hitzeschutz nötig” result and retain the product as not planned.

The final Routine keeps its “Deine Routine” headline. Its secondary inventory section becomes “Nicht eingeplant” and explains the confirmed result without claiming that the person does not currently use the product.

Why this direction:

- it does not duplicate heat questions inside the product check;
- it does not force every products-module user through habits—only an owned product whose disposition depends on unresolved habits is paused;
- it reuses the existing `PlanKnowledge`, deferred heat decision, module deep link, stale-authority refresh, and inventory-retention concepts;
- it avoids a database migration by keeping the clarification derivable from persisted refined authority plus the captured product.

Rejected directions:

- silently permit empty routes and keep the existing `not_used` disposition: fixes the 409 but preserves the false certainty;
- always force the habits module before products: removes modular independence for users whose product decisions do not depend on habits;
- add heat questions inside Stage 3: duplicates the Feinschliff authority and creates two write paths for the same facts.

## 3. Scope and non-goals

### In scope

- heat knowledge/provenance for partial Stage-2 module projections;
- Stage-2-to-Stage-3 adapter and requirement validation for inventory-only heat protection;
- Stage-3 authority validation for a deferred inventory-only category decision;
- an ephemeral, deterministic clarification state that blocks a false inventory disposition and routes to the habits module;
- heat-specific confirmed-not-needed copy in Stage 3;
- Routine secondary-section language and heat-specific reason copy;
- regression coverage from module completion through Stage 3, portfolio/Routine output, refresh, and recovery.

### Non-goals

- changing the heat-protection recommendation rule or its medical/cosmetic evidence;
- changing recommendation behavior for shampoo, conditioner, or other inventory-only categories;
- adding a questionnaire to Stage 3;
- changing the top-level Routine headline;
- catalog, product-intake, pricing, auth, billing, analytics, migration, or production-data changes;
- retroactively rewriting immutable refined Need versions or existing Routine versions. Existing affected users recover through canonical recomputation/re-entry; no production backfill is planned.

## 4. Target map

### Knowledge and partial projection

- `src/lib/personal-plan/persistence/stage2-refinement-service.ts`
  - derive and pass the concrete boolean `habitsModuleUserComplete` into partial snapshot creation;
  - pass that signal only from the module-projection call; the terminal `complete()` and direct-accept path continue to build heat as confirmed so their output and hashes remain byte-identical;
  - keep full module completion byte-compatible when both modules are user-complete.
- `src/lib/personal-plan/refinement/production-persistence-gateway.ts`
  - construct a partial refined Routine context whose unresolved habits leave `heatToolUse` unknown;
  - preserve confirmed empty heat events as known absence.
- `src/lib/personal-plan/refinement/stage1-adapter.ts`
  - add the narrow typed input/helper for confirmed versus unresolved heat authority; do not make all routine facts provenance-aware in this change.
- `src/lib/personal-plan/refinement/types.ts` and `src/lib/personal-plan/persistence/stage2-refinement-service.ts`
  - carry only `habitsModuleUserComplete: boolean` as the new projection metadata; do not introduce a general provenance object.

### Stage-3 entry and authority

- `src/lib/personal-plan/products/stage2-entry-adapter.ts`
  - include the canonical heat-protectant decision when `heat_protectant` is owned-but-not-rendered; keep every other inventory-only category decision-less as today;
  - require heat qualifying routes only when `pre_heat_protection` is a required role;
  - emit zero roles/no routes for deferred or confirmed-not-needed inventory-only heat protection.
- `src/lib/personal-plan/products/contracts.ts`
  - validate route metadata conditionally: required for heat requirements with the heat-protection role, absent for heat requirements with zero roles;
  - keep non-heat route validation unchanged.
- `src/lib/personal-plan/products/authority/snapshot.ts`
  - permit exactly one canonical decision for owned-but-not-rendered `heat_protectant` while preserving the decision-less invariant for every other inventory-only category and retaining source hash, category order, authority-version, uniqueness, and stale-source checks.

### Stage-3 clarification and confirmed result

- `src/lib/personal-plan/products/state-machine.ts`
  - do not derive `category_not_in_final_plan` when the inventory-only heat decision is deferred on `heat_tool_use`;
  - derive a pure clarification view from authority plus captured inventory;
  - keep portfolio completion blocked until the clarification is resolved by a newer refined authority;
  - continue deriving the existing acknowledged `not_used` disposition after confirmed no qualifying heat.
- `src/lib/personal-plan/products/contracts.ts` or a colocated narrow view type
  - type the non-persisted clarification projection; do not add it to portfolio or Routine persistence.
- `src/components/personal-plan-products/stage3-products-flow.tsx`
  - render “Hitzeschutz noch offen,” explain why no verdict is available, and link the primary action to `/plan-start?refine=habits`;
  - render “Kein separater Hitzeschutz nötig” only for a confirmed not-needed disposition;
  - retain the existing generic inventory disposition for other categories.
- `src/lib/personal-plan/products/http-gateway.ts`, `src/app/api/personal-plan/stage-3/route.ts`, and `src/lib/personal-plan/journey-access-loader.ts`
  - inspect during implementation and change only if the canonical deferred authority cannot traverse the existing response contract; no new public error code is planned.

### Routine presentation

- `src/components/routine/personal-plan/routine-page.tsx`
  - keep “Deine Routine”;
  - rename the secondary group from “Nicht verwendete Produkte” to “Nicht eingeplant”;
  - show the heat-specific confirmed reason, using “nicht als separaten Hitzeschutz” so multifunction products are not overclassified.
- `src/lib/personal-plan/routine/portfolio-presentation.ts`
  - expose only existing retained-inventory category/reason data unless a tiny pure copy discriminator is needed; do not change persisted portfolio shape.

### Tests

- `tests/personal-plan/persistence/stage2-module-completion.test.ts`
- `tests/personal-plan-stage1-stage2-adapter.test.ts`
- `tests/personal-plan-stage2-stage3-adapter.test.ts`
- `tests/personal-plan-stage3-contracts.test.ts`
- `tests/personal-plan-stage3-state-machine.test.ts`
- `tests/personal-plan-stage3-flow.test.tsx`
- `tests/personal-plan-stage3-portfolio.test.ts`
- `tests/personal-plan-stage4-ui.test.tsx`
- `tests/personal-plan-module1-stage3-resume.test.tsx`
- `tests/personal-plan-stage2-refinement.spec.ts` or the closest authenticated journey spec

## 5. Designed user journey

### Actor and entry condition

A paid user completes the Feinschliff products module, says they own/use a heat-protection product, and has not yet completed the habits module.

### Ordered journey

1. The products-module save and module completion succeed and create a current partial refined Need version.
2. Stage 3 opens successfully; it does not return the generic preparation error.
3. The user identifies or confirms the heat-protection product as today.
4. Because `heat_tool_use` is still unknown, Stage 3 shows:
   - heading: “Hitzeschutz noch offen”;
   - explanation: “Du nutzt bereits einen Hitzeschutz. Bevor wir ihn einplanen oder weglassen, prüfen wir kurz, wie du Hitze beim Styling verwendest.”;
   - primary action: “Hitze-Nutzung klären”.
5. The action opens `/plan-start?refine=habits`; no not-used disposition is created or acknowledged, and the product stays saved under “Meine Produkte”.
6. After the habits module completes, the user returns through the canonical Personal Plan frontier; stale Stage-3 authority is refreshed instead of being retried as current.
7. The system branches on confirmed facts:
   - direct-contact heat: heat protection is Basis and the normal product-fit review runs;
   - shaping hot airflow: heat protection is Optional and the normal product-fit review runs;
   - ordinary airflow/no qualifying heat: Stage 3 shows “Kein separater Hitzeschutz nötig” and “Für deine angegebene Routine brauchst du keinen separaten Hitzeschutz. Du kannst dieses Produkt weglassen.”
8. The user acknowledges the confirmed-not-needed result and completes Stage 3.
9. The Routine page retains “Deine Routine”. If applicable, the owned product appears under “Nicht eingeplant” with: “Für deine angegebene Routine brauchst du dieses Produkt nicht als separaten Hitzeschutz. Es bleibt unter „Meine Produkte“ gespeichert.”

### Error and recovery states

- Stage-3 bootstrap failure: the existing generic retry state remains for genuine unavailable/stale errors; this valid deferred state no longer maps to 409.
- Lost response or reload before habits: the clarification is re-derived from persisted authority and captured inventory; no acknowledgement is lost because none is permitted.
- Revision conflict while saving habits: use the existing Feinschliff reload/retry behavior.
- Newer refined Need after habits: discard stale Stage-3 authority and canonically load/rebuild from the current version.
- User changes habits again after a prior not-needed result: the existing refined-source reconciliation must invalidate the old disposition before any new Routine becomes active.
- Multifunction product: copy says it is not needed “als separaten Hitzeschutz”; it does not claim every other purpose of the product is unnecessary.

### Completion

The user reaches a Routine whose heat-protection inclusion/exclusion is supported by user-confirmed heat habits, while their captured product identity remains preserved.

## 6. Planning evidence

- Rendered current-layout state comparison: [`evidence/heat-protectant-refinement-states.html`](./evidence/heat-protectant-refinement-states.html)
- PNG review artifact: [`evidence/heat-protectant-refinement-states.png`](./evidence/heat-protectant-refinement-states.png)
- Question answered: where should uncertainty and confirmed skip guidance appear without changing the Routine headline?
- Selected direction: clarification in Stage 3, confirmed disposition in Stage 3, concise confirmed reason in Routine.
- Feedback incorporated: keep “Deine Routine”; say the product may be skipped only after the plan has a confirmed basis for that conclusion.
- Evidence review: **confirmed by Nick on 31 August 2026**; no corrections requested.
- Designed-user-journey sign-off: **confirmed by Nick on 31 August 2026** for the concise before/after walkthrough recorded in this plan.

## 7. Ordered tasks

### Task 1 — Preserve unresolved heat authority in partial module projections

**Consumes:** Stage-2 persisted `answerProvenance`, module states, assumption resolution, and the existing complete snapshot builder.

**Change:** Add regression-first coverage for a user-complete products module with owned `heat_protectant` and an open habits module. Derive `habitsModuleUserComplete` from `moduleStates.habits.status === "complete"` and pass that boolean only into the partial module-projection snapshot call. Build `PlanRoutineContext.heatToolUse` as unknown when the boolean is false; keep user-confirmed empty heat events known. The terminal `complete()` and direct-accept paths do not opt into this override and must continue to produce byte-identical snapshots and hashes.

**Produces:** a partial refined Need snapshot whose heat decision is `deferred_until_post_plan_onboarding` with `deferredFacts: ["heat_tool_use"]`, while `currentProductLoad` is known and includes `heat_protectant`.

**Tests:** extend `personal-plan-stage1-stage2-adapter` and `personal-plan/persistence/stage2-module-completion` with assumed-no-heat versus user-confirmed-no-heat fixtures, plus exact snapshot assertions.

**Complete when:** the incident-shaped module projection is ready, hash-stable on replay, and no longer labels assumption-derived heat absence as known.

### Task 2 — Admit deferred inventory-only heat through the Stage-3 authority boundary

**Consumes:** the partial refined snapshot from Task 1.

**Change:** Make the entry adapter include the canonical `heat_protectant` decision only when heat protection is owned-but-not-rendered. Do not attach decisions to shampoo, conditioner, or any other inventory-only category. Allow heat requirements with zero roles and no routes; require unique qualifying routes when and only when `pre_heat_protection` is required. Update authority validation without weakening source hash, version, ordering, uniqueness, or stale-source checks.

**Produces:** a schema-valid Stage-3 bootstrap for owned heat protection with either deferred/no-role authority, confirmed-not-needed/no-role authority, or included/role-plus-routes authority.

**Tests:** add a production-shaped adapter regression using the exact incident signature, contract matrices for all three heat states, snapshot tamper/duplicate rejection, and retain every existing inventory-only category case.

**Complete when:** `buildStage3EntryContext` no longer throws for the incident state, while a required heat role without routes still fails closed.

### Task 3 — Block false disposition and route unresolved heat to the existing habits module

**Consumes:** the deferred decision now present in Stage-3 authority and captured inventory product.

**Change:** Add a pure derived clarification selector. Exclude deferred heat products from `category_not_in_final_plan` disposition creation, keep Stage-3 completion blocked, render the reviewed clarification UI, and route the CTA to `/plan-start?refine=habits`. On a newer confirmed authority, remove the clarification deterministically and use the existing fit or not-used path.

**Produces:** no persisted `not_used` result while heat use is unknown; a recoverable link to the authoritative questions; canonical continuation after confirmation.

**Tests:** state-machine tests for deferred/confirmed-not-needed/included transitions; UI tests for copy, CTA, reload, no acknowledgement, no fit comparison, and no completion; module-resume test for the return path and stale-authority replacement.

**Complete when:** an unresolved owned heat product can never enter a portfolio or Routine as `not_used`, and a confirmed state always resumes deterministically.

### Task 4 — Present the confirmed result in Stage 3 and Routine

**Consumes:** the existing confirmed `category_not_in_final_plan` disposition after user-confirmed no qualifying heat.

**Change:** Specialize Stage-3 heat copy to “Kein separater Hitzeschutz nötig.” Keep generic copy for other categories. Rename the Routine secondary inventory group to “Nicht eingeplant” and render the reviewed heat-specific reason while keeping “Deine Routine”.

**Produces:** product-level guidance that is accurate for confirmed absence and does not claim the user never uses the product.

**Tests:** Stage-3 and Routine static-render assertions for the reviewed German copy; generic-category regression; multifunction-safe phrase; accessibility heading/CTA names.

**Complete when:** the rendered components match the approved artifact in mobile layout and the top-level Routine headline is unchanged.

### Task 5 — Prove the incident journey and recovery end to end

**Consumes:** Tasks 1–4.

**Change:** Add one production-shaped service/adapter replay and one browser journey: products first with heat product → Stage 3 clarification → habits → branch to confirmed no heat or qualifying heat → Stage 3 → Routine. Cover reload before habits and stale refined-source refresh. Keep live production read-only.

**Produces:** repeatable evidence that the 409 is gone and that unknown, included, and confirmed-not-needed meanings never collapse into one another.

**Tests:** focused unit suites, `npm run test:personal-plan`, targeted Playwright on the real module entry/Stage-3/Routine route, typecheck, lint, and build as owned by `ready-check`.

**Complete when:** the exact incident-shaped fixture passes, both semantic branches pass, and no unrelated inventory-only behavior changes.

## 8. Verification

### Automated

- run the focused tests named in Tasks 1–4 while implementing each boundary;
- run the production-shaped Stage-2 → Stage-3 replay;
- run `npm run test:personal-plan`;
- run the targeted Playwright journey for products-first, habits return, Stage 3, and Routine;
- run repository typecheck, scoped lint, and production build through `ready-check`;
- run `request-code-review` on the whole branch after the verification receipt is current.

### Manual/browser

- mobile viewport matching the reported iPhone surface;
- verify no generic “Deine Produkte konnten nicht vorbereitet werden” state for the valid deferred case;
- compare unresolved, direct heat, shaping airflow, and confirmed no-heat branches;
- verify Back/reload/re-entry preserves the correct frontier;
- verify “Deine Routine” and “Nicht eingeplant” hierarchy against the reviewed artifact;
- verify screen-reader heading order and the “Hitze-Nutzung klären” link target.

### Migration and live state

- expected migration delta: none;
- expected production-data write during implementation/review: none;
- before ship, inspect the final diff to confirm no Supabase migration or RPC contract change was introduced accidentally;
- after deployment authorization (separate from merge), replay a disposable authenticated fixture and verify the observed Vercel/Sentry request class no longer produces Stage-3 409s. Do not mutate the affected friend’s data without separate approval.

### Rollout and recovery decisions

- Kill-switch: no new feature flag. This repairs an already-broken, narrowly identified bootstrap path; rollback is the normal guarded deployment revert. Deployment remains a separate explicit authorization and is monitored for Stage-3 409/error-rate changes.
- Existing affected plans: no automatic backfill and no one-off mutation in this change. Affected users recover through canonical re-entry/recomputation after deployment. If a known plan still cannot converge, diagnose it read-only first and obtain separate approval for any guarded repair.

### Evidence-sensitive review

- confirm every negative heat statement is downstream of user-confirmed habits;
- confirm direct-contact and shaping-airflow behavior remains exactly the current internal rule;
- confirm the wording does not imply a multifunction product has no other use;
- confirm other inventory-only categories retain their existing generic disposition behavior.

## 9. Implementation and verification receipt

Implementation tree:

- branch: `codex/heat-protectant-refinement-guard-current`;
- verified base: `822a547c7e2400070b0b48699427cce17188c7b5` (`feat(personal-plan): unify paid post-payment journey (#481)`);
- the first implementation tree was based on `870fc4fb`; after `main` advanced, the task changes were transplanted onto the base above and the affected proof was rerun;
- a later `main` commit, `c868cdc6` (`Fix hair-length portrait fit across both quizzes (#483)`), has no path overlap with this task. A ship/merge pass must still refresh the branch before publication.

Observed outcomes:

- products-first completion with assumption-only heat habits persists `heatToolUse` as unknown and produces the canonical deferred heat decision;
- Stage 3 admits owned inventory-only heat with zero roles/no routes while still rejecting a required heat role without routes;
- deferred owned heat produces no `not_used` disposition, blocks portfolio completion, survives reload derivation, and routes to `/plan-start?refine=habits`;
- confirmed no-heat copy is heat-specific in Stage 3 and Routine, while other inventory-only categories retain generic copy;
- the Routine headline remains “Deine Routine” and the retained-products section is “Nicht eingeplant”.

Fresh verification on the transplanted tree:

- regression-first proof: the incident projection/adapter/contracts tests failed in the expected three seams before implementation, then passed;
- regression-first proof: deferred Stage-3 state/UI tests failed by creating `not_used` and completing prematurely before implementation, then passed;
- regression-first browser proof: the new Labs journey failed before the deferred-heat fixture existed, then passed after implementation;
- focused deterministic/UI/gateway suites before counterpart review: 233 passed, 0 failed;
- counterpart-review delta (owned-heat scope narrowing plus non-heat regression): 20 passed, 0 failed;
- `npm run typecheck`: passed;
- final `npm run test:personal-plan`: 2,377 passed, 0 failed;
- targeted Playwright on `/labs/personal-plan/stage-3?scenario=deferred-heat-protection`: 1 passed at 375×844 with no horizontal overflow and the exact habits link;
- `npm run lint`: passed with 0 errors and 5 pre-existing warnings outside this task’s paths;
- `npm run build`: passed, including production TypeScript and 150 static pages;
- `git diff --check`: passed.

Counterpart review:

- Claude Opus 4.8, high effort, read-only whole-working-tree review: no hard defects found;
- Claude identified that the initial unknown-heat override also affected products-first users who did not own heat protection;
- the override was narrowed to an owned `heat_protectant`, and a red-first regression now proves non-heat decisions and coverage remain byte-equivalent to the prior projection;
- Claude’s remaining notes are non-blocking: the derived clarification step key is intentionally view-only, and authenticated real-route verification remains a separately authorized evidence tier.

Simulated-user review:

- persona: Lea, motivated non-expert with occasional heat styling;
- verdict: pass for the changed unresolved state;
- observed strengths: uncertainty is explicit, the saved product is visibly preserved, and the next action is singular and concrete;
- no copy, trust, accessibility-heading, CTA, or mobile-layout blocker was observed;
- evidence tier: Labs plus deterministic service/component tests. Labs proves the rendered Stage-3 interaction but not authenticated entitlement, database persistence, or the complete post-payment route.

Skipped and residual checks:

- no local checkout or production field-test activation was run because those paths can create external analytics or production state and were not authorized;
- no production data, Supabase migration, deployment, flag, or backfill was introduced;
- post-deployment production 409/error-rate monitoring remains a separately authorized release step.

Artifact disposition:

- commit: this plan, `plans/evidence/heat-protectant-refinement-states.html`, and the ignored review PNG `plans/evidence/heat-protectant-refinement-states.png` (force-add at ship time);
- discard: transient `/tmp/heat-protectant-clarification.png` and Playwright runtime output;
- retain outside the review branch until cleanup: the superseded original task worktree, because publication/cleanup has not been authorized.

## 9. Review and handoff

- Branch: `codex/heat-protectant-refinement-guard`
- Worktree: `.worktrees/heat-protectant-refinement-guard`
- Planning artifacts:
  - this plan — **commit**;
  - rendered HTML evidence — **commit**;
  - PNG evidence — **commit with an explicit forced add because the repository globally ignores `*.png`**;
  - Claude review output — **discard after findings are verified and incorporated**;
  - diagnosis command output and pseudonymous production identifiers — **discard; do not commit**.
- Counterpart plan review: **complete; approve with incorporated revisions**.
- Evidence-review gate: **confirmed 31 August 2026**.
- Designed-user-journey sign-off: **confirmed 31 August 2026**.
- Implementation stop point: do not invoke `implementation-loop` until Nick has reviewed the rendered evidence and explicitly confirmed the designed journey.
- Publication stop point: implementation approval does not authorize commit, push, PR, merge, deployment, or production writes; those retain their normal explicit gates.

### Counterpart findings ledger

Claude Code (`claude-opus-4-8`, high effort, read-only) returned **Approve with revisions**.

- **Accepted — inventory-only scope was too broad:** narrowed the authority-decision change to owned-but-not-rendered `heat_protectant`; all other inventory-only categories remain decision-less.
- **Accepted — shared adapter/hash risk:** explicitly restricted the new override to the partial module-projection call and preserved terminal/direct-accept output.
- **Accepted — signal was underspecified:** fixed the interface to `habitsModuleUserComplete: boolean`, derived from canonical module status.
- **Accepted — Routine test target:** named `tests/personal-plan-stage4-ui.test.tsx` as the current UI owner.
- **Accepted — real-route verification:** browser verification must use production `/plan-start?refine=habits`, not only a Labs interception.
- **Owner decision recorded — rollback:** no new flag; guarded revert-only rollback for this narrow already-broken path.
- **Owner decision recorded — affected users:** no production backfill; canonical re-entry/recomputation only unless a later guarded repair is separately approved.

All findings were checked against the current worktree before incorporation. Transient reviewer output remains outside the repository and will be discarded.
