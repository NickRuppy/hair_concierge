import {
  TOOL_FAMILY_ORDER,
  type PlanToolPlan,
  type PlanToolRoute,
  type ToolAsset,
  type ToolPresentationState,
} from "./contracts"
import {
  TOOL_FAMILY_LABELS,
  TOOL_NEUTRAL_GROUP_LABELS,
  TOOL_NEUTRAL_GROUP_NOTES,
  TOOL_PRODUCT_TYPE_LABELS,
  toolAlternativeNote,
  toolImageAlt,
  toolImageSrc,
} from "./labels"

export type ToolCardTier = "basis" | "optional"

/**
 * One rendered Tool card. Deliberately carries no price, cadence, availability or
 * catalog-disclaimer field: a durable Tool must not borrow the exact
 * care-product card anatomy.
 */
export type ToolCardViewModel = {
  id: string
  tier: ToolCardTier
  familyLabel: string
  typeLabel: string
  purpose: string
  imageUrl: string
  imageAlt: string
  stateLabel: string
  state: ToolPresentationState
  /**
   * Either the technique note for a neutral-group family, or the "Alternative: …"
   * line for a family that legitimately leads with one form. Null when the asset
   * has only one eligible form.
   */
  noteDe: string | null
}

export type ToolBlockViewModel = {
  title: string
  lead: string
  cards: ToolCardViewModel[]
}

export const TOOL_BLOCK_TITLE = "Deine Tools"
export const TOOL_BLOCK_BASIS_LEAD =
  "Diese Tools gehören zu deiner Routine. Wir prüfen im Feinschliff, was du schon hast."
export const TOOL_BLOCK_OPTIONAL_LEAD = "Diese Tools können deine Ziele zusätzlich unterstützen."

export const TOOL_STATE_LABELS: Record<ToolPresentationState, string> = {
  use_yours: "Nutze deins",
  check_in_refinement: "Bestand im Feinschliff prüfen",
  catalog_gap: "Konkretes Produkt folgt",
  planned_generic: "Neu einplanen",
}

/**
 * Groups the Tool plan into the two tier-local Idealplan blocks.
 *
 * One physical asset renders once even when it serves several routes; its card
 * takes the strongest tier among those routes. Reported-only routes
 * (`not_needed`) never produce an Idealplan card — the user already owns them
 * and nothing is being recommended.
 */
export function buildStage1ToolBlocks(
  plan: PlanToolPlan,
  options: { hasOptionalPage: boolean },
): { basis: ToolBlockViewModel | null; optional: ToolBlockViewModel | null } {
  const routesByKey = new Map(plan.routes.map((route) => [route.routeKey, route]))
  const cards: ToolCardViewModel[] = []

  for (const asset of sortedAssets(plan.assets)) {
    const routes = asset.routeKeys
      .map((key) => routesByKey.get(key))
      .filter((route): route is PlanToolRoute => Boolean(route))
    const tier = strongestTier(routes)
    if (!tier) continue
    const neutralGroupLabel = TOOL_NEUTRAL_GROUP_LABELS[asset.family]
    // A neutral-group family names every eligible form together; nothing in the
    // profile ranks them, so leading with one would invent a recommendation.
    const isNeutralGroup = Boolean(neutralGroupLabel) && asset.productTypes.length > 1
    const alternatives = asset.productTypes.slice(1)

    cards.push({
      id: asset.assetKey,
      tier,
      familyLabel: TOOL_FAMILY_LABELS[asset.family],
      typeLabel: isNeutralGroup
        ? neutralGroupLabel!
        : TOOL_PRODUCT_TYPE_LABELS[asset.productTypes[0]],
      purpose: asset.purposeKey,
      imageUrl: toolImageSrc(asset.productTypes[0]),
      imageAlt: toolImageAlt(asset.productTypes[0]),
      stateLabel: TOOL_STATE_LABELS[asset.presentationState],
      state: asset.presentationState,
      noteDe: isNeutralGroup
        ? (TOOL_NEUTRAL_GROUP_NOTES[asset.family] ?? null)
        : toolAlternativeNote(alternatives),
    })
  }

  const basisCards = cards.filter((card) => card.tier === "basis")
  const optionalCards = cards.filter((card) => card.tier === "optional")
  // Without an Optional page there is nowhere tier-local to put optional Tools,
  // so they follow the basis block on the one page the user actually sees.
  const basis = options.hasOptionalPage ? basisCards : [...basisCards, ...optionalCards]
  const optional = options.hasOptionalPage ? optionalCards : []

  return {
    basis:
      basis.length > 0
        ? { title: TOOL_BLOCK_TITLE, lead: TOOL_BLOCK_BASIS_LEAD, cards: basis }
        : null,
    optional:
      optional.length > 0
        ? { title: TOOL_BLOCK_TITLE, lead: TOOL_BLOCK_OPTIONAL_LEAD, cards: optional }
        : null,
  }
}

function sortedAssets(assets: readonly ToolAsset[]): ToolAsset[] {
  return [...assets].sort(
    (left, right) =>
      TOOL_FAMILY_ORDER.indexOf(left.family) - TOOL_FAMILY_ORDER.indexOf(right.family) ||
      left.assetKey.localeCompare(right.assetKey),
  )
}

function strongestTier(routes: readonly PlanToolRoute[]): ToolCardTier | null {
  if (routes.some((route) => route.tier === "basis")) return "basis"
  if (routes.some((route) => route.tier === "optional")) return "optional"
  return null
}
