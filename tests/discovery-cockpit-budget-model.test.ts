import assert from "node:assert/strict"
import test from "node:test"

import {
  buildDiscoveryCockpitView,
  discoveryOverBudgetEur,
  loadDiscoveryCockpitModel,
  loadDiscoveryShoppingBudget,
  type DiscoveryCockpitModel,
} from "../src/lib/discovery/cockpit"
import type { DiscoveryIdealStep } from "../src/lib/discovery/load-ideal-routine"
import type { DiscoveryParticipantVerdict } from "../src/lib/discovery/load-participant-verdicts"
import type { DiscoveryIntakeItem } from "../src/lib/discovery/refined-routine"
import type { Stage1ProductExamplePreviewBudget } from "../src/lib/personal-plan/product-previews"
import type { ScanPresentedVerdictPayload, ScanProductHeader } from "../src/lib/scan/types"
import type { ShoppingBudget } from "../src/lib/user-facts/schema"

/**
 * Profi-tier Task 8, cockpit model: the participant's saved budget is read ONCE per
 * composition, handed to the Idealroutine previews and to the owned-product verdicts, exposed
 * on the model for the „Kundenbudget" panel, and marks over-budget swap options. Flag off,
 * no budget or an unreadable one: nothing changes.
 */

const ids = {
  intake: "40000000-0000-4000-8000-000000000001",
  user: "20000000-0000-4000-8000-000000000002",
  owned: "30000000-0000-4000-8000-000000000003",
  cheap: "30000000-0000-4000-8000-00000000000a",
  pricey: "30000000-0000-4000-8000-00000000000b",
  unpriced: "30000000-0000-4000-8000-00000000000d",
  ideal: "30000000-0000-4000-8000-00000000000c",
  item: "50000000-0000-4000-8000-000000000005",
}

const DECISION_KEY = "decision:shampoo:shampoo_everyday:gap"

function step(preview: DiscoveryIdealStep["preview"] = null): DiscoveryIdealStep {
  return {
    decisionKey: DECISION_KEY,
    category: "shampoo",
    role: "shampoo_everyday",
    section: "basis",
    categoryLabel: "Shampoo",
    roleLabel: "Hauptreinigung",
    roleDescription: "Kopfhaut waschen",
    frequencyLabel: "3× / Woche",
    preview,
  }
}

function idealPreview(priceEur: number | null, priceLabel: string | null) {
  return {
    kind: "recommendation" as const,
    category: "shampoo" as const,
    role: "shampoo_everyday" as const,
    decisionKey: DECISION_KEY,
    productId: ids.ideal,
    productName: "Lab Shampoo Ideal",
    imageUrl: "https://catalog.example/ideal.jpg",
    verdict: "ideal" as const,
    authorityVersion: "v1",
    factFingerprint: "fp",
    commerce: {
      priceEur,
      purchaseLinkStatus: null,
      netContentValue: null,
      netContentUnit: null,
      priceLabel,
      netContentLabel: null,
      availabilityLabel: null,
      productUrl: null,
      affiliateDisclosure: null,
    },
    reasoning: { productCriteria: "Leicht.", fit: "Passt.", frequency: "3×" },
  } as DiscoveryIdealStep["preview"]
}

const ownedItem: DiscoveryIntakeItem = {
  id: ids.item,
  category: "shampoo",
  source: "catalog_search",
  brandText: "Elvital",
  productNameText: "Hyaluron Pure",
  barcodeIdentifier: null,
  productId: ids.owned,
  productSubmissionId: null,
  createdAt: "2026-09-20T10:00:00.000Z",
}

const productHeader: ScanProductHeader = {
  productId: ids.owned,
  name: "Elvital Hyaluron Pure Shampoo",
  brand: "L'Oréal Paris",
  category: "shampoo",
  categoryLabel: "Shampoo",
  imageUrl: null,
  priceLabel: null,
  purchaseUrl: null,
}

function alternative(productId: string, priceLabel: string | null) {
  return {
    productId,
    displayName: `Alternative ${productId.slice(-1)}`,
    imageUrl: null,
    priceLabel,
    netContentLabel: null,
    verdict: "ideal" as const,
    verdictLabel: "Passt",
    brand: "Guhl",
    purchaseUrl: null,
  }
}

const verdictWithAlternatives: DiscoveryParticipantVerdict = {
  itemId: ids.item,
  productId: ids.owned,
  status: "verdict",
  product: productHeader,
  payload: {
    kind: "in_catalog",
    verdict: "supportive",
    verdictLabel: "Passt mit Einschränkung",
    verdictTitle: "Passt mit Einschränkung zu deinem Haar",
    status: "pending",
    subtitle: "2 von 3 Zielbereichen getroffen",
    evaluatedRole: "shampoo_everyday",
    evaluatedRoleLabel: "Hauptreinigung",
    dimensions: [],
    criteria: [],
    coverage: null,
    fitNarrative: null,
    alternatives: [
      alternative(ids.cheap, "4,95 €"),
      alternative(ids.pricey, "24,90 €"),
      alternative(ids.unpriced, null),
    ],
  } as ScanPresentedVerdictPayload,
}

const CAPPED_5: ShoppingBudget = { kind: "capped", limitEur: 5, allowExceptions: false }
const PREVIEW_BUDGET: Stage1ProductExamplePreviewBudget = {
  budget: CAPPED_5,
  statedConcerns: { currentConcerns: ["frizz"], primaryConcern: "frizz" },
}

type IdealCall = { userId: string; options: unknown }
type VerdictCall = { budget: ShoppingBudget | null; deps: unknown }

function harness(options: {
  loadShoppingBudget?: () => Promise<Stage1ProductExamplePreviewBudget | null>
  preview?: DiscoveryIdealStep["preview"]
  equalOptions?: DiscoveryIdealStep["equalOptions"]
  verdicts?: DiscoveryParticipantVerdict[]
}) {
  const idealCalls: IdealCall[] = []
  const verdictCalls: VerdictCall[] = []
  let budgetReads = 0
  const deps = {
    loadIdealRoutine: async (_admin: unknown, userId: string, _intake: string, opts?: unknown) => {
      idealCalls.push({ userId, options: opts })
      return {
        status: "ready" as const,
        steps: [
          options.equalOptions
            ? { ...step(options.preview ?? null), equalOptions: options.equalOptions }
            : step(options.preview ?? null),
        ],
        context: {} as never,
        previewSource: { personalPlanId: `discovery:${ids.intake}`, sourceNeedVersionId: "v1" },
      }
    },
    loadHeatStyling: async () => null,
    loadItems: async () => [ownedItem],
    loadVerdicts: (async (
      _admin: unknown,
      _userId: string,
      _items: unknown,
      _context: unknown,
      verdictDeps: unknown,
      budget: ShoppingBudget | null,
    ) => {
      verdictCalls.push({ budget, deps: verdictDeps })
      return options.verdicts ?? []
    }) as never,
    loadProductIdentities: async () => new Map(),
    loadDecisions: async () => [],
    loadSwapProducts: async () => [],
    ...(options.loadShoppingBudget
      ? {
          loadShoppingBudget: async () => {
            budgetReads += 1
            return options.loadShoppingBudget!()
          },
        }
      : {}),
  }
  return { deps, idealCalls, verdictCalls, budgetReads: () => budgetReads }
}

async function load(h: ReturnType<typeof harness>): Promise<DiscoveryCockpitModel> {
  const result = await loadDiscoveryCockpitModel(
    {} as never,
    { intakeId: ids.intake, userId: ids.user },
    h.deps as never,
  )
  assert.equal(result.status, "ready")
  return result as DiscoveryCockpitModel
}

test("a saved budget is read once and handed to the previews, the verdicts and the model", async () => {
  const h = harness({ loadShoppingBudget: async () => PREVIEW_BUDGET })
  const model = await load(h)

  assert.equal(h.budgetReads(), 1)
  assert.deepEqual(h.idealCalls, [{ userId: ids.user, options: { budget: PREVIEW_BUDGET } }])
  assert.equal(h.verdictCalls.length, 1)
  assert.deepEqual(h.verdictCalls[0].budget, CAPPED_5)
  assert.deepEqual(model.shoppingBudget, CAPPED_5)
})

test("without a saved budget the loaders are called exactly as before and the model carries null", async () => {
  const h = harness({ loadShoppingBudget: async () => null })
  const model = await load(h)

  // No routine override and no budget: no options object at all, as before.
  assert.deepEqual(h.idealCalls, [{ userId: ids.user, options: undefined }])
  assert.equal(h.verdictCalls[0].budget, null)
  assert.equal(model.shoppingBudget, null)
})

test("the default loader is flag-gated: flag off reads nothing and the composition is unchanged", async () => {
  let touched = false
  const client = {
    from() {
      touched = true
      throw new Error("must not read hair_profiles")
    },
  } as never
  assert.equal(await loadDiscoveryShoppingBudget(client, ids.user, () => false), null)
  assert.equal(touched, false)

  // The wired default (SHOPPING_BUDGET_ENABLED is not set in tests) behaves the same.
  const h = harness({})
  const model = await load(h)
  assert.equal(model.shoppingBudget, null)
  assert.deepEqual(h.idealCalls, [{ userId: ids.user, options: undefined }])
})

test("an unreadable budget fails open: no budget, the call still composes", async () => {
  const failing = {
    from() {
      throw new Error("hair_profiles down")
    },
  } as never
  const originalError = console.error
  console.error = () => {}
  try {
    assert.equal(await loadDiscoveryShoppingBudget(failing, ids.user, () => true), null)
    const h = harness({
      loadShoppingBudget: async () => {
        throw new Error("injected loader failure")
      },
    })
    const model = await load(h)
    assert.equal(model.shoppingBudget, null)
    assert.equal(h.verdictCalls[0].budget, null)
  } finally {
    console.error = originalError
  }
})

test("the default loader returns budget plus stated concerns from one narrow hair_profiles read", async () => {
  const reads: Array<{ table: string; columns: string; userId: string }> = []
  const client = {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(_column: string, userId: string) {
              reads.push({ table, columns, userId })
              return {
                maybeSingle: async () => ({
                  data: {
                    shopping_preferences: { budget: CAPPED_5 },
                    diagnostics: { currentConcerns: ["frizz"], primaryConcern: "frizz" },
                  },
                  error: null,
                }),
              }
            },
          }
        },
      }
    },
  } as never
  const loaded = await loadDiscoveryShoppingBudget(client, ids.user, () => true)
  assert.deepEqual(loaded, PREVIEW_BUDGET)
  assert.deepEqual(reads, [
    { table: "hair_profiles", columns: "shopping_preferences, diagnostics", userId: ids.user },
  ])
})

// --- the over-budget pill -------------------------------------------------------------------

test("discoveryOverBudgetEur: capped and over only, rounded to the cent", () => {
  assert.equal(discoveryOverBudgetEur(CAPPED_5, 24.9), 19.9)
  assert.equal(discoveryOverBudgetEur(CAPPED_5, 5), null)
  assert.equal(discoveryOverBudgetEur(CAPPED_5, 4.95), null)
  assert.equal(discoveryOverBudgetEur(CAPPED_5, null), null)
  assert.equal(discoveryOverBudgetEur({ kind: "uncapped" }, 99), null)
  assert.equal(discoveryOverBudgetEur(null, 99), null)
  assert.equal(
    discoveryOverBudgetEur({ kind: "capped", limitEur: 15, allowExceptions: true }, 15.01),
    0.01,
  )
})

test("swap options above a capped budget carry overBudgetEur; others and unpriced ones do not", async () => {
  const h = harness({
    loadShoppingBudget: async () => PREVIEW_BUDGET,
    verdicts: [verdictWithAlternatives],
  })
  const view = buildDiscoveryCockpitView(await load(h))
  const options = view.steps[0].swapOptions
  assert.deepEqual(
    options.map((option) => [option.productId, option.overBudgetEur]),
    [
      [ids.cheap, undefined],
      [ids.pricey, 19.9],
      [ids.unpriced, undefined],
    ],
  )
  // Absent, not null/0, when within budget: the option objects stay as before.
  assert.equal("overBudgetEur" in options[0], false)
})

test("the Idealplan recommendation uses the numeric price, else its label", async () => {
  for (const [priceEur, priceLabel, expected] of [
    [12.4, "12,40 €", 7.4],
    [null, "12,40 €", 7.4],
    [null, null, undefined],
    [4.5, "4,50 €", undefined],
  ] as const) {
    const h = harness({
      loadShoppingBudget: async () => PREVIEW_BUDGET,
      preview: idealPreview(priceEur, priceLabel),
    })
    const view = buildDiscoveryCockpitView(await load(h))
    assert.equal(view.steps[0].idealRecommendation?.overBudgetEur, expected)
    // With no alternatives and no owned verdict, the recommendation is the swap option.
    assert.equal(view.steps[0].swapOptions[0]?.overBudgetEur, expected)
  }
})

test("equally ideal options (tie-default equals) are marked above a capped budget too", async () => {
  const h = harness({
    loadShoppingBudget: async () => PREVIEW_BUDGET,
    preview: idealPreview(4.5, "4,50 €"),
    equalOptions: [
      {
        productId: "30000000-0000-4000-8000-0000000000e1",
        productName: "Teurer Bondbuilder",
        priceLabel: "12,40 €",
        imageUrl: null,
        applicationLabel: "Vorwäsche, ausspülen",
      },
      {
        productId: "30000000-0000-4000-8000-0000000000e2",
        productName: "Günstiger Bondbuilder",
        priceLabel: "3,95 €",
        imageUrl: null,
        applicationLabel: null,
      },
    ],
  })
  const view = buildDiscoveryCockpitView(await load(h))
  const equals = view.steps[0].swapOptions.filter((option) => option.origin === "equal_alternative")
  assert.deepEqual(
    equals.map((option) => option.overBudgetEur),
    [7.4, undefined],
  )
})

test("no budget, uncapped or flag off: no option is marked", async () => {
  for (const loaded of [
    null,
    { budget: { kind: "uncapped" } as ShoppingBudget } as Stage1ProductExamplePreviewBudget,
  ]) {
    const h = harness({
      loadShoppingBudget: async () => loaded,
      verdicts: [verdictWithAlternatives],
    })
    const view = buildDiscoveryCockpitView(await load(h))
    assert.ok(view.steps[0].swapOptions.every((option) => !("overBudgetEur" in option)))
  }
})
