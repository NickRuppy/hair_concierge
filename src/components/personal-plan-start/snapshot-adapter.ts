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

import {
  isNeedCardGroup,
  NEED_CARD_FALLBACK_NOTE,
  type NeedCardGroupViewModel,
  type NeedCardTone,
  type NeedCardViewModel,
  type PlanStartCardViewModel,
} from "./need-card"
import type { NeedPlanScreenViewModel } from "./need-plan-screen"
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
 * Basis counts categories, Optional counts the suggestions on the page. Only
 * the Optional label therefore has to be recomputed once the per-role expansion
 * has added cards — "N Kategorien" stays literally true either way.
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

export function adaptInitialNeedSnapshotToPlanStartViewModel(
  value: unknown,
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
  return {
    sourceInputHash: snapshot.inputHash,
    // The fork screen has to name the Stage-2 defaults direct acceptance would
    // apply before the user accepts, and it must not load Stage 2 to do it.
    // This is the very context the persisted Stage-2 draft derives from the
    // same initial snapshot, so both paths describe one truth.
    stage2TriggerContext: deriveStage2TriggerContext(snapshot),
    basis: screenFor("basis", visibleBasisCards, hasOptionalPage),
    optional: hasOptionalPage ? screenFor("optional", visibleOptionalCards, hasOptionalPage) : null,
  }
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

  // Every current category card, Basis then Optional — always derived from
  // the un-expanded plan (see `displayedPlan` in plan-start-flow.tsx), so
  // each one is still a plain category card, never a group from an earlier
  // application. A category's roles can now split across both screens (a
  // per-role tier can disagree with the category's aggregate tier), so both
  // source lists are read together and re-partitioned below.
  const sourceCards: NeedCardViewModel[] = [
    ...(plan.basis.cards as NeedCardViewModel[]),
    ...((plan.optional?.cards ?? []) as NeedCardViewModel[]),
  ]

  const basisEntries: NeedCardViewModel[] = []
  const optionalEntries: NeedCardViewModel[] = []

  for (const card of sourceCards) {
    const category = card.category
    const recommendations = (previewsByCategory.get(category) ?? [])
      .filter(
        (preview): preview is Stage1ProductExampleRecommendation =>
          preview.kind === "recommendation",
      )
      .sort((a, b) => roleRank(category, a.role) - roleRank(category, b.role))

    if (recommendations.length === 0) {
      const resultCard = categoryOnlyCard(card, leadPreviews.get(category))
      const bucket = resultCard.tone === "basis" ? basisEntries : optionalEntries
      bucket.push(resultCard)
      continue
    }

    const multiRole = recommendations.length > 1
    for (const preview of recommendations) {
      const entry = roleEntry(card, preview, multiRole)
      const bucket = entry.tone === "basis" ? basisEntries : optionalEntries
      bucket.push(entry)
    }
  }

  const finalBasisCards = groupByCategory(basisEntries, "basis")
  const finalOptionalCards = groupByCategory(optionalEntries, "optional")
  const hasOptionalNow = Boolean(plan.optional) || finalOptionalCards.length > 0

  const basis: NeedPlanScreenViewModel = {
    ...plan.basis,
    cards: finalBasisCards,
    progress: hasOptionalNow ? 50 : plan.basis.progress,
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
