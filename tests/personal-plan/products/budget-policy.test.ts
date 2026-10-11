import assert from "node:assert/strict"
import test from "node:test"

import { DIAGNOSTIC_CONCERNS } from "../../../src/lib/quiz/diagnostic-input"
import {
  BUDGET_NEED_DIMENSIONS,
  CONCERN_DIMENSIONS,
  allocateBudgetPortfolio,
  inferBudgetSuggestion,
  orderStandaloneAlternatives,
  orderTrustPairAlternatives,
  type BudgetCandidate,
  type BudgetPortfolioInput,
  type BudgetPreference,
  type BudgetRoleInput,
} from "../../../src/lib/personal-plan/products/budget-policy"

// Rule IDs reference plans/profi-tier-baseline/implementation-plan.md §4. Every expected value
// below is computed by hand from that table, not from the implementation.

const CAP5_STRICT: BudgetPreference = { kind: "capped", limitEur: 5, allowExceptions: false }
const CAP15_STRICT: BudgetPreference = { kind: "capped", limitEur: 15, allowExceptions: false }
const CAP5_FLEX: BudgetPreference = { kind: "capped", limitEur: 5, allowExceptions: true }
const CAP15_FLEX: BudgetPreference = { kind: "capped", limitEur: 15, allowExceptions: true }
const UNCAPPED: BudgetPreference = { kind: "uncapped" }

// `needs` = distance to the user's target per graded comparison dimension (0 = on target).
function candidate(
  productId: string,
  priceEur: number | null,
  needs: Record<string, number> = {},
  overrides: Partial<Omit<BudgetCandidate, "productId" | "priceEur" | "needDistances">> = {},
): BudgetCandidate {
  return {
    productId,
    priceEur,
    verdict: "supportive",
    cautionCount: 0,
    needDistances: needs,
    ...overrides,
  }
}

function role(
  roleKey: string,
  ranked: BudgetCandidate[],
  overrides: Partial<Omit<BudgetRoleInput, "roleKey" | "ranked">> = {},
): BudgetRoleInput {
  return { roleKey, ranked, required: true, ownedKept: false, preserved: null, ...overrides }
}

function allocate(
  budget: BudgetPreference,
  roles: BudgetRoleInput[],
  overrides: Partial<Omit<BudgetPortfolioInput, "budget" | "roles">> = {},
) {
  return allocateBudgetPortfolio({
    budget,
    roles,
    mainConcernDimensions: new Set(),
    displayLimit: 3,
    ...overrides,
  })
}

const ids = (views: { productId: string }[]) => views.map((view) => view.productId)

/* ---------------------------------------------------------------- inference (point 30) */

test("B-INF-1 8/10/14 across three categories suggests 15", () => {
  assert.equal(
    inferBudgetSuggestion([
      { productId: "s", category: "shampoo", priceEur: 8 },
      { productId: "c", category: "conditioner", priceEur: 10 },
      { productId: "m", category: "mask", priceEur: 14 },
    ]),
    15,
  )
})

test("B-INF-2 3/4/5 suggests 5 (5 € counts as within the low band)", () => {
  assert.equal(
    inferBudgetSuggestion([
      { productId: "s", category: "shampoo", priceEur: 3 },
      { productId: "c", category: "conditioner", priceEur: 4 },
      { productId: "m", category: "mask", priceEur: 5 },
    ]),
    5,
  )
})

test("B-INF-3 any priceable product above 15 € blocks a suggestion (4/4/25)", () => {
  assert.equal(
    inferBudgetSuggestion([
      { productId: "s", category: "shampoo", priceEur: 4 },
      { productId: "c", category: "conditioner", priceEur: 4 },
      { productId: "m", category: "mask", priceEur: 25 },
    ]),
    null,
  )
})

test("B-INF-4 an unknown product counts against coverage (3 of 4 = 75 % < 80 %)", () => {
  assert.equal(
    inferBudgetSuggestion([
      { productId: "s", category: "shampoo", priceEur: 3 },
      { productId: "c", category: "conditioner", priceEur: 4 },
      { productId: "m", category: "mask", priceEur: 5 },
      { productId: null, category: "mask", priceEur: null },
    ]),
    null,
  )
})

test("B-INF-5 neither band reaches 80 % (4/4/4/12) gives no suggestion", () => {
  assert.equal(
    inferBudgetSuggestion([
      { productId: "a", category: "shampoo", priceEur: 4 },
      { productId: "b", category: "conditioner", priceEur: 4 },
      { productId: "c", category: "mask", priceEur: 4 },
      { productId: "d", category: "leave_in", priceEur: 12 },
    ]),
    null,
  )
})

test("B-INF-6 duplicate product IDs count once (two distinct products < 3)", () => {
  assert.equal(
    inferBudgetSuggestion([
      { productId: "a", category: "shampoo", priceEur: 4 },
      { productId: "a", category: "shampoo", priceEur: 4 },
      { productId: "a", category: "shampoo", priceEur: 4 },
      { productId: "b", category: "conditioner", priceEur: 6 },
    ]),
    null,
  )
})

test("B-INF-7 tools are excluded from evidence", () => {
  assert.equal(
    inferBudgetSuggestion([
      { productId: "s", category: "shampoo", priceEur: 3 },
      { productId: "c", category: "conditioner", priceEur: 4 },
      { productId: "m", category: "mask", priceEur: 5 },
      { productId: "brush", category: "tool", priceEur: 80, tool: true },
    ]),
    5,
  )
})

test("B-INF-8 one category only gives no suggestion", () => {
  assert.equal(
    inferBudgetSuggestion([
      { productId: "a", category: "shampoo", priceEur: 3 },
      { productId: "b", category: "shampoo", priceEur: 4 },
      { productId: "c", category: "shampoo", priceEur: 5 },
    ]),
    null,
  )
})

test("B-INF-9 exactly 80 % in the low band suggests 5 (4/5/5/5/12)", () => {
  assert.equal(
    inferBudgetSuggestion([
      { productId: "a", category: "shampoo", priceEur: 4 },
      { productId: "b", category: "conditioner", priceEur: 5 },
      { productId: "c", category: "mask", priceEur: 5 },
      { productId: "d", category: "leave_in", priceEur: 5 },
      { productId: "e", category: "oil", priceEur: 12 },
    ]),
    5,
  )
})

test("B-INF-10 low prices do not count toward the middle band (3/9/12 → none)", () => {
  // middle share = 2/3 = 67 %, low share = 1/3 → neither ≥ 80 %
  assert.equal(
    inferBudgetSuggestion([
      { productId: "a", category: "shampoo", priceEur: 3 },
      { productId: "b", category: "conditioner", priceEur: 9 },
      { productId: "c", category: "mask", priceEur: 12 },
    ]),
    null,
  )
})

/* ---------------------------------------------------------------- strict (point 20) */

test("B-STR-1 two or more affordable: affordable only, first affordable preselected", () => {
  const result = allocate(CAP5_STRICT, [
    role("shampoo", [
      candidate("x", 24.9),
      candidate("a", 4.45),
      candidate("b", 4.95),
      candidate("d", 70),
    ]),
  ])
  const shampoo = result.roles[0]!
  assert.deepEqual(ids(shampoo.candidates), ["a", "b"])
  assert.ok(shampoo.candidates.every((view) => view.label === "within_budget" && !view.overBudget))
  assert.equal(shampoo.defaultProductId, "a")
  assert.equal(shampoo.notice, null)
  assert.equal(shampoo.exception, null)
})

test("B-STR-2 one affordable: affordable first, then over-budget by ascending price", () => {
  const result = allocate(CAP5_STRICT, [
    role("shampoo", [candidate("d", 70), candidate("x", 24.9), candidate("a", 4.45)]),
  ])
  const shampoo = result.roles[0]!
  assert.deepEqual(ids(shampoo.candidates), ["a", "x", "d"])
  assert.deepEqual(
    shampoo.candidates.map((view) => [view.label, view.overBudget]),
    [
      ["within_budget", false],
      ["alternative", true],
      ["alternative", true],
    ],
  )
  assert.equal(shampoo.defaultProductId, "a")
  assert.equal(shampoo.notice, "strict_one_affordable")
})

test("B-STR-3 zero affordable: over-budget shown by ascending price, nothing preselected", () => {
  const result = allocate(CAP5_STRICT, [
    role("shampoo", [candidate("d", 70), candidate("x", 24.9)]),
  ])
  const shampoo = result.roles[0]!
  assert.deepEqual(ids(shampoo.candidates), ["x", "d"])
  assert.equal(shampoo.defaultProductId, null)
  assert.equal(shampoo.notice, "strict_none_affordable")
})

test("B-STR-4 unpriced candidates are never affordable and not shown under a cap", () => {
  const result = allocate(CAP5_STRICT, [
    role("shampoo", [candidate("u", null), candidate("a", 4), candidate("b", 4.5)]),
  ])
  assert.deepEqual(ids(result.roles[0]!.candidates), ["a", "b"])
  assert.equal(result.roles[0]!.defaultProductId, "a")
})

test("B-STR-5 affordable candidates beyond the legacy rank 12 are found (full pool)", () => {
  const expensive = Array.from({ length: 13 }, (_, index) => candidate(`e${index}`, 20 + index))
  const result = allocate(CAP15_STRICT, [
    role("shampoo", [...expensive, candidate("late-a", 9.95), candidate("late-b", 11.95)]),
  ])
  assert.deepEqual(ids(result.roles[0]!.candidates), ["late-a", "late-b"])
  assert.equal(result.roles[0]!.defaultProductId, "late-a")
})

test("B-STR-6 the display limit bounds the affordable list in ranked order", () => {
  const result = allocate(CAP15_STRICT, [
    role("shampoo", [
      candidate("a", 5),
      candidate("b", 6),
      candidate("c", 7),
      candidate("d", 8),
      candidate("e", 9),
    ]),
  ])
  assert.deepEqual(ids(result.roles[0]!.candidates), ["a", "b", "c"])
})

test("B-STR-7 strict never auto-fills a required role above budget", () => {
  const result = allocate(CAP5_STRICT, [
    role("shampoo", [candidate("x", 24.9)]),
    role("conditioner", [candidate("c1", 4.95), candidate("c2", 3.95)]),
  ])
  assert.equal(result.roles[0]!.defaultProductId, null)
  assert.equal(result.roles[0]!.exception, null)
  assert.equal(result.summary.gapCount, 0)
})

/* ---------------------------------------------------------------- flexible (points 14, 15, 26, 27, 23) */

const MASK_BASE = { "mask.repair_support": 1, "mask.weight": 0 } as const
const MASK_BETTER = { "mask.repair_support": 0, "mask.weight": 0 } as const

function threeRoles(mask: BudgetCandidate[]): BudgetRoleInput[] {
  return [
    role("shampoo", [candidate("s1", 11.95), candidate("s2", 13.95)]),
    role("conditioner", [candidate("c1", 10.95), candidate("c2", 13.95)]),
    role("mask", mask),
  ]
}

test("B-FLX-1 an authority-backed improvement becomes the preselected primary (N=3 → A=1)", () => {
  const result = allocate(
    CAP15_FLEX,
    threeRoles([candidate("m3", 24.9, MASK_BETTER), candidate("m1", 12.95, MASK_BASE)]),
  )
  const mask = result.roles[2]!
  assert.equal(mask.defaultProductId, "m3")
  assert.deepEqual(mask.exception, {
    kind: "improvement",
    improvedDimensionIds: ["mask.repair_support"],
  })
  assert.equal(mask.notice, "flex_improvement")
  assert.deepEqual(
    mask.candidates.map((view) => [view.productId, view.label, view.overBudget]),
    [
      ["m3", "recommended", true],
      ["m1", "within_budget", false],
    ],
  )
  assert.deepEqual(result.summary, {
    newPurchaseCount: 3,
    allowance: 1,
    gapCount: 0,
    exceptionsUsed: 1,
  })
})

test("B-FLX-2 equal fit at a higher price is not an exception", () => {
  const result = allocate(
    CAP15_FLEX,
    threeRoles([candidate("m3", 24.9, MASK_BASE), candidate("m1", 12.95, MASK_BASE)]),
  )
  assert.equal(result.roles[2]!.defaultProductId, "m1")
  assert.equal(result.roles[2]!.exception, null)
  assert.equal(result.summary.exceptionsUsed, 0)
})

test("B-FLX-3 an improvement that introduces a new compromise is rejected", () => {
  const result = allocate(
    CAP15_FLEX,
    threeRoles([
      candidate("m3", 24.9, { "mask.repair_support": 0, "mask.weight": 1 }),
      candidate("m1", 12.95, MASK_BASE),
    ]),
  )
  assert.equal(result.roles[2]!.defaultProductId, "m1")
  assert.equal(result.roles[2]!.exception, null)
})

test("B-FLX-4 a worse verdict disqualifies an otherwise better candidate", () => {
  const result = allocate(
    CAP15_FLEX,
    threeRoles([
      candidate("m3", 24.9, MASK_BETTER, { verdict: "supportive" }),
      candidate("m1", 12.95, MASK_BASE, { verdict: "ideal" }),
    ]),
  )
  assert.equal(result.roles[2]!.defaultProductId, "m1")
})

test("B-FLX-5 non-need dimensions (care direction) never justify an exception", () => {
  const result = allocate(
    CAP15_FLEX,
    threeRoles([
      candidate("m3", 24.9, { ...MASK_BASE, "mask.care_direction": 0 }),
      candidate("m1", 12.95, { ...MASK_BASE, "mask.care_direction": 2 }),
    ]),
  )
  assert.equal(result.roles[2]!.defaultProductId, "m1")
})

function competingImprovements(): BudgetRoleInput[] {
  return [
    role("shampoo", [candidate("s1", 11.95), candidate("s2", 13.95)]),
    role("conditioner", [
      candidate("c3", 28.95, { "conditioner.repair_support": 0 }), // +18 over c1
      candidate("c1", 10.95, { "conditioner.repair_support": 1 }),
    ]),
    role("mask", [
      candidate("m3", 20.95, { "mask.weight": 0 }), // +8 over m1
      candidate("m1", 12.95, { "mask.weight": 1 }),
    ]),
  ]
}

test("B-FLX-6 an improvement for the stated main concern beats a cheaper secondary one", () => {
  const result = allocate(CAP15_FLEX, competingImprovements(), {
    mainConcernDimensions: new Set(CONCERN_DIMENSIONS.hair_damage),
  })
  assert.equal(result.roles[1]!.defaultProductId, "c3")
  assert.equal(result.roles[2]!.defaultProductId, "m1")
  assert.equal(result.roles[2]!.notice, "allowance_used_elsewhere")
  assert.equal(result.summary.exceptionsUsed, 1)
})

test("B-FLX-7 without a main-concern match the smaller extra cost wins", () => {
  const result = allocate(CAP15_FLEX, competingImprovements())
  assert.equal(result.roles[2]!.defaultProductId, "m3")
  assert.equal(result.roles[1]!.defaultProductId, "c1")
  assert.equal(result.roles[1]!.notice, "allowance_used_elsewhere")
})

test("B-FLX-8 allowance A = max(1, floor(0.25 N)), N = 0 → 0", () => {
  const plainRoles = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      role(`r${index}`, [candidate(`p${index}`, 10), candidate(`q${index}`, 11)]),
    )
  for (const [count, allowance] of [
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
    [8, 2],
  ] as const) {
    const result = allocate(CAP15_FLEX, plainRoles(count))
    assert.equal(result.summary.newPurchaseCount, count, `N for ${count} roles`)
    assert.equal(result.summary.allowance, allowance, `A for N=${count}`)
  }
  const none = allocate(CAP15_FLEX, [role("empty", [])])
  assert.equal(none.summary.newPurchaseCount, 0)
  assert.equal(none.summary.allowance, 0)
})

test("B-FLX-9 N=8 grants two exceptions, the two smallest extra costs", () => {
  const roles = Array.from({ length: 8 }, (_, index) =>
    role(`r${index}`, [
      candidate(`hi${index}`, 16 + index, { "conditioner.weight": 0 }),
      candidate(`lo${index}`, 10, { "conditioner.weight": 1 }),
    ]),
  )
  const result = allocate(CAP15_FLEX, roles)
  assert.equal(result.summary.allowance, 2)
  assert.deepEqual(
    result.roles.map((entry) => entry.defaultProductId),
    ["hi0", "hi1", "lo2", "lo3", "lo4", "lo5", "lo6", "lo7"],
  )
})

/* ---------------------------------------------------------------- necessary gaps (point 18) */

test("B-GAP-1 a required role without affordable options is filled and consumes the allowance", () => {
  const result = allocate(CAP15_FLEX, [
    role("shampoo", [candidate("x", 24.9), candidate("y", 70)]),
    role("conditioner", [candidate("c1", 10.95), candidate("c2", 13.95)]),
    role("mask", [candidate("m3", 24.9, MASK_BETTER), candidate("m1", 12.95, MASK_BASE)]),
  ])
  const [shampoo, , mask] = result.roles
  assert.equal(shampoo!.defaultProductId, "x")
  assert.deepEqual(shampoo!.exception, { kind: "gap", improvedDimensionIds: [] })
  assert.equal(shampoo!.notice, "flex_gap")
  assert.equal(shampoo!.candidates[0]!.label, "recommended")
  assert.equal(mask!.defaultProductId, "m1")
  assert.equal(mask!.notice, "allowance_used_elsewhere")
  assert.deepEqual(result.summary, {
    newPurchaseCount: 3,
    allowance: 1,
    gapCount: 1,
    exceptionsUsed: 1,
  })
})

test("B-GAP-2 gaps above the allowance are all filled (capacity = max(A, G))", () => {
  const result = allocate(CAP5_FLEX, [
    role("shampoo", [candidate("x", 24.9)]),
    role("conditioner", [candidate("y", 12.95)]),
    role("mask", [candidate("m3", 24.9, MASK_BETTER), candidate("m1", 4.95, MASK_BASE)]),
  ])
  assert.deepEqual(
    result.roles.map((entry) => entry.defaultProductId),
    ["x", "y", "m1"],
  )
  assert.equal(result.summary.gapCount, 2)
  assert.equal(result.summary.exceptionsUsed, 2)
})

test("B-GAP-3 an optional role without affordable options is not a gap", () => {
  const result = allocate(CAP15_FLEX, [
    role("shampoo", [candidate("s1", 11.95), candidate("s2", 13.95)]),
    role("oil", [candidate("o1", 24.9)], { required: false }),
  ])
  assert.equal(result.roles[1]!.defaultProductId, null)
  assert.equal(result.roles[1]!.exception, null)
  assert.equal(result.summary.gapCount, 0)
})

test("B-GAP-4 no suitable candidate at any price is not a gap", () => {
  const result = allocate(CAP15_FLEX, [role("shampoo", [])])
  assert.equal(result.roles[0]!.defaultProductId, null)
  assert.deepEqual(result.roles[0]!.candidates, [])
  assert.equal(result.summary.gapCount, 0)
})

/* ---------------------------------------------------------------- dedup, manual, owned */

test("B-DUP-1 a product used for two roles counts once in N (8 roles, 2 duplicates → N=6 → A=1)", () => {
  const improving = (key: string, shared?: string) =>
    role(key, [
      candidate(`${key}-hi`, 18, { "conditioner.weight": 0 }),
      candidate(shared ?? `${key}-lo`, 10, { "conditioner.weight": 1 }),
    ])
  const result = allocate(CAP15_FLEX, [
    improving("r1"),
    improving("r2"),
    improving("r3"),
    improving("r4", "shared-a"),
    improving("r5", "shared-a"),
    improving("r6", "shared-b"),
    improving("r7", "shared-b"),
    improving("r8"),
  ])
  // Baselines: r1-lo r2-lo r3-lo shared-a shared-a shared-b shared-b r8-lo → 6 unique (8 roles
  // would give A = 2; deduplicated N = 6 gives A = 1). The single exception goes to r1 (equal
  // extra cost → input order): r1-hi replaces r1-lo, N stays 6.
  assert.equal(result.summary.newPurchaseCount, 6)
  assert.equal(result.summary.allowance, 1)
  assert.equal(result.summary.exceptionsUsed, 1)
  assert.equal(result.roles[0]!.defaultProductId, "r1-hi")
})

test("B-MAN-1 an explicit over-budget choice is kept and consumes the ordinary allowance", () => {
  const result = allocate(CAP15_FLEX, [
    role("shampoo", [candidate("s1", 11.95), candidate("x", 24.9)], {
      preserved: { productId: "x", explicit: true },
    }),
    role("conditioner", [candidate("c1", 10.95), candidate("c2", 13.95)]),
    role("mask", [candidate("m3", 24.9, MASK_BETTER), candidate("m1", 12.95, MASK_BASE)]),
  ])
  const [shampoo, , mask] = result.roles
  assert.equal(shampoo!.defaultProductId, "x")
  assert.ok(ids(shampoo!.candidates).includes("x"))
  assert.equal(shampoo!.exception, null)
  assert.equal(mask!.defaultProductId, "m1")
  assert.equal(mask!.notice, "allowance_used_elsewhere")
})

test("B-MAN-2 a preserved choice survives a lower budget and stays selectable", () => {
  const result = allocate(CAP5_STRICT, [
    role("shampoo", [candidate("a", 4.45), candidate("b", 4.95), candidate("kept", 11.95)], {
      preserved: { productId: "kept", explicit: false },
    }),
  ])
  const shampoo = result.roles[0]!
  assert.equal(shampoo.defaultProductId, "kept")
  assert.equal(shampoo.candidates[0]!.productId, "kept")
  assert.ok(shampoo.candidates.length <= 3)
})

test("B-MAN-3 manual choices beyond the allowance are never undone", () => {
  const result = allocate(CAP5_FLEX, [
    role("shampoo", [candidate("s1", 4), candidate("x", 24.9)], {
      preserved: { productId: "x", explicit: true },
    }),
    role("conditioner", [candidate("c1", 4), candidate("y", 19.9)], {
      preserved: { productId: "y", explicit: true },
    }),
  ])
  assert.deepEqual(
    result.roles.map((entry) => entry.defaultProductId),
    ["x", "y"],
  )
})

test("B-OWN-1 a role covered by a kept owned product is not a new purchase", () => {
  const result = allocate(CAP15_FLEX, [
    role("shampoo", [candidate("s1", 11.95), candidate("s2", 13.95)], { ownedKept: true }),
    role("conditioner", [candidate("c1", 10.95), candidate("c2", 13.95)]),
    role("mask", [candidate("m1", 12.95), candidate("m2", 9.95)]),
  ])
  assert.equal(result.roles[0]!.defaultProductId, null)
  assert.equal(result.summary.newPurchaseCount, 2)
  assert.equal(result.summary.allowance, 1)
})

/* ---------------------------------------------------------------- no ceiling (point 16) */

test("B-OPEN-1 swaps a fit-comparable product above 15 € until round(0.6 N) is reached", () => {
  const result = allocate(UNCAPPED, [
    role("shampoo", [candidate("s1", 11.95), candidate("s2", 24.9)]),
    role("conditioner", [candidate("c1", 10.95), candidate("c2", 9.95)]),
    role("mask", [candidate("m1", 24.9), candidate("m2", 12.95)]),
  ])
  assert.deepEqual(
    result.roles.map((entry) => entry.defaultProductId),
    ["s2", "c1", "m1"],
  )
  assert.ok(
    result.roles.every((entry) =>
      entry.candidates.every((view) => view.label === "neutral" && !view.overBudget),
    ),
  )
  assert.equal(result.summary.highPriceTarget, 2)
  assert.equal(result.summary.highPriceCount, 2)
})

test("B-OPEN-2 a worse-fitting expensive product is never used to reach the target", () => {
  const result = allocate(UNCAPPED, [
    role("shampoo", [
      candidate("s1", 11.95, {}, { cautionCount: 0 }),
      candidate("s2", 24.9, {}, { cautionCount: 1 }),
    ]),
    role("conditioner", [candidate("c1", 10.95)]),
    role("mask", [candidate("m1", 24.9)]),
  ])
  assert.deepEqual(
    result.roles.map((entry) => entry.defaultProductId),
    ["s1", "c1", "m1"],
  )
  assert.equal(result.summary.highPriceCount, 1)
})

test("B-OPEN-3 above the target, a fit-comparable product at or below 15 € is swapped in", () => {
  const result = allocate(UNCAPPED, [
    role("shampoo", [candidate("s1", 24.9)]),
    role("conditioner", [candidate("c1", 21.5), candidate("c2", 13.95)]),
    role("mask", [candidate("m1", 24.9)]),
  ])
  assert.deepEqual(
    result.roles.map((entry) => entry.defaultProductId),
    ["s1", "c2", "m1"],
  )
  assert.equal(result.summary.highPriceCount, 2)
})

test("B-OPEN-4 a swap that merges two roles onto one product re-targets round(0.6 N) at once", () => {
  // Start: N = 3 (a-low, shared-high, c-low), 1 above 15 €, target round(1.8) = 2 → raise.
  // Shampoo swaps to shared-high, which the conditioner already uses: N = 2, target round(1.2) = 1,
  // and 1 product is above 15 €, so the mask keeps c-low (a frozen target of 2 would swap it too).
  const result = allocate(UNCAPPED, [
    role("shampoo", [candidate("a-low", 10), candidate("shared-high", 20)]),
    role("conditioner", [candidate("shared-high", 20)]),
    role("mask", [candidate("c-low", 10), candidate("c-high", 20)]),
  ])
  assert.deepEqual(
    result.roles.map((entry) => entry.defaultProductId),
    ["shared-high", "shared-high", "c-low"],
  )
  assert.equal(result.summary.newPurchaseCount, 2)
  assert.equal(result.summary.highPriceTarget, Math.round(0.6 * 2))
  assert.equal(result.summary.highPriceCount, 1)
})

test("B-OWN-SKIP a role passed as no new purchase (left uncovered) frees the flexible slot", () => {
  // Conditioner improvement (+16 €, closer weight) vs. a required mask with nothing affordable.
  const conditioner = role("conditioner", [
    candidate("light-pricey", 20, { "conditioner.weight": 0 }),
    candidate("medium-cheap", 4, { "conditioner.weight": 1 }),
  ])
  const pricedMask = [candidate("mask-pricey", 30)]

  // Mask as an ordinary role: N = 2 → A = 1, the gap takes it, the improvement waits.
  const bought = allocate(CAP5_FLEX, [conditioner, role("mask", pricedMask)])
  assert.equal(bought.roles[0]!.defaultProductId, "medium-cheap")
  assert.equal(bought.roles[0]!.notice, "allowance_used_elsewhere")
  assert.deepEqual(bought.roles[1]!.exception, { kind: "gap", improvedDimensionIds: [] })

  // Mask skipped: not in N, no gap, no default; N = 1 → A = 1 goes to the conditioner.
  const skipped = allocate(CAP5_FLEX, [conditioner, role("mask", pricedMask, { ownedKept: true })])
  assert.equal(skipped.roles[0]!.defaultProductId, "light-pricey")
  assert.equal(skipped.roles[0]!.notice, "flex_improvement")
  assert.equal(skipped.roles[1]!.defaultProductId, null)
  assert.equal(skipped.roles[1]!.exception, null)
  assert.deepEqual(skipped.summary, {
    newPurchaseCount: 1,
    allowance: 1,
    gapCount: 0,
    exceptionsUsed: 1,
  })
})

/* ---------------------------------------------------------------- standalone (point 35) */

test("B-STAND-1 standalone alternatives: affordable first, over-budget labelled", () => {
  const views = orderStandaloneAlternatives(
    [candidate("intensiv", 24.9), candidate("balance", 11.95)],
    CAP15_FLEX,
    3,
  )
  assert.deepEqual(
    views.map((view) => [view.productId, view.label, view.overBudget]),
    [
      ["balance", "within_budget", false],
      ["intensiv", "alternative", true],
    ],
  )
})

test("B-STAND-2 standalone under a cap drops unpriced candidates; uncapped keeps fit order", () => {
  assert.deepEqual(
    ids(orderStandaloneAlternatives([candidate("u", null), candidate("a", 4)], CAP5_STRICT, 3)),
    ["a"],
  )
  assert.deepEqual(
    ids(orderStandaloneAlternatives([candidate("hi", 30), candidate("lo", 4)], UNCAPPED, 3)),
    ["hi", "lo"],
  )
})

/* ---------------------------------------------------------------- concern mapping (point 27) */

test("B-CON-1 every concern has an entry; only weight and repair map, conservatively", () => {
  for (const concern of DIAGNOSTIC_CONCERNS) {
    assert.ok(Array.isArray(CONCERN_DIMENSIONS[concern]), `missing ${concern}`)
    for (const dimensionId of CONCERN_DIMENSIONS[concern]) {
      assert.ok(BUDGET_NEED_DIMENSIONS.has(dimensionId), `${concern} → ${dimensionId} not a need`)
    }
  }
  assert.deepEqual([...BUDGET_NEED_DIMENSIONS].sort(), [
    "conditioner.repair_support",
    "conditioner.weight",
    "leave_in.repair_support",
    "leave_in.weight",
    "mask.repair_support",
    "mask.weight",
    "oil.weight",
  ])
  for (const concern of [
    "dry_lengths",
    "frizz_flyaways",
    "low_shine",
    "lost_shape",
    "hair_loss_or_thinning",
    "split_ends",
    "tangling",
  ] as const) {
    assert.deepEqual([...CONCERN_DIMENSIONS[concern]], [], concern)
  }
  assert.deepEqual([...CONCERN_DIMENSIONS.low_volume_or_weighed_down].sort(), [
    "conditioner.weight",
    "leave_in.weight",
    "mask.weight",
    "oil.weight",
  ])
  for (const concern of ["hair_damage", "breakage"] as const) {
    assert.deepEqual([...CONCERN_DIMENSIONS[concern]].sort(), [
      "conditioner.repair_support",
      "leave_in.repair_support",
      "mask.repair_support",
    ])
  }
})

test("B-FLX-10 closer to target counts, overshooting does not", () => {
  // Distance is measured to the user's target; a product that exceeds the target is not
  // "more" improvement — its distance grows again.
  const result = allocate(
    CAP15_FLEX,
    threeRoles([
      candidate("m3", 24.9, { "mask.repair_support": 2, "mask.weight": 0 }),
      candidate("m1", 12.95, { "mask.repair_support": 1, "mask.weight": 0 }),
    ]),
  )
  assert.equal(result.roles[2]!.defaultProductId, "m1")
})

/* ---------------------------------------------------------------- Bondbuilder trust pair */

// Nick, 2026-10-09: Bondbuilders rank by claim trust level (high 0 < medium 1 < low 2). The input
// below is the production catalogue in trust order (K18 first as the house default among the
// three high-trust products), exactly as the Stage-3 ranking hands it to the policy.
function trusted(productId: string, priceEur: number | null, trustRank: number): BudgetCandidate {
  return candidate(productId, priceEur, {}, { verdict: "ideal", trustRank })
}

const BONDBUILDERS_BY_TRUST = [
  trusted("k18", 56.25, 0),
  trusted("olaplex-3plus", 34, 0),
  trusted("epres", 48, 0),
  trusted("loreal", 8.95, 1),
  trusted("redken", 25.5, 1),
  trusted("kerastase", 56.29, 1),
  trusted("ogx", 18.68, 2),
  trusted("aveda", 52, 2),
]

const bondbuilderRole = (overrides: Partial<Omit<BudgetRoleInput, "roleKey" | "ranked">> = {}) =>
  role("bondbuilder", BONDBUILDERS_BY_TRUST, { displayMode: "trust_pair", ...overrides })

// Under a cap, equally trusted products are ordered cheaper first (Nick, 2026-10-09: Olaplex and K18
// share the top trust level, so the budget comparison shows Olaplex); K18 stays the house default
// only without a cap.
test("B-TRUST-1 Bis 15 € strict: L'Oréal is the default next to the cheapest most trusted Olaplex", () => {
  const [allocation] = allocate(CAP15_STRICT, [bondbuilderRole()]).roles
  assert.equal(allocation!.defaultProductId, "loreal")
  assert.deepEqual(allocation!.candidates, [
    { productId: "loreal", overBudget: false, label: "within_budget" },
    { productId: "olaplex-3plus", overBudget: true, label: "alternative" },
    { productId: "epres", overBudget: true, label: "alternative" },
  ])
  assert.equal(allocation!.exception, null)
  assert.equal(allocation!.notice, "strict_one_affordable")
})

test("B-TRUST-2 Bis 15 € flexible: trust earns no improvement exception, the default stays affordable", () => {
  const result = allocate(CAP15_FLEX, [bondbuilderRole()])
  const [allocation] = result.roles
  assert.equal(allocation!.defaultProductId, "loreal")
  assert.deepEqual(ids(allocation!.candidates), ["loreal", "olaplex-3plus", "epres"])
  assert.equal(allocation!.exception, null)
  assert.equal(allocation!.notice, null)
  assert.equal(result.summary.exceptionsUsed, 0)
})

test("B-TRUST-3 Bis 5 € strict: nothing preselected, trust order with cheaper first per level", () => {
  const [allocation] = allocate(CAP5_STRICT, [bondbuilderRole()], { displayLimit: 8 }).roles
  assert.equal(allocation!.defaultProductId, null)
  assert.deepEqual(ids(allocation!.candidates), [
    "olaplex-3plus",
    "epres",
    "k18",
    "loreal",
    "redken",
    "kerastase",
    "ogx",
    "aveda",
  ])
  assert.ok(allocation!.candidates.every((view) => view.overBudget && view.label === "alternative"))
  assert.equal(allocation!.notice, "strict_none_affordable")
})

test("B-TRUST-4 Bis 5 € flexible required: the gap fill is the cheapest most trusted product", () => {
  const [allocation] = allocate(CAP5_FLEX, [bondbuilderRole()]).roles
  assert.equal(allocation!.defaultProductId, "olaplex-3plus")
  assert.deepEqual(allocation!.exception, { kind: "gap", improvedDimensionIds: [] })
  assert.equal(allocation!.notice, "flex_gap")
  // The rest keeps the trust order instead of the ascending price order of other categories.
  assert.deepEqual(allocation!.candidates, [
    { productId: "olaplex-3plus", overBudget: true, label: "recommended" },
    { productId: "epres", overBudget: true, label: "alternative" },
    { productId: "k18", overBudget: true, label: "alternative" },
  ])
})

test("B-TRUST-5 the most trusted product already affordable is shown once", () => {
  const [allocation] = allocate(CAP15_STRICT, [
    role(
      "bondbuilder",
      [trusted("cheap-high", 12, 0), trusted("pricey-high", 40, 0), trusted("cheap-low", 6, 2)],
      { displayMode: "trust_pair" },
    ),
  ]).roles
  assert.equal(allocation!.defaultProductId, "cheap-high")
  assert.deepEqual(ids(allocation!.candidates), ["cheap-high", "pricey-high", "cheap-low"])
})

test("B-TRUST-6 an unpriced product never counts as affordable in the trust pair", () => {
  const [allocation] = allocate(CAP15_STRICT, [
    role(
      "bondbuilder",
      [
        trusted("unpriced-high", null, 0),
        trusted("pricey-high", 40, 0),
        trusted("cheap-low", 6, 2),
      ],
      { displayMode: "trust_pair" },
    ),
  ]).roles
  assert.equal(allocation!.defaultProductId, "cheap-low")
  assert.deepEqual(ids(allocation!.candidates), ["cheap-low", "pricey-high"])
})

test("B-TRUST-7 uncapped: the price-mix swap never trades trust down", () => {
  // Uncapped with one role: the 60 % target for N = 1 is round(0.6) = 1, already met by K18, so no
  // swap; a second, cheap default would pull the target down — still no swap to lower trust.
  const result = allocate(UNCAPPED, [
    bondbuilderRole(),
    role("conditioner", [candidate("c-cheap", 4), candidate("c-pricey", 25)]),
  ])
  assert.equal(result.roles[0]!.defaultProductId, "k18")
  assert.deepEqual(ids(result.roles[0]!.candidates), ["k18", "olaplex-3plus", "epres"])

  // Lowering: three high-price roles push the target down; the Bondbuilder would only swap to a
  // fit-comparable product at or below 15 €, and the only one (L'Oréal) is less trusted.
  const lowered = allocate(UNCAPPED, [
    bondbuilderRole(),
    role("mask", [candidate("m-pricey", 30), candidate("m-other", 32)]),
    role("oil", [candidate("o-pricey", 30), candidate("o-other", 31)]),
  ])
  assert.equal(lowered.roles[0]!.defaultProductId, "k18")
  // Without the trust ranks the same pool would swap down to L'Oréal.
  const blind = allocate(UNCAPPED, [
    role(
      "bondbuilder",
      BONDBUILDERS_BY_TRUST.map(({ trustRank: _trustRank, ...rest }) => rest),
    ),
    role("mask", [candidate("m-pricey", 30), candidate("m-other", 32)]),
    role("oil", [candidate("o-pricey", 30), candidate("o-other", 31)]),
  ])
  assert.equal(blind.roles[0]!.defaultProductId, "loreal")
})

test("B-TRUST-8 standalone trust pair (chat) under a cap and uncapped", () => {
  assert.deepEqual(orderTrustPairAlternatives(BONDBUILDERS_BY_TRUST, CAP15_STRICT, 2), [
    { productId: "loreal", overBudget: false, label: "within_budget" },
    { productId: "olaplex-3plus", overBudget: true, label: "alternative" },
  ])
  assert.deepEqual(ids(orderTrustPairAlternatives(BONDBUILDERS_BY_TRUST, CAP5_STRICT, 2)), [
    "olaplex-3plus",
    "epres",
  ])
  assert.deepEqual(ids(orderTrustPairAlternatives(BONDBUILDERS_BY_TRUST, UNCAPPED, 2)), [
    "k18",
    "olaplex-3plus",
  ])
})

test("B-TRUST-UNCAPPED-UNPRICED uncapped trust pair starts from the most trusted product even unpriced", () => {
  const unpricedHighTrust = BONDBUILDERS_BY_TRUST.map((entry) =>
    entry.trustRank === 0 ? { ...entry, priceEur: null } : entry,
  )
  const [allocation] = allocate(UNCAPPED, [
    role("bondbuilder", unpricedHighTrust, { displayMode: "trust_pair" }),
  ]).roles
  assert.equal(allocation!.defaultProductId, "k18")
  assert.deepEqual(ids(allocation!.candidates), ["k18", "olaplex-3plus", "epres"])

  // Default mode keeps its first-priced start for every other category: it skips the unpriced
  // products, starts from L'Oréal and the 60 % nudge (N = 1, target 1) then lifts it to the next
  // fit-comparable product above 15 € (Redken) — never to an unpriced one.
  const [defaultMode] = allocate(UNCAPPED, [role("conditioner", unpricedHighTrust)]).roles
  assert.equal(defaultMode!.defaultProductId, "redken")
})
