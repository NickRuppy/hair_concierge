# Central user profile — PR1 "clean switch": one door, one vocabulary

Date: 2026-09-30. Status: **decisions confirmed by Nick 2026-09-30; implementation in progress; option-list evidence review pending (gates task 8 only).**
Worktree: `.worktrees/care-habits-source-of-truth` on `codex/care-habits-source-of-truth` (merged with `origin/main` 21c2813f; re-merge before ready-check).
Supersedes the PR1 scope (§8 tasks 1–7) and the staging of `plans/2026-09-15-care-habits-source-of-truth.md` (Rev. 10). Its §4/§4a technical contracts stay valid except where §3 below overrides them. PR2 and PR3 of that plan are unchanged unless noted in §9.

## 1. Outcome

`hair_profiles` holds one canonical record of what we know about a person, and it can be saved in exactly one way.

- **One door.** Every save of profile facts goes through the database function `user_facts_save_v1`. When all writers are switched, the database rejects every other write.
- **One vocabulary.** The profile stores, shows and edits the options of the current quiz. The older profile option lists disappear.
- No temporary sync bridge. All writers are switched in this PR, then the door is locked.

Why the scope changed since Rev. 10: main gained three more direct writers in two weeks (iOS profile edit, iOS registration, the web route `/api/profile/answers`), and a staged cutover with derived columns lets a later facts save silently undo a direct column edit. Nick ruled to switch everything now rather than bridge (iOS currently has no usage).

## 2. What is already built (commits on the branch)

- Storage: `diagnostics`, `care_habits`, `quiz_context`, `facts_provenance`, `facts_revision` on `hair_profiles`; recovery-cursor columns; draft `origin` — migrations `20260929231100`, `…231200`, `…231300`.
- `user_facts_save_v1`: merge, provenance, revision CAS, preserve mode, draft binding, derivation of the legacy columns; TS oracle `src/lib/user-facts/derive-legacy-columns.ts` with an SQL↔TS parity suite.
- TS layer `src/lib/user-facts/`: schemas, quiz projections, `toStage1Source` (identical plan hash for unchanged users), `saveUserFacts`, `loadUserFacts`.
- Writers through the door: account linking (`link-to-profile.ts`, `plan-bereit/readiness.ts`), every Feinschliff completion lane incl. direct acceptance and freemium provisioning.
- Backfill `scripts/user-facts/backfill.ts` (dry-run default, per-domain, CAS, conflict and erasure report).
- Main's `primaryConcern` quiz field carried through the facts.

## 3. Rules (all confirmed by Nick 2026-09-30 unless marked)

**Which quiz wins**
- The user's own quiz that was *taken* later wins and fully replaces hair data, goals and quiz-context answers. An older quiz never overwrites.
- A hand edit that is newer than a quiz is kept.
- Answering the missing hair-length question makes that quiz the latest one (controller ruling; same path as every other quiz).

**Completeness**
- Missing density → „medium". Missing hair length → „long". Both are marked internally as assumed and only fill a gap; they never replace a real answer and never feed a plan calculation.
- No other defaults.

**Migration of stored values**

| Stored today | Becomes |
| --- | --- |
| Feuchtigkeit, Glanz | same |
| Weniger Frizz | Frizz / Oberfläche |
| Locken-Definition (+ stray `defined_curls`) | Form / Definition |
| Gesunde Kopfhaut | Kopfhaut-Balance |
| Anti-Haarbruch, Stärken, Weniger Spliss (+ stray `less_breakage`) | Kräftigung / Spitzen |
| Gesünderes Haar | Kräftigung / Spitzen |
| Farbschutz | Glanz |
| Mehr Volumen / Weniger Volumen | the quiz's volume goal; **the stored direction is kept** for existing profiles, new answers follow hair type |
| Concerns Frizz, Trockenheit, Haarschäden, Spliss, Haarbruch, Haarausfall, Verknoten | matching quiz concern |
| Concern Schuppen | moved to the scalp answer |
| Concern Dünner werdendes Haar | Haarausfall / dünner werdend |
| Tool Welleneisen | combined „Lockenstab / Welleneisen" |

Legacy goals use the one existing conversion (`resolveVisibleDiagnosticGoals`); there is no second table.

**Carried over from Rev. 10:** derived `concerns` / `goals` / `chemical_treatment` are `[]` rather than NULL for absent facts; a profile may be stored incomplete and completeness is enforced where a plan is calculated; new plan buyers see only the goals they picked.

## 4. Writers to switch in this PR

| Writer | Today | After |
| --- | --- | --- |
| Web Haar-Check editor (inline on the profile page → `POST /api/profile/answers`) | old option lists, direct column write or `scanner_profile_edit_publish` | quiz options, saved through the door |
| Web Ziele editor (`/profile/edit/goals`, old onboarding goals screen) | 5 goals per hair type | the quiz's 8 goals, saved through the door |
| Web onboarding steps (tools, heat, towel, drying, brush, night) | browser writes columns directly | same screens, saved via the server through the door |
| iOS profile edit (`scanner_profile_edit_publish`) | SQL function writes columns | function hands the save to the door in the same transaction |
| iOS registration / profile completion (`mobile_registration_publish`) | SQL function writes columns | same |
| `PUT /api/profile` (no caller) | direct write | through the door |
| Dev seed, eval and fixture scripts | direct inserts | through the door or exempted explicitly |

Not in this PR: pointing the Styling / Alltag „bearbeiten" buttons at the Feinschliff instead of the old onboarding (stays PR3).

## 5. User-visible changes

- Ziele editor offers the quiz's 8 goals with the quiz's wording.
- Haar-Check editor offers the quiz's 10 concerns (incl. Wenig Glanz, Form geht verloren, Wenig Volumen / beschwert); Kopfhaut-Beschwerden allows several picks.
- The profile displays the quiz's wording for goals and concerns.
- 80 profiles show a converted goal name once; 5 show the combined tool label; 127 show hair length „lang".
- iOS: nothing. A profile edit still does not change the plan (PR2).

## 6. Decision coverage

Decision coverage: **confirmed** for everything in §3–§5 (Nick, 2026-09-30, in-session). Evidence review for the two editor option lists: **pending** — blocks task 8 only.

Confirmed with Nick (2026-09-30): one door + one vocabulary, no bridge; switch all writers in this PR incl. iOS; latest own quiz wins (taken time); density and hair-length defaults; no other defaults; migration table incl. Farbschutz → Glanz and Gesünderes Haar → Kräftigung / Spitzen; stored volume direction kept; combined tool label; new buyers see only picked goals; free-registration bind may claim the lead when facts are preserved; Styling / Alltag retargeting stays PR3.
Inherited from Rev. 10: facts first, snapshot second; provenance per domain; identical plan hash for unchanged users; TDD; Codex whole-branch review before push; migrations and backfill applied by Nick after the dry-run diff.
Implementation defaults: derivation in TS (oracle) and SQL with a parity test; RPC granted to service_role only; per-domain backfill guard with CAS; content-based catch-up; a permanent guard (not a sync bridge) enforces the lock.
Open consequential assumptions: none.
Undiscussed consequential assumptions affecting this handoff: none.
Coverage acknowledgement: Nick, 2026-09-30 — "okkk good - finalize this in a plan file".
Internal revalidation: this file, against branch head after the wave-1 fix round and `origin/main` 21c2813f (+1 unrelated commit to re-merge).

## 7. Designed user journey (for the visible part)

1. A web user opens Profil → Ziele → „bearbeiten": sees the quiz's 8 goals with their current picks preselected (converted per §3), saves, returns to the profile; the profile shows the quiz wording.
2. A web user opens Profil → Haar-Check → „bearbeiten": the inline editor shows the quiz's options for every field; Probleme lists 10 options; saves; the profile updates in place.
3. Styling / Alltag → „bearbeiten": unchanged screens (old onboarding step), saved through the door.
4. Error: a save that fails shows the existing error notice; nothing is half-saved (one transaction).
5. A user without a quiz who edits: the profile is created with what they entered.

Evidence to present before task 8: old vs new option lists for Ziele and Haar-Check inside the real component layout (mobile width), realistic German copy.

## 8. Ordered tasks

Done: storage, function, TS layer, account link, Feinschliff lanes, backfill, merge of main, "latest quiz wins", defaults, migration table.
1. Finish wave-1 fix round 2 (losing quiz writes nothing to quiz-context; hair-length form through the ordinary path) and its re-review.
2. Re-merge `origin/main`; re-check migration timestamps.
3. iOS edit through the door: supersede `scanner_profile_edit_publish` with a facts branch; web branch retired in task 5. Golden test: derived columns equal today's `mobileEditProfilePatch` output for the iOS fixtures; revision-counter deltas asserted on the real schema in PGlite.
4. iOS registration / completion through the door: same for `mobile_registration_publish` (create, replace, missing, keep).
5. `/api/profile/answers` and `PUT /api/profile` through the door: route accepts the quiz vocabulary; `saveCompatibleProfileEdit` no longer writes columns.
6. Onboarding save via a server action through the door (care habits incl. brush); remove the browser-side table write.
7. Backfill aligned with all of §3; dev seed and fixture scripts through the door.
8. **(after evidence sign-off)** Haar-Check editor and Ziele editor on the quiz's options; profile display uses the quiz wording; combined tool label.
9. Lock: revoke direct insert/update of fact columns for non-service roles (RLS) and add a guard that rejects fact-column writes not made by `user_facts_save_v1`; separate migration, applied last.
10. Ready-check on the final tree, Codex whole-branch review, fixes, ship on Nick's „ship it".

Model routing: Opus for 3, 4, 9 (SQL, locking); Sonnet for 5, 6, 7; Opus for 8 (German copy and UX). Adversarial fixture lane for every deterministic rule. Main session verifies every handback.

## 9. Effects on the follow-up PRs of Rev. 10

- PR2 keeps: Stage-1 computes from the profile, the diagnostics rebase lane, „Plan aktualisiert". Its task 12 (editors on the native model) is done here except the pre-save recompute sentence.
- PR3 keeps: Styling / Alltag / Produkte retargeting to the Feinschliff, translator deletion, Customer.io serializer.
- Hair Tools #465 and the onboarding retirement must save through the door before they merge.

## 10. Verification

- `npm run ci:verify`, `npm run test:node`, `npm run test:personal-plan`, `npm run test:personal-plan:nested`; PGlite RPC + parity suites; golden tests for iOS and for every web writer; adversarial suites unchanged unless a ruling in §3 requires it.
- Browser: Ziele and Haar-Check edit → saved → profile shows quiz wording; onboarding step edit → saved; dev login per `docs/local-qa-access.md`.
- Manual lanes (no Docker here): two-session race recipes R1–R4; iOS two-session proof on Nick's machine before iOS gets real traffic.
- Production preview: backfill dry-run after step 1 of the rollout; Nick reviews conflicts, erasures and unresolvable rows before `--apply`.

## 11. Rollout (four steps, order matters)

1. **Additive migrations:** `20260929231100` (fact columns), `20260929231200` (facts cursor, draft `origin`), `20260929231300` (`user_facts_save_v1`). The deployed app keeps working: nothing reads or requires them yet.
2. **Backfill:** `scripts/user-facts/backfill.ts` dry run (the default) → Nick reads the report (summary table first: hand-edited groups, ambiguous rows, every visible column change before → after, defaults, kept values, source choices, erasures, conflicts) → `--apply`. Idempotent and CAS-protected; rerun with `--catch-up` right before step 3 to pick up legacy edits made in between.
3. **Code deploy TOGETHER with** `20260930090000` and `20260930090100`. Both change the iOS RPC signatures (`p_facts`, `p_quiz_taken_at`): apply them in the same window as the deploy — iOS registration / profile edit fail in the gap between the two; web is unaffected.
4. **Lock last:** `20260930120000_user_facts_lock.sql` (guard trigger + browser INSERT/UPDATE revoked). Every direct fact-column writer must be gone by then (seeds and scripts included, task 7B).

Rolling the code back after step 4 requires removing the lock first:

```sql
DROP TRIGGER zz_hair_profiles_fact_write_guard ON public.hair_profiles;
DROP FUNCTION public.hair_profiles_reject_fact_write_outside_door();
DROP FUNCTION public.hair_profiles_fact_column_defaults_v1();
GRANT INSERT, UPDATE ON public.hair_profiles TO anon, authenticated;
```

Sentry check after each step.

## 12. Risks

- Size of the PR and review surface — mitigated by per-task review and one whole-branch Codex pass.
- iOS revision-counter arithmetic changes without a Docker concurrency proof here — low user risk (no usage); proof required before iOS traffic.
- The lock breaks any unmerged branch that writes profile columns directly — listed in §9.
- Backfill correctness — dry-run diff reviewed by Nick; idempotent; CAS.
- A web edit on a row that has no facts document yet writes the converted columns plus the edit under a source built from the edit, replacing what would have been the backfill's `legacy_columns` snapshot. Accepted: after rollout step 1 every row has a document before the new code deploys (step 2). An unchanged save on such a row writes nothing.
