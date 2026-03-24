# UX Audit Phases 0–4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first five phases of the UX audit — PostHog instrumentation, copy quick-wins, small refactors, none-states metadata, and quiz resequencing.

**Architecture:** Each phase is a self-contained task that ships independently. Phases 0, 1, 4 are fully independent. Phase 3 modifies `onboarding-routine.tsx` (adding "Nichts davon" buttons) so it should merge after Phase 2 (which removes `routine_preference` from the same file). All changes are frontend + one DB migration.

**Tech Stack:** Next.js 15 (App Router), React, Zustand, Supabase (Postgres), PostHog, TypeScript

**Spec:** `docs/quiz-onboarding-ux-audit-review.md`

---

## File Map

| Task | Creates | Modifies |
|------|---------|----------|
| 0: PostHog | — | `src/app/quiz/page.tsx` |
| 1: Copy | — | `src/lib/quiz/questions.ts`, `src/components/quiz/quiz-scalp-question.tsx`, `src/components/quiz/quiz-results.tsx` |
| 2: Refactors | — | `src/lib/vocabulary/onboarding-goals.ts`, `src/components/onboarding/onboarding-goals.tsx`, `src/components/onboarding/onboarding-routine.tsx`, `src/app/onboarding/goals/page.tsx`, `src/app/onboarding/routine/page.tsx`, `tests/onboarding-goal-flow.test.ts` |
| 3: None-states | `supabase/migrations/20260324120000_add_answered_fields.sql`, `src/lib/onboarding/answered-fields.ts` | `src/components/onboarding/onboarding-mechanical-stress.tsx`, `src/components/onboarding/onboarding-routine.tsx` |
| 4: Resequence | — | `src/lib/quiz/store.ts`, `src/lib/quiz/questions.ts`, `src/components/quiz/quiz-scalp-question.tsx`, `src/components/quiz/quiz-brand-panel.tsx` |

---

### Task 0: PostHog Instrumentation Prep

**Context:** PostHog currently sends both `step_number` and `step_name` in `quiz_step_viewed`. After Phase 4 resequences steps, `step_number` meanings change. We need `step_name` as the canonical identifier so dashboards don't break.

**Files:**
- Modify: `src/app/quiz/page.tsx:15-36`

- [ ] **Step 1: Update PostHog event to lead with step_name**

In `src/app/quiz/page.tsx`, reorder the event properties so `step_name` is primary and add a deprecation note on `step_number`:

```typescript
useEffect(() => {
  posthog.capture("quiz_step_viewed", {
    step_name: STEP_NAMES[step] || `step_${step}`,
    step_number: step, // deprecated: use step_name after Phase 4 resequencing
  })
}, [step])
```

- [ ] **Step 2: Verify no other quiz events use step_number without step_name**

Check these files send named identifiers (not just numeric):
- `src/components/quiz/quiz-lead-capture.tsx` — `quiz_lead_captured` (no step ref, OK)
- `src/components/quiz/quiz-results.tsx` — `quiz_completed` (no step ref, OK)

No changes needed — only `quiz_step_viewed` uses step identifiers.

- [ ] **Step 3: Commit**

```bash
git add src/app/quiz/page.tsx
git commit -m "chore(posthog): make step_name primary identifier in quiz events"
```

---

### Task 1: Copy-Only Quick Wins

**Context:** String changes across quiz components. No logic changes. The spec notes exact German strings are product decisions — this task uses the strings specified in the audit document.

**Files:**
- Modify: `src/lib/quiz/questions.ts` (question titles, descriptions, option labels)
- Modify: `src/components/quiz/quiz-scalp-question.tsx` (scalp title, follow-up wording)
- Modify: `src/components/quiz/quiz-results.tsx` (results continuation copy)

- [ ] **Step 1: Add thickness clarifier in questions.ts**

In `src/lib/quiz/questions.ts`, find the step 3 (thickness) question. Add the clarifier line after the existing instruction:

```typescript
// step 3 question object
instruction:
  "Nimm ein einzelnes Haar und halte es zwischen Daumen und Zeigefinger. Vergleiche es mit einem Naehfaden – das ist der beste Referenzpunkt.\n\nGemeint ist ein einzelnes Haar, nicht wie viele Haare du insgesamt hast.",
```

- [ ] **Step 2: Shorten texture wet-strand instruction in questions.ts**

Find the step 2 (texture) question. Replace the instruction with a condensed one-liner.

**IMPORTANT:** The codebase uses an en-dash (`\u2013` / `–`), not an em-dash. Match the exact character when finding the old string.

Old (line 9, step 2 instruction):
```
"Mach eine Straehne richtig nass \u2013 sie muss tropfnass sein. Halte sie am Ansatz fest, druecke sie oben zusammen und lass los. Schau, was passiert:"
```

New:
```
"Mach eine Straehne tropfnass, druecke sie oben zusammen und lass los \u2013 was passiert?"
```

- [ ] **Step 3: Reframe surface + pull tests as Mini-Haarcheck in questions.ts**

Find step 4 (surface) question title. Change:
```
"DER OBERFLAECHENTEST" → "MINI-HAARCHECK 1 VON 2: OBERFLAECHE"
```

Find step 5 (pull) question title. Change:
```
"DER ZUGTEST" → "MINI-HAARCHECK 2 VON 2: ZUGTEST"
```

- [ ] **Step 4: Add pull test helper line in questions.ts**

Find step 5 (pull) question. Append helper to the instruction:

```typescript
instruction:
  "Nimm dasselbe Haar. Klemm es zwischen Ringfinger und Zeigefinger auf der einen Seite und zwischen Ringfinger und Mittelfinger auf der anderen. Zieh jetzt vorsichtig – wirklich mit Gefuehl, nicht reissen. Beobachte genau, was passiert:\n\nZiehe nur leicht. Uns geht es um die Tendenz, nicht um Perfektion.",
```

- [ ] **Step 5: Reword scalp question title + follow-up in quiz-scalp-question.tsx**

In `src/components/quiz/quiz-scalp-question.tsx`:

Change scalp type title:
```
"WIE IST DEIN KOPFHAUTTYP?" → "WIE SCHNELL FETTEN DEINE ANSAETZE NACH?"
```

Change scalp type instruction:
```
"Sei ehrlich: Wie oft musst du wirklich waschen? Deine Gesichtshaut gibt dir einen guten Hinweis — oelige T-Zone deutet auf fettige Kopfhaut hin."
→
"Deine Gesichtshaut gibt dir einen guten Hinweis — oelige T-Zone deutet auf fettige Kopfhaut hin."
```

Change gate question:
```
"HAST DU KOPFHAUTBESCHWERDEN?" → "HAST DU ZUSAETZLICH BESCHWERDEN WIE SCHUPPEN, JUCKREIZ ODER ROETUNGEN?"
```

Change gate instruction:
```
"Schuppen, Jucken oder Roetungen — oder ist alles im gruenen Bereich?"
→
(remove — the gate question itself now contains this context)
```

Change condition title:
```
"WELCHE BESCHWERDEN HAST DU?" → "WAS IST AKTUELL DEIN HAUPTPROBLEM?"
```

- [ ] **Step 6: Update results copy in quiz-results.tsx**

In `src/components/quiz/quiz-results.tsx`, find the subtitle line:

```
"Deine Diagnose steht. Im naechsten Schritt legst du Ziele und Routinepraeferenzen fest."
→
"Dein Profil ist fast fertig — im naechsten Schritt geht es weiter mit deinen Zielen und deiner Routine."
```

- [ ] **Step 7: Build and verify**

Run: `npx next build`
Expected: Build succeeds (these are string-only changes, no type errors)

- [ ] **Step 8: Commit**

```bash
git add src/lib/quiz/questions.ts src/components/quiz/quiz-scalp-question.tsx src/components/quiz/quiz-results.tsx
git commit -m "feat(quiz): update copy — thickness clarifier, mini-haarcheck framing, scalp reword, results continuation"
```

---

### Task 2: Small Refactors — Volume Dedup + Routine Preference Move

**Context:** Two changes: (1) Remove `Mehr Volumen` from `ONBOARDING_GOALS.straight` since `desired_volume` already captures this. (2) Move `routine_preference` from the routine page to the goals page so it groups with goal-setting.

**Files:**
- Modify: `src/lib/vocabulary/onboarding-goals.ts:37-42` (remove volume entry)
- Modify: `src/components/onboarding/onboarding-goals.tsx` (add routine_preference section + save it)
- Modify: `src/components/onboarding/onboarding-routine.tsx` (remove routine_preference section + state)
- Modify: `src/app/onboarding/goals/page.tsx` (fetch + pass routine_preference)
- Modify: `src/app/onboarding/routine/page.tsx` (stop fetching routine_preference)
- Modify: `tests/onboarding-goal-flow.test.ts` (update test expectations)

- [ ] **Step 1: Remove volume goal from straight in onboarding-goals.ts**

In `src/lib/vocabulary/onboarding-goals.ts`, delete the volume entry from the `straight` array (lines 37-42):

```typescript
// DELETE this entire object from the straight array:
{
  key: "volume",
  label: "Mehr Volumen",
  description: "Mehr Fuelle und Bewegung im Haar",
  emoji: "💨",
},
```

After removal, straight has: `healthy_scalp`, `less_frizz`, `shine`, `less_split_ends`.

- [ ] **Step 2: Update goal-flow test**

In `tests/onboarding-goal-flow.test.ts`, the existing test 3 is currently **failing** — it was written as a TDD target that expects `["healthy_scalp", "less_frizz", "shine"]` but `getOnboardingGoalCards("straight")` currently returns all 5 goals. After removing volume, straight will have 4 goals. Update the test to match the new data:

```typescript
test("straight onboarding cards are unique and no longer use the old volume chip", () => {
  const straightGoals = getOnboardingGoalCards("straight")
  const keys = straightGoals.map((goal) => goal.key)

  assert.deepEqual(keys, ["healthy_scalp", "less_frizz", "shine", "less_split_ends"])
  assert.equal(new Set(keys).size, keys.length)
  assert.ok(!keys.includes("volume"))
})
```

Note: `less_split_ends` remains — further goal curation (removing goals from the chip list) is Phase 7 scope.

- [ ] **Step 3: Run tests**

Run: `npx tsx --test tests/onboarding-goal-flow.test.ts`
Expected: All 3 tests pass (test 3 was previously failing, now passes).

- [ ] **Step 4: Fetch routine_preference in goals server component**

In `src/app/onboarding/goals/page.tsx`, add `routine_preference` to the select query and pass it as a prop:

```typescript
// Change the select query from:
.select("hair_texture, goals, desired_volume")
// to:
.select("hair_texture, goals, desired_volume, routine_preference")

// Add prop to OnboardingGoals:
<OnboardingGoals
  hairTexture={(profile?.hair_texture as HairTexture) ?? null}
  existingGoals={(profile?.goals as string[]) ?? []}
  existingDesiredVolume={(profile?.desired_volume as "less" | "balanced" | "more" | null) ?? null}
  existingRoutinePreference={(profile?.routine_preference as string) ?? null}
  userId={user.id}
  hasProfile={!!profile}
/>
```

- [ ] **Step 5: Add routine_preference UI to onboarding-goals.tsx**

In `src/components/onboarding/onboarding-goals.tsx`:

1. Add to `OnboardingGoalsProps` interface:
```typescript
existingRoutinePreference: string | null
```

2. Pass it through to `GoalSelector` and add to the GoalSelector props destructuring.

3. Add state in `GoalSelector`:
```typescript
const [routinePreference, setRoutinePreference] = useState(
  existingRoutinePreference ?? ""
)
```

4. Extend the existing `@/lib/types` import (line 10 already imports `DESIRED_VOLUME_LABELS`):
```typescript
import { DESIRED_VOLUME_LABELS, ROUTINE_PREFERENCE_OPTIONS } from "@/lib/types"
```

5. Add `routine_preference` to the existing `handleSave` Supabase update. **CRITICAL: preserve the existing `onboarding_completed` write to the `profiles` table AND the `router.push("/chat")` redirect that follow.** Only add `routine_preference` to the `hair_profiles` update object:
```typescript
// Add routine_preference to the EXISTING hair_profiles update (do NOT replace handleSave):
const { error: hairProfileError } = await supabase
  .from("hair_profiles")
  .update({
    goals: derivedGoals,
    desired_volume: desiredVolume,
    routine_preference: routinePreference || null, // ← add this line
    updated_at: new Date().toISOString(),
  })
  .eq("user_id", userId)

// The existing onboarding_completed write + router.push("/chat") MUST remain after this
```

6. Add the routine_preference section in the JSX, AFTER the goals section and BEFORE the save button:

```tsx
{/* Routine preference */}
<div className="mb-8 animate-fade-in-up" style={{ animationDelay: "620ms" }}>
  <h2 className="font-header text-2xl leading-tight text-white mb-2">
    Wie detailliert soll deine Routine sein?
  </h2>
  <div className="flex flex-wrap gap-2">
    {ROUTINE_PREFERENCE_OPTIONS.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => setRoutinePreference(option.value)}
        className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
          routinePreference === option.value
            ? "border-[#F5C518] bg-[#F5C518] text-[#1A1618]"
            : "border-white/20 text-white/70 hover:border-white/35 hover:text-white"
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 6: Remove routine_preference from onboarding-routine.tsx**

In `src/components/onboarding/onboarding-routine.tsx`:

1. Remove from `OnboardingRoutineProps` interface: `existingRoutinePreference: string | null`
2. Remove from component destructuring: `existingRoutinePreference`
3. Remove state: `const [routinePreference, setRoutinePreference] = useState(...)`
4. Remove from `handleSave` update object: `routine_preference: routinePreference || null,`
5. Remove the entire Section 5 (`"Wie detailliert soll deine Routine sein?"` block, ~animationDelay: "380ms")
6. Remove unused import: `ROUTINE_PREFERENCE_OPTIONS` from `@/lib/types`

- [ ] **Step 7: Remove routine_preference from routine server component**

In `src/app/onboarding/routine/page.tsx`:

1. Remove `routine_preference` from the select query:
```typescript
// From:
.select("wash_frequency, heat_styling, post_wash_actions, routine_preference, current_routine_products")
// To:
.select("wash_frequency, heat_styling, post_wash_actions, current_routine_products")
```

2. Remove the `existingRoutinePreference` prop:
```typescript
// Delete this line from OnboardingRoutine props:
existingRoutinePreference={(profile.routine_preference as string) ?? null}
```

- [ ] **Step 8: Build and verify**

Run: `npx next build`
Expected: Build succeeds with no type errors.

- [ ] **Step 9: Run tests**

Run: `node --test tests/onboarding-goal-flow.test.ts`
Expected: All tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/lib/vocabulary/onboarding-goals.ts src/components/onboarding/onboarding-goals.tsx src/components/onboarding/onboarding-routine.tsx src/app/onboarding/goals/page.tsx src/app/onboarding/routine/page.tsx tests/onboarding-goal-flow.test.ts
git commit -m "feat(onboarding): remove volume dedup from straight goals, move routine_preference to goals page"
```

---

### Task 3: None-States via answered_fields Metadata

**Context:** Currently there's no way to distinguish "user skipped a field" from "user explicitly chose nothing." The solution is an `answered_fields` metadata column on `hair_profiles`. When a user explicitly clicks "Nichts davon," the field value stays `[]` AND the field name is added to `answered_fields`. Pipeline code: zero changes — `[]` continues to mean "no items."

**Dependencies:** Merge after Task 2 (both modify `onboarding-routine.tsx`).

**Files:**
- Create: `supabase/migrations/20260324120000_add_answered_fields.sql`
- Create: `src/lib/onboarding/answered-fields.ts` (shared helper)
- Modify: `src/components/onboarding/onboarding-mechanical-stress.tsx`
- Modify: `src/components/onboarding/onboarding-routine.tsx`

- [ ] **Step 1: Create Supabase migration**

Create `supabase/migrations/20260324120000_add_answered_fields.sql`:

```sql
ALTER TABLE hair_profiles
ADD COLUMN IF NOT EXISTS answered_fields text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN hair_profiles.answered_fields IS
  'Tracks which fields the user explicitly answered. A field in answered_fields with value [] means "user said none." A field NOT in answered_fields means "user never saw/answered it."';
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push` or apply via Supabase dashboard.
Expected: Migration succeeds, column added.

- [ ] **Step 3: Add "Nichts davon" to mechanical stress component**

In `src/components/onboarding/onboarding-mechanical-stress.tsx`:

1. Add `answeredFields` state tracking:
```typescript
const [answeredFields, setAnsweredFields] = useState<string[]>([])
```

2. In `handleSave`, include `answered_fields` in the update. We merge with existing answered_fields:
```typescript
const supabase = createClient()
const { data: existing } = await supabase
  .from("hair_profiles")
  .select("answered_fields")
  .eq("user_id", userId)
  .single()

const currentAnswered = (existing?.answered_fields as string[]) ?? []
const updatedAnswered = [...new Set([...currentAnswered, "mechanical_stress_factors"])]

const { error } = await supabase
  .from("hair_profiles")
  .update({
    mechanical_stress_factors: [...selected],
    answered_fields: updatedAnswered,
    updated_at: new Date().toISOString(),
  })
  .eq("user_id", userId)
```

3. Add a "Nichts davon regelmaessig" button after the factor options, before the save/skip buttons:

```tsx
<button
  type="button"
  onClick={async () => {
    setSaving(true)
    const supabase = createClient()
    const { data: existing } = await supabase
      .from("hair_profiles")
      .select("answered_fields")
      .eq("user_id", userId)
      .single()

    const currentAnswered = (existing?.answered_fields as string[]) ?? []
    const updatedAnswered = [...new Set([...currentAnswered, "mechanical_stress_factors"])]

    const { error } = await supabase
      .from("hair_profiles")
      .update({
        mechanical_stress_factors: [],
        answered_fields: updatedAnswered,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)

    if (error) {
      toast({ title: "Fehler beim Speichern. Bitte versuche es erneut.", variant: "destructive" })
      setSaving(false)
      return
    }
    router.push("/onboarding/routine")
  }}
  disabled={saving}
  className="animate-fade-in-up mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center text-sm text-white/60 transition-all hover:border-white/25 hover:text-white/80"
  style={{ animationDelay: "360ms" }}
>
  Nichts davon regelmaessig
</button>
```

4. Update `handleSave` to also mark the field as answered (same merge pattern as above).

**Before continuing:** Extract the `answered_fields` merge pattern into a shared helper. Create `src/lib/onboarding/answered-fields.ts`:

```typescript
import { createClient } from "@/lib/supabase/client"

export async function mergeAnsweredFields(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  fieldNames: string[]
): Promise<string[]> {
  const { data } = await supabase
    .from("hair_profiles")
    .select("answered_fields")
    .eq("user_id", userId)
    .single()
  const current = (data?.answered_fields as string[]) ?? []
  return [...new Set([...current, ...fieldNames])]
}
```

Import this helper in both `onboarding-mechanical-stress.tsx` and `onboarding-routine.tsx`. Use it in all save/nichts-davon handlers instead of duplicating the merge logic inline.

Refactor the "Nichts davon" button in Step 3 above to use this helper:
```tsx
onClick={async () => {
  setSaving(true)
  const supabase = createClient()
  const updatedAnswered = await mergeAnsweredFields(supabase, userId, ["mechanical_stress_factors"])

  const { error } = await supabase
    .from("hair_profiles")
    .update({
      mechanical_stress_factors: [],
      answered_fields: updatedAnswered,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
  // ... error handling + router.push
}}
```

Similarly, refactor `handleSave` to use the helper instead of inline merge.

- [ ] **Step 4: Add "Nichts davon" to routine component (post_wash_actions + current_routine_products)**

In `src/components/onboarding/onboarding-routine.tsx`, after the multi-select buttons for each of these sections, add a "Nichts davon regelmaessig" toggle button that:
- Clears the selection set for that field
- Tracks the field as answered via local state

Add local state:
```typescript
const [answeredPostWash, setAnsweredPostWash] = useState(false)
const [answeredProducts, setAnsweredProducts] = useState(false)
```

For each multi-select section (post_wash_actions at ~delay 320ms, current_routine_products at ~delay 200ms), add after the chip buttons:

```tsx
<button
  type="button"
  onClick={() => {
    setSelectedPostWashActions(new Set())  // or setSelectedRoutineProducts
    setAnsweredPostWash(true)  // or setAnsweredProducts
  }}
  className={`mt-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
    answeredPostWash && selectedPostWashActions.size === 0
      ? "border-[#F5C518] bg-[#F5C518] text-[#1A1618]"
      : "border-white/20 text-white/70 hover:border-white/35 hover:text-white"
  }`}
>
  Nichts davon regelmaessig
</button>
```

When the user selects an actual option, clear the "none" flag:
```typescript
function toggleSetValue(
  setState: (updater: (prev: Set<string>) => Set<string>) => void,
  key: string,
  clearNoneFlag?: () => void
) {
  setState((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  clearNoneFlag?.()
}
```

In `handleSave`, build the answered_fields list and include it in the update:

```typescript
const fieldsAnswered: string[] = []
if (answeredPostWash || selectedPostWashActions.size > 0) fieldsAnswered.push("post_wash_actions")
if (answeredProducts || selectedRoutineProducts.size > 0) fieldsAnswered.push("current_routine_products")

// Merge with existing answered_fields
const merged = await mergeAnsweredFields(supabase, userId, fieldsAnswered)

const { error } = await supabase
  .from("hair_profiles")
  .update({
    wash_frequency: washFrequency,
    heat_styling: heatStyling || null,
    post_wash_actions: [...selectedPostWashActions],
    current_routine_products: [...selectedRoutineProducts],
    answered_fields: merged,
    updated_at: new Date().toISOString(),
  })
  .eq("user_id", userId)
```

The `mergeAnsweredFields` helper already accepts `string[]` — pass the array directly.

- [ ] **Step 5: Build and verify**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260324120000_add_answered_fields.sql src/lib/onboarding/answered-fields.ts src/components/onboarding/onboarding-mechanical-stress.tsx src/components/onboarding/onboarding-routine.tsx
git commit -m "feat(onboarding): add answered_fields metadata column and Nichts-davon buttons"
```

---

### Task 4: Quiz Resequencing

**Context:** Reorder quiz questions from texture-first to chemical-first. New order: chemical → scalp → texture → thickness → surface → pull. This means changing `STEP_ORDER`, question numbers, progress bars, motivation texts, and the brand panel number derivation.

**Key insight:** Step NUMBERS (2, 3, 4, 5, 6, 7) stay the same — they identify which component renders. Only the ORDER changes, plus the displayed question numbers.

**No changes needed (confirmed):**
- `src/lib/quiz/types.ts` — `QuizStep` is a union of literals, does not encode order
- `src/components/quiz/quiz-question.tsx` `ANSWER_KEY_MAP` — maps step numbers to answer keys; step numbers are unchanged, only order changes
- Scalp navigation logic (`goNext`/`goBack` in `quiz-scalp-question.tsx`) — already uses store's `goNext()` which follows `STEP_ORDER`, so resequencing is automatic

**Files:**
- Modify: `src/lib/quiz/store.ts:25` (STEP_ORDER)
- Modify: `src/lib/quiz/questions.ts` (questionNumber + motivation for each question)
- Modify: `src/components/quiz/quiz-scalp-question.tsx:168-170` (progress bar + counter)
- Modify: `src/components/quiz/quiz-brand-panel.tsx:9` (question number derivation)

- [ ] **Step 1: Update STEP_ORDER in store.ts**

In `src/lib/quiz/store.ts`, change:

```typescript
// Old:
const STEP_ORDER: QuizStep[] = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 14]

// New (chemical first, then scalp, then texture/thickness/surface/pull):
const STEP_ORDER: QuizStep[] = [1, 7, 6, 2, 3, 4, 5, 9, 10, 11, 14]
```

- [ ] **Step 2: Update questionNumber in questions.ts**

In `src/lib/quiz/questions.ts`, update the `questionNumber` field for each question to reflect the new order:

| Step | Question | Old questionNumber | New questionNumber |
|------|----------|-------------------|-------------------|
| 7 | chemical_treatment | 6 | 1 |
| 2 | hair_texture | 1 | 3 |
| 3 | hair_thickness | 2 | 4 |
| 4 | surface_test | 3 | 5 |
| 5 | pull_test | 4 | 6 |

(Step 6 / scalp is handled separately in quiz-scalp-question.tsx → becomes Q2)

Also update motivation texts to match new position in flow:

| Step | New Q# | New motivation |
|------|--------|----------------|
| 7 | Q1 | `"Super, du bist gerade erst gestartet. Noch 5 kurze Fragen."` |
| 2 | Q3 | `"Klasse – du hilfst TomBot, deine Haare richtig einzuschaetzen."` |
| 3 | Q4 | `"Top, schon ein gutes Stueck geschafft."` |
| 4 | Q5 | `"Fast geschafft – noch ein letzter Test."` |
| 5 | Q6 | `"Letzte Frage – gleich siehst du dein Profil."` |

- [ ] **Step 3: Update scalp question progress in quiz-scalp-question.tsx**

In `src/components/quiz/quiz-scalp-question.tsx`, find the hardcoded progress values (around line 168):

```tsx
// Old:
<QuizProgressBar current={5} total={6} />
// ...
<span className="text-sm text-white/38 tabular-nums">5/6</span>

// New (scalp is now Q2):
<QuizProgressBar current={2} total={6} />
// ...
<span className="text-sm text-white/38 tabular-nums">2/6</span>
```

Also update the scalp motivation text:
```
// Old:
"Nur noch 1 Frage — du machst das super."
// New:
"Top, die Kopfhaut-Frage ist geschafft."
```

- [ ] **Step 4: Update brand panel question number derivation**

In `src/components/quiz/quiz-brand-panel.tsx`, the current formula is:
```typescript
const questionNumber = step >= 2 && step <= 7 ? step - 1 : null
```

This breaks with the new order. Replace with an explicit map:

```typescript
const QUESTION_NUMBER_MAP: Record<number, number> = {
  7: 1,  // chemical
  6: 2,  // scalp
  2: 3,  // texture
  3: 4,  // thickness
  4: 5,  // surface
  5: 6,  // pull
}
const questionNumber = QUESTION_NUMBER_MAP[step] ?? null
```

- [ ] **Step 5: Build and verify**

Run: `npx next build`
Expected: Build succeeds.

- [ ] **Step 6: Manual smoke test**

Open the quiz in browser. Verify:
1. Landing → Chemical treatment (Q1) → Scalp type (Q2) → [if yes: scalp condition] → Texture (Q3) → Thickness (Q4) → Surface (Q5) → Pull (Q6) → Lead capture → Analysis → Results → Welcome
2. Brand panel shows correct "FRAGE N VON 6" for each step
3. Progress bars advance correctly
4. Back button navigates to the correct previous step
5. Scalp "Nein" skips to texture (step 2), "Ja" shows condition then texture

- [ ] **Step 7: Commit**

```bash
git add src/lib/quiz/store.ts src/lib/quiz/questions.ts src/components/quiz/quiz-scalp-question.tsx src/components/quiz/quiz-brand-panel.tsx
git commit -m "feat(quiz): resequence to chemical-first order for higher confidence opening"
```

---

## Dependency Graph

```
Task 0 (PostHog)  ──┐
Task 1 (Copy)     ──┤── all independent, can run in parallel
Task 4 (Resequence)──┘
Task 2 (Refactors) ─── then ─── Task 3 (None-states)
```

Tasks 0, 1, 2, and 4 can all start simultaneously. Task 3 starts after Task 2 merges (shared file: `onboarding-routine.tsx`).

## Verification Checklist (after all tasks merged)

- [ ] `npx next build` succeeds
- [ ] `node --test tests/onboarding-goal-flow.test.ts` passes
- [ ] Quiz flow: chemical → scalp → texture → thickness → surface → pull (correct order)
- [ ] Brand panel: FRAGE 1–6 VON 6 labels match step
- [ ] Progress bars: correct on all quiz steps including scalp
- [ ] Goals page: shows routine_preference section, saves correctly
- [ ] Routine page: no routine_preference section
- [ ] Mechanical stress: "Nichts davon regelmaessig" saves `[]` + marks `answered_fields`
- [ ] Routine page: "Nichts davon" buttons for post_wash_actions and current_routine_products work
- [ ] PostHog: `quiz_step_viewed` events include `step_name`
- [ ] Thickness question shows clarifier text
- [ ] Surface/pull tests labeled as "Mini-Haarcheck 1/2 von 2"
