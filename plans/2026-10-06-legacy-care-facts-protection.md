# Legacy care facts protection — assumptions never replace real answers

Status: Rev. 4 (2026-10-06, Nick chose option A: explicit draft ownership) · base `b3ef2dd4` (PR #638 merged) · worktree `.worktrees/legacy-care-facts-protection` · branch `codex/legacy-care-facts-protection`

## 1. Outcome and source context

Trigger: paying member Viola (`e869bd7e…`, legacy-migrated 2026-10-03) gets „Wir konnten deine Angaben gerade nicht vorbereiten.“ on every Feinschliff open. Diagnosis (2026-10-06, prod logs + DB):

1. **Crash.** `POST /api/personal-plan/stage-2/optional-entry` → 503 on every attempt (Vercel, 2026-10-05 14:03–15:28 UTC). `loadLegacyRefinementPrefillInput` (`src/lib/personal-plan/persistence/stage2-optional-entry.ts`) selects `hair_profiles.shampoo_frequency`, a column that never existed (PR #481, 2026-08-31; the TS type `HairProfile.shampoo_frequency` is a derived field). Unit tests inject fake deps; the route maps the error to a bare `temporarily_unavailable` without logging the cause.
2. **Silent data loss (bigger).** Since central-profile PR2 the legacy care columns are a projection of `hair_profiles.care_habits`, and `user_facts_save_v1` merges field-by-field **without provenance precedence**. Three writers publish all-`assumed` care answers: direct acceptance (`direct-acceptance/accept.ts` → `buildDirectAcceptanceStage2Defaults`, `answers: {}`), the facts rebase clone (`facts-recompute/rebase-projection.ts`) and Feinschliff completion. Each overwrites real `user` / `unknown_historical` care facts. Viola's care facts and legacy columns now equal the `STAGE2_ASSUMED_*` defaults (provenance source `feinschliff_draft 3736604e`, written by the 2026-10-05 08:31 rebase). 22 active, not-yet-migrated legacy subscribers still hold real `unknown_historical` care facts (towel 21, drying 22, heat events 22, night 21, tools 21) and would lose them on migration.

Already in flight: draft PR #638 (central-profile PR3, CI green, not merged) deletes the legacy prefill and its broken loader (task 14). That removes the crash; this plan does not duplicate it.

## 2. Chosen direction

One rule, enforced at two layers: **an assumption only fills a gap; it never replaces a real answer** (the same rule `src/lib/user-facts/completeness-defaults.ts` already applies to diagnostics).

- **Database guard (authoritative, care_habits only):** `user_facts_save_v1` drops an incoming field — value or JSON-null clear — whose provenance is `assumed` when the stored domain already has that field with non-`assumed` provenance (`user`, `unknown_historical`, or no provenance entry). Diagnostics keep latest-write-wins (account-link "latest own quiz wins" ruling writes assumed diagnostics on purpose).
- **Translator fix:** an empty `heatEvents` map published without completed heat questions takes the provenance of the drying/heat-tool answers that emptied it (it previously carried none and so counted as real).
- **Source fix:** direct acceptance builds its Stage-2 defaults on top of the member's known care facts, so the accepted plan is computed from her real answers and plan + profile agree.
- **Visibility:** the Stage-2 routes log the real cause of an unexpected failure and report it to Sentry.
- **Guardrail:** a contract test checks every static `.from(<table>).select("…")` column list against the schema the real migrations build.

## 3. Scope and non-goals

In scope: T1–T4 below.

Non-goals:

- Re-sourcing or keeping the legacy prefill (PR #638 deletes it; O1 of PR3: Feinschliff keeps opening from the plan's latest complete draft).
- Overlaying facts in the rebase clone or in Feinschliff entry. With T1 the rebase can no longer destroy real facts; a plan whose draft already holds assumptions keeps them until the member answers in Feinschliff.
- Deriving `wetWashFrequency` from `user_product_usage` shampoo rows (the shampoo frequency for legacy members lives there, not in `care_habits`). Parked; see §5.
- Restoring Viola's pre-2026-10-05 care values (Nick 2026-10-06: not needed; she answers in Feinschliff).
- Any UI or copy change.

## 4. Target map

| Task | Files                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1   | new `supabase/migrations/20261006180000_user_facts_assumed_never_replaces_real.sql` (`CREATE OR REPLACE` of `user_facts_save_v1`, signature unchanged); `tests/user-facts-save-v1-migration.test.ts` (PGlite, real migration); `tests/user-facts-save-rpc.fixtures.ts` (TS stand-in kept in parity); harness chain in `tests/personal-plan-pglite-migration.fixtures.ts` if it lists migrations explicitly |
| T2   | `src/lib/user-facts/read.ts` (`toKnownRefinementAnswers`), `src/lib/personal-plan/direct-acceptance/defaults.ts`, `src/lib/personal-plan/direct-acceptance/accept.ts` (+ deps type), `src/app/api/personal-plan/accept-ideal-plan/route.ts` (wire `loadFacts`); tests in `tests/personal-plan/direct-acceptance*` / `tests/user-facts-read*`                                                               |
| T3   | `src/app/api/personal-plan/stage-2/optional-entry/route.ts`, `src/app/api/personal-plan/stage-2/route.ts`; their route tests                                                                                                                                                                                                                                                                               |
| T4   | new `tests/supabase-select-columns-contract.test.ts`                                                                                                                                                                                                                                                                                                                                                       |

## 5. Decision coverage

Decision coverage: confirmed

- **Confirmed with Nick (2026-10-06):** „go ahead with steps 1–4“ — (1) assumptions may only fill empty fields, direct acceptance builds on existing answers; (2) the prefill must not read stale/derived columns; (3) log the real cause; (4) schema-contract test. Viola is not contacted and not restored; she answers in Feinschliff.
- **Inherited from evidence or contract:**
  - „Assumption fills only gaps“ = existing diagnostics rule (`completeness-defaults.ts`: a facts value counts unless `assumed`).
  - Step (2) is delivered by PR #638 (deletes the prefill; Nick-confirmed PR3 O1), not re-implemented here.
  - What counts as a _known_ care answer (T2): provenance `user` → any value; provenance `unknown_historical` → only non-empty values, and never `currentProductCategories`. Evidence: the legacy backfill synthesises `currentProductCategories = ["heat_protectant"]` from `uses_heat_protection` (backfill rule 2, 9 of 22 members) — a partial list, not her product answer; empty historical arrays are indistinguishable from the old column defaults (same rule the legacy prefill used via `submittedFields`).
  - A known `unknown_historical` answer adopted into the plan is written back with provenance `user` by the existing Stage-2 completion (`toFieldProvenance` has only `user|assumed`). Same convention the legacy prefill used (mapped legacy answers → `user`); no reader distinguishes the two except „not assumed“.
- **Implementation defaults:** migration timestamp; helper names; log field names; contract test limited to tables the PGlite harness builds.
- **Open consequential assumptions:**
  - `wetWashFrequency` from shampoo usage rows — **parked out of scope** (affects nothing in T1–T4; follow-up suggestion to Nick).
    Undiscussed consequential assumptions affecting this handoff: none
    Coverage acknowledgement: Nick, 2026-10-06, „go ahead with steps 1–4, but why do we need to ask viola“ (steps as listed in the diagnosis reply).
    Internal revalidation: Rev. 1 — step 2 re-routed to PR #638 after finding it deletes the same loader; `unknown_historical` filtering added after the prod distribution query. Rev. 2 — Codex findings F1/F2/F4–F8 are technical defects (no new product choice); F3 rejected on evidence and reported to Nick. Guard narrowed to care_habits (diagnostics untouched = no behavior change there).

## 6. Designed journey (non-user-facing)

No surface, copy or timing changes. Operator-visible outcomes:

- A legacy member who migrates and accepts the Idealplan keeps her stored towel/drying/heat/night answers; the accepted plan is computed from them; only missing answers are assumed.
- Any later writer that tries to store an assumption over a real answer leaves the real answer in place.
- A Stage-2 entry failure shows the cause in Vercel logs and Sentry.

## 7. Planning evidence

Not required (internal behavior, no UI). Evidence used: Vercel logs 2026-10-05, prod schema/columns, Viola's facts provenance, distribution query over the 22 members, rolled-back RPC probe (`personal_plan_open_optional_refinement_v1` → `applied`, nothing persisted).

## 8. Ordered tasks

### T1 — `user_facts_save_v1`: an assumed field never replaces a non-assumed one

Produces: migration `20261006180000_user_facts_assumed_never_replaces_real.sql`.

- In step (5) before the merge: for every key `k` in `p_patch` whose value is not JSON null, when `p_provenance->'fields'->>k = 'assumed'` AND `v_old_domain ? k` AND `COALESCE(v_old_provenance->'fields'->>k, '') <> 'assumed'`, remove `k` from the patch and from the incoming `fields` map. Clears (JSON null) are unchanged. Everything else (CAS, draft binding, revision bump, column derivation, return shape) unchanged.
- Body otherwise byte-identical to `20260929231300`; header comment states the rule and why.
- Tests (PGlite, real migrations), red first: assumed over `user` kept; assumed over `unknown_historical` kept; assumed over missing provenance kept; assumed over `assumed` replaced; assumed into absent key written; `user` over anything replaced; mixed patch keeps real keys and writes the rest; derived legacy columns follow the kept value; a JSON-null clear with assumed provenance still clears.
- Update `simulateUserFactsSave` to the same rule; parity asserted by the existing fixture tests.
  Done when: new tests red on the old function, green on the new; `tests/user-facts-*`, `tests/*facts*` PGlite suites green.

### T2 — direct acceptance builds on known care facts

Consumes: `UserFacts` (`src/lib/user-facts/read.ts`). Produces: `toKnownRefinementAnswers(facts) → { answers: PersonalPlanRefinementAnswersV1; questionIds: Stage2QuestionId[] }`; `buildDirectAcceptanceStage2Defaults(triggerContext, known?)`.

- `toKnownRefinementAnswers`: per §5 rule; field → question ids via the inverse of `CARE_HABITS_FIELD_BY_STATIC_QUESTION_ID` (`from-refinement-draft.ts`, export it); `heatEvents` → its `heat:<source>` keys; `brushesCombs` dropped.
- `buildDirectAcceptanceStage2Defaults(triggerContext, known)` → `resolveAssumedAnswers({ triggerContext, answers: known.answers, userAnsweredQuestionIds: known.questionIds })`; provenance from `resolution.assumedQuestionIds` (`assumed` for anything the resolver filled, incl. a known answer it rejected or completed, e.g. a towel without technique), `user` otherwise. Known lists are put into canonical Stage-2 order first. With no facts the result is identical to today (regression test).
- `completeSyntheticRefinement` loads them via a new REQUIRED dep `loadKnownCareAnswers(userId)`; both production callers wire it (`accept-ideal-plan/route.ts`, `freemium/plan-provisioning-supabase.ts`) via `loadKnownCareAnswers(admin, userId)` in `user-facts/read.ts`. The same `defaults` feed `isDirectAcceptanceDraft`; retry idempotence proven end-to-end on PGlite (defaults → translator → `user_facts_save_v1` → reload → identical defaults). Requires T1 deployed first.
- Tests: legacy-style facts (towel/drying/heat/night `unknown_historical`, `currentProductCategories:["heat_protectant"]`, empty `additionalHeatTools`) → defaults keep towel/drying/heat/night as `user`, assume categories and tools; facts with `user` empty arrays → kept; all-assumed facts → identical to today.
  Done when: unit tests green; `test:personal-plan` direct-acceptance suites green.

### T3 — Stage-2 routes report the real cause

- In both `errorResponse` (optional-entry) and the Stage-2 access / GET/PATCH / completion-after-save catch paths: for an error that is not a `Stage2RefinementError`, `reportUnexpectedStage2Error` (`src/lib/observability/personal-plan-stage2.ts`) logs `{ route, error_name, code?, reason? }` and captures a sanitized diagnostic error in Sentry. `reason` = the message only when it is a fixed snake*case code (the persistence wrappers' `stage2*\*\_failed`); free text (may carry user ids) is never reported. Response bodies unchanged.
- Tests: injected failing dep → still 503 `temporarily_unavailable`, log entry carries `error_name`/`reason`, capture called.
  Done when: route tests green.

### T4 — select-column contract test

- Build the schema with `migratedPersonalPlanDatabase(t, { stage1Sources: true })`; read `information_schema.columns`. Check only authoritative tables: those a replayed migration CREATEs, plus the transcribed `hair_profiles`; replay `ADD/DROP COLUMN` of migrations outside the chain on those tables. FK stubs (`profiles`, `products`, `leads`, …) and absent tables (`user_product_usage`) are out of coverage by design.
- Scan `src/**/*.{ts,tsx}` for `.from("<t>").select("<literal>")` (and template literals without `${`); parse top-level columns (skip `*`, embedded `rel(...)`, alias `a:b` → `b`, casts/JSON paths).
- For every table present in the harness schema, assert each column exists; report `file:line table.column`.
  Done when: test green on this branch **after PR #638 is merged** (on today's main it correctly fails on `hair_profiles.shampoo_frequency`); verified red by temporarily adding a phantom column.

## 8a. Codex plan review ledger (2026-10-06, verdict: reject → Rev. 2)

| ID  | Type     | Evidence                                                                                                               | Decision           | Plan change                                                                                                   | Revalidation                               |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| F1  | defect   | resolver returns `heatEvents: {}`, `toFieldProvenance` gave it no entry; prod: 40 profiles with `{}` and no provenance | accepted           | translator provenance for empty heat map                                                                      | `user-facts-from-refinement-draft.test.ts` |
| F2  | defect   | Stage-2 lists must be canonical-ordered; partial towel re-assumed                                                      | accepted           | canonicalize; provenance from `assumedQuestionIds`                                                            | direct-acceptance + known-answers tests    |
| F3  | tradeoff | mixed user/assumed heat drafts would lose a user heat edit to the aggregate `assumed`                                  | rejected           | none — prod: 0 of 36 drafts with heat answers mix provenance; aggregate rule is an existing controller ruling | documented here; surfaced to Nick          |
| F4  | defect   | assumed JSON-null clear could still erase a real answer                                                                | accepted           | guard covers clears                                                                                           | PGlite test 5                              |
| F5  | defect   | T2 retry identity needs T1                                                                                             | accepted           | deploy order T1 before T2                                                                                     | PGlite end-to-end test                     |
| F6  | defect   | `plan-provisioning-supabase.ts` also calls `acceptIdealPlan`                                                           | accepted           | dep required + wired                                                                                          | `tsc`                                      |
| F7  | defect   | stub tables give false failures                                                                                        | accepted           | authoritative-table filter + ALTER replay                                                                     | contract test fails only on the real bug   |
| F8  | defect   | wrappers drop DB cause                                                                                                 | accepted (partial) | report snake_case code messages as `reason`                                                                   | observability tests                        |

## 8b. Codex whole-branch review ledger (2026-10-06, verdict: reject → fixed)

| ID  | Type   | Evidence                                                                                                                                                                      | Decision | Change                                                                                                                                                                                                                                                                                                                         | Revalidation                                                                    |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| W1  | defect | known answers read, then republished as `user` without facts CAS → a profile edit made in between was overwritten (reproduced on PGlite)                                      | accepted | `onlyAssumedFacts`: direct acceptance publishes only its assumptions; kept answers stay in facts with their historical provenance                                                                                                                                                                                              | PGlite "an edit made between reading the facts and the accept's write survives" |
| W2  | defect | retry ownership compared against defaults rebuilt from _current_ facts → read failure / facts change between attempts gave `plan_already_accepted` / `refinement_in_progress` | accepted | facts-independent `directAcceptanceSnapshotOf`: plain all-assumed by content, else rebuilt from the draft's own user answers (answers, ids, assumed split, ≥1 assumed); facts read only for an untouched draft; known answers limited to valid ones (fixed point); complete+Routine retry also needs `unrefined_direct_accept` | 4 new direct-acceptance tests                                                   |

Note: `plan_already_accepted` is treated as success by both callers (journey → open Routine; provisioning → already accepted), so the stricter complete+Routine check cannot strand a member.

## 8c. Rev. 4 — explicit direct-acceptance ownership (Nick, 2026-10-06: „well a sounds better to me")

Codex re-review of the content-based recognition (W2 fix) found two more holes: R1 an interrupted accept that assumed nothing could not resume (`refinement_in_progress`); R2 a Feinschliff edit on an interrupted accept draft still matched the rebuilt snapshot, so the accept completed it and dropped her edit from the facts write. Root cause: with member-specific defaults, ownership cannot be inferred from content.

Options shown to Nick: A = persist ownership (marker cleared by every interactive save) and keep building on her stored answers; B = revert to the fixed defaults, keep only the data protection. Nick chose A.

Design:

- Migration `20261006180100_personal_plan_direct_acceptance_draft_owner.sql`: column `personal_plan_refinement_drafts.direct_acceptance_owned boolean NOT NULL DEFAULT false`; new RPC `personal_plan_save_direct_acceptance_draft` (same signature/CAS/body as the 6-arg save, sets true); the 6-arg `personal_plan_save_refinement_draft` sets false on every successful save (the 5-arg wrapper delegates to it). Production body md5 `d155bdef…` verified equal to `20260825120000` before the change. New rows default false; completion RPCs leave it.
- `Stage2PersistedDraft.directAcceptanceOwned`; `persistence.save({ directAcceptance: true })` picks the new RPC; selects include the column.
- `accept.ts` ownership: untouched → owned (build from facts); `directAcceptanceOwned` → owned, resume its own stored snapshot; pre-column rows → plain all-assumed defaults by content (old behaviour); otherwise `refinement_in_progress`. Complete + active Routine additionally needs `unrefined_direct_accept`. `rebuildDirectAcceptanceStage2Defaults` removed.
- Tests: PGlite `tests/personal-plan-direct-acceptance-draft-owner-migration.test.ts` (set/clear/5-arg overload/rejected save); direct-acceptance R1, R2, marker set.

Deploy order: both migrations (`20261006180000`, `20261006180100`) BEFORE the code (the code calls the new RPC).

Codex re-review of Rev. 4 (reject, both fixed): R3 an unowned draft whose answers equal the defaults (she confirmed them) was re-claimed by the content fallback and its `user` answers relabelled `assumed` → the column is tri-state (NULL = row predates the column, set by adding it without default; new rows default false); the content fallback applies only to NULL rows and only when no completed answer is `user`. R4 the rollback note (restore the old save body, keep the column) would leave stale `true` marks → rollback is code-only; a DB rollback first clears all marks. Tests: "Codex R3…", "a pre-column row … not re-claimed", PGlite "rows that predate the column stay NULL…".

Open follow-up (not in this branch): Feinschliff pre-fill from the profile (original H4, deferred by PR3 ruling O1) — needs Nick's call.

## 9. Verification

Automated: T1–T4 tests; `npm run test:node`; `npm run test:personal-plan:nested`; `npm run ci:verify`; `check-migrations`.
Live-state (after deploy, separate authorization): apply the migration via Supabase MCP, compare `md5(prosrc)` with the local function body; rolled-back DO-block probe on a copy of a legacy member's profile: an assumed patch leaves `towel` unchanged. Sentry check after ship.
No browser check: no rendered surface changes.

## 10. Review and handoff

- Order: PR #638 merged 2026-10-06 (`b3ef2dd4`, Nick: "ok do that"); this branch is fast-forwarded onto it.
- Codex plan review (this file) → implement test-first → ready-check → Codex whole-branch review → `/ship` on Nick's request. Migration apply and merge are separate authorizations.
- Rollout: apply the migration BEFORE deploying the code (T2 retry identity relies on it); the migration is backward compatible (old code + new function = stricter merge only). Rollback: code first, then re-apply the `20260929231300` body.
- Artifacts: this plan → commit. Probe SQL and Codex output → discard (outside repo).
