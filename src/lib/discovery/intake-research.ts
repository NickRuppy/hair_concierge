import "server-only"

import {
  loadDiscoveryCatalogProductType,
  type DiscoveryAdminClient,
  type DiscoveryIntakeCategory,
  type DiscoveryIntakeItemInsert,
} from "./intake"
import { createDiscoveryResearchSubmission } from "./research"
import { discoveryResearchSubmissionInput } from "./research-status"

/**
 * The participant side's research opening (batch 5, F1): a product that is not in the
 * catalog gets its research submission from its PRODUCT TYPE, on the write that carries her
 * usage answer (the flat checklist's add, or the PATCH that answers „Was ist das?").
 */

export type DiscoveryIntakeResearchOutcome = {
  productId: string | null
  productSubmissionId: string | null
  productType: DiscoveryIntakeCategory
}

/**
 * Opens research for a product that is not in the catalog, from its PRODUCT TYPE (F1) —
 * shared by the add and the usage PATCH. Never throws: a failed open answers with no
 * identity, and the item is stored without a submission („Recherche starten" retries).
 * When the scan lane finds the product in the catalog after all, the catalog's category
 * becomes the product type (P2-6).
 */
export async function openDiscoveryIntakeResearch(
  input: {
    userId: string
    productType: DiscoveryIntakeCategory
    identity: {
      source: DiscoveryIntakeItemInsert["source"]
      brand_text: string | null
      product_name_text: string | null
      barcode_identifier: string | null
    }
  },
  admin: DiscoveryAdminClient,
  deps: DiscoveryIntakeResearchDependencies,
): Promise<DiscoveryIntakeResearchOutcome> {
  const none = { productId: null, productSubmissionId: null, productType: input.productType }
  // The cockpit's own lane choice (valid EAN, else brand AND name), so a submission opened
  // here is the one „Recherche starten" would have opened.
  const submission = discoveryResearchSubmissionInput({
    id: "",
    category: input.productType,
    productType: input.productType,
    source: input.identity.source,
    brandText: input.identity.brand_text,
    productNameText: input.identity.product_name_text,
    barcodeIdentifier: input.identity.barcode_identifier,
    productId: null,
    productSubmissionId: null,
  })
  if (!submission) return none
  try {
    const created = await deps.createResearchSubmission(
      admin as unknown as Parameters<typeof createDiscoveryResearchSubmission>[0],
      { userId: input.userId, submission },
    )
    if (created.kind === "pending_submission") {
      return { ...none, productSubmissionId: created.submissionId }
    }
    let productType = input.productType
    try {
      productType = (await deps.loadCatalogProductType(admin, created.productId)) ?? productType
    } catch (error) {
      console.error("[discovery] catalog type read after research match failed:", error)
    }
    return { productId: created.productId, productSubmissionId: null, productType }
  } catch (error) {
    console.error("[discovery] research submission at capture failed:", error)
    return none
  }
}

export type DiscoveryIntakeResearchDependencies = {
  createResearchSubmission: typeof createDiscoveryResearchSubmission
  loadCatalogProductType: typeof loadDiscoveryCatalogProductType
}

export const DISCOVERY_INTAKE_RESEARCH_DEPENDENCIES: DiscoveryIntakeResearchDependencies = {
  createResearchSubmission: createDiscoveryResearchSubmission,
  loadCatalogProductType: loadDiscoveryCatalogProductType,
}
