// The jsdom globals must exist before React DOM and @testing-library load.
import "./helpers/dom"

import assert from "node:assert/strict"
import { afterEach, mock, test } from "node:test"

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import React from "react"

import { DiscoveryCallCockpit } from "../src/components/discovery/cockpit/discovery-call-cockpit"
import type {
  DiscoveryCockpitStepView,
  DiscoveryCockpitSwapOption,
} from "../src/lib/discovery/cockpit"
import type { DiscoveryCallSheetComplexity } from "../src/lib/discovery/call-sheet"
import type { DiscoveryPropertyRow } from "../src/lib/discovery/property-rows"
import type { PersonalPlanCategory } from "../src/lib/personal-plan/products/contracts"

/**
 * Phase 3 of consult-iteration-2 in a real DOM:
 * - R28 „Wie aufwendig darf die Routine sein?": two options, plum when selected, saved per
 *   click to the call sheet — optimistic, rolled back with an error line on a refusal;
 * - R28 every „Neu dazu" step carries „Essenziell"/„Optional" and its one-sentence benefit;
 * - F1 the Idealplan recommendation shows the comparison table „Empfohlenes Produkt | Ziel"
 *   when (and only when) it has rows.
 */

afterEach(() => {
  cleanup()
  mock.restoreAll()
})

const ROWS: DiscoveryPropertyRow[] = [
  {
    dimensionId: "shampoo.scalp_route",
    label: "Kopfhaut",
    status: "match",
    state: "in_target",
    productValue: "fettig",
    targetValue: "fettig",
  },
]

function recommendation(propertyRows: DiscoveryPropertyRow[] | null): DiscoveryCockpitSwapOption {
  return {
    productId: "rec-mask",
    name: "Olaplex No. 8",
    brand: "Olaplex",
    label: "Olaplex No. 8",
    verdictLabel: "Passt",
    priceLabel: null,
    imageUrl: null,
    origin: "ideal_recommendation",
    propertyRows,
  }
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
    frequencyLabel: "1× pro Woche",
    depth: null,
    section: "basis",
    outcome: input.intakeItemId ? "undecided" : "ideal",
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

/** A „Neu dazu" mask step (basis) and a „Neu dazu" oil step (optional). */
function addSteps(maskRows: DiscoveryPropertyRow[] | null = ROWS): DiscoveryCockpitStepView[] {
  const mask = recommendation(maskRows)
  return [
    step({
      decisionKey: "decision:mask",
      category: "mask",
      categoryLabel: "Maske",
      roleDescription: "Gibt den Längen eine intensive, auswaschbare Pflegeeinheit.",
      swapOptions: [mask],
      idealRecommendation: mask,
    }),
    step({
      decisionKey: "decision:oil",
      category: "oil",
      categoryLabel: "Öl",
      section: "optional",
      roleDescription: "Schützt dein Haar vor passender Hitze-Anwendung.",
      swapOptions: [{ ...recommendation(null), productId: "rec-oil", label: "Öl Finish" }],
      idealRecommendation: { ...recommendation(null), productId: "rec-oil", label: "Öl Finish" },
    }),
  ]
}

function renderCockpit(
  props: {
    steps?: DiscoveryCockpitStepView[]
    complexity?: DiscoveryCallSheetComplexity | null
    complexityLocked?: boolean
  } = {},
) {
  const router = {
    refresh: mock.fn(),
    push() {},
    replace() {},
    prefetch() {},
    back() {},
    forward() {},
  }
  const ui = (p: typeof props) => (
    <AppRouterContext.Provider value={router as never}>
      <DiscoveryCallCockpit
        enrollmentId="enrollment-1"
        steps={p.steps ?? addSteps()}
        submitted
        initialFinalizedAt={null}
        complexity={p.complexity ?? null}
        complexityLocked={p.complexityLocked ?? false}
      />
    </AppRouterContext.Provider>
  )
  const view = render(ui(props))
  return { ...view, rerenderWith: (p: typeof props) => view.rerender(ui(p)) }
}

function deferredFetch() {
  let settle!: (response: Response | Error) => void
  const calls: Array<{ url: string; method: string | undefined; body: unknown }> = []
  mock.method(globalThis, "fetch", (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method, body: JSON.parse(String(init.body)) })
    return new Promise<Response>((resolve, reject) => {
      settle = (response) => (response instanceof Error ? reject(response) : resolve(response))
    })
  })
  return { calls, settle: (response: Response | Error) => settle(response) }
}

function complexityGroup(): HTMLElement {
  return screen.getByRole("group", { name: "Wie aufwendig darf die Routine sein?" })
}

function option(name: string): HTMLElement {
  return within(complexityGroup()).getByRole("button", { name })
}

// --- R28: the complexity chip ------------------------------------------------------------

test("R28: the question sits at the top of Phase 3 with exactly two options, seeded from the call sheet", () => {
  renderCockpit({ complexity: "normal" })
  const phase = document.getElementById("runsheet-phase-3") as HTMLElement
  const group = complexityGroup()
  assert.ok(phase.contains(group))
  // Before the buckets.
  const bucket = within(phase).getByText("Behalten", { selector: "h3" })
  assert.ok(group.compareDocumentPosition(bucket) & Node.DOCUMENT_POSITION_FOLLOWING)
  assert.deepEqual(
    within(group)
      .getAllByRole("button")
      .map((button) => [button.textContent, button.getAttribute("aria-pressed")]),
    [
      ["Super essenziell", "false"],
      ["Normal", "true"],
    ],
  )
  // Selected is plum, never coral.
  assert.ok(option("Normal").className.includes("--brand-plum"))
  assert.ok(!group.innerHTML.includes("--brand-coral"))
})

test("R28: a click saves {complexity} to the call sheet at once; a refusal rolls back with a line", async () => {
  const request = deferredFetch()
  renderCockpit()
  fireEvent.click(option("Super essenziell"))

  assert.deepEqual(request.calls, [
    {
      url: "/api/admin/beratung/enrollment-1/call-sheet",
      method: "PATCH",
      body: { complexity: "essenziell" },
    },
  ])
  // Optimistic.
  assert.equal(option("Super essenziell").getAttribute("aria-pressed"), "true")

  await act(async () => {
    request.settle(new Response(JSON.stringify({ code: "nope" }), { status: 500 }))
  })
  assert.equal(option("Super essenziell").getAttribute("aria-pressed"), "false")
  assert.equal(
    within(complexityGroup()).getByRole("status").textContent,
    "Nicht gespeichert. Bitte noch einmal.",
  )
})

test("R28: an accepted save keeps the choice; a network failure rolls it back", async () => {
  const request = deferredFetch()
  renderCockpit({ complexity: "essenziell" })
  fireEvent.click(option("Normal"))
  await act(async () => {
    request.settle(
      new Response(JSON.stringify({ callSheet: { complexity: "normal" } }), { status: 200 }),
    )
  })
  assert.equal(option("Normal").getAttribute("aria-pressed"), "true")
  assert.equal(within(complexityGroup()).queryByRole("status"), null)

  fireEvent.click(option("Super essenziell"))
  await act(async () => {
    request.settle(new Error("offline"))
  })
  assert.equal(option("Normal").getAttribute("aria-pressed"), "true")
  assert.ok(within(complexityGroup()).getByRole("status").textContent?.startsWith("Nicht"))
})

test("R28: an unreadable call sheet locks the choice instead of guessing", () => {
  renderCockpit({ complexityLocked: true })
  for (const button of within(complexityGroup()).getAllByRole("button")) {
    assert.equal((button as HTMLButtonElement).disabled, true)
  }
  assert.equal(
    within(complexityGroup()).getByRole("status").textContent,
    "Call-Sheet nicht geladen — Seite neu laden, dann speichern.",
  )
})

// --- R28: Essenziell / Optional on every „Neu dazu" step -------------------------------

function entryOf(categoryLabel: string): HTMLElement {
  // The entry root is the chip's nearest `.border-b` ancestor (its header row has none).
  const entry = screen
    .getAllByText(categoryLabel)
    .map((node) => node.closest(".border-b"))
    .find((node) => node?.textContent?.includes("Neu dazu"))
  assert.ok(entry, categoryLabel)
  return entry as HTMLElement
}

test("R28: „Neu dazu“ steps say Essenziell / Optional with the step's benefit, pronoun-free", () => {
  renderCockpit()
  const mask = entryOf("Maske")
  const oil = entryOf("Öl")
  assert.ok(within(mask).getByText("Essenziell"))
  assert.ok(within(mask).getByText("Gibt den Längen eine intensive, auswaschbare Pflegeeinheit."))
  assert.ok(within(oil).getByText("Optional"))
  // The benefit in the cockpit's voice (no „dein").
  assert.ok(within(oil).getByText("Schützt das Haar vor passender Hitze-Anwendung."))
  // The old lowercase tag is replaced on these entries.
  assert.ok(!oil.textContent?.includes("· optional"))
})

// --- F1: the recommendation's comparison table -----------------------------------------

test("F1: the recommendation shows „Empfohlenes Produkt | Ziel“ — two columns, no owned column", () => {
  renderCockpit()
  const mask = entryOf("Maske")
  const table = mask.querySelector("[data-comparison]") as HTMLElement
  assert.equal(table.getAttribute("data-comparison"), "compact")
  const header = table.firstElementChild?.textContent ?? ""
  assert.ok(header.includes("Empfohlenes Produkt"), header)
  assert.ok(header.includes("Ziel"), header)
  assert.ok(!header.includes("Alternative"), header)
  assert.ok(!header.includes("Bisheriges Produkt"), header)
  assert.ok(
    table
      .querySelector("li")
      ?.getAttribute("aria-label")
      ?.includes("Empfohlenes Produkt: fettig, Ziel: fettig"),
  )
})

test("F1: no rows, no table — nothing is invented", () => {
  renderCockpit({ steps: addSteps(null) })
  assert.equal(document.querySelector("[data-comparison]"), null)
})

// --- Iteration 3: „Super essenziell" folds the optional Neu-Schritte ----------------------

test("Iteration 3: „Super essenziell“ klappt optionale Neu-Schritte ein, „Normal“ zeigt alles", () => {
  renderCockpit({ complexity: "essenziell" })
  const fold = document.getElementById("runsheet-complexity-folded")
  assert.ok(fold, "fold row exists under Super essenziell")
  const summary = fold!.querySelector("summary")
  assert.ok(
    summary?.textContent?.includes("1 optionaler Neu-Schritt eingeklappt (Super essenziell)"),
  )
  // The optional Öl step sits inside the fold; the essential Maske step stays outside it.
  assert.ok(fold!.textContent!.includes("Öl"))
  assert.ok(!fold!.contains(entryOf("Maske")))

  cleanup()
  renderCockpit({ complexity: "normal" })
  assert.equal(document.getElementById("runsheet-complexity-folded"), null)

  cleanup()
  renderCockpit()
  assert.equal(document.getElementById("runsheet-complexity-folded"), null)
})

test("Iteration 3: choosing „Super essenziell“ folds at once — optimistic, before the save lands", () => {
  deferredFetch()
  renderCockpit()
  assert.equal(document.getElementById("runsheet-complexity-folded"), null)
  fireEvent.click(option("Super essenziell"))
  assert.ok(document.getElementById("runsheet-complexity-folded"))
})

test("Iteration 3: a step without her product shows no „Bisheriges Produkt“-panel, but keeps the unanswered honesty line", () => {
  renderCockpit({
    steps: [
      ...addSteps(),
      step({
        decisionKey: "decision:leave_in",
        category: "leave_in",
        categoryLabel: "Leave-in",
        section: "optional",
        unanswered: true,
        swapOptions: [
          { ...recommendation(null), productId: "rec-leave-in", label: "Leichtes Leave-in" },
        ],
        idealRecommendation: {
          ...recommendation(null),
          productId: "rec-leave-in",
          label: "Leichtes Leave-in",
        },
      }),
    ],
  })
  const leaveIn = entryOf("Leave-in")
  assert.ok(!leaveIn.textContent!.includes("Kein Produkt angegeben"))
  assert.ok(leaveIn.textContent!.includes("Nicht angegeben — im Call fragen."))
})

// --- Codex F2: a stale rollback never overwrites a newer server value --------------------

test("F2: a refresh during a pending write wins over the write's failure rollback", async () => {
  const request = deferredFetch()
  const view = renderCockpit()
  fireEvent.click(option("Normal"))
  assert.equal(option("Normal").getAttribute("aria-pressed"), "true")
  // A router refresh lands while the PATCH runs and carries the same answer from the server.
  view.rerenderWith({ complexity: "normal" })
  await act(async () => {
    request.settle(new Response(JSON.stringify({ code: "nope" }), { status: 500 }))
  })
  // No rollback to null: the server value is newer than the failed write.
  assert.equal(option("Normal").getAttribute("aria-pressed"), "true")
  assert.equal(option("Super essenziell").getAttribute("aria-pressed"), "false")
})

// --- T4 (iteration 3): option thumbnails ---------------------------------------------------

test("T4: an option with a packshot shows the thumbnail; without one there is no placeholder", () => {
  const withImage = addSteps().map((entry) =>
    entry.categoryLabel === "Maske"
      ? {
          ...entry,
          swapOptions: entry.swapOptions.map((o) => ({ ...o, imageUrl: "https://cdn.test/k.png" })),
        }
      : entry,
  )
  renderCockpit({ steps: withImage })
  const mask = entryOf("Maske")
  const img = mask.querySelector("img")
  assert.ok(img, "thumbnail rendered")
  assert.equal(img!.getAttribute("src"), "https://cdn.test/k.png")
  const oil = entryOf("Öl")
  assert.equal(oil.querySelector("img"), null)
  assert.equal(oil.querySelector('[role="img"]'), null)
})
