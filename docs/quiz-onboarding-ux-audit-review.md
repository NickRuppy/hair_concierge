# UX Audit Review + Implementation Plan

## Context

Six review agents + two Codex (GPT-5.4) review passes analyzed `docs/quiz-onboarding-question-ux-review.md` against the actual codebase and recommendation pipeline. This document captures the consolidated findings, all resolved decisions, and the phased implementation plan.

The original audit proposes re-sequencing and re-grouping the quiz + onboarding flow to reduce drop-off and improve data quality. The core thesis — "the biggest upside is re-sequencing, not removing data" — is correct and endorsed by all reviewers.

---

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Density:** After goals, before routine. Combine with mechanical stress (density visually primary, stress secondary/optional). | Gates conditioner weight + leave-in matching. Must be collected early. |
| 2 | **Texture:** Keep wet-strand test, shorten copy. | Higher signal at wavy/curly boundary than air-dry recall. |
| 3 | **Goal filtering:** Show all goals (curated onboarding subset, not all enum values) + relevance markers. `curl_definition` hidden for `straight` as sole hard exclusion. | Fixes missing goals (moisture for straight, frizz for coily) without contradictions. |
| 4 | **Implementation:** Incremental 7-phase plan. Each phase ships independently. | Lower risk, measurable progress. |
| 5 | **None-states:** `answered_fields` metadata column on `hair_profiles`. NO sentinel values. `[]` always means "no items." Pipeline code unchanged. Distinguish "skipped" vs "none" via metadata only. | Codex traced that `["none"]` breaks leave-in fallback, falsely bumps mechanical stress to medium, leaks into prompts, and violates DB check constraints + Zod validators. Metadata approach has zero pipeline risk. |
| 6 | **Welcome/auth:** Repurpose as quiz-aware auth transition with inline auth (Google + email, equal prominence). Dark theme matching quiz. | Eliminates both welcome screen AND separate auth page for quiz flow. |
| 7 | **Surface test crosscheck:** Separate work item, not part of this plan. | Keep phases focused on UX. |
| 8 | **Phases 5+6 merged:** Onboarding restructure + welcome/auth consolidation ship as one release. | Auth hardcodes `/onboarding/density`; welcome constructs auth redirect. These are coupled. |
| 9 | **First onboarding route:** `/onboarding/goals` after auth. | Goals = first step in new sequence (Ziele & Plan). |
| 10 | **Auth continuation:** Google and email shown with equal prominence. | Product decision: no bias toward either method. |
| 11 | **Stepper:** Moves into Phase 5+6 (ships with the restructure). | A 3-step scaffold stretched across old routes is awkward. |
| 12 | **Lead linking:** Auth callback/confirm routes own it. Goals page keeps email-fallback as safety net only, not primary path. | Codex found triple-linking is duplication; callback/confirm already works for all auth methods. |
| 13 | **Legacy routes:** Clean break, no redirect shims. Delete old routes. | Accept that in-flight confirm links break. |
| 14 | **`routine_preference` move:** Phase 2 owns it exclusively. Phase 5+6 inherits the result. | Eliminates duplication flagged by Codex. |

## Remaining Questions — RESOLVED (2026-03-25)

1. ~~**Primary goal as pipeline signal:**~~ **Resolved:** No extra page. The existing goals page collects hair goals. Hair Concierge picks up the user's stated goals and reflects them in the UX (e.g., opening the chat around their goals). This is a UX/prompt concern — no `primary_goal` DB column or pipeline change needed.
2. ~~**`desired_volume` vs `volume` goal:**~~ **Resolved:** Current design is fine. `desired_volume` stays as the required field; `deriveOnboardingGoals` auto-injects `"volume"` when `desired_volume === "more"`. Volume chip already removed from straight goals in Phase 2. Internal engineering concern, not a product question.
3. ~~**Goal determinism:**~~ **Resolved:** Deferred. A logic for how stated goals are processed in the pipeline will follow as separate work.
4. ~~**Scalp reframe mapping:**~~ **Resolved:** Current labels and descriptions are fine as-is. The observable-behavior framing already exists in the option descriptions (e.g., "Ansaetze werden nach 1-2 Tagen oelig"). Internal values unchanged.

---

## Key Review Findings

### Where the audit is right
- Chemical treatment as quiz opener (easy, factual, high-confidence)
- Thickness clarifier copy (highest ROI single change)
- Pull test "Mini-Haarcheck" framing + helper line
- Scalp complaints rewording eliminates trocken/trockene Schuppen collision
- Welcome screen is redundant, auth breaks visual continuity
- Empty state ambiguity is real and under-weighted
- Goal hard-filtering is too aggressive

### Where the audit is wrong or incomplete
- Texture reword quietly swaps wet-strand for air-dry — **resolved: keep wet-strand**
- Density classified as "refinement" but gates conditioner weight + leave-in matching — **resolved: collect early**
- V2 quiz ends on hardest questions instead of sandwiching them
- "None-states" misclassified as quick win — **resolved: metadata approach, zero pipeline risk**
- Missing risks found by Codex: PostHog step-number breakage, `onboarding_completed` flag misplacement, lead data persistence gap, lead linking via wrong email match, profile editor leaking values, test suite drift, mid-onboarding users stranded on deleted routes

### Codex round 2 corrections (incorporated)
- Phase 4 file list was wrong: `QuizStep` in `quiz/types.ts` not `src/lib/types.ts`; missing `quiz/store.ts`, `quiz-brand-panel.tsx`, `quiz-scalp-question.tsx` progress
- Phase 5+6 undercounted route references: missing onboarding page redirects, component `router.push()` calls, auth callback/confirm legs
- Phase 1 file list was wrong: copy lives in `questions.ts`, `quiz-scalp-question.tsx`, `quiz-results.tsx`, `quiz-brand-panel.tsx` — not just "quiz step components"
- Prior Q1 (labels vs internal values) was engineering, not product — replaced with mapping question
- Prior Q4 (`routine_preference` impact) was already answerable from code — replaced with goal determinism question

---

## Resolved V2 Sequences

### Quiz order (Phase 4)
1. `SIND DEINE HAARE CHEMISCH BEHANDELT?` (chemical_treatment)
2. `Wie schnell fetten deine Ansaetze nach?` (scalp_type)
3. [if yes] `Hast du zusaetzlich Beschwerden...?` (scalp_condition)
4. `Was ist deine natuerliche Haartextur?` (hair_texture) — wet-strand, shortened
5. `Wie dick sind deine einzelnen Haare?` (thickness)
6. `Mini-Haarcheck 1 von 2: Oberflaeche` (cuticle_condition)
7. `Mini-Haarcheck 2 von 2: Zugtest` (protein_moisture_balance)

### Onboarding order (Phase 5+6)
1. **Ziele & Plan** (`/onboarding/goals`) — desired_volume, goals (all + relevance markers), routine_preference
2. **Dein Profil** (`/onboarding/profile`) — density (visually primary) + mechanical_stress_factors (secondary/optional)
3. **Dein Alltag** (`/onboarding/routine`) — heat_styling, post_wash_actions, wash_frequency, current_routine_products

---

## Implementation Phases

### Phase 0: Instrumentation Prep (half day) — DONE

> Shipped on `feat/ux-audit-phases-0-4` (2026-03-25). `step_name` is now primary, `step_number` kept with deprecation comment.

- ~~Switch PostHog quiz events from `step_number` to `step_name` as primary identifier~~
- Snapshot current funnel baselines
- Files: `src/app/quiz/page.tsx` (STEP_NAMES)

### Phase 1: Copy-Only Quick Wins (half day) — DONE

> Shipped on `feat/ux-audit-phases-0-4` (2026-03-25). All copy changes implemented. Scalp type title reframed as observable behavior ("Wie schnell fetten deine Ansaetze nach?"). `quiz-brand-panel.tsx` was not modified (no copy changes needed there).

- ~~Rewrite scalp type labels around observable behavior (labels only, keep internal values unchanged)~~
- ~~Reword scalp follow-up: "Hast du zusaetzlich Beschwerden wie Schuppen, Juckreiz oder Roetungen?"~~
- ~~Reword scalp condition: "Was ist aktuell dein Hauptproblem?"~~
- ~~Add thickness clarifier: "Gemeint ist ein einzelnes Haar, nicht wie viele Haare du insgesamt hast."~~
- ~~Shorten texture wet-strand instruction to one line~~
- ~~Frame surface + pull tests as "Mini-Haarcheck 1/2 von 2"~~
- ~~Add pull test helper: "Ziehe nur leicht. Uns geht es um die Tendenz, nicht um Perfektion."~~
- ~~Update results copy to signal continuation: "Dein Profil ist fast fertig"~~
- **Note:** Scalp type option labels (Fettig/Ausgeglichen/Trocken) were NOT changed — exact observable-oiling-cadence mapping still pending domain-review input on Remaining Question #4.
- Files:
  - `src/lib/quiz/questions.ts` (question titles, descriptions, option labels)
  - `src/components/quiz/quiz-scalp-question.tsx` (scalp labels, follow-up wording)
  - `src/components/quiz/quiz-results.tsx` (results continuation copy)

### Phase 2: Small Refactors (1-2 days) — DONE

> Shipped on `feat/ux-audit-phases-0-4` (2026-03-25). Volume removed from straight goals. `routine_preference` moved to goals page. `onboarding_completed` write and `/chat` redirect preserved. Test 3 in `onboarding-goal-flow.test.ts` now passes (was previously a failing TDD target). `less_split_ends` remains in straight — further goal curation is Phase 7 scope.

- ~~Remove `Mehr Volumen` from `ONBOARDING_GOALS.straight` (dedup with `desired_volume`)~~
- ~~Move `routine_preference` from routine page to goals page (Phase 2 owns this exclusively)~~
  - ~~Add `routine_preference` to `goals/page.tsx` server component props~~
  - ~~Remove `routine_preference` from `routine/page.tsx` server component props~~
  - ~~Update `onboarding-goals.tsx` to render + save `routine_preference`~~
  - ~~Update `onboarding-routine.tsx` to remove `routine_preference` section + state~~
- Files: `src/lib/vocabulary/onboarding-goals.ts`, `src/components/onboarding/onboarding-goals.tsx`, `src/components/onboarding/onboarding-routine.tsx`, `src/app/onboarding/goals/page.tsx`, `src/app/onboarding/routine/page.tsx`, `tests/onboarding-goal-flow.test.ts`

### Phase 3: None-States (1-2 days) — DONE

> Shipped on `feat/ux-audit-phases-0-4` (2026-03-25). Migration created (`supabase/migrations/20260324120000_add_answered_fields.sql`) — needs to be applied to Supabase before deploy. Shared `mergeAnsweredFields` helper extracted to `src/lib/onboarding/answered-fields.ts`. Codex (GPT-5.4) review caught two edge cases (fixed): (1) mechanical stress `handleSave` was marking `answered_fields` even on empty "WEITER" click — now only marks when `selected.size > 0`; (2) routine select-then-deselect-all was not tracked — replaced `answered*` flags with `touched*` + `none*` flags.

- ~~**Approach:** `answered_fields` metadata column. NO sentinel values in data.~~
- ~~Add `answered_fields text[] default '{}'` column to `hair_profiles` (Supabase migration)~~
- ~~When user submits a field (including clicking "Nichts davon" to explicitly select nothing), add that field name to `answered_fields`~~
- ~~Add "Nichts davon regelmaessig" button to: mechanical_stress, post_wash_actions, current_routine_products~~
- ~~Clicking "Nichts davon" stores `[]` for the field AND adds the field name to `answered_fields`~~
- ~~Pipeline code: **zero changes**. `[]` continues to mean "no items" everywhere.~~
- ~~Convention: `field NOT IN answered_fields` = user never saw/answered it; `field IN answered_fields AND value = []` = user explicitly said none~~
- **Action required:** Apply migration `supabase/migrations/20260324120000_add_answered_fields.sql` to Supabase before deploying.
- Files: `supabase/migrations/20260324120000_add_answered_fields.sql`, `src/lib/onboarding/answered-fields.ts`, `src/components/onboarding/onboarding-mechanical-stress.tsx`, `src/components/onboarding/onboarding-routine.tsx`

### Phase 4: Quiz Resequencing (1-2 days) — DONE

> Shipped on `feat/ux-audit-phases-0-4` (2026-03-25). `STEP_ORDER` changed to `[1, 7, 6, 2, 3, 4, 5, 9, 10, 11, 14]`. Brand panel formula replaced with explicit `QUESTION_NUMBER_MAP`. Scalp progress updated to 2/6. All motivation texts updated to match new positions. Confirmed: `QuizStep` type, `ANSWER_KEY_MAP`, and `STEP_NAMES` did NOT need changes (step numbers are component identifiers, not display order).

- ~~New order: chemical_treatment -> scalp_type -> [scalp_condition] -> hair_texture -> hair_thickness -> surface_test -> pull_test~~
- ~~Update `STEP_ORDER` in quiz store~~
- ~~Update `questions.ts` numbering~~
- ~~Update `quiz/store.ts` (step navigation logic)~~
- ~~Update `quiz-brand-panel.tsx` (left panel step references)~~
- ~~Update `quiz-scalp-question.tsx` (hardcoded scalp progress value)~~
- Not needed: `QuizStep` type in `types.ts` (union of literals, does not encode order)
- Not needed: `STEP_NAMES` in `page.tsx` (maps step numbers to names, order irrelevant)
- Not needed: `ANSWER_KEY_MAP` in `quiz-question.tsx` (maps step numbers to answer keys, unchanged)
- Files: `src/lib/quiz/store.ts`, `src/lib/quiz/questions.ts`, `src/components/quiz/quiz-scalp-question.tsx`, `src/components/quiz/quiz-brand-panel.tsx`

### Phase 5+6: Onboarding Restructure + Auth Consolidation (4-5 days, feature branch)

**Onboarding restructure:**
- New route sequence: `/onboarding/goals` -> `/onboarding/profile` -> `/onboarding/routine`
- Goals page (`/onboarding/goals`): already has `desired_volume`. Already has `routine_preference` (from Phase 2). Becomes first onboarding step.
- Profile page (`/onboarding/profile`): new combined page with density (visually primary) + mechanical stress (secondary/optional)
- Routine page (`/onboarding/routine`): reorder to heat_styling -> post_wash_actions -> wash_frequency -> current_routine_products. Remove PFLICHT badge. Add regularity framing.
- Move `onboarding_completed` flag write to `/onboarding/routine` (new last page)
- Add 3-step stepper to onboarding layout: Ziele / Profil / Alltag
- Delete old routes: `/onboarding/density`, `/onboarding/mechanical-stress` (clean break, no redirect shims)
- Update ALL `router.push()` calls in onboarding components:
  - `onboarding-goals.tsx` → push to `/onboarding/profile`
  - New profile component → push to `/onboarding/routine`
  - `onboarding-routine.tsx` → push to `/chat` (set `onboarding_completed` here)

**Lead linking:**
- Auth callback/confirm routes remain the primary lead-linking path (no change)
- Goals page keeps existing email-fallback link as safety net
- Do NOT move `linkQuizToProfile` to goals page as primary — it stays in callback/confirm

**Auth consolidation:**
- Repurpose welcome screen as quiz-aware inline auth transition
- Replace informational cards with contextual auth form: Google OAuth + email signup (equal prominence)
- Dark theme matching quiz chrome
- Heading: "Profil speichern & weitermachen"
- Remaining steps indicator: "Noch 3 kurze Schritte bis zu deinem vollstaendigen Profil"
- Explain why: "Damit dein Profil gespeichert bleibt und deine Beratung darauf aufbauen kann."
- Update ALL hardcoded `/onboarding/density` references:
  - `src/app/auth/page.tsx` (redirect after login)
  - `src/app/api/auth/callback/route.ts` (OAuth callback redirect)
  - `src/app/auth/confirm/route.ts` (email confirm redirect)
  - `src/components/quiz/quiz-welcome.tsx` (auth URL construction)
- Extract auth form into reusable component shared between quiz-aware and generic auth
- Preserve separate `/auth` route for returning users (session expired, signed out)
- Update E2E tests: `tests/quiz-onboarding-e2e.spec.ts`

**Files:** All onboarding components + routes, `src/app/onboarding/layout.tsx`, `src/components/quiz/quiz-welcome.tsx`, `src/app/auth/page.tsx`, `src/app/api/auth/callback/route.ts`, `src/app/auth/confirm/route.ts`, `src/lib/supabase/middleware.ts` (if onboarding route guards exist), new shared auth component, `tests/quiz-onboarding-e2e.spec.ts`

### Phase 7: Goal Model Rework (3-5 days) — UNBLOCKED
- Replace texture-based hard filtering with relevance sorting + markers
- Keep `curl_definition` hidden for `straight` as sole hard exclusion
- Show curated onboarding goal subset (not all enum values), sorted by texture relevance
- Mark top 3-4 as "Besonders relevant fuer dein Haarprofil"
- No extra "primary goal" page — Hair Concierge picks up the user's stated goals and reflects them in the chat UX (prompt/conversation concern, no `primary_goal` DB column needed)
- ~~Handle `volume` dedup~~ — resolved in Phase 2 (chip removed, auto-inject via `deriveOnboardingGoals` stays)
- Goal none-handling (if needed) belongs here, not in Phase 3
- Goal-to-pipeline processing logic is separate future work
- Update `deriveOnboardingGoals`, `goal-flow.ts`, profile page, and pipeline consumers
- Files: `src/lib/vocabulary/onboarding-goals.ts`, `src/lib/vocabulary/concerns-goals.ts`, `src/components/onboarding/onboarding-goals.tsx`, `src/lib/onboarding/goal-flow.ts`, `src/app/profile/page.tsx`

---

## Verification

### Phases 0–4 (verified 2026-03-25)
- [x] `tsc --noEmit` passes cleanly
- [x] `onboarding-goal-flow.test.ts` — all 3 tests pass (test 3 was previously failing TDD target, now passes)
- [x] PostHog `quiz_step_viewed` sends `step_name` as primary identifier
- [x] Quiz resequencing: chemical → scalp → texture → thickness → surface → pull (STEP_ORDER traced)
- [x] Brand panel: FRAGE 1–6 VON 6 labels match new order via QUESTION_NUMBER_MAP
- [x] Scalp progress bar: 2/6
- [x] Goals page: shows routine_preference section, preserves `onboarding_completed` + `/chat` redirect
- [x] Routine page: no routine_preference section
- [x] Mechanical stress: "Nichts davon" saves `[]` + marks `answered_fields`; empty "WEITER" does NOT mark
- [x] Routine: "Nichts davon" buttons for post_wash_actions and current_routine_products; select-then-deselect tracked via `touched*` flags
- [x] Codex (GPT-5.4) review: 2 edge cases found and fixed (skipped-vs-none semantics)

### Phases 5+6 (pending)
- [ ] Test on mobile viewport for scroll depth on merged pages
- [ ] Verify `linkQuizToProfile` fires correctly via auth callback/confirm for both Google and email auth
- [ ] Verify `onboarding_completed` fires on `/onboarding/routine`
- [ ] Verify auth redirect goes to `/onboarding/goals` not `/onboarding/density` for ALL auth methods
- [ ] Verify returning-user auth still works on `/auth` route
- [ ] Verify deleted routes (`/onboarding/density`, `/onboarding/mechanical-stress`) return 404
- [ ] Run full E2E suite; fix drift in `quiz-onboarding-e2e.spec.ts`
