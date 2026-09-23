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
  category: PersonalPlanCategory
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
