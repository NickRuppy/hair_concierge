# Central user profile — PR2: the plan follows the profile

Date: 2026-10-03. Status: **implemented (Rev. 4 plan, §12 implementation record, §13 whole-branch review ledger); decisions confirmed; shipped as a PR on 2026-10-04. Production migrations and merge are separate steps (§9).**
Worktree: `.worktrees/central-profile-pr2` on `codex/central-profile-pr2` (base `origin/main` 192a61ee).
Parent plans: `plans/2026-09-15-care-habits-source-of-truth.md` (Rev. 10: §4, §4a, §5, §6, §7, §8 tasks 8–13, ledger §11) and `plans/2026-09-30-central-user-profile-clean-switch.md` (§3, §9). This file is the PR2 execution contract against today's code; where it is more specific than Rev. 10 it wins, and every such point is listed in §5.

## 1. Outcome and source context

After PR2 the Personal Plan is computed from the profile, and a profile edit moves the plan.

- Stage 1 builds its source from the profile facts (`hair_profiles.diagnostics` + `quiz_context`) instead of the quiz artifact / lead.
- When a user with a plan saves a Haar-Check answer or their goals, the plan is rebuilt on the new facts with their current Feinschliff answers; an active routine gets its successor computed and activated.
- Before saving, plan users read one sentence; afterwards the Routine tab shows „Plan aktualisiert“.

State of `main` (three read-only maps, 2026-10-03, HEAD 192a61ee):

- PR1 shipped more than Rev. 10 assumed: both editors already work on the native model and post field patches to `POST /api/profile/answers` (`src/lib/hair-profile/edit-route.ts`); Kopfhaut-Beschwerden is multi-select; the cursor columns (`personal_plans.pending_facts_revision`, `pending_facts_draft_id`, `applied_facts_revision`) and `personal_plan_refinement_drafts.origin` (`'user' | 'facts_rebase'`) exist; `toStage1Source`, `toStage1SourceFromFacts`, `loadUserFacts`, `toRefinementAnswers` exist and have no production caller on the plan side.
- Not built: the rebase RPC, the re-projection, the lane, any reader or writer of the cursor / `origin`, any plan call in the profile route.
- `personal_plan_create_or_reuse_initial_need` has a destructive branch (`20260828104243:727–731`): a different hash for an existing plan stales the open refinement draft and nulls the refined head, without a clone and without a routine recompute. Once Stage 1 reads facts, a plain Stage-1 load after a profile edit would hit it.
- `src/lib/scan/scanner-context.ts:636–656` requires exactly one refinement draft on the current initial version that carries the current refined version (terminal result, or a `module_projections` entry at the draft's current revision); otherwise the scanner context is unavailable.
- Activation SQL (`20260825140000:78–101`) and `module-driven-classification.ts:33` auto-activate a successor only when a draft of the plan has a non-empty `module_projections` naming the refined version (SQL: any key; TS: `products` / `habits` only).
- The habits lane reports a failed routine recompute silently (`moduleCompletion.recompute.outcome = "unavailable"`, HTTP 200); recovery is the `refined_need` outbox drained by `POST /api/personal-plan/routine/sync` when the Routine page opens. There is no cron.
- „Plan aktualisiert“ is a one-shot URL param (`?planUpdated=1`, `src/lib/personal-plan/routine/plan-updated-signal.ts`), set only by the Feinschliff flow.
- The profile area uses API routes with injectable-deps factories; it has no server actions.
- Production (read-only, 2026-10-03): 108 users have a plan; all 108 have facts from which a Stage-1 source can be built (80 `legacy_quiz` unedited, 22 `personal_plan_v3` unedited, 6 `legacy_quiz` hand-edited). No plan user has a `legacy_columns` source or an assumed / missing required field. The 76 + 46 incomplete profiles all belong to users without a plan.

## 2. Chosen direction

One function, `syncPlanWithFacts(userId)`, is the only way an existing plan moves to new diagnostics. It compares the hash of the Stage-1 source built from the current facts with the plan's current initial version and, when they differ, computes the new initial version **and** the re-projected refined version in TypeScript and commits both in **one** transaction (`personal_plan_rebase_on_facts_v1`). The routine recompute is the existing habits orchestrator, called inline by the profile route and otherwise by the existing outbox self-heal.

```text
POST /api/profile/answers ─ save facts (door) ─┐
GET/POST stage-1, /plan-start, readiness ──────┤ existing plan?
POST /api/personal-plan/routine/sync ──────────┤
PATCH /api/personal-plan/stage-2 (habits) ─────┘
            ▼
 syncPlanWithFacts(userId)                      src/lib/personal-plan/facts-recompute/
   facts → toStage1SourceFromFacts → computeNeedPlan → input hash
   hash == current initial → unchanged
   hash != current initial →
     resolve the new initial's id (existing row with this hash, else a fresh uuid)
     source draft (in progress on the current initial, else its latest complete one)
       → resolveAssumedAnswers → refined snapshot on the NEW parent
     personal_plan_rebase_on_facts_v1: initial version, clone, refined version, lineage,
       refined head, refined_need outbox row, applied_facts_revision — one commit
            ▼
 active routine → recomputeRoutineAfterHabitsCompletion (inline in the profile route;
                  otherwise the outbox self-heal on the next Routine visit)
```

"Needs a rebase" is decided by content (hash of the facts-derived source ≠ `input_hash` of the current initial version), not by a revision counter: `facts_revision` also moves on care-habit writes. Because the rebase is one commit there is no half-rebased plan: a failure before the commit leaves the plan untouched and the next trigger sees the same hash difference; a failure after it leaves only the routine recompute, which the `refined_need` outbox row recovers. `pending_facts_revision` / `pending_facts_draft_id` stay unused (always NULL); `applied_facts_revision` records the facts revision the plan was last rebased on.

## 3. Scope and non-goals

In scope: Rev. 10 tasks 8–13 as re-cut in §8.

Non-goals (unchanged from Rev. 10 / clean switch §9): retargeting Styling / Alltag / Produkte to the Feinschliff, Feinschliff seeding from facts (H4), translator deletion, Customer.io serializer (all PR3); wiring night protection / towel / brush into plan rules; chat / legacy engine. Also not in PR2: the other Stage-1-style creators that read the artifact directly at account creation or before an account exists (`freemium/plan-provisioning.ts`, `free-snapshot-service.ts`, `direct-acceptance/accept.ts`, `discovery/load-ideal-routine.ts`, `scan/scanner-context.ts`) — Rev. 10 task 8 names `stage1-service.ts` only; they are listed in the PR as the remaining artifact readers. No new user-facing copy besides sentence A.

## 4. Target map

New:

- `supabase/migrations/20261003150000_personal_plan_rebase_on_facts.sql` — `personal_plan_rebase_on_facts_v1` (service_role only, `SECURITY DEFINER`, `search_path ''`).
- `supabase/migrations/20261003150100_personal_plan_create_initial_keeps_rebased_head.sql` — the 10-argument `personal_plan_create_or_reuse_initial_need` with one added guard: a plan with `applied_facts_revision IS NOT NULL` is returned as it is, never re-pointed (W01).
- `src/lib/personal-plan/profile-plan-ownership.ts` — tier-independent "a plan row exists" for the profile layout (W05).
- `src/lib/personal-plan/facts-recompute/` — `sync-plan-with-facts.ts` (pure orchestration over injected deps), `production-deps.ts`, `types.ts`.
- `scripts/user-facts/plan-hash-audit.ts` — read-only: per plan user, facts-derived hash vs current initial `input_hash`.
- `scripts/user-facts/plan-rebase-dry-run.ts` — read-only: the real lane with its production reads for every plan user, the RPC call replaced by a recorder.
- `scripts/personal-plan/rebase-concurrency-proof.ts` — real-Postgres two-session proof (Docker) for a Feinschliff reopen racing a rebase.

Changed:

- `src/lib/personal-plan/persistence/stage1-service.ts`, `stage1-supabase.ts` — source from facts; existing-plan divergence handed to the lane.
- `src/lib/personal-plan/persistence/stage2-refinement-service.ts` (or a sibling module) — `buildRebaseProjection` (pure).
- `src/lib/scan/scanner-context.ts` — current-publication selection when a refined version has more than one carrying draft (R04).
- `src/lib/personal-plan/refinement-recompute/module-driven-classification.ts` — only if the tests in task 4 show a gap (the chosen projection keys satisfy today's rule).
- `src/lib/hair-profile/edit-route.ts`, `src/app/api/profile/answers/route.ts` — lane + inline routine recompute, `plan` field in the response, `maxDuration = 60`.
- `src/app/api/personal-plan/routine/sync/route.ts`, `src/app/api/personal-plan/stage-2/route.ts` — retry triggers.
- `src/app/profile/layout.tsx`, `src/components/profile/profile-routine-access.tsx`, `src/components/profile/haar-check-editor.tsx`, `src/app/profile/page.tsx`, `src/components/profile/edit-goals-flow.tsx` — sentence A for plan users, outcome handling.
- `src/lib/personal-plan/routine/plan-updated-signal.ts`, `src/components/routine/personal-plan/personal-plan-routine-client.tsx` — one-shot pending signal.
- `tests/personal-plan-pglite-migration.fixtures.ts` — chain extended as the new RPC tests need (at least `20260812143000`), plus the new migration.

### 4a. Contracts (shared exact values; tasks reference this section)

**`personal_plan_rebase_on_facts_v1`** — one transaction. Parameters:

```text
p_user_id uuid, p_personal_plan_id uuid,
p_expected_plan_revision bigint,        -- personal_plans.revision the caller computed against
p_expected_facts_revision integer,      -- hair_profiles.facts_revision the caller computed from
p_initial_id uuid,                      -- id of the new initial version (see step 5)
p_schema_version integer, p_computation_version text,
p_initial_input_hash text, p_initial_input_snapshot jsonb, p_initial_output_snapshot jsonb,
p_source_draft_id uuid DEFAULT NULL, p_expected_draft_revision bigint DEFAULT NULL,
p_clone_answers jsonb DEFAULT NULL, p_clone_completed_question_ids text[] DEFAULT NULL,
p_clone_answer_provenance jsonb DEFAULT NULL,   -- the clone's content (see „Clone content“)
p_care_habits_patch jsonb DEFAULT NULL, p_care_habits_provenance jsonb DEFAULT NULL,  -- facts-first write (step 4a)
p_refined_schema_version integer DEFAULT NULL, p_refined_computation_version text DEFAULT NULL,
p_refined_input_hash text DEFAULT NULL, p_refined_input_snapshot jsonb DEFAULT NULL,
p_refined_output_snapshot jsonb DEFAULT NULL
RETURNS jsonb
```

1. Lock order: `personal_plans` row → every refinement draft of the plan → `hair_profiles` row (`FOR UPDATE`, the same lock the door takes, so the in-transaction facts write of step 4a never upgrades a lock). (The door locks draft → `hair_profiles`; module completion locks plan → draft.) `invalid_source` when plan / owner / current initial version is missing.
2. `plan_revision_conflict {currentRevision}` when `personal_plans.revision <> p_expected_plan_revision`; `facts_revision_conflict {currentRevision}` when `hair_profiles.facts_revision <> p_expected_facts_revision`. Both are retried by the caller after a reload.
3. `unchanged` when the current initial version's `input_hash = p_initial_input_hash`: the only write is `applied_facts_revision = greatest(coalesce(applied_facts_revision, 0), p_expected_facts_revision)`.
4. Source draft, decided in SQL = the `in_progress` draft on the current initial version, else the latest `complete` draft on it, else none. It must match the caller's view: `draft_conflict` when its id ≠ `p_source_draft_id` (both NULL = match) or its `revision <> p_expected_draft_revision`. Refined parameters are required exactly when the plan has a refined head (`current_refined_need_version_id IS NOT NULL`) and forbidden otherwise; a refined head without a source draft, a source draft without the three `p_clone_*` values, a `complete` source draft without refined parameters, or refined parameters without the two `p_care_habits_*` values (and vice versa) → `invalid_source`, nothing written.
   4a. **Facts first, same transaction** (I1, R16, R17): with refined parameters, after every check above has passed and before any plan write, call `public.user_facts_save_v1(p_user_id, 'care_habits', p_care_habits_patch, p_care_habits_provenance, p_expected_revision => p_expected_facts_revision)`. Any result other than `ok` raises an exception (the whole rebase rolls back). The revision it returns is the `applied_facts_revision` of step 9 and is returned as `factsRevision`. The door is the only writer of `hair_profiles` here; the lock guard stays satisfied. A rejected rebase therefore never leaves a facts write behind, and no draft binding is needed (this transaction already holds the draft lock and has verified its revision).
5. Initial version: if a row `(personal_plan_id, input_hash = p_initial_input_hash, kind 'initial')` exists it must have id `p_initial_id`, else `initial_conflict {existingId}` (caller retries with that id — the refined hash contains the parent id). Otherwise insert with id `p_initial_id`; `prepared_artifact_source_id`, `stage1_source_kind`, `stage1_source_lead_id` are **copied from the current initial version**. A→B→A therefore returns to the old row.
6. Supersede every `pending` routine proposal of the plan and clear `pending_routine_proposal_id` (R2 / R08), as `personal_plan_stage_routine_successor` does.
7. With refined parameters, insert the refined version **first** (parent `p_initial_id`; `ON CONFLICT (personal_plan_id, parent_need_version_id, input_hash) WHERE kind = 'refined' DO NOTHING`, re-select) — the clone's status/result CHECK and FK are immediate (R10). Then mark **every** `in_progress` refinement draft of the plan `stale`, whatever its base (R01: a draft reopened on an old base after an earlier rebase must not block the clone's unique slot); completed drafts stay untouched (F18). Stale `active` product drafts of the plan whose refined version is not the new one.
8. With a source draft, insert the clone: new id, `base_initial_need_version_id = p_initial_id`, the source's `schema_version` and `revision`; `answers`, `completed_question_ids`, `answer_provenance` from the `p_clone_*` parameters; `origin 'facts_rebase'`; **`status` = the source draft's status**.
   - With a refined version: `module_projections` = one entry per `products` / `habits` key present on the source draft — **`habits` when it has none** — each `{needVersionId, projectedAtRevision: revision, projectedAt: now(), stage3Handoff: <the source entry's flag for 'products', false otherwise>, origin: 'facts_rebase'}`. `result_refined_need_version_id` = the refined version when the status is `complete`, else NULL.
   - Without one (plan had no refined head; the source is then `in_progress`): `module_projections '{}'`.
9. `personal_plans`: `current_initial_need_version_id = p_initial_id`, `current_refined_need_version_id` = the refined version or NULL, `revision + 1`, `applied_facts_revision` = the facts revision after step 4a (`p_expected_facts_revision` when no facts were written), `pending_facts_revision = NULL`, `pending_facts_draft_id = NULL`.
10. With a refined version: `personal_plan_enqueue_routine_source_change(user, plan, 'refined_need', id)` — same transaction, after the lineage is written (F20).
11. Returns `{status: 'rebased', initialNeedVersionId, refinedNeedVersionId | null, cloneDraftId | null, revision, factsRevision}`.

Why these keys: an entry under `products` / `habits` satisfies the activation SQL's Condition 1 and the TS classifier without changing either; `products.stage3Handoff` is a persistent "has ever handed off" fact (`refinement-status.ts:48–58`) and is carried over unchanged; module completeness is computed from user answers, never from projections. The `origin` field inside an entry is ignored by every existing reader (Codex round 1, verified) and is read by exactly one new rule:

**Stage-3 resume after a rebase** (R11): `mapModuleProjections` keeps the optional `origin`; `loadModule1Stage3Resume` does not resume for a `products` entry with `origin 'facts_rebase'` when **no** Stage-3 product draft exists for that refined version (a system rebase never started a Stage-3 leg). A user handoff (no `origin`) keeps today's behaviour, including the rescue before the first Stage-3 draft exists; a rebased entry resumes as soon as a live product draft exists for it.

**Clone content and projection — `buildRebaseProjection`** (pure, F19, R06, R12). Input: the source draft (`status`, `answers`, `completedQuestionIds`, `answerProvenance`), the new initial version's id, input snapshot and output snapshot, the source id, whether the plan has a refined head. Output: `{clone: {answers, completedQuestionIds, answerProvenance}, refined: {schemaVersion, computationVersion, inputHash, inputSnapshot, outputSnapshot} | null, careHabits: {patch, fieldProvenance} | null}` (`careHabits` is non-null exactly when `refined` is). The rule is "produce exactly what the user's own lane would produce on the new parent":

- Source `in_progress` (module lane): the clone is the source verbatim; the refined snapshot is built exactly as `completeModule` builds it (`resolveAssumedAnswers` over the user-answered ids under the new trigger context, `habitsModuleUserComplete` from `stage2ModuleStates`). No module-completeness gate. Assumed answers stay assumed (snapshot only), newly opened questions stay open, answers that left the path are pruned from the snapshot only. `refined` is `null` when the plan has no refined head.
- Source `complete` (terminal lane, incl. direct acceptance): `resolveAssumedAnswers({triggerContext: new, answers: source.answers, userAnsweredQuestionIds: userAnsweredQuestionIds(source.completedQuestionIds, source.answerProvenance)})` — user answers are kept, every other question on the new path is resolved by the assumption rules (R15: the direct-acceptance `defaults` builder only resolves an empty draft and cannot keep user answers). The clone carries the resolver's full path: its answers, its ordered question ids, provenance `user` for the user-answered ids and `assumed` for the resolved ones. `resolveStage2RefinementContract` over the clone must report complete (otherwise the lane returns `unavailable / invalid_source`). The refined snapshot is built exactly as `completeDraft` builds it (contract answers verbatim, no `habitsModuleUserComplete`). The clone stays `complete`, so an accepted plan keeps its `/plan-start` routine redirect; a question the edit newly opened is answered as _assumed_ and therefore shows as open in the completeness meter — the acknowledged behaviour.
- Hash equality is the acceptance test: for identical answers on the same parent, the projection's refined `inputHash` equals the hash the real lane produces — module completion for an in-progress source, terminal completion for a complete source (user-only **and** mixed provenance; direct acceptance itself rejects mixed drafts, `accept.ts:413–415`, so terminal completion is the oracle there), direct acceptance for an all-assumed source.
- Facts first (I1): whenever a refined version is published, the lane passes `p_care_habits_patch = toCareHabitsPatch(clone answers)` and `p_care_habits_provenance = {source: {kind: "feinschliff_draft", id: source draft id}, schemaVersion, at, fields: toFieldProvenance(clone)}` — the same patch and provenance `writeCareHabitsFacts` builds — and the RPC writes them inside the rebase transaction (step 4a). This also covers answers the user saved in an in-progress draft but had not published yet (R16): a rebase publishes the draft's current state, exactly as the next module completion would.

**Scanner current publication** (R04): when more than one draft on the current initial version carries the current refined version, `scanner-context.ts` uses the one `loadExistingFromSource` would return — the `in_progress` draft, else the latest `complete` one; `stale` drafts never count. Exactly one candidate after that rule, else the existing error.

**`syncPlanWithFacts(deps, {userId}) → SyncPlanWithFactsResult`**

```ts
type SyncPlanWithFactsResult =
  | { status: "no_plan" }
  | { status: "unchanged"; personalPlanId: string }
  | {
      status: "rebased"
      personalPlanId: string
      initialNeedVersionId: string
      refinedVersionId: string | null
      activeRoutineVersionId: string | null
    }
  | {
      status: "unavailable"
      reason: "facts_not_computable" | "conflict" | "invalid_source" | "unexpected_error"
      retryable: boolean
    }
```

Never throws. One internal retry after `plan_revision_conflict`, `facts_revision_conflict`, `draft_conflict`, `initial_conflict`, or a Postgres deadlock / serialization failure (`40P01`, `40001`; R14) — reload everything; a second one → `unavailable / conflict`, retryable. `facts_not_computable` = no diagnostics, `UnsupportedUserFactsSourceError` (`legacy_columns`) or `UserFactsIncompleteError`; non-retryable, nothing written. `computeNeedPlan` is called with `artifactId` = the current initial version's `prepared_artifact_source_id ?? stage1_source_lead_id`, exactly as `mapDraft` does for refined versions. The new initial's id is the id of an existing initial row with the same hash, else `crypto.randomUUID()`.

**Profile route response** (`POST /api/profile/answers`, 200): today's body plus `plan?: { outcome: "applied" | "unchanged" | "unavailable" }`. Omitted for users without a plan and for a no-op save. `applied` = lane `rebased` and (no active routine, or no refined version, or the routine orchestrator returned `applied`); `unchanged` = lane `unchanged`, or orchestrator `unchanged`; `unavailable` = anything else. Reasons never reach the client (as in the stage-2 route). The save itself never fails because of the plan.

**Client signal**: `markRoutinePlanUpdatedPending()` / `consumeRoutinePlanUpdatedPending()` in `plan-updated-signal.ts` (`sessionStorage`, key `chaarlie_plan_updated_pending`, try/catch). The routine client shows the existing toast when the URL param **or** the pending mark is present, and clears both.

**Sentence A** (confirmed 2026-09-15): „Beim Speichern berechnen wir deinen Plan mit den neuen Angaben neu.“ — `text-sm text-muted-foreground`, directly above the button row; shown only when the layout reports `hasPersonalPlan` (journey access `kind === "personal_plan"`, i.e. a `personal_plans` row exists).

## 5. Decision coverage

Decision coverage: **confirmed**.

Confirmed with Nick (2026-09-15, Rev. 10 §5 — unchanged): P2 (a) diagnostics edits recompute and activate through the habits lane with pre-save copy and „Plan aktualisiert“; P3 refinement recompute reads current profile facts (realised as rebase-first); R2 a diagnostics edit supersedes a pending routine proposal without a prompt; R3 a failed recompute after a successful save is recovered silently on the next run, no new notice; copy A (one sentence above the buttons, button label unchanged); saving waits for the recompute (button loading state); newly opened conditional Feinschliff questions stay open; journey §6 items 1–3 signed off. Confirmed 2026-09-30: completeness defaults never feed a plan calculation.

Inherited from evidence or contract: F01–F06, F17–F20 (rebase contract, ledger §11); the activation and scanner lineage rules cited in §1; the stage-2 route as the precedent for "save, recompute inline, report an outcome".

Implementation defaults (no product consequence):

- API route instead of the "server action" Rev. 10 names (repo convention; the lane is the same).
- R3 over the journey's phrase "the editor shows the existing retry notice": no such notice exists; a failed recompute shows the normal success state, exactly like the habits lane.
- Hash comparison as the "needs a rebase" test; the cursor only marks unfinished runs.
- One transaction for the whole rebase (initial version, clone, refined version, lineage, outbox row, `applied_facts_revision`), with the new initial's id supplied by the caller so the refined hash can be computed beforehand. This removes the half-rebased state Rev. 10 §4a recovered with `pending_*` (F17); those two columns stay NULL. The routine recompute is the existing, separately recovered step.
- The clone keeps the source draft's status; its content and refined snapshot are what the user's own lane would produce on the new parent (§4a „Clone content and projection“); projection entries reuse the source draft's module keys (fallback `habits`), each tagged `origin: 'facts_rebase'`.
- A reopen racing a rebase is handled by a bounded retry, not by changing `reopen` (R14).
- A rebase publishes the source draft's current answers, including answers saved in an unfinished module, and writes them to the profile in the same transaction (R16) — the same thing the user's next module completion would do. Confirmed by Nick 2026-10-04.
- A rebase always supersedes a pending routine proposal (R2), also when the routine recompute then has nothing to do.
- The new initial version copies its source-identity columns from the current initial version.
- Stage-1 creation falls back to the artifact / lead envelope when the facts cannot produce a source (`legacy_columns`, incomplete, none) — today's behaviour for those users, and what dev seeds need (`seed-profile.ts:43` TODO).
- `sessionStorage` one-shot for the Routine toast, because the Haar-Check editor stays on the profile page.
- Sentence A is shown in the Ziele editor too (same lane, same wait; Rev. 10 §6 item 2). Confirmed by Nick 2026-10-04.

Confirmed with Nick 2026-10-04 ("ship it, all four are fine"):

- **Rollout catch-up:** users whose profile already differs from what their plan was computed on (hand edits made before PR2, or a newer own quiz than the plan's source) get their plan recomputed automatically the next time they open the Routine tab, load the plan start, or edit. Audit 2026-10-03 (`scripts/user-facts/plan-hash-audit.ts`, read-only, production): 108 plan users, 101 identical, 7 differ, 0 not computable — 5 hand-edited (all with an active routine), 2 with a newer own quiz than the plan's source (1 with an active routine). Legacy sources carry the lead id in the hash, so a different lead alone counts as a difference; none of the 7 differs by identity only.
- **Sentence A in the Ziele editor** as well as the Haar-Check editor (same lane, same wait).
- **Unfinished Feinschliff answers:** a rebase publishes the source draft's current answers, including answers saved in an unfinished module, and writes them to the profile in the same transaction.
- **Ship:** commit, push and PR.

Open consequential assumptions: none.

Undiscussed consequential assumptions affecting this handoff: none.
Coverage acknowledgement: Nick, 2026-09-15 (Rev. 10 rulings and journey sign-off); 2026-09-30 (clean-switch rules); 2026-10-03 "ok lets start pr2, use subagents where possible"; 2026-10-04 "ship it, all four are fine" (the four items above).
Internal revalidation: this file, 2026-10-03, against `origin/main` 192a61ee and production counts of the same day.

## 6. Designed user journey (Rev. 10 §6 items 1–3, unchanged)

1. Plan user opens the Haar-Check editor: sentence A sits above the buttons. Save → button shows „Speichern...“ until the plan is recomputed → „Haar-Check gespeichert“ as today. On the next visit to the Routine tab: „✓ Plan aktualisiert“ (only when the outcome was `applied`).
2. Ziele editor: same sentence, same lane, returns to the profile as today.
3. User without a plan: no sentence, no recompute, today's behaviour.
4. Recompute fails: the profile keeps the new value, the editor shows the normal success state, the routine is unchanged; the next Routine visit, edit or Feinschliff completion finishes the run.
5. Unchanged save: no request (Haar-Check) / no write (route), no recompute.

## 7. Planning evidence

Reviewed 2026-09-15: `plans/central-user-profile/evidence/profil-ohne-onboarding-review.html` (question 4: pre-save notice A vs B → A). No new surface in PR2; sentence A is rendered in the real editors and verified in the browser (task 7).

## 8. Ordered tasks

Each task is TDD where it changes deterministic logic (red proof recorded in the handback). Shared values live in §4a.

1. **Stage-1 source from facts (creation path).** `stage1-service.ts`: new dep `loadFacts(userId)`; source = `toStage1SourceFromFacts(facts)`; fallback to the artifact / lead envelope when facts are absent or not computable; artifact / lead lookups stay for ownership and the RPC's source ids. Tests (`tests/personal-plan/persistence/stage1-service.test.ts`): identical `inputHash` for v3, v2 and legacy fixture users through the service on both paths; hand-edited facts produce the facts envelope; `legacy_columns` and incomplete facts fall back. Produces: `Stage1Dependencies.loadFacts`. Done when the suite is green and no existing Stage-1 test changed its expected hash.
2. **Migration + RPC tests.** The RPC of §4a; PGlite suite `tests/personal-plan-rebase-on-facts-migration.test.ts` on the real chain: happy path with an in-progress source draft (initial, clone, refined, projections, head, outbox row, cursor in one call); completed source draft untouched and cloned as `complete` with `result_refined_need_version_id`, refined version inserted before the clone (F18, R06, R10); the clone's content comes from the `p_clone_*` parameters; source draft without module projections → `habits` entry; carried `products.stage3Handoff`; plan without a refined head → clone without projection; no draft at all; refined head without a draft refused; every conflict status (`plan_revision_conflict`, `facts_revision_conflict`, `draft_conflict`, `initial_conflict`) writes nothing; `unchanged`; A→B→A reuses the initial and refined rows; **a stray `in_progress` draft on the destination base is staled, not a unique violation (R01)**; **a pending routine proposal is superseded and the pointer cleared, also when returning to the active routine's refined version (R08)**; **the care-habits facts are written by the door inside the transaction (derived columns, `facts_revision + 1`, `applied_facts_revision` = that revision), every rejected call leaves `hair_profiles` byte-identical, and a door rejection rolls the rebase back (R16, R17)**; refined / forbidden-refined parameter validation; migration-enrolled plan (F02); integer schema versions and grants (R09). Consumes: nothing. Produces: the RPC signature and return shapes.
3. **Projection + lane.** `buildRebaseProjection` and `src/lib/personal-plan/facts-recompute/`. Tests: **hash equality against the real lanes on the same parent** — module completion (in-progress source), terminal completion (user-complete source), direct acceptance (all-assumed and mixed-provenance sources) (R12); neither module complete; a completed draft that gains a question → still `complete`, the new question assumed, contract complete; answers that left the path; the care-habits patch and field provenance for a saved-but-unpublished answer (R16); lane table tests over fake deps for every `SyncPlanWithFactsResult` branch incl. each conflict → one retry, `initial_conflict` retried with the existing id, `facts_not_computable`, no draft, no refined head; one PGlite end-to-end (facts edit through the door → lane → refined head on the new parent → refined hash equals `hashPersonalPlanNeedVersionInput` with the new parent id). Consumes: task 2 RPC, task 1 `loadFacts`. Produces: `syncPlanWithFacts`, `createProductionFactsRecomputeDeps(admin)`.
4. **Lineage, activation and readers.** PGlite / unit: a rebased plan with an active routine activates its successor through `personal_plan_complete_draft_activate_v2` (module-driven by the clone's projections), for a module-projected source and for a linear (no module keys) source; A→B→A goes through reactivation; `classifyModuleDrivenRefinedVersion` returns `module_driven`; the source-sync self-heal recomputes the `refined_need` row the RPC wrote; **scanner current-publication rule (R04): A→B→A with a terminal and with a partial historical publication stays readable**; `/plan-start` state for an accepted user after a rebase: `complete` clone → routine redirect (R06); **products complete, habits open, no Stage-3 draft on the new refined version → no Stage-3 resume; a live Stage-3 draft → resume (R11)**; a real-Postgres two-session proof (`scripts/personal-plan/rebase-concurrency-proof.ts`, Docker, like `scripts/mobile/registration-concurrency-proof.ts`): a Feinschliff `reopen` racing a rebase ends with one in-progress draft on the current base and no unhandled error (R14). Code changes: `scanner-context.ts` (done 2026-10-03), `mapModuleProjections` + `module1-stage3-resume.ts` per §4a; elsewhere only where a test fails. Consumes: tasks 2, 3.
5. **Triggers.** (a) `edit-route.ts`: after a successful save or publish, `syncPlanWithFacts`, then `recomputeRoutineAfterHabitsCompletion` when `rebased` with a refined version and an active routine; response `plan.outcome` per §4a; never fails the save; timing log like the stage-2 route. (b) `stage1-service.ts`: a plan exists and the facts hash differs from its current initial → the lane instead of `createOrReuseInitialNeed`; return the plan's current initial. The migration short-circuit runs the same check before it returns the existing plan (R07; admission checks and the unavailable mapping unchanged). (c) `routine/sync` route: `syncPlanWithFacts` before the outbox drain. (d) stage-2 route, habits completion: lane after the module completion; a `rebased` result's refined version is the one passed to the routine recompute. Tests in `tests/profile-answers-route.test.ts`, `stage1-service.test.ts` (incl. a migration-enrolled user with edited facts), `tests/personal-plan-stage4-source-sync-api.test.ts`, `tests/personal-plan-api-stage2.test.ts`. Consumes: task 3.
6. **Editors + signal + audit.** `hasPersonalPlan` through the profile layout context; sentence A in both editors; `plan.outcome === "applied"` → `markRoutinePlanUpdatedPending()`; routine client consumes it. `scripts/user-facts/plan-hash-audit.ts` (read-only, prints counts and per-user changed fields, no ids in stdout summary). Tests: `tests/profile-editors-draft.test.ts` additions, signal unit tests, a render test for the sentence with and without a plan. Independent of tasks 2–5 except the response field name.
7. **Ready-check, Codex whole-branch review, fixes, ship on Nick's „ship it“.**

Execution: wave 1 — tasks 1 and 6 (done 2026-10-03, verified by the main session); wave 2 — task 2; wave 3 — task 3; wave 4 — tasks 4 and 5 in parallel (disjoint write scopes); then task 7. Task 1 must not ship without task 5(b): on its own a Stage-1 load after a profile edit would take the destructive initial-changed branch. Model routing: Opus for 2 and 3 (SQL, locking, deterministic lane); Sonnet for 1, 5, 6; Opus for 4. The main session reviews every handback and runs the suites itself.

## 9. Verification

- Automated: `npm run test:node`, `npm run test:personal-plan:nested`, `npm run ci:verify`, `node scripts/mobile/check-migrations.mjs`; the Docker proofs `scripts/mobile/profile-edit-postgres-check.ts` and `registration-concurrency-proof.ts --run-local` (real Postgres 17) still pass.
- Manual / browser (dev login, `docs/local-qa-access.md`): Haar-Check edit as a plan user → sentence visible → save → Routine tab shows „Plan aktualisiert“ and the routine reflects the change; Ziele edit likewise; no-plan user sees no sentence; 375 px, no horizontal scroll, no console errors.
- Live state: `plan-hash-audit.ts` against production before deploy (expected: every unedited plan user identical); both migrations applied through the Supabase MCP, each as one batch, function bodies compared by `md5(prosrc)`; Sentry after deploy. Migrations BEFORE the code deploy: `20261003150000` adds a function the old code never calls; `20261003150100` replaces the plan-creation function with a guard that stays inert until a plan has been rebased (production's current body verified identical to the repo's `20260828104243` body on 2026-10-04, md5 f4fb3680…).
- Rollback: a code rollback is safe for rebased plans because `20261003150100` stays applied — the plan-creation function returns a rebased plan's current head instead of re-pointing it to the artifact-derived version (W01); keep that migration when rolling the code back. The scanner's publication rule and the Stage-3 resume rule must also be kept, because a user who went A→B→A has two drafts carrying one refined version, which the old scanner rejects (R13). `personal_plan_rebase_on_facts_v1` can be dropped once no deployed code calls it; no data migration.

## 10. Review and handoff

Review gates: Codex plan review (read-only) before tasks 2–5 start; Codex whole-branch review before push; no push without „ship it“; production migration only on Nick's explicit apply. Rollout risk: recompute on real plans — mitigated by the audit, adversarial fixtures and a single-user check with the dev account before wide use. Artifacts: this plan `commit`; audit output `archive` outside the repo (contains user ids); Codex transcripts `discard`.

## 11. Counterpart review ledger

### Codex round 1 (2026-10-03, read-only, `--effort high`, against HEAD 192a61ee)

Verdict: "not ready". Each finding checked in the repo before acceptance (R01 `stage2-refinement-supabase.ts:122–157` unguarded reopen insert; R06 `plan-start/page.tsx:295`, `module-scope.ts:176–200`; R08 `20260808070000:182`; R09 `20260808062602:26,220`). None changes a ruled decision. Verified sound by the reviewer: lock ordering, copied source-identity columns incl. migration plans, NULL refined heads, the extra `origin` entry field, the resolver and snapshot builder for a system projection.

| ID  | Type   | Evidence                                                                                                       | Decision | Plan change                                                                     | Revalidation |
| --- | ------ | -------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------- | ------------ |
| R01 | defect | a draft reopened on an old base after a rebase blocks the clone's unique slot on A→B→A                         | accepted | the RPC stales every in-progress draft of the plan (§4a step 7); test in task 2 | Rev. 2       |
| R02 | defect | a pending clone could be completed by the user before the system projection                                    | accepted | no pending clone exists: rebase and projection are one transaction (§2, §4a)    | Rev. 2       |
| R03 | defect | hash-equal pending runs were skipped by the divergence trigger                                                 | accepted | same: no half-rebased state to resume                                           | Rev. 2       |
| R04 | defect | A→B→A leaves two drafts carrying the reused refined version; the scanner demands one                           | accepted | scanner current-publication rule (§4a), tests in task 4                         | Rev. 2       |
| R05 | defect | projection keys / handoff lived only in an RPC response                                                        | accepted | the RPC derives them from the source draft inside the transaction (§4a step 8)  | Rev. 2       |
| R06 | defect | a completed source cloned as in-progress loses the routine redirect and shows „Das Abschließen ist noch offen“ | accepted | clone status rule (§4a), tests in tasks 2–4                                     | Rev. 2       |
| R07 | defect | migration users return before the Stage-1 trigger                                                              | accepted | task 5(b) runs the check before the short-circuit returns                       | Rev. 2       |
| R08 | defect | returning to the active routine's refined version left an older pending proposal                               | accepted | the RPC supersedes pending proposals (§4a step 6)                               | Rev. 2       |
| R09 | defect | `p_schema_version text` vs integer storage                                                                     | accepted | integer (§4a)                                                                   | Rev. 2       |
| —   | note   | legacy lead id enters the hash                                                                                 | accepted | recorded in §5 with the audit result                                            | Rev. 2       |

Round 2 (delta-focused) required: the single-transaction contract is a material, blocker-driven change.

### Codex round 2 (2026-10-03, delta-focused)

Verdict: "not ready" (R10–R14). Closed by Rev. 2 per the reviewer: R02, R03, R04, R05, R07, R08, R09; R01 partly (stray draft handled, concurrent insert unproven → R14); R06 partly (→ R11). Confirmed sound: explicit initial ids and `initial_conflict`, refined parameters for Stage-3 heads, proposal superseding, staling open drafts, the plan-revision CAS (module completion bumps it), no recovery hole after the single commit, `module_driven` classification of the clone. Checked before acceptance: R10 `20260808062602:63–65`; R11 `plan-start/page.tsx:258–282`, `module1-stage3-resume.ts:47–74`, `refinement-status.ts:48–58`; R12 `stage2-refinement-service.ts:273–298`, `direct-acceptance/accept.ts:383–480`.

| ID  | Type     | Evidence                                                                                          | Decision                                          | Plan change                                                                                        | Revalidation |
| --- | -------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------ |
| R10 | defect   | a `complete` clone cannot be inserted before its refined result exists                            | accepted                                          | refined version first (§4a step 7)                                                                 | Rev. 3       |
| R11 | defect   | a carried `products.stage3Handoff` resumes Stage 3 on a refined version that has no Stage-3 draft | accepted                                          | handoff stays a persistent fact; resume skips a `facts_rebase` entry without a product draft (§4a) | Rev. 3       |
| R12 | defect   | a resolver-built snapshot for a `complete` clone hashes differently from terminal completion      | accepted                                          | per-lane projection with hash-equality tests; clone status = source status (§4a)                   | Rev. 3       |
| R13 | defect   | rollback claim ignored the scanner multiplicity after A→B→A                                       | accepted                                          | rollback note (§9)                                                                                 | Rev. 3       |
| R14 | tradeoff | a reopen insert racing a rebase can deadlock                                                      | accepted as bounded retry (no change to `reopen`) | lane retries `40P01` / `40001`; two-session proof in task 4                                        | Rev. 3       |

Round 3: narrow check of the Rev. 3 delta (clone content rule, resume rule) while task 2 (SQL, contract stable since Rev. 2 apart from R10 and the `p_clone_*` parameters) proceeds.

### Codex round 3 (2026-10-03, narrow)

Verdict: "ready with fixes". Closed: R10, R11, R13, R14 (plan level; the two-session proof is an implementation gate), R12 partly (→ R15–R17). Confirmed: the terminal-form snapshot matches `completeDraft`'s hash inputs; a closing-module completion cannot leave a current-path question unanswered in the draft; a full resolved path satisfies the scanner's terminal id check. Checked before acceptance: R15 `direct-acceptance/defaults.ts:39–45`, `accept.ts:413–415`; R16 `stage2-refinement-service.ts:348–366,429`; R17 `20260929231300:520–532`.

| ID  | Type   | Evidence                                                                                         | Decision | Plan change                                                                                                                   | Revalidation |
| --- | ------ | ------------------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------ |
| R15 | defect | the direct-acceptance defaults builder resolves only an empty draft                              | accepted | `resolveAssumedAnswers` over the source answers; contract validated; terminal completion as the mixed-provenance oracle (§4a) | Rev. 4       |
| R16 | defect | a verbatim clone of a draft with saved, unpublished answers publishes them without a facts write | accepted | facts are written on every refined publication (§4a step 4a)                                                                  | Rev. 4       |
| R17 | defect | an unbound facts write before the rebase could survive a rejected rebase                         | accepted | the door is called inside the rebase transaction after the checks (§4a step 4a)                                               | Rev. 4       |

No further round: the fixes are the reviewer's own recommended changes and add no new mechanism beyond calling the existing door inside the transaction; the whole-branch review covers the implementation.

## 12. Implementation record (2026-10-03 / 04)

Built by subagents per §8, each handback reviewed by the main session (diff read, suites re-run). Deviations from §4a found during implementation — all technical, none changes a ruled decision:

- **RPC** (`20261003150000`): draft and product-draft staling also runs when no refined version is published (otherwise the in-progress source would stay open on the old base); a missing `hair_profiles` row → `invalid_source / facts_not_found`; `draft_conflict` returns `{currentDraftId, currentDraftRevision}`; `unchanged` returns `{initialNeedVersionId, revision}`; `initial_id_taken` when `p_initial_id` belongs to another version; latest-complete tie-break `updated_at DESC, id DESC`. Test harness: the chain with `20260812143000` / `20260828104243` / `20261003150000` is an opt-in variant (`migratedPersonalPlanDatabase(t, { stage1Sources: true })`), because adding them to the default chain breaks ~20 unrelated suites that seed initial versions without a source.
- **Projection**: for a complete source the clone omits `heatEvents` when the source never had the key and the resolver's map is empty — the resolver always returns `heatEvents: {}`, a draft completed without heat never carries it, and keeping it would break hash equality with terminal completion (and A→B→A reuse). An in-progress source with both modules user-complete uses the terminal form, mirroring `completeModule`'s closing branch.
- **Lane**: a hash-equal plan returns `unchanged` without calling the RPC (so `applied_facts_revision` is not advanced then; it is informational). `computeNeedPlan` not ready → `facts_not_computable`.
- **Triggers**: `rebased` with an active routine and a refined version but no `recomputeRoutine` dep → `unavailable` (production always wires it).
- **A→B→A** (task 4): `personal_plan_complete_draft_activate_v2` answers `already_completed` for the historical product draft; the orchestrator's reactivation step restores the routine — the existing path, proven in `tests/personal-plan-facts-rebase-activation-migration.test.ts`.
- **Reopen race** (R14, proof output in the PR): seven schedules pass on Postgres 17. In one deadlock schedule the reopen INSERT is the victim and `reopen`'s read-after-conflict returns the clone; a reopen committing just after a rebase lands on the old base, the user's next save is rejected as stale and the client reloads onto the current draft (R01 behaviour).

Live-state checks, production, read-only, 2026-10-04: `plan-rebase-dry-run.ts` — 109 plan users, 102 unchanged, 7 would rebase (6 with a source draft and a refined publication), 0 refused by the function's parameter rules, 0 unavailable. This proves the lane's reads, the projection and the assembled call on real data; it does not execute the transaction (W03).

Free-tier plan owners (a lapsed plan user, a freemium plan): fixed in the whole-branch round (W05) — the profile layout reads plan-row existence independently of tier, so they see sentence A.

## 13. Whole-branch review ledger — Codex (2026-10-04, read-only, `--effort high`, working tree vs `origin/main` 192a61ee)

Verdict: "do not ship" (five confirmed defects). Each checked in the repo before acceptance. Checked without a finding by the reviewer: SQL atomicity and grants, projection parity with the user's lanes, retry parameter rebuilding, proposal superseding, scanner invalidation, resume handling, behaviour when the RPC is missing.

| ID  | Type       | Evidence                                                                                                                                                                                                                                      | Decision | Fix                                                                                                                                                                                                                                          | Revalidation |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| W01 | defect, P1 | `personal_plan_create_or_reuse_initial_need` (`20260828104243:727–731`) re-points a plan whose hash differs: a Stage-1 request racing a rebase, or rolled-back code, would restore the old initial, NULL the refined head and stale the clone | accepted | migration `20261003150100`: one guard, a plan with `applied_facts_revision` set is returned unchanged; suite `tests/personal-plan-create-initial-keeps-rebased-head-migration.test.ts` (9 tests; never-rebased plans keep today's behaviour) | fixed        |
| W02 | defect, P2 | the lane and two routes logged raw error messages; the facts reader's messages carry the user id (`user-facts/read.ts:58,82`)                                                                                                                 | accepted | error class and SQLSTATE only, in `sync-plan-with-facts.ts`, `edit-route.ts`, `routine/sync/route.ts`; test with a real `UserFactsReadError`                                                                                                 | fixed        |
| W03 | defect, P2 | the dry run counted every assembled call as "would rebase"                                                                                                                                                                                    | accepted | `refusalReason` mirrors the function's state-dependent `invalid_source` rules; unit-tested; re-run: 7 would rebase, 0 refused; §12 wording corrected                                                                                         | fixed        |
| W04 | defect, P3 | the Routine-toast marker was tab-wide and unowned                                                                                                                                                                                             | accepted | marker stores the user id; consuming as another user discards it; the routine client consumes once the auth user is known                                                                                                                    | fixed        |
| W05 | defect, P3 | free-tier plan owners never saw sentence A                                                                                                                                                                                                    | accepted | `profile-plan-ownership.ts`: one owner-scoped existence read for the free-tier branch, in the profile layout only                                                                                                                            | fixed        |

Not covered by W05 (recorded): a navigation of kind `legacy` (flag off, paid legacy user, paid-pending, or a failed navigation read) never triggers the extra read.

### Fix re-check (2026-10-04)

Verdict: "ship with fixes". W01–W05 closed (W01: the creator body is byte-identical to `20260828104243` apart from the guard; every head-changing rebase path sets the cursor; no other SQL writes it; no creator bypass remains). Two new P3 items:

| ID  | Type       | Evidence                                                                                                              | Decision | Fix                                                                                                                                      | Revalidation |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| W06 | defect, P3 | with both the URL signal and the storage mark present, the toast could reopen when auth resolved after it had expired | accepted | the mark is still consumed, but a visit that arrived with the URL signal never shows a second toast (`personal-plan-routine-client.tsx`) | fixed        |
| W07 | doc, P3    | §12 still listed the free-tier limitation W05 removed                                                                 | accepted | §12 corrected                                                                                                                            | fixed        |
