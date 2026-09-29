import { parseDiscoveryPriceLabel } from "@/components/discovery/cockpit/swap-sort"

import type { DiscoveryCockpitStepView } from "../cockpit"
import type { DiscoveryCallDecision } from "../refined-routine"

/**
 * „Für den Plan festgehalten" (produktphase-lockin T1): the call's decisions compiled into
 * what she buys, keeps, stops using and deliberately goes without — the Phase-3 payoff Nick
 * reads out and copies as a shopping list.
 *
 * Pure and read-only, and no new decision mechanics: it reads the same per-entry decisions
 * the Entscheidung radios write (`discovery_call_decisions`). A decision unit is one entry of
 * a step — her product in it, or the empty step (batch 9: several of her products in one
 * step each carry their own decision) — exactly the unit `deriveBuckets` files.
 *
 * - swap with a target → „Neu kaufen", at the chosen product's `priceLabel`;
 * - keep of her product → „Behalten";
 * - drop of one of her products → „Weglassen", named: a recommendation to stop using it
 *   (the step keeps a sibling);
 * - keep of an empty step („Ohne Produkt weiter") → „Bewusst ohne Produkt" — only steps
 *   deliberately left without any product (a drop on an empty step, which the radios don't
 *   offer, lands here too: there is no product of hers to discard);
 * - anything else (undecided, or a swap without a target) → open.
 *
 * The price is display only (R19). The total sums the prices that parse
 * (`parseDiscoveryPriceLabel`) and flags `missingPrices` when any product to buy has none,
 * so the page can say „ab …" instead of pretending the sum is complete.
 */

export type RunsheetLockedInSelection = {
  decision: DiscoveryCallDecision["decision"]
  swapProductId: string | null
} | null

export type RunsheetLockedInBuyRow = {
  label: string
  categoryLabel: string
  priceLabel: string | null
}

export type RunsheetLockedInKeepRow = { label: string; categoryLabel: string }

/** A product of hers she stops using (decision drop). */
export type RunsheetLockedInDiscardRow = { label: string; categoryLabel: string }

/** A step deliberately left without any product. */
export type RunsheetLockedInSkipRow = { categoryLabel: string }

export type RunsheetLockedIn = {
  buy: RunsheetLockedInBuyRow[]
  keep: RunsheetLockedInKeepRow[]
  discard: RunsheetLockedInDiscardRow[]
  skip: RunsheetLockedInSkipRow[]
  /** The sum of the known prices, German („37,95 €"). */
  totalLabel: string
  /** At least one product to buy has no readable EUR price: the total is a lower bound. */
  missingPrices: boolean
  /** At least one buy price made it into the total — false while every price is unknown. */
  hasKnownPrice: boolean
  /** Decision units without a finished decision. */
  openCount: number
}

const UNKNOWN_PRODUCT = "Produkt ohne Namen"
const OWNED_FALLBACK = "Bisheriges Produkt"
const LIST_TITLE = "Einkaufsliste:"
const LIST_EMPTY = "Einkaufsliste: noch leer"

const EURO = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" })

/** The decision the server stored for an entry — the default when no live state is given. */
export function runsheetStoredSelection(step: DiscoveryCockpitStepView): RunsheetLockedInSelection {
  switch (step.outcome) {
    case "kept":
      return { decision: "keep", swapProductId: null }
    case "swapped":
      return { decision: "swap", swapProductId: step.swapProductId }
    case "dropped":
      return { decision: "drop", swapProductId: null }
    case "undecided":
    case "ideal":
      return null
  }
}

/**
 * @param selectionOf the live decision of one entry — the cockpit passes its optimistic
 *   selection state, so the section follows each click; defaults to the stored outcome.
 */
export function runsheetLockedIn(
  steps: readonly DiscoveryCockpitStepView[],
  selectionOf: (
    step: DiscoveryCockpitStepView,
  ) => RunsheetLockedInSelection = runsheetStoredSelection,
): RunsheetLockedIn {
  const lockedIn: RunsheetLockedIn = {
    buy: [],
    keep: [],
    discard: [],
    skip: [],
    totalLabel: "",
    missingPrices: false,
    hasKnownPrice: false,
    openCount: 0,
  }
  let totalCents = 0

  for (const step of steps) {
    const selection = selectionOf(step)
    const empty = step.intakeItemId === null
    if (selection?.decision === "swap" && selection.swapProductId) {
      const row = buyRow(step, selection.swapProductId)
      // EUR only (Codex F1): a label in another currency never enters the euro total.
      const price = row.priceLabel?.includes("€") ? parseDiscoveryPriceLabel(row.priceLabel) : null
      if (price === null) lockedIn.missingPrices = true
      else {
        totalCents += Math.round(price * 100)
        lockedIn.hasKnownPrice = true
      }
      lockedIn.buy.push(row)
    } else if (selection?.decision === "keep") {
      if (empty) lockedIn.skip.push({ categoryLabel: step.categoryLabel })
      else
        lockedIn.keep.push({
          label: step.ownedLabel ?? OWNED_FALLBACK,
          categoryLabel: step.categoryLabel,
        })
    } else if (selection?.decision === "drop") {
      if (empty) lockedIn.skip.push({ categoryLabel: step.categoryLabel })
      else
        lockedIn.discard.push({
          label: step.ownedLabel ?? OWNED_FALLBACK,
          categoryLabel: step.categoryLabel,
        })
    } else {
      lockedIn.openCount += 1
    }
  }

  lockedIn.totalLabel = EURO.format(totalCents / 100)
  return lockedIn
}

/** „Einkaufsliste:" and one line per product to buy — „Maske: Olaplex No. 8 — 28,00 €". */
export function runsheetShoppingListText(lockedIn: Pick<RunsheetLockedIn, "buy">): string {
  if (lockedIn.buy.length === 0) return LIST_EMPTY
  return [
    LIST_TITLE,
    ...lockedIn.buy.map((row) =>
      row.priceLabel
        ? `${row.categoryLabel}: ${row.label} — ${row.priceLabel}`
        : `${row.categoryLabel}: ${row.label}`,
    ),
  ].join("\n")
}

function buyRow(step: DiscoveryCockpitStepView, productId: string): RunsheetLockedInBuyRow {
  const option =
    step.swapOptions.find((candidate) => candidate.productId === productId) ??
    (step.idealRecommendation?.productId === productId ? step.idealRecommendation : null)
  const storedLabel = step.swapProductId === productId ? step.swapProductLabel : null
  return {
    label: option?.label ?? storedLabel ?? UNKNOWN_PRODUCT,
    categoryLabel: step.categoryLabel,
    priceLabel: option?.priceLabel ?? null,
  }
}
