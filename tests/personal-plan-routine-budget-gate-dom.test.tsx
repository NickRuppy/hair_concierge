// The jsdom globals must exist before React DOM and @testing-library load.
import { domWindow } from "./helpers/dom"

import assert from "node:assert/strict"
import { afterEach, test } from "node:test"

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import {
  PathnameContext,
  SearchParamsContext,
} from "next/dist/shared/lib/hooks-client-context.shared-runtime"
import React from "react"

import { PersonalPlanRoutineClient } from "../src/components/routine/personal-plan/personal-plan-routine-client"
import type {
  PersonalPlanRoutineView,
  RoutinePayloadV1,
} from "../src/lib/personal-plan/routine/contracts"
import type { ShoppingBudget } from "../src/lib/user-facts/schema"

/*
 * Journey 4 (Task 6) on the client: viewing a routine without a saved budget needs nothing; the
 * budget is asked only when an edit STARTS, the intended edit resumes after a successful save,
 * and cancel or a failed save leaves the routine unchanged. The server's `budget_required` is
 * treated like the gate, and the same operations are resubmitted exactly once.
 */

// Node ships its own Event/CustomEvent; the page dispatches on jsdom's window, which only
// accepts jsdom's.
Object.defineProperty(globalThis, "CustomEvent", {
  configurable: true,
  value: domWindow.CustomEvent,
})
Object.defineProperty(globalThis, "Event", { configurable: true, value: domWindow.Event })

const originalFetch = globalThis.fetch

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
})

function plannedItem(n: number, productId: string) {
  return {
    itemKey: `item:shampoo:cleanse:${n}`,
    assignmentKey: `assignment:shampoo:cleanse:${n}`,
    category: "shampoo",
    role: "cleanse",
    purposeKey: "cleanse",
    roleOrder: n,
    state: {
      systemAssessment: "basis",
      inclusion: "included",
      availability: "planned",
      fitDecision: "standard",
    },
    product: {
      kind: "planned",
      plannedPurchaseId: `planned-${n}`,
      productId,
      displayName: `Shampoo ${n}`,
    },
    cadence: { recommended: null, userOverride: null, displayKey: "daily" },
    sourceDecisionKeys: [],
    authorityRuleIds: [],
    executable: true,
  } as unknown as RoutinePayloadV1["items"][number]
}

function ownedItem(n: number, productId: string) {
  return {
    ...plannedItem(n, productId),
    state: {
      systemAssessment: "basis",
      inclusion: "included",
      availability: "owned",
      fitDecision: "standard",
    },
    product: {
      kind: "owned",
      capturedProductId: `captured-${n}`,
      productId,
      displayName: `Eigenes Shampoo ${n}`,
    },
  } as unknown as RoutinePayloadV1["items"][number]
}

function viewWith(items: RoutinePayloadV1["items"]): PersonalPlanRoutineView {
  return {
    status: "active",
    personalPlanId: "plan-1",
    planRevision: 3,
    sourceRevision: 4,
    activeVersion: {
      id: "routine-1",
      payload: {
        schemaVersion: 1,
        planId: "11111111-1111-4111-8111-111111111111",
        versionId: "routine-1",
        parentVersionId: null,
        source: {
          refinedVersionId: "22222222-2222-4222-8222-222222222222",
          productPortfolioVersionId: "portfolio-1",
          sourceFingerprint: "a".repeat(64),
          compilerVersion: "test",
          authorityVersions: {},
        },
        intent: { schemaVersion: 1, categories: [] },
        sections: [
          { key: "basis", itemKeys: items.map((entry) => entry.itemKey) },
          { key: "optional", itemKeys: [] },
        ],
        items,
        createdAt: "2026-08-08T00:00:00.000Z",
      },
    },
    pendingProposal: null,
  }
}

const pushes: string[] = []
const router = {
  push: (href: string) => {
    pushes.push(href)
  },
  replace: () => undefined,
  refresh: () => undefined,
  back: () => undefined,
  forward: () => undefined,
  prefetch: () => undefined,
} as never

type Calls = { proposals: string[]; budgetSaves: unknown[]; reloads: number }

function installFetch(options: { proposalResponses?: Array<{ status: number; body: unknown }> }) {
  const calls: Calls = { proposals: [], budgetSaves: [], reloads: 0 }
  const proposalResponses = [...(options.proposalResponses ?? [])]
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    if (url === "/api/personal-plan/routine/sync") return json(200, { proposalStaged: false })
    if (url === "/api/profile/shopping-preferences") {
      const body = JSON.parse(String(init?.body)) as { budget: ShoppingBudget }
      calls.budgetSaves.push(body.budget)
      return json(200, { budget: body.budget })
    }
    if (url === "/api/personal-plan/routine/proposals") {
      calls.proposals.push(String(init?.body))
      const next = proposalResponses.shift() ?? { status: 200, body: { status: "ok" } }
      return json(next.status, next.body)
    }
    if (url === "/api/personal-plan/routine") {
      calls.reloads += 1
      return json(200, viewWith([ownedItem(1, "product-1")]))
    }
    return json(404, { error: "not_found" })
  }) as typeof fetch
  return calls
}

function mount(props: {
  view?: PersonalPlanRoutineView
  shoppingBudget?: ShoppingBudget | null
  productPricesEur?: Record<string, number>
}) {
  return render(
    <AppRouterContext.Provider value={router}>
      <PathnameContext.Provider value="/routine">
        <SearchParamsContext.Provider value={new URLSearchParams() as never}>
          <PersonalPlanRoutineClient
            initialView={props.view ?? viewWith([ownedItem(1, "product-1")])}
            enabled
            {...("shoppingBudget" in props ? { shoppingBudget: props.shoppingBudget } : {})}
            {...(props.productPricesEur ? { productPricesEur: props.productPricesEur } : {})}
          />
        </SearchParamsContext.Provider>
      </PathnameContext.Provider>
    </AppRouterContext.Provider>,
  )
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }))
const GATE_LINE = "Kurz eine Frage, dann geht es mit deiner Änderung weiter."
const BUDGET_HEADING = "Was darf ein Pflegeprodukt ungefähr kosten?"

async function answerUncapped() {
  fireEvent.click(screen.getByRole("button", { name: "Keine feste Preisgrenze" }))
  await act(async () => click("Weiter"))
}

test("viewing the routine without a saved budget asks nothing", () => {
  installFetch({})
  mount({ shoppingBudget: null })
  screen.getByRole("heading", { name: "Deine Routine" })
  assert.equal(screen.queryByText(GATE_LINE), null)
  assert.equal(screen.queryByRole("heading", { name: BUDGET_HEADING }), null)
})

test("starting an edit without a budget asks first, then resumes the editor after the save", async () => {
  const calls = installFetch({})
  mount({ shoppingBudget: null })

  click("Anpassen")
  screen.getByText(GATE_LINE)
  screen.getByRole("heading", { name: BUDGET_HEADING })
  assert.equal(screen.queryByRole("heading", { name: "Eine Änderung, ganze Routine" }), null)

  await answerUncapped()
  assert.deepEqual(calls.budgetSaves, [{ kind: "uncapped" }])
  await screen.findByRole("heading", { name: "Eine Änderung, ganze Routine" })
  assert.equal(screen.queryByText(GATE_LINE), null)
  assert.equal(calls.proposals.length, 0, "a budget save never creates a proposal")
})

test("cancelling the question leaves the routine unchanged", () => {
  const calls = installFetch({})
  mount({ shoppingBudget: null })
  click("Anpassen")
  click("Abbrechen")
  screen.getByRole("heading", { name: "Deine Routine" })
  assert.equal(screen.queryByRole("heading", { name: "Eine Änderung, ganze Routine" }), null)
  assert.deepEqual(calls.budgetSaves, [])
  assert.equal(calls.proposals.length, 0)
})

test("a failed save keeps the question open and does not open the editor", async () => {
  installFetch({})
  globalThis.fetch = (async (input: RequestInfo | URL) =>
    String(input) === "/api/profile/shopping-preferences"
      ? new Response("{}", { status: 503 })
      : new Response("{}", { status: 200 })) as typeof fetch
  mount({ shoppingBudget: null })
  click("Anpassen")
  await answerUncapped()
  screen.getByRole("alert")
  screen.getByRole("heading", { name: BUDGET_HEADING })
  assert.equal(screen.queryByRole("heading", { name: "Eine Änderung, ganze Routine" }), null)
})

test("a saved budget (or the flag off) opens the editor directly", () => {
  installFetch({})
  mount({ shoppingBudget: { kind: "uncapped" } })
  click("Anpassen")
  screen.getByRole("heading", { name: "Eine Änderung, ganze Routine" })
  assert.equal(screen.queryByText(GATE_LINE), null)
  cleanup()

  // Flag off: the prop is absent altogether.
  mount({})
  click("Anpassen")
  screen.getByRole("heading", { name: "Eine Änderung, ganze Routine" })
  assert.equal(screen.queryByText(GATE_LINE), null)
})

test("the server's budget_required asks the question, then resubmits the same operations once", async () => {
  const calls = installFetch({
    proposalResponses: [{ status: 409, body: { error: "budget_required" } }],
  })
  // The page could not read the budget (prop absent): the editor opens, the server is the net.
  mount({})
  click("Anpassen")
  fireEvent.click(screen.getByLabelText("Kategorie einplanen"))
  click("Änderungen prüfen")
  await waitFor(() => screen.getByText(GATE_LINE))
  assert.equal(calls.proposals.length, 1)

  await answerUncapped()
  await waitFor(() => assert.equal(calls.proposals.length, 2))
  assert.equal(calls.proposals[1], calls.proposals[0], "the same operations, resubmitted")
  assert.equal(calls.budgetSaves.length, 1)
  await waitFor(() => screen.getByRole("heading", { name: "Deine Routine" }))
})

test("a second budget_required after the save does not loop", async () => {
  const calls = installFetch({
    proposalResponses: [
      { status: 409, body: { error: "budget_required" } },
      { status: 409, body: { error: "budget_required" } },
    ],
  })
  mount({})
  click("Anpassen")
  fireEvent.click(screen.getByLabelText("Kategorie einplanen"))
  click("Änderungen prüfen")
  await waitFor(() => screen.getByText(GATE_LINE))
  await answerUncapped()
  await waitFor(() => assert.equal(calls.proposals.length, 2))
  await waitFor(() => screen.getByRole("heading", { name: "Eine Änderung, ganze Routine" }))
  assert.equal(calls.proposals.length, 2, "exactly one resubmission")
  assert.equal(screen.queryByText(GATE_LINE), null)
})

test("cancelling the safety-net question submits nothing and keeps the editor's changes", async () => {
  const calls = installFetch({
    proposalResponses: [{ status: 409, body: { error: "budget_required" } }],
  })
  mount({})
  click("Anpassen")
  const checkbox = screen.getByLabelText("Kategorie einplanen") as HTMLInputElement
  fireEvent.click(checkbox)
  click("Änderungen prüfen")
  await waitFor(() => screen.getByText(GATE_LINE))
  click("Abbrechen")
  assert.equal(calls.proposals.length, 1)
  assert.equal(calls.budgetSaves.length, 0)
  assert.equal((screen.getByLabelText("Kategorie einplanen") as HTMLInputElement).checked, false)
})

/* ------------------------------------------------------------- summary notice */

const THREE = viewWith([
  plannedItem(1, "p-1"),
  plannedItem(2, "p-2"),
  plannedItem(3, "p-3"),
  ownedItem(4, "p-owned"),
])
const CAPPED_5: ShoppingBudget = { kind: "capped", limitEur: 5, allowExceptions: false }

test("the summary notice counts accepted planned products above a capped budget (N = 3)", () => {
  installFetch({})
  mount({
    view: THREE,
    shoppingBudget: CAPPED_5,
    productPricesEur: { "p-1": 5.01, "p-2": 12, "p-3": 30, "p-owned": 99 },
  })
  screen.getByText(
    "3 Produkte liegen über deinem Budget. Sie bleiben, bis du neue Vorschläge übernimmst.",
  )
  screen.getByRole("button", { name: "Neue Vorschläge ansehen" })
})

test("the summary notice uses the singular for N = 1 and the link opens the products module", () => {
  installFetch({})
  pushes.length = 0
  mount({
    view: THREE,
    shoppingBudget: CAPPED_5,
    productPricesEur: { "p-1": 5, "p-2": 4.99, "p-3": 7.5 },
  })
  screen.getByText(
    "Ein Produkt liegt über deinem Budget. Es bleibt, bis du neue Vorschläge übernimmst.",
  )
  click("Neue Vorschläge ansehen")
  assert.deepEqual(pushes, ["/plan-start?refine=products"])
})

test("no notice for N = 0, an uncapped budget, no budget, unknown prices or the flag off", () => {
  const notice = /über deinem Budget/
  installFetch({})
  mount({ view: THREE, shoppingBudget: CAPPED_5, productPricesEur: { "p-1": 5, "p-2": 3 } })
  assert.equal(screen.queryByText(notice), null)
  cleanup()
  mount({ view: THREE, shoppingBudget: { kind: "uncapped" }, productPricesEur: { "p-1": 50 } })
  assert.equal(screen.queryByText(notice), null)
  cleanup()
  mount({ view: THREE, shoppingBudget: null, productPricesEur: { "p-1": 50 } })
  assert.equal(screen.queryByText(notice), null)
  cleanup()
  mount({ view: THREE, shoppingBudget: CAPPED_5 })
  assert.equal(screen.queryByText(notice), null)
  cleanup()
  mount({ view: THREE })
  assert.equal(screen.queryByText(notice), null)
})

test("the notice link never asks for a budget a capped member already has", () => {
  installFetch({})
  mount({ view: THREE, shoppingBudget: CAPPED_5, productPricesEur: { "p-1": 9 } })
  click("Neue Vorschläge ansehen")
  assert.equal(screen.queryByText(GATE_LINE), null)
})
