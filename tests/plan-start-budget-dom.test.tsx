// The jsdom globals must exist before React DOM and @testing-library load.
import "./helpers/dom"

import assert from "node:assert/strict"
import { afterEach, test } from "node:test"

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"

import { BudgetQuestion } from "../src/components/budget/budget-question"
import {
  interpretAcceptIdealPlanResponse,
  runAcceptIdealPlanFlow,
} from "../src/components/personal-plan-journey/accept-ideal-plan"
import {
  PLAN_START_ACCEPT_LABEL,
  PLAN_START_BUDGET_FIRST_LABEL,
} from "../src/components/personal-plan-start/need-plan-screen"
import {
  countPlanStartBudgetSwaps,
  planStartBudgetAdjustedNotice,
  PlanStartCustomerJourney,
} from "../src/components/personal-plan-start/plan-start-flow"
import type { Stage1ProductExamplePreviewResponse } from "../src/lib/personal-plan/product-preview-contract"
import type { ShoppingBudget } from "../src/lib/user-facts/schema"

/*
 * Journey 5 on the client (Task 5): the accept CTA reads „Weiter“ while no budget is saved,
 * opens the budget question, re-derives the proposal after a successful save, says how many
 * products changed, and accepts only on a fresh explicit tap. Cancel and failure never accept.
 */

const originalFetch = globalThis.fetch

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
})

/* ---------------------------------------------------------------- pure pieces */

test("budget_required maps to the budget step, never a retry", async () => {
  assert.deepEqual(interpretAcceptIdealPlanResponse(409, { error: "budget_required" }), {
    kind: "budget_required",
  })
  let accepts = 0
  let refreshes = 0
  const effect = await runAcceptIdealPlanFlow({
    seenRoles: [],
    accept: async () => {
      accepts += 1
      return { kind: "budget_required" }
    },
    refreshSeenRoles: async () => {
      refreshes += 1
      return []
    },
  })
  assert.deepEqual(effect, { kind: "ask_budget" })
  assert.equal(accepts, 1)
  assert.equal(refreshes, 0)
})

function preview(decisionKey: string, productId: string) {
  return {
    kind: "recommendation" as const,
    category: "conditioner" as const,
    role: "conditioner_rinse_out" as const,
    decisionKey,
    productId,
    productName: `Conditioner ${productId}`,
    imageUrl: `https://example.com/${productId}.webp`,
    verdict: "ideal" as const,
    authorityVersion: "personal-plan.conditioner.v3",
    factFingerprint: `facts-${productId}`,
    commerce: {
      priceEur: 4,
      purchaseLinkStatus: "available" as const,
      netContentValue: null,
      netContentUnit: null,
      priceLabel: "4,00 €",
      netContentLabel: null,
      availabilityLabel: null,
      productUrl: null,
      affiliateDisclosure: null,
    },
    reasoning: { productCriteria: "x", fit: "y", frequency: "z" },
  } as Stage1ProductExamplePreviewResponse["previews"][number]
}

function previewResponse(
  previews: Stage1ProductExamplePreviewResponse["previews"],
): Stage1ProductExamplePreviewResponse {
  return {
    schemaVersion: 2,
    personalPlanId: "plan-1",
    sourceNeedVersionId: "need-1",
    sourceInputHash: "input-1",
    previews,
    directAcceptance: { available: true },
  }
}

test("the swap count compares every previewed role's product before and after", () => {
  const before = previewResponse([preview("a", "a-hi"), preview("b", "b-1"), preview("c", "c-1")])
  const after = previewResponse([preview("a", "a-lo"), preview("b", "b-1")])
  // a changed, c lost its product, b stayed.
  assert.equal(countPlanStartBudgetSwaps(before, after), 2)
  assert.equal(countPlanStartBudgetSwaps(before, before), 0)
  assert.equal(planStartBudgetAdjustedNotice(0), "Passt schon zu deinem Budget. Nichts getauscht.")
  assert.equal(planStartBudgetAdjustedNotice(1), "An dein Budget angepasst: 1 Produkt getauscht.")
  assert.equal(planStartBudgetAdjustedNotice(3), "An dein Budget angepasst: 3 Produkte getauscht.")
})

/* ---------------------------------------------------------------- BudgetQuestion */

function budgetQuestion(
  results: Array<"saved" | "conflict" | "unavailable">,
  extra: { onCancel?: () => void } = {},
) {
  const saves: ShoppingBudget[] = []
  const saved: ShoppingBudget[] = []
  render(
    <BudgetQuestion
      save={async (budget) => {
        saves.push(budget)
        const status = results.shift() ?? "saved"
        return status === "saved" ? { status, budget } : { status }
      }}
      onSaved={(budget) => void saved.push(budget)}
      {...extra}
    />,
  )
  return { saves, saved }
}

const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }))

test("BudgetQuestion: a capped answer asks the follow-up, then saves strict/flexible", async () => {
  const { saves, saved } = budgetQuestion(["saved"])
  screen.getByText("Dein Budget")
  screen.getByRole("heading", { name: "Was darf ein Pflegeprodukt ungefähr kosten?" })
  screen.getByText("Preis pro Packung – gilt für jedes Produkt deiner Routine.")

  click("Bis 15 €")
  click("Weiter")
  screen.getByRole("heading", { name: "Bis 15 € für jedes Produkt?" })
  screen.getByText("Teurere zeigen wir nur, wenn es im Budget kaum Passendes gibt.")
  screen.getByText("Nur einzelne – wenn sie deutlich besser passen.")
  assert.deepEqual(saves, [], "nothing is stored before the answer is complete")

  fireEvent.click(screen.getByRole("button", { name: /Einzelne dürfen mehr kosten\./ }))
  await act(async () => click("Weiter"))
  assert.deepEqual(saves, [{ kind: "capped", limitEur: 15, allowExceptions: true }])
  assert.deepEqual(saved, saves)
})

test("BudgetQuestion: no fixed limit saves directly without a follow-up", async () => {
  const { saves } = budgetQuestion(["saved"])
  click("Keine feste Preisgrenze")
  await act(async () => click("Weiter"))
  assert.deepEqual(saves, [{ kind: "uncapped" }])
})

test("BudgetQuestion: a failed save keeps the answer and offers „Erneut versuchen“", async () => {
  const { saves, saved } = budgetQuestion(["unavailable", "saved"])
  click("Bis 5 €")
  click("Weiter")
  fireEvent.click(screen.getByRole("button", { name: /Ja, für jedes\./ }))
  await act(async () => click("Weiter"))
  screen.getByText("Nicht gespeichert. Deine Auswahl bleibt erhalten.")
  assert.deepEqual(saved, [])
  await act(async () => click("Erneut versuchen"))
  assert.deepEqual(saves, [
    { kind: "capped", limitEur: 5, allowExceptions: false },
    { kind: "capped", limitEur: 5, allowExceptions: false },
  ])
  assert.equal(saved.length, 1)
})

test("BudgetQuestion: a conflict says so and retries with „Meine Auswahl speichern“", async () => {
  const { saves, saved } = budgetQuestion(["conflict", "saved"])
  click("Keine feste Preisgrenze")
  await act(async () => click("Weiter"))
  screen.getByText(
    "Dein Budget wurde gerade an anderer Stelle geändert. Deine Auswahl ist noch nicht gespeichert.",
  )
  await act(async () => click("Meine Auswahl speichern"))
  assert.equal(saves.length, 2)
  assert.deepEqual(saved, [{ kind: "uncapped" }])
})

test("BudgetQuestion: „Abbrechen“ leaves without storing anything", () => {
  let cancelled = 0
  const { saves } = budgetQuestion([], { onCancel: () => (cancelled += 1) })
  click("Bis 5 €")
  click("Abbrechen")
  assert.equal(cancelled, 1)
  assert.deepEqual(saves, [])
})

/* ---------------------------------------------------------------- the Idealplan journey */

const readyPlanScreen = {
  kind: "basis" as const,
  overline: "Dein persönlicher Plan",
  title: "Deine Basis",
  lead: "Das braucht dein Haar.",
  sectionTitle: "Basis",
  countLabel: "1 Kategorie",
  cards: [],
  progress: 100 as const,
}

type Requests = { previews: number; budgetSaves: unknown[]; accepts: unknown[] }

function routeFetch(options: {
  previews: Stage1ProductExamplePreviewResponse[]
  accept: () => { status: number; body: unknown }
}): Requests {
  const requests: Requests = { previews: 0, budgetSaves: [], accepts: [] }
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    if (url.startsWith("/api/personal-plan/stage-1/previews")) {
      const response = options.previews[Math.min(requests.previews, options.previews.length - 1)]
      requests.previews += 1
      return json(response)
    }
    if (url === "/api/profile/shopping-preferences") {
      const body = JSON.parse(String(init?.body))
      requests.budgetSaves.push(body)
      return json({ budget: body.budget, revision: 2 })
    }
    if (url === "/api/personal-plan/accept-ideal-plan") {
      requests.accepts.push(JSON.parse(String(init?.body)))
      const result = options.accept()
      return json(result.body, result.status)
    }
    throw new Error(`unexpected fetch ${url}`)
  }) as typeof fetch
  return requests
}

function renderJourney(shoppingBudgetRequired: boolean, routes: string[]) {
  render(
    <PlanStartCustomerJourney
      initialPlan={{
        basis: readyPlanScreen,
        optional: null,
        personalPlanId: "plan-1",
        sourceInputHash: "input-1",
      }}
      initialJourney={{
        stage: "stage1",
        directAcceptanceAvailable: true,
        ...(shoppingBudgetRequired ? { shoppingBudgetRequired: true } : {}),
      }}
      personalPlanId="plan-1"
      replaceRoute={(href) => routes.push(href)}
    />,
  )
}

/**
 * The Idealplan CTA, once enabled AND moved into its body portal (one animation frame after
 * mount) — a node found earlier is replaced by the portal and would swallow the click.
 */
async function enabledCta(name: RegExp): Promise<HTMLElement> {
  let button: HTMLElement | null = null
  await waitFor(() => {
    button = screen.getByRole("button", { name })
    assert.ok(button.closest("nav")?.parentElement === document.body, "CTA not portaled yet")
    assert.equal(button.hasAttribute("disabled"), false)
  })
  return button!
}

test("J5: „Weiter“ → budget → adjusted proposal with the swap note → a fresh tap accepts", async () => {
  const routes: string[] = []
  const requests = routeFetch({
    previews: [
      previewResponse([preview("decision:conditioner:conditioner_rinse_out:gap", "cond-hi")]),
      previewResponse([preview("decision:conditioner:conditioner_rinse_out:gap", "cond-lo")]),
    ],
    accept: () => ({ status: 200, body: { status: "accepted", next: { href: "/routine" } } }),
  })
  renderJourney(true, routes)

  const next = await enabledCta(new RegExp(PLAN_START_BUDGET_FIRST_LABEL))
  await act(async () => fireEvent.click(next))
  assert.deepEqual(requests.accepts, [], "the „Weiter“ tap never accepts")

  screen.getByRole("heading", { name: "Was darf ein Pflegeprodukt ungefähr kosten?" })
  click("Bis 5 €")
  click("Weiter")
  fireEvent.click(screen.getByRole("button", { name: /Ja, für jedes\./ }))
  await act(async () => click("Weiter"))
  assert.deepEqual(requests.budgetSaves, [
    { budget: { kind: "capped", limitEur: 5, allowExceptions: false } },
  ])

  // The proposal is re-derived under the budget and says what changed.
  await screen.findByText("An dein Budget angepasst: 1 Produkt getauscht.")
  assert.equal(requests.previews, 2)
  assert.deepEqual(requests.accepts, [], "a saved budget alone never accepts")

  const accept = await enabledCta(new RegExp(PLAN_START_ACCEPT_LABEL))
  await act(async () => fireEvent.click(accept))
  await waitFor(() => assert.equal(requests.accepts.length, 1))
  assert.deepEqual(requests.accepts[0], {
    seenRoles: [
      {
        decisionKey: "decision:conditioner:conditioner_rinse_out:gap",
        productId: "cond-lo",
        factFingerprint: "facts-cond-lo",
      },
    ],
  })
  await waitFor(() => assert.deepEqual(routes, ["/routine"]))
})

test("J5: „Abbrechen“ returns to the proposal without accepting", async () => {
  const routes: string[] = []
  const requests = routeFetch({
    previews: [previewResponse([preview("k", "cond-hi")])],
    accept: () => ({ status: 200, body: { status: "accepted", next: { href: "/routine" } } }),
  })
  renderJourney(true, routes)
  const next = await enabledCta(new RegExp(PLAN_START_BUDGET_FIRST_LABEL))
  await act(async () => fireEvent.click(next))
  click("Abbrechen")

  // Back on the proposal, still asking for the budget first.
  await enabledCta(new RegExp(PLAN_START_BUDGET_FIRST_LABEL))
  assert.deepEqual(requests.accepts, [])
  assert.deepEqual(requests.budgetSaves, [])
  assert.deepEqual(routes, [])
})

test("J5: a server budget_required (stale projection) opens the budget question once", async () => {
  const routes: string[] = []
  const requests = routeFetch({
    previews: [previewResponse([preview("k", "cond-hi")])],
    accept: () => ({ status: 409, body: { error: "budget_required" } }),
  })
  renderJourney(false, routes)
  const accept = await enabledCta(new RegExp(PLAN_START_ACCEPT_LABEL))
  await act(async () => fireEvent.click(accept))

  await screen.findByRole("heading", { name: "Was darf ein Pflegeprodukt ungefähr kosten?" })
  assert.equal(requests.accepts.length, 1)
  assert.deepEqual(routes, [])
})

test("J5: an already-accepted plan keeps the existing behaviour — straight to the routine, no budget step", async () => {
  const routes: string[] = []
  const requests = routeFetch({
    previews: [previewResponse([preview("k", "cond-hi")])],
    accept: () => ({ status: 409, body: { error: "plan_already_accepted" } }),
  })
  renderJourney(false, routes)
  const accept = await enabledCta(new RegExp(PLAN_START_ACCEPT_LABEL))
  await act(async () => fireEvent.click(accept))
  await waitFor(() => assert.deepEqual(routes, ["/routine"]))
  assert.equal(requests.accepts.length, 1)
  assert.equal(
    screen.queryByRole("heading", { name: "Was darf ein Pflegeprodukt ungefähr kosten?" }),
    null,
  )
  assert.deepEqual(requests.budgetSaves, [])
})
