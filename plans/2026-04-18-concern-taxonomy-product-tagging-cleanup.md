# Concern Taxonomy and Product Tagging Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate profile concerns from catalog concern codes, remove `colored` from concern taxonomy, keep `hair_loss` and `thinning` profile-only, and integrate `breakage` and `tangling` end to end as validated product concern codes with conservative retagging.

**Architecture:** `ProfileConcern` remains the user-facing vocabulary used by quiz, profile, recommendation inputs, and advisory logic. `ProductConcernCode` becomes the catalog/retrieval vocabulary used by `products.suitable_concerns`, admin tagging, validators, chunk generation, and matching; it stays category-scoped because the repo already mixes user-facing concern codes with engine-native category codes like shampoo buckets, mask balance tags, and oil subtypes. `chemical_treatment` remains the only source of truth for colored/bleached history, and product selection stays exact-only once catalog tags are retagged.

**Tech Stack:** Next.js App Router, TypeScript, Zod, Supabase, Playwright, tsx test runner

---

### Task 1: Lock the Taxonomy Regression Tests

**Files:**
- Modify: `tests/admin-product-support-specs.test.ts`
- Modify: `tests/quiz-validators.test.ts`
- Modify: `tests/recommendation-engine-foundation.test.ts`
- Modify: `tests/recommendation-engine-selection.test.ts`
- Test: `tests/admin-product-support-specs.test.ts`
- Test: `tests/quiz-validators.test.ts`
- Test: `tests/recommendation-engine-foundation.test.ts`
- Test: `tests/recommendation-engine-selection.test.ts`

- [ ] **Step 1: Add product-schema expectations for the split taxonomy**

Extend the admin product schema tests so they pin the new rules:

```ts
test("product schema rejects profile-only concerns on products", () => {
  const parsed = productSchema.safeParse(
    buildBaseProduct({
      category: "Leave-in",
      suitable_concerns: ["hair_loss"],
      leave_in_specs: {
        weight: "light",
        conditioner_relationship: "replacement_capable",
        care_benefits: ["repair"],
      },
    }),
  )

  assert.equal(parsed.success, false)
})
```

```ts
test("product schema allows tangling on leave-in but not on shampoo", () => {
  assert.equal(
    productSchema.safeParse(
      buildBaseProduct({
        category: "Leave-in",
        suitable_concerns: ["tangling"],
        leave_in_specs: {
          weight: "light",
          conditioner_relationship: "replacement_capable",
          care_benefits: ["repair"],
        },
      }),
    ).success,
    true,
  )

  assert.equal(
    productSchema.safeParse(
      buildBaseProduct({
        category: "Shampoo",
        suitable_concerns: ["tangling"],
      }),
    ).success,
    false,
  )
})
```

- [ ] **Step 2: Add profile-side expectations for `colored` removal and profile-only concerns**

Keep quiz/profile validation pinned to the new concern model:

```ts
test("quiz schema accepts breakage and tangling as concerns", () => {
  const parsed = quizAnswersSchema.parse({
    ...createBaseAnswers(),
    concerns: ["breakage", "tangling"],
  })

  assert.deepEqual(parsed.concerns, ["breakage", "tangling"])
})
```

```ts
test("quiz schema does not use colored as a concern code", () => {
  assert.throws(() =>
    quizAnswersSchema.parse({
      ...createBaseAnswers(),
      concerns: ["colored"],
    }),
  )
})
```

- [ ] **Step 3: Add downstream behavior tests for exact-only tagging**

Pin the retrieval/matching behavior to exact catalog tags:

```ts
test("mask selection does not fall back from breakage to generic repair concerns", async () => {
  // Build candidates where only one carries `breakage` and another only carries `repair`.
  // Expect the exact `breakage` candidate to win and the generic candidate not to be treated as a concern match.
})
```

```ts
test("structural and manageability clusters still cap additive scoring", () => {
  // Keep the existing breakage/tangling assertions green while taxonomy changes land.
})
```

- [ ] **Step 4: Run the targeted regression set and confirm the failures are about taxonomy, not setup**

Run:

```bash
npx tsx --test tests/admin-product-support-specs.test.ts tests/quiz-validators.test.ts tests/recommendation-engine-foundation.test.ts tests/recommendation-engine-selection.test.ts
```

Expected:
- product schema fails because product concerns are still using the shared vocabulary
- quiz validator fails if `colored` is still accepted as a concern
- selection/matching tests fail until exact-only product concern handling is updated

### Task 2: Split `ProfileConcern` From Catalog Concern Codes

**Files:**
- Modify: `src/lib/vocabulary/concerns-goals.ts`
- Modify: `src/lib/vocabulary/index.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/recommendation-engine/types.ts`
- Modify: `src/lib/validators/index.ts`
- Modify: `src/app/profile/page.tsx`
- Modify: `src/lib/profile/section-config.ts`
- Modify: `src/lib/suggested-prompts.ts`
- Modify: `src/lib/routines/brush-tools.ts`
- Test: `tests/quiz-validators.test.ts`

- [ ] **Step 1: Replace the single shared concern export with explicit profile-side types**

Reshape `src/lib/vocabulary/concerns-goals.ts` so it exposes:

```ts
export const PROFILE_CONCERNS = [
  "hair_loss",
  "dandruff",
  "dryness",
  "oily_scalp",
  "hair_damage",
  "split_ends",
  "breakage",
  "frizz",
  "tangling",
  "thinning",
] as const

export type ProfileConcern = (typeof PROFILE_CONCERNS)[number]
```

Remove `colored` from that list and keep labels/options derived from `PROFILE_CONCERNS`.

- [ ] **Step 2: Re-export the new profile concern names cleanly**

Update `src/lib/vocabulary/index.ts` and `src/lib/types.ts` to export/import `ProfileConcern` and `PROFILE_CONCERN_OPTIONS` instead of the old `Concern` alias:

```ts
export {
  PROFILE_CONCERNS,
  PROFILE_CONCERN_LABELS,
  PROFILE_CONCERN_OPTIONS,
} from "./concerns-goals"

export type { ProfileConcern, Goal } from "./concerns-goals"
```

Update `HairProfile.concerns`, quiz draft state, and recommendation input shapes accordingly.

- [ ] **Step 3: Remove `colored` from profile editing and concern rendering**

Keep `chemical_treatment` as the only place where `colored` appears:

```ts
const QUIZ_CONCERN_OPTIONS: Array<{ value: ProfileConcern; label: string }> = [
  { value: "hair_damage", label: PROFILE_CONCERN_LABELS.hair_damage },
  { value: "split_ends", label: PROFILE_CONCERN_LABELS.split_ends },
  { value: "breakage", label: PROFILE_CONCERN_LABELS.breakage },
  { value: "dryness", label: PROFILE_CONCERN_LABELS.dryness },
  { value: "frizz", label: PROFILE_CONCERN_LABELS.frizz },
  { value: "tangling", label: PROFILE_CONCERN_LABELS.tangling },
]
```

Keep `hair_loss` and `thinning` available anywhere that already consumes profile concerns, including advisory-only logic like `brush-tools`.

- [ ] **Step 4: Update validators and downstream helpers to use the renamed profile concern type**

Replace `z.enum(CONCERNS)` with the new profile concern enum in profile validation, quiz validation, and runtime helpers:

```ts
concerns: z.array(z.enum(PROFILE_CONCERNS)).default([]),
```

Make sure the app no longer imports the old `Concern` name anywhere after this task.

### Task 3: Define the Catalog Concern Taxonomy and Category Applicability Rules

**Files:**
- Create: `src/lib/product-specs/concern-taxonomy.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/validators/index.ts`
- Modify: `src/app/admin/products/page.tsx`
- Modify: `src/components/chat/product-detail-drawer.tsx`
- Modify: `src/lib/product-utils.ts`
- Test: `tests/admin-product-support-specs.test.ts`

- [ ] **Step 1: Add a dedicated catalog taxonomy module**

Create a focused product-taxonomy file with the catalog-facing concern vocabulary and category filters:

```ts
export const PRODUCT_CONCERN_CODES = [
  "dandruff",
  "oily_scalp",
  "dryness",
  "frizz",
  "hair_damage",
  "split_ends",
  "breakage",
  "tangling",
  "protein",
  "feuchtigkeit",
  "performance",
  "repair",
  "moisture_anti_frizz",
  "normal",
  "trocken",
  "dehydriert-fettig",
  "schuppen",
] as const

export type ProductConcernCode = (typeof PRODUCT_CONCERN_CODES)[number]
```

Also export:
- `PRODUCT_CONCERN_LABELS`
- `getAllowedProductConcernCodes(category)`
- `isProductConcernAllowedForCategory(category, concern)`

Keep oil subtypes outside this list because oils already have their own subtype taxonomy.

- [ ] **Step 2: Encode the agreed applicability matrix in one place**

Implement the explicit category rules there, including:

```ts
const CATEGORY_PRODUCT_CONCERN_CODES: Record<ProductCategoryKey, readonly ProductConcernCode[]> = {
  shampoo: ["dandruff", "oily_scalp", "dryness", "normal", "trocken", "dehydriert-fettig", "schuppen"],
  conditioner: ["dryness", "frizz", "hair_damage", "split_ends", "breakage", "tangling", "protein", "feuchtigkeit"],
  mask: ["dryness", "frizz", "hair_damage", "split_ends", "breakage", "tangling", "protein", "feuchtigkeit", "performance"],
  leave_in: ["dryness", "frizz", "hair_damage", "split_ends", "breakage", "tangling", "moisture_anti_frizz", "repair"],
  bondbuilder: ["hair_damage", "split_ends", "breakage", "repair"],
  deep_cleansing_shampoo: ["oily_scalp"],
  dry_shampoo: ["oily_scalp"],
  peeling: ["dandruff", "oily_scalp"],
}
```

Keep `hair_loss`, `thinning`, and `colored` out of the catalog taxonomy entirely.

- [ ] **Step 3: Drive admin product chips from the new category helper**

Swap the admin product form from `CONCERN_OPTIONS` to the category-scoped product taxonomy:

```ts
const concernOptions = oilCategorySelected
  ? OIL_SUBTYPE_OPTIONS
  : getAllowedProductConcernOptions(form.category)
```

When the category changes, keep only still-valid concern codes:

```ts
const allowed = new Set(getAllowedProductConcernCodes(nextCategory))
const nextConcerns = prev.suitable_concerns.filter((value) => allowed.has(value as ProductConcernCode))
```

- [ ] **Step 4: Validate and render only catalog-supported concern codes**

Use the new helper in `productSchema.superRefine()`:

```ts
for (const concern of value.suitable_concerns) {
  if (!isProductConcernAllowedForCategory(value.category, concern)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["suitable_concerns"],
      message: "Diese Concern-Codes sind fuer diese Kategorie nicht erlaubt.",
    })
    break
  }
}
```

Update product display helpers to label only valid product concern codes instead of reusing profile labels.

### Task 4: Make Catalog Matching and Retrieval Use the Explicit Taxonomy

**Files:**
- Modify: `src/lib/recommendation-engine/selection.ts`
- Modify: `src/lib/rag/product-list-chunks.ts`
- Modify: `src/lib/rag/leave-in-decision.ts`
- Modify: `src/lib/rag/conditioner-decision.ts`
- Modify: `src/lib/rag/mask-mapper.ts`
- Modify: `src/lib/rag/scalp-mapper.ts`
- Modify: `src/lib/rag/synthesizer.ts`
- Modify: `src/lib/recommendation-engine/chat.ts`
- Test: `tests/recommendation-engine-selection.test.ts`
- Test: `tests/chat-debug-trace.spec.ts`

- [ ] **Step 1: Replace ad hoc string handling with the new catalog concern type**

Update selection and retrieval helpers so concern queries are typed as `ProductConcernCode` anywhere they target `products.suitable_concerns` or chunk metadata:

```ts
function buildMaskConcernSearchOrderFromEngine(
  decision: MaskCategoryDecision,
): ProductConcernCode[] {
  if (!decision.targetProfile?.balance || decision.targetProfile.balance === "balanced") {
    return ["performance"]
  }

  return decision.targetProfile.balance === "moisture"
    ? ["feuchtigkeit", "performance"]
    : ["protein", "performance"]
}
```

- [ ] **Step 2: Keep concern search exact-only**

Do not add `breakage -> hair_damage` or `tangling -> frizz` fallback bridges in retrieval. When matching by concern code, query exactly the selected code and rely on retagging to make the catalog truthful:

```ts
const candidates = await matchProducts({
  query: message,
  thickness: hairProfile?.thickness ?? undefined,
  concerns: ["breakage"],
  category: "leave_in",
  count: CANDIDATE_COUNT,
})
```

If a category still needs multiple exact concern codes, keep the search order limited to the category’s native taxonomy only.

- [ ] **Step 3: Keep recommendation explanations aligned with the new product concern labels**

Update product/chunk explanation helpers so they can surface natural-language reasons like `gut bei Haarbruch` and `hilft beim Entwirren`, while leaving profile-side `chemical_treatment` reasons separate from concern tagging.

- [ ] **Step 4: Re-run the selection and trace tests**

Run:

```bash
npx tsx --test tests/recommendation-engine-selection.test.ts tests/chat-debug-trace.spec.ts tests/recommendation-engine-foundation.test.ts tests/routine-signal-consumers.test.ts
```

Expected:
- exact concern-code matches stay deterministic
- `breakage` and `tangling` still influence runtime logic correctly
- no new fallback behavior appears in trace metadata

### Task 5: Retag the Current Catalog Conservatively and Surface Ambiguous Cases

**Files:**
- Modify: `plans/2026-04-18-concern-taxonomy-product-tagging-cleanup.md`
- Modify: `src/app/admin/products/page.tsx`
- Modify: live/local `products.suitable_concerns` rows through the existing admin/API path or a one-off repo-local script if needed
- Test: manual admin sanity-check against `/admin/products`

- [ ] **Step 1: Export the current product list with category and concern tags**

Use the existing admin data path or a short repo-local script to collect:

```ts
select id, name, category, suitable_concerns, description, short_description
from products
order by sort_order, name
```

Work from that snapshot so retagging is reviewable.

- [ ] **Step 2: Apply only high-confidence retags directly**

Make the conservative first pass:
- remove `colored` from any `suitable_concerns`
- remove any `hair_loss` / `thinning` product concern tags
- add `breakage` only where the product is clearly repair / anti-breakage / bond-repair oriented
- add `tangling` only where the product is clearly slip / detangling / smoothing oriented
- keep category-native tags like `protein`, `feuchtigkeit`, `performance`, shampoo buckets, and oil subtypes intact

- [ ] **Step 3: Produce a short ambiguous-review report for the human**

Append a section to this plan or create a sibling review note with rows like:

```md
- `Product Name` (`Leave-in`): current=`["repair"]`, proposed=`["repair", "breakage"]`
  Reason: repair-heavy copy and bond-claim, but no explicit breakage wording.
```

Do not guess on ambiguous cases; queue them for confirmation.

- [ ] **Step 4: Sanity-check the admin UI against the new taxonomy**

Verify in `/admin/products` that:
- non-oil categories show only the category-allowed concern chips
- `colored`, `hair_loss`, and `thinning` are gone from product tagging
- `breakage` and `tangling` appear only where the category rules allow them

### Task 6: Run Final Verification and Prepare Branch Completion

**Files:**
- Modify: `plans/2026-04-18-concern-taxonomy-product-tagging-cleanup.md`
- Test: `tests/admin-product-support-specs.test.ts`
- Test: `tests/quiz-validators.test.ts`
- Test: `tests/recommendation-engine-foundation.test.ts`
- Test: `tests/recommendation-engine-selection.test.ts`
- Test: `tests/routine-signal-consumers.test.ts`
- Test: `tests/chat-debug-trace.spec.ts`
- Test: `tests/profile-page-smoke.spec.ts`

- [ ] **Step 1: Run the final targeted test set**

Run:

```bash
npx tsx --test tests/admin-product-support-specs.test.ts tests/quiz-validators.test.ts tests/recommendation-engine-foundation.test.ts tests/recommendation-engine-selection.test.ts tests/routine-signal-consumers.test.ts
PLAYWRIGHT_BASE_URL=http://localhost:3563 npx playwright test tests/profile-page-smoke.spec.ts tests/chat-debug-trace.spec.ts --reporter=line --workers=1 --timeout=180000
```

Expected:
- schema, runtime, and UI flows all pass on the split taxonomy

- [ ] **Step 2: Re-run `npm run typecheck`**

Run:

```bash
npm run typecheck
```

Expected:
- PASS with no lingering imports of the removed shared concern type

- [ ] **Step 3: Do one manual browser pass on the live worktree server**

Check:
- `/quiz` still shows the concern page correctly
- `/profile` still edits and displays `Haar-Bedenken`
- `/admin/products` reflects the new category-scoped product concern chips

- [ ] **Step 4: Hand off to branch completion**

After all verification is green, announce:

```text
I'm using the finishing-a-development-branch skill to complete this work.
```

Then use `superpowers:finishing-a-development-branch` before any commit, push, or PR action.
