import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  InitialNeedPlanSnapshot,
  PlanCategoryDecision,
  PlanProductRole,
} from "@/lib/personal-plan/types"
import type {
  Stage1ProductExamplePreview,
  Stage1ProductExamplePreviewResponse,
} from "@/lib/personal-plan/product-preview-contract"

import { CATEGORY_ROLE_POLICIES, stage1ExampleVerdictAllowed } from "./products/authorities"
import {
  loadStage3RecommendationCandidates,
  type Stage3RecommendationCandidateSelection,
} from "./products/authority/catalog-facts"
import type { Stage3CategoryProductFacts } from "./products/authority/contracts"
import { evaluateStage3Authority } from "./products/authority/evaluate"

const STAGE1_BONDBUILDER_EXAMPLE_PRODUCT_ID = "38dace91-0fba-49ee-a93f-ac36e488fe4b"

export type Stage1ProductExamplePreviewCandidateLoader = (
  input: Stage3RecommendationCandidateSelection,
) => Promise<Stage3CategoryProductFacts[]>

export async function computeStage1ProductExamplePreviews(input: {
  personalPlanId: string
  sourceNeedVersionId: string
  snapshot: InitialNeedPlanSnapshot
  loadCandidates: Stage1ProductExamplePreviewCandidateLoader
}): Promise<Stage1ProductExamplePreviewResponse> {
  const decisions = new Map(
    input.snapshot.decisions.map((decision) => [decision.category, decision]),
  )
  const previews = await Promise.all(
    input.snapshot.renderedOrder.map(async (category) => {
      try {
        const decision = decisions.get(category)
        if (!decision?.target || decision.target.category !== category) return null
        const role = firstAllowedRole(decision)
        if (!role) return null
        const candidates = await input.loadCandidates({
          category,
          hairThickness: input.snapshot.profile.hair.thickness,
          role,
          shampooTarget: decision.target.category === "shampoo" ? decision.target : null,
          conditionerTarget: decision.target.category === "conditioner" ? decision.target : null,
          completeCatalog: true,
        })
        const authorityInput = {
          category,
          authorityVersion: CATEGORY_ROLE_POLICIES[category].authorityVersion,
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
        if (evaluation.status !== "known") return null
        const selectedProductId =
          evaluation.recommendation?.productId ??
          (category === "bondbuilder" && evaluation.verdict === "ideal"
            ? STAGE1_BONDBUILDER_EXAMPLE_PRODUCT_ID
            : null)
        if (!selectedProductId) return null
        const selectedFromRecommendation =
          evaluation.recommendation?.productId === selectedProductId
        const selected = candidates.find((candidate) => candidate.productId === selectedProductId)
        const imageUrl = selected?.presentationImageUrl?.trim()
        if (!selected || !imageUrl) return null
        if (
          selectedFromRecommendation &&
          evaluation.recommendationFactFingerprint !== selected.factFingerprint
        ) {
          return null
        }
        // Some authorities use the first verdict to describe an uncovered portfolio slot.
        // Evaluate the recommendation itself before exposing its presentation data.
        const selectedEvaluation = evaluateStage3Authority({
          ...authorityInput,
          productFacts: selected as never,
        })
        if (
          selectedEvaluation.status !== "known" ||
          (selectedEvaluation.verdict !== "ideal" && selectedEvaluation.verdict !== "supportive") ||
          !stage1ExampleVerdictAllowed(decision, selectedEvaluation.verdict) ||
          (!selectedFromRecommendation && selectedEvaluation.verdict !== "ideal")
        ) {
          return null
        }
        return {
          category,
          role,
          productId: selected.productId,
          productName: selected.displayName,
          imageUrl,
          verdict: selectedEvaluation.verdict,
          authorityVersion: CATEGORY_ROLE_POLICIES[category].authorityVersion,
        } satisfies Stage1ProductExamplePreview
      } catch {
        return null
      }
    }),
  )
  const selectedPreviews = previews.filter(
    (preview) => preview !== null,
  ) as Stage1ProductExamplePreview[]
  return {
    schemaVersion: 1,
    personalPlanId: input.personalPlanId,
    sourceNeedVersionId: input.sourceNeedVersionId,
    sourceInputHash: input.snapshot.inputHash,
    previews: selectedPreviews,
  }
}

export function createSupabaseStage1ProductExamplePreviewCandidateLoader(
  client: SupabaseClient,
): Stage1ProductExamplePreviewCandidateLoader {
  return (input) => loadStage3RecommendationCandidates(client, input)
}

function firstAllowedRole(decision: PlanCategoryDecision): PlanProductRole | null {
  const allowed = CATEGORY_ROLE_POLICIES[decision.category].allowedRoles
  return decision.roles.find((role) => allowed.includes(role as never)) ?? null
}
