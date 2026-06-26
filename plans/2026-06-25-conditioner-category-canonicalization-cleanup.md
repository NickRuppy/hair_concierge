# Conditioner Category Canonicalization Cleanup Plan

> **For agentic workers:** This is a narrow product-category cleanup plan. Implement from a repo-local worktree and stop before staging, committing, pushing, PR creation, or applying migrations unless the user explicitly approves those actions.

## Implementation Goal Contract

Goal: Clean up the legacy `Conditioner (Drogerie)` category so active internal state uses canonical category key `conditioner`, active display text uses `Conditioner`, and the old string exists only as a compatibility alias at input/source boundaries.

Constraints:

- Keep existing product-intake UX, chat behavior, onboarding flow, recommendation behavior, and product status behavior unchanged except for category identity/label cleanup.
- Do not remove compatibility for old data, old snapshots, stale user/session payloads, or source imports that still say `Conditioner (Drogerie)`.
- Prefer `products.category_key`, `product_categories.key`, `product_submissions.category`, and `user_product_usage.category` for runtime behavior.
- Keep `products.category` as a legacy human-readable compatibility field during this PR; update its active conditioner value to `Conditioner`.
- Do not apply Supabase migrations without explicit approval.

Non-goals:

- Do not drop `products.category` or `products.brand`.
- Do not introduce a broad category registry refactor.
- Do not rewrite historical docs, old audit reports, old generated snapshots, or already-applied migrations purely to erase historical references.
- Do not introduce a new market/channel taxonomy for Drogerie in this PR.
- Do not change recommendation rules, product ranking, intake matching policy, or approval status semantics.

Done when:

- Current user-facing helpers do not emit `Conditioner (Drogerie)`.
- Active DB display/data migrations will move `conditioner` category display and active `products.category` rows to `Conditioner` once applied.
- `Conditioner (Drogerie)` still normalizes to `conditioner`.
- Current docs state that `Conditioner (Drogerie)` is a legacy/source alias only.
- Focused tests and typecheck pass.

## Chosen Direction

Fully migrate the active model while retaining the old label as a compatibility alias.

| Concept | Target |
| --- | --- |
| Internal key | `conditioner` |
| User-facing label | `Conditioner` |
| Active DB category display | `Conditioner` |
| Active `products.category` compatibility text | `Conditioner` |
| Legacy accepted alias | `Conditioner (Drogerie)` |

Why: `Conditioner (Drogerie)` mixes product category with market/channel. Category should describe product use; channel should be separate metadata if needed later. Keeping the old string as an alias is defensive input handling, not keeping the old model alive.

## Review Status

Claude plan review completed: `plans/2026-06-25-conditioner-category-canonicalization-cleanup.claude-review.md`.

Accepted findings folded into this revision:

- Cut the broad category registry refactor. It was larger than the goal and risked changing unrelated category display behavior.
- Do not replace the local `product-display-model.ts` display map in this PR. It intentionally renders some compact labels such as `Öl` and `Tiefenreinigung`; swapping to shared display labels would regress existing tests.
- Do not hand-edit generated catalog snapshot/normalization data before the DB migration is applied and a re-export is run.
- Keep `CONDITIONER_DB_CATEGORIES` compatibility behavior unless an implementation-time caller audit proves a smaller change is needed.
- Make clear that active DB state is clean only after the migration is applied.

Deferred findings:

- A future category-display consolidation may still be worthwhile, but only if it preserves current per-surface labels and has its own tests.

Rejected findings:

- Claude framed the defensive profile/hair-profile legacy-input tests as non-load-bearing because the DB currently constrains `user_product_usage.category` to keys. That is true for live DB writes, but the code may still receive stale local/test/session data. Defensive normalization is acceptable if already touched, but it is not required for this cleanup plan.

## Source Context

Relevant current state:

- `src/lib/product-identity/index.ts` owns category keys and aliases. `PRODUCT_CATEGORY_DISPLAY_LABELS.conditioner` must be `Conditioner`, while `normalizeCategoryKey("Conditioner (Drogerie)")` must keep returning `conditioner`.
- `src/components/chat/product-intake-card.tsx` renders `PRODUCT_CATEGORY_DISPLAY_LABELS`, so the shared display label is the key user-facing leak.
- `src/components/chat/product-display-model.ts` already maps legacy conditioner category text to `Conditioner` and has existing tests for that behavior.
- `src/lib/onboarding/product-options.ts` already displays `conditioner` as `Conditioner`.
- `src/components/chat/product-card.tsx` already maps `conditioner-drogerie` to the conditioner icon.
- `supabase/migrations/20260612120000_product_identity_normalization.sql` historically seeded `product_categories.display_name_de` for `conditioner` as `Conditioner (Drogerie)`.
- Production/current active `products.category` rows may still contain `Conditioner (Drogerie)` even though `products.category_key` is the canonical runtime key.

## Target File Map

### Product Identity And User-Facing Label

- Modify: `src/lib/product-identity/index.ts`
  - Ensure `PRODUCT_CATEGORY_DISPLAY_LABELS.conditioner` is `Conditioner`.
  - Keep `Conditioner (Drogerie)` and `Conditioner Profi` as aliases for `conditioner`.
  - Keep `Conditioner` as both display label and accepted alias.
  - Do not introduce a broad registry refactor in this PR.

### Database

- Create: `supabase/migrations/<timestamp>_conditioner_category_label_cleanup.sql`
  - Update `product_categories.display_name_de` where `key = 'conditioner'` to `Conditioner`.
  - Update active legacy `products.category = 'Conditioner (Drogerie)'` rows to `Conditioner`.
  - Do not drop `products.category`.
  - Do not remove `Conditioner (Drogerie)` alias support from app code.

### Current Documentation

- Modify: `docs/product-identity-normalization.md`
  - State the current contract:
    - canonical key is `conditioner`;
    - display label is `Conditioner`;
    - `Conditioner (Drogerie)` is a legacy/source alias only.
  - If the doc includes a current category mapping table, update the preferred active label to `Conditioner`.

### Tests

- Modify: `tests/product-identity-normalize.test.ts`
  - Assert `PRODUCT_CATEGORY_DISPLAY_LABELS.conditioner === "Conditioner"`.
  - Assert `normalizeCategoryKey("Conditioner (Drogerie)") === "conditioner"`.
- Modify or create a migration-focused test.
  - Do not rely on `tests/product-identity-schema.test.ts` unless it is updated to inspect the new migration file; that test currently targets the original identity migration.
  - Assert the new migration updates `product_categories.display_name_de`.
  - Assert the new migration updates `products.category`.
  - Assert the new migration does not drop legacy columns.
- Keep existing `tests/product-display-model.test.ts` assertions intact.

### Optional Defensive Runtime Cleanup

These are acceptable only if they stay small and tests remain focused:

- `src/lib/profile/product-usage-rows.ts`
  - Normalize legacy category text before display/sort if the file is already touched.
- `src/lib/hair-profile/derived.ts`
  - Normalize legacy category text before derived routine context if the file is already touched.

Do not expand the PR into `product-display-model.ts`, `product-card.tsx`, `from-persistence.ts`, or script rewrites unless a failing test or direct caller audit proves they are needed for this conditioner cleanup.

## Generated Data Policy

Do not hand-edit generated files before migration application:

- `data/product-catalog-normalization.json`
- `data/product-catalog-snapshot.json`

Reason: those files represent exported/current DB state. Changing them before the DB migration is applied makes them describe a state that does not exist yet and risks divergence on the next export.

After the migration is approved and applied, re-export/regenerate these files through the existing product identity scripts if the repo process requires updated snapshots.

The JSON schema may be updated only if it is clearly documenting the post-migration active baseline. If doing so, make the legacy alias behavior explicit in docs/tests.

## Implementation Tasks

### 1. Lock Display Label And Alias Contract

- [x] Ensure `PRODUCT_CATEGORY_DISPLAY_LABELS.conditioner` is `Conditioner`.
- [x] Keep `Conditioner (Drogerie)` in category aliases.
- [x] Add/keep focused tests for both display and alias behavior.

Acceptance:

- `normalizeCategoryKey("Conditioner (Drogerie)") === "conditioner"`.
- `PRODUCT_CATEGORY_DISPLAY_LABELS.conditioner === "Conditioner"`.
- Chat/product-intake category select renders `Conditioner`.

### 2. Add Forward Data Migration

- [x] Create the new Supabase migration.
- [x] Update `product_categories.display_name_de` for key `conditioner`.
- [x] Update active `products.category` values from `Conditioner (Drogerie)` to `Conditioner`.
- [x] Keep all legacy columns and compatibility fields.
- [x] Do not apply the migration without explicit approval.

Suggested migration shape:

```sql
UPDATE public.product_categories
SET display_name_de = 'Conditioner',
    updated_at = now()
WHERE key = 'conditioner'
  AND display_name_de IS DISTINCT FROM 'Conditioner';

UPDATE public.products
SET category = 'Conditioner',
    updated_at = now()
WHERE category = 'Conditioner (Drogerie)';
```

Acceptance:

- The migration is forward-only and data-only.
- Re-running the migration is safe.
- Code still accepts `Conditioner (Drogerie)` as an alias after the migration.

### 3. Update Current Product Identity Documentation

- [x] Update `docs/product-identity-normalization.md`.
- [x] Distinguish active category label from legacy alias.
- [x] Avoid rewriting historical audit docs.

Acceptance:

- Future agents can tell that `Conditioner (Drogerie)` is not the preferred active value.
- The doc does not imply that Drogerie is still part of the category taxonomy.

### 4. Add Migration Coverage

- [x] Add a focused test file or extend an existing migration test so the new migration is actually inspected.
- [x] Assert `product_categories` display update exists.
- [x] Assert active `products.category` update exists.
- [x] Assert no schema/table/legacy-column drops or `ALTER TABLE` changes appear.

Acceptance:

- The migration behavior is covered by a test that would fail if the new migration were omitted.

### 5. Optional Defensive Normalization

- [x] Skipped for this lean PR after Claude/code review; live DB category paths are canonical-key constrained.
- [x] Do not broaden this into recommendation-engine or script rewrites without evidence.

Acceptance:

- Existing tests stay green.
- Defensive tests are clearly framed as compatibility, not proof of expected DB shape.

## Verification Plan

Focused commands:

```bash
npx tsx --test tests/product-identity-normalize.test.ts
npx tsx --test tests/product-display-model.test.ts
npx tsx --test tests/product-identity-schema.test.ts
```

If optional defensive normalization is included:

```bash
npx tsx --test tests/profile-product-usage-rows.test.ts
npx tsx --test tests/hair-profile-derived.test.ts
```

Broader checks after focused tests pass:

```bash
npm run typecheck
npm run test:node
```

Database verification before applying migrations:

```sql
select key, display_name_de from public.product_categories where key = 'conditioner';
select category, category_key, count(*) from public.products group by category, category_key order by category, category_key;
```

Expected post-migration production shape:

- `product_categories.key = 'conditioner'` has `display_name_de = 'Conditioner'`.
- Active products that previously had `category = 'Conditioner (Drogerie)'` have `category = 'Conditioner'`.
- `category_key = 'conditioner'` remains the internal runtime key.
- Inactive or historical product rows may still retain the legacy display string by design.

## Rollout And Safety

- Code can ship before or after the data migration because alias compatibility remains.
- The DB is only fully clean after the migration is applied.
- Rollback is simple: update `products.category` and `product_categories.display_name_de` back to `Conditioner (Drogerie)` if absolutely needed. App code will still accept both values.
- Do not remove the alias in this PR.

## Review Gates

- [x] Run Claude plan review and classify findings.
- [x] Patch accepted plan findings before implementation.
- [x] Before implementation, restate this implementation goal contract and branch-gate state.
- [x] After implementation, run focused tests plus typecheck.
- [x] Run Claude and Superpowers code review after implementation.
- [x] Stop before staging, committing, pushing, PR creation, or migration application for explicit approval.

## Open Risks

- Production may have undocumented analytics or exports reading `products.category`. The migration remains compatible because the field is retained and still human-readable.
- Generated product catalog files may temporarily show the old string until a post-migration export runs.
- If the old value appears in long-lived chat/session metadata, code compatibility handles it, but historical messages may still contain the old visible text.
