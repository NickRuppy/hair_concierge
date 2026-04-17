# Profile Signal Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining review findings in the profile-signal cleanup by enforcing true null semantics for `styling_tools`, removing the last stale save-path coupling, and replacing persisted `current_routine_products` with `user_product_usage` as the only routine inventory source.

**Architecture:** `hair_profiles` keeps only atomic profile answers. `user_product_usage` is the sole persisted routine inventory store, and consumer-facing helpers hydrate `current_routine_products` on read when older code still wants category-level presence. `drying_method` remains a stage-2 drying answer only, while stage-3 heat styling stays owned by `styling_tools`, `heat_styling`, and `uses_heat_protection`.

**Tech Stack:** Next.js App Router, TypeScript, Zustand, Supabase, Playwright, tsx test runner

---

### Task 1: Lock the Remaining Regression Tests

**Files:**
- Modify: `tests/profile-page-smoke.spec.ts`
- Modify: `tests/quiz-onboarding-e2e.spec.ts`
- Modify: `tests/suggested-prompts.test.ts`
- Test: `tests/profile-page-smoke.spec.ts`
- Test: `tests/quiz-onboarding-e2e.spec.ts`
- Test: `tests/suggested-prompts.test.ts`

- [x] **Step 1: Write the failing expectations for the new source-of-truth model**

Update the tests so they assert the behavior we actually want:

```ts
expect(goalsCleanupRow?.current_routine_products).toBeNull()
```

```ts
expect(hairProfile?.current_routine_products).toBeNull()
```

```ts
expect(generateSuggestedPrompts(profileWithRoutineItemsOnly)).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ text: expect.stringContaining("Leave-in") }),
  ]),
)
```

- [x] **Step 2: Run the targeted tests to verify they fail for the right reason**

Run:

```bash
npx playwright test tests/profile-page-smoke.spec.ts
npx playwright test tests/quiz-onboarding-e2e.spec.ts
npx tsx --test tests/suggested-prompts.test.ts
```

Expected:
- profile smoke or onboarding E2E fails because code still persists or expects `current_routine_products`
- suggested prompts fails if it still depends on raw `hair_profiles.current_routine_products`

- [x] **Step 3: Keep the failures narrow**

If any failure is unrelated to the source-of-truth change, fix the test setup first so the remaining red state points only at:
- stale `current_routine_products` persistence
- stale `styling_tools` default/write coupling

### Task 2: Enforce True `styling_tools` Null Semantics

**Files:**
- Modify: `supabase/migrations/20260417130000_profile_signal_cleanup.sql`
- Modify: `src/components/onboarding/onboarding-flow.tsx`
- Modify: `src/lib/onboarding/backward-compat.ts`
- Test: `tests/quiz-onboarding-e2e.spec.ts`

- [x] **Step 1: Update the cleanup migration to drop the lingering `styling_tools` default**

Extend the existing uncommitted migration so it also removes the default and null-blocking behavior from `styling_tools`:

```sql
ALTER TABLE hair_profiles
  ALTER COLUMN styling_tools DROP NOT NULL,
  ALTER COLUMN styling_tools DROP DEFAULT;
```

- [x] **Step 2: Remove the `drying_method -> styling_tools` write coupling**

Change the `drying_method` save path so it only writes the dominant drying route:

```ts
await saveHairProfile({
  drying_method: state.dryingMethod,
})
```

Delete the old reconciler import and helper if nothing else uses it:

```ts
// remove reconcileDiffusor import and dead helper
```

- [x] **Step 3: Verify the heat-tools step stays the only owner of stage-3 tools**

Keep this behavior in the heat-tools save path:

```ts
await saveHairProfile({
  styling_tools: state.selectedHeatTools,
})
```

That preserves:
- `null` when the user has not answered the heat-tools step yet
- `[]` when the user explicitly chooses no heat tools
- `["flat_iron"]` or similar when they explicitly answer with tools

- [ ] **Step 4: Run the onboarding regression that covers single-step edits**

Run:

```bash
npx playwright test tests/quiz-onboarding-e2e.spec.ts
```

Expected:
- editing only `drying_method` no longer rewrites `styling_tools`

### Task 3: Remove `current_routine_products` as Persisted State

**Files:**
- Modify: `supabase/migrations/20260417130000_profile_signal_cleanup.sql`
- Modify: `src/components/onboarding/onboarding-flow.tsx`
- Modify: `src/lib/onboarding/backward-compat.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/validators/index.ts`
- Test: `tests/profile-page-smoke.spec.ts`
- Test: `tests/quiz-onboarding-e2e.spec.ts`

- [x] **Step 1: Drop `current_routine_products` from the cleanup migration**

Add the column removal to the existing uncommitted migration:

```sql
ALTER TABLE hair_profiles
  DROP COLUMN IF EXISTS current_routine_products;
```

Remove any earlier alter statements in that same migration that still mention the column.

- [x] **Step 2: Stop writing the legacy mirror from onboarding**

Delete both write paths that still force the field:

```ts
await saveHairProfile({
  current_routine_products: [],
})
```

and

```ts
await saveHairProfile({
  goals,
  desired_volume: null,
})
```

Keep `saveProductUsage(allProducts)` as the only persisted routine inventory write.

- [x] **Step 3: Remove the obsolete checklist mapper**

Delete `mapProductChecklistToRoutineProducts()` from `src/lib/onboarding/backward-compat.ts` if it is no longer used anywhere after the cleanup.

- [x] **Step 4: Remove the field from the persisted profile schema**

Update the profile contracts so writes and validation no longer expect the DB column:

```ts
// remove current_routine_products from hairProfileFullSchema
```

```ts
// remove current_routine_products from persisted HairProfile source shape if appropriate
```

If a consumer-facing `HairProfile` still needs `current_routine_products`, keep it as a derived runtime property only and make sure no save/update path includes it.

### Task 4: Hydrate Routine Inventory for Consumers From `user_product_usage`

**Files:**
- Modify: `src/hooks/use-hair-profile.ts`
- Modify: `src/lib/hair-profile/derived.ts`
- Modify: `src/lib/recommendation-engine/adapters/from-persistence.ts`
- Modify: `src/lib/routines/planner.ts`
- Modify: `src/lib/suggested-prompts.ts`
- Test: `tests/suggested-prompts.test.ts`
- Test: `tests/routine-planner.spec.ts`

- [x] **Step 1: Update the client hair-profile hook to load and hydrate routine items**

Load both data sources in the hook:

```ts
const [{ data: profile }, { data: routineItems }] = await Promise.all([
  supabase.from("hair_profiles").select("*").eq("user_id", userId).maybeSingle(),
  supabase
    .from("user_product_usage")
    .select("category, product_name, frequency_range")
    .eq("user_id", userId),
])
```

Then hydrate:

```ts
setHairProfile(hydrateHairProfileForConsumers(profile, routineItems ?? []))
```

- [x] **Step 2: Remove the adapter fallback that rebuilds routine items from the deleted column**

Delete `buildRoutineItemsFromCurrentRoutineProducts()` and switch call sites to one of:
- real `user_product_usage` rows
- `[]` when no routine inventory exists

The critical rule is: no live runtime path should synthesize inventory from `hair_profiles.current_routine_products` anymore.

- [x] **Step 3: Keep derived category presence where consumers still need it**

Retain `deriveCurrentRoutineProductsFromRoutineItems()` in `src/lib/hair-profile/derived.ts` so hydrated consumers can still ask:

```ts
(profile.current_routine_products ?? []).includes("conditioner")
```

That keeps prompt/routine logic stable while removing the persisted mirror.

- [x] **Step 4: Run targeted consumer tests**

Run:

```bash
npx tsx --test tests/suggested-prompts.test.ts
npx playwright test tests/routine-planner.spec.ts
```

Expected:
- prompt generation still reacts to routine inventory
- routine planner still sees derived category presence from hydrated routine items

### Task 5: Finish Verification On the Cleanup Branch

**Files:**
- Modify: `plans/2026-04-17-profile-signal-review-fixes.md`
- Test: `tests/profile-page-smoke.spec.ts`
- Test: `tests/quiz-onboarding-e2e.spec.ts`
- Test: `tests/suggested-prompts.test.ts`
- Test: `tests/routine-planner.spec.ts`
- Test: `tests/recommendation-engine-foundation.test.ts`

- [ ] **Step 1: Run the final targeted verification set**

Run:

```bash
npm run typecheck
npx tsx --test tests/recommendation-engine-foundation.test.ts
npx tsx --test tests/suggested-prompts.test.ts
npx playwright test tests/profile-page-smoke.spec.ts
npx playwright test tests/quiz-onboarding-e2e.spec.ts
npx playwright test tests/routine-planner.spec.ts
```

Expected:
- all commands pass

- [x] **Step 2: Mark completed tasks in this plan**

Flip the finished checkbox items in this file from `- [ ]` to `- [x]` so the implementation status is visible in-repo.

- [x] **Step 3: Record any residual follow-up honestly**

If archival docs still mention the removed columns, leave them untouched and call that out in the final summary instead of widening the implementation scope.
