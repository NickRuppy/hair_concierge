import assert from "node:assert/strict"
import test from "node:test"
import React, { type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import type { ScanSearchResult } from "../src/app/api/scan/search/route"
import {
  currentStep,
  openAddSearch,
  pickCapture,
  productSubject,
  startTyped,
  type AddFlow,
} from "../src/components/discovery/intake/add-flow"
import {
  DiscoveryAddSheet,
  DiscoveryAddStepBody,
  DiscoveryFrequencyStep,
  DiscoveryPinnedHeader,
} from "../src/components/discovery/intake/discovery-add-sheet"
import {
  DiscoveryFinalPage,
  DiscoveryHeatScreen,
  DiscoveryHeatStepBody,
  discoveryFinalRows,
} from "../src/components/discovery/intake/discovery-heat-flow"
import { DiscoveryIntakeChecklist } from "../src/components/discovery/intake/discovery-intake-checklist"
import {
  DiscoveryProductCard,
  DiscoveryProductsScreen,
  discoveryGridEntries,
} from "../src/components/discovery/intake/discovery-products-screen"
import { DiscoveryRoutineScreen } from "../src/components/discovery/intake/discovery-routine-screen"
import {
  discoveryHeatSteps,
  heatStepKey,
  type DiscoveryHeatDraft,
} from "../src/components/discovery/intake/heat-flow"
import type { DiscoveryIntakeItemView } from "../src/components/discovery/intake/types"
import type { DiscoveryHeatStylingV1 } from "../src/lib/discovery/heat-styling"

/**
 * The participant flow (batch 7, plan Rev. 3 §2.1) driven like taps would: products →
 * add sheet → „Deine Routine" → „Hitze & Styling" → final page → „Abschicken" → done.
 *
 * A hand-rolled `useState` dispatcher (no jsdom in this repo — same family as
 * `tests/discovery-search-sheet-props.test.tsx`): the checklist is called directly, its
 * element tree walked, and the handlers it hands its children invoked. The children
 * themselves are rendered with `renderToStaticMarkup`.
 */

type AnyElement = ReactElement<Record<string, any>>
type ReactDispatcherInternals = { H: unknown }

function childrenOf(node: ReactNode): ReactNode[] {
  if (!React.isValidElement(node)) return []
  return React.Children.toArray((node as ReactElement<{ children?: ReactNode }>).props.children)
}

function findAll(node: ReactNode, predicate: (element: AnyElement) => boolean): AnyElement[] {
  if (!React.isValidElement(node)) return []
  const element = node as AnyElement
  return [
    ...(predicate(element) ? [element] : []),
    ...childrenOf(element).flatMap((child) => findAll(child, predicate)),
  ]
}

function find(tree: ReactNode, type: unknown): AnyElement {
  const found = findAll(tree, (element) => element.type === type)[0]
  assert.ok(found, `${(type as { name?: string }).name ?? "element"} on screen`)
  return found
}

function absent(tree: ReactNode, type: unknown) {
  assert.equal(findAll(tree, (element) => element.type === type).length, 0)
}

function createHarness(render: () => ReactElement) {
  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: ReactDispatcherInternals
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const values: unknown[] = []
  let cursor = 0
  const dispatcher = {
    useState<T>(initial: T | (() => T)): [T, (next: T | ((previous: T) => T)) => void] {
      const index = cursor++
      if (values.length <= index) {
        values[index] = typeof initial === "function" ? (initial as () => T)() : initial
      }
      return [
        values[index] as T,
        (next) => {
          values[index] =
            typeof next === "function" ? (next as (previous: T) => T)(values[index] as T) : next
        },
      ]
    },
  }
  return {
    render(): ReactElement {
      cursor = 0
      const previous = internals.H
      internals.H = dispatcher
      try {
        return render()
      } finally {
        internals.H = previous
      }
    },
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

type Recorded = { url: string; method: string | undefined; body: unknown }

function mockFetch(
  t: { after: (fn: () => void) => void },
  respond: (request: Recorded) => { status: number; body: unknown },
): Recorded[] {
  const requests: Recorded[] = []
  const original = globalThis.fetch
  t.after(() => {
    globalThis.fetch = original
  })
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = {
      url: String(input),
      method: init?.method,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    }
    requests.push(request)
    const { status, body } = respond(request)
    return { ok: status < 400, status, json: async () => body } as unknown as Response
  }) as typeof fetch
  return requests
}

function view(overrides: Partial<DiscoveryIntakeItemView> = {}): DiscoveryIntakeItemView {
  return {
    id: "item-1",
    category: "shampoo",
    source: "catalog_search",
    brandText: "Balea",
    productNameText: "Aqua Hyaluron Shampoo",
    barcodeIdentifier: null,
    productType: "shampoo",
    frequency: "weekly_3_4x",
    ...overrides,
  }
}

function checklist(
  items: DiscoveryIntakeItemView[],
  initialHeatStyling: DiscoveryHeatStylingV1 | null = null,
) {
  return createHarness(() =>
    DiscoveryIntakeChecklist({
      initialItems: items,
      initialSubmitted: false,
      initialHeatStyling,
      retailerSearchEnabled: false,
    }),
  )
}

function sheetFlow(tree: ReactNode): AddFlow {
  const flow = find(tree, DiscoveryAddSheet).props.flow as AddFlow | null
  assert.ok(flow, "the add sheet has a flow")
  return flow
}

const CONDITIONER_RESULT: ScanSearchResult = {
  id: "20000000-0000-4000-8000-000000000003",
  name: "Oil Repair Intensiv Spülung",
  brand: "Balea",
  category: "conditioner",
  categoryLabel: "Conditioner",
  imageUrl: "https://catalog.example/spuelung.webp",
  productLine: "Professional",
}

// --- Products + add sheet --------------------------------------------------------------------

test("„Deine Produkte“: ghost slots in shelf order, her cards in their slot, then the rest and „+ Weiteres“", () => {
  const entries = discoveryGridEntries([
    view(),
    view({ id: "styling", category: null, productType: "styling", productNameText: "Haarspray" }),
    view({ id: "old", source: "none", category: "mask" }),
  ])
  assert.deepEqual(
    entries.map((entry) =>
      entry.kind === "ghost"
        ? entry.slot
        : entry.kind === "card"
          ? `card:${entry.item.id}`
          : "more",
    ),
    [
      "card:item-1",
      "conditioner",
      "leave_in",
      "mask",
      "oil",
      "heat_protectant",
      "card:styling",
      "more",
    ],
  )

  const html = renderToStaticMarkup(
    <DiscoveryProductsScreen
      items={[]}
      error={null}
      cameraBlocked={false}
      landedKey={null}
      onSearch={() => {}}
      onScan={() => {}}
      onEdit={() => {}}
      onFrequency={() => {}}
      onRemove={() => {}}
      onContinue={() => {}}
    />,
  )
  assert.match(html, /<h1[^>]*>Deine Produkte<\/h1>/)
  for (const label of [
    "Shampoo",
    "Conditioner",
    "Leave-in",
    "Maske",
    "Öl",
    "Hitzeschutz",
    "Weiteres",
    "Produkt suchen",
    "Scannen",
  ]) {
    assert.match(html, new RegExp(`>${label}<`), label)
  }
  assert.doesNotMatch(html, /Weiter</, "no „Weiter“ before the first product")
  assert.doesNotMatch(html, /Nicht gefunden/, "no typed-entry link on this screen")
  assert.doesNotMatch(html, /Trag ein/, "title only — no lead text")
})

test("the product card: packshot, brand · line, bold name, plum capsule, frequency line", () => {
  const html = renderToStaticMarkup(
    <DiscoveryProductCard
      item={view({
        category: "oil",
        productType: "oil",
        usageRole: "pre_wash_fibre_treatment",
        productLine: "Oil Repair",
        productNameText: "Haaröl Intensiv",
        imageUrl: "https://catalog.example/oel.webp",
        frequency: "weekly_1x",
      })}
      landed
      onEdit={() => {}}
      onFrequency={() => {}}
      onRemove={() => {}}
    />,
  )
  assert.match(html, /src="https:\/\/catalog\.example\/oel\.webp"/)
  assert.match(html, /Balea · Oil Repair/)
  assert.match(html, />Haaröl Intensiv</)
  assert.match(html, />Öl</)
  assert.match(html, />Vor der Wäsche · 1× pro Woche</)
  assert.match(html, /discovery-land/)
  assert.doesNotMatch(html, /Wie oft\?/)
})

test("a draft from the old checklist (no frequency) shows the „Wie oft?“ pill", () => {
  const html = renderToStaticMarkup(
    <DiscoveryProductCard
      item={view({ frequency: undefined })}
      landed={false}
      onEdit={() => {}}
      onFrequency={() => {}}
      onRemove={() => {}}
    />,
  )
  assert.match(html, />Wie oft\?</)
})

test("search pick → usage → frequency: ONE add with the frequency, the sheet closes, the card lands", async (t) => {
  const stored = view({
    id: "item-9",
    category: "conditioner",
    productType: "conditioner",
    productNameText: CONDITIONER_RESULT.name,
    frequency: "weekly_3_4x",
  })
  const requests = mockFetch(t, () => ({ status: 201, body: { item: stored } }))
  const harness = checklist([view()])

  let tree = harness.render()
  find(tree, DiscoveryProductsScreen).props.onSearch(null)
  tree = harness.render()
  assert.equal(find(tree, DiscoveryAddSheet).props.open, true)
  assert.equal(currentStep(sheetFlow(tree)).kind, "search")

  find(tree, DiscoveryAddSheet).props.handlers.onPickCatalog(CONDITIONER_RESULT)
  tree = harness.render()
  const usage = currentStep(sheetFlow(tree))
  assert.equal(usage.kind, "usage")
  assert.equal(requests.length, 0, "nothing is written before the frequency")

  const option = usage.kind === "usage" ? usage.question.options[0] : null
  find(tree, DiscoveryAddSheet).props.handlers.onUsage(option)
  tree = harness.render()
  const frequency = currentStep(sheetFlow(tree))
  assert.deepEqual(frequency, { kind: "frequency", current: null, suggestion: "weekly_3_4x" })

  find(tree, DiscoveryAddSheet).props.handlers.onFrequency("weekly_3_4x")
  // Batch 8: the card lands right away (provisional) while the POST runs.
  tree = harness.render()
  assert.equal(find(tree, DiscoveryAddSheet).props.open, false, "the sheet closes at once")
  const landing = find(tree, DiscoveryProductsScreen)
  const provisional = landing.props.items.at(-1) as DiscoveryIntakeItemView
  assert.match(provisional.id, /^provisional:/)
  assert.equal(provisional.productNameText, CONDITIONER_RESULT.name)
  assert.equal(landing.props.landedKey, provisional.id)
  await settle()
  tree = harness.render()

  assert.deepEqual(requests, [
    {
      url: "/api/beratung/intake/items",
      method: "POST",
      body: {
        capture: {
          source: "catalog_search",
          productId: CONDITIONER_RESULT.id,
          brandText: "Balea",
          productNameText: CONDITIONER_RESULT.name,
        },
        productType: "conditioner",
        usage: { category: "conditioner", role: null },
        frequency: "weekly_3_4x",
      },
    },
  ])
  assert.equal(find(tree, DiscoveryAddSheet).props.open, false, "the sheet closes")
  const screen = find(tree, DiscoveryProductsScreen)
  assert.deepEqual(
    screen.props.items.map((item: DiscoveryIntakeItemView) => item.id),
    ["item-1", "item-9"],
  )
  // The confirmed card keeps the provisional card's key — no re-mount, no second landing.
  assert.deepEqual(screen.props.itemKeys, { "item-9": provisional.id })
  assert.equal(screen.props.landedKey, provisional.id)
})

test("a failed add rolls the card back and brings the sheet back on the frequency, saying so", async (t) => {
  mockFetch(t, () => ({ status: 503, body: { code: "unavailable" } }))
  const harness = checklist([])
  let tree = harness.render()
  find(tree, DiscoveryProductsScreen).props.onSearch("heat_protectant")
  tree = harness.render()
  find(tree, DiscoveryAddSheet).props.handlers.onPickCatalog({
    ...CONDITIONER_RESULT,
    category: "heat_protectant",
    name: "Hitzeschutz",
  })
  tree = harness.render()
  find(tree, DiscoveryAddSheet).props.handlers.onFrequency("daily_1x")
  await settle()
  tree = harness.render()
  const sheet = find(tree, DiscoveryAddSheet)
  assert.equal(sheet.props.open, true)
  assert.equal(sheet.props.error, "Das hat gerade nicht geklappt. Versuch es nochmal.")
  assert.equal(currentStep(sheetFlow(tree)).kind, "frequency")
  assert.deepEqual(find(tree, DiscoveryProductsScreen).props.items, [], "the card rolled back")
})

test("the frequency step: every option, the shampoo suggestion in plum with its hint, „Weiß ich nicht“ quiet", () => {
  const html = renderToStaticMarkup(
    <DiscoveryFrequencyStep
      step={{ kind: "frequency", current: null, suggestion: "weekly_2x" }}
      busy={false}
      onFrequency={() => {}}
    />,
  )
  assert.match(html, /Wie oft nutzt du es\?/)
  for (const label of [
    "Täglich",
    "5–6× pro Woche",
    "3–4× pro Woche",
    "2× pro Woche",
    "1× pro Woche",
    "Alle 2 Wochen",
    "1× im Monat",
    "Seltener",
    "Weiß ich nicht",
  ]) {
    assert.match(html, new RegExp(`>${label}<`), label)
  }
  assert.match(
    html,
    /aria-pressed="true"[^>]*><span[^>]*>2× pro Woche<\/span><span[^>]*>Wie dein Shampoo</,
  )
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1, "nothing else preselected")

  const plain = renderToStaticMarkup(
    <DiscoveryFrequencyStep
      step={{ kind: "frequency", current: null, suggestion: null }}
      busy={false}
      onFrequency={() => {}}
    />,
  )
  assert.doesNotMatch(plain, /aria-pressed="true"/)
  assert.doesNotMatch(plain, /Wie dein Shampoo/)
})

const NO_HANDLERS = {
  onType: () => {},
  onUsage: () => {},
  onSpray: () => {},
  onFrequency: () => {},
  onBack: () => {},
  onSubmitName: () => {},
  onDecoded: () => false,
  onCameraUnavailable: () => {},
}

test("the sheet's steps: pinned product header, the spray question (D2), the typed name form", () => {
  const header = renderToStaticMarkup(
    <DiscoveryPinnedHeader
      subject={productSubject({
        brand: "Balea",
        line: "Professional",
        name: "Balea Plex Care 2in1",
      })}
      capsule="Maske"
      category="mask"
      onBack={() => {}}
    />,
  )
  assert.match(header, /aria-label="Zurück"/)
  assert.match(header, /Balea · Professional/)
  assert.match(header, />Plex Care 2in1</)
  assert.match(header, />Maske</)

  const spray = pickCapture(
    openAddSearch(),
    {
      source: "dm_search",
      barcodeIdentifier: "4015100000001",
      brandText: "Taft",
      productNameText: "Haarspray",
    },
    productSubject({ brand: "Taft", name: "Haarspray" }),
    { name: "Haarspray" },
    [],
  )
  const sprayHtml = renderToStaticMarkup(
    <DiscoveryAddStepBody flow={spray} busy={false} handlers={NO_HANDLERS} />,
  )
  assert.match(sprayHtml, /Wofür nutzt du das Spray\?/)
  for (const label of [
    "Hitzeschutz",
    "Pflegespray – bleibt im Haar \\(Leave-in\\)",
    "Styling &amp; Halt",
    "Weiß ich nicht",
  ]) {
    assert.match(sprayHtml, new RegExp(label), label)
  }

  const nameHtml = renderToStaticMarkup(
    <DiscoveryAddStepBody flow={startTyped(openAddSearch())} busy={false} handlers={NO_HANDLERS} />,
  )
  assert.match(nameHtml, /Wie heißt es\?/)
  assert.match(nameHtml, /placeholder="Marke"/)
  assert.match(nameHtml, /placeholder="Produktname"/)
  assert.match(nameHtml, />Weiter</)
})

test("„Wie oft?“ opens only the frequency step; its tap PATCHes only the frequency", async (t) => {
  const legacy = view({
    id: "legacy",
    category: "conditioner",
    productType: undefined,
    frequency: undefined,
  })
  const requests = mockFetch(t, () => ({
    status: 200,
    body: { item: { ...legacy, frequency: "weekly_2x" } },
  }))
  const harness = checklist([legacy])
  let tree = harness.render()
  find(tree, DiscoveryProductsScreen).props.onFrequency(legacy)
  tree = harness.render()
  assert.deepEqual(sheetFlow(tree).steps, [{ kind: "frequency", current: null, suggestion: null }])
  find(tree, DiscoveryAddSheet).props.handlers.onFrequency("weekly_2x")
  await settle()
  tree = harness.render()
  assert.deepEqual(requests, [
    { url: "/api/beratung/intake/items/legacy", method: "PATCH", body: { frequency: "weekly_2x" } },
  ])
  assert.equal(find(tree, DiscoveryProductsScreen).props.items[0].frequency, "weekly_2x")
})

test("„Weiter“ with a product still missing its frequency asks it first instead of moving on", () => {
  const legacy = view({ id: "legacy", frequency: undefined })
  const harness = checklist([view(), legacy])
  let tree = harness.render()
  find(tree, DiscoveryProductsScreen).props.onContinue()
  tree = harness.render()
  find(tree, DiscoveryProductsScreen)
  const flow = sheetFlow(tree)
  assert.equal(find(tree, DiscoveryAddSheet).props.open, true)
  assert.equal(flow.draft?.target.kind === "change" && flow.draft.target.item.id, "legacy")
})

// --- Routine -------------------------------------------------------------------------------

const ROUTINE_ITEMS: DiscoveryIntakeItemView[] = [
  view(),
  view({
    id: "cond",
    category: "conditioner",
    productType: "conditioner",
    productNameText: "Spülung",
    frequency: "weekly_3_4x",
  }),
  view({
    id: "mask",
    category: "mask",
    productType: "mask",
    productNameText: "Haarkur",
    frequency: "weekly_1x",
  }),
  view({
    id: "oil",
    category: "oil",
    productType: "oil",
    usageRole: "dry_finish",
    productNameText: "Glanzöl",
    frequency: "daily_1x",
  }),
  view({
    id: "heat",
    category: "heat_protectant",
    productType: "heat_protectant",
    productNameText: "Hitzeschutz",
    frequency: "weekly_2x",
  }),
  view({
    id: "open",
    source: "name_research",
    category: null,
    productType: undefined,
    productNameText: "Geheimtipp",
    frequency: "unknown",
  }),
]

test("„Deine Routine“ renders the composer's day cards with cadence pills and product thumbnails", () => {
  const html = renderToStaticMarkup(
    <DiscoveryRoutineScreen
      items={ROUTINE_ITEMS}
      onEdit={() => {}}
      onBack={() => {}}
      onConfirm={() => {}}
    />,
  )
  assert.match(html, /<h1[^>]*>Deine Routine<\/h1>/)
  const titles = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((match) => match[1])
  assert.deepEqual(titles, [
    "Waschtag",
    "Intensiv-Pflegetag",
    "Tag ohne Wäsche",
    "Styling",
    "Weitere",
  ])
  assert.match(html, /Waschtag<\/h2><span[^>]*>3–4× pro Woche</)
  assert.match(html, /Intensiv-Pflegetag<\/h2><span[^>]*>1× pro Woche</)
  assert.match(html, />Öl · Als Finish</)
  assert.match(html, />Kategorie offen</)
  assert.match(html, />Stimmt so</)
  assert.match(html, />Noch was ergänzen</)
  assert.doesNotMatch(html, /underline/, "no underline-only CTA")
})

test("products → „Weiter“ → routine; a routine product opens its edit sheet; „Noch was ergänzen“ goes back", () => {
  const harness = checklist(ROUTINE_ITEMS.slice(0, 3))
  let tree = harness.render()
  find(tree, DiscoveryProductsScreen).props.onContinue()
  tree = harness.render()
  const routine = find(tree, DiscoveryRoutineScreen)
  absent(tree, DiscoveryProductsScreen)

  routine.props.onEdit(ROUTINE_ITEMS[2])
  tree = harness.render()
  const flow = sheetFlow(tree)
  assert.equal(flow.mode, "edit")
  assert.equal(currentStep(flow).kind, "usage")

  find(tree, DiscoveryRoutineScreen).props.onBack()
  tree = harness.render()
  find(tree, DiscoveryProductsScreen)
})

// --- Hitze & Styling -----------------------------------------------------------------------

function toHeat(harness: ReturnType<typeof checklist>) {
  let tree = harness.render()
  find(tree, DiscoveryProductsScreen).props.onContinue()
  tree = harness.render()
  find(tree, DiscoveryRoutineScreen).props.onConfirm()
  return harness.render()
}

function heatKeys(tree: ReactNode): string[] {
  return (find(tree, DiscoveryHeatScreen).props.steps as ReturnType<typeof discoveryHeatSteps>).map(
    heatStepKey,
  )
}

function heatStep(tree: ReactNode): string {
  const screen = find(tree, DiscoveryHeatScreen)
  return heatStepKey(screen.props.steps[screen.props.index])
}

test("heat branching: air drying only skips every tool question; one PUT on the way to the final page", async (t) => {
  const requests = mockFetch(t, (request) => ({ status: 200, body: { heatStyling: request.body } }))
  const harness = checklist([view()])
  let tree = toHeat(harness)
  assert.equal(heatStep(tree), "drying")

  find(tree, DiscoveryHeatScreen).props.onDrying(["air_dry"])
  tree = harness.render()
  find(tree, DiscoveryHeatScreen).props.onNext()
  await settle()
  tree = harness.render()
  assert.equal(heatStep(tree), "tools")

  find(tree, DiscoveryHeatScreen).props.onTools([])
  tree = harness.render()
  assert.deepEqual(heatKeys(tree), ["drying", "tools", "summary"])
  find(tree, DiscoveryHeatScreen).props.onNext()
  await settle()
  tree = harness.render()

  assert.equal(heatStep(tree), "summary")
  assert.deepEqual(requests, [
    {
      url: "/api/beratung/intake/heat-styling",
      method: "PUT",
      body: { dryingRoutes: ["air_dry"], additionalHeatTools: [], heatEvents: {} },
    },
  ])
})

test("heat branching: plain föhnen asks only „Wie oft?“; a straightener also asks for heat protection", async (t) => {
  const requests = mockFetch(t, (request) => ({ status: 200, body: { heatStyling: request.body } }))
  const harness = checklist([view()])
  let tree = toHeat(harness)
  find(tree, DiscoveryHeatScreen).props.onDrying(["ordinary_blow_dry"])
  tree = harness.render()
  find(tree, DiscoveryHeatScreen).props.onNext()
  await settle()
  tree = harness.render()
  find(tree, DiscoveryHeatScreen).props.onTools(["straightener"])
  tree = harness.render()
  assert.deepEqual(heatKeys(tree), [
    "drying",
    "tools",
    "frequency:ordinary_blow_dry",
    "frequency:straightener",
    "protection:straightener",
    "summary",
  ])
  find(tree, DiscoveryHeatScreen).props.onNext()
  await settle()
  tree = harness.render()

  assert.equal(heatStep(tree), "frequency:ordinary_blow_dry")
  find(tree, DiscoveryHeatScreen).props.onFrequency("ordinary_blow_dry", "daily_1x")
  await settle()
  tree = harness.render()
  assert.equal(heatStep(tree), "frequency:straightener", "no protection question for plain föhnen")
  find(tree, DiscoveryHeatScreen).props.onFrequency("straightener", "weekly_2x")
  await settle()
  tree = harness.render()
  assert.equal(heatStep(tree), "protection:straightener")
  assert.equal(requests.length, 0, "nothing saved before the last answer")
  find(tree, DiscoveryHeatScreen).props.onProtection("straightener", "sometimes")
  await settle()
  tree = harness.render()

  assert.equal(heatStep(tree), "summary")
  assert.deepEqual(
    requests.map((request) => request.body),
    [
      {
        dryingRoutes: ["ordinary_blow_dry"],
        additionalHeatTools: ["straightener"],
        heatEvents: {
          "heat:ordinary_blow_dry": { frequency: "daily_1x" },
          "heat:straightener": { frequency: "weekly_2x", protectionConsistency: "sometimes" },
        },
      },
    ],
  )
})

test("the heat questions use production options, icons and photos — and the none options, without sublines", () => {
  const drying = renderToStaticMarkup(
    <DiscoveryHeatStepBody
      step={{ kind: "drying" }}
      draft={{ heatEvents: {} }}
      onDrying={() => {}}
      onTools={() => {}}
      onFrequency={() => {}}
      onProtection={() => {}}
    />,
  )
  assert.match(drying, /Wie trocknet dein Haar meistens\?/)
  for (const label of [
    "Lufttrocknen",
    "Gewöhnlich föhnen",
    "Diffusor oder formender Luftstrom",
    "Keiner dieser Wege",
  ]) {
    assert.match(drying, new RegExp(label), label)
  }
  assert.doesNotMatch(drying, /aria-pressed="true"/, "unanswered: not even the none option is on")
  assert.doesNotMatch(drying, /bewusst leer|trifft gerade zu/, "no subline under the none option")

  const tools = renderToStaticMarkup(
    <DiscoveryHeatStepBody
      step={{ kind: "tools" }}
      draft={{ dryingRoutes: [], additionalHeatTools: [], heatEvents: {} }}
      onDrying={() => {}}
      onTools={() => {}}
      onFrequency={() => {}}
      onProtection={() => {}}
    />,
  )
  assert.match(tools, /Nutzt du weitere Hitze-Tools\?/)
  assert.match(tools, /images%2Ftools%2Fstraightener\.webp|\/images\/tools\/straightener\.webp/)
  assert.match(tools, /Keine weiteren Tools/)
  assert.match(tools, /aria-pressed="true"/, "„Keine weiteren Tools“ answered")

  const frequency = renderToStaticMarkup(
    <DiscoveryHeatStepBody
      step={{ kind: "frequency", source: "straightener" }}
      draft={{ heatEvents: {} }}
      onDrying={() => {}}
      onTools={() => {}}
      onFrequency={() => {}}
      onProtection={() => {}}
    />,
  )
  assert.match(frequency, /Wie oft nutzt du das Glätteisen\?/)
  assert.match(frequency, /\/images\/tools\/straightener\.webp/)
  assert.doesNotMatch(frequency, /Weiß ich nicht/, "a heat event needs a concrete frequency")

  const protection = renderToStaticMarkup(
    <DiscoveryHeatStepBody
      step={{ kind: "protection", source: "straightener" }}
      draft={{ heatEvents: {} }}
      onDrying={() => {}}
      onTools={() => {}}
      onFrequency={() => {}}
      onProtection={() => {}}
    />,
  )
  assert.match(protection, /Nutzt du dabei Hitzeschutz\?/)
  for (const label of ["Immer", "Manchmal", "Nein", "Unsicher"])
    assert.match(protection, new RegExp(`>${label}<`))
})

test("returning to edit: the flow is prefilled from her saved heat answers", () => {
  const saved: DiscoveryHeatStylingV1 = {
    dryingRoutes: ["diffuser_or_airflow_shaping"],
    additionalHeatTools: [],
    heatEvents: {
      "heat:diffuser_airflow_shaping": { frequency: "weekly_2x", protectionConsistency: "always" },
    },
  }
  const harness = checklist([view()], saved)
  const tree = toHeat(harness)
  const screen = find(tree, DiscoveryHeatScreen)
  assert.deepEqual(screen.props.draft.dryingRoutes, ["diffuser_or_airflow_shaping"])
  assert.deepEqual(heatKeys(tree), [
    "drying",
    "tools",
    "frequency:diffuser_airflow_shaping",
    "protection:diffuser_airflow_shaping",
    "summary",
  ])
})

// --- Final page + submit -------------------------------------------------------------------

const DONE_HEAT: DiscoveryHeatDraft = {
  dryingRoutes: ["ordinary_blow_dry"],
  additionalHeatTools: ["straightener"],
  heatEvents: {
    "heat:ordinary_blow_dry": { frequency: "daily_1x" },
    "heat:straightener": { frequency: "weekly_2x", protectionConsistency: "sometimes" },
  },
}

test("the final page: three check rows — Fragebogen, products with the Waschtag rhythm, heat tools — no reassurance line", () => {
  assert.deepEqual(
    discoveryFinalRows(ROUTINE_ITEMS, DONE_HEAT).map((row) => [row.label, row.details]),
    [
      ["Fragebogen", ["Erledigt"]],
      ["Deine Produkte", ["6 Produkte", "Waschtag 3–4× pro Woche"]],
      ["Hitze & Styling", ["Föhnen · Glätteisen"]],
    ],
  )
  assert.deepEqual(
    discoveryFinalRows([view()], {
      dryingRoutes: ["air_dry"],
      additionalHeatTools: [],
      heatEvents: {},
    })[2].details,
    ["Kein Hitze-Styling"],
  )

  const html = renderToStaticMarkup(
    <DiscoveryFinalPage
      items={ROUTINE_ITEMS}
      heat={DONE_HEAT}
      onEditProducts={() => {}}
      onEditHeat={() => {}}
    />,
  )
  assert.match(html, /<h1[^>]*>Alles bereit für unser Gespräch<\/h1>/)
  assert.match(html, /discovery-draw/)
  assert.equal(
    (html.match(/<button/g) ?? []).length,
    2,
    "rows 2 and 3 are tappable, the quiz row is not",
  )
  assert.match(html, /\/images\/tools\/blow_dryer\.webp/)
  const text = html.replace(/<[^>]+>/g, " ")
  assert.doesNotMatch(text, /keine Sorge|musst|brauchst|nichts/i, "no reassurance line")
})

test("final page rows lead back: products → „Deine Produkte“, heat → the first heat question; „Abschicken“ submits → done", async (t) => {
  const requests = mockFetch(t, (request) =>
    request.url.endsWith("/submit")
      ? {
          status: 200,
          body: { state: "submitted", submittedAt: "2026-09-25T10:00:00.000Z", confirmedNone: [] },
        }
      : { status: 200, body: { heatStyling: request.body } },
  )
  const harness = checklist([view()], {
    dryingRoutes: ["air_dry"],
    additionalHeatTools: [],
    heatEvents: {},
  })
  let tree = toHeat(harness)
  find(tree, DiscoveryHeatScreen).props.onNext()
  await settle()
  tree = harness.render()
  find(tree, DiscoveryHeatScreen).props.onNext()
  await settle()
  tree = harness.render()
  assert.equal(heatStep(tree), "summary")

  find(tree, DiscoveryHeatScreen).props.onEditHeat()
  tree = harness.render()
  assert.equal(heatStep(tree), "drying")
  assert.equal(find(tree, DiscoveryHeatScreen).props.direction, -1)

  find(tree, DiscoveryHeatScreen).props.onEditProducts()
  tree = harness.render()
  find(tree, DiscoveryProductsScreen)

  // …and the whole way through again, to „Abschicken“.
  tree = toHeat(harness)
  find(tree, DiscoveryHeatScreen).props.onNext()
  await settle()
  tree = harness.render()
  find(tree, DiscoveryHeatScreen).props.onNext()
  await settle()
  tree = harness.render()
  find(tree, DiscoveryHeatScreen).props.onSubmit()
  await settle()
  tree = harness.render()

  assert.deepEqual(requests.at(-1), {
    url: "/api/beratung/intake/submit",
    method: "POST",
    body: { confirmNoneForMissing: true },
  })
  const html = renderToStaticMarkup(tree)
  assert.match(html, /Danke! Bis bald im Gespräch\./)
  absent(tree, DiscoveryAddSheet)
})

test("a failed submit keeps the final page and says so", async (t) => {
  mockFetch(t, (request) =>
    request.url.endsWith("/submit")
      ? { status: 503, body: { code: "unavailable" } }
      : { status: 200, body: { heatStyling: request.body } },
  )
  const harness = checklist([view()], { dryingRoutes: [], additionalHeatTools: [], heatEvents: {} })
  let tree = toHeat(harness)
  find(tree, DiscoveryHeatScreen).props.onNext()
  await settle()
  tree = harness.render()
  find(tree, DiscoveryHeatScreen).props.onNext()
  await settle()
  tree = harness.render()
  find(tree, DiscoveryHeatScreen).props.onSubmit()
  await settle()
  tree = harness.render()
  const screen = find(tree, DiscoveryHeatScreen)
  assert.equal(heatStep(tree), "summary")
  assert.equal(screen.props.error, "Das Absenden hat nicht geklappt. Versuch es nochmal.")
  assert.equal(screen.props.submitting, false, "so she can simply tap again")
})

test("an intake submitted elsewhere lands on the done page instead of an error", async (t) => {
  mockFetch(t, () => ({ status: 409, body: { code: "already_submitted" } }))
  const harness = checklist([view()])
  let tree = harness.render()
  find(tree, DiscoveryProductsScreen).props.onRemove("item-1")
  await settle()
  tree = harness.render()
  assert.match(renderToStaticMarkup(tree), /Danke! Bis bald im Gespräch\./)
})
