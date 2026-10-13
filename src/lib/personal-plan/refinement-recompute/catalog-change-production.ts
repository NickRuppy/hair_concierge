import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { HeatActivationRoute } from "@/lib/heat-activation/contract"
import { stage3HeatRoutesFromSnapshot } from "@/lib/personal-plan/oil-heat-context"
import { CATEGORY_ROLE_POLICIES } from "@/lib/personal-plan/products/authorities"
import {
  loadScanProductFacts,
  loadStage3RecommendationCandidates,
} from "@/lib/personal-plan/products/authority/catalog-facts"
import type {
  Stage3AuthorityInput,
  Stage3CategoryProductFacts,
} from "@/lib/personal-plan/products/authority/contracts"
import { evaluateStage3Authority } from "@/lib/personal-plan/products/authority/evaluate"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { createSupabaseStage3RoutineAuthorityRepairService } from "@/lib/personal-plan/products/stage3-routine-authority-repair-service"
import { createSupabaseStage3ProductionPersistence } from "@/lib/personal-plan/products/stage3-persistence-supabase"
import type {
  InitialNeedPlanSnapshot,
  PlanCategoryDecision,
  PlanProductRole,
} from "@/lib/personal-plan/types"

import type { Stage3CatalogChangeDeps, Stage3CatalogFitProbe } from "./catalog-change"
import { createProductionStage3RecomputeDeps } from "./production-deps"

/**
 * Pre-apply simulation for a dry run only (e.g. S3 before its data batch is applied):
 * treat the product as heat-activated on this route. Never used by `--apply`.
 */
export type CatalogFitSimulation = { productId: string; heatActivationRoute: HeatActivationRoute }

function simulated(
  facts: Stage3CategoryProductFacts,
  simulation: CatalogFitSimulation | undefined,
): Stage3CategoryProductFacts {
  if (!simulation || facts.productId !== simulation.productId || facts.category !== "leave_in")
    return facts
  return {
    ...facts,
    spec: {
      ...facts.spec,
      roles: ["pre_heat_application"],
      heatActivation: { route: simulation.heatActivationRoute },
    },
  }
}

type FitContext = {
  snapshot: InitialNeedPlanSnapshot
  decision: PlanCategoryDecision
  selection: {
    hairThickness: string
    role: PlanProductRole
    shampooTarget: never | null
    conditionerTarget: never | null
  }
}

async function fitContext(
  admin: SupabaseClient,
  input: {
    userId: string
    personalPlanId: string
    refinedVersionId: string
    category: string
    role: PlanProductRole
  },
): Promise<FitContext | null> {
  const persistence = createSupabaseStage3ProductionPersistence(admin)
  const snapshot = await persistence.loadRefinedNeedSnapshot({
    userId: input.userId,
    personalPlanId: input.personalPlanId,
    refinedVersionId: input.refinedVersionId,
  })
  const decision = snapshot.decisions?.find((entry) => entry.category === input.category)
  if (!decision?.target) return null
  return {
    snapshot,
    decision,
    selection: {
      hairThickness: snapshot.profile.hair.thickness,
      role: input.role,
      shampooTarget: (decision.target.category === "shampoo" ? decision.target : null) as never,
      conditionerTarget: (decision.target.category === "conditioner"
        ? decision.target
        : null) as never,
    },
  }
}

function authorityInput(
  context: FitContext,
  category: PersonalPlanCategory,
  role: PlanProductRole,
  refinedVersionId: string,
  productFacts: Stage3CategoryProductFacts | null,
  recommendationCandidates: Stage3CategoryProductFacts[],
): Stage3AuthorityInput {
  return {
    category,
    authorityVersion: CATEGORY_ROLE_POLICIES[category].authorityVersion,
    refinedVersionId,
    refinedInputHash: context.snapshot.inputHash,
    subjectKey: `catalog-change:${category}:${role}`,
    role,
    capturedProductId: null,
    subjectIdentity: productFacts
      ? {
          kind: "catalog_product",
          productId: productFacts.productId,
          displayName: productFacts.displayName,
          category,
        }
      : null,
    categoryDecision: context.decision as never,
    coverage: context.snapshot.coverage,
    hairThickness: context.snapshot.profile.hair.thickness,
    heatRoutes: stage3HeatRoutesFromSnapshot(context.snapshot),
    productFacts: productFacts as never,
    recommendationCandidates: recommendationCandidates as never,
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
  }
}

export function createProductionCatalogFitProbe(
  admin: SupabaseClient,
  simulation?: CatalogFitSimulation,
): Stage3CatalogFitProbe & {
  /** Dry-run preview of the authority's next-best pick with the product's current (or simulated) facts. */
  previewNextBest(input: Parameters<Stage3CatalogFitProbe["plannedProductFit"]>[0]): Promise<{
    productId: string
    displayName: string
  } | null>
} {
  return {
    async plannedProductFit(input) {
      const { data: tombstone, error } = await admin
        .from("product_relationships")
        .select("id")
        .eq("source_product_id", input.productId)
        .eq("relationship_type", "replaced_by")
        .limit(1)
      if (error) return "unknown"
      if ((tombstone ?? []).length > 0) return "retired"
      const context = await fitContext(admin, input)
      if (!context) return "unknown"
      const category = input.category as PersonalPlanCategory
      const facts = await loadScanProductFacts(admin, category, input.productId, context.selection)
      if (!facts) return "unknown"
      const evaluation = evaluateStage3Authority(
        authorityInput(
          context,
          category,
          input.role,
          input.refinedVersionId,
          simulated(facts, simulation),
          [],
        ),
      )
      if (evaluation.status !== "known") return "unknown"
      return evaluation.verdict === "ideal" || evaluation.verdict === "supportive"
        ? "fits"
        : "no_longer_fits"
    },
    async previewNextBest(input) {
      const context = await fitContext(admin, input)
      if (!context) return null
      const category = input.category as PersonalPlanCategory
      const candidates = (
        await loadStage3RecommendationCandidates(admin, {
          category,
          ...context.selection,
          completeCatalog: true,
        })
      ).map((facts) => simulated(facts, simulation))
      const evaluation = evaluateStage3Authority(
        authorityInput(context, category, input.role, input.refinedVersionId, null, candidates),
      )
      if (evaluation.status !== "known" || !evaluation.recommendation) return null
      if (evaluation.recommendation.productId === input.productId) return null
      return {
        productId: evaluation.recommendation.productId,
        displayName: evaluation.recommendation.displayName,
      }
    },
  }
}

export function createProductionCatalogChangeDeps(input: {
  userId: string
  admin: SupabaseClient
}): Stage3CatalogChangeDeps {
  return {
    ...createProductionStage3RecomputeDeps(input),
    repairDraft: createSupabaseStage3RoutineAuthorityRepairService(input.admin),
    catalogFit: createProductionCatalogFitProbe(input.admin),
  }
}
