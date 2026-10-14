import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import { createPersonalPlanRoutineProposalRouteHandlers } from "../src/app/api/personal-plan/routine/proposals/route"
import { resolveRoutinePage } from "../src/app/routine/page"
import {
  countRoutineProductsOverBudget,
  loadRoutineProductPricesEur,
  loadRoutineShoppingBudget,
  plannedRoutineProductIds,
  routineOverBudgetNoticeText,
} from "../src/lib/personal-plan/routine/budget-gate"
import type {
  PersonalPlanRoutineView,
  RoutinePayloadV1,
} from "../src/lib/personal-plan/routine/contracts"
import type { ShoppingBudget } from "../src/lib/user-facts/schema"

const stage4Access = {
  kind: "personal_plan" as const,
  personalPlanId: "plan-1",
  frontier: "stage4" as const,
  nextHref: "/routine" as const,
  allowed: { stage1: true, stage2: true, stage3: true, stage4: true, stage5: false },
}
const BODY = JSON.stringify({
  expectedRevision: 1,
  expectedSourceRevision: 1,
  operations: [{ kind: "assignment_remove", assignmentKey: "assignment:a" }],
})
const request = () =>
  new Request("http://local/api/personal-plan/routine/proposals", { method: "POST", body: BODY })

function route(options: {
  budgetGate?: Parameters<typeof createPersonalPlanRoutineProposalRouteHandlers>[0]["budgetGate"]
  proposed?: unknown[]
}) {
  return createPersonalPlanRoutineProposalRouteHandlers({
    enabled: () => true,
    getUserId: async () => "owner-1",
    loadJourneyAccess: async () => stage4Access,
    service: () =>
      ({
        propose: async (input: unknown) => {
          options.proposed?.push(input)
          return { status: "ok" }
        },
      }) as never,
    ...(options.budgetGate ? { budgetGate: options.budgetGate } : {}),
  })
}

const CAPPED: ShoppingBudget = { kind: "capped", limitEur: 15, allowExceptions: true }

/* --------------------------------------------------------------- proposal route */

test("flag on and no budget: 409 budget_required before any proposal is created", async () => {
  const proposed: unknown[] = []
  const response = await route({
    proposed,
    budgetGate: { enabled: () => true, load: async () => null },
  }).POST(request())
  assert.deepEqual([response.status, await response.json()], [409, { error: "budget_required" }])
  assert.equal(proposed.length, 0)
})

test("flag on and a saved budget (capped or uncapped): the proposal is created as before", async () => {
  for (const budget of [CAPPED, { kind: "uncapped" } as const]) {
    const proposed: unknown[] = []
    const response = await route({
      proposed,
      budgetGate: { enabled: () => true, load: async () => budget },
    }).POST(request())
    assert.equal(response.status, 200)
    assert.equal(proposed.length, 1)
  }
})

test("flag off: the budget is never read and the route is unchanged", async () => {
  let loads = 0
  const proposed: unknown[] = []
  const response = await route({
    proposed,
    budgetGate: {
      enabled: () => false,
      load: async () => {
        loads += 1
        return null
      },
    },
  }).POST(request())
  assert.equal(response.status, 200)
  assert.equal(loads, 0)
  assert.equal(proposed.length, 1)

  const withoutGate = await route({}).POST(request())
  assert.equal(withoutGate.status, 200)
})

test("a budget read failure answers 503 and creates no proposal", async () => {
  const proposed: unknown[] = []
  const response = await route({
    proposed,
    budgetGate: {
      enabled: () => true,
      load: async () => {
        throw new Error("db down")
      },
    },
  }).POST(request())
  assert.deepEqual(
    [response.status, await response.json()],
    [503, { error: "temporarily_unavailable" }],
  )
  assert.equal(proposed.length, 0)
})

test("the gate checks the stage and the body first (401, stage_not_ready and 400 are unchanged)", async () => {
  let loads = 0
  const budgetGate = {
    enabled: () => true,
    load: async () => {
      loads += 1
      return null
    },
  }
  const invalid = await route({ budgetGate }).POST(
    new Request("http://local/x", { method: "POST", body: "{}" }),
  )
  assert.equal(invalid.status, 400)
  const early = await createPersonalPlanRoutineProposalRouteHandlers({
    enabled: () => true,
    getUserId: async () => null,
    loadJourneyAccess: async () => stage4Access,
    service: () => ({}) as never,
    budgetGate,
  }).POST(request())
  assert.equal(early.status, 401)
  assert.equal(loads, 0)
})

test("the gate lives only in the user proposal route, never in background recompute or sync", () => {
  const root = path.resolve(process.cwd(), "src")
  const offenders: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(ts|tsx)$/.test(entry.name)) {
        const source = readFileSync(full, "utf8")
        if (!/personal-plan\/routine\/budget-gate|ROUTINE_BUDGET_REQUIRED_ERROR/.test(source))
          continue
        offenders.push(path.relative(root, full))
      }
    }
  }
  walk(path.join(root, "lib", "personal-plan"))
  walk(path.join(root, "app", "api"))
  assert.deepEqual(
    offenders.filter(
      (file) => file !== path.join("lib", "personal-plan", "routine", "budget-gate.ts"),
    ),
    [path.join("app", "api", "personal-plan", "routine", "proposals", "route.ts")],
  )
})

/* ---------------------------------------------------------------------- loaders */

function adminReturning(result: { data: unknown; error: unknown }, seen: string[] = []) {
  const chain: Record<string, unknown> = {
    select: (columns: string) => {
      seen.push(columns)
      return chain
    },
    eq: () => chain,
    in: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
  }
  return { from: (table: string) => (seen.push(table), chain) } as never
}

test("loadRoutineShoppingBudget: missing and invalid are null; a read error throws", async () => {
  const seen: string[] = []
  assert.deepEqual(
    await loadRoutineShoppingBudget(
      adminReturning({ data: { shopping_preferences: { budget: CAPPED } }, error: null }, seen),
      "u",
    ),
    CAPPED,
  )
  assert.deepEqual(seen, ["hair_profiles", "shopping_preferences"], "a narrow read")
  for (const data of [
    null,
    { shopping_preferences: null },
    { shopping_preferences: {} },
    { shopping_preferences: { budget: { kind: "capped", limitEur: 7, allowExceptions: true } } },
  ]) {
    assert.equal(await loadRoutineShoppingBudget(adminReturning({ data, error: null }), "u"), null)
  }
  await assert.rejects(
    loadRoutineShoppingBudget(adminReturning({ data: null, error: new Error("x") }), "u"),
  )
})

test("loadRoutineProductPricesEur keeps only finite positive prices and fails open", async () => {
  const prices = await loadRoutineProductPricesEur(
    adminReturning({
      data: [
        { id: "a", price_eur: 4.95 },
        { id: "b", price_eur: "12.5" },
        { id: "c", price_eur: null },
        { id: "d", price_eur: 0 },
      ],
      error: null,
    }),
    ["a", "b", "c", "d"],
  )
  assert.deepEqual(prices, { a: 4.95, b: 12.5 })
  assert.deepEqual(
    await loadRoutineProductPricesEur(adminReturning({ data: null, error: new Error("x") }), ["a"]),
    {},
  )
  assert.deepEqual(
    await loadRoutineProductPricesEur(adminReturning({ data: [], error: null }), []),
    {},
  )
})

/* -------------------------------------------------------------------- the notice */

function payloadWith(items: Array<{ id: string; kind: "planned" | "owned"; included?: boolean }>) {
  return {
    items: items.map((entry, index) => ({
      itemKey: `item:${index}`,
      state: { inclusion: entry.included === false ? "excluded" : "included" },
      product:
        entry.kind === "planned"
          ? { kind: "planned", plannedPurchaseId: `pp-${index}`, productId: entry.id }
          : { kind: "owned", capturedProductId: `c-${index}`, productId: entry.id },
    })),
  } as unknown as RoutinePayloadV1
}

test("only included, planned products above a capped limit are counted (strictly above)", () => {
  const payload = payloadWith([
    { id: "a", kind: "planned" },
    { id: "b", kind: "planned" },
    { id: "c", kind: "planned", included: false },
    { id: "d", kind: "owned" },
    { id: "e", kind: "planned" },
  ])
  const pricesEur = { a: 5.01, b: 5, c: 40, d: 40 }
  const budget: ShoppingBudget = { kind: "capped", limitEur: 5, allowExceptions: false }
  assert.deepEqual(plannedRoutineProductIds(payload), ["a", "b", "e"])
  assert.equal(countRoutineProductsOverBudget({ payload, budget, pricesEur }), 1)
  assert.equal(
    countRoutineProductsOverBudget({ payload, budget: { kind: "uncapped" }, pricesEur }),
    0,
  )
  assert.equal(countRoutineProductsOverBudget({ payload, budget: null, pricesEur }), 0)
  assert.equal(countRoutineProductsOverBudget({ payload, budget, pricesEur: undefined }), 0)
})

test("notice copy: 0 none, 1 singular, N plural", () => {
  assert.equal(routineOverBudgetNoticeText(0), null)
  assert.equal(
    routineOverBudgetNoticeText(1),
    "Ein Produkt liegt über deinem Budget. Es bleibt, bis du neue Vorschläge übernimmst.",
  )
  assert.equal(
    routineOverBudgetNoticeText(3),
    "3 Produkte liegen über deinem Budget. Sie bleiben, bis du neue Vorschläge übernimmst.",
  )
})

/* ------------------------------------------------------- page server projection */

const view: PersonalPlanRoutineView = {
  status: "active",
  personalPlanId: "plan-1",
  planRevision: 3,
  sourceRevision: 4,
  activeVersion: {
    id: "routine-1",
    payload: {
      ...payloadWith([
        { id: "a", kind: "planned" },
        { id: "d", kind: "owned" },
      ]),
      source: { productPortfolioVersionId: "portfolio-1" },
    } as unknown as RoutinePayloadV1,
  },
  pendingProposal: null,
}
const baseDeps = {
  getUserId: async () => "user-1",
  loadJourneyAccess: async () => stage4Access,
  stage4Enabled: () => true,
  readView: async () => view,
}

test("flag on: the page gets the saved budget and the prices of its planned products", async () => {
  const requested: string[][] = []
  const result = await resolveRoutinePage({
    ...baseDeps,
    shoppingBudgetEnabled: () => true,
    readShoppingBudget: async () => CAPPED,
    readProductPricesEur: async (ids) => (requested.push(ids), { a: 9 }),
  })
  assert.equal(result.kind, "personal_plan")
  if (result.kind !== "personal_plan") return
  assert.deepEqual(result.budgetProjection, {
    shoppingBudget: CAPPED,
    productPricesEur: { a: 9 },
  })
  assert.deepEqual(requested, [["a"]])
})

test("flag on and no budget: null is projected and no price is read", async () => {
  let priceReads = 0
  const result = await resolveRoutinePage({
    ...baseDeps,
    shoppingBudgetEnabled: () => true,
    readShoppingBudget: async () => null,
    readProductPricesEur: async () => (priceReads++, {}),
  })
  assert.equal(result.kind, "personal_plan")
  if (result.kind !== "personal_plan") return
  assert.deepEqual(result.budgetProjection, { shoppingBudget: null, productPricesEur: {} })
  assert.equal(priceReads, 0)
})

test("flag on but the budget cannot be read: no projection, so no client gate", async () => {
  const result = await resolveRoutinePage({
    ...baseDeps,
    shoppingBudgetEnabled: () => true,
    readShoppingBudget: async () => {
      throw new Error("db down")
    },
  })
  assert.equal(result.kind, "personal_plan")
  assert.equal("budgetProjection" in result, false)
})

test("flag off: nothing is read and the result has no budget key", async () => {
  let reads = 0
  const result = await resolveRoutinePage({
    ...baseDeps,
    shoppingBudgetEnabled: () => false,
    readShoppingBudget: async () => (reads++, null),
    readProductPricesEur: async () => (reads++, {}),
  })
  assert.equal(reads, 0)
  assert.equal("budgetProjection" in result, false)
})
