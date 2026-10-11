// The jsdom globals must exist before React DOM and @testing-library load.
import "./helpers/dom"

import assert from "node:assert/strict"
import { afterEach, mock, test } from "node:test"

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import React from "react"

import { DiscoveryBudgetPanel } from "../src/components/discovery/cockpit/discovery-budget-panel"
import {
  DiscoveryCallCockpit,
  discoveryOverBudgetPill,
} from "../src/components/discovery/cockpit/discovery-call-cockpit"
import { DiscoveryBudgetScreen } from "../src/components/discovery/intake/discovery-budget-screen"
import type {
  DiscoveryCockpitStepView,
  DiscoveryCockpitSwapOption,
} from "../src/lib/discovery/cockpit"
import type { ShoppingBudget } from "../src/lib/user-facts/schema"

/**
 * Profi-tier Task 8 in a real DOM: the participant's budget screen (coral selection, saves
 * only through the member route), the cockpit's „Kundenbudget" panel (read, inline edit,
 * optimistic save with rollback, frozen when finalised) and the over-budget pill.
 */

afterEach(() => {
  cleanup()
  mock.restoreAll()
})

type Call = { url: string; method: string | undefined; body: unknown }

function deferredFetch() {
  let settle!: (response: Response | Error) => void
  const calls: Call[] = []
  mock.method(globalThis, "fetch", (url: string, init: RequestInit) => {
    calls.push({
      url,
      method: init.method,
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    })
    return new Promise<Response>((resolve, reject) => {
      settle = (response) => (response instanceof Error ? reject(response) : resolve(response))
    })
  })
  return { calls, settle: (response: Response | Error) => settle(response) }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function withRouter(ui: React.ReactElement) {
  const router = {
    refresh: mock.fn(),
    push() {},
    replace() {},
    prefetch() {},
    back() {},
    forward() {},
  }
  return {
    router,
    ...render(<AppRouterContext.Provider value={router as never}>{ui}</AppRouterContext.Provider>),
  }
}

// --- the participant's budget screen ---------------------------------------------------------

test("the budget screen saves only through the member route, then reports the saved budget", async () => {
  const request = deferredFetch()
  const saved: ShoppingBudget[] = []
  render(<DiscoveryBudgetScreen onBack={() => {}} onSaved={(budget) => void saved.push(budget)} />)

  const cheap = screen.getByRole("button", { name: "Bis 5 €" })
  assert.equal(cheap.getAttribute("aria-pressed"), "false")
  fireEvent.click(cheap)
  // Coral selection in the consultation look.
  assert.equal(cheap.getAttribute("aria-pressed"), "true")
  assert.ok(cheap.className.includes("--brand-coral"), "selected card is coral")
  assert.ok(!cheap.className.includes("border-[var(--brand-plum)]"))

  fireEvent.click(screen.getByText("Weiter"))
  // The capped follow-up.
  assert.ok(screen.getByText("Bis 5 € für jedes Produkt?"))
  assert.ok(screen.getByRole("button", { name: /Ja, für jedes\./ }))
  fireEvent.click(screen.getByRole("button", { name: /Einzelne dürfen mehr kosten\./ }))
  fireEvent.click(screen.getByText("Weiter"))

  assert.deepEqual(request.calls, [
    {
      url: "/api/profile/shopping-preferences",
      method: "POST",
      body: { budget: { kind: "capped", limitEur: 5, allowExceptions: true } },
    },
  ])
  await act(async () => {
    request.settle(
      json({ budget: { kind: "capped", limitEur: 5, allowExceptions: true }, revision: 3 }),
    )
  })
  await waitFor(() =>
    assert.deepEqual(saved, [{ kind: "capped", limitEur: 5, allowExceptions: true }]),
  )
})

test("the budget screen's back arrow leaves without saving anything", () => {
  const request = deferredFetch()
  let back = 0
  render(<DiscoveryBudgetScreen onBack={() => void (back += 1)} onSaved={() => {}} />)
  fireEvent.click(screen.getByRole("button", { name: "Zurück" }))
  assert.equal(back, 1)
  assert.equal(request.calls.length, 0)
})

// --- the cockpit panel -----------------------------------------------------------------------

const CAPPED_STRICT: ShoppingBudget = { kind: "capped", limitEur: 5, allowExceptions: false }
const CAPPED_FLEX: ShoppingBudget = { kind: "capped", limitEur: 15, allowExceptions: true }

function panel(budget: ShoppingBudget | null, finalized = false) {
  return withRouter(
    <DiscoveryBudgetPanel enrollmentId="enrollment-1" budget={budget} finalized={finalized} />,
  )
}

test("read mode: heading, source label, the value in the customer's wording and „Ändern“", () => {
  for (const [budget, text] of [
    [CAPPED_STRICT, "Bis 5 € für jedes Produkt"],
    [CAPPED_FLEX, "Bis 15 € · einzelne dürfen mehr kosten"],
    [{ kind: "uncapped" } as ShoppingBudget, "Ohne feste Preisgrenze"],
    [null, "Noch kein Budget angegeben"],
  ] as const) {
    const view = panel(budget)
    assert.ok(screen.getByRole("heading", { name: "Kundenbudget" }))
    assert.ok(screen.getByText("Angabe der Kundin / des Kunden"))
    assert.equal(document.querySelector("[data-budget-value]")?.textContent, text)
    assert.ok(screen.getByRole("button", { name: "Ändern" }))
    view.unmount()
  }
})

test("edit mode: two staff-voice radio groups, the follow-up only for a capped limit, Speichern gated", () => {
  panel(null)
  fireEvent.click(screen.getByRole("button", { name: "Ändern" }))

  const limit = screen.getByRole("group", { name: "Preis pro Packung" })
  assert.deepEqual(
    within(limit)
      .getAllByRole("radio")
      .map((radio) => (radio as HTMLInputElement).labels?.[0]?.textContent),
    ["Bis 5 €", "Bis 15 €", "Keine feste Preisgrenze"],
  )
  assert.equal(screen.queryByRole("group", { name: "Gilt die Grenze für jedes Produkt?" }), null)
  const save = screen.getByRole("button", { name: "Speichern" }) as HTMLButtonElement
  assert.equal(save.disabled, true)

  fireEvent.click(screen.getByLabelText("Bis 5 €"))
  const follow = screen.getByRole("group", { name: "Gilt die Grenze für jedes Produkt?" })
  assert.deepEqual(
    within(follow)
      .getAllByRole("radio")
      .map((radio) => (radio as HTMLInputElement).labels?.[0]?.textContent),
    ["Ja, für jedes", "Einzelne dürfen mehr kosten"],
  )
  assert.equal(save.disabled, true, "a capped answer is complete only with the follow-up")
  fireEvent.click(screen.getByLabelText("Ja, für jedes"))
  assert.equal(save.disabled, false)

  fireEvent.click(screen.getByLabelText("Keine feste Preisgrenze"))
  assert.equal(screen.queryByRole("group", { name: "Gilt die Grenze für jedes Produkt?" }), null)
  assert.equal(save.disabled, false, "uncapped needs no follow-up")

  fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }))
  assert.ok(screen.getByRole("button", { name: "Ändern" }))
})

test("edit mode starts from the saved value", () => {
  panel(CAPPED_FLEX)
  fireEvent.click(screen.getByRole("button", { name: "Ändern" }))
  assert.equal((screen.getByLabelText("Bis 15 €") as HTMLInputElement).checked, true)
  assert.equal(
    (screen.getByLabelText("Einzelne dürfen mehr kosten") as HTMLInputElement).checked,
    true,
  )
})

test("save is optimistic, PUTs the strict body, and refreshes the page on success", async () => {
  const request = deferredFetch()
  const { router } = panel(null)
  fireEvent.click(screen.getByRole("button", { name: "Ändern" }))
  fireEvent.click(screen.getByLabelText("Bis 15 €"))
  fireEvent.click(screen.getByLabelText("Einzelne dürfen mehr kosten"))
  fireEvent.click(screen.getByRole("button", { name: "Speichern" }))

  assert.deepEqual(request.calls, [
    {
      url: "/api/admin/beratung/enrollment-1/shopping-preferences",
      method: "PUT",
      body: { budget: CAPPED_FLEX },
    },
  ])
  // Optimistic: the value shows before the answer arrives; no refresh yet.
  assert.equal(
    document.querySelector("[data-budget-value]")?.textContent,
    "Bis 15 € · einzelne dürfen mehr kosten",
  )
  assert.equal(router.refresh.mock.callCount(), 0)

  await act(async () => {
    request.settle(json({ budget: CAPPED_FLEX, revision: 5 }))
  })
  assert.equal(router.refresh.mock.callCount(), 1)
  assert.equal(
    document.querySelector("[data-budget-value]")?.textContent,
    "Bis 15 € · einzelne dürfen mehr kosten",
  )
  assert.equal(screen.queryByRole("status"), null)
})

test("a refusal rolls the value back, reopens the editor with the choice and says why", async () => {
  const request = deferredFetch()
  const { router } = panel(CAPPED_STRICT)
  fireEvent.click(screen.getByRole("button", { name: "Ändern" }))
  fireEvent.click(screen.getByLabelText("Keine feste Preisgrenze"))
  fireEvent.click(screen.getByRole("button", { name: "Speichern" }))
  assert.equal(document.querySelector("[data-budget-value]")?.textContent, "Ohne feste Preisgrenze")

  await act(async () => {
    request.settle(json({ code: "unavailable" }, 503))
  })
  assert.equal(router.refresh.mock.callCount(), 0)
  // The editor is back, still holding the chosen answer, with the stored value untouched.
  assert.equal((screen.getByLabelText("Keine feste Preisgrenze") as HTMLInputElement).checked, true)
  assert.equal(screen.getByRole("status").textContent, "Nicht gespeichert. Bitte noch einmal.")
  fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }))
  assert.equal(
    document.querySelector("[data-budget-value]")?.textContent,
    "Bis 5 € für jedes Produkt",
    "rolled back to what is stored",
  )
})

test("a network failure rolls back too; a conflict and a freeze have their own lines", async () => {
  for (const [outcome, line] of [
    [new Error("offline"), "Nicht gespeichert. Bitte noch einmal."],
    [
      json({ code: "profile_conflict" }, 409),
      "Das Budget wurde zwischenzeitlich geändert. Seite neu laden, dann noch einmal.",
    ],
    [json({ code: "finalized" }, 409), "Erst Finalisierung aufheben."],
  ] as const) {
    const request = deferredFetch()
    const view = panel(null)
    fireEvent.click(screen.getByRole("button", { name: "Ändern" }))
    fireEvent.click(screen.getByLabelText("Keine feste Preisgrenze"))
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }))
    await act(async () => {
      request.settle(outcome)
    })
    assert.equal(screen.getByRole("status").textContent, line)
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }))
    assert.equal(
      document.querySelector("[data-budget-value]")?.textContent,
      "Noch kein Budget angegeben",
    )
    view.unmount()
    mock.restoreAll()
  }
})

test("a finalized call disables „Ändern“ and says why; no request can start", () => {
  const request = deferredFetch()
  panel(CAPPED_STRICT, true)
  const change = screen.getByRole("button", { name: "Ändern" }) as HTMLButtonElement
  assert.equal(change.disabled, true)
  assert.equal(screen.getByRole("status").textContent, "Erst Finalisierung aufheben.")
  fireEvent.click(change)
  assert.equal(screen.queryByRole("group", { name: "Preis pro Packung" }), null)
  assert.equal(request.calls.length, 0)
})

// --- the slot and the pill in the cockpit ------------------------------------------------------

function recommendation(
  overrides: Partial<DiscoveryCockpitSwapOption> = {},
): DiscoveryCockpitSwapOption {
  return {
    productId: "rec-mask",
    name: "Olaplex No. 8",
    brand: "Olaplex",
    label: "Olaplex No. 8",
    verdictLabel: "Passt",
    priceLabel: "24,90 €",
    imageUrl: null,
    origin: "ideal_recommendation",
    propertyRows: null,
    ...overrides,
  }
}

function maskStep(option: DiscoveryCockpitSwapOption): DiscoveryCockpitStepView {
  return {
    decisionKey: "decision:mask",
    category: "mask",
    categoryLabel: "Maske",
    roleLabel: "mask",
    roleDescription: null,
    frequencyLabel: "1× pro Woche",
    depth: null,
    section: "basis",
    outcome: "ideal",
    ownedLabel: null,
    intakeItemId: null,
    ownedProductId: null,
    ownedUsageRole: null,
    stepEntryCount: 1,
    ownedFrequencyLabel: null,
    ownedFrequency: null,
    idealAllowedRange: null,
    canDrop: false,
    unanswered: false,
    verdict: null,
    swapOptions: [option],
    swapProductId: null,
    swapProductLabel: null,
    idealRecommendation: option,
    recommendationLabel: null,
    ownedUsageLabel: null,
    ownedImageUrl: null,
    swapProductImageUrl: null,
    recommendationImageUrl: null,
    usageDifference: null,
  }
}

function cockpit(option: DiscoveryCockpitSwapOption, budgetPanel?: React.ReactNode) {
  return withRouter(
    <DiscoveryCallCockpit
      enrollmentId="enrollment-1"
      steps={[maskStep(option)]}
      submitted
      initialFinalizedAt={null}
      budgetPanel={budgetPanel}
    />,
  )
}

test("the budget slot sits in Phase 3 right after the complexity choice, before the buckets", () => {
  cockpit(
    recommendation(),
    <DiscoveryBudgetPanel enrollmentId="enrollment-1" budget={CAPPED_STRICT} finalized={false} />,
  )
  const phase = document.getElementById("runsheet-phase-3") as HTMLElement
  const complexity = document.getElementById("runsheet-complexity") as HTMLElement
  const budget = document.getElementById("runsheet-budget") as HTMLElement
  const bucket = within(phase).getByText("Behalten", { selector: "h3" })
  assert.ok(phase.contains(budget))
  assert.ok(complexity.compareDocumentPosition(budget) & Node.DOCUMENT_POSITION_FOLLOWING)
  assert.ok(budget.compareDocumentPosition(bucket) & Node.DOCUMENT_POSITION_FOLLOWING)
})

test("without the slot (flag off) Phase 3 has no budget panel", () => {
  cockpit(recommendation())
  assert.equal(document.getElementById("runsheet-budget"), null)
})

test("an over-budget option shows „+19,90 € über Budget“ next to its verdict pill", () => {
  cockpit(recommendation({ overBudgetEur: 19.9 }))
  const pill = screen.getByText("+19,90 € über Budget")
  assert.ok(pill)
  // Beside the verdict pill, inside the same option label.
  const label = pill.closest("label") as HTMLElement
  assert.ok(within(label).getByText("Passt"))
})

test("an option within budget (or without a budget) shows no budget pill", () => {
  cockpit(recommendation())
  assert.equal(screen.queryByText(/über Budget/), null)
})

test("the pill amount uses the German number format", () => {
  assert.equal(discoveryOverBudgetPill(19.9), "+19,90 € über Budget")
  assert.equal(discoveryOverBudgetPill(7.4), "+7,40 € über Budget")
  assert.equal(discoveryOverBudgetPill(0.01), "+0,01 € über Budget")
  assert.equal(discoveryOverBudgetPill(1234.5), "+1.234,50 € über Budget")
})
