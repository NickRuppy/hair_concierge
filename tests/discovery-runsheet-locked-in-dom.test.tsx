// The jsdom globals must exist before React DOM and @testing-library load.
import { domWindow, mockClipboard } from "./helpers/dom"

import assert from "node:assert/strict"
import { afterEach, mock, test } from "node:test"

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import React from "react"

import { DiscoveryCallCockpit } from "../src/components/discovery/cockpit/discovery-call-cockpit"
import { RunsheetLockedInSection } from "../src/components/discovery/cockpit/runsheet-locked-in"
import type {
  DiscoveryCockpitStepView,
  DiscoveryCockpitSwapOption,
} from "../src/lib/discovery/cockpit"
import { runsheetLockedIn, type RunsheetLockedIn } from "../src/lib/discovery/runsheet"
import type { PersonalPlanCategory } from "../src/lib/personal-plan/products/contracts"

/**
 * „Für den Plan festgehalten" in a real DOM (jsdom + @testing-library): what the static
 * markup tests cannot show — the copy button's feedback cycle, the clipboard fallback, a
 * re-render with new decisions, and the cockpit's optimistic Entscheidung click with its
 * rollback.
 */

afterEach(() => {
  cleanup()
  mock.timers.reset()
  mock.restoreAll()
})

// --- fixtures ----------------------------------------------------------------------

/** German EUR as `Intl` formats it: a no-break space before the sign. */
const EUR = (amount: string) => `${amount} €`

function option(productId: string, label: string, priceLabel: string | null) {
  return {
    productId,
    name: label,
    brand: null,
    label,
    verdictLabel: "Passt",
    priceLabel,
    origin: "alternative",
    propertyRows: null,
  } satisfies DiscoveryCockpitSwapOption
}

type StepInput = Partial<DiscoveryCockpitStepView> & {
  decisionKey: string
  category: PersonalPlanCategory
  categoryLabel: string
}

function step(input: StepInput): DiscoveryCockpitStepView {
  return {
    roleLabel: input.category,
    roleDescription: null,
    frequencyLabel: "2× pro Woche",
    depth: null,
    section: "basis",
    outcome: input.intakeItemId ? "undecided" : "ideal",
    ownedLabel: null,
    intakeItemId: null,
    ownedProductId: input.intakeItemId ? `product-${input.intakeItemId}` : null,
    ownedUsageRole: null,
    stepEntryCount: 1,
    ownedFrequencyLabel: null,
    ownedFrequency: null,
    idealAllowedRange: null,
    canDrop: false,
    unanswered: false,
    verdict: null,
    swapOptions: [],
    swapProductId: null,
    swapProductLabel: null,
    idealRecommendation: null,
    recommendationLabel: null,
    ownedUsageLabel: null,
    ownedImageUrl: null,
    swapProductImageUrl: null,
    recommendationImageUrl: null,
    usageDifference: null,
    ...input,
  }
}

/** Her shampoo (swap to Alpha possible, 9,95 €) and her conditioner. */
function steps(
  overrides: {
    shampoo?: Partial<DiscoveryCockpitStepView>
    conditioner?: Partial<DiscoveryCockpitStepView>
  } = {},
): DiscoveryCockpitStepView[] {
  return [
    step({
      decisionKey: "decision:shampoo",
      category: "shampoo",
      categoryLabel: "Shampoo",
      intakeItemId: "item-shampoo",
      ownedLabel: "Sebamed Anti Schuppen",
      swapOptions: [option("alpha", "Alpha Shampoo", EUR("9,95"))],
      ...overrides.shampoo,
    }),
    step({
      decisionKey: "decision:conditioner",
      category: "conditioner",
      categoryLabel: "Conditioner",
      intakeItemId: "item-conditioner",
      ownedLabel: "Balea Spülung",
      ...overrides.conditioner,
    }),
  ]
}

const swapShampoo: Partial<DiscoveryCockpitStepView> = {
  outcome: "swapped",
  swapProductId: "alpha",
}

function section(): HTMLElement {
  return document.getElementById("runsheet-locked-in") as HTMLElement
}

/** The rows under one group heading, up to the next group (or the sum). */
function groupText(heading: string): string {
  const text = section().textContent ?? ""
  const start = text.indexOf(heading)
  assert.ok(start >= 0, `group ${heading} missing`)
  const rest = text.slice(start + heading.length)
  const ends = ["Behalten", "Weglassen", "Bewusst ohne Produkt", "Summe neu"]
    .map((next) => rest.indexOf(next))
    .filter((index) => index >= 0)
  return rest.slice(0, Math.min(...ends))
}

function total(): string {
  return document.getElementById("runsheet-locked-in-total")?.textContent ?? ""
}

/** Lets the clipboard promise's `.then` run and React commit what it set. */
async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}

// --- „Liste kopieren" ---------------------------------------------------------------

test("copy: the list goes to the clipboard, the button says „Kopiert ✓“, then resets after 1.5 s", async () => {
  mock.timers.enable({ apis: ["setTimeout"] })
  const writes = mockClipboard(async () => {})
  const lockedIn = runsheetLockedIn(steps({ shampoo: swapShampoo }))
  render(<RunsheetLockedInSection lockedIn={lockedIn} />)

  fireEvent.click(screen.getByRole("button", { name: "Liste kopieren" }))
  await flush()

  assert.deepEqual(writes, [`Einkaufsliste:\nShampoo: Alpha Shampoo — ${EUR("9,95")}`])
  assert.ok(screen.getByRole("button", { name: "Kopiert ✓" }))
  assert.equal(screen.queryByRole("status"), null)

  act(() => mock.timers.tick(1499))
  assert.ok(screen.getByRole("button", { name: "Kopiert ✓" }))
  act(() => mock.timers.tick(1))
  assert.ok(screen.getByRole("button", { name: "Liste kopieren" }))
})

test("copy: a refused clipboard shows the fallback message and selects the list", async () => {
  mockClipboard(() => Promise.reject(new Error("denied")))
  const lockedIn = runsheetLockedIn(steps({ shampoo: swapShampoo }))
  render(<RunsheetLockedInSection lockedIn={lockedIn} />)

  fireEvent.click(screen.getByRole("button", { name: "Liste kopieren" }))
  await flush()

  assert.equal(
    screen.getByRole("status").textContent,
    "Kopieren ging nicht — die Liste ist markiert, bitte manuell kopieren.",
  )
  // The button never claims success.
  assert.ok(screen.getByRole("button", { name: "Liste kopieren" }))
  const selection = domWindow.getSelection()
  assert.ok(selection && selection.rangeCount === 1)
  const selected = selection.getRangeAt(0).startContainer as HTMLElement
  assert.ok(selected.textContent?.includes("Neu kaufen"), selected.textContent ?? "")
  assert.ok(selection.toString().includes("Alpha Shampoo"), selection.toString())
})

test("copy: no clipboard at all (insecure context) falls back the same way", async () => {
  Object.defineProperty(domWindow.navigator, "clipboard", { configurable: true, value: undefined })
  render(<RunsheetLockedInSection lockedIn={runsheetLockedIn(steps({ shampoo: swapShampoo }))} />)

  fireEvent.click(screen.getByRole("button", { name: "Liste kopieren" }))
  await flush()

  assert.ok(screen.getByRole("status").textContent?.startsWith("Kopieren ging nicht"))
})

// --- a new selection re-renders the section ------------------------------------------

test("re-render with changed decisions: rows move between groups and the sum follows", () => {
  const before: RunsheetLockedIn = runsheetLockedIn(steps())
  const { rerender } = render(<RunsheetLockedInSection lockedIn={before} />)
  assert.equal(within(section()).getAllByText("Noch nichts festgehalten.").length, 4)
  assert.equal(total(), EUR("0,00"))
  assert.ok(section().textContent?.includes("2 Schritte noch nicht entschieden."))

  rerender(
    <RunsheetLockedInSection
      lockedIn={runsheetLockedIn(steps({ shampoo: swapShampoo, conditioner: { outcome: "kept" } }))}
    />,
  )
  assert.ok(groupText("Neu kaufen").includes("Alpha Shampoo"))
  assert.ok(groupText("Behalten").includes("Balea Spülung"))
  assert.equal(total(), EUR("9,95"))
  assert.ok(section().textContent?.includes("Alle Schritte entschieden — bereit für Phase 4."))

  rerender(
    <RunsheetLockedInSection
      lockedIn={runsheetLockedIn(
        steps({
          shampoo: { outcome: "dropped", stepEntryCount: 2 },
          conditioner: { outcome: "kept" },
        }),
      )}
    />,
  )
  assert.ok(groupText("Neu kaufen").includes("Noch nichts festgehalten."))
  assert.ok(groupText("Weglassen").includes("Sebamed Anti Schuppen"))
  assert.ok(groupText("Bewusst ohne Produkt").includes("Noch nichts festgehalten."))
  assert.equal(total(), EUR("0,00"))
})

// --- the cockpit's Entscheidung click: optimistic, rolled back on failure ------------

function renderCockpit(cockpitSteps: DiscoveryCockpitStepView[]) {
  const router = {
    refresh: mock.fn(),
    push() {},
    replace() {},
    prefetch() {},
    back() {},
    forward() {},
  }
  render(
    <AppRouterContext.Provider value={router as never}>
      <DiscoveryCallCockpit
        enrollmentId="enrollment-1"
        steps={cockpitSteps}
        submitted
        initialFinalizedAt={null}
      />
    </AppRouterContext.Provider>,
  )
  return router
}

/** A fetch stub whose response the test settles by hand. */
function deferredFetch() {
  let settle!: (response: Response | Error) => void
  const calls: Array<{ url: string; body: unknown }> = []
  mock.method(globalThis, "fetch", (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) })
    return new Promise<Response>((resolve, reject) => {
      settle = (response) => (response instanceof Error ? reject(response) : resolve(response))
    })
  })
  return { calls, settle: (response: Response | Error) => settle(response) }
}

test("cockpit: an Entscheidung click updates the section at once, a refused write rolls it back", async () => {
  const request = deferredFetch()
  renderCockpit(steps())
  assert.equal(total(), EUR("0,00"))

  fireEvent.click(screen.getByRole("radio", { name: /Tauschen zu Alpha Shampoo/ }))

  // Optimistic: before the server answers.
  assert.equal(request.calls.length, 1)
  assert.equal(request.calls[0]!.url, "/api/admin/beratung/enrollment-1/decisions")
  assert.deepEqual(request.calls[0]!.body, {
    decisionKey: "decision:shampoo",
    intakeItemId: "item-shampoo",
    decision: "swap",
    swapProductId: "alpha",
  })
  assert.ok(groupText("Neu kaufen").includes("Alpha Shampoo"))
  assert.equal(total(), EUR("9,95"))
  assert.ok(section().textContent?.includes("1 Schritt noch nicht entschieden."))

  await act(async () => {
    request.settle(new Response(JSON.stringify({ code: "nope" }), { status: 500 }))
  })

  // Rolled back with the write error.
  assert.ok(groupText("Neu kaufen").includes("Noch nichts festgehalten."))
  assert.equal(total(), EUR("0,00"))
  assert.ok(section().textContent?.includes("2 Schritte noch nicht entschieden."))
  assert.ok(document.body.textContent?.includes("Nicht gespeichert. Bitte noch einmal."))
})

test("cockpit: a network failure rolls the optimistic row back too", async () => {
  const request = deferredFetch()
  renderCockpit(steps())
  fireEvent.click(screen.getByRole("radio", { name: /Tauschen zu Alpha Shampoo/ }))
  assert.equal(total(), EUR("9,95"))

  await act(async () => {
    request.settle(new Error("offline"))
  })

  assert.equal(total(), EUR("0,00"))
  assert.ok(groupText("Neu kaufen").includes("Noch nichts festgehalten."))
})

test("cockpit: an accepted write keeps the row and refreshes from the server", async () => {
  const request = deferredFetch()
  const router = renderCockpit(steps())
  fireEvent.click(screen.getByRole("radio", { name: /Tauschen zu Alpha Shampoo/ }))

  await act(async () => {
    request.settle(new Response(null, { status: 204 }))
  })

  assert.ok(groupText("Neu kaufen").includes("Alpha Shampoo"))
  assert.equal(total(), EUR("9,95"))
  assert.equal(router.refresh.mock.callCount(), 1)
})
