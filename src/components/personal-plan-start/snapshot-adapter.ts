import type {
  InitialNeedPlanSnapshot,
  InitialProductPreview,
  PlanCategoryDecision,
  PlanProductRole,
  Stage1Category,
} from "@/lib/personal-plan/types"
import {
  stage1LeadRolePreviewByCategory,
  type Stage1ProductExamplePreviewResponse,
  type Stage1ProductExampleRecommendation,
  type Stage1ProductExampleRolePreview,
} from "@/lib/personal-plan/product-preview-contract"
import { CATEGORY_ROLE_POLICIES } from "@/lib/personal-plan/products/authorities"
import {
  routinePurposeLabel,
  routineRolePurposeDescription,
} from "@/lib/personal-plan/routine/labels"
import {
  CATEGORY_LABELS,
  DETAIL_TITLE_FIT,
  DETAIL_TITLE_FREQUENCY,
  DETAIL_TITLE_PRODUCT,
  frequencyLabel,
  isStage1Category,
  presentationFor,
  roleFrequencyLabel,
} from "@/lib/personal-plan/decision-presentation"
import { deriveStage2TriggerContext } from "@/lib/personal-plan/refinement/stage1-adapter"
import { buildToolPlan } from "@/lib/personal-plan/tools/assets"
import { EMPTY_TOOL_CARE_FACTS } from "@/lib/personal-plan/tools/facts"
import { buildStage1ToolBlocks } from "@/lib/personal-plan/tools/presentation"
import {
  computeToolRoutes,
  toolProfileFactsFromPlanProfile,
} from "@/lib/personal-plan/tools/routes"

import {
  isNeedCardGroup,
  NEED_CARD_FALLBACK_NOTE,
  type NeedCardGroupViewModel,
  type NeedCardTone,
  type NeedCardViewModel,
  type PlanStartCardViewModel,
} from "./plan-start-cards"
import type { NeedPlanScreenViewModel } from "./need-plan-screen"
import type { ToolBlockViewModel } from "@/lib/personal-plan/tools/presentation"
import type { PlanStartReadyViewModel } from "./plan-start-flow"

const ROLE_PILLS: Partial<Record<PlanProductRole, string>> = {
  shampoo_everyday: "sanft",
  shampoo_dandruff: "Kopfhaut",
  conditioner_rinse_out: "leichte Pflege",
  post_wash_leave_in: "Schutz & Glättung",
  pre_heat_application: "vor Hitze",
  intensive_conditioning_mask: "intensiv",
  pre_wash_fibre_treatment: "Vorwäsche",
  leave_on_fibre_conditioning: "Längenpflege",
  dry_finish: "Finish & Glanz",
  residue_reset: "Reset",
  mineral_reset: "Mineral-Reset",
  root_refresh_bridge: "Ansatz auffrischen",
  pre_heat_protection: "Hitzeschutz",
  specialized_bond_treatment: "Strukturpflege",
  scalp_comfort: "Kopfhautkomfort",
  scalp_flake_oil_adjunct: "Schuppen & Öl",
  density_claim_tonic: "begrenzte Evidenz",
  scalp_exfoliant: "Kopfhaut-Reset",
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function isInitialProductPreview(value: unknown): value is InitialProductPreview {
  if (!isRecord(value) || !isStage1Category(value.category)) return false
  if (value.state === "absent") return typeof value.reason === "string"
  return (
    value.state === "selected" && typeof value.imageUrl === "string" && value.imageUrl.length > 0
  )
}

function cardFromDecision(decision: PlanCategoryDecision): NeedCardViewModel | null {
  if (decision.needTier !== "basis" && decision.needTier !== "optional") return null
  if (decision.resolution === "deferred_until_post_plan_onboarding") return null
  if (!decision.target || decision.target.category !== decision.category) return null

  const presentation = presentationFor(decision)
  if (!presentation) return null

  const cadence = frequencyLabel(decision.frequency, decision.executionState === "paused")
  if (!cadence) return null

  const pills = decision.roles
    .map((role) => ROLE_PILLS[role])
    .filter((pill): pill is string => Boolean(pill))

  // Only oil resolves per-role tiers today (`roleTargets[].tier`); every other
  // category's target either has no `roleTargets` at all or a `roleTargets`
  // shape without a `tier` (scalp_care), and stays `{}` here — its roles all
  // share the category's aggregate `tone` further down the pipeline.
  const roleTones: Record<string, NeedCardTone> = {}
  if (decision.target && "roleTargets" in decision.target) {
    for (const roleTarget of decision.target.roleTargets) {
      if ("tier" in roleTarget && roleTarget.tier) {
        roleTones[roleTarget.role] = roleTarget.tier === "basis" ? "basis" : "optional"
      }
    }
  }

  return {
    id: decision.category,
    category: decision.category,
    tone: decision.needTier,
    categoryLabel: CATEGORY_LABELS[decision.category],
    statusLabel:
      decision.executionState === "paused"
        ? "Pausiert"
        : decision.needTier === "basis"
          ? "Basis"
          : "Optional",
    targetType: presentation.targetType,
    purpose: presentation.purpose,
    pills: [...new Set(pills)].slice(0, 2),
    frequency: cadence,
    imageUrl: null,
    imageAlt: `Beispielbild für ${CATEGORY_LABELS[decision.category]}; kein ausgewähltes Produkt.`,
    paused: decision.executionState === "paused",
    roleTones,
    frequencyTarget: decision.frequency,
    detailBlocks: [
      { title: DETAIL_TITLE_PRODUCT, body: presentation.productCriteria },
      { title: DETAIL_TITLE_FIT, body: presentation.fit },
      { title: DETAIL_TITLE_FREQUENCY, body: cadence },
    ],
  }
}

/**
 * Basis counts distinct categories, Optional counts the suggestions on the
 * page. Both labels are recomputed once the per-role expansion has settled
 * final placement — a category can now leave the screen it started on
 * entirely (e.g. its basis-tier role falls back while its optional-tier role
 * recommends, relocating the whole category), so neither count is safe to
 * carry over from the adapt-time screen unchanged.
 */
function countLabelFor(kind: "basis" | "optional", count: number): string {
  return kind === "basis"
    ? `${count} ${count === 1 ? "Kategorie" : "Kategorien"}`
    : `${count} ${count === 1 ? "Vorschlag" : "Vorschläge"}`
}

/** A group counts as its member entries, not as one card. */
function entryCount(cards: PlanStartCardViewModel[]): number {
  return cards.reduce((total, card) => total + (isNeedCardGroup(card) ? card.members.length : 1), 0)
}

function screenFor(
  kind: "basis" | "optional",
  cards: PlanStartCardViewModel[],
  hasOptionalPage: boolean,
  toolBlock: ToolBlockViewModel | null = null,
): NeedPlanScreenViewModel {
  const countLabel = countLabelFor(kind, entryCount(cards))

  return {
    kind,
    overline: kind === "basis" ? "Dein persönlicher Plan" : "Optionale Empfehlungen",
    title: kind === "basis" ? "Deine Basis" : "Zusätzlich sinnvoll",
    lead:
      kind === "basis"
        ? "Basierend auf deiner Haaranalyse sind das die Grundlagen für deine Routine."
        : "Basierend auf deiner Haaranalyse können diese Ergänzungen deine Ziele zusätzlich unterstützen.",
    sectionTitle: kind === "basis" ? "Von uns klar empfohlen" : "Für deine Ziele",
    countLabel,
    progress: kind === "basis" && hasOptionalPage ? 50 : 100,
    cards,
    // Tool-only properties are absent while the rollout is off, so the off view
    // model is shape-identical to the released one rather than merely looking
    // the same.
    ...(toolBlock ? { toolBlock } : {}),
  }
}

function asInitialNeedPlanSnapshot(value: unknown): InitialNeedPlanSnapshot | null {
  if (!isRecord(value)) return null
  if (value.schemaVersion !== 1 || value.snapshotKind !== "initial_need") return null
  if (!Array.isArray(value.decisions) || !Array.isArray(value.renderedOrder)) return null
  if (!Array.isArray(value.productPreviews)) return null
  if (!value.renderedOrder.every(isStage1Category)) return null
  if (!value.productPreviews.every(isInitialProductPreview)) return null
  if (
    !value.decisions.every(
      (decision) =>
        isRecord(decision) &&
        isStage1Category(decision.category) &&
        (decision.needTier === "basis" ||
          decision.needTier === "optional" ||
          decision.needTier === "not_needed" ||
          decision.needTier === null) &&
        (decision.executionState === "available" || decision.executionState === "paused"),
    )
  ) {
    return null
  }
  return value as InitialNeedPlanSnapshot
}

/**
 * Hair Tools is a parallel plan domain behind its own server-owned rollout. The
 * flag defaults to `false` so an unwired caller renders the exact current
 * ten-category Idealplan.
 */
export type PlanStartAdapterOptions = { toolsEnabled?: boolean }

export function adaptInitialNeedSnapshotToPlanStartViewModel(
  value: unknown,
  options: PlanStartAdapterOptions = {},
): PlanStartReadyViewModel | null {
  const snapshot = asInitialNeedPlanSnapshot(value)
  if (!snapshot) return null

  let cards: Array<NeedCardViewModel | null>
  try {
    cards = snapshot.renderedOrder.map((category) => {
      const decision = snapshot.decisions.find((candidate) => candidate.category === category)
      if (!decision) return null
      return cardFromDecision(decision)
    })
  } catch {
    return null
  }
  if (cards.some((card) => card === null)) return null

  const basisCards = cards.filter((card): card is NeedCardViewModel => card?.tone === "basis")
  const optionalCards = cards.filter((card): card is NeedCardViewModel => card?.tone === "optional")
  if (basisCards.length === 0) return null

  const pausedOnlyOptional = optionalCards.length > 0 && optionalCards.every((card) => card.paused)
  const visibleBasisCards = pausedOnlyOptional ? [...basisCards, ...optionalCards] : basisCards
  const visibleOptionalCards = pausedOnlyOptional ? [] : optionalCards
  const hasOptionalPage = visibleOptionalCards.length > 0
  const toolBlocks = stage1ToolBlocks(snapshot, {
    toolsEnabled: options.toolsEnabled === true,
    hasOptionalPage,
  })
  return {
    sourceInputHash: snapshot.inputHash,
    // The fork screen has to name the Stage-2 defaults direct acceptance would
    // apply before the user accepts, and it must not load Stage 2 to do it.
    // This is the very context the persisted Stage-2 draft derives from the
    // same initial snapshot, so both paths describe one truth.
    stage2TriggerContext: deriveStage2TriggerContext(snapshot),
    ...(options.toolsEnabled === true
      ? {
          toolsEnabled: true as const,
          toolContext: {
            profile: toolProfileFactsFromPlanProfile(snapshot.profile),
            scalpApplicationJob: hasSectionedScalpApplication(snapshot),
          },
        }
      : {}),
    basis: screenFor("basis", visibleBasisCards, hasOptionalPage, toolBlocks.basis),
    optional: hasOptionalPage
      ? screenFor("optional", visibleOptionalCards, hasOptionalPage, toolBlocks.optional)
      : null,
  }
}

/**
 * Stage 1 reads only what the initial quiz can prove. Drying, heat, towel and
 * Night-Protection answers belong to Feinschliff, so their routes stay absent
 * here rather than being guessed.
 */
function stage1ToolBlocks(
  snapshot: InitialNeedPlanSnapshot,
  options: { toolsEnabled: boolean; hasOptionalPage: boolean },
): { basis: ToolBlockViewModel | null; optional: ToolBlockViewModel | null } {
  if (!options.toolsEnabled) return { basis: null, optional: null }
  try {
    const routes = computeToolRoutes({
      profile: toolProfileFactsFromPlanProfile(snapshot.profile),
      care: EMPTY_TOOL_CARE_FACTS,
      inventory: {},
      scalpApplicationJob: hasSectionedScalpApplication(snapshot),
    })
    return buildStage1ToolBlocks(buildToolPlan({ routes, inventory: {} }), {
      hasOptionalPage: options.hasOptionalPage,
    })
  } catch {
    // A Tool projection failure must never take down the released Idealplan.
    return { basis: null, optional: null }
  }
}

/** Only a real applied scalp role creates a controlled-placement job. */
function hasSectionedScalpApplication(snapshot: InitialNeedPlanSnapshot): boolean {
  const scalpCare = snapshot.decisions.find((decision) => decision.category === "scalp_care")
  if (!scalpCare || scalpCare.needTier === "not_needed" || scalpCare.needTier === null) return false
  return scalpCare.roles.some(
    (role) =>
      role === "scalp_comfort" || role === "scalp_exfoliant" || role === "density_claim_tonic",
  )
}

function withRecommendation(
  card: NeedCardViewModel,
  preview: Stage1ProductExampleRecommendation,
): NeedCardViewModel {
  return {
    ...card,
    imageUrl: preview.imageUrl,
    imageAlt: `Produktbild: ${preview.productName}`,
    product: {
      name: preview.productName,
      priceLabel: preview.commerce.priceLabel,
      netContentLabel: preview.commerce.netContentLabel,
      availabilityLabel: preview.commerce.availabilityLabel,
      purchaseLinkStatus: preview.commerce.purchaseLinkStatus,
      productUrl: preview.commerce.productUrl,
    },
    fallbackNote: null,
    detailBlocks: [
      { title: DETAIL_TITLE_PRODUCT, body: preview.reasoning.productCriteria },
      { title: DETAIL_TITLE_FIT, body: preview.reasoning.fit },
      { title: DETAIL_TITLE_FREQUENCY, body: preview.reasoning.frequency },
    ],
  }
}

/**
 * A category card with no matching recommendation at all — every role fell
 * back, or the preview payload has nothing for this category yet. Stays the
 * un-expanded category card, on its original (aggregate-tier) screen; only
 * its product-facing fields change.
 */
function categoryOnlyCard(
  card: NeedCardViewModel,
  lead: Stage1ProductExampleRolePreview | undefined,
): NeedCardViewModel {
  if (lead?.kind === "fallback") {
    return {
      ...card,
      imageUrl: null,
      imageAlt: `Noch kein Produktbild für ${card.categoryLabel}.`,
      product: null,
      fallbackNote: NEED_CARD_FALLBACK_NOTE,
    }
  }
  return { ...card, imageUrl: null, product: null, fallbackNote: null }
}

/**
 * Basis-page placeholder for a category with per-role tiers (oil today)
 * whose basis-tone role(s) have no recommendation — fallback or simply no
 * preview at all — while an optional-tone role of the same category does
 * have one. Without this, the category's only entry is the optional one and
 * it relocates to Optional wholesale, silently dropping the basis-tone need
 * from the Basis page even though the recomputed count still names it. Stays
 * the un-expanded category card, same shape as `categoryOnlyCard`'s fallback
 * branch, with pills trimmed to the missing basis-tone role(s) and the
 * frequency scoped to that single role when there is exactly one — several
 * missing basis roles fall back to the category-level frequency instead of
 * picking one arbitrarily.
 */
function basisRolePlaceholderCard(
  card: NeedCardViewModel,
  missingBasisRoles: PlanProductRole[],
): NeedCardViewModel {
  const paused = card.paused ?? false
  const frequency =
    missingBasisRoles.length === 1
      ? roleFrequencyLabel(card.frequencyTarget ?? null, missingBasisRoles[0]!, paused)
      : card.frequency
  const pills = missingBasisRoles
    .map((role) => ROLE_PILLS[role])
    .filter((pill): pill is string => Boolean(pill))

  return {
    ...card,
    tone: "basis",
    statusLabel: paused ? "Pausiert" : "Basis",
    imageUrl: null,
    imageAlt: `Noch kein Produktbild für ${card.categoryLabel}.`,
    product: null,
    fallbackNote: NEED_CARD_FALLBACK_NOTE,
    pills: [...new Set(pills)].slice(0, 2),
    frequency,
    detailBlocks: [
      card.detailBlocks[0]!,
      card.detailBlocks[1]!,
      { title: DETAIL_TITLE_FREQUENCY, body: frequency },
    ],
  }
}

/**
 * One role's rendered entry for a category preview. Always carries this
 * role's own cadence (`roleFrequencyLabel` falls back to the category-level
 * label for every category that has no per-role cadence, so this is a no-op
 * change for those). Role-level copy — target type, purpose, single pill —
 * only replaces the category's own copy once the category renders more than
 * one role; a category that ends up with exactly one rendered role (whether
 * because it only ever had one, or because every other role fell back) keeps
 * wearing the category's presentation, unchanged.
 */
function roleEntry(
  card: NeedCardViewModel,
  preview: Stage1ProductExampleRecommendation,
  multiRole: boolean,
): NeedCardViewModel {
  const tone = card.roleTones?.[preview.role] ?? card.tone
  const paused = card.paused ?? false
  const frequency = roleFrequencyLabel(card.frequencyTarget ?? null, preview.role, paused)
  const base = withRecommendation(card, preview)
  const rolePill = ROLE_PILLS[preview.role]

  return {
    ...base,
    ...(multiRole
      ? {
          id: `${preview.category}:${preview.role}`,
          targetType: routinePurposeLabel(preview.role),
          purpose: routineRolePurposeDescription(preview.role) ?? card.purpose,
          pills: rolePill ? [rolePill] : [],
        }
      : {}),
    tone,
    statusLabel: paused ? "Pausiert" : tone === "basis" ? "Basis" : "Optional",
    frequency,
    detailBlocks: [
      base.detailBlocks[0]!,
      base.detailBlocks[1]!,
      { title: DETAIL_TITLE_FREQUENCY, body: frequency },
    ],
  }
}

/** This category's canonical role order, for stable multi-role entry/group ordering. */
function roleRank(category: Stage1Category, role: PlanProductRole): number {
  const index = CATEGORY_ROLE_POLICIES[category].allowedRoles.indexOf(role as never)
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

/**
 * The single placement rule for every entry `applyStage1ProductExamplePreviews`
 * produces, recommendation-backed or not: an explicit per-role tier
 * (`card.roleTones[role]`, oil today) always wins. Otherwise the entry stays
 * on the screen its category card already lives on (`originScreen`) — never
 * the category's own aggregate `tone`, which can be stale after the
 * paused-only-optional merge relocates a card without updating `tone`.
 * `role` is `null` for a category with no resolved recommendation at all,
 * which has no per-role tier to look up and so always falls through to
 * `originScreen`.
 */
function placementTone(
  card: NeedCardViewModel,
  role: PlanProductRole | null,
  originScreen: "basis" | "optional",
): NeedCardTone {
  const roleTone = role ? card.roleTones?.[role] : undefined
  return roleTone ?? originScreen
}

/**
 * Same-tier entries of one category collapse into a single group card; a lone
 * entry stays a standalone card. Preserves first-encounter category order
 * within the tone bucket.
 */
function groupByCategory(
  entries: NeedCardViewModel[],
  tone: NeedCardTone,
): PlanStartCardViewModel[] {
  const order: Stage1Category[] = []
  const byCategory = new Map<Stage1Category, NeedCardViewModel[]>()
  for (const entry of entries) {
    const bucket = byCategory.get(entry.category)
    if (bucket) bucket.push(entry)
    else {
      byCategory.set(entry.category, [entry])
      order.push(entry.category)
    }
  }
  return order.map((category): PlanStartCardViewModel => {
    const members = byCategory.get(category)!
    if (members.length === 1) return members[0]!
    const lead = members[0]!
    const group: NeedCardGroupViewModel = {
      kind: "group",
      id: `${category}:group:${tone}`,
      category,
      tone,
      categoryLabel: lead.categoryLabel,
      statusLabel: lead.statusLabel,
      members,
    }
    return group
  })
}

export function applyStage1ProductExamplePreviews(
  plan: PlanStartReadyViewModel,
  response: Stage1ProductExamplePreviewResponse,
): PlanStartReadyViewModel {
  if (
    !plan.personalPlanId ||
    plan.personalPlanId !== response.personalPlanId ||
    !plan.sourceInputHash ||
    plan.sourceInputHash !== response.sourceInputHash
  ) {
    return plan
  }
  const leadPreviews = stage1LeadRolePreviewByCategory(response.previews)
  const previewsByCategory = new Map<Stage1Category, Stage1ProductExampleRolePreview[]>()
  for (const preview of response.previews) {
    const entries = previewsByCategory.get(preview.category)
    if (entries) entries.push(preview)
    else previewsByCategory.set(preview.category, [preview])
  }

  // Every current category card, tagged with the screen it physically lives
  // on — always derived from the un-expanded plan (see `displayedPlan` in
  // plan-start-flow.tsx), so each one is still a plain category card, never a
  // group from an earlier application. The origin screen and the card's own
  // `tone` can disagree: `adaptInitialNeedSnapshotToPlanStartViewModel`'s
  // paused-only-optional merge physically moves a paused optional-tone card
  // onto Basis without changing its `tone`. One rule places every entry
  // (`placementTone` below): an explicit per-role tier always wins; every
  // other entry — including a category with no resolved role at all — stays
  // on the screen it already lives on, never re-bucketed by the category's
  // stale aggregate `tone`.
  const sourceCards: Array<{ card: NeedCardViewModel; originScreen: "basis" | "optional" }> = [
    ...(plan.basis.cards as NeedCardViewModel[]).map((card) => ({
      card,
      originScreen: "basis" as const,
    })),
    ...((plan.optional?.cards ?? []) as NeedCardViewModel[]).map((card) => ({
      card,
      originScreen: "optional" as const,
    })),
  ]

  const basisEntries: NeedCardViewModel[] = []
  const optionalEntries: NeedCardViewModel[] = []

  for (const { card, originScreen } of sourceCards) {
    const category = card.category
    const recommendations = (previewsByCategory.get(category) ?? [])
      .filter(
        (preview): preview is Stage1ProductExampleRecommendation =>
          preview.kind === "recommendation",
      )
      .sort((a, b) => roleRank(category, a.role) - roleRank(category, b.role))

    const basisTierRoles = (
      Object.entries(card.roleTones ?? {}) as Array<[PlanProductRole, NeedCardTone]>
    )
      .filter(([, tone]) => tone === "basis")
      .map(([role]) => role)
    let landedOnBasis = false

    if (recommendations.length === 0) {
      // No role resolved to a product — the category card is carried over
      // unchanged to the screen it already lives on (no role to look up a
      // per-role tier for, so `placementTone` falls straight through to
      // `originScreen`; see the paused-merge note above).
      const resultCard = categoryOnlyCard(card, leadPreviews.get(category))
      const tone = placementTone(card, null, originScreen)
      const bucket = tone === "basis" ? basisEntries : optionalEntries
      bucket.push(resultCard)
      landedOnBasis = tone === "basis"
    } else {
      const multiRole = recommendations.length > 1
      for (const preview of recommendations) {
        const entry = roleEntry(card, preview, multiRole)
        const tone = placementTone(card, preview.role, originScreen)
        const bucket = tone === "basis" ? basisEntries : optionalEntries
        bucket.push(entry)
        if (tone === "basis") landedOnBasis = true
      }
    }

    // Close the per-role placement gap: a category with basis-tone role(s)
    // that landed no card on Basis at all keeps one placeholder there — see
    // `basisRolePlaceholderCard`. Only fires once per category, and only
    // when the basis-tone role(s) genuinely have nothing (fallback or no
    // preview at all); a basis-tone role that already has a recommendation
    // means `landedOnBasis` is already true and this is skipped.
    if (!landedOnBasis && basisTierRoles.length > 0) {
      const missingBasisRoles = basisTierRoles.filter(
        (role) => !recommendations.some((preview) => preview.role === role),
      )
      if (missingBasisRoles.length > 0) {
        basisEntries.push(basisRolePlaceholderCard(card, missingBasisRoles))
      }
    }
  }

  const finalBasisCards = groupByCategory(basisEntries, "basis")
  const finalOptionalCards = groupByCategory(optionalEntries, "optional")
  // Optional-screen existence follows what actually ended up on it, not
  // whether it started non-null — an Optional page that redistributes down to
  // zero final cards must disappear (and Basis must reflect that), just like
  // a page that gains its first entries must appear.
  const hasOptionalNow = finalOptionalCards.length > 0

  const basis: NeedPlanScreenViewModel = {
    ...plan.basis,
    cards: finalBasisCards,
    countLabel: countLabelFor(
      "basis",
      new Set(finalBasisCards.map((resultCard) => resultCard.category)).size,
    ),
    progress: hasOptionalNow ? 50 : 100,
  }

  const optional: NeedPlanScreenViewModel | null = hasOptionalNow
    ? {
        ...(plan.optional ?? screenFor("optional", [], true)),
        cards: finalOptionalCards,
        countLabel: countLabelFor("optional", entryCount(finalOptionalCards)),
      }
    : null

  return { ...plan, basis, optional }
}
