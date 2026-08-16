import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  InitialNeedPlanSnapshot,
  PlanCategoryDecision,
  PlanProductRole,
} from "@/lib/personal-plan/types"
import type {
  Stage1ProductExampleCommerce,
  Stage1ProductExamplePreviewResponse,
  Stage1ProductExampleReasoning,
  Stage1ProductExampleRolePreview,
} from "@/lib/personal-plan/product-preview-contract"

import { frequencyLabel, presentationFor } from "./decision-presentation"
import { CATEGORY_ROLE_POLICIES, stage1ExampleVerdictAllowed } from "./products/authorities"
import {
  loadStage3RecommendationCandidates,
  type Stage3RecommendationCandidateSelection,
} from "./products/authority/catalog-facts"
import type { Stage3CategoryProductFacts } from "./products/authority/contracts"
import { evaluateStage3Authority } from "./products/authority/evaluate"
import { stage3DecisionKey, type PersonalPlanCategory } from "./products/contracts"
import { presentCatalogCommerce } from "./routine/commerce"

export type Stage1ProductExamplePreviewCandidateLoader = (
  input: Stage3RecommendationCandidateSelection,
) => Promise<Stage3CategoryProductFacts[]>

type RoleTask = {
  category: PersonalPlanCategory
  decision: PlanCategoryDecision
  role: PlanProductRole
}

export async function computeStage1ProductExamplePreviews(input: {
  personalPlanId: string
  sourceNeedVersionId: string
  snapshot: InitialNeedPlanSnapshot
  loadCandidates: Stage1ProductExamplePreviewCandidateLoader
}): Promise<Stage1ProductExamplePreviewResponse> {
  const decisions = new Map(
    input.snapshot.decisions.map((decision) => [decision.category, decision]),
  )
  const roleTasks: RoleTask[] = []
  for (const category of input.snapshot.renderedOrder) {
    const decision = decisions.get(category)
    if (!decision?.target || decision.target.category !== category) continue
    // Only categories that will actually render a Stage 1 card need a
    // preview; deferred/not-needed decisions never surface one.
    if (decision.needTier !== "basis" && decision.needTier !== "optional") continue
    if (decision.resolution === "deferred_until_post_plan_onboarding") continue
    const allowedRoles = CATEGORY_ROLE_POLICIES[category].allowedRoles
    for (const role of decision.roles) {
      if (allowedRoles.includes(role as never)) roleTasks.push({ category, decision, role })
    }
  }

  const previews = await Promise.all(roleTasks.map((task) => computeRolePreview(task, input)))
  return {
    schemaVersion: 2,
    personalPlanId: input.personalPlanId,
    sourceNeedVersionId: input.sourceNeedVersionId,
    sourceInputHash: input.snapshot.inputHash,
    previews,
  }
}

async function computeRolePreview(
  task: RoleTask,
  input: {
    sourceNeedVersionId: string
    snapshot: InitialNeedPlanSnapshot
    loadCandidates: Stage1ProductExamplePreviewCandidateLoader
  },
): Promise<Stage1ProductExampleRolePreview> {
  const { category, decision, role } = task
  const authorityVersion = CATEGORY_ROLE_POLICIES[category].authorityVersion
  const decisionKey = stage3DecisionKey(category, role, null)
  const fallback = (): Stage1ProductExampleRolePreview => ({
    kind: "fallback",
    category,
    role,
    decisionKey,
    authorityVersion,
    fallback: "post_refinement",
  })

  try {
    const candidates = await input.loadCandidates({
      category,
      hairThickness: input.snapshot.profile.hair.thickness,
      role,
      shampooTarget: decision.target?.category === "shampoo" ? decision.target : null,
      conditionerTarget: decision.target?.category === "conditioner" ? decision.target : null,
      completeCatalog: true,
    })
    const authorityInput = {
      category,
      authorityVersion,
      refinedVersionId: input.sourceNeedVersionId,
      refinedInputHash: input.snapshot.inputHash,
      subjectKey: `preview:${category}:${role}`,
      role,
      capturedProductId: null,
      subjectIdentity: null,
      categoryDecision: decision as never,
      coverage: input.snapshot.coverage,
      hairThickness: input.snapshot.profile.hair.thickness,
      productFacts: null,
      recommendationCandidates: candidates as never,
      heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
    }
    const evaluation = evaluateStage3Authority(authorityInput)
    if (evaluation.status !== "known" || !evaluation.recommendation) return fallback()
    const selectedProductId = evaluation.recommendation.productId
    const selected = candidates.find((candidate) => candidate.productId === selectedProductId)
    const imageUrl = selected?.presentationImageUrl?.trim()
    if (!selected || !imageUrl) return fallback()
    if (evaluation.recommendationFactFingerprint !== selected.factFingerprint) return fallback()

    // Some authorities use the first verdict to describe an uncovered portfolio slot.
    // Evaluate the recommendation itself before exposing its presentation data.
    const selectedEvaluation = evaluateStage3Authority({
      ...authorityInput,
      productFacts: selected as never,
    })
    if (
      selectedEvaluation.status !== "known" ||
      (selectedEvaluation.verdict !== "ideal" && selectedEvaluation.verdict !== "supportive") ||
      !stage1ExampleVerdictAllowed(decision, selectedEvaluation.verdict)
    ) {
      return fallback()
    }

    const presentation = presentationFor(decision)
    if (!presentation) return fallback()
    const reasoning: Stage1ProductExampleReasoning = {
      productCriteria: presentation.productCriteria,
      fit: presentation.fit,
      frequency: frequencyLabel(decision.frequency, decision.executionState === "paused"),
    }
    const netContentValue = selected.netContentValue ?? null
    const netContentUnit = selected.netContentUnit ?? null
    const { availabilityLabel, affiliateDisclosure, priceLabel, productUrl } =
      presentCatalogCommerce({
        priceEur: selected.priceEur ?? null,
        affiliateLink: selected.affiliateLink ?? null,
        purchaseLinkStatus: selected.purchaseLinkStatus ?? null,
        updatedAt: selected.priceCheckedAt ?? null,
      })
    const commerce: Stage1ProductExampleCommerce = {
      priceEur: selected.priceEur ?? null,
      purchaseLinkStatus: selected.purchaseLinkStatus ?? null,
      netContentValue,
      netContentUnit,
      netContentLabel:
        netContentValue !== null && netContentUnit !== null
          ? `${new Intl.NumberFormat("de-DE").format(netContentValue)} ${netContentUnit}`
          : null,
      priceLabel,
      availabilityLabel,
      productUrl,
      affiliateDisclosure,
    }

    return {
      kind: "recommendation",
      category,
      role,
      decisionKey,
      productId: selected.productId,
      productName: selected.displayName,
      imageUrl,
      verdict: selectedEvaluation.verdict,
      authorityVersion,
      factFingerprint: evaluation.recommendationFactFingerprint ?? selected.factFingerprint,
      commerce,
      reasoning,
    }
  } catch {
    return fallback()
  }
}

export function createSupabaseStage1ProductExamplePreviewCandidateLoader(
  client: SupabaseClient,
): Stage1ProductExamplePreviewCandidateLoader {
  return (input) => loadStage3RecommendationCandidates(client, input)
}
