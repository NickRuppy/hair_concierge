import type { PlanFrequencyTarget, Stage1Category } from "@/lib/personal-plan/types"

/**
 * Plain shared module (no `"use client"` pragma) for the need-card view-model
 * types and the `isNeedCardGroup` guard. `need-card.tsx` is a client
 * component module — importing a runtime value from it turns that import
 * into a client reference for any non-"use client" importer, which crashes
 * an RSC render that actually calls the function server-side. Server-
 * reachable modules (e.g. `snapshot-adapter.ts`) must import these
 * declarations from here directly, not via `need-card.tsx`.
 */

export type NeedCardTone = "basis" | "optional"

/** The concrete catalog pick that leads the card once previews are loaded. */
export type NeedCardProduct = {
  name: string
  priceLabel: string | null
  netContentLabel: string | null
  /** Null when availability is unknown — the line is omitted instead of guessing. */
  availabilityLabel: string | null
  /** Drives the availability line's tone: only "available" reads as green. */
  purchaseLinkStatus?: "available" | "unavailable" | null
  /** Only set when the purchase link is available and safe. */
  productUrl: string | null
}

/** Honest state for a category without a qualifying product recommendation. */
export const NEED_CARD_FALLBACK_NOTE = "Empfehlung folgt, wenn du deine Produkte ergänzt"

export type NeedCardViewModel = {
  /**
   * Unique per rendered card. It is the category for a category's leading card
   * and `<category>:<role>` for every further role of that category, which each
   * render their own card.
   */
  id: string
  /** The category the card belongs to — drives the accent styling. */
  category: Stage1Category
  tone: NeedCardTone
  categoryLabel: string
  statusLabel: "Basis" | "Optional" | "Pausiert"
  targetType: string
  purpose: string
  pills: string[]
  frequency: string
  imageUrl: string | null
  imageAlt?: string
  paused?: boolean
  product?: NeedCardProduct | null
  fallbackNote?: string | null
  detailBlocks: Array<{
    title: string
    body: string
  }>
  /**
   * This category's per-role need tiers, keyed by role — only set for
   * categories the engine tiers per role (oil today). Empty/absent for every
   * other category, which keeps its single aggregate `tone` for every role.
   */
  roleTones?: Record<string, NeedCardTone>
  /** The raw decision frequency, so per-role cadence copy can be derived later. */
  frequencyTarget?: PlanFrequencyTarget | null
}

/**
 * Same-tier, same-category role entries render as one group instead of a run
 * of visually identical sibling cards — `members` are the individual role
 * cards a category's preview expansion produced.
 */
export type NeedCardGroupViewModel = {
  kind: "group"
  id: string
  category: Stage1Category
  tone: NeedCardTone
  categoryLabel: string
  statusLabel: "Basis" | "Optional" | "Pausiert"
  members: NeedCardViewModel[]
}

export type PlanStartCardViewModel = NeedCardViewModel | NeedCardGroupViewModel

export function isNeedCardGroup(card: PlanStartCardViewModel): card is NeedCardGroupViewModel {
  return "members" in card && (card as NeedCardGroupViewModel).kind === "group"
}
