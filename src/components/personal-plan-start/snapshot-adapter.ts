import type {
  InitialNeedPlanSnapshot,
  InitialProductPreview,
  PlanCategoryDecision,
  PlanProductRole,
  Stage1Category,
} from "@/lib/personal-plan/types"
import type {
  Stage1ProductExamplePreviewResponse,
  Stage1ProductExampleRecommendation,
} from "@/lib/personal-plan/product-preview-contract"
import {
  CATEGORY_LABELS,
  DETAIL_TITLE_FIT,
  DETAIL_TITLE_FREQUENCY,
  DETAIL_TITLE_PRODUCT,
  frequencyLabel,
  isStage1Category,
  presentationFor,
} from "@/lib/personal-plan/decision-presentation"
import { CATEGORY_ROLE_POLICIES } from "@/lib/personal-plan/products/authorities"

import type { NeedCardViewModel } from "./need-card"
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

  return {
    id: decision.category,
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
    detailBlocks: [
      { title: DETAIL_TITLE_PRODUCT, body: presentation.productCriteria },
      { title: DETAIL_TITLE_FIT, body: presentation.fit },
      { title: DETAIL_TITLE_FREQUENCY, body: cadence },
    ],
  }
}

function screenFor(
  kind: "basis" | "optional",
  cards: NeedCardViewModel[],
  hasOptionalPage: boolean,
): NeedPlanScreenViewModel {
  const countLabel =
    kind === "basis"
      ? `${cards.length} ${cards.length === 1 ? "Kategorie" : "Kategorien"}`
      : `${cards.length} ${cards.length === 1 ? "Vorschlag" : "Vorschläge"}`

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
    basis: screenFor("basis", visibleBasisCards, hasOptionalPage),
    optional: hasOptionalPage ? screenFor("optional", visibleOptionalCards, hasOptionalPage) : null,
  }
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
  // The payload is now per-role; this legacy image-only rendering path still
  // shows a single image per category card, so pick the preview whose role
  // is the category's primary (first-allowed) role — same product a reader
  // would have seen under the old per-category payload.
  const previews = new Map<Stage1Category, Stage1ProductExampleRecommendation>()
  const roleRank = (role: PlanProductRole, category: Stage1Category) =>
    CATEGORY_ROLE_POLICIES[category].allowedRoles.indexOf(role as never)
  for (const preview of response.previews) {
    if (preview.kind !== "recommendation") continue
    const existing = previews.get(preview.category)
    if (
      !existing ||
      roleRank(preview.role, preview.category) < roleRank(existing.role, existing.category)
    ) {
      previews.set(preview.category, preview)
    }
  }
  const apply = (screen: NeedPlanScreenViewModel): NeedPlanScreenViewModel => ({
    ...screen,
    cards: screen.cards.map((card) => {
      const preview = previews.get(card.id as Stage1Category)
      return preview
        ? {
            ...card,
            imageUrl: preview.imageUrl,
            imageAlt: `Beispielprodukt ${preview.productName} für ${card.categoryLabel}; die finale Produktauswahl folgt später.`,
          }
        : { ...card, imageUrl: null }
    }),
  })
  return {
    ...plan,
    basis: apply(plan.basis),
    optional: plan.optional ? apply(plan.optional) : null,
  }
}
