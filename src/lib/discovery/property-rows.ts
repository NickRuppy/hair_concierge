import type { MobileScanRow } from "@/lib/mobile/scan-contracts"

/**
 * Target-vs-product rows for the cockpit's comparison table, built from the iOS result
 * card's own rows (`mobileAssessmentRows` in `src/lib/mobile/result-presentation.ts`) so
 * the call reads a product the way the participant's app does: one row per property, the
 * product's value and her target value side by side (iOS `ComparisonTable`).
 *
 * Status follows the row's own `displayStatus` (category authority, never the product-wide
 * verdict): green is a match, amber a partial fit, red a miss, neutral unconfirmed.
 */

export type DiscoveryPropertyRowStatus = "match" | "partial" | "mismatch" | "unknown"

export type DiscoveryPropertyRow = {
  dimensionId: string
  label: string
  status: DiscoveryPropertyRowStatus
  state: MobileScanRow["state"]
  productValue: string | null
  targetValue: string | null
}

const STATUS: Record<MobileScanRow["displayStatus"], DiscoveryPropertyRowStatus> = {
  green: "match",
  amber: "partial",
  red: "mismatch",
  neutral: "unknown",
}

export function discoveryPropertyRows(rows: readonly MobileScanRow[]): DiscoveryPropertyRow[] {
  return rows.map((row) => ({
    dimensionId: row.dimensionId,
    label: row.label,
    status: STATUS[row.displayStatus],
    state: row.state,
    productValue: row.productValue,
    targetValue: row.targetValue,
  }))
}
