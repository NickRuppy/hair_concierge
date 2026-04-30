# Conditioner Baseline Core Care Patch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore conditioner recommendations for explicit conditioner requests by making conditioner a baseline core-care category while preserving scalp-only redirects and unsupported-claim caveats.

**Architecture:** Treat conditioner differently from shampoo at the category-decision boundary: shampoo remains conditional and scalp-led; conditioner is baseline core care and can generally be recommended. Reuse the existing target derivation (`deriveTargetWeight`, `deriveBalanceTarget`, `deriveRepairLevel`) and existing selection/rerank/fallback policy. Do not add a new conditioner-specific inference layer.

**Tech Stack:** Next.js/TypeScript, Node test runner, recommendation engine category decisions, Agent v1 `select_products` projection, Playwright compare/chat checks.

---

## Source Of Truth

Spec/feedback source:
- Latest compare-lab feedback in `tmp/agent-compare-runs.jsonl`, especially runs 11, 14, 15, and 16.
- Prior conditioner replication plan: `plans/2026-04-29-conditioner-feedback-improvements.md`.
- Alignment decisions from this review:
  - Conditioner is baseline core care and can generally be recommended.
  - Shampoo is conditional and scalp-led.
  - Existing conditioner inventory must not suppress product selection.
  - Low repair need + balanced protein/moisture should produce a low-repair, balanced target, not `no_catalog_match`.
  - Scalp-only conditioner requests still return `not_recommended` / no products.
  - Ingredient preferences remain unsupported signals for now, but should not block fit-based recommendations.

Promised end-state:
- `Welche Spuelung passt zu meinem feinen Haar, ohne es zu beschweren?` returns displayable conditioner products for a complete profile, even if the stored routine already has conditioner.
- `Vergleich mir bitte zwei passende Conditioner fuer feines Haar` returns products and comparison facts.
- `Welchen silikonfreien Conditioner empfiehlst du mir?` returns fit-based conditioner products plus an unsupported ingredient caveat.
- `Welcher Conditioner hilft gegen juckende Kopfhaut?` still redirects away from conditioner with no products.

## Target File Map

- Modify: `src/lib/recommendation-engine/categories/conditioner.ts`
  - Make conditioner category decisions relevant by default for complete profiles.
  - Existing planner steps still choose stronger action/reason codes when present.

- Modify: `src/lib/recommendation-engine/categories/index.ts`
  - No new behavior unless needed by the chosen implementation. Prefer not changing this file if conditioner can be fixed locally.

- Modify: `src/lib/recommendation-engine/selection.ts`
  - Only if needed after the category fix. Preferred outcome: existing selector starts returning candidates because conditioner decision is now relevant.

- Modify: `src/lib/agent/tools/select-products.ts`
  - Build packet-level unsupported requested signals from route context even when no products are projected.
  - Keep scalp-only conditioner redirect unchanged.

- Modify: `tests/recommendation-engine-categories.test.ts`
  - Add baseline conditioner category regression.

- Modify: `tests/agent-select-products-tool.spec.ts`
  - Add regressions for explicit conditioner recommendation with low/balanced profile and unsupported ingredient caveat with products.

- Optional verify only: `tests/agent-compare-product-trace.spec.ts`, `tests/conditioner-chat-e2e.spec.ts`
  - No planned edits unless existing expectations need a direct update for restored product flow.

## Scope Boundaries

In scope:
- Conditioner baseline category relevance.
- Existing fit target derivation for low/balanced profiles.
- Recommendation display behavior for explicit conditioner asks.
- Packet-level unsupported signal preservation.
- Focused tests and compare-lab smoke.

Out of scope:
- Other product categories.
- Ingredient-flag operationalization.
- Current-conditioner-vs-recommended-product comparison.
- New DB migrations or RPC changes.
- New product policy states.
- New conditioner-specific damage inference.

---

### Task 1: Lock The Baseline Conditioner Category Rule

**Files:**
- Modify: `tests/recommendation-engine-categories.test.ts`
- Modify: `src/lib/recommendation-engine/categories/conditioner.ts`

- [ ] **Step 1: Add failing category regression**

Add this test near the existing conditioner category tests:

```ts
test("conditioner stays baseline core care for low-need profiles with existing conditioner", () => {
  const { normalized, damage, careNeeds, plan } = buildEngineState(LOW_DAMAGE_PROFILE, [
    {
      category: "conditioner",
      product_name: "Current Conditioner",
      frequency_range: "3_4x",
    },
  ])
  const categories = buildCategoryRecommendationSet(
    normalized,
    damage,
    careNeeds,
    plan,
    emptyRecommendationRequestContext(),
  )

  assert.equal(categories.conditioner.relevant, true)
  assert.equal(categories.conditioner.action, "keep")
  assert.ok(categories.conditioner.planReasonCodes.includes("baseline_core_care"))
  assert.equal(categories.conditioner.targetProfile?.balance, "balanced")
  assert.equal(categories.conditioner.targetProfile?.repairLevel, "low")
  assert.equal(categories.conditioner.targetProfile?.weight, "medium")
  assert.equal(categories.conditioner.targetProfile?.thickness, "normal")
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx tsx --test tests/recommendation-engine-categories.test.ts
```

Expected before implementation:
- New test fails because `categories.conditioner.relevant` is currently `false`.

- [ ] **Step 3: Make conditioner baseline core care**

In `src/lib/recommendation-engine/categories/conditioner.ts`, replace the early `if (!step)` irrelevant return with baseline keep/add behavior.

Use this shape:

```ts
const hasConditioner = profile.routineInventory.conditioner !== null
const notes: string[] = []
const targetWeight = deriveTargetWeight(profile)
if (!targetWeight) {
  notes.push("conditioner_weight_needs_thickness_and_density")
}
if (!profile.thickness) {
  notes.push("conditioner_profile_thickness_missing")
}

return {
  category: "conditioner",
  relevant: true,
  action: step?.action ?? (hasConditioner ? "keep" : "add"),
  planReasonCodes: step?.reasonCodes ?? [
    "baseline_core_care",
    hasConditioner ? "conditioner_already_present" : "missing_conditioner_inventory",
  ],
  currentInventory: profile.routineInventory.conditioner,
  targetProfile: {
    balance: deriveBalanceTarget(damage),
    repairLevel: deriveRepairLevel(damage),
    weight: targetWeight,
    thickness: profile.thickness,
    activeDamageDrivers: damage.activeDamageDrivers,
  },
  notes,
}
```

Keep the existing target derivation exactly as the source of truth.

- [ ] **Step 4: Run category tests**

Run:

```bash
npx tsx --test tests/recommendation-engine-categories.test.ts
```

Expected:
- PASS.

---

### Task 2: Restore Explicit Conditioner Product Flow

**Files:**
- Modify: `tests/agent-select-products-tool.spec.ts`
- Modify: `src/lib/agent/tools/select-products.ts` only if Task 1 does not fully restore the projection.

- [ ] **Step 1: Add failing `createSelectProductsTool` regression**

Add a test using `createSelectProductsTool` so the runtime/category boundary is covered, not only `projectSelectedProducts`.

```ts
test("selectProducts recommends conditioner for low-need balanced profile with existing conditioner", async () => {
  const selectProducts = createSelectProductsTool({
    runCategoryEngine: async ({ category }) => {
      assert.equal(category, "conditioner")
      return [
        createMatchedProduct("light-balanced", 0.94, {
          name: "Light Balanced Conditioner",
          recommendation_meta: {
            category: "conditioner",
            score: 94,
            top_reasons: ["Passt zu einem leichten, ausgewogenen Conditioner-Zielprofil."],
            tradeoffs: [],
            usage_hint: "In die Laengen geben.",
            matched_profile: {
              thickness: "fine",
              density: "medium",
              protein_moisture_balance: "stretches_bounces",
              cuticle_condition: "smooth",
              chemical_treatment: [],
            },
            matched_weight: "light",
            matched_repair_level: "low",
            matched_balance_need: "balanced",
            fit_status: "ideal",
            product_weight: "light",
            product_repair_level: "low",
            product_balance_direction: "balanced",
            active_damage_drivers: [],
          },
        }),
      ]
    },
  })

  const result = await selectProducts({
    category: "conditioner",
    message: "Welche Spuelung passt zu meinem feinen Haar, ohne es zu beschweren?",
    hairProfile: {
      ...LOW_DAMAGE_PROFILE,
      thickness: "normal",
      density: "medium",
      protein_moisture_balance: "stretches_bounces",
    } as HairProfile,
    memoryContext: { enabled: true, dislikedProductNames: [], likedProductNames: [] },
    routineItems: [
      {
        category: "conditioner",
        product_name: "Current Conditioner",
        frequency_range: "3_4x",
      },
    ],
    userJob: "product_pick",
    concerns: [],
    activeProfileSignals: [
      {
        field: "thickness",
        value: "fine",
        source: "message",
        selection_effect: "override",
        evidence: "feines Haar",
      },
    ],
  })

  assert.equal(result.decision, "recommended")
  assert.equal(result.product_response_policy, "recommend")
  assert.deepEqual(
    result.products.map((product) => product.name),
    ["Light Balanced Conditioner"],
  )
  assert.ok(result.profile_basis.includes("Haardicke: Fein"))
  assert.ok(result.profile_basis.includes("Ziel-Gewicht: Leicht"))
  assert.ok(result.profile_basis.includes("Repair-Bedarf: Leicht"))
})
```

If `UserMemoryContext` has extra required fields, satisfy them with neutral values from the existing test patterns. Do not change production types just for this test.

- [ ] **Step 2: Run the focused tool test**

Run:

```bash
npx tsx --test tests/agent-select-products-tool.spec.ts
```

Expected after Task 1:
- PASS, unless the projection still has a local gate to adjust.

- [ ] **Step 3: If needed, remove any remaining product-flow gate**

Only edit `src/lib/agent/tools/select-products.ts` if the test shows product projection is still suppressed despite a relevant conditioner category decision.

Keep this invariant:

```ts
const displayableProducts = decision === "recommended" ? products.slice(0, 3) : []
```

Do not introduce a new conditioner-specific display policy.

---

### Task 3: Preserve Unsupported Signals Without Blocking Products

**Files:**
- Modify: `tests/agent-select-products-tool.spec.ts`
- Modify: `src/lib/agent/tools/select-products.ts`

- [ ] **Step 1: Add unsupported ingredient regression with products**

Add a test near the existing ingredient/unsupported conditioner tests:

```ts
test("selectProducts keeps silicone-free unsupported while still recommending conditioner", async () => {
  const selectProducts = createSelectProductsTool({
    runCategoryEngine: async () => [
      createMatchedProduct("balanced", 0.94, {
        name: "Balanced Conditioner",
        recommendation_meta: {
          category: "conditioner",
          score: 94,
          top_reasons: ["Passt zum ausgewogenen Conditioner-Zielprofil."],
          tradeoffs: [],
          usage_hint: "In die Laengen geben.",
          matched_profile: {
            thickness: "normal",
            density: "medium",
            protein_moisture_balance: "stretches_bounces",
            cuticle_condition: "smooth",
            chemical_treatment: [],
          },
          matched_weight: "medium",
          matched_repair_level: "low",
          matched_balance_need: "balanced",
          fit_status: "ideal",
          product_weight: "medium",
          product_repair_level: "low",
          product_balance_direction: "balanced",
          active_damage_drivers: [],
        },
      }),
    ],
  })

  const result = await selectProducts({
    category: "conditioner",
    message: "Welchen silikonfreien Conditioner empfiehlst du mir?",
    hairProfile: LOW_DAMAGE_PROFILE,
    memoryContext: { enabled: true, dislikedProductNames: [], likedProductNames: [] },
    routineItems: [
      {
        category: "conditioner",
        product_name: "Current Conditioner",
        frequency_range: "3_4x",
      },
    ],
    userJob: "product_pick",
    concerns: [],
  })

  assert.equal(result.decision, "recommended")
  assert.equal(result.products.length, 1)
  assert.deepEqual(
    result.unsupported_requested_signals.map((signal) => [signal.field, signal.value]),
    [["ingredient_preference", "silicone_free"]],
  )
  assert.deepEqual(
    result.products[0]?.unsupported_requested_signals.map((signal) => [signal.field, signal.value]),
    [["ingredient_preference", "silicone_free"]],
  )
})
```

- [ ] **Step 2: Add no-product packet-level caveat regression**

This keeps the packet honest if a true empty catalog happens later.

```ts
test("projectSelectedProducts exposes conditioner ingredient caveat even with no products", () => {
  const result = projectSelectedProducts(
    [],
    LOW_DAMAGE_PROFILE,
    "conditioner",
    createRuntimeStub(),
    {
      userJob: "product_pick",
      concerns: [],
      requestedIngredientSignals: [{ value: "silicone_free", evidence: "silikonfrei" }],
    },
  )

  assert.equal(result.decision, "no_catalog_match")
  assert.deepEqual(
    result.unsupported_requested_signals.map((signal) => [signal.field, signal.value]),
    [["ingredient_preference", "silicone_free"]],
  )
})
```

- [ ] **Step 3: Implement packet-level unsupported signal preservation**

In `projectSelectedProducts`, build packet-level unsupported signals from both projected products and route context. Keep the product-level signals unchanged.

Use this shape:

```ts
const packetUnsupportedSignals = uniqueUnsupportedSignals([
  ...projectedProducts.flatMap((product) => product.unsupported_requested_signals),
  ...(resolvedCategory === "conditioner" || resolvedCategory === "leave_in"
    ? buildUnsupportedIngredientSignals(
        routeContext?.requestedIngredientSignals ?? [],
        resolvedCategory === "leave_in" ? "leave_in" : "conditioner",
      )
    : []),
])
```

Then return:

```ts
unsupported_requested_signals: packetUnsupportedSignals,
```

Do not make ingredient preferences supported claims.

- [ ] **Step 4: Run focused tool tests**

Run:

```bash
npx tsx --test tests/agent-select-products-tool.spec.ts
```

Expected:
- PASS.

---

### Task 4: Verify End-To-End Behavior

**Files:**
- No planned edits.

- [ ] **Step 1: Run focused automated tests**

Run:

```bash
npx tsx --test tests/recommendation-engine-categories.test.ts tests/recommendation-engine-selection.test.ts tests/agent-select-products-tool.spec.ts tests/agent-route-packet.spec.ts tests/agent-shadow.spec.ts tests/agent-compare-product-trace.spec.ts
```

Expected:
- PASS.

- [ ] **Step 2: Run typecheck and lint**

Run:

```bash
npm run typecheck
npm run lint
```

Expected:
- Typecheck passes.
- Lint has no new errors. Existing warnings may remain if unrelated.

- [ ] **Step 3: Run browser/chat checks**

Ensure the worktree app is running at the compare lab URL:

```bash
npm run dev:worktree -- --print-port
```

Then run:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3723 npx playwright test tests/chat-debug-trace.spec.ts tests/conditioner-chat-e2e.spec.ts --reporter=line
```

Expected:
- PASS.

- [ ] **Step 4: Manual compare-lab smoke**

In `http://localhost:3723/labs/agent-compare`, re-run these prompts against the real test user:

```text
Welche Spuelung passt zu meinem feinen Haar, ohne es zu beschweren?
Welche Spuelung passt, wenn ich Spliss und trockene Spitzen habe?
Vergleich mir bitte zwei passende Conditioner fuer feines Haar
Welchen silikonfreien Conditioner empfiehlst du mir?
Welcher Conditioner hilft gegen juckende Kopfhaut?
```

Expected:
- Fine-hair conditioner returns products and honors current-turn `thickness=fine`.
- Split ends / dry tips returns products and avoids claiming Spliss can be permanently repaired.
- Compare returns products and supported differentiators.
- Silicone-free returns products plus unsupported ingredient caveat.
- Itchy scalp returns `not_recommended` / no conditioner products and redirects to scalp/shampoo guidance.

## Ready Check

Because this touches recommendation behavior, trust-facing copy, and product selection, run `ready-check` before shipping the branch.

## Next Skill

Use `superpowers:executing-plans` to implement this patch inline. The task sequence is tightly coupled and small enough that subagent fan-out is unnecessary.
