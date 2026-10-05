# Central user profile — PR3: profile surfaces and translator retirement

Rev. 3 — 2026-10-05. Worktree `.worktrees/central-profile-pr3`, branch `codex/central-profile-pr3`, base `origin/main` = `9eac2085`.

## 1. Outcome and source context

Third and last PR of the central-user-profile program. Parent contracts: `plans/2026-09-15-care-habits-source-of-truth.md` (§6 journey items 5–7, §7 mockup decision A/A, §8 tasks 14–18), `plans/2026-09-30-central-user-profile-clean-switch.md` §9, `plans/2026-10-03-central-user-profile-pr2.md` §3. PR1 (#634, #636) and PR2 (#637) are live.

Outcome: on the Profil tab, the Styling / Alltag / Produkte sections stop leading into the old onboarding flow. Plan owners edit these in the Feinschliff; users without a plan see their values without edit controls. The never-working legacy Feinschliff prefill is removed, and the old quiz→profile-column translators stop being part of any production runtime path.

## 2. Chosen direction (after revalidating the September task list against the code and production on 2026-10-05)

The September tasks 14–17 were written before PR1/PR2. Three of them changed shape:

- **Task 14 (Feinschliff seeds from the profile).** Production facts: 109 plan owners; for 108 of them the profile's care values and the plan's Feinschliff answers already agree (the Feinschliff writes the profile first since PR1; a plan rebase writes them in one transaction since PR2). The legacy prefill has never run (0 receipts) and would throw for the 2 eligible users, because its loader selects the non-existent column `hair_profiles.shampoo_frequency`. Direction: **delete the Stage-2 legacy prefill; module entry keeps cloning the latest complete draft** (unchanged RPC `personal_plan_open_optional_refinement_v1`, always called with a skipped seed). No new seeding machinery and no SQL migration.
- **Task 15 (translators).** No production code writes the profile through the translators any more (PR1 + DB lock). Remaining runtime use: one completeness gate in `plan-bereit/readiness.ts`; the backfill's hand-edit detection and ~17 golden/oracle tests use the projection as a frozen oracle. Direction (Rev. 3): **the gate stays byte-identical; the projection stops being re-exported from the account-link module, is documented as frozen, and a guard test limits its importers.** Swapping the gate to the account-link projection was tried and rejected: the two gates disagree on two existing fixtures (an artifact without `quiz_answers`; a v3 envelope without quiz-context answers), so the swap would change account-link behaviour for no gain — all 880 attached production artifacts carry a v2 or v3 `quiz_answers` object. `projectQuizAnswersToLegacyVocabulary` and `projectQuizAnswersForLegacyConsumers` stay (live non-write callers: scanner context, Customer.io quiz traits, offer preview, result narrative).
- **Task 16 (Customer.io serializer).** Not needed: both Customer.io trait builders read lead answers only; nothing in the Customer.io or e-mail code reads `hair_profiles`. No serializer module exists and none is built. **No Customer.io code changes in this PR** (trait names and values stay byte-identical by not touching them).
- **Task 17 (profile surfaces)** stands as confirmed (mockup A/A), with the details in §6.

## 3. Scope and non-goals

In scope: the three work packages in §8.

Non-goals:

- No SQL migration, no production write, no change to `user_facts_save_v1`, the facts lane, or any Personal Plan RPC.
- No Customer.io change (see §2).
- The `/onboarding` route, its steps and `POST /api/profile/care-habits` stay (onboarding retirement is its own plan).
- `src/lib/personal-plan-quiz/prepared-plan.ts:333` („… obligatorischen Onboarding …“) is stored artifact content, not rendered by any component; untouched.
- The Stage-3 optional-inventory seed (`personal_plan_open_optional_inventory_v1`, hints, receipts) keeps its behaviour.
- Dead SQL left in place: the eligible/receipt branch of `personal_plan_open_optional_refinement_v1` (never reached with an `applied` seed after this PR).

## 4. Target map

| Package                   | Files (owned, disjoint)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A — prefill removal       | `src/lib/personal-plan/legacy-prefill.ts` (delete), `src/lib/personal-plan/persistence/stage2-optional-entry.ts`, `src/lib/personal-plan/products/legacy-inventory-entry.ts`, `src/lib/personal-plan/products/stage3-persistence-supabase.ts`, comments in `src/lib/user-facts/legacy-vocabulary.ts`, `src/lib/user-facts/backfill/legacy-columns-to-care-habits.ts`, `tests/user-facts-schema.test.ts`; tests `tests/personal-plan-legacy-prefill.test.ts`, `tests/personal-plan/persistence/stage2-optional-entry.test.ts`, `tests/personal-plan/products/stage3-persistence-supabase.test.ts`, `tests/personal-plan/products/stage3-legacy-prefill-contract.test.ts`, `tests/personal-plan-stage3-flow.test.tsx` (only if imports move) |
| B — translator retirement | `src/lib/quiz/link-to-profile.ts` (re-exports removed), `src/app/plan-bereit/readiness.ts` (import path only), `src/lib/quiz/legacy-profile-projection.ts` (header comment only), `scripts/mobile/profile-edit-postgres-check.ts` and 14 test files (import path only), new `tests/legacy-profile-projection-import-guard.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                         |
| C — profile surfaces      | `src/app/profile/page.tsx`, `src/lib/profile/section-config.ts`, `src/lib/profile/product-usage-rows.ts`, `src/components/routine/routine-page-client.tsx`; tests `tests/profile-plan-overlay.test.ts`, `tests/profile-section-config.test.ts`, `tests/profile-product-usage-rows.test.ts`, one new test file `tests/profile-plan-owner-surfaces.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                 |

## 5. Decision coverage

Status: **confirmed**.

**Confirmed with Nick**

- Mockup A/A (2026-09-15): labels „Produkte/Styling/Alltag bearbeiten“ stay and open the Feinschliff; descriptions without „Onboarding“; no-plan state shows values without a button.
- Reconfirmed 2026-10-05 after seeing the current-vs-after table: users without a plan lose the Styling/Alltag/Produkte edit entry on the profile; a plan owner's tap on a single value opens the whole habits module; Produkte shows the plan's products for plan owners; old Routine empty state loses „Onboarding anpassen“. („Okay, sounds good. Let's start the implementation then.“)
- Execution mode (2026-10-05): an Opus agent orchestrates Codex CLI workers for implementation.
- 2026-10-05, „all three recommendations are fine, go ahead“:
  - **O1** — the Feinschliff keeps opening pre-filled from the plan's latest complete draft; no facts overlay, no new RPC. (Profile and plan answers agree for 108/109 plan owners; this PR removes the one profile path that let a plan owner change care habits outside the Feinschliff. Residual: an onboarding care step opened by direct URL can still make them differ until onboarding is retired.)
  - **O2** — for plan owners the Bürste/Kamm card keeps opening the single onboarding brush step (saves through the central door, returns to the profile) until Hair Tools moves brushes into the Feinschliff.
  - **O3** — the copy outside the mockup as listed in §6, including the shorter section descriptions for users without a plan.
- Also presented 2026-10-05 and accepted with the go-ahead: Customer.io task dropped (nothing reads the profile); the old-writer projection is kept as a frozen reference, not deleted; lapsed/free-tier plan owners still see the buttons and land on `/reactivate`.

**Inherited from evidence or contract**

- Return target after a Feinschliff module is the Routine tab (existing `/plan-start` behaviour; September journey item 5).
- Plan ownership signal = `useProfileHasPersonalPlan()` (tier-independent, PR2).

**Implementation defaults**

- The Stage-3 inventory fingerprint need not stay byte-identical (0 receipts in production; it is an opaque audit string). It stays deterministic and keeps the `legacy-prefill-v1` prefix.
- Plan products render in the existing plan-product card format (already live for owners without legacy rows).
- `getProductCompletionLabel` loses its `onboardingCompleted` parameter; empty → „Noch leer“.

**Open consequential assumptions:** none.

Undiscussed consequential assumptions affecting this handoff: none.

Coverage acknowledgement: Nick, 2026-10-05: „Okay, sounds good. Let's start the implementation then.“ (current-vs-after table) and „all three recommendations are fine, go ahead“ (O1–O3); September A/A decision.
Internal revalidation: Rev. 3 (package B narrowed after the gate characterisation; no consequential choice changed) against `9eac2085` and production counts of 2026-10-05.

## 6. Designed user journey

Actor A — **plan owner** (`useProfileHasPersonalPlan()` true), Profil tab:

1. Styling and Alltag: description „Hitzetools, Häufigkeit und Hitzeschutz aus deinem Feinschliff.“ / „Handtuch, Trocknen, Bürste/Kamm und Nachtschutz aus deinem Feinschliff.“; header button „Styling bearbeiten“ / „Alltag bearbeiten“ and every value card open `/plan-start?refine=habits`. Exception (§5 O2): the Bürste/Kamm card opens `/onboarding?step=brush_type&returnTo=/profile&editMode=single-step`.
2. Produkte: description „Welche Produktkategorien du aktuell nutzt und welche Produkte in deinem Plan stehen.“; header button „Produkte bearbeiten“ opens `/plan-start?refine=products`. Content: the plan's products (status badge „Aus deinem Personal Plan“) whenever the plan-products list is non-empty — legacy rows, category chips and the „Details ergänzen“ card are not rendered then. If the list is empty or unavailable (no active routine, free tier), the legacy rows render; each row and „Details ergänzen“ open `/plan-start?refine=products`. No rows at all: „Noch keine Produkte“ / „Im Feinschliff kannst du angeben, welche Produkte du schon nutzt.“ (no second button; the header button is there).
3. Feinschliff completes or is left → Routine tab (existing behaviour, incl. „Plan aktualisiert“).

Actor B — **user without a plan**:

1. Styling / Alltag: descriptions „Hitzetools, Häufigkeit und Hitzeschutz.“ / „Handtuch, Trocknen, Bürste/Kamm und Nachtschutz.“; no header button; value cards are not interactive; an empty value shows „Noch offen“ (without „tippen zum Ergänzen“).
2. Produkte: description „Welche Produkte du aktuell nutzt.“; no header button; legacy rows are static (no button semantics); no „Details ergänzen“ card; no rows: „Noch keine Produktangaben“ / „Hier ist noch nichts gespeichert.“ without a button.
3. Old Routine page empty state: only „Im Chat starten“.

Both: no user-visible string in these files contains „Onboarding“. Loading: a plan owner's Produkte section shows the skeleton until the plan-products fetch settles (no legacy→plan flicker); a non-owner renders legacy rows immediately.

## 7. Planning evidence

September review page (current vs proposed, mobile): `plans/central-user-profile/evidence/profil-ohne-onboarding-review.html`; A/A selected. Re-shown to Nick 2026-10-05 as a current-vs-after table with the September screenshots; confirmed. Copy outside the mockup is listed in §6 and was confirmed on 2026-10-05 (§5 O3).

## 8. Ordered tasks (three independent packages, disjoint write scopes)

### A — remove the Stage-2 legacy prefill; make the Stage-3 inventory seed self-contained

1. `stage2-optional-entry.ts`: remove the legacy-prefill imports, `buildOptionalStage2Seed`, `stage2AnswerQuestionIds`, `isFullyAssumedCompleteParent`, `loadLegacyRefinementPrefillInput`, `coerceLegacyUsageRows`, `loadLegacyPrefillEligibility`, the `loadLegacyPrefillInput` dep and the context fields `legacyPrefillEligible` / `legacyPrefillStage2Receipt` (and the now-unneeded selected plan columns). `openOptionalRefinement` keeps exactly two calls: existing in-progress draft → `openPreparedDraft` with `parentDraftId: null, parentRevision: null`; else latest complete draft → `openPreparedDraft` with the parent id + revision; both with the skipped seed (`outcome: "skipped_existing_state"`, fingerprint `"legacy-prefill-v1:skipped"`). RPC name, parameters and accepted outcomes unchanged.
2. Move what the Stage-3 path needs from `legacy-prefill.ts` (types `LegacyCatalogMatch`, `LegacyProductUsageRow`, `LegacyExactInventorySeed`, `LegacyProductHint`, the exact-inventory / product-hint / source-id / fingerprint mapping) into `products/legacy-inventory-entry.ts`; drop the profile-column and Stage-2-answer mapping; delete `legacy-prefill.ts`. `stage3-persistence-supabase.ts` imports from the new home; its `user_product_usage` and catalog reads, the RPC payload shape and the hint contract (`Stage3LegacyPrefillHintsV1`) are unchanged.
3. Tests: rewrite `stage2-optional-entry.test.ts` to the two-branch behaviour (red first: a test that an eligible, fully-assumed parent no longer triggers any `hair_profiles`/`user_product_usage` read and sends the skipped seed); move the inventory/hint cases of `personal-plan-legacy-prefill.test.ts` to `tests/personal-plan/products/legacy-inventory-entry.test.ts` and delete the Stage-2-answer cases; adjust pinned fingerprints if they change; fix the four dangling comments.
   Done when: `grep -rn "legacy-prefill\"" src tests scripts` finds no import of the deleted file; no code selects `shampoo_frequency` from `hair_profiles`; the affected test files pass.

### B — the old-writer projection is no longer part of the account-link module

1. `link-to-profile.ts`: remove the re-export of `buildProfileDataFromPersonalPlanCanonicalProfile`, `buildProfileDataFromQuizAnswers`, `buildProfilePrimaryConcern`, `resolveProfileDensityFromQuizAnswers`.
2. `readiness.ts`: import the completeness gate's builder from `@/lib/quiz/legacy-profile-projection`; the gate call and its behaviour are unchanged.
3. `legacy-profile-projection.ts`: header comment only — frozen reproduction of the pre-central-profile writers; consumers are the readiness gate, the backfill's hand-edit detection, oracle tests and one script; no new callers.
4. Tests and the script import the four names from the projection file (import paths only; no oracle logic changes).
5. Guard test (red first): under `src/` only `readiness.ts` and `detect-hand-edits.ts` import the projection; `link-to-profile.ts` exports none of the four names.
   Done when: in `src`, the four names appear only in `legacy-profile-projection.ts`, `readiness.ts`, `detect-hand-edits.ts` (plus the existing comment in `derive-legacy-columns.ts`); affected tests pass; `normalization.ts` untouched.

### C — profile surfaces (journey §6)

1. `section-config.ts`: `ProfileEditTarget = {kind:"quiz"} | {kind:"refine"; module: Stage2Module} | {kind:"onboarding-step"; step:"brush_type"} | {kind:"profile-edit-goals"}`; Styling/Alltag fields → `{kind:"refine", module:"habits"}`, brush → the onboarding-step target (O2); `PROFILE_SECTION_META` gains `descriptionWithoutPlan` for products/styling/routine and the §6 texts.
2. `page.tsx`: one local `refineHref(module)`; exhaustive `openTarget`; plan-owner vs no-plan rendering per §6 for the three sections (header buttons, card interactivity, empty labels, Produkte branches, empty states, loading rule); `selectPlanProductRows(routineProducts)` returns the plan list whenever non-empty; remove `onboarding_completed` copy branches and the hard-coded Produkte description. Keep the lines pinned by source-text tests (`const hasPersonalPlan = useProfileHasPersonalPlan()`, `showPlanRecomputeNotice={hasPersonalPlan}`, the `hasRoutineAccess` gating strings).
3. `product-usage-rows.ts`: `getProductCompletionLabel(rows)`.
4. `routine-page-client.tsx`: remove the „Onboarding anpassen“ button and the unused icon import.
5. Tests (red first): update the three existing test files; new `tests/profile-plan-owner-surfaces.test.tsx` covering: edit targets; `selectPlanProductRows` (plan list wins over legacy rows; null/empty → null); no „Onboarding“ in user-visible strings of the four files; no-plan rendering has no `/plan-start` or `/onboarding` navigation for the three sections (in the repo's existing source-/render-test style).
   Done when: the tests pass and `grep -n "Onboarding" src/app/profile/page.tsx src/lib/profile/section-config.ts src/components/routine/routine-page-client.tsx` shows identifiers/imports only.

## 9. Verification

Automated (final tree, after `npx prettier --write` on all changed files): the affected test files; `npm run test:node`; `npm run test:personal-plan:nested`; `npm run ci:verify`. No migration checks (no SQL).

Browser: dev login (a user without a plan) on `/profile` at 390 px and desktop — the no-plan journey B and the old Routine empty state. The plan-owner journey A cannot be exercised locally (the dev-login account cannot own a plan); it is covered by tests here and checked by Nick in production after deploy.

Live state: none before merge. After deploy: Sentry check; Nick's plan-owner walkthrough (Styling → Feinschliff habits → Routine; Produkte shows plan products).

## 10. Review and handoff

Implementation: Opus orchestrator → three Codex CLI workers (`codex exec -s workspace-write`), one per package, no commits. Because Codex implements, the independent review lane is Claude-side: the main session reads every diff and re-runs the suites; one Claude whole-branch reviewer replaces the Codex whole-branch review for this PR. Stop before commit/push; `/ship` on Nick's „ship it“, merge on „merge it“. Rollback: revert the PR (no schema or data change).

Artifacts: this plan → commit. Worker logs and reviewer output → scratchpad, discard.

## 11. Implementation record (2026-10-05)

Execution: one Opus orchestrator, four Codex CLI worker runs (packages A, B, C, one test fix round); every diff read by the orchestrator and by the main session. No commit by any worker.

Deviations from Rev. 2:

- Package B narrowed (Rev. 3, §2 and §8 B): the gate characterisation showed the old and the projection-based readiness gate disagree on two fixtures, so the gate stays as it is and the projection is not relocated.
- Main-session edits on top of the workers: `RetainedPersonalPlanProducts` kept unconditional (a worker had hidden „Nicht verwendete Produkte“ for plan owners with plan products); the legacy-row filter in `page.tsx` restored to its original, ownership-independent form.
- `tests/profile-page-smoke.spec.ts` was missing from §4: its subscriber has no plan, so the onboarding-edit steps were replaced by the no-plan journey (§6 actor B).

Whole-branch review (Claude-side, independent Opus reviewer, read-only): verdict „ship with fixes“, no behaviour defect in A, B or C.

| ID  | Type                   | Evidence                                                                                                                             | Decision            | Change                                                 | Revalidation                                                                         |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| W1  | defect                 | `profile-page-smoke.spec.ts` still clicked the removed onboarding edit paths for a no-plan user                                      | accepted            | spec rewritten for the no-plan journey                 | locators checked against the markup; first real run is the CI `playwright-smoke` job |
| W2  | defect (test gap)      | the surfaces test never fired „Details ergänzen“ and did not require exactly one `/onboarding` navigation                            | accepted            | both asserted; red proof in a scratch copy (3 failing) | 9/9 pass                                                                             |
| W3  | scope/product decision | for users without a plan an empty Styling/Alltag card keeps the „attention“ style and legacy product rows keep „Details fehlen noch“ | needs user decision | none                                                   | presented to Nick with the ship report                                               |
| W4  | tradeoff               | `descriptionWithoutPlan` is optional, page falls back to an empty string                                                             | rejected            | none                                                   | three sections define it; tests assert the strings                                   |

Verification on the final tree: `npm run test:node` 10,861 pass / 0 fail / 15 skipped; `npm run test:personal-plan:nested` exit 0; `npm run ci:verify` exit 0 (typecheck, lint 0 errors, build) — run before the test-only fix round; after it: `npm run typecheck` clean, `npm run lint` 0 errors, the seven affected profile/guard test files 64/64, prettier clean on all changed files. Browser (dev login = user without a plan, 390 px): Produkte / Styling / Alltag show values and the §6 descriptions, no edit button and no interactive element inside the three sections, Haar-Check and Ziele editing unchanged, no console errors. Not observable locally: the plan-owner journey (Nick, production, after deploy), an empty value card and the old Routine empty state (dev account has values and products).
