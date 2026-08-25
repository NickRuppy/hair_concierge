import { nightFunctionalAlternative } from "./assets"
import {
  TOOL_FAMILY_ORDER,
  type PlanToolPlan,
  type PlanToolRoute,
  type ToolAsset,
  type ToolChoiceGroup,
  type ToolPresentationState,
  type ToolProductType,
} from "./contracts"
import {
  TOOL_CHOICE_GROUP_LABELS,
  TOOL_CHOICE_GROUP_NOTES,
  TOOL_FAMILY_LABELS,
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
 *
 * **One card per need (`D5`).** A `ToolChoiceGroup` is one need with several
 * eligible approaches, so its members share a single card: the fulfilling
 * member's own card when the group is fulfilled, and one neutral „Eine davon
 * reicht: …" card when it is not. Without this, the three `volume_set` members
 * rendered three basis cards for one need. The drying-textile group's rendering
 * is unchanged — it is simply no longer a family-keyed special case.
 */
export function buildStage1ToolBlocks(
  plan: PlanToolPlan,
  options: { hasOptionalPage: boolean },
): { basis: ToolBlockViewModel | null; optional: ToolBlockViewModel | null } {
  const routesByKey = new Map(plan.routes.map((route) => [route.routeKey, route]))
  const cards: ToolCardViewModel[] = []
  const assets = sortedAssets(plan.assets)
  const emittedGroups = new Set<string>()

  const assetCard = (asset: ToolAsset): ToolCardViewModel | null => {
    const routes = asset.routeKeys
      .map((key) => routesByKey.get(key))
      .filter((route): route is PlanToolRoute => Boolean(route))
    const tier = strongestTier(routes)
    if (!tier) return null
    return {
      id: asset.assetKey,
      tier,
      familyLabel: TOOL_FAMILY_LABELS[asset.family],
      typeLabel: TOOL_PRODUCT_TYPE_LABELS[asset.productTypes[0]],
      purpose: asset.purposeKey,
      imageUrl: toolImageSrc(asset.productTypes[0]),
      imageAlt: toolImageAlt(asset.productTypes[0]),
      stateLabel: TOOL_STATE_LABELS[asset.presentationState],
      state: asset.presentationState,
      noteDe: toolAlternativeNote(alternativesFor(asset, routes)),
    }
  }

  for (const asset of assets) {
    const group = groupOwning(plan, asset)
    if (!group) {
      const card = assetCard(asset)
      if (card) cards.push(card)
      continue
    }
    if (emittedGroups.has(group.groupKey)) continue
    emittedGroups.add(group.groupKey)
    const card = choiceGroupCard(plan, group, assets, assetCard)
    if (card) cards.push(card)
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

/**
 * The forms the „Alternative: …" line may name (`N03`, `H06`).
 *
 * Normally the eligible forms behind the lead. When a reported form filtered the
 * asset down to itself, Night Protection still promises exactly one genuinely
 * different alternative — derived from the route, because the asset cannot carry
 * a form that would break `D6`'s binding order (fixture 98).
 */
function alternativesFor(
  asset: ToolAsset,
  routes: readonly PlanToolRoute[],
): readonly ToolProductType[] {
  const behind = asset.productTypes.slice(1)
  if (behind.length > 0) return behind
  for (const route of routes) {
    const alternative = nightFunctionalAlternative(route, asset.productTypes[0])
    if (alternative) return [alternative]
  }
  return []
}

/**
 * The choice group an asset renders through, or null.
 *
 * An asset only belongs to a group when EVERY route it serves is a member of it.
 * One device can carry a group member and a need outside the group — the same
 * Air Multi-Styler dries and shapes — and that separate need keeps its own card.
 */
function groupOwning(plan: PlanToolPlan, asset: ToolAsset): ToolChoiceGroup | null {
  return (
    plan.choiceGroups.find((group) =>
      asset.routeKeys.every((key) => group.memberRouteKeys.includes(key)),
    ) ?? null
  )
}

/**
 * The single card a choice group renders (`D5`).
 *
 * The card represents the NEED, so its tier is always the group's tier — the
 * strongest member tier — never whichever member happens to supply the visuals
 * (`decision.md` D5: "a group with one `basis` member is a `basis` group").
 *
 * Fulfilled: the fulfilling member's own card, ownership state and all. When
 * the fulfilling member is a reported-use route that renders no card of its own
 * (`not_needed` — the user already owns it), the group instead shows the
 * strongest remaining member as the ONE optional alternative `H06` promises,
 * at that member's own tier. Not fulfilled: one neutral card naming the
 * eligible approaches together, with no ownership claim at all — a
 * „Nutze deins" here would say the need is met while the group says it is not.
 */
function choiceGroupCard(
  plan: PlanToolPlan,
  group: ToolChoiceGroup,
  assets: readonly ToolAsset[],
  assetCard: (asset: ToolAsset) => ToolCardViewModel | null,
): ToolCardViewModel | null {
  // Members in the group's own reading order, so which member represents the
  // group never depends on how the asset list happened to sort.
  const memberAssets = group.memberRouteKeys
    .map((key) => assets.find((asset) => asset.routeKeys.includes(key)))
    .filter((asset): asset is ToolAsset => asset !== undefined)
  const groupTier: ToolCardTier | null =
    group.tier === "basis" ? "basis" : group.tier === "optional" ? "optional" : null
  if (group.fulfilledBy !== null) {
    const lead = memberAssets.find((asset) => asset.routeKeys.includes(group.fulfilledBy!))
    // A mixed asset already rendered its own card above; it is not repeated.
    if (!lead || groupOwning(plan, lead) === null) return null
    const card = assetCard(lead)
    if (card) return { ...card, tier: groupTier ?? card.tier }
    // H06: the fulfilling member is reported-use only and shows no card; the
    // strongest remaining member stays visible as the one optional alternative.
    for (const peer of memberAssets) {
      if (peer === lead) continue
      const peerCard = assetCard(peer)
      if (peerCard) return peerCard
    }
    return null
  }
  if (groupTier === null) return null
  // The visuals come from a member that actually carries the group's tier, so a
  // `basis` group never borrows an optional member's image and family.
  const representative =
    memberAssets.find((asset) => assetCard(asset)?.tier === groupTier) ?? memberAssets[0]
  if (!representative) return null
  const base = assetCard(representative)
  if (!base) return null
  const representativeRoute = plan.routes.find(
    (route) =>
      representative.routeKeys.includes(route.routeKey) &&
      group.memberRouteKeys.includes(route.routeKey),
  )
  return {
    ...base,
    id: group.groupKey,
    tier: groupTier,
    typeLabel: TOOL_CHOICE_GROUP_LABELS[group.target],
    // The need is the group's, not the representative member's.
    purpose: representativeRoute?.purposeKey ?? base.purpose,
    state: NEUTRAL_GROUP_STATE[base.state],
    stateLabel: TOOL_STATE_LABELS[NEUTRAL_GROUP_STATE[base.state]],
    noteDe: TOOL_CHOICE_GROUP_NOTES[group.target] ?? null,
  }
}

/**
 * „Nutze deins" is an ownership claim about the need, so an unfulfilled group
 * cannot make it — the honest neutral is „Bestand im Feinschliff prüfen". Every
 * other state already claims nothing and is kept.
 */
const NEUTRAL_GROUP_STATE: Record<ToolPresentationState, ToolPresentationState> = {
  use_yours: "check_in_refinement",
  check_in_refinement: "check_in_refinement",
  catalog_gap: "catalog_gap",
  planned_generic: "planned_generic",
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
