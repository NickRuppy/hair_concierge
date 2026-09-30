import assert from "node:assert/strict"
import test from "node:test"

import type {
  DiscoveryCockpitStepView,
  DiscoveryCockpitSwapOption,
} from "../src/lib/discovery/cockpit"
import { runsheetLockedIn, type RunsheetLockedInSelection } from "../src/lib/discovery/runsheet"
import type { PersonalPlanCategory } from "../src/lib/personal-plan/products/contracts"

/**
 * „Für den Plan festgehalten" (produktphase-lockin T1): the call's recorded decisions
 * compiled into Neu kaufen / Behalten / Weglassen / Bewusst ohne Produkt, one row per decision
 * unit (step + her product, batch 9) — never per decisionKey alone. Pure: fixtures are
 * deep-frozen, so any write to the view throws.
 */

// --- fixtures ----------------------------------------------------------------------

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
  }
  return value
}

const EUR = (amount: string) => `${amount} €`

function option(
  productId: string,
  label: string,
  priceLabel: string | null,
  origin: DiscoveryCockpitSwapOption["origin"] = "alternative",
): DiscoveryCockpitSwapOption {
  return {
    productId,
    name: label,
    brand: null,
    label,
    verdictLabel: "Passt",
    priceLabel,
    imageUrl: null,
    origin,
    propertyRows: null,
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
    frequencyLabel: "2× pro Woche",
    depth: null,
    section: "basis",
    outcome: input.intakeItemId ? "undecided" : "ideal",
    ownedLabel: input.intakeItemId ? `Owned ${input.intakeItemId}` : null,
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

const shampooOptions = [
  option("alpha", "Alpha Shampoo", EUR("9,95")),
  option("beta", "Beta Shampoo", null),
]

/** Her shampoo (owned, one product), an empty mask step, her conditioner. */
function nomi(
  overrides: {
    shampoo?: Partial<DiscoveryCockpitStepView>
    mask?: Partial<DiscoveryCockpitStepView>
    conditioner?: Partial<DiscoveryCockpitStepView>
  } = {},
): DiscoveryCockpitStepView[] {
  return deepFreeze([
    step({
      decisionKey: "decision:shampoo",
      category: "shampoo",
      categoryLabel: "Shampoo",
      intakeItemId: "item-shampoo",
      ownedLabel: "Sebamed Anti Schuppen",
      swapOptions: shampooOptions,
      ...overrides.shampoo,
    }),
    step({
      decisionKey: "decision:mask",
      category: "mask",
      categoryLabel: "Maske",
      swapOptions: [option("mask-rec", "Olaplex No. 8", EUR("28,00"), "ideal_recommendation")],
      idealRecommendation: option(
        "mask-rec",
        "Olaplex No. 8",
        EUR("28,00"),
        "ideal_recommendation",
      ),
      ...overrides.mask,
    }),
    step({
      decisionKey: "decision:conditioner",
      category: "conditioner",
      categoryLabel: "Conditioner",
      intakeItemId: "item-conditioner",
      ownedLabel: "Balea Spülung",
      ...overrides.conditioner,
    }),
  ])
}

// --- semantics ---------------------------------------------------------------------

test("nothing decided: every group empty, every entry open, zero total", () => {
  const lockedIn = runsheetLockedIn(nomi())
  assert.deepEqual(lockedIn, {
    buy: [],
    keep: [],
    discard: [],
    skip: [],
    totalLabel: EUR("0,00"),
    missingPrices: false,
    hasKnownPrice: false,
    openCount: 3,
  })
})

test("stored decisions: swap → buy with the chosen product's price, keep → keep, empty keep → skip", () => {
  const lockedIn = runsheetLockedIn(
    nomi({
      shampoo: { outcome: "swapped", swapProductId: "alpha", swapProductLabel: "Alpha Shampoo" },
      mask: { outcome: "kept" },
      conditioner: { outcome: "kept" },
    }),
  )
  assert.deepEqual(lockedIn.buy, [
    { label: "Alpha Shampoo", categoryLabel: "Shampoo", priceLabel: EUR("9,95") },
  ])
  assert.deepEqual(lockedIn.keep, [{ label: "Balea Spülung", categoryLabel: "Conditioner" }])
  assert.deepEqual(lockedIn.skip, [{ categoryLabel: "Maske" }])
  assert.deepEqual(lockedIn.discard, [])
  assert.equal(lockedIn.totalLabel, EUR("9,95"))
  assert.equal(lockedIn.missingPrices, false)
  assert.equal(lockedIn.openCount, 0)
})

test("a new product for an empty step is bought at the recommendation's price", () => {
  const lockedIn = runsheetLockedIn(
    nomi({
      shampoo: { outcome: "swapped", swapProductId: "alpha" },
      mask: { outcome: "swapped", swapProductId: "mask-rec" },
    }),
  )
  assert.deepEqual(
    lockedIn.buy.map((row) => [row.label, row.categoryLabel, row.priceLabel]),
    [
      ["Alpha Shampoo", "Shampoo", EUR("9,95")],
      ["Olaplex No. 8", "Maske", EUR("28,00")],
    ],
  )
  assert.equal(lockedIn.totalLabel, EUR("37,95"))
  assert.equal(lockedIn.openCount, 1)
})

test("live selections override the stored outcome (derivation input; click handling itself is untested here)", () => {
  const steps = nomi({ shampoo: { outcome: "kept" } })
  const live: Record<string, RunsheetLockedInSelection> = {
    "decision:shampoo": { decision: "swap", swapProductId: "beta" },
    "decision:conditioner": { decision: "keep", swapProductId: null },
  }
  const lockedIn = runsheetLockedIn(steps, (entry) => live[entry.decisionKey] ?? null)
  assert.deepEqual(lockedIn.buy, [
    { label: "Beta Shampoo", categoryLabel: "Shampoo", priceLabel: null },
  ])
  assert.deepEqual(lockedIn.keep, [{ label: "Balea Spülung", categoryLabel: "Conditioner" }])
  // The mask has no live selection: open, whatever its stored outcome says.
  assert.equal(lockedIn.openCount, 1)
})

test("a missing price: the row keeps no price, the total counts the known ones and says so", () => {
  const lockedIn = runsheetLockedIn(
    nomi({
      shampoo: { outcome: "swapped", swapProductId: "beta" },
      mask: { outcome: "swapped", swapProductId: "mask-rec" },
    }),
  )
  assert.equal(lockedIn.buy[0]?.priceLabel, null)
  assert.equal(lockedIn.totalLabel, EUR("28,00"))
  assert.equal(lockedIn.missingPrices, true)
})

test("an unreadable price label (a range) is shown but not summed — missing, never guessed", () => {
  const lockedIn = runsheetLockedIn(
    nomi({
      shampoo: {
        outcome: "swapped",
        swapProductId: "range",
        swapOptions: [option("range", "Range Shampoo", "5,45 € – 7,90 €")],
      },
    }),
  )
  assert.equal(lockedIn.buy[0]?.priceLabel, "5,45 € – 7,90 €")
  assert.equal(lockedIn.totalLabel, EUR("0,00"))
  assert.equal(lockedIn.missingPrices, true)
})

test("the total sums in cents: no floating-point drift", () => {
  const lockedIn = runsheetLockedIn(
    nomi({
      shampoo: {
        outcome: "swapped",
        swapProductId: "a",
        swapOptions: [option("a", "A", EUR("0,10"))],
      },
      mask: {
        outcome: "swapped",
        swapProductId: "b",
        swapOptions: [option("b", "B", EUR("0,20"))],
      },
    }),
  )
  assert.equal(lockedIn.totalLabel, EUR("0,30"))
})

test("a decided target the options no longer list keeps the stored label, without a price", () => {
  const lockedIn = runsheetLockedIn(
    nomi({
      shampoo: {
        outcome: "swapped",
        swapProductId: "gone",
        swapProductLabel: "Delisted Shampoo",
      },
    }),
  )
  assert.deepEqual(lockedIn.buy, [
    { label: "Delisted Shampoo", categoryLabel: "Shampoo", priceLabel: null },
  ])
  assert.equal(lockedIn.missingPrices, true)
})

test("a swap without a target is not a finished decision: it stays open", () => {
  const steps = nomi()
  const lockedIn = runsheetLockedIn(steps, (entry) =>
    entry.decisionKey === "decision:shampoo" ? { decision: "swap", swapProductId: null } : null,
  )
  assert.deepEqual(lockedIn.buy, [])
  assert.equal(lockedIn.openCount, 3)
})

// --- batch 9: several of her products in one step -----------------------------------

function twoShampoos(
  first: Partial<DiscoveryCockpitStepView>,
  second: Partial<DiscoveryCockpitStepView>,
): DiscoveryCockpitStepView[] {
  return deepFreeze([
    step({
      decisionKey: "decision:shampoo",
      category: "shampoo",
      categoryLabel: "Shampoo",
      intakeItemId: "item-a",
      ownedLabel: "Shampoo A",
      stepEntryCount: 2,
      swapOptions: shampooOptions,
      ...first,
    }),
    step({
      decisionKey: "decision:shampoo",
      category: "shampoo",
      categoryLabel: "Shampoo",
      intakeItemId: "item-b",
      ownedLabel: "Shampoo B",
      stepEntryCount: 2,
      swapOptions: shampooOptions,
      ...second,
    }),
  ])
}

test("multi-product step: each of her products is its own decision unit", () => {
  const lockedIn = runsheetLockedIn(
    twoShampoos({ outcome: "kept" }, { outcome: "swapped", swapProductId: "alpha" }),
  )
  assert.deepEqual(lockedIn.keep, [{ label: "Shampoo A", categoryLabel: "Shampoo" }])
  assert.deepEqual(lockedIn.buy, [
    { label: "Alpha Shampoo", categoryLabel: "Shampoo", priceLabel: EUR("9,95") },
  ])
  assert.equal(lockedIn.openCount, 0)
})

test("multi-product step: a dropped product is „Weglassen“ by name, never „ohne Produkt“; its sibling still counts", () => {
  const lockedIn = runsheetLockedIn(twoShampoos({ outcome: "kept" }, { outcome: "dropped" }))
  assert.deepEqual(lockedIn.keep, [{ label: "Shampoo A", categoryLabel: "Shampoo" }])
  assert.deepEqual(lockedIn.discard, [{ label: "Shampoo B", categoryLabel: "Shampoo" }])
  assert.deepEqual(lockedIn.skip, [])
  assert.equal(lockedIn.openCount, 0)
})

test("a drop on an empty step has no product of hers to discard: it stays „ohne Produkt“", () => {
  const lockedIn = runsheetLockedIn(nomi({ mask: { outcome: "dropped" } }))
  assert.deepEqual(lockedIn.discard, [])
  assert.deepEqual(lockedIn.skip, [{ categoryLabel: "Maske" }])
})

test("multi-product step: one decided, one open — the open one counts once, not the step", () => {
  const steps = twoShampoos({}, {})
  const live: Record<string, RunsheetLockedInSelection> = {
    "item-a": { decision: "keep", swapProductId: null },
  }
  const lockedIn = runsheetLockedIn(steps, (entry) => live[entry.intakeItemId ?? ""] ?? null)
  assert.deepEqual(lockedIn.keep, [{ label: "Shampoo A", categoryLabel: "Shampoo" }])
  assert.equal(lockedIn.openCount, 1)
})

test("no steps at all: empty, nothing open", () => {
  assert.deepEqual(runsheetLockedIn([]), {
    buy: [],
    keep: [],
    discard: [],
    skip: [],
    totalLabel: EUR("0,00"),
    missingPrices: false,
    hasKnownPrice: false,
    openCount: 0,
  })
})

test("Codex F1: a non-EUR price label never enters the euro total", () => {
  const dollar = step({
    decisionKey: "mask:mask_intensive:none",
    category: "mask",
    categoryLabel: "Haarmaske",
    swapOptions: [option("p-dollar", "Dollar-Maske", "5,45 $")],
  })
  const lockedIn = runsheetLockedIn([dollar], () => ({
    decision: "swap",
    swapProductId: "p-dollar",
  }))
  assert.equal(lockedIn.missingPrices, true)
  assert.equal(lockedIn.hasKnownPrice, false)
  // The row still shows the label as delivered; only the sum leaves it out.
  assert.equal(lockedIn.buy[0]?.priceLabel, "5,45 $")
})
