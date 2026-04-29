# Density Quiz Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hair density as the third physical hair attribute in the quiz, persist it to `hair_profiles.density`, and show/edit it in the user-facing profile page.

**Architecture:** Quiz owns "what your hair is"; onboarding owns "what you do with it." Add a new quiz step immediately after strand thickness, store the answer in `leads.quiz_answers.density`, map it through `linkQuizToProfile`, and reuse the existing `hair_profiles.density` field consumed by recommendations. Backfill existing null profile rows to `medium` in a one-time Supabase migration, but do not add a permanent DB default. Do not add onboarding steps, onboarding milestones, or new profile edit routes.

**Tech Stack:** Next.js App Router, React 19, Zustand quiz store, Supabase `leads` + `hair_profiles`, Zod validators, Playwright + Node test runner.

---

## Decision

Use quiz-first placement.

Why:
- `hair_texture`, `thickness`, and `density` are the same conceptual family: physical hair attributes.
- The user has just answered "single strand thickness," so the contrast with "overall amount of hair" is easiest to explain immediately.
- The anonymous public quiz will capture density for lead/cohort analysis.
- Existing users who retake the quiz will be asked density naturally.
- The write path already exists: quiz answer -> `leads.quiz_answers` -> `linkQuizToProfile` -> `hair_profiles`.
- This avoids a one-step onboarding section, progress milestone churn, and an orphan profile-only field.
- Historical/test rows with missing density can be backfilled to `medium`; going forward the quiz is the source of truth.

Rejected alternative:
- Onboarding after welcome. This works technically, but it puts a physical attribute in the "what you do" flow and creates UI/progress weight for one page. Do not implement that path.

## Current State

Already present:
- DB column/check: `hair_profiles.density` with `low | medium | high` in `supabase/migrations/20260314210546_add_density_and_conditioner_rerank_specs.sql`.
- Vocabulary: `HAIR_DENSITIES`, `HairDensity`, `HAIR_DENSITY_LABELS`, `HAIR_DENSITY_OPTIONS` in `src/lib/vocabulary/profile-labels.ts`.
- Profile/types/validators: `HairProfile.density`, recommendation input `density`, and `validators/index.ts`.
- Consumers:
  - Conditioner: `src/lib/recommendation-engine/categories/shared.ts`, `src/lib/recommendation-engine/categories/conditioner.ts`, `src/lib/rag/conditioner-decision.ts`.
  - Leave-in: `src/lib/recommendation-engine/categories/leave-in.ts`, `src/lib/rag/leave-in-decision.ts`.
  - Mask: `src/lib/recommendation-engine/categories/mask.ts`.
  - Routine: `src/lib/routines/planner.ts`.
  - Chat/product context: `src/lib/rag/synthesizer.ts`, `src/components/chat/product-detail-drawer.tsx`.
  - Suggested prompts: `src/lib/suggested-prompts.ts`.

Missing:
- Quiz type, questions, validators, normalization, and lead/profile linking do not include `density`.
- `/profile` does not display density in `PROFILE_FIELD_CONFIG`.
- E2E fixtures often manually seed density, but the real quiz path never collects it.
- Existing rows may have `density = null`; these should be backfilled once, not silently defaulted forever.

## Product Spec

Quiz placement:
- Add density as the new Q3, immediately after thickness.
- Renumber later quiz questions so total quiz questions become 9.
- Keep scalp progressive disclosure as a single numbered question.

User-facing German copy:
- Title: `Wie dicht ist dein Haar insgesamt?`
- Instruction: `Jetzt geht es nicht mehr um ein einzelnes Haar, sondern um die Haarmenge auf dem Kopf. Schau zum Beispiel auf Scheitel, Zopf-Umfang und wie viel Kopfhaut sichtbar ist.`
- Options:
  - `Wenig Haare` (`low`): `Der Scheitel wirkt breiter oder die Kopfhaut scheint schnell durch.`
  - `Mittlere Dichte` (`medium`): `Du hast weder auffällig wenig noch auffällig viele Haare.`
  - `Viele Haare` (`high`): `Dein Haar fühlt sich insgesamt voll an, ein Zopf wirkt eher dick.`

Profile display:
- Show `Haardichte` near `Haar-Dicke` in the Haar-Check section.
- Route profile edit for density through the existing inline Haar-Check editor in `/profile`; do not send users to onboarding for this field.

Non-goals:
- Do not infer density from thickness, texture, goals, or photos.
- Do not add new recommendation rules.
- Do not add an onboarding `hair_density` step or `Profil` milestone.
- Do not add a permanent database default for density.

## Target File Map

- Modify `src/lib/quiz/types.ts`: add a quiz step id and `QuizAnswers.density`.
- Modify `src/lib/quiz/questions.ts`: add density question, update total count, renumber later questions/motivation.
- Modify `src/lib/quiz/store.ts`: insert the new step after thickness.
- Modify `src/components/quiz/quiz-question.tsx`: map the new density step to `answers.density`.
- Modify `src/app/quiz/page.tsx`: add `STEP_NAMES` entry and ensure standard question rendering includes the new step.
- Modify `src/lib/quiz/brand-panel-content.ts`: add the density step and update total/progress-complete counts from 8 to 9.
- Modify `src/components/quiz/quiz-brand-panel.tsx`: change desktop progress dot count from 8 to `QUIZ_TOTAL_QUESTIONS` or 9.
- Modify `src/components/quiz/quiz-scalp-question.tsx`, `quiz-goals.tsx`, `quiz-lead-capture.tsx`: verify they already derive total from `QUIZ_TOTAL_QUESTIONS`; update hardcoded current numbers where needed.
- Modify `src/lib/quiz/normalization.ts`: add `QUIZ_DENSITY_VALUES`, normalize stored answers, canonicalize/dedupe with density.
- Modify `src/lib/quiz/validators.ts`: require `density` in quiz answers.
- Modify `src/lib/quiz/link-to-profile.ts`: map `answers.density` to `profileData.density`.
- Create Supabase migration: backfill `hair_profiles.density IS NULL` to `medium`, without adding a column default.
- Modify `src/lib/quiz/completion.ts`: require density as part of completed quiz diagnostics after the backfill.
- Modify `src/lib/profile/section-config.ts`: show density in the Haar-Check section.
- Modify `src/app/profile/page.tsx`: include density in inline quiz draft/save if editing from the profile page.
- Modify `tests/quiz-onboarding-e2e.spec.ts`: collect/assert density.
- Modify `tests/profile-page-smoke.spec.ts`: seed/show/edit density and verify route/edit behavior.
- Modify `tests/auth-intake-state.test.ts`: verify completed quiz diagnostics include density.
- Modify `docs/quiz-onboarding-data-collection-inventory.md`: document density as quiz Q3 and remove stale onboarding-density claims.

## Tasks

### Task 1: Extend Quiz Types And Step Order

**Files:**
- Modify: `src/lib/quiz/types.ts`
- Modify: `src/lib/quiz/store.ts`

- [ ] Add numeric step `13` for density to avoid renumbering existing internal step ids:

```ts
export type QuizStep =
  | 1
  | 2 // haartextur
  | 3 // haarstaerke
  | 13 // haardichte
  | 4 // oberflaeche
  // existing steps unchanged
```

- [ ] Add `density?: string` to `QuizAnswers`.
- [ ] Insert step `13` immediately after `3`:

```ts
const STEP_ORDER: QuizStep[] = [1, 2, 3, 13, 4, 5, 7, 6, 8, 12, 9, 10, 11, 14]
```

Acceptance:
- Back/next from thickness goes to density, then surface.
- Existing internal step ids stay stable for old tracking references.

### Task 2: Add The Density Quiz Question

**Files:**
- Modify: `src/lib/quiz/questions.ts`
- Modify: `src/components/quiz/quiz-question.tsx`
- Modify: `src/app/quiz/page.tsx`

- [ ] Change `QUIZ_TOTAL_QUESTIONS` from `8` to `9`.
- [ ] Add the density question after thickness:

```ts
{
  step: 13,
  questionNumber: 3,
  title: "Wie dicht ist dein Haar insgesamt?",
  instruction:
    "Jetzt geht es nicht mehr um ein einzelnes Haar, sondern um die Haarmenge auf dem Kopf. Schau zum Beispiel auf Scheitel, Zopf-Umfang und wie viel Kopfhaut sichtbar ist.",
  options: [
    {
      value: "low",
      label: "Wenig Haare",
      description: "Der Scheitel wirkt breiter oder die Kopfhaut scheint schnell durch.",
      icon: "hair-fine",
    },
    {
      value: "medium",
      label: "Mittlere Dichte",
      description: "Du hast weder auffällig wenig noch auffällig viele Haare.",
      icon: "hair-normal",
    },
    {
      value: "high",
      label: "Viele Haare",
      description: "Dein Haar fühlt sich insgesamt voll an, ein Zopf wirkt eher dick.",
      icon: "hair-coarse",
    },
  ],
  selectionMode: "single",
  motivation: "Genau — jetzt kennen wir die wichtigsten Grunddaten.",
}
```

- [ ] Increment later `questionNumber` values by one.
- [ ] Update motivation copy where it references remaining counts.
- [ ] Add `13: "density"` to `ANSWER_KEY_MAP`.
- [ ] Add `13: "hair_density"` to `STEP_NAMES`.
- [ ] Ensure the standard quiz question rendering includes step 13. Current `if (step >= 2 && step <= 8)` will not include 13. Keep the custom scalp/concerns guards first, then render any configured standard question:

```ts
if (step === 6) return <QuizScalpQuestion />
if (step === 8) return <QuizConcernsQuestion />

const question = getQuestionByStep(step)
if (question) return <QuizQuestion key={question.step} question={question} />
```

Icon decision:
- Use the existing strand icons (`hair-fine`, `hair-normal`, `hair-coarse`) for the first version. Do not add new icons in this task; the text carries the distinction.

### Task 3: Update Quiz Progress And Brand Panel

**Files:**
- Modify: `src/lib/quiz/brand-panel-content.ts`
- Modify: `src/components/quiz/quiz-brand-panel.tsx`
- Modify: `src/components/quiz/quiz-scalp-question.tsx`
- Review: `src/components/quiz/quiz-goals.tsx`, `src/components/quiz/quiz-lead-capture.tsx`

- [ ] Add step 13 to `QUESTION_PANEL_CONTENT`:

```ts
13: { questionNumber: 3, description: "Wie voll dein Haar insgesamt ist." },
```

- [ ] Increment later `questionNumber` values.
- [ ] Replace hardcoded `VON 8`, `progressCurrent: 8`, and dot count `length: 8` with `QUIZ_TOTAL_QUESTIONS`, or change them to 9 consistently.
- [ ] Update `QuizScalpQuestion` hardcoded current progress from `6` to the new scalp question number.
- [ ] Verify `QuizGoals` and `QuizLeadCapture` already use `QUIZ_TOTAL_QUESTIONS`; no change needed if they do.

### Task 4: Persist Density Through Lead And Profile Mapping

**Files:**
- Modify: `src/lib/quiz/normalization.ts`
- Modify: `src/lib/quiz/validators.ts`
- Modify: `src/lib/quiz/link-to-profile.ts`

- [ ] Add density allowed values:

```ts
export const QUIZ_DENSITY_VALUES = ["low", "medium", "high"] as const
```

- [ ] Normalize stored quiz density:

```ts
density: isAllowedValue(source.density, QUIZ_DENSITY_VALUES) ? source.density : undefined,
```

- [ ] Add `density: z.enum(QUIZ_DENSITY_VALUES)` to `quizAnswersSchema`.
- [ ] Map density in `linkQuizToProfile`:

```ts
if (answers.density) profileData.density = answers.density
```

Acceptance:
- `leads.quiz_answers.density` stores `low | medium | high`.
- `hair_profiles.density` is populated when auth/lead linking runs.
- Retaking the quiz updates density on the existing hair profile.

### Task 5: Backfill Existing Profiles And Require Density In Quiz Completion

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_backfill_hair_profile_density.sql`
- Modify: `src/lib/quiz/completion.ts`
- Modify: `tests/auth-intake-state.test.ts`

- [ ] Create a Supabase migration that backfills existing null density rows to `medium`:

```sql
-- Historical/test profiles predate the quiz density question.
-- Backfill to a neutral value so recommendation logic receives a complete
-- physical-hair profile, but do not add a permanent default for future rows.
UPDATE public.hair_profiles
SET density = 'medium'
WHERE density IS NULL;
```

- [ ] Confirm the migration does not add `ALTER COLUMN density SET DEFAULT`.
- [ ] Add `density?: string | null` to `PersistedQuizDiagnosticsProfile`.
- [ ] Require `density` in `hasCompletedQuizDiagnostics`:

```ts
hasNonEmptyString(profile.density) &&
```

- [ ] Update `completeQuizProfile` in `tests/auth-intake-state.test.ts` with `density: "medium"`.
- [ ] Add or update tests:

```ts
test("hasQuizDiagnostics requires density", () => {
  assert.equal(hasQuizDiagnostics({ ...completeQuizProfile, density: null }), false)
})

test("hasQuizDiagnostics accepts complete quiz profiles with density", () => {
  assert.equal(hasQuizDiagnostics({ ...completeQuizProfile, density: "medium" }), true)
})
```

Rationale:
- After the migration, existing profiles are normalized to `medium`; new quiz submissions require density. A future missing density should be treated as a data bug, not silently completed.

### Task 6: Show And Edit Density In Profile

**Files:**
- Modify: `src/lib/profile/section-config.ts`
- Modify: `src/app/profile/page.tsx`
- Modify: `tests/profile-page-smoke.spec.ts`

- [ ] Import `HAIR_DENSITY_OPTIONS` in `section-config.ts`.
- [ ] Add the profile field near thickness:

```ts
{
  key: "density",
  label: "Haardichte",
  sectionKey: "quiz",
  editTarget: { kind: "quiz" },
  getValue: (profile) => optionLabel(profile?.density, HAIR_DENSITY_OPTIONS),
}
```

- [ ] Add density to `QuizDraft`, `createQuizDraft`, and `handleSaveQuiz` in `src/app/profile/page.tsx`.
- [ ] Add `density` to the `Pick<HairProfile, ...>` payload type in `handleSaveQuiz`.
- [ ] Add a `quizFieldRefs.current.density` editor block directly after `thickness`.
- [ ] Render density with `SegmentedControl` using `HAIR_DENSITY_OPTIONS`, title `Haardichte`, and helper text `Wie viele Haare du insgesamt hast - nicht wie dick ein einzelnes Haar ist.`
- [ ] Verify the profile completion denominator before changing the smoke assertion. If the Haar-Check count is derived from `PROFILE_FIELD_CONFIG`, update `8/8 vollständig` to `9/9 vollständig`; otherwise update to the actual computed value.
- [ ] In `tests/profile-page-smoke.spec.ts`, seed `density: "medium"`.
- [ ] Assert profile shows `Haardichte` and `Mittlere Dichte`.
- [ ] Edit density through the inline Haar-Check editor and assert Supabase value changes to `high`.

### Task 7: E2E Quiz-To-Profile Persistence

**Files:**
- Modify: `tests/quiz-onboarding-e2e.spec.ts`
- Review: `tests/mobile-ux.spec.ts`, `tests/auth-intake-routing.e2e.spec.ts`

- [ ] Add the density step after thickness in the quiz E2E.
- [ ] Select `Mittlere Dichte`.
- [ ] Update all visible progress assertions from 8-total to 9-total.
- [ ] Assert linked hair profile includes `density: "medium"`:

```ts
const profile = await fetchHairProfile()
expect(profile?.density).toBe("medium")
```

- [ ] Update mobile/auth intake tests only where they assert quiz progress text or question count.

### Task 8: Verify Density Consumers And Fallback Tests

**Files:**
- Usually no code changes. Update only if a consumer no longer receives persisted `hair_profiles.density`.

- [ ] Confirm persistence adapter maps `profile.density` in `src/lib/recommendation-engine/adapters/from-persistence.ts`.
- [ ] Confirm runtime normalization maps density in `src/lib/recommendation-engine/normalize.ts`.
- [ ] Confirm conditioner target weight uses `deriveTargetWeight(profile)`.
- [ ] Keep existing null-density fallback tests as bug guards, even though migration + required quiz should make null density rare:
  - `tests/conditioner-reranker.spec.ts`: `missing density falls back safely and keeps weight scoring neutral`
  - `tests/conditioner-chat-e2e.spec.ts`: `missing density still returns conditioner recommendations via soft fallback`
  - `tests/leave-in-decision.spec.ts`: missing fields include `density`
- [ ] Add mask/routine null-density coverage only if the existing test suite lacks any fallback coverage for those consumers and implementation changes touch that behavior.
- [ ] Confirm chat context includes density when present in `src/lib/rag/synthesizer.ts`.
- [ ] Confirm product detail drawer renders matched density metadata when present.
- [ ] Confirm suggested prompts still treat density as a meaningful profile signal.

Targeted commands:

```bash
npx playwright test tests/conditioner-reranker.spec.ts tests/leave-in-decision.spec.ts tests/routine-planner.spec.ts tests/mask-flow.spec.ts
node --import tsx --test tests/suggested-prompts.test.ts tests/auth-intake-state.test.ts
```

### Task 9: Update Docs

**Files:**
- Modify: `docs/quiz-onboarding-data-collection-inventory.md`

- [ ] Move density from onboarding to the quiz table as Q3:

```md
| `Wie dicht ist dein Haar insgesamt?` | `Wenig Haare` (`low`), `Mittlere Dichte` (`medium`), `Viele Haare` (`high`) | Raw: `public.leads.quiz_answers` key `density`<br>Final: `public.hair_profiles.density` | `low`, `medium`, `high` |
```

- [ ] Remove stale claims that current onboarding starts with density.
- [ ] Note that historical/test profiles are backfilled to `medium`, while new quiz completions populate density from the user's answer.

### Task 10: Full Verification

Run:

```bash
npm run typecheck
npm run lint
npx playwright test tests/quiz-onboarding-e2e.spec.ts
npx playwright test tests/profile-page-smoke.spec.ts
npx playwright test tests/conditioner-reranker.spec.ts tests/leave-in-decision.spec.ts tests/routine-planner.spec.ts tests/mask-flow.spec.ts
node --import tsx --test tests/suggested-prompts.test.ts tests/auth-intake-state.test.ts
```

Manual checks:
- Desktop/mobile quiz: density appears immediately after thickness, copy distinguishes strand thickness vs overall density, no text overlap.
- Back navigation: density back goes to thickness; density next goes to surface test.
- Anonymous lead: `leads.quiz_answers.density` is stored.
- Auth/linking: `hair_profiles.density` is populated.
- Migration: local/test profiles with null density become `medium`; schema has no permanent density default.
- Profile: `Haardichte` displays in Haar-Check and inline edit updates the DB.
- Conditioner spot check: `thickness = fine`, `density = low` produces light target/matched weight; missing density still follows the tested soft fallback.

## Open Risks

- Adding one quiz question may affect public funnel completion. Keep copy short and place it beside thickness where cognitive load is lowest.
- Density self-assessment is imperfect. The implementation should not turn density into a hard medical or hair-loss signal.

## Ready Check

Because this touches quiz, profile display, German copy, persisted recommendation inputs, and onboarding handoff tests, run `ready-check` before shipping.

Next workflow skill: `superpowers:subagent-driven-development` for implementation, or `superpowers:executing-plans` for a single-agent pass.
