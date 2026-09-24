import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { DiscoveryRoutineDocument } from "../src/components/discovery/print/discovery-routine-document"
import {
  buildDiscoveryCockpitView,
  discoveryProductImagesOf,
  type DiscoveryCockpitModel,
  type DiscoveryProductIdentity,
} from "../src/lib/discovery/cockpit"
import type { DiscoveryIdealStep } from "../src/lib/discovery/load-ideal-routine"
import {
  composeDiscoveryRefinedRoutine,
  type DiscoveryCallDecision,
  type DiscoveryIntakeItem,
} from "../src/lib/discovery/refined-routine"
import type { ScanCatalogPresentationRow } from "../src/lib/scan/product-presentation"

/**
 * Batch 6, part 2: every product on the participant's sheet shows its catalog packshot —
 * kept, swapped and new products in the routine, her own products on the shelf, and the
 * ones she no longer needs. The image is printed, so it is fingerprinted — but only where it
 * exists, so a routine without images keeps the hash it was finalised with.
 */

const ids = {
  keptShampoo: "30000000-0000-4000-8000-000000000001",
  ownedConditioner: "30000000-0000-4000-8000-000000000002",
  swapConditioner: "30000000-0000-4000-8000-000000000003",
  idealLeaveIn: "30000000-0000-4000-8000-000000000004",
  extraShampoo: "30000000-0000-4000-8000-000000000005",
}

const IMAGE = {
  keptShampoo: "https://catalog.example/kept-shampoo.png",
  ownedConditioner: "https://catalog.example/owned-conditioner.png",
  swapConditioner: "https://catalog.example/swap-conditioner.png",
  idealLeaveIn: "https://catalog.example/ideal-leave-in.png",
  extraShampoo: "https://catalog.example/extra-shampoo.png",
}

function step(
  overrides: Partial<DiscoveryIdealStep> & Pick<DiscoveryIdealStep, "decisionKey" | "category">,
): DiscoveryIdealStep {
  return {
    role: "shampoo_everyday",
    section: "basis",
    categoryLabel: "Shampoo",
    roleLabel: "Hauptreinigung",
    roleDescription: "Reinigt Kopfhaut und Ansatz.",
    frequencyLabel: "3× pro Woche",
    preview: null,
    ...overrides,
  }
}

const steps: DiscoveryIdealStep[] = [
  step({ decisionKey: "shampoo", category: "shampoo" }),
  step({
    decisionKey: "conditioner",
    category: "conditioner",
    role: "conditioner_rinse_out",
    categoryLabel: "Conditioner",
  }),
  step({
    decisionKey: "leave_in",
    category: "leave_in",
    role: "post_wash_leave_in",
    categoryLabel: "Leave-in",
    preview: {
      kind: "recommendation",
      category: "leave_in",
      role: "post_wash_leave_in",
      decisionKey: "leave_in",
      productId: ids.idealLeaveIn,
      productName: "Leichtes Leave-in",
      // The preview's own image is not what prints: the catalog packshot is.
      imageUrl: "https://catalog.example/preview-only.png",
      verdict: "ideal",
      authorityVersion: "v1",
      factFingerprint: "fp",
      commerce: {
        priceEur: null,
        purchaseLinkStatus: null,
        netContentValue: null,
        netContentUnit: null,
        priceLabel: null,
        netContentLabel: null,
        availabilityLabel: null,
        productUrl: null,
        affiliateDisclosure: null,
      },
      reasoning: { productCriteria: "Leicht.", fit: "Passt.", frequency: "nach jeder Wäsche" },
    },
  }),
]

function item(overrides: Partial<DiscoveryIntakeItem> & Pick<DiscoveryIntakeItem, "id">) {
  return {
    category: "shampoo" as const,
    source: "catalog_search" as const,
    brandText: null,
    productNameText: null,
    barcodeIdentifier: null,
    productId: null,
    productSubmissionId: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    ...overrides,
  } satisfies DiscoveryIntakeItem
}

const items: DiscoveryIntakeItem[] = [
  item({ id: "i-shampoo", productId: ids.keptShampoo, brandText: "A", productNameText: "Kept" }),
  item({
    id: "i-conditioner",
    category: "conditioner",
    productId: ids.ownedConditioner,
    brandText: "B",
    productNameText: "Alt",
    createdAt: "2026-09-20T10:01:00.000Z",
  }),
  // A second shampoo: no step left for it → „Brauchst du nicht mehr".
  item({
    id: "i-extra",
    productId: ids.extraShampoo,
    brandText: "C",
    productNameText: "Extra",
    createdAt: "2026-09-20T10:02:00.000Z",
  }),
]

const decisions: DiscoveryCallDecision[] = [
  { decisionKey: "shampoo", decision: "keep", swapProductId: null, intakeItemId: "i-shampoo" },
  {
    decisionKey: "conditioner",
    decision: "swap",
    swapProductId: ids.swapConditioner,
    intakeItemId: "i-conditioner",
  },
]

const swapRow: ScanCatalogPresentationRow = {
  id: ids.swapConditioner,
  name: "Neuer Conditioner",
  brand: "D",
  category: "conditioner",
  imageUrl: null,
  priceEur: null,
  currency: null,
  affiliateLink: null,
  purchaseLinkStatus: null,
  priceCheckedAt: null,
}

const ALL_IMAGES = new Map(
  (Object.keys(IMAGE) as Array<keyof typeof IMAGE>).map((key) => [ids[key], IMAGE[key]]),
)

function compose(productImages?: ReadonlyMap<string, string>) {
  return composeDiscoveryRefinedRoutine({
    steps,
    items,
    decisions,
    swapProducts: [swapRow],
    ...(productImages ? { productImages } : {}),
  })
}

test("the composition carries each printed product's packshot — and only where it prints", () => {
  const routine = compose(ALL_IMAGES)
  const [shampoo, conditioner, leaveIn] = routine.steps
  // kept: her product's image.
  assert.equal(shampoo?.ownedImageUrl, IMAGE.keptShampoo)
  // swapped: the new product's image, and her old one for the shelf.
  assert.equal(conditioner?.swapProductImageUrl, IMAGE.swapConditioner)
  assert.equal(conditioner?.ownedImageUrl, IMAGE.ownedConditioner)
  // new (the Idealplan's pick on an open step).
  assert.equal(leaveIn?.recommendationImageUrl, IMAGE.idealLeaveIn)
  // Not printed → not carried.
  assert.ok(!("recommendationImageUrl" in shampoo!))
  assert.ok(!("swapProductImageUrl" in shampoo!))
  // „Brauchst du nicht mehr".
  const extra = routine.unassignedIntakeProducts.find((entry) => entry.item.id === "i-extra")
  assert.equal(extra?.imageUrl, IMAGE.extraShampoo)
})

test("no images → the exact hash of the composition without the image input (legacy-stable)", () => {
  assert.equal(compose(new Map()).sourceHash, compose().sourceHash)
  const routine = compose()
  for (const entry of routine.steps) {
    assert.ok(!("ownedImageUrl" in entry))
    assert.ok(!("swapProductImageUrl" in entry))
    assert.ok(!("recommendationImageUrl" in entry))
  }
  for (const entry of routine.unassignedIntakeProducts) assert.ok(!("imageUrl" in entry))
})

test("a printed image moves the fingerprint; an image nobody prints does not", () => {
  const base = compose().sourceHash
  assert.notEqual(compose(new Map([[ids.keptShampoo, IMAGE.keptShampoo]])).sourceHash, base)
  assert.notEqual(
    compose(new Map([[ids.keptShampoo, "https://catalog.example/other.png"]])).sourceHash,
    compose(new Map([[ids.keptShampoo, IMAGE.keptShampoo]])).sourceHash,
  )
  // An id that no label on the sheet names.
  assert.equal(
    compose(new Map([["30000000-0000-4000-8000-0000000000ff", IMAGE.keptShampoo]])).sourceHash,
    base,
  )
})

test("only http(s) packshots are printable", () => {
  const identities = new Map<string, DiscoveryProductIdentity>([
    ["a", { name: "A", brand: null, productLine: null, imageUrl: "https://x.example/a.png" }],
    ["b", { name: "B", brand: null, productLine: null, imageUrl: "javascript:alert(1)" }],
    ["c", { name: "C", brand: null, productLine: null, imageUrl: null }],
    ["d", { name: "D", brand: null, productLine: null }],
  ])
  assert.deepEqual([...discoveryProductImagesOf(identities)], [["a", "https://x.example/a.png"]])
})

// --- the printed sheet ----------------------------------------------------------

function view(productImages?: ReadonlyMap<string, string>) {
  const model: DiscoveryCockpitModel = {
    status: "ready",
    steps,
    verdicts: [],
    previewSource: { personalPlanId: "discovery:x", sourceNeedVersionId: "v1" },
    routine: compose(productImages),
    recommendationProducts: [],
    recommendationBrandsAvailable: true,
  }
  return buildDiscoveryCockpitView(model)
}

function imageSources(markup: string): string[] {
  return [...markup.matchAll(/<img[^>]*src="([^"]*)"/g)].map((match) => match[1]!)
}

test("the PDF shows the packshot next to every product: routine, shelf and „Brauchst du nicht mehr“", () => {
  const markup = renderToStaticMarkup(
    <DiscoveryRoutineDocument name="Lena" view={view(ALL_IMAGES)} finalizedAt={null} />,
  )
  const sources = imageSources(markup)
  // Routine: kept shampoo, the swap target, the new leave-in.
  assert.ok(sources.includes(IMAGE.keptShampoo))
  assert.ok(sources.includes(IMAGE.swapConditioner))
  assert.ok(sources.includes(IMAGE.idealLeaveIn))
  // Shelf: her old conditioner (swapped away) and the kept shampoo again.
  assert.ok(sources.includes(IMAGE.ownedConditioner))
  assert.equal(sources.filter((source) => source === IMAGE.keptShampoo).length, 2)
  // Brauchst du nicht mehr.
  assert.ok(sources.includes(IMAGE.extraShampoo))
  // Print-safe: fixed square, contained, decorative (the name is right next to it).
  assert.match(markup, /class="dcp-thumb"/)
  assert.match(markup, /object-fit: contain/)
  assert.match(markup, /alt=""/)
})

test("a product without a packshot gets a quiet placeholder, never a broken image", () => {
  const markup = renderToStaticMarkup(
    <DiscoveryRoutineDocument name="Lena" view={view()} finalizedAt={null} />,
  )
  assert.deepEqual(imageSources(markup), [])
  // 3 routine steps + 2 shelf entries + 1 dropped product.
  assert.equal(markup.match(/dcp-thumb dcp-thumb-empty/g)?.length, 6)
})
