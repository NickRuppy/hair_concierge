import type { DiscoveryUsage, DiscoveryUsageRole } from "@/lib/discovery/classify"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"

/**
 * What the browser is allowed to know about a captured answer.
 *
 * Deliberately NOT `DiscoveryIntakeItem` from `@/lib/discovery/intake` (that
 * module is `server-only`): the client needs an id to delete by and enough text
 * to render the row, and nothing else. `product_id` / `product_submission_id`
 * stay server-side — the checklist never renders them, and the cockpit reads
 * them straight from the table.
 */
export type DiscoveryIntakeItemView = {
  id: string
  /**
   * Her USAGE — the category she uses it in (batch 5). `null` = „Weiß ich nicht".
   * Legacy (tile-model) rows always carry one.
   */
  category: PersonalPlanCategory | null
  source: "catalog_search" | "barcode" | "barcode_unknown" | "dm_search" | "name_research" | "none"
  brandText: string | null
  productNameText: string | null
  barcodeIdentifier: string | null
  /**
   * The linked catalog product's packshot, read at load time from `product_id`. Absent
   * for rows with no catalog product (unknown barcode, dm or typed-in research).
   */
  imageUrl?: string | null
  /** The linked catalog product's line, for the brand + line + name title. */
  productLine?: string | null
  /**
   * What the product IS (batch 5): absent when unknown („Weiß ich nicht") and on legacy
   * rows. Drives which usage question a pill tap re-asks (`discoveryUsageStepFor`).
   */
  productType?: PersonalPlanCategory
  /** The routine role of her usage — only on oil uses and scalp oil (R9). */
  usageRole?: DiscoveryUsageRole
}

/** The flat checklist's capture — identity only; the server opens research (batch 5, F1). */
export type DiscoveryIntakeProductCaptureInput =
  | {
      source: "catalog_search"
      productId: string
      brandText?: string | null
      productNameText: string
    }
  | {
      source: "barcode"
      productId: string
      barcodeIdentifier: string
      brandText?: string | null
      productNameText: string
    }
  | {
      source: "barcode_unknown"
      barcodeIdentifier: string
      brandText?: string | null
      productNameText?: string | null
    }
  | {
      source: "dm_search"
      barcodeIdentifier: string
      brandText?: string | null
      productNameText: string
    }
  | { source: "name_research"; brandText: string; productNameText: string }

/** `POST /api/beratung/intake/items` (flat checklist). */
export type DiscoveryIntakeProductBody = {
  capture: DiscoveryIntakeProductCaptureInput
  /** Ignored for catalog captures (the catalog's category is authoritative). `null` = „Weiß ich nicht". */
  productType?: PersonalPlanCategory | null
  /** `null` = usage unknown. Must be `null` while the product type is unknown. */
  usage: DiscoveryUsage | null
}

/** `PATCH /api/beratung/intake/items/<id>`. */
export type DiscoveryIntakeUsagePatchBody = {
  usage: DiscoveryUsage | null
  /** Only for an item whose type is still unknown — opens its research. */
  productType?: PersonalPlanCategory
}

/** The wire shape of one capture — the discriminated union the items route validates. */
export type DiscoveryIntakeCaptureInput =
  | {
      source: "catalog_search"
      productId: string
      brandText?: string | null
      productNameText: string
    }
  | {
      source: "barcode"
      productId: string
      barcodeIdentifier: string
      brandText?: string | null
      productNameText: string
    }
  | {
      source: "barcode_unknown"
      barcodeIdentifier: string
      productId?: string | null
      productSubmissionId?: string | null
      brandText?: string | null
      productNameText?: string | null
    }
  | {
      source: "dm_search"
      barcodeIdentifier: string
      productId?: string | null
      productSubmissionId?: string | null
      brandText?: string | null
      productNameText: string
    }
  | {
      source: "name_research"
      productId?: string | null
      productSubmissionId?: string | null
      brandText: string
      productNameText: string
    }
  | { source: "none" }
