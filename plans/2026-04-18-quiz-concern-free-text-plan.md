# Quiz Concern Free-Text Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional free-text note to the quiz concern step so users can mention an unlisted hair concern for research/data collection without affecting any recommendation logic.

**Architecture:** Keep the note entirely inside the quiz intake path. It is stored in `QuizAnswers` and persisted into `leads.quiz_answers`, but it is intentionally excluded from `hair_profiles`, the shared concern vocabulary, product matching, recommendation logic, and the profile page.

**Tech Stack:** Next.js App Router, React, Zustand, TypeScript, Zod, Supabase, Playwright, tsx test runner

---

### Task 1: Lock the New Intake-Only Behavior in Tests

**Files:**
- Modify: `tests/quiz-validators.test.ts`
- Modify: `tests/quiz-normalization.test.ts`
- Modify: `tests/quiz-lead-lifecycle.test.ts`
- Modify: `tests/quiz-onboarding-e2e.spec.ts`

- [ ] **Step 1: Add validator coverage for the optional free-text field**

Add cases that pin the expected boundaries:

```ts
test("quiz schema accepts free-text-only concern notes", () => {
  const parsed = quizAnswersSchema.parse({
    structure: "curly",
    thickness: "normal",
    fingertest: "rau",
    pulltest: "stretches_stays",
    scalp_type: "fettig",
    has_scalp_issue: false,
    concerns: [],
    concerns_other_text: "statische Haare",
    treatment: ["gefaerbt"],
  })

  assert.equal(parsed.concerns_other_text, "statische Haare")
})
```

```ts
test("quiz schema rejects free-text notes above 50 characters", () => {
  const parsed = quizAnswersSchema.safeParse({
    structure: "curly",
    thickness: "normal",
    fingertest: "rau",
    pulltest: "stretches_stays",
    scalp_type: "fettig",
    has_scalp_issue: false,
    concerns: [],
    concerns_other_text: "x".repeat(51),
    treatment: ["gefaerbt"],
  })

  assert.equal(parsed.success, false)
})
```

- [ ] **Step 2: Add normalization coverage for trimming and empty-string cleanup**

Add cases for the intake-only storage semantics:

```ts
test("free-text concern notes are trimmed and empty strings are removed", () => {
  const normalized = normalizeStoredQuizAnswers({
    concerns: [],
    concerns_other_text: "  statische Haare  ",
  })

  assert.equal(normalized.concerns_other_text, "statische Haare")
})
```

```ts
test("blank free-text concern notes normalize to undefined", () => {
  const normalized = normalizeStoredQuizAnswers({
    concerns: [],
    concerns_other_text: "   ",
  })

  assert.equal(normalized.concerns_other_text, undefined)
})
```

- [ ] **Step 3: Add lead-reuse coverage so the note participates in quiz equality**

Pin the expected dedupe behavior:

```ts
test("dedupe distinguishes concern notes with different text", () => {
  const reusableLead = findReusableLead(
    [
      {
        id: "lead-1",
        quiz_answers: {
          structure: "curly",
          thickness: "normal",
          fingertest: "rau",
          pulltest: "ueberdehnt",
          scalp_type: "fettig",
          concerns: [],
          concerns_other_text: "statische Haare",
          treatment: ["gefaerbt"],
        },
      },
    ],
    {
      structure: "curly",
      thickness: "normal",
      fingertest: "rau",
      pulltest: "stretches_stays",
      scalp_type: "fettig",
      has_scalp_issue: false,
      concerns: [],
      concerns_other_text: "verklebt schnell",
      treatment: ["gefaerbt"],
    },
  )

  assert.equal(reusableLead, null)
})
```

- [ ] **Step 4: Add one E2E for the new free-text-only flow**

Add one browser test that:
- reaches the concern page
- enters only free text
- continues without selecting chips
- verifies the resulting lead payload contains `concerns_other_text`

Run:

```bash
npx tsx --test tests/quiz-validators.test.ts tests/quiz-normalization.test.ts tests/quiz-lead-lifecycle.test.ts
```

Expected:
- the new validator and normalization tests fail before implementation

---

### Task 2: Extend the Quiz Model and Persistence Path

**Files:**
- Modify: `src/lib/quiz/types.ts`
- Modify: `src/lib/quiz/normalization.ts`
- Modify: `src/lib/quiz/validators.ts`
- Modify: `src/lib/quiz/store.ts`
- Modify: `src/app/api/quiz/lead/route.ts`
- Modify: `src/lib/quiz/link-to-profile.ts`

- [ ] **Step 1: Extend `QuizAnswers` with the intake-only field**

Add an optional field to the quiz answer model:

```ts
export interface QuizAnswers {
  structure?: string
  thickness?: string
  fingertest?: string
  pulltest?: string
  scalp_type?: string
  has_scalp_issue?: boolean
  scalp_condition?: string
  concerns?: ProfileConcern[]
  concerns_other_text?: string
  treatment?: string[]
}
```

- [ ] **Step 2: Normalize the note conservatively**

In `normalizeStoredQuizAnswers`, trim the note and collapse blank content:

```ts
function normalizeConcernOtherText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined
  return trimmed
}
```

Return it from normalization:

```ts
concerns_other_text: normalizeConcernOtherText(source.concerns_other_text),
```

Keep it in `canonicalizeQuizAnswers` so lead dedupe compares the normalized text consistently.

- [ ] **Step 3: Validate the note with a hard 50-character limit**

In `quizAnswersSchema`, add:

```ts
concerns_other_text: z.string().trim().max(50, "Bitte bleib bei maximal 50 Zeichen").optional(),
```

Keep it optional and independent from `ProfileConcern`.

- [ ] **Step 4: Persist it only into quiz intake data**

Ensure `/api/quiz/lead` accepts and stores the field via the existing validated `quizAnswers` payload.

Do **not** map it into `hair_profiles` in `linkQuizToProfile`; the mapping should stay:

```ts
if (answers.concerns !== undefined) profileData.concerns = answers.concerns
```

and should **not** grow a `concerns_other_text` profile write.

Run:

```bash
npx tsx --test tests/quiz-validators.test.ts tests/quiz-normalization.test.ts tests/quiz-lead-lifecycle.test.ts
```

Expected:
- all unit tests pass

---

### Task 3: Add the Free-Text Field to the Concern Page UX

**Files:**
- Modify: `src/components/quiz/quiz-concerns-question.tsx`
- Modify: `src/lib/quiz/questions.ts`

- [ ] **Step 1: Add local state for the free-text note**

Initialize from store state:

```ts
const [otherText, setOtherText] = useState(answers.concerns_other_text ?? "")
```

Persist on continue:

```ts
setAnswer("concerns_other_text", otherText.trim() || undefined)
```

- [ ] **Step 2: Make free-text-only progression valid**

Replace the current gate:

```ts
const hasSelection = localSelection.length > 0
```

with:

```ts
const hasTypedNote = otherText.trim().length > 0
const canContinue = hasSelection || hasTypedNote
```

and wire `Weiter` to `disabled={!canContinue}`.

- [ ] **Step 3: Add the minimalist input directly under the concern cards**

Render a simple text field under the chips with no helper copy:

```tsx
<div className="mt-4">
  <label className="mb-2 block text-sm font-medium text-foreground">
    Etwas anderes?
  </label>
  <textarea
    value={otherText}
    onChange={(event) => setOtherText(event.target.value.slice(0, 50))}
    maxLength={50}
    rows={2}
    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
  />
  <p className="mt-2 text-right text-xs text-[var(--text-caption)]">
    {otherText.length}/50
  </p>
</div>
```

Keep the design language aligned with the rest of the quiz page.

The order on the page should be:
- concern cards
- `Etwas anderes?`
- `Nichts davon`
- `Weiter`

- [ ] **Step 4: Keep `Nichts davon` concern-specific and render it above `Weiter`**

`Nichts davon` should:
- clear `concerns`
- keep the typed note intact
- allow advancing immediately when there is no note, exactly like today

Use:

```ts
setAnswer("concerns", [])
setAnswer("concerns_other_text", otherText.trim() || undefined)
```

before advancing.

Do **not** clear the text when the user presses `Nichts davon`.

Render the actions in this order so `Weiter` stays as the last CTA:

```tsx
<button type="button">Nichts davon</button>
<Button type="button">Weiter</Button>
```

Run:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3563 npx playwright test tests/quiz-onboarding-e2e.spec.ts --reporter=line --workers=1 --timeout=180000
```

Expected:
- the user can continue with only typed text
- the concern chips still cap at 3
- `Nichts davon` still works

---

### Task 4: Final Verification and Non-Regression Check

**Files:**
- Review: `src/lib/recommendation-engine/`
- Review: `src/app/profile/page.tsx`
- Review: `src/lib/product-specs/concern-taxonomy.ts`

- [ ] **Step 1: Confirm the note is not consumed downstream**

Verify there are no reads of `concerns_other_text` in:
- profile rendering
- `hair_profiles` persistence
- recommendation engine
- routines
- product taxonomy
- suggested prompts

The field should exist only in quiz intake state and stored lead payloads.

- [ ] **Step 2: Run focused regression checks**

Run:

```bash
npx tsx --test tests/quiz-validators.test.ts tests/quiz-normalization.test.ts tests/quiz-lead-lifecycle.test.ts tests/recommendation-engine-foundation.test.ts tests/recommendation-engine-selection.test.ts
```

Expected:
- green

- [ ] **Step 3: Run the local browser check**

With the worktree dev server running:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3563 npx playwright test tests/profile-page-smoke.spec.ts tests/quiz-onboarding-e2e.spec.ts --reporter=line --workers=1 --timeout=180000
```

Expected:
- quiz flow still passes
- profile remains unchanged because the new field is intentionally intake-only

- [ ] **Step 4: Commit**

```bash
git add src/components/quiz/quiz-concerns-question.tsx src/lib/quiz/types.ts src/lib/quiz/normalization.ts src/lib/quiz/validators.ts src/app/api/quiz/lead/route.ts tests/quiz-validators.test.ts tests/quiz-normalization.test.ts tests/quiz-lead-lifecycle.test.ts tests/quiz-onboarding-e2e.spec.ts plans/2026-04-18-quiz-concern-free-text-plan.md
git commit -m "feat: add quiz concern free-text note"
```

Expected:
- one clean commit for the intake-only note feature
