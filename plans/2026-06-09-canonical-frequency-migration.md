# Canonical Frequency Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy product and wash frequency values with one canonical average-use frequency model, make shampoo product usage the source of truth for wash cadence, and prepare a follow-up migration to remove the deprecated `hair_profiles.wash_frequency` column.

**Architecture:** `user_product_usage.frequency_range` becomes the canonical cadence storage for all product usage. Shampoo cadence is represented by the `user_product_usage` row with `category = 'shampoo'`; existing runtime names such as `wash_frequency` / `washFrequency` may remain during phase 1, but their value must be sourced only from shampoo product usage. `hair_profiles.wash_frequency` remains only as phase-1 migrated legacy data for rollback/audit and is not read or written by application code. A second phase drops `hair_profiles.wash_frequency` after the new path has shipped.

**Tech Stack:** Next.js/React, TypeScript, Zustand onboarding store, Supabase SQL migrations, Node test runner via `tsx --test`, Zod validators.

---

## Decisions Locked For This Plan

- Use a hard canonical cutover for application code: no legacy frequency literals in TypeScript after implementation.
- Use one shared canonical frequency enum:

| Value | German Label | minPerWeek | maxPerWeek | midpointPerWeek | comparable |
| --- | --- | ---: | ---: | ---: | --- |
| `less_than_monthly` | `Seltener als 1x/Monat` | `0` | `0.249` | `0.125` | `true` |
| `monthly_1x` | `Ca. 1x/Monat` | `0.25` | `0.25` | `0.25` | `true` |
| `biweekly_1x` | `Ca. alle 2 Wochen` | `0.5` | `0.5` | `0.5` | `true` |
| `weekly_1x` | `1x/Woche` | `1` | `1` | `1` | `true` |
| `weekly_2x` | `2x/Woche` | `2` | `2` | `2` | `true` |
| `weekly_3_4x` | `3-4x/Woche` | `3` | `4` | `3.5` | `true` |
| `weekly_5_6x` | `5-6x/Woche` | `5` | `6` | `5.5` | `true` |
| `daily_1x` | `Täglich` | `7` | `7` | `7` | `true` |

- Product usage legacy mapping:

| Old `user_product_usage.frequency_range` | New value |
| --- | --- |
| `rarely` | `less_than_monthly` |
| `1_2x` | `weekly_1x` |
| `3_4x` | `weekly_3_4x` |
| `5_6x` | `weekly_5_6x` |
| `daily` | `daily_1x` |

- Deprecated wash-frequency legacy mapping:

| Old `hair_profiles.wash_frequency` | New value |
| --- | --- |
| `rarely` | `less_than_monthly` |
| `once_weekly` | `weekly_1x` |
| `every_2_3_days` | `weekly_3_4x` |
| `daily` | `daily_1x` |

- Existing `user_product_usage` shampoo rows with null `frequency_range` are broken/incomplete cadence data. Surface their count in the preflight audit, then repair them from mapped legacy `hair_profiles.wash_frequency` when available; only use `less_than_monthly` when no legacy cadence source exists.
- Backfill missing shampoo rows as follows:
  - Existing shampoo row wins.
  - If no shampoo row exists and mapped legacy `hair_profiles.wash_frequency` exists, insert a shampoo row from that mapped frequency.
  - If no shampoo row exists, no legacy wash frequency exists, and the user has any product usage row, insert a synthetic shampoo row with `product_name = '__system_no_shampoo_selected__'` and `frequency_range = 'less_than_monthly'`.
  - If no product usage rows and no legacy wash frequency exist, do not invent a row.
- Onboarding behavior:
  - Keep current product checklist and drilldown structure.
  - Do not change German copy except frequency pill labels.
  - If shampoo is deselected, persist a synthetic shampoo row with `product_name = '__system_no_shampoo_selected__'` and `frequency_range = 'less_than_monthly'`.
  - Never delete the shampoo row from product usage save logic.
- Scope excludes scalp-target delta recommendation logic.
- Runtime naming decision: keep compatibility-named `wash_frequency` / `washFrequency` fields for phase 1 where that avoids a broad agent/routine contract rename, but source them exclusively from `user_product_usage(category='shampoo').frequency_range`. Do not read `hair_profiles.wash_frequency` at runtime.
- Rollout decision: phase 1 uses an expand-compatible DB constraint that accepts both legacy and canonical frequency values after rewriting existing rows to canonical. Deploy order is DB migration first, app deploy second, and a later contract migration removes legacy acceptance once old app instances are gone.
- Rollback decision: Supabase migrations are treated as forward migrations. This plan must include an explicit rollback SQL runbook that maps canonical values back to legacy values and explains deploy ordering; it does not rely on an automatic down migration.

---

## Files To Modify

**Vocabulary and shared helpers**
- Modify: `src/lib/vocabulary/frequencies.ts`
- Modify: `src/lib/vocabulary/index.ts`
- Modify: `src/lib/types.ts`

**Database migrations**
- Create: `supabase/migrations/20260609120000_canonical_product_frequencies.sql`
- Follow-up to create after phase 1 is verified: `supabase/migrations/20260609121000_drop_deprecated_wash_frequency.sql`

**Onboarding/profile persistence**
- Modify: `src/components/onboarding/onboarding-flow.tsx`
- Create: `src/lib/onboarding/product-usage-save.ts`
- Modify: `src/lib/onboarding/store.ts` only if legacy frequency type names require import updates
- Modify: `src/app/profile/page.tsx`
- Modify: `src/app/api/profile/route.ts`
- Modify: `src/lib/validators/index.ts`
- Modify: `src/hooks/use-hair-profile.ts`
- Modify: `src/lib/dev/local-login.ts`

**Recommendation and routine context**
- Modify: `src/lib/hair-profile/derived.ts`
- Modify: `src/lib/recommendation-engine/adapters/from-persistence.ts`
- Modify: `src/lib/recommendation-engine/types.ts`
- Modify: `src/lib/recommendation-engine/normalize.ts`
- Modify: `src/lib/recommendation-engine/care-balance/evaluators.ts`
- Modify: `src/lib/recommendation-engine/care-balance/shared.ts`
- Modify: `src/lib/recommendation-engine/categories/shared.ts`
- Modify: `src/lib/recommendation-engine/categories/dry-shampoo.ts`
- Modify: `src/lib/recommendation-engine/assessments/reset.ts`
- Modify: `src/lib/recommendation-engine/planner/intervention.ts`
- Modify: `src/lib/recommendation-engine/runtime.ts`
- Modify: `src/lib/routines/planner.ts`
- Modify: `src/lib/chat-runtime/conversation-state.ts`
- Modify: `src/lib/agent/tools/get-user-context.ts`
- Modify: `src/lib/agent/tools/build-or-fix-routine.ts`
- Modify: `src/lib/agent/tools/care-balance-context.ts`
- Modify: `src/lib/agent-v2/tools/tool-definitions.ts`
- Modify: `src/lib/agent-v2/production/chat-pipeline.ts`
- Modify: `src/lib/agent-v2/compare/run-agent-v2.ts`

**Fixtures, scripts, docs that compile or drive tests**
- Modify tests containing old product frequencies or old wash frequencies under `tests/`
- Modify scripted fixtures under `scripts/` and `src/lib/agent/compare/scenarios.ts`
- Modify eval fixture JSON under `data/agent-v2/evals/`
- Update docs only where they are active source-of-truth inventories, especially `docs/quiz-onboarding-data-collection-inventory.md`

---

## Task 0: Clean Start Checkpoint

**Files:**
- Read only: current git state

- [ ] **Step 1: Inspect current WIP before implementation**

Run:

```bash
git status --short --branch
```

Expected: The worktree may contain WIP from the paused first pass. Review each modified file before editing. Keep changes that match this plan; replace changes that still use the earlier six/seven-stop enum.

- [ ] **Step 2: Confirm no implementation proceeds from stale assumptions**

Run:

```bash
rg -n "as_needed|monthly|every_2_weeks|two_three_weekly|weekly_3_4x|less_than_monthly" src tests supabase
```

Expected: This shows any paused WIP using rejected enum names. During implementation, rejected values such as `as_needed`, `monthly`, `every_2_weeks`, `weekly`, and `two_three_weekly` must be removed unless they are in documentation explaining old WIP.

---

## Task 1: Write Failing Vocabulary Tests

**Files:**
- Create or modify: `tests/product-frequency-vocabulary.test.ts`
- Modify: `src/lib/vocabulary/frequencies.ts`

- [ ] **Step 1: Add canonical option tests**

Use this test body:

```ts
import assert from "node:assert/strict"
import test from "node:test"

import {
  PRODUCT_FREQUENCIES,
  PRODUCT_FREQUENCY_LABELS,
  PRODUCT_FREQUENCY_METADATA,
  PRODUCT_FREQUENCY_OPTIONS,
  compareProductFrequencies,
  isProductFrequencyAtLeast,
} from "../src/lib/vocabulary"

test("product frequencies expose canonical average-use stops in order", () => {
  assert.deepEqual(PRODUCT_FREQUENCIES, [
    "less_than_monthly",
    "monthly_1x",
    "biweekly_1x",
    "weekly_1x",
    "weekly_2x",
    "weekly_3_4x",
    "weekly_5_6x",
    "daily_1x",
  ])
})

test("product frequency labels are German and average-based", () => {
  assert.deepEqual(PRODUCT_FREQUENCY_LABELS, {
    less_than_monthly: "Seltener als 1x/Monat",
    monthly_1x: "Ca. 1x/Monat",
    biweekly_1x: "Ca. alle 2 Wochen",
    weekly_1x: "1x/Woche",
    weekly_2x: "2x/Woche",
    weekly_3_4x: "3-4x/Woche",
    weekly_5_6x: "5-6x/Woche",
    daily_1x: "Täglich",
  })
})

test("product frequency metadata is sortable and comparable", () => {
  assert.deepEqual(PRODUCT_FREQUENCY_METADATA.less_than_monthly, {
    value: "less_than_monthly",
    label: "Seltener als 1x/Monat",
    sortOrder: 0,
    minPerWeek: 0,
    maxPerWeek: 0.249,
    midpointPerWeek: 0.125,
    comparable: true,
  })
  assert.equal(PRODUCT_FREQUENCY_METADATA.weekly_3_4x.midpointPerWeek, 3.5)
  assert.equal(PRODUCT_FREQUENCY_METADATA.daily_1x.midpointPerWeek, 7)
})

test("product frequency options mirror canonical ordered labels", () => {
  assert.deepEqual(PRODUCT_FREQUENCY_OPTIONS, [
    { value: "less_than_monthly", label: "Seltener als 1x/Monat" },
    { value: "monthly_1x", label: "Ca. 1x/Monat" },
    { value: "biweekly_1x", label: "Ca. alle 2 Wochen" },
    { value: "weekly_1x", label: "1x/Woche" },
    { value: "weekly_2x", label: "2x/Woche" },
    { value: "weekly_3_4x", label: "3-4x/Woche" },
    { value: "weekly_5_6x", label: "5-6x/Woche" },
    { value: "daily_1x", label: "Täglich" },
  ])
})

test("product frequency comparison uses metadata order", () => {
  assert.equal(compareProductFrequencies("weekly_1x", "weekly_3_4x"), -1)
  assert.equal(compareProductFrequencies("weekly_3_4x", "weekly_3_4x"), 0)
  assert.equal(compareProductFrequencies("daily_1x", "weekly_5_6x"), 1)
  assert.equal(compareProductFrequencies(null, "weekly_1x"), null)
  assert.equal(isProductFrequencyAtLeast("weekly_3_4x", "weekly_2x"), true)
  assert.equal(isProductFrequencyAtLeast("weekly_1x", "weekly_2x"), false)
})
```

- [ ] **Step 2: Run red test**

Run:

```bash
npx tsx --test tests/product-frequency-vocabulary.test.ts
```

Expected: FAIL because old frequency constants do not match the canonical eight-stop model.

- [ ] **Step 3: Implement canonical frequency vocabulary**

In `src/lib/vocabulary/frequencies.ts`, replace `PRODUCT_FREQUENCIES`, `PRODUCT_FREQUENCY_LABELS`, and product frequency helpers with the new eight-stop model. Every canonical stop is comparable, so do not carry forward non-comparable branches from the earlier `as_needed` design. Export `PRODUCT_FREQUENCY_METADATA`, `compareProductFrequencies`, and `isProductFrequencyAtLeast`. Implement and export `chooseHigherProductFrequency` only if an existing caller still needs it after the adapter update.

- [ ] **Step 4: Export helpers from vocabulary index**

In `src/lib/vocabulary/index.ts`, export the new metadata and helpers:

```ts
export {
  PRODUCT_FREQUENCIES,
  PRODUCT_FREQUENCY_METADATA,
  PRODUCT_FREQUENCY_LABELS,
  PRODUCT_FREQUENCY_OPTIONS,
  getProductFrequencyMetadata,
  compareProductFrequencies,
  isProductFrequencyAtLeast,
} from "./frequencies"
export type {
  ProductFrequency,
  ProductFrequencyMetadata,
  ProductFrequencyComparison,
} from "./frequencies"
```

- [ ] **Step 5: Run green test**

Run:

```bash
npx tsx --test tests/product-frequency-vocabulary.test.ts
```

Expected: PASS.

---

## Task 2: Add Phase-1 Supabase Migration With Audit Guards

**Files:**
- Create: `supabase/migrations/20260609120000_canonical_product_frequencies.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260609120000_canonical_product_frequencies.sql` with this structure:

```sql
-- Canonical product frequency migration.
-- Phase 1 keeps hair_profiles.wash_frequency as migrated legacy data only.

DO $$
DECLARE
  unexpected_values text;
BEGIN
  SELECT string_agg(source || '=' || value || ' (' || count || ')', ', ')
  INTO unexpected_values
  FROM (
    SELECT 'hair_profiles.wash_frequency' AS source, wash_frequency AS value, count(*) AS count
    FROM hair_profiles
    WHERE wash_frequency IS NOT NULL
      AND wash_frequency NOT IN (
        -- legacy or canonical values accepted during phase-1 expand rollout
        'rarely', 'once_weekly', 'every_4_5_days', 'every_2_3_days', 'daily',
        'less_than_monthly', 'monthly_1x', 'biweekly_1x', 'weekly_1x',
        'weekly_2x', 'weekly_3_4x', 'weekly_5_6x', 'daily_1x'
      )
    GROUP BY wash_frequency

    UNION ALL

    SELECT 'user_product_usage.frequency_range' AS source, frequency_range AS value, count(*) AS count
    FROM user_product_usage
    WHERE frequency_range IS NOT NULL
      AND frequency_range NOT IN (
        -- legacy or canonical values accepted during phase-1 expand rollout
        'rarely', '1_2x', '3_4x', '5_6x', 'daily',
        'less_than_monthly', 'monthly_1x', 'biweekly_1x', 'weekly_1x',
        'weekly_2x', 'weekly_3_4x', 'weekly_5_6x', 'daily_1x'
      )
    GROUP BY frequency_range
  ) unexpected;

  IF unexpected_values IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected frequency values before migration: %', unexpected_values;
  END IF;
END $$;

ALTER TABLE user_product_usage
  DROP CONSTRAINT IF EXISTS user_product_usage_frequency_range_check;

ALTER TABLE hair_profiles
  DROP CONSTRAINT IF EXISTS hair_profiles_wash_frequency_check;

UPDATE hair_profiles
SET wash_frequency = CASE wash_frequency
  WHEN 'rarely' THEN 'less_than_monthly'
  WHEN 'once_weekly' THEN 'weekly_1x'
  WHEN 'every_4_5_days' THEN 'weekly_2x'
  WHEN 'every_2_3_days' THEN 'weekly_3_4x'
  WHEN 'daily' THEN 'daily_1x'
  ELSE wash_frequency
END
WHERE wash_frequency IS NOT NULL;

UPDATE user_product_usage
SET frequency_range = CASE frequency_range
  WHEN 'rarely' THEN 'less_than_monthly'
  WHEN '1_2x' THEN 'weekly_1x'
  WHEN '3_4x' THEN 'weekly_3_4x'
  WHEN '5_6x' THEN 'weekly_5_6x'
  WHEN 'daily' THEN 'daily_1x'
  ELSE frequency_range
END
WHERE frequency_range IS NOT NULL;

UPDATE user_product_usage upu
SET frequency_range = COALESCE(hp.wash_frequency, 'less_than_monthly')
FROM hair_profiles hp
WHERE upu.user_id = hp.user_id
  AND upu.category = 'shampoo'
  AND upu.frequency_range IS NULL;

UPDATE user_product_usage
SET frequency_range = 'less_than_monthly'
WHERE category = 'shampoo'
  AND frequency_range IS NULL;

INSERT INTO user_product_usage (user_id, category, product_name, frequency_range)
SELECT hp.user_id, 'shampoo', NULL, hp.wash_frequency
FROM hair_profiles hp
WHERE hp.wash_frequency IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM user_product_usage upu
    WHERE upu.user_id = hp.user_id
      AND upu.category = 'shampoo'
  );

INSERT INTO user_product_usage (user_id, category, product_name, frequency_range)
SELECT product_users.user_id, 'shampoo', '__system_no_shampoo_selected__', 'less_than_monthly'
FROM (
  SELECT DISTINCT user_id
  FROM user_product_usage
) product_users
WHERE NOT EXISTS (
    SELECT 1
    FROM user_product_usage upu
    WHERE upu.user_id = product_users.user_id
      AND upu.category = 'shampoo'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM hair_profiles hp
    WHERE hp.user_id = product_users.user_id
      AND hp.wash_frequency IS NOT NULL
  );

ALTER TABLE user_product_usage
  ADD CONSTRAINT user_product_usage_frequency_range_check
 CHECK (
   frequency_range IS NULL OR frequency_range IN (
      'rarely',
      '1_2x',
      '3_4x',
      '5_6x',
      'daily',
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
  ADD CONSTRAINT hair_profiles_wash_frequency_check
 CHECK (
   wash_frequency IS NULL OR wash_frequency IN (
      'rarely',
      'once_weekly',
      'every_4_5_days',
      'every_2_3_days',
      'daily',
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
```

- [ ] **Step 2: Add manual preflight audit SQL to the implementation notes**

Before applying the migration to any shared database, run:

```sql
SELECT 'hair_profiles.wash_frequency' AS source, wash_frequency AS value, count(*) AS count
FROM hair_profiles
WHERE wash_frequency IS NOT NULL
GROUP BY wash_frequency

UNION ALL

SELECT 'user_product_usage.frequency_range' AS source, frequency_range AS value, count(*) AS count
FROM user_product_usage
WHERE frequency_range IS NOT NULL
GROUP BY frequency_range

UNION ALL

SELECT 'user_product_usage.shampoo_null_frequency' AS source, 'null' AS value, count(*) AS count
FROM user_product_usage
WHERE category = 'shampoo'
  AND frequency_range IS NULL

UNION ALL

SELECT 'users_with_usage_no_shampoo_no_wash_frequency' AS source, 'will_backfill_less_than_monthly' AS value, count(*) AS count
FROM (
  SELECT DISTINCT upu.user_id
  FROM user_product_usage upu
  WHERE NOT EXISTS (
    SELECT 1
    FROM user_product_usage shampoo
    WHERE shampoo.user_id = upu.user_id
      AND shampoo.category = 'shampoo'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM hair_profiles hp
    WHERE hp.user_id = upu.user_id
      AND hp.wash_frequency IS NOT NULL
  )
) candidates
ORDER BY source, value;
```

Expected: Review counts before migration. Unexpected enum values must be resolved by adding explicit mapping or fixing data before applying the migration. Shampoo null frequencies are expected to be repaired by the migration to `less_than_monthly`; if the count is surprising, pause and inspect the rows before applying.

- [ ] **Step 3: Verify migration references current constraint names**

Run:

```bash
rg -n "frequency_range.*CHECK|wash_frequency.*CHECK|frequency_range_check|wash_frequency_check" supabase/migrations
```

Expected: Existing `user_product_usage` inline check in `20260408090000_onboarding_v2.sql` is accounted for by dropping `user_product_usage_frequency_range_check`. `hair_profiles_wash_frequency_check` may not exist yet; `DROP CONSTRAINT IF EXISTS` is intentionally a safe no-op. If a generated local DB uses a different product-usage constraint name, update the migration with the actual constraint name before applying.

- [ ] **Step 4: Document rollback SQL runbook**

Supabase migrations in this repo are forward migrations, so rollback is an explicit operator action. If app code must be rolled back to a legacy build after this migration has been applied, first run this rollback SQL:

```sql
ALTER TABLE user_product_usage
  DROP CONSTRAINT IF EXISTS user_product_usage_frequency_range_check;

ALTER TABLE hair_profiles
  DROP CONSTRAINT IF EXISTS hair_profiles_wash_frequency_check;

UPDATE user_product_usage
SET frequency_range = CASE frequency_range
  WHEN 'less_than_monthly' THEN 'rarely'
  WHEN 'monthly_1x' THEN 'rarely'
  WHEN 'biweekly_1x' THEN 'rarely'
  WHEN 'weekly_1x' THEN '1_2x'
  WHEN 'weekly_2x' THEN '1_2x'
  WHEN 'weekly_3_4x' THEN '3_4x'
  WHEN 'weekly_5_6x' THEN '5_6x'
  WHEN 'daily_1x' THEN 'daily'
  ELSE frequency_range
END
WHERE frequency_range IS NOT NULL;

UPDATE hair_profiles
SET wash_frequency = CASE wash_frequency
  WHEN 'less_than_monthly' THEN 'rarely'
  WHEN 'monthly_1x' THEN 'rarely'
  WHEN 'biweekly_1x' THEN 'rarely'
  WHEN 'weekly_1x' THEN 'once_weekly'
  WHEN 'weekly_2x' THEN 'every_2_3_days'
  WHEN 'weekly_3_4x' THEN 'every_2_3_days'
  WHEN 'weekly_5_6x' THEN 'daily'
  WHEN 'daily_1x' THEN 'daily'
  ELSE wash_frequency
END
WHERE wash_frequency IS NOT NULL;

ALTER TABLE user_product_usage
  ADD CONSTRAINT user_product_usage_frequency_range_check
  CHECK (
    frequency_range IS NULL OR frequency_range IN ('rarely','1_2x','3_4x','5_6x','daily')
  );
```

Expected: legacy app code can read and write product frequencies again. This rollback loses the extra precision from `monthly_1x`, `biweekly_1x`, and `weekly_2x`, which is acceptable only as an emergency rollback tradeoff.

---

## Task 3: Make Shampoo Product Usage The Runtime Source Of Truth

**Files:**
- Modify: `src/lib/hair-profile/derived.ts`
- Modify: `src/lib/recommendation-engine/adapters/from-persistence.ts`
- Modify: `src/lib/recommendation-engine/types.ts`
- Modify: `src/lib/recommendation-engine/normalize.ts`
- Modify: `src/lib/recommendation-engine/runtime.ts`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Write failing derivation tests**

Update `tests/hair-profile-derived.test.ts` so it asserts runtime wash cadence is taken from `user_product_usage` shampoo frequency and no test relies on deprecated `hair_profiles.wash_frequency`.

Use these assertions:

```ts
test("hydrates wash cadence from shampoo product usage", () => {
  const hydrated = hydrateHairProfileForConsumers(makeProfile(), [
    {
      category: "shampoo",
      product_name: "Mildes Shampoo",
      frequency_range: "weekly_3_4x",
    },
  ])

  assert.equal(hydrated?.wash_frequency, "weekly_3_4x")
  assert.deepEqual(hydrated?.current_routine_products, ["shampoo"])
})

test("does not infer shampoo frequency from deprecated profile wash_frequency", () => {
  const hydrated = hydrateHairProfileForConsumers(
    makeProfile({ wash_frequency: "daily_1x" as never }),
    [],
  )

  assert.equal(hydrated?.wash_frequency, null)
})
```

The red failure is expected until `WashFrequency` is made equivalent to the canonical `ProductFrequency` type and derivation ignores the deprecated DB column.

- [ ] **Step 2: Run red tests**

Run:

```bash
npx tsx --test tests/hair-profile-derived.test.ts
```

Expected: FAIL until derived profile shape and source-of-truth logic are updated.

- [ ] **Step 3: Update TypeScript profile shape without broad runtime rename**

In `src/lib/vocabulary/frequencies.ts`, make the phase-1 `WashFrequency` vocabulary an alias of the canonical product frequency vocabulary:

```ts
export const WASH_FREQUENCIES = PRODUCT_FREQUENCIES
export type WashFrequency = ProductFrequency
export const WASH_FREQUENCY_LABELS = PRODUCT_FREQUENCY_LABELS
export const WASH_FREQUENCY_OPTIONS = PRODUCT_FREQUENCY_OPTIONS
```

Keep existing runtime names such as `HairProfile.wash_frequency`, `RawHairProfileInput.wash_frequency`, `NormalizedProfile.washFrequency`, and `RoutineContext.wash_frequency` for this migration. Their value must be the shampoo product frequency, not `hair_profiles.wash_frequency`. This avoids a large agent/routine contract rename while still cutting over the data source.

- [ ] **Step 4: Replace wash-frequency derivation source**

In `src/lib/hair-profile/derived.ts`, replace the old coarse `mapProductFrequencyToWashFrequency` behavior with a direct shampoo product frequency lookup:

```ts
export function deriveWashFrequencyFromRoutineItems(
  routineItems: RoutineInventoryLike[],
  _deprecatedFallback: WashFrequency | null = null,
): ProductFrequency | null {
  return (
    routineItems.find((item) => item.category === "shampoo" && item.frequency_range !== null)
      ?.frequency_range ?? null
  )
}
```

Then hydrate consumers with:

```ts
return {
  ...profile,
  wash_frequency: deriveWashFrequencyFromRoutineItems(routineItems),
  current_routine_products: deriveCurrentRoutineProductsFromRoutineItems(
    routineItems,
    profile.current_routine_products ?? null,
  ),
  products_used: deriveProductsUsedFromRoutineItems(routineItems, profile.products_used),
  desired_volume: deriveDesiredVolumeFromGoals(profile.goals, profile.desired_volume),
}
```

- [ ] **Step 5: Keep recommendation cadence field names but update semantics**

In `src/lib/recommendation-engine/types.ts`, keep these existing field names:

```ts
wash_frequency: WashFrequency | null
washFrequency: WashFrequency | null
```

Because `WashFrequency = ProductFrequency` in phase 1, these fields now carry canonical shampoo cadence values. Add a short comment near `RawHairProfileInput.wash_frequency`, `NormalizedProfile.washFrequency`, and `RoutineContext.wash_frequency`:

```ts
// Phase 1 compatibility name: sourced from user_product_usage(category='shampoo').
```

Keep cadence policy kind names such as `match_wash_frequency` for this ticket unless a local type error forces a narrow rename. Do not read deprecated `hair_profiles.wash_frequency`.

- [ ] **Step 6: Update persistence adapter and normalize**

In `src/lib/recommendation-engine/adapters/from-persistence.ts`, build raw profile input using routine items:

```ts
wash_frequency: deriveWashFrequencyFromRoutineItems(routineItems),
```

Do not read `profile.wash_frequency`.

In `src/lib/recommendation-engine/normalize.ts`, map:

```ts
washFrequency: profile.wash_frequency,
```

In `src/lib/recommendation-engine/runtime.ts`, keep output names stable if required by existing consumers, but ensure the value comes from normalized shampoo-sourced `profile.washFrequency`.

- [ ] **Step 7: Run derivation tests**

Run:

```bash
npx tsx --test tests/hair-profile-derived.test.ts
```

Expected: PASS after profile shape and derivation are updated.

---

## Task 4: Update Onboarding Product Save Logic

**Files:**
- Modify: `src/components/onboarding/onboarding-flow.tsx`
- Create: `src/lib/onboarding/product-usage-save.ts`
- Test: `tests/onboarding-product-usage-save.test.ts`
- Existing E2E coverage: `tests/profile-page-smoke.spec.ts`, `tests/quiz-onboarding-e2e.spec.ts`

- [ ] **Step 1: Extract save payload helper for testability**

Create `src/lib/onboarding/product-usage-save.ts` so Node tests do not import the `"use client"` onboarding component tree:

```ts
import type { ProductFrequency } from "@/lib/vocabulary"

const SHAMPOO_CATEGORY = "shampoo"
const DEFAULT_UNSELECTED_SHAMPOO_FREQUENCY: ProductFrequency = "less_than_monthly"

export function buildProductUsagePayloads(params: {
  selectedCategories: string[]
  drilldowns: Record<string, { productName: string; frequency: ProductFrequency | null }>
}) {
  const categories = new Set(params.selectedCategories)
  categories.add(SHAMPOO_CATEGORY)

  return [...categories].map((category) => {
    const selected = params.selectedCategories.includes(category)
    const drilldown = params.drilldowns[category]

    if (category === SHAMPOO_CATEGORY && !selected) {
      return {
        category,
        product_name: "__system_no_shampoo_selected__",
        frequency_range: DEFAULT_UNSELECTED_SHAMPOO_FREQUENCY,
      }
    }

    return {
      category,
      product_name: drilldown?.productName ?? null,
      frequency_range: drilldown?.frequency ?? null,
    }
  })
}
```

- [ ] **Step 2: Write failing save-helper tests**

Create `tests/onboarding-product-usage-save.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"

import { buildProductUsagePayloads } from "../src/lib/onboarding/product-usage-save"

test("buildProductUsagePayloads adds less-than-monthly shampoo when shampoo is not selected", () => {
  assert.deepEqual(
    buildProductUsagePayloads({
      selectedCategories: ["conditioner"],
      drilldowns: {
        conditioner: { productName: "Soft Conditioner", frequency: "weekly_2x" },
      },
    }),
    [
      {
        category: "conditioner",
        product_name: "Soft Conditioner",
        frequency_range: "weekly_2x",
      },
      {
        category: "shampoo",
        product_name: "__system_no_shampoo_selected__",
        frequency_range: "less_than_monthly",
      },
    ],
  )
})

test("buildProductUsagePayloads preserves selected shampoo frequency", () => {
  assert.deepEqual(
    buildProductUsagePayloads({
      selectedCategories: ["shampoo"],
      drilldowns: {
        shampoo: { productName: "Mildes Shampoo", frequency: "weekly_3_4x" },
      },
    }),
    [
      {
        category: "shampoo",
        product_name: "Mildes Shampoo",
        frequency_range: "weekly_3_4x",
      },
    ],
  )
})
```

- [ ] **Step 3: Run red test**

Run:

```bash
npx tsx --test tests/onboarding-product-usage-save.test.ts
```

Expected: FAIL until helper is exported and wired.

- [ ] **Step 4: Use helper in `saveProductUsage`**

Import `buildProductUsagePayloads` into `src/components/onboarding/onboarding-flow.tsx`.

Replace category iteration with payload iteration:

```ts
const payloads = buildProductUsagePayloads({
  selectedCategories: categories,
  drilldowns,
})

for (const item of payloads) {
  const payload = {
    user_id: userId,
    category: item.category,
    product_name: item.product_name,
    frequency_range: item.frequency_range,
  }
  // existing update/insert logic
}
```

When deleting deselected categories, protect shampoo:

```ts
const toDelete = (existing ?? [])
  .filter((r: Record<string, unknown>) => r.category !== SHAMPOO_CATEGORY)
  .filter((r: Record<string, unknown>) => !categories.includes(r.category as string))
  .map((r: Record<string, unknown>) => r.id as string)
```

- [ ] **Step 5: Remove legacy wash-frequency clearing write**

Delete the `saveHairProfile({ wash_frequency: null })` branch from the shampoo drilldown save case. Shampoo cadence now lives only in `user_product_usage`.

- [ ] **Step 6: Run save-helper tests**

Run:

```bash
npx tsx --test tests/onboarding-product-usage-save.test.ts
```

Expected: PASS.

---

## Task 5: Update Recommendation Thresholds And Cadence Policies

**Files:**
- Modify: `src/lib/recommendation-engine/care-balance/shared.ts`
- Modify: `src/lib/recommendation-engine/categories/shared.ts`
- Modify: `src/lib/recommendation-engine/care-balance/evaluators.ts`
- Modify: `src/lib/recommendation-engine/categories/dry-shampoo.ts`
- Modify: `src/lib/recommendation-engine/assessments/reset.ts`
- Modify: `src/lib/recommendation-engine/planner/intervention.ts`
- Modify: `src/lib/agent/tools/care-balance-context.ts`

- [ ] **Step 1: Update comparison tests**

In `tests/recommendation-engine-care-balance.test.ts`, update comparison assertions:

```ts
test("compareFrequencyBands orders canonical frequency bands", () => {
  assert.equal(compareFrequencyBands("weekly_1x", "weekly_3_4x"), -1)
  assert.equal(compareFrequencyBands("weekly_3_4x", "weekly_3_4x"), 0)
  assert.equal(compareFrequencyBands("daily_1x", "weekly_1x"), 1)
  assert.equal(compareFrequencyBands(null, "weekly_1x"), null)
  assert.equal(compareFrequencyBands("weekly_1x", null), null)
})
```

- [ ] **Step 2: Run red care-balance tests**

Run:

```bash
npx tsx --test tests/recommendation-engine-care-balance.test.ts
```

Expected: FAIL until thresholds and fixtures use canonical values.

- [ ] **Step 3: Replace local rank maps with shared helpers**

Use `compareProductFrequencies` and `isProductFrequencyAtLeast` from `@/lib/vocabulary`. Remove duplicated `PRODUCT_FREQUENCY_RANK` maps.

- [ ] **Step 4: Replace thresholds consistently**

Use these replacements:

| Old product threshold/value | New value |
| --- | --- |
| `rarely` | `less_than_monthly` |
| `1_2x` | `weekly_1x` |
| `3_4x` | `weekly_3_4x` |
| `5_6x` | `weekly_5_6x` |
| `daily` | `daily_1x` |

Use these replacements for old wash-cadence branches such as `reset.ts`:

| Old wash threshold/value | New value |
| --- | --- |
| `rarely` | `less_than_monthly` |
| `once_weekly` | `weekly_1x` |
| `every_2_3_days` | `weekly_3_4x` |
| `daily` | `daily_1x` |

Important behavior replacements:

```ts
isFrequencyAtLeast(frequencyBand, "weekly_3_4x")
isFrequencyAtLeast(frequencyBand, "weekly_5_6x")
item.frequencyBand === "daily_1x"
suggestedBand: "weekly_1x"
cautionAtOrAbove: "weekly_3_4x"
vulnerableCautionAtOrAbove: "weekly_1x"
```

- [ ] **Step 5: Keep wash cadence policy labels stable for phase 1**

Keep existing policy kind names such as `match_wash_frequency` and `baseline_cleansing` for this ticket. Update only the values inside those policies to canonical shampoo-sourced frequencies:

```ts
case "match_wash_frequency":
  return `match_wash_frequency:${row.cadencePolicy.expected}`
case "baseline_cleansing":
  return `baseline_cleansing:${row.cadencePolicy.washFrequency ?? "unknown"}`
```

- [ ] **Step 6: Run care-balance tests**

Run:

```bash
npx tsx --test tests/recommendation-engine-care-balance.test.ts tests/recommendation-engine-care-balance-comparison.test.ts
```

Expected: PASS after fixtures and thresholds are canonical.

---

## Task 6: Update Agent, Routine, Profile, And Tool Contracts

**Files:**
- Modify: `src/lib/agent-v2/tools/tool-definitions.ts`
- Modify: `src/lib/recommendation-engine/contracts.ts`
- Modify: `src/lib/routines/planner.ts`
- Modify: `src/lib/agent/tools/get-user-context.ts`
- Modify: `src/lib/agent/tools/build-or-fix-routine.ts`
- Modify: `src/lib/chat-runtime/conversation-state.ts`
- Modify: `src/lib/suggested-prompts.ts`
- Modify: `src/app/profile/page.tsx`
- Modify: `src/hooks/use-hair-profile.ts`
- Modify: `src/lib/dev/local-login.ts`

- [ ] **Step 1: Stop profile writes to deprecated `hair_profiles.wash_frequency`**

In `src/lib/validators/index.ts`, remove `wash_frequency` from `hairProfileFullSchema` so profile edits cannot write the deprecated DB column.

In `src/app/profile/page.tsx`, remove active profile edit state for `wash_frequency`; profile display should use hydrated/shampoo-sourced cadence if it still shows a wash cadence row.

- [ ] **Step 2: Keep `washFrequency` tool/context names but canonicalize them**

In `src/lib/agent-v2/tools/tool-definitions.ts`, keep `"washFrequency"` in profile override fields for phase 1, but validate it against `PRODUCT_FREQUENCIES` through the aliased `WASH_FREQUENCIES` or directly through `PRODUCT_FREQUENCIES`.

Use:

```ts
const ProductFrequencySchema = z.enum(PRODUCT_FREQUENCIES)
```

- [ ] **Step 3: Update profile context display**

In `src/lib/agent/tools/get-user-context.ts`, display shampoo-sourced cadence from the hydrated compatibility field:

```ts
if (hairProfile?.wash_frequency) {
  lines.push(
    `Shampoo-Rhythmus: ${PRODUCT_FREQUENCY_LABELS[hairProfile.wash_frequency] ?? hairProfile.wash_frequency}`,
  )
}
```

Missing info should refer to shampoo cadence only if no shampoo frequency exists:

```ts
missing.push({ key: "wash_frequency", label: "Shampoo-Rhythmus", blocking: false })
```

Keep the `wash_frequency` key for phase 1 compatibility; its meaning is shampoo cadence.

- [ ] **Step 4: Update routine planner cadence checks**

Replace old wash-frequency checks:

```ts
function hasFrequentWashNeed(washFrequency: ProductFrequency | null): boolean {
  return isProductFrequencyAtLeast(washFrequency, "weekly_3_4x")
}

function hasBetweenWashDays(washFrequency: ProductFrequency | null): boolean {
  return washFrequency !== null && washFrequency !== "daily_1x"
}
```

Use `PRODUCT_FREQUENCY_LABELS` for display.

- [ ] **Step 5: Update incidental runtime/dev references**

Update these direct references called out by Claude:

- `src/lib/chat-runtime/conversation-state.ts`: use hydrated `hairProfile?.wash_frequency`, knowing it is shampoo-sourced; do not add a deprecated DB fallback.
- `src/lib/dev/local-login.ts`: replace old fixture value `every_2_3_days` with `weekly_3_4x`.
- `src/lib/recommendation-engine/runtime.ts`: keep output names stable, but pass the canonical shampoo-sourced `profile.washFrequency`.
- `src/lib/types.ts`: update `RoutineContext.wash_frequency` to the aliased canonical `WashFrequency` and add the phase-1 compatibility comment.

- [ ] **Step 6: Run targeted contract tests**

Run:

```bash
npx tsx --test tests/agent-get-user-context.spec.ts tests/agent-routine-tool.spec.ts tests/routine-planner.spec.ts tests/suggested-prompts.test.ts
```

Expected: Tests fail first if fixtures still use old wash-frequency values, then pass after updates.

---

## Task 7: Update Tests, Fixtures, Scripts, And Active Docs

**Files:**
- Modify all test/script/data files surfaced by the commands below

- [ ] **Step 1: Find all old product frequency literals**

Run:

```bash
rg -n '"rarely"|"1_2x"|"3_4x"|"5_6x"|"daily"' tests scripts src data --glob '!src/lib/vocabulary/frequencies.ts'
```

Expected: Many matches. Only update matches that refer to product frequency. Do not rewrite heat styling or unrelated daily/rarely values.

- [ ] **Step 2: Find all old wash-frequency literals**

Run:

```bash
rg -n '"every_2_3_days"|"once_weekly"|"wash_frequency"|WASH_FREQUENCIES|WashFrequency|washFrequency' src tests scripts data docs
```

Expected: Update active source, tests, and fixtures away from old wash-frequency literal values and away from runtime reads of deprecated `hair_profiles.wash_frequency`. `WASH_FREQUENCIES`, `WashFrequency`, `wash_frequency`, and `washFrequency` may remain only as phase-1 compatibility names that are aliased to or sourced from canonical shampoo product frequency. Docs that describe historical behavior can remain only if clearly historical.

- [ ] **Step 3: Apply fixture mappings**

Use these exact mappings when the literal is product usage:

```text
rarely -> less_than_monthly
1_2x -> weekly_1x
3_4x -> weekly_3_4x
5_6x -> weekly_5_6x
daily -> daily_1x
```

Use these exact mappings when the literal is old wash frequency:

```text
rarely -> less_than_monthly
once_weekly -> weekly_1x
every_2_3_days -> weekly_3_4x
daily -> daily_1x
every_4_5_days -> weekly_2x
```

Do not change `heat_styling: "daily"` or `heat_styling: "rarely"`.

- [ ] **Step 4: Update active onboarding data inventory doc**

In `docs/quiz-onboarding-data-collection-inventory.md`, replace the old `wash_frequency` row with a shampoo product usage row:

```md
| `Wie oft?` on `Dein Shampoo` drilldown | `user_product_usage.frequency_range` for `category='shampoo'` | `Seltener als 1x/Monat`, `Ca. 1x/Monat`, `Ca. alle 2 Wochen`, `1x/Woche`, `2x/Woche`, `3-4x/Woche`, `5-6x/Woche`, `Täglich` | Shampoo product usage is the wash cadence source of truth. If shampoo is deselected in product usage, save `less_than_monthly`. |
```

- [ ] **Step 5: Run broad `.test.ts` node tests**

Run:

```bash
npm run test:node
```

Expected: PASS or a focused list of remaining old literal/type failures to update.

Note: `npm run test:node` only runs `tests/*.test.ts` and `tests/*.test.tsx`; it does not run `.spec.ts` files. The `.spec.ts` coverage in Task 8 remains mandatory.

---

## Task 8: Typecheck And Focused Integration Verification

**Files:**
- No new files unless tests surface missing fixtures

- [ ] **Step 1: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS. Any failures involving `wash_frequency`, `WashFrequency`, old product frequencies, or cadence policy names must be fixed in this migration.

- [ ] **Step 2: Run focused tests for touched systems**

Run:

```bash
npx tsx --test \
  tests/product-frequency-vocabulary.test.ts \
  tests/hair-profile-derived.test.ts \
  tests/onboarding-product-usage-save.test.ts \
  tests/recommendation-engine-care-balance.test.ts \
  tests/recommendation-engine-care-balance-comparison.test.ts \
  tests/recommendation-engine-planner.test.ts \
  tests/recommendation-engine-categories.test.ts \
  tests/agent-get-user-context.spec.ts \
  tests/agent-routine-tool.spec.ts \
  tests/eval-chat-client.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run frontend smoke coverage that touches onboarding/profile**

Run:

```bash
npx playwright test tests/profile-page-smoke.spec.ts tests/quiz-onboarding-e2e.spec.ts --project=chromium
```

Expected: PASS. If Playwright requires environment variables or a running Supabase local stack, record the missing dependency and run the closest available unit/integration tests instead.

- [ ] **Step 4: Final old-literal scan**

Run:

```bash
rg -n '"1_2x"|"3_4x"|"5_6x"|"every_2_3_days"|"once_weekly"|hair_profiles\\.wash_frequency' src tests scripts data
```

Expected: No active app/test/schema references remain except:
- SQL migration guard/mapping code for legacy values.
- Historical docs that explicitly describe old behavior.
- Database column references in phase-1 migration only.
- Prompt/example strings that intentionally preserve legacy memory-key examples, such as `src/lib/chat-runtime/prompts.ts` containing `routine:wash_frequency`.

Then run:

```bash
rg -n 'WASH_FREQUENCIES|WashFrequency|wash_frequency|washFrequency' src tests scripts data
```

Expected: Remaining matches are phase-1 compatibility names sourced from canonical product frequency, not old literal values or deprecated DB reads.

---

## Task 9: Phase-2 Follow-Up Cleanup And Drop-Column Plan

**Files:**
- Create later after phase 1 is deployed and verified: `supabase/migrations/20260609121000_drop_deprecated_wash_frequency.sql`
- Track as follow-up in the implementation summary or a dedicated task issue

- [ ] **Step 1: Remove phase-1 compatibility names from app code**

After phase 1 is deployed and stable, plan a small cleanup that renames or removes compatibility names such as `WashFrequency`, `WASH_FREQUENCIES`, `wash_frequency`, and `washFrequency` where they only exist to bridge the deprecated DB column. The new long-term app language should refer to shampoo cadence or product frequency, sourced from `user_product_usage`.

- [ ] **Step 2: Add follow-up migration after phase 1 is verified**

Use:

```sql
-- Drop deprecated wash_frequency after shampoo usage has become the source of truth.

ALTER TABLE hair_profiles
  DROP CONSTRAINT IF EXISTS hair_profiles_wash_frequency_check;

ALTER TABLE hair_profiles
  DROP COLUMN IF EXISTS wash_frequency;
```

- [ ] **Step 3: Run final schema reference scan before applying phase 2**

Run:

```bash
rg -n "wash_frequency|WashFrequency|WASH_FREQUENCIES" src tests scripts data supabase
```

Expected before applying phase 2:
- No active TypeScript references.
- Only phase-1 and phase-2 migration files may mention `wash_frequency`.

- [ ] **Step 4: Apply phase-2 migration only after phase-1 deployment is stable**

Expected: DB no longer has `hair_profiles.wash_frequency`, and application behavior is unchanged because the app already reads shampoo product usage.

---

## Self-Review

**Spec coverage:** Covers canonical frequency enum, metadata, labels, DB audit/migration, shampoo row invariant, onboarding product save behavior, recommendation thresholds, fixtures/tests, and phase-2 column removal.

**Non-goals:** Does not add scalp-target recommendation delta logic. Does not redesign onboarding copy or layout. Does not introduce a separate wash-frequency UI.

**Ambiguity resolved:** Missing shampoo row is handled only for users with existing product usage or legacy wash frequency. Existing shampoo rows with null frequency are surfaced by preflight audit and repaired from mapped legacy `hair_profiles.wash_frequency` when available, otherwise to `less_than_monthly`. Synthetic deselected-shampoo rows use the reserved `__system_no_shampoo_selected__` marker so they cannot collide with real unnamed shampoo rows. Runtime app does not fall back to deprecated `hair_profiles.wash_frequency`.

**Residual risk:** Phase 1 keeps compatibility names such as `washFrequency` while changing their source to shampoo product usage. This reduces implementation blast radius, but requires strict final scans and tests so no runtime code reads deprecated `hair_profiles.wash_frequency`. Phase 1 intentionally keeps legacy enum values accepted by DB checks during rollout; the follow-up contract migration removes that compatibility.
