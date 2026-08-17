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
} from "@/lib/personal-plan/decision-presentation"
import { deriveStage2TriggerContext } from "@/lib/personal-plan/refinement/stage1-adapter"

import { NEED_CARD_FALLBACK_NOTE, type NeedCardViewModel } from "./need-card"
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
 * A category can plan more than one role, and each role buys its own product.
 * Every role beyond the one leading the category card therefore renders its own
 * card in the same pattern, directly after it — otherwise the extra products
 * would only ever appear as a bare name-and-price list on the fork screen,
 * which read as undisclosed extras.
 *
 * Role-level copy comes from the shared Routine label vocabulary: the payload's
 * `reasoning` is derived per category (see `decision-presentation.ts`), so it is
 * identical for every role and cannot make the role legible on its own. The
 * frequency line reuses the payload's `reasoning.frequency`, which is the
 * category cadence — no role-specific cadence copy exists today.
 */
function secondaryRoleCard(
  card: NeedCardViewModel,
  preview: Stage1ProductExampleRecommendation,
): NeedCardViewModel {
  const rolePill = ROLE_PILLS[preview.role]
  return {
    ...withRecommendation(card, preview),
    id: `${preview.category}:${preview.role}`,
    targetType: routinePurposeLabel(preview.role),
    purpose: routineRolePurposeDescription(preview.role) ?? card.purpose,
    pills: rolePill ? [rolePill] : [],
    frequency: preview.reasoning.frequency,
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
  const leadPreviews = stage1LeadRolePreviewByCategory(response.previews)
  const previewsByCategory = new Map<Stage1Category, Stage1ProductExampleRolePreview[]>()
  for (const preview of response.previews) {
    const entries = previewsByCategory.get(preview.category)
    if (entries) entries.push(preview)
    else previewsByCategory.set(preview.category, [preview])
  }

  const apply = (screen: NeedPlanScreenViewModel): NeedPlanScreenViewModel => ({
    ...screen,
    cards: screen.cards.flatMap((card): NeedCardViewModel[] => {
      // Always derived from the un-expanded plan (see `displayedPlan` in
      // plan-start-flow.tsx), so every card here is still a category card.
      const category = card.category
      const lead = leadPreviews.get(category)
      const leadCard: NeedCardViewModel =
        lead?.kind === "recommendation"
          ? withRecommendation(card, lead)
          : lead?.kind === "fallback"
            ? {
                ...card,
                imageUrl: null,
                imageAlt: `Noch kein Produktbild für ${card.categoryLabel}.`,
                product: null,
                fallbackNote: NEED_CARD_FALLBACK_NOTE,
              }
            : { ...card, imageUrl: null, product: null, fallbackNote: null }

      // Only roles that actually resolved to a buyable product become cards;
      // a secondary fallback has nothing to show and stays covered by the
      // category card's own post-refinement state.
      const secondaryCards = (previewsByCategory.get(category) ?? [])
        .filter(
          (preview): preview is Stage1ProductExampleRecommendation =>
            preview.kind === "recommendation" && preview.decisionKey !== lead?.decisionKey,
        )
        .map((preview) => secondaryRoleCard(card, preview))

      return [leadCard, ...secondaryCards]
    }),
  })
  return {
    ...plan,
    basis: apply(plan.basis),
    optional: plan.optional ? apply(plan.optional) : null,
  }
}
