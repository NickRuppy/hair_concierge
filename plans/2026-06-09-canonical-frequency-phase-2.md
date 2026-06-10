# Canonical Frequency Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the canonical product-frequency migration by removing the deprecated wash-frequency app contract and then dropping `hair_profiles.wash_frequency`.

**Architecture:** Shampoo cadence is the only wash-cadence concept and is derived from `user_product_usage.frequency_range` where `category = 'shampoo'`. Phase 2 is intentionally split into two rollout-safe parts: first remove app/runtime references to the deprecated profile field, then apply the destructive database contract migration after the app path is live.

**Tech Stack:** Next.js/React, TypeScript, Supabase SQL migrations, Node test runner via `tsx --test`, Playwright smoke tests.

---

## Decisions Locked

- Long-term app language is shampoo cadence/frequency, not wash frequency.
- TypeScript camelCase fields use `shampooFrequency`.
- Raw or serialized snake_case fields use `shampoo_frequency`.
- Internal policy, trace, missing-info, fixture, and guidance identifiers are renamed too. Do not keep `match_wash_frequency`, `baseline_cleansing.washFrequency`, or `routine:wash_frequency` as active identifiers just for compatibility.
- `user_product_usage.frequency_range` remains the canonical persisted frequency column for all product categories.
- `hair_profiles.wash_frequency` must not be read or written by application code before it is dropped.
- Keep the synthetic no-shampoo row behavior from phase 1: `product_name = '__system_no_shampoo_selected__'` and `frequency_range = 'less_than_monthly'`.
- Do not add scalp-target recommendation delta logic in this phase.
- Use a two-step rollout:
  - Phase 2a: app cleanup and compatibility-name removal while the DB column still exists.
  - Phase 2b: DB contract migration after Phase 2a is deployed/stable.

## Expected End State

- Active `src`, `tests`, `scripts`, and `data` do not use `wash_frequency`, `washFrequency`, `WashFrequency`, `WASH_FREQUENCIES`, `WASH_FREQUENCY_LABELS`, or `WASH_FREQUENCY_OPTIONS`.
- Active policy and trace strings use shampoo naming, for example `match_shampoo_frequency` instead of `match_wash_frequency`.
- Historical migrations may still mention `wash_frequency`.
- Historical docs may mention old quiz/audit behavior only when clearly historical.
- `hair_profiles` no longer has a `wash_frequency` column in production after Phase 2b.
- `user_product_usage_frequency_range_check` accepts canonical product-frequency values only.

## Files To Inspect Or Modify

**Vocabulary**
- Modify: `src/lib/vocabulary/frequencies.ts`
- Modify: `src/lib/vocabulary/index.ts`
- Modify: `tests/product-frequency-vocabulary.test.ts`

**Profile and derived cadence**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/hair-profile/derived.ts`
- Modify: `tests/hair-profile-derived.test.ts`
- Modify: `src/app/profile/page.tsx`
- Modify: `tests/profile-page-smoke.spec.ts`

**Recommendation and routine contracts**
- Modify: `src/lib/recommendation-engine/types.ts`
- Modify: `src/lib/recommendation-engine/normalize.ts`
- Modify: `src/lib/recommendation-engine/runtime.ts`
- Modify: `src/lib/recommendation-engine/adapters/from-persistence.ts`
- Modify: `src/lib/recommendation-engine/care-balance/evaluators.ts`
- Modify: `src/lib/recommendation-engine/care-balance/shared.ts`
- Modify: `src/lib/recommendation-engine/categories/shared.ts`
- Modify: `src/lib/recommendation-engine/assessments/reset.ts`
- Modify: `src/lib/recommendation-engine/planner/intervention.ts`
- Modify: `src/lib/routines/planner.ts`
- Modify related tests under `tests/recommendation-engine-*.test.ts`, `tests/routine-planner.spec.ts`, and `tests/routine-signal-consumers.test.ts`

**Agent and chat contracts**
- Modify: `src/lib/agent/tools/get-user-context.ts`
- Modify: `src/lib/agent/tools/build-or-fix-routine.ts`
- Modify: `src/lib/agent/tools/care-balance-context.ts`
- Modify: `src/lib/agent-v2/tools/tool-definitions.ts`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Modify: `src/lib/agent-v2/production/chat-pipeline.ts`
- Modify: `src/lib/agent-v2/compare/run-agent-v2.ts`
- Modify: `src/lib/chat-runtime/conversation-state.ts`
- Inspect: `src/lib/chat-runtime/prompts.ts`
- Modify related tests under `tests/agent-*.spec.ts`, `tests/agent-v2-*.spec.ts`, `tests/chat-debug-trace.spec.ts`, and `tests/conversation-state.spec.ts`

**Fixtures, scripts, data, docs**
- Modify: `src/lib/agent/compare/scenarios.ts`
- Modify: `src/lib/dev/local-login.ts`
- Modify: `scripts/agent-v2/run-guidance-regression.ts`
- Modify: `scripts/eval-chat/fixtures.ts`
- Modify: `scripts/eval-chat/types.ts`
- Modify: `data/agent-v2/evals/guidance-migration-regression.json`
- Modify: `data/agent-guidance/playbooks/usage-and-application.md`
- Modify: `data/agent-guidance/topics/dry-shampoo/core-fit.md`
- Modify: `docs/quiz-onboarding-data-collection-inventory.md`

**Database**
- Create after Phase 2a is deployed/stable: `supabase/migrations/<timestamp>_drop_deprecated_wash_frequency.sql`

---

## Task 0: Fresh Branch And Baseline

- [ ] **Step 1: Start from fresh main in a repo-local worktree**

Run:

```bash
npm run worktree:new -- canonical-frequency-phase-2
cd .worktrees/canonical-frequency-phase-2
```

Expected: New worktree on a branch named like `codex/canonical-frequency-phase-2`, based on `origin/main`.

- [ ] **Step 2: Confirm the phase-1 migration is present**

Run:

```bash
test -f supabase/migrations/20260609120000_canonical_product_frequencies.sql
rg -n "PRODUCT_FREQUENCIES|less_than_monthly|weekly_3_4x|daily_1x" src/lib/vocabulary/frequencies.ts
```

Expected: Both commands pass and show canonical frequency values.

- [ ] **Step 3: Capture current deprecated-reference baseline**

Run:

```bash
rg -n "wash_frequency|washFrequency|WashFrequency|WASH_FREQUENCIES|WASH_FREQUENCY" src tests scripts data docs supabase > /tmp/phase2-wash-frequency-baseline.txt
wc -l /tmp/phase2-wash-frequency-baseline.txt
```

Expected: The count is non-zero before Phase 2a and becomes close to zero after cleanup.

---

## Task 1: Rename Shared Frequency Vocabulary

- [ ] **Step 1: Update vocabulary tests first**

Modify `tests/product-frequency-vocabulary.test.ts` so no active test imports or asserts:

```ts
WASH_FREQUENCIES
WASH_FREQUENCY_LABELS
WASH_FREQUENCY_OPTIONS
WashFrequency
```

Expected replacement: all tests use `PRODUCT_FREQUENCIES`, `PRODUCT_FREQUENCY_LABELS`, `PRODUCT_FREQUENCY_OPTIONS`, and `ProductFrequency`.

- [ ] **Step 2: Run the vocabulary test and confirm the intended failure**

Run:

```bash
npx tsx --test tests/product-frequency-vocabulary.test.ts
```

Expected before implementation: fail only because the exported wash-frequency compatibility names still exist or because tests have not yet been aligned.

- [ ] **Step 3: Remove compatibility aliases**

Modify `src/lib/vocabulary/frequencies.ts`:

```ts
// Delete these exports:
export const WASH_FREQUENCIES = PRODUCT_FREQUENCIES
export type WashFrequency = ProductFrequency
export const WASH_FREQUENCY_LABELS = PRODUCT_FREQUENCY_LABELS
export const WASH_FREQUENCY_OPTIONS = PRODUCT_FREQUENCY_OPTIONS
```

Modify `src/lib/vocabulary/index.ts` so it no longer exports those names.

- [ ] **Step 4: Run the vocabulary test**

Run:

```bash
npx tsx --test tests/product-frequency-vocabulary.test.ts
```

Expected: PASS.

---

## Task 2: Rename Profile And Derived Cadence Contracts

- [ ] **Step 1: Update type tests and derived tests**

Modify `tests/hair-profile-derived.test.ts` to assert `shampoo_frequency` instead of `wash_frequency` on hydrated profile objects.

Use these expected assertions where applicable:

```ts
assert.equal(hydrated?.shampoo_frequency, "weekly_3_4x")
assert.equal(hydrated?.shampoo_frequency, "less_than_monthly")
assert.equal(hydrated?.shampoo_frequency, null)
```

- [ ] **Step 2: Rename profile types**

Modify `src/lib/types.ts`:

```ts
import type { ProductFrequency } from "./vocabulary"

export interface HairProfile {
  // ...
  shampoo_frequency: ProductFrequency | null
  // remove wash_frequency
}

export interface RoutineContext {
  // ...
  shampoo_frequency: ProductFrequency | null
  // remove wash_frequency
}
```

If `HairProfile` is used as the direct persisted `hair_profiles` row type in a path that should not include derived fields, split the type narrowly:

```ts
export interface HydratedHairProfile extends HairProfile {
  shampoo_frequency: ProductFrequency | null
}
```

Use the smallest split needed to keep persisted DB row shape separate from derived app context.

- [ ] **Step 3: Rename derived helpers**

Modify `src/lib/hair-profile/derived.ts`:

```ts
export function deriveShampooFrequencyFromRoutineItems(
  routineItems: RoutineFrequencyLike[],
): ProductFrequency | null {
  return routineItems.reduce<ProductFrequency | null>((highestFrequency, item) => {
    if (item.category !== "shampoo") return highestFrequency
    const frequency = normalizeProductFrequency(item.frequency_range)
    return chooseHigherProductFrequency(highestFrequency, frequency)
  }, null)
}
```

Rename `deriveWashFrequencyFromRoutineItems` callers to `deriveShampooFrequencyFromRoutineItems`.

- [ ] **Step 4: Update profile UI local state**

Modify `src/app/profile/page.tsx` so local profile creation no longer sets:

```ts
wash_frequency: null
```

If the profile page displays cadence, read the hydrated `shampoo_frequency` value and label it as `Shampoo-Rhythmus`.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx tsx --test tests/hair-profile-derived.test.ts
npx playwright test tests/profile-page-smoke.spec.ts
```

Expected: PASS.

---

## Task 3: Rename Recommendation And Routine Contracts

- [ ] **Step 1: Update recommendation input/output tests**

Modify tests so normalized profile assertions use:

```ts
assert.equal(normalized.shampooFrequency, "less_than_monthly")
```

instead of:

```ts
assert.equal(normalized.washFrequency, "less_than_monthly")
```

- [ ] **Step 2: Rename raw and normalized recommendation fields**

Modify `src/lib/recommendation-engine/types.ts`:

```ts
export interface RawHairProfileInput {
  // ...
  shampoo_frequency: ProductFrequency | null
}

export interface NormalizedProfile {
  // ...
  shampooFrequency: ProductFrequency | null
}
```

Modify `src/lib/recommendation-engine/normalize.ts`:

```ts
shampooFrequency: profile.shampoo_frequency,
```

Modify `src/lib/recommendation-engine/runtime.ts`:

```ts
shampoo_frequency: profile.shampooFrequency,
```

Modify `src/lib/recommendation-engine/adapters/from-persistence.ts` so `buildRawHairProfileInput` returns:

```ts
shampoo_frequency: derivedShampooFrequency,
```

- [ ] **Step 3: Rename recommendation logic and policy identifiers**

Replace active `profile.washFrequency` usage with `profile.shampooFrequency` in recommendation and care-balance files.

Rename policy kind strings and trace hints too:

```ts
kind: "match_shampoo_frequency"
usage_hint: "match_shampoo_frequency:after_every_wash"
```

Rename policy payload fields:

```ts
shampooFrequency: profile.shampooFrequency
```

Do not keep `match_wash_frequency` or `washFrequency` as active policy/trace names.

- [ ] **Step 4: Rename routine context fields**

Modify `src/lib/routines/planner.ts` and routine tests so routine context uses:

```ts
shampoo_frequency: profile?.shampoo_frequency ?? null,
```

Use `PRODUCT_FREQUENCY_LABELS` for labels instead of `WASH_FREQUENCY_LABELS`.

- [ ] **Step 5: Run recommendation and routine tests**

Run:

```bash
npx tsx --test tests/recommendation-engine-foundation.test.ts
npx tsx --test tests/recommendation-engine-care-balance.test.ts
npx tsx --test tests/recommendation-engine-categories.test.ts
npx tsx --test tests/recommendation-engine-planner.test.ts
npx tsx --test tests/routine-planner.spec.ts
npx tsx --test tests/routine-signal-consumers.test.ts
```

Expected: PASS.

---

## Task 4: Rename Agent, Chat, Fixtures, And Guidance

- [ ] **Step 1: Rename agent context shape**

Modify `src/lib/agent/tools/get-user-context.ts` so missing-info and context display use:

```ts
key: "shampoo_frequency"
label: "Shampoo-Rhythmus"
```

Modify `src/lib/agent/tools/build-or-fix-routine.ts` so expected type is:

```ts
expected_type: "ProductFrequency"
```

and context access uses `context.shampoo_frequency`.

- [ ] **Step 2: Rename Agent V2 tool schema**

Modify `src/lib/agent-v2/tools/tool-definitions.ts` so tool input uses:

```ts
shampooFrequency: PRODUCT_FREQUENCIES
```

Remove imports of `WASH_FREQUENCIES`.

- [ ] **Step 3: Update Agent V2 runtime/profile serialization**

Modify `src/lib/agent-v2/runtime/responses-agent.ts`, `src/lib/agent-v2/production/chat-pipeline.ts`, and `src/lib/agent-v2/compare/run-agent-v2.ts` so serialized profile objects use `shampoo_frequency` and normalized objects use `shampooFrequency`.

- [ ] **Step 4: Update fixtures, guidance, and stable memory examples**

Replace active fixture keys:

```json
"wash_frequency": "weekly_3_4x"
```

with:

```json
"shampoo_frequency": "weekly_3_4x"
```

In guidance markdown, replace machine-token wording like:

```md
`wash_frequency=weekly_3_4x`
```

with:

```md
`shampoo_frequency=weekly_3_4x`
```

Keep German user-facing wording as `Shampoo-Rhythmus`.

Modify `src/lib/chat-runtime/prompts.ts` so memory-key examples use:

```md
"routine:shampoo_frequency"
```

instead of:

```md
"routine:wash_frequency"
```

- [ ] **Step 5: Run agent and chat tests**

Run:

```bash
npx tsx --test tests/agent-get-user-context.spec.ts
npx tsx --test tests/agent-routine-tool.spec.ts
npx tsx --test tests/agent-v2-current-care-context.spec.ts
npx tsx --test tests/agent-v2-production-chat-pipeline.spec.ts
npx tsx --test tests/agent-v2-responses-runtime.spec.ts
npx tsx --test tests/conversation-state.spec.ts
npx tsx --test tests/chat-debug-trace.spec.ts
```

Expected: PASS.

---

## Task 5: Phase 2a Verification And Deploy Handoff

- [ ] **Step 1: Run final app reference scan**

Run:

```bash
rg -n "wash_frequency|washFrequency|WashFrequency|WASH_FREQUENCIES|WASH_FREQUENCY" src tests scripts data
```

Expected: No active matches. If matches remain, each must be either removed or explicitly justified as historical-only outside active runtime paths.

- [ ] **Step 2: Run final policy/trace scan**

Run:

```bash
rg -n "match_wash_frequency|baseline_cleansing.*washFrequency|routine:wash_frequency" src tests scripts data docs
```

Expected: No active matches. Replace remaining active policy/trace identifiers with shampoo naming.

- [ ] **Step 3: Run broader checks**

Run:

```bash
npm run typecheck
npm run test:node
```

Expected: PASS.

- [ ] **Step 4: Run onboarding/profile smoke**

Run:

```bash
npm run dev:worktree
```

In another terminal, run:

```bash
npx playwright test tests/quiz-onboarding-e2e.spec.ts tests/profile-page-smoke.spec.ts
```

Expected: PASS. Product frequency pills show the canonical German labels, and no profile write attempts `hair_profiles.wash_frequency`.

- [ ] **Step 5: Merge/deploy Phase 2a before DB drop**

Expected: Production app is running with `shampoo_frequency`/`shampooFrequency` contracts and no active dependency on `hair_profiles.wash_frequency`.

---

## Task 6: Phase 2b Database Contract Migration

- [ ] **Step 1: Create the migration only after Phase 2a is live**

Create `supabase/migrations/<timestamp>_drop_deprecated_wash_frequency.sql`:

```sql
-- Drop deprecated wash_frequency after shampoo usage has become the source of truth.

DO $$
DECLARE
  legacy_usage_count integer;
BEGIN
  SELECT count(*)
  INTO legacy_usage_count
  FROM user_product_usage
  WHERE frequency_range IS NOT NULL
    AND frequency_range NOT IN (
      'less_than_monthly',
      'monthly_1x',
      'biweekly_1x',
      'weekly_1x',
      'weekly_2x',
      'weekly_3_4x',
      'weekly_5_6x',
      'daily_1x'
    );

  IF legacy_usage_count > 0 THEN
    RAISE EXCEPTION 'Cannot contract user_product_usage.frequency_range: % non-canonical rows remain', legacy_usage_count;
  END IF;
END $$;

ALTER TABLE user_product_usage
  DROP CONSTRAINT IF EXISTS user_product_usage_frequency_range_check;

ALTER TABLE user_product_usage
  ADD CONSTRAINT user_product_usage_frequency_range_check
  CHECK (
    frequency_range IS NULL
    OR frequency_range IN (
      'less_than_monthly',
      'monthly_1x',
      'biweekly_1x',
      'weekly_1x',
      'weekly_2x',
      'weekly_3_4x',
      'weekly_5_6x',
      'daily_1x'
    )
  );

ALTER TABLE hair_profiles
  DROP CONSTRAINT IF EXISTS hair_profiles_wash_frequency_check;

ALTER TABLE hair_profiles
  DROP COLUMN IF EXISTS wash_frequency;
```

- [ ] **Step 2: Run DB preflight in production**

Run with the working Supabase CLI/project connection:

```bash
supabase db execute --project-ref pqdkhefxsxkyeqelqegq --sql "
select frequency_range, count(*)
from user_product_usage
where frequency_range is not null
group by frequency_range
order by frequency_range;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'hair_profiles'
  and column_name = 'wash_frequency';
"
```

Expected: Only canonical `frequency_range` values appear; the `wash_frequency` column still exists before migration.

- [ ] **Step 3: Apply migration**

Run:

```bash
supabase db push --project-ref pqdkhefxsxkyeqelqegq
```

Expected: Migration applies successfully.

- [ ] **Step 4: Verify production schema**

Run:

```bash
supabase db execute --project-ref pqdkhefxsxkyeqelqegq --sql "
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'hair_profiles'
  and column_name = 'wash_frequency';

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.user_product_usage'::regclass
  and conname = 'user_product_usage_frequency_range_check';
"
```

Expected: No `wash_frequency` column row is returned; the frequency constraint contains canonical values only.

---

## Task 7: Final Verification And Shipping

- [ ] **Step 1: Run final scans**

Run:

```bash
rg -n "wash_frequency|washFrequency|WashFrequency|WASH_FREQUENCIES|WASH_FREQUENCY" src tests scripts data
rg -n "hair_profiles\\.wash_frequency" src tests scripts data docs
rg -n "match_wash_frequency|routine:wash_frequency" src tests scripts data docs
```

Expected: No active app/test/script/data references. Historical docs may remain only if clearly historical.

- [ ] **Step 2: Run final test suite**

Run:

```bash
npm run typecheck
npm run test:node
npx playwright test tests/quiz-onboarding-e2e.spec.ts tests/profile-page-smoke.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Request final code review**

Use `superpowers:requesting-code-review` and the repo's Claude review flow before merging.

Expected: No blocking findings. Any findings are either fixed or explicitly accepted with rationale.

## Self-Review

- Spec coverage: The plan removes compatibility names, keeps shampoo product usage as source of truth, excludes scalp-target logic, and includes the DB drop/constraint contraction.
- Placeholder scan: No task contains `TBD`, `TODO`, or vague implementation-only instructions without concrete commands or expected outcomes.
- Type consistency: `shampoo_frequency` is used for raw/serialized snake_case data; `shampooFrequency` is used for normalized TypeScript objects.
- Rollout risk: The destructive DB migration is intentionally delayed until after the app cleanup is deployed.
