import { mobileRowDifferenceText } from "@/lib/mobile/result-presentation"
import type { MobileScanRow } from "@/lib/mobile/scan-contracts"

/**
 * Target-vs-product rows for the cockpit, built from the iOS result card's own rows
 * (`mobileAssessmentRows` in `src/lib/mobile/result-presentation.ts`) so the call reads a
 * product the way the participant's app does — one line per property, in the card's own
 * „<Eigenschaft>: <Produktwert> statt <Zielwert>" wording.
 *
 * Status follows the row's own `displayStatus` (category authority, never the product-wide
 * verdict): green is a match, amber a partial fit, red a miss, neutral unconfirmed.
 */

export type DiscoveryPropertyRowStatus = "match" | "partial" | "mismatch" | "unknown"

export type DiscoveryPropertyRow = {
  dimensionId: string
  status: DiscoveryPropertyRowStatus
  text: string
}

const STATUS: Record<MobileScanRow["displayStatus"], DiscoveryPropertyRowStatus> = {
  green: "match",
  amber: "partial",
  red: "mismatch",
  neutral: "unknown",
}

export function discoveryPropertyRows(rows: readonly MobileScanRow[]): DiscoveryPropertyRow[] {
  return rows.map((row) => {
    const status = STATUS[row.displayStatus]
    let text: string
    if (status === "partial" || status === "mismatch") {
      text = mobileRowDifferenceText(row)
    } else if (status === "match") {
      text = `${row.label}: ${row.productValue ?? row.targetValue ?? "passt"}`
    } else {
      const target =
        row.state !== "no_target" && row.targetValue ? ` (Ziel: ${row.targetValue})` : ""
      text = `${row.label}: ${row.productValue ?? "keine Angabe"}${target}`
    }
    return { dimensionId: row.dimensionId, status, text }
  })
}
