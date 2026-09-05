import type { ScanSavedStatePayload } from "../src/lib/scan/saved-state"
import type {
  ScanProductHeader,
  ScanResolvedVerdictResult,
  ScanUnknownProductResult,
} from "../src/lib/scan/types"

/**
 * Fixtures for `tests/scan-flow.spec.ts`. Everything the `/labs/scan` harness's flow can
 * ask the server for, in the exact contract shapes `src/lib/scan/types.ts` declares —
 * typed rather than cast, so a contract change breaks the spec at `npm run typecheck`
 * instead of at 3am in CI.
 *
 * The two products are deliberately unbuyable (`purchaseUrl: null`): the footer then
 * collapses to a single "Speichern" slot, which is the button the save-race scenario
 * asserts on.
 */

/** Valid EAN-13 check digits — `validateEanInput` rejects anything else before it fires. */
export const EAN_PRODUCT_A = "4006381333931"
export const EAN_UNKNOWN = "4006381333948"
export const EAN_PRODUCT_B = "4006381333955"

export const PRODUCT_A_ID = "aaaaaaaa-0000-4000-8000-000000000001"
export const PRODUCT_B_ID = "bbbbbbbb-0000-4000-8000-000000000002"

export const NOT_SAVED: ScanSavedStatePayload = { state: null, managedByScan: false }

function productHeader(productId: string, name: string): ScanProductHeader {
  return {
    productId,
    name,
    brand: "Chaarlie Lab",
    category: "shampoo",
    categoryLabel: "Shampoo",
    imageUrl: null,
    priceLabel: null,
    purchaseUrl: null,
  }
}

function inCatalogResult(productId: string, name: string): ScanResolvedVerdictResult {
  return {
    kind: "in_catalog",
    verdict: "ideal",
    verdictLabel: "Passt",
    verdictTitle: "Passt zu deinem Haar",
    status: "ok",
    subtitle: "3 von 3 Zielbereichen getroffen",
    evaluatedRole: null,
    evaluatedRoleLabel: null,
    dimensions: [],
    criteria: [],
    coverage: { matches: 3, total: 3 },
    fitNarrative: null,
    alternatives: [],
    product: productHeader(productId, name),
    snapshotSource: "refined",
    savedState: NOT_SAVED,
  }
}

export const RESULT_A = inCatalogResult(PRODUCT_A_ID, "Lab Shampoo Alpha")
export const RESULT_B = inCatalogResult(PRODUCT_B_ID, "Lab Shampoo Beta")

export const UNKNOWN_RESULT: ScanUnknownProductResult = {
  kind: "unknown_product",
  identifier: { type: "ean", value: EAN_UNKNOWN },
  categories: [
    { key: "shampoo", label: "Shampoo" },
    { key: "conditioner", label: "Conditioner" },
    { key: "mask", label: "Maske" },
  ],
}

export const PENDING_SUBMISSION = {
  kind: "pending_submission" as const,
  submissionId: "cccccccc-0000-4000-8000-000000000003",
  headline: "Wir schauen uns das Produkt an",
}

/** Which resolve payload a request body maps to. */
export function resolvePayloadFor(body: {
  identifier?: { value: string }
  productId?: string
}): ScanResolvedVerdictResult | ScanUnknownProductResult | null {
  const ean = body.identifier?.value
  if (ean === EAN_PRODUCT_A) return RESULT_A
  if (ean === EAN_PRODUCT_B) return RESULT_B
  if (ean === EAN_UNKNOWN) return UNKNOWN_RESULT
  if (body.productId === PRODUCT_A_ID) return RESULT_A
  if (body.productId === PRODUCT_B_ID) return RESULT_B
  return null
}
