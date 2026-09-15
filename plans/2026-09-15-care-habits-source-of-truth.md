# Central user profile: one source of truth for diagnostics, habits and context

Date: 2026-09-15. Status: **Rev. 10 — FINAL. Decision coverage `confirmed`, evidence review confirmed, journey signed off by Nick 2026-09-15. Ready for `implementation-loop` (PR1).**
Worktree: `.worktrees/care-habits-source-of-truth` on `codex/care-habits-source-of-truth`, base `9f1a3dc4` (== `origin/main` at creation, verified).
Successor: `plans/2026-09-13-retire-onboarding.md` in `.worktrees/retire-onboarding` (parked; lands after PR3 and Hair Tools #465, rebased).

## 1. Outcome and source context

Started as "profile edits must survive the onboarding retirement" (D2 of the retirement plan). Nick widened it on 2026-09-15 to the clean architecture: **one central user profile holding every fact the product knows about the person, and every computation reads from it.**

Verified current state (Explore reports 2026-09-15, file:line evidence in the session log):

- Three fact worlds that never sync: (1) quiz answers frozen in `personal_plan_prepared_artifacts.quiz_answers` (v3 envelope) / `leads.quiz_answers` (legacy), read by Stage-1 at compute time and frozen into `personal_plan_need_versions.input_snapshot`; refinement recompute reuses the initial version's frozen envelope forever (`production-persistence-gateway.ts:54-55`, `stage2-refinement-supabase.ts:28-30,273`); (2) Feinschliff habit answers in `personal_plan_refinement_drafts.answers` → immutable refined versions; (3) the `hair_profiles` row, filled from the quiz through the offer-engine legacy-vocabulary adapter (`offer-adapter.ts` → `canonical_profile` → `link-to-profile.ts`), which is lossy (scalp concerns collapsed to one value, concerns capped at 3 with three values never mapped, goals capped at 5 and remapped, missing answers defaulted, nine envelope fields with no column, no provenance). Habit columns are written only by the old onboarding.
- Profile Haar-Check and Ziele editors write only `hair_profiles` and never propagate to the plan (`profile/page.tsx:1086-1149`, `edit-goals-flow.tsx:43-74`).
- Personal-Plan compute consumes towel technique, drying routes, heat tools/events, wash frequency, product categories; it ignores night protection, towel material and brush.
- Chat never writes facts (`set_current_care_context` is turn-local). Chat and the legacy `/routine` page + tracker run the legacy recommendation engine over `hair_profiles` + `user_product_usage`; chat never reads Personal-Plan data. Two engines exist side by side.
- Adapter inventory: **Kind 1 vocabulary translators** (quiz→profile write builders `buildProfileDataFromQuizAnswers` / `buildProfileDataFromPersonalPlanCanonicalProfile`, `projectQuizAnswersToLegacyVocabulary` for profile writes, `legacy-prefill.ts`, Customer.io `quiz-traits.ts` translation) exist only because the row has the wrong shape. **Kind 2 engine input adapters** (`recommendation-engine/adapters/from-persistence.ts`, `routines/planner.ts`, `selection.ts`, `personal-plan/input.ts`) encode logic and survive any storage change.
- `user_products` is already a user-level, catalog-resolved ownership table.
- Production counts (2026-09-15, read-only): 253 hair profiles; 93 plan rows; 77 users with Feinschliff habit answers; 136 with legacy habit columns; 13 both; 115 with brush; 32 plan users with an attached artifact, 4 with a later profile edit, 1 with differing core fields; 143 legacy-onboarding completers.
- Side findings routed elsewhere: legacy prefill selects the nonexistent `hair_profiles.shampoo_frequency` (task chip `task_bf3c597a`); 14 of 143 onboarding completers fail a strict diagnostics check (noted for the retirement plan).

## 2. Chosen direction

**Profile = current facts (mutable, one record per user, one write function). Plan versions = immutable computation snapshots of exactly the facts used.** Facts first, snapshot second: a writer saves the profile, then computation freezes from it. Kind 1 translators are deleted as the program lands; Kind 2 readers keep reading derived narrow columns that the write function maintains, with a recorded retirement date; chat/legacy-engine consolidation is a separate follow-up program (explicitly not now).

```text
writers: quiz account link (artifact → profile, lossless) · Feinschliff modules ·
         profile Haar-Check editor · profile Ziele editor · (later) Hair Tools
                     │  saveUserFacts(userId, domain, patch, provenance)
                     ▼
CURRENT FACTS  hair_profiles
   diagnostics      jsonb  v3 quiz vocabulary, native          (P4 backfill)
   care_habits      jsonb  Feinschliff model + brush            (H1, H3 backfill)
   quiz_context     jsonb  reflective quiz answers              (P1)
   facts_provenance jsonb  per domain {source, schemaVersion, at}
   legacy narrow columns  = derived projections, one owner, rebuildable, retirement date
   user_products (unchanged)
                     │  diagnostics changed → recompute lane (P2/P3)
                     ▼
SNAPSHOTS  personal_plan_need_versions.input_snapshot (exact facts used) → routine versions
readers of CURRENT: Stage-1/2 compute · chat context · profile page · legacy engine (derived cols)
```

## 3. Scope and non-goals

In scope: schema + write function + provenance + derived columns + backfill (PR1); Stage-1/refinement compute reading the profile, the diagnostics recompute lane, editor pre-save copy and "Plan aktualisiert" notice (PR2); Feinschliff and profile editors writing through the function, profile rows linking to Feinschliff modules, Produkte section showing plan products, deletion of Kind 1 translators (PR3).

Non-goals (all acknowledged by Nick 2026-09-15): onboarding retirement (successor plan); Hair Tools #465 integration beyond leaving the brush field open for it; wiring night protection / towel material / brush into Personal-Plan rules (H5 parked); chat/legacy-engine consolidation or re-pointing Kind 2 readers to the rich model (follow-up program); freemium; renaming the `hair_profiles` table or existing columns (parked — churn without benefit; new domains use native names); a profile changelog table (plan versions carry computation-relevant history).

## 4. Target map (Rev. 7)

New module `src/lib/user-facts/` (server-only):

- `schema.ts` — zod schemas, all versioned:
  - `DiagnosticsV1`: the durable quiz answers in native vocabulary (texture, thickness, density, hairLength, hairSurface, elasticResponse, chemicalTreatments[], scalpOiliness, scalpConcerns[], goals[], currentConcerns[], concernRecurrence?, currentConcernsOtherText?) **plus `source`: `{kind: "personal_plan_v3" | "personal_plan_v2" | "legacy_quiz", version, leadId, artifactId?}`** so the Stage-1 source shape (and therefore `input_hash`) can be re-emitted exactly (F10).
  - `CareHabitsV1`: the complete Feinschliff answer set — `currentProductCategories`, `wetWashFrequency`, `scalpIrritationDetail`, `dryShampooBridgePreference`, `dryShampooVisibleHairColor`, `oilPurposes`, `towel`, `dryingRoutes`, `additionalHeatTools`, `heatEvents`, `nightProtection` (F09) — plus `brushesCombs?` (legacy vocabulary now, Hair Tools superset accepted).
  - `QuizContextV1`: routineClarity, resultReliability, adaptationConfidence, previousAttempts, blockers, blockersOtherText, routineStyle, meaningfulMoment.
  - `FactsProvenance`: per domain `{source, schemaVersion, at}` **with optional per-field overrides** for mixed-provenance imports (assumed/resolver-filled answers keep their `assumed` marker) (F08).
- `derive-legacy-columns.ts` — pure `deriveLegacyColumns(diagnostics, careHabits)`; **derivation tables are part of the task, not implied** (F15): drying routes[] → `drying_method` scalar by priority (diffuser > blow-dry > air-dry, as `legacy-prefill.ts:100` inverts today); heat events → `heat_styling` = highest event frequency, `styling_tools` = event sources ∪ additionalHeatTools, `uses_heat_protection` = every event `protectionConsistency === "always"` (no events → false); towel → material/technique; `scalp_condition` = priority pick (irritated > oily_dandruff > dry_dandruff, none → null); `concerns`/`goals` = full vocabulary map, no caps; brush → `brush_type[]`; nulls/empties clear the column. Table-driven tests with one row per rule.
- `save.ts` — `saveUserFacts(admin, { userId, domain, patch, provenance, expectedRevision? })`: **row-creating upsert with `create_only` mode for account linking** (F14); field-level merge (a patch never erases fields it does not name, F13); **`facts_revision` integer bumped on every write and used as CAS** (F04); provenance + derived columns computed in the same statement (a SQL function `user_facts_save_v1` doing merge + derive atomically, so a stale read cannot overwrite derived columns); returns `{ revision, changed, diagnosticsHash }`.
- `read.ts` — `loadUserFacts`; `toStage1Source(facts)` re-emits the stored source kind/version/lead identity (legacy_quiz shape for legacy leads, v3 envelope for v3, v2 decoder retained) so unchanged users hash identically (F10, F16); `toRefinementAnswers(facts)`.
- `project-artifact.ts` — lossless artifact → facts; `project-legacy-lead.ts` → facts with `source.kind = "legacy_quiz"`.
- `trait-serializer.ts` (Customer.io) — pure serializer over *either* projected anonymous answers (lead capture, `api/quiz/lead/route.ts:350`) *or* persisted facts; keys, value vocabulary (`glatt`, `fettig`, …), labels and omission semantics unchanged; snapshot-tested on both inputs (F12).

Migration `supabase/migrations/<ts>_user_facts_domains.sql`: `ALTER TABLE hair_profiles ADD COLUMN diagnostics jsonb, care_habits jsonb, quiz_context jsonb, facts_provenance jsonb NOT NULL DEFAULT '{}', facts_revision integer NOT NULL DEFAULT 0`; function `user_facts_save_v1(...)` (merge + derive + revision CAS); comments on every legacy column naming the derivation owner and the retirement condition. `personal_plans` gains `applied_facts_revision integer` (F05).

Rebase RPC (PR2) `personal_plan_rebase_on_facts_v1(p_user_id, p_expected_facts_revision, p_initial_input_hash, p_initial_input_snapshot, p_initial_output_snapshot, …)` — one transaction (F01, F02, F03, F05, F06): verify `hair_profiles.facts_revision = p_expected_facts_revision` and `personal_plans.applied_facts_revision < p_expected_facts_revision`; insert the new initial version (ON CONFLICT by input hash reuses); **clone the source draft's `answers`, `provenance`, `completed_question_ids` onto a new draft bound to the new initial version, never `module_projections` or `result_refined_need_version_id`** (F01); mark the old draft `stale`; set `applied_facts_revision`; return the new draft id + lineage marker `origin = "facts_rebase"`. The TS lane then projects the refined version through the existing module-completion path with the **new** parent (so `baseInputSnapshot` always comes from the parent and the hash stays coherent, F03), and runs the routine recompute. Activation SQL (`20260825140000`) and `module-driven-classification.ts` accept `origin = "facts_rebase"` lineage as auto-activating (F06); a pending routine proposal older than the rebase is superseded, not left dangling (F05). Identical retry: `applied_facts_revision >= facts_revision` → no-op with the current state returned; partial failure after the facts commit → the next lane run (any edit, any Feinschliff completion, or a recovery worker tick) sees `applied_facts_revision < facts_revision` and finishes (F05).

### 4a. Rev. 8 contract corrections (override the paragraphs above where they conflict)

- **Recovery cursor (F17).** `personal_plans` gets `pending_facts_revision integer null`, `pending_facts_draft_id uuid null` and `applied_facts_revision integer null` (all nullable, initialised null by the migration; null = "never rebased", treated as 0). The rebase RPC sets `pending_*`; **`applied_facts_revision` advances only at the completion boundary** (after the refined re-projection has committed and the routine recompute has been enqueued or determined unnecessary). Retry/recovery rule: `pending_facts_revision > coalesce(applied_facts_revision, 0)` → resume from `pending_facts_draft_id`; identical resubmission is a resume, never a no-op. Tests crash after each boundary: facts commit, rebase commit, projection commit.
- **Draft handling (F18).** The rebase RPC stales only `in_progress` drafts; completed drafts stay untouched (check constraint `(status='complete') = (result_refined_need_version_id IS NOT NULL)`). The clone is a new `in_progress` draft bound to the new initial version with `origin = 'facts_rebase'` (new nullable column on `personal_plan_refinement_drafts`, default `'user'`) (F20).
- **System re-projection (F19).** New entry point `projectStage2DraftForRebase` (service + RPC variant of module completion) that projects a cloned draft through the existing assumption resolver, keeping `assumed` provenance for unanswered questions and never marking them user-answered; handles neither-module-complete and direct-accept (all-assumed) drafts; if the diagnostics change opens new conditional questions they are recorded as open, not answered.
- **Durable lineage (F20).** The refined version produced by re-projection is recorded in the cloned draft's `module_projections` (both modules, `origin: 'facts_rebase'`) and the draft's `origin` column; activation SQL and `module-driven-classification.ts` classify from these persisted fields, never from an RPC response. Committed before the routine-source-change event is enqueued.
- **Writer coverage in PR1 (F21).** Haar-Check (`profile/page.tsx:1120`) and Ziele (`edit-goals-flow.tsx:53`) persistence switch to `saveUserFacts` in PR1 (visual/editor changes stay in PR2); the orphan `PUT /api/profile` route (no callers) is deleted in PR1 and removed from the three route lists.
- **Facts-write validation for Feinschliff (F22).** `user_facts_save_v1` accepts optional `p_source_draft_id, p_expected_draft_revision, p_expected_initial_version_id` and validates them inside the facts-writing transaction (draft exists, `in_progress`, revision equal, bound to the current initial version); rejection leaves facts unchanged. Interleaving test: facts-save(old draft) after facts-save(new draft) is rejected.
- **Readiness proof (F23).** `plan-bereit/readiness.ts` replaces the exact-projection equality gate with a provenance check: initialised when `facts_provenance.diagnostics.source` names the candidate artifact/lead (or the profile predates the candidate and `facts_revision > 0`); create_only preservation never leaves readiness in `checking`. Tests: artifact and legacy candidates with an existing, differing profile.
- **Backfill source (F24, F25).** `care_habits` backfill decodes from the **immutable need version that is the current Stage-2 head**, found by walking: current refined head → if it is a Stage-3 need revision, follow `output_snapshot.inputHash` / `refinedInputHash` to the refined version → its `input_snapshot.answers` and the draft receipt whose `projectedAtRevision` matches (per-answer provenance from the draft at that revision; later unprojected draft edits are ignored, documented as "profile = last computed facts" for the backfill only). Partial module projections resolve the same way. No fallback to legacy columns while any refined version exists.
- **Source preservation (F26).** `diagnostics.source` stores the original envelope verbatim (`source.raw`) for every kind (v3, v2, legacy_quiz); `toStage1Source` re-emits `raw` while `facts_provenance.diagnostics.editedAt` is null; after the first native edit it emits the native v3 envelope and the resulting hash change is a legitimate rebase. Round-trip fixtures cover v2 discarded vocabulary (`scalp_imbalance`), omitted-vs-empty arrays and array order.

- **Backfill provenance (F27, supersedes the provenance sentence in F24/F25).** Values always come from the immutable head (§4a above). Provenance per answer is attributed only when it can be proven: terminal completion path (`result_refined_need_version_id` set → the completed draft's `answer_provenance` is frozen, use it); partial-projection path (receipt `projectedAtRevision` equals the draft's current revision → use the draft's provenance; otherwise mark every answer of that domain `provenance: "unknown_historical"`). No guessing. `assumed` markers propagate where attributable. Fixtures: project → unprojected edit → backfill; full completion without receipt; partial projection at current revision.
- **Readiness proof (F28, supersedes the F23 predicate).** Readiness treats diagnostics as initialised when `hair_profiles.diagnostics` is non-null and `facts_revision > 0`, independent of candidate creation order; candidate ownership and link checks stay as they are. When `create_only` preserves an existing profile, the link records `facts_provenance.diagnostics.preservedCandidates[]` (artifact/lead id + at) so the evidence of the preserved candidate exists without changing the facts. Tests: differing profile created before and after the candidate, both artifact and legacy.

Touched existing files by PR: see §8.

## 5. Decision coverage

Decision coverage: **confirmed** (Nick, 2026-09-15).

Confirmed with Nick (all 2026-09-15 unless noted):

- **A** profile is the single source of truth; plan versions are snapshots; profile edits open Feinschliff-style pages, never onboarding.
- **H1 (a)** versioned JSON domains + derived legacy columns from one write path.
- **H2 (b)** brush capture comes from Hair Tools #465; sequence Hair Tools → this program's PR3 → retirement; onboarding stays live meanwhile.
- **H3 (a)** habits backfill: plan users from current refined version answers, others from legacy columns, Feinschliff wins on overlap.
- **H4** module entry seeds from the profile unless an in-progress draft exists.
- **H5 parked** engine wiring of night protection / towel material / brush → separate rules plan.
- **H6 un-parked** → P1–P5.
- **H7 refined default** Kind 1 translators deleted in this program; Kind 2 readers stay on derived columns with a retirement date; chat/legacy-engine consolidation is a separate follow-up, explicitly not now. Streamline (rename properties, remove indirection) where it removes confusion.
- **H8** migration + backfill run against production before code deploy, no flag; Nick triggers production writes after seeing the dry-run diff.
- **Target picture approved** including "plan reads from the profile, not the artifact".
- **P1 (a)** reflective quiz answers stored as `quiz_context`.
- **P2 (a)** diagnostics edits recompute + activate through the habits lane, with pre-save copy and "Plan aktualisiert" notice; (b) proposal-review can be layered later.
- **P3** inherited: refinement recompute reads current profile facts.
- **P4 (b)** artifact/lead always wins on diagnostics backfill (measured exposure: 1 user; listed in the diff).
- **P5 (a)** three PRs.
- **No chat-engine rewrite now**; profile-write translators are removed, not kept.
- **Copy A/A** (2026-09-15): section buttons keep „… bearbeiten“; Haar-Check shows one sentence above the buttons.
- **R1** (2026-09-15): backfill takes the last computed facts; unprojected Feinschliff draft edits stay in the draft.
- **R2** (2026-09-15): a diagnostics edit supersedes a pending routine proposal without an extra prompt.
- **R3** (2026-09-15): recompute failure after a successful save is recovered silently on the next run, as in the habits lane; no new notice.
- **Inherited, acknowledged** (2026-09-15): saving a diagnostic waits for the recompute (button loading state, as habits completion today); newly opened conditional Feinschliff questions stay open and surface through the existing completeness meter; Kopfhaut-Beschwerden in the Haar-Check editor becomes multi-select to match the quiz.

Inherited from evidence or contract: version immutability and content hashing (`personal_plan_need_versions`), the habits recompute lane semantics (Feinschliff modular-exit rulings), the v3 durable-answers schema as the diagnostics vocabulary, `user_products` as the product-ownership home, TDD for `src/lib/personal-plan/`.

Implementation defaults: module layout above; "facts first, snapshot second" write order; `changed` detection by content hash; backfill idempotency by provenance; Customer.io trait *names* unchanged (only their source moves); no DB triggers.

Open consequential assumptions: none.

Undiscussed consequential assumptions affecting this handoff: none.
Coverage acknowledgement: Nick, 2026-09-15, in-session rulings listed above (A, H1–H8, target picture, P1–P5, H7 refinement, no chat rewrite, copy A/A, R1–R3, inherited items) and journey sign-off ("sounds good, finalize it") on the Rev. 9 journey walkthrough.
Internal revalidation: Rev. 10, 2026-09-15, against `origin/main` 9f1a3dc4; R1–R3 recorded as confirmed; no plan change since the sign-off walkthrough. Changes since the acknowledgements are technical (ledger §11): P3 is realised as "rebase the initial version from the profile first, then refine from that parent" (same intent, hash-safe); P5 keeps three PRs but PR1 now carries every writer (F07); H7's Customer.io translator is re-sourced as a pure serializer rather than deleted (F12); the Haar-Check editor's Kopfhaut-Beschwerden control becomes multi-select to match the native model (F13) — surfaced to Nick with the journey.

## 6. Designed user journey — **signed off by Nick 2026-09-15** (walkthrough matched; no corrections)

PR1 changes nothing a user can see.

PR2:
1. **Existing plan user edits a diagnostic on the Profil tab** (Haar-Check editor, initialised from the native facts; Kopfhaut-Beschwerden allows several picks like the quiz): before saving, one sentence above the buttons states that the plan will be recomputed (copy A, confirmed). Save → profile updated → new initial need version → refined version re-projected from the user's current habits → if a routine is active, its successor is computed and activated. Routine tab shows „Plan aktualisiert“ as after a habits edit. Error: save succeeds, recompute fails → profile keeps the new value, routine unchanged, the editor shows the existing retry notice; a later Feinschliff completion or edit retries the lane.
2. **Ziele edit**: same lane; goals change the need plan.
3. **User without a plan** edits: profile saved, no recompute, no notice.

PR3:
4. **Pending-proposal case (R2)**: a diagnostics edit while a Stage-4 proposal is pending supersedes that proposal with the newly computed one; no prompt.
5. **Profil tab, Styling / Alltag sections**: values shown from the profile; „Bearbeiten“ opens `/plan-start?refine=habits`, walks only that module, returns to the Routine tab as today; completion writes the profile first, then the version and the routine recompute. No button for users without a plan (values still displayed).
5. **Produkte section**: shows the plan's products when a plan exists (legacy usage rows otherwise); „Bearbeiten“ opens `/plan-start?refine=products`.
6. **New plan buyer**: quiz → account link projects the artifact losslessly into the profile; Stage-1 computes from the profile. Same screens as today.
7. **Copy**: no surface says „Onboarding“.

## 7. Planning evidence — mockups published, review pending

Review page (current vs proposed, real component layout, mobile 390 px, dev-login account): https://claude.ai/artifact/6SdJUBpLDCVgZvyUnuzUAC — archived copy `plans/central-user-profile/evidence/profil-ohne-onboarding-review.html`; source screenshots in the same folder (`current-*.png`, `proposed-a-*.png`, `proposed-b-*.png`, `proposed-noplan-*.png`).

Questions the artifact answers: (1) how the Produkte/Styling/Alltag section headers read once they point at Feinschliff modules and drop the word „Onboarding“; (2) button label A („… bearbeiten“, retargeted) vs B („Im Feinschliff anpassen“); (3) the no-plan state (values shown, no button); (4) Haar-Check pre-save recompute notice A (one sentence above the buttons) vs B (button „Speichern & Plan aktualisieren“). Selected direction (Nick, 2026-09-15): (2) **A** — labels „Produkte/Styling/Alltag bearbeiten“ stay, retargeted, descriptions without „Onboarding“; (4) **A** — one sentence above the buttons: „Beim Speichern berechnen wir deinen Plan mit den neuen Angaben neu.“, button label unchanged. No-plan state: values shown, no button. Evidence review: **confirmed** (Nick saw the review page and chose A/A).

Required before sign-off: annotated current/proposed screenshots of (a) Profil Styling/Alltag/Produkte section headers and rows with the Feinschliff links, plan user vs no-plan user; (b) Haar-Check editor with the pre-save recompute copy; (c) Routine tab „Plan aktualisiert“ state after a diagnostics edit (existing component, shown for context). No mockup needed for PR1 or the compute changes.

## 8. Ordered tasks (Rev. 7)

### PR1 — storage, write function, every writer, backfill (no user-visible change)
1. **Schemas** (`schema.ts`) incl. `source` (with verbatim `raw`, F26) on diagnostics and the four products-module facts in `care_habits`; fixtures per domain; round-trip tests for v3 native reconstruction and raw re-emission for v2/legacy incl. discarded vocabulary, omitted-vs-empty arrays and order (F10, F16, F26). Produces the four types + `toStage1Source`.
2. **Derivation tables + function** (`derive-legacy-columns.ts`), one test row per rule in §4 (F15).
3. **Migration + `user_facts_save_v1`** (merge, derive, provenance, revision CAS, create_only mode, optional draft binding per §4a F22); `personal_plans` recovery-cursor columns and `personal_plan_refinement_drafts.origin` (§4a); executable RPC tests against the full migration chain (PGlite lane for logic; local-Supabase lane for two-session races: interleaved diagnostics/habits saves, stale-revision rejection) (F04, F14, F16).
4. **Write + read functions** (`save.ts`, `read.ts`) with fake-client tests and the CAS contract.
5. **Writers switched, readers untouched**: account link (`link-to-profile.ts`, `plan-bereit/readiness.ts:510,552,767`) writes domains via `project-artifact` / `project-legacy-lead` in create_only mode and still writes the legacy columns through derivation; Feinschliff module completion writes `care_habits` **before** the completion RPC and passes the source-draft revision so a stale completion cannot publish older facts (F04); the still-live onboarding flow's `saveHairProfile`/product steps write through `saveUserFacts` too (F07); Haar-Check and Ziele persistence switch to `saveUserFacts` (UI unchanged) and the orphan `PUT /api/profile` is deleted (F21); `plan-bereit/readiness.ts` initialisation proof moves to provenance (F23). Tests: every writer populates domains + derived columns identically to today's column values (golden comparison on fixtures).
6. **Backfill script** (`scripts/user-facts/backfill.ts`, `--dry-run` default): diagnostics from attached artifact → else legacy lead → else columns (P4); care_habits from the **immutable Stage-2 head** per §4a (F24/F25 traversal incl. Stage-3-revised heads and partial projections), per-answer provenance from the matching draft receipt, legacy columns only when no refined version exists; brush always lifted from `brush_type` (versions never carried it); quiz_context from the artifact. Idempotent by provenance + `facts_revision = 0` guard; catch-up mode for rows written between backfill and deploy (F07, F08). Tests over synthetic rows: artifact / lead / columns × version-first / partial projection / direct-accept / Stage-3-revised head / no draft.
7. **Ready-check + Codex whole-branch review + ship PR1**; Nick applies migration + backfill after the dry-run diff (H8). Post-apply live checks: domain counts, zero rows with `facts_revision = 0` among active users, derived columns equal to pre-backfill values for a sampled cohort.

### PR2 — computation reads the profile; diagnostics rebase lane
8. **Stage-1 from facts**: `stage1-service.ts` builds the source via `toStage1Source(facts)`; artifact/lead lookups remain for ownership and enrollment checks only. Test: identical `input_hash` for every fixture user across v3, v2 and legacy (F10).
9. **Rebase RPC + migration** (`personal_plan_rebase_on_facts_v1`, §4 + §4a) with executable RPC tests: partial draft, completed draft (untouched, F18), A→B→A diagnostics, migration-enrolled user (F02), existing pending proposal, identical resubmission = resume, crash after each boundary (F17), fresh-process classification from persisted lineage (F20).
9b. **System re-projection** `projectStage2DraftForRebase` (F19): direct-accept all-assumed draft, neither-module-complete draft, newly opened conditional questions; assumed provenance preserved.
10. **Lineage + activation**: `origin = "facts_rebase"` accepted by the activation function and `module-driven-classification.ts`; recovery worker updated; tests for empty-lineage and historical version reuse (F06).
11. **Facts-recompute lane** (`src/lib/personal-plan/facts-recompute/`): save facts (CAS) → rebase RPC → project refined version from the cloned draft with the new parent → `recomputeRoutineAfterHabitsCompletion` when a routine is active; adversarial fixtures per §4. TDD.
12. **Editors on the native model**: Haar-Check editor initialises from `diagnostics`, submits field patches only (untouched facts, recurrence and context preserved), Kopfhaut-Beschwerden multi-select; Ziele editor likewise; both call the lane through a server action; copy A notice; „Plan aktualisiert“ reuse (F13). E2E journey: edit → successor routine active.
13. **Ready-check + Codex + ship PR2.**

### PR3 — profile surfaces and translator retirement
14. **Feinschliff seeds from facts** (H4); delete `legacy-prefill.ts` and the two loaders; `legacy-inventory-entry.ts` re-sourced from `care_habits` + `user_product_usage` with its inventory-hint contract kept (F11).
15. **Profile-write translators deleted**: `buildProfileDataFromQuizAnswers`, `buildProfileDataFromPersonalPlanCanonicalProfile` and the profile-write use of `projectQuizAnswersToLegacyVocabulary` removed from `link-to-profile.ts` and `readiness.ts`; `projectQuizAnswersForLegacyConsumers` **stays** for the anonymous offer preview and result narrative (`offer-preview.ts:242`, `result-narrative.ts:936`) — pre-account surfaces, not profile writes (F11).
16. **Customer.io serializer** switched in (task-4 module), snapshot equality on both lifecycle paths (F12).
17. **Profile surfaces** per confirmed mockup A/A: section descriptions, retargeted buttons to `/plan-start?refine=habits|products`, no button without a plan, `selectPlanProductRows` flip, `section-config.ts` editTarget `{kind:"refine", module}`, `routine-page-client.tsx` empty-state button removed.
18. **Ready-check + Codex + ship PR3.** Then Hair Tools #465, then the retirement plan resumes.

## 9. Verification

- Automated: `npm run test:node`, `npm run test:personal-plan`, `npm run ci:verify` per PR; table-driven suites for derivation, precedence and projection; byte-equal envelope round trips and identical-hash tests for v3/v2/legacy (tasks 1, 8); executable RPC tests against the full migration chain (PGlite) for `user_facts_save_v1` and the rebase RPC; a local-Supabase lane (`supabase start`) for two-session concurrency cases, run in ready-check and documented as manual if CI has no Docker (F16); e2e journey for the diagnostics edit (task 12).
- Manual/browser: PR2 profile edit → Routine „Plan aktualisiert“; PR3 Profil rows → Feinschliff module → return; Produkte source flip for a plan user and a legacy user (dev login + labs harness per `docs/local-qa-access.md`).
- Migration/live-state: migration on a Supabase branch in CI; backfill dry-run diff reviewed by Nick; post-apply counts; Sentry check after each deploy (CLAUDE.local.md).
- Evidence-sensitive review: mockups (a)–(c) reviewed before PR2/PR3 implementation; journey sign-off recorded here.

## 10. Review and handoff — **handed off 2026-09-15**

Branch/worktree: `codex/care-habits-source-of-truth`; each PR ships from this worktree in sequence (PR1 merges before PR2 starts). Review gates: Codex plan review (read-only) before implementation; Codex whole-branch review before each push; no push without explicit „ship it“; production migration/backfill only on Nick's explicit apply. Rollout risks: backfill correctness (mitigated by dry-run diff + idempotency), recompute lane on real plans (mitigated by adversarial fixtures + single-user production canary before wide use). Artifacts: this plan `commit`; mockups and review page `commit` under `plans/central-user-profile/evidence/`; Codex review transcripts `discard` (ledger §11 is the durable record); backfill dry-run diff `archive` outside the repo. Recommended `implementation-loop` kickoff: PR1 tasks 1–7 in `.worktrees/care-habits-source-of-truth`, `branch-gate` then `subagent-driven-development`, TDD; stop before publication for Codex whole-branch review and an explicit „ship it“.

Follow-up programs recorded: (F1) chat/legacy-engine consolidation and Kind 2 re-pointing, then drop derived columns; (F2) rules wiring for night protection / towel material / brush (H5); (F3) onboarding retirement (existing plan); (F4) optional rename `hair_profiles` → user facts table.

## 11. Counterpart review ledger — Codex round 1 (2026-09-15, session 01a0a47e-b569-74d3-bc1c-e959043c3adb, read-only, `--effort high`)

Verdict received: "not implementation-ready" (13 P1, 3 P2). Six claims spot-checked in the repo before acceptance (F02 RPC early-return at `20260828104243:693-705`, F03 hash preimage `persistence/index.ts:95`, F06 lineage `module-driven-classification.ts:33`, F08 Stage-3 snapshot `20260813124500:68`, F11 consumers, F12 lead-capture sync). All 16 accepted as technical defects; none changes a ruled decision.

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| F01 | defect | module RPC replays `module_projections` receipts | accepted | rebase clones answers/provenance only (§4, task 9) | Rev. 7 |
| F02 | defect | latest initial RPC returns the existing version for enrolled users | accepted | dedicated rebase RPC (§4, task 9) | Rev. 7 |
| F03 | defect | refined hash excludes `baseInputSnapshot` | accepted | rebase first, refine from the new parent (§4) | Rev. 7 |
| F04 | defect | no CAS on the profile row | accepted | `facts_revision` + `user_facts_save_v1` + source-draft revision on completion (§4, tasks 3, 5) | Rev. 7 |
| F05 | defect | no durable recovery after facts commit | accepted | `applied_facts_revision`, retry semantics, proposal supersession (§4) | Rev. 7 |
| F06 | defect | activation requires module lineage | accepted | `origin = "facts_rebase"` lineage (task 10) | Rev. 7 |
| F07 | defect | authority gap between backfill and PR3 writers | accepted | all writers incl. onboarding move to PR1; catch-up mode (tasks 5, 6) | Rev. 7 |
| F08 | defect | refined `input_snapshot` not a uniform answers source | accepted | draft-based backfill with per-answer provenance (task 6) | Rev. 7 |
| F09 | defect | four Feinschliff facts had no home | accepted | added to `CareHabitsV1` (§4) | Rev. 7 |
| F10 | defect | legacy/v2 sources hash differently | accepted | `diagnostics.source` + `toStage1Source` re-emits the stored shape (§4, tasks 1, 8) | Rev. 7 |
| F11 | defect | deletion missed live consumers | accepted | readiness, inventory entry, offer/result projector kept (tasks 14, 15) | Rev. 7 |
| F12 | defect | Customer.io traits run at anonymous capture | accepted | pure serializer over answers or facts; vocabulary unchanged (task 16) | Rev. 7 |
| F13 | defect | editor initialises from lossy columns | accepted | editor on native model, field patches, multi-select scalp concerns (task 12) — surfaced to Nick | Rev. 7 |
| F14 | defect | writer had no row-creation contract | accepted | upsert with `create_only` (§4) | Rev. 7 |
| F15 | defect | derivation rules unspecified | accepted | derivation tables in §4, task 2 | Rev. 7 |
| F16 | defect | verification could not prove invariants | accepted | round-trip equality, RPC tests on the migration chain, local-Supabase race lane (§9) | Rev. 7 |

Codex round 2 required (material blocker-driven changes): re-review Rev. 7 with focus on §4 rebase RPC contract, task 6 backfill decoding, and the PR1 writer set.

### Codex round 2 (2026-09-15, session 01a0a48f-9c44-70e0-8240-718b4e1ee866)

Spot-checked before acceptance: F18 constraint (`foundation.sql:65`), F21 orphan route + direct upserts (`profile/page.tsx:1120`, `edit-goals-flow.tsx:53`), F23 equality gate (`readiness.ts:571-577`), F26 lossy v2 map (`input.ts:165-182`). All ten accepted.

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| F17 | defect | applied cursor advanced too early | accepted | pending/applied cursor, resume semantics (§4a) | Rev. 8 |
| F18 | defect | staling a completed draft violates the check constraint | accepted | stale open drafts only (§4a) | Rev. 8 |
| F19 | defect | module completion cannot project cloned/assumed drafts | accepted | `projectStage2DraftForRebase` (task 9b) | Rev. 8 |
| F20 | defect | lineage marker not persisted | accepted | draft `origin` column + projection receipts (§4a) | Rev. 8 |
| F21 | defect | Haar-Check/Ziele/`PUT /api/profile` still legacy writers in PR1 | accepted | persistence switched in PR1, orphan route deleted (task 5) | Rev. 8 |
| F22 | defect | draft revision passed too late | accepted | draft binding validated inside the facts write (§4a) | Rev. 8 |
| F23 | defect | readiness equality gate vs create_only | accepted | provenance-based initialisation proof (task 5) | Rev. 8 |
| F24 | defect | mutable draft may hold unprojected answers | accepted | decode from the immutable head + receipt revision (task 6) | Rev. 8 |
| F25 | defect | Stage-3-revised heads have no draft receipt | accepted | lineage traversal via `refinedInputHash` (task 6) | Rev. 8 |
| F26 | defect | v2 sources cannot be reconstructed natively | accepted | verbatim `source.raw` re-emitted until first native edit (§4a, task 1) | Rev. 8 |

Round 3 (delta-focused) required before handoff.

### Codex round 3 (2026-09-15, session 01a0a496-fc4c-7f61-a758-afee1c38fcbd, delta-focused)

Closed by Rev. 8 per Codex: F17, F18, F19, F20, F21, F22, F25 (linkage), F26. Remaining:

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| F27 | defect | receipts store no provenance snapshot; later saves overwrite `answer_provenance` | accepted | provenance attributed only when provable, else `unknown_historical` (§4a) | Rev. 9 |
| F28 | defect | readiness accepts a requested older candidate; predicate strands newer preserved profiles | accepted | initialised = diagnostics present + `facts_revision > 0`; `preservedCandidates` evidence (§4a) | Rev. 9 |

Ledger closed 2026-09-15. Round 4 not run (narrow clarifications, no new mechanism). Implementation gate: journey sign-off.
