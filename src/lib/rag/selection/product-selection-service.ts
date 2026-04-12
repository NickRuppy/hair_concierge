import { createAdminClient } from "@/lib/supabase/admin"
import {
  matchProducts,
  matchShampooProducts,
  matchConditionerProducts,
  matchLeaveInProducts,
  matchOilProducts,
} from "@/lib/rag/product-matcher"
import type { MatchedProduct } from "@/lib/rag/product-matcher"
import {
  buildShampooDecision,
  annotateShampooRecommendations,
} from "@/lib/rag/category-engine/shampoo-wrapper"
import {
  buildConditionerDecision,
  rerankConditionerProducts,
} from "@/lib/rag/category-engine/conditioner-wrapper"
import {
  buildLeaveInDecision,
  rerankLeaveInProducts,
} from "@/lib/rag/category-engine/leave-in-wrapper"
import { buildOilDecision, annotateOilRecommendations } from "@/lib/rag/category-engine/oil-wrapper"
import {
  deriveMaskDecision,
  rerankMaskProducts,
  buildMaskConcernSearchOrder,
} from "@/lib/rag/category-engine/mask-wrapper"
import { applyProductMemoryConstraints } from "@/lib/rag/user-memory"
import type { CategoryDecisions } from "@/lib/rag/contracts"
import type { SelectionResult } from "@/lib/rag/selection/types"
import type {
  HairProfile,
  ProductCategory,
  ShampooDecision,
  ConditionerDecision,
  LeaveInDecision,
  OilDecision,
  MaskDecision,
} from "@/lib/types"
import type { UserMemoryContext } from "@/lib/rag/user-memory"
import type { ProductConditionerSpecs } from "@/lib/conditioner/constants"
import type { ProductLeaveInSpecs } from "@/lib/leave-in/constants"
import type { ProductMaskSpecs } from "@/lib/mask/constants"

// ── Per-category selection functions ─────────────────────────────────────────

async function selectShampoo(
  message: string,
  hairProfile: HairProfile | null,
  decision: ShampooDecision,
): Promise<SelectionResult> {
  if (!decision.eligible || !hairProfile?.thickness) {
    return { products: [], updatedDecisions: { shampoo: decision } }
  }
  if (!decision.matched_bucket) {
    return { products: [], updatedDecisions: { shampoo: decision } }
  }

  const shampooCandidates = await matchShampooProducts({
    query: message,
    thickness: hairProfile.thickness,
    shampooBucket: decision.matched_bucket,
    count: decision.secondary_bucket ? 2 : 3,
  })

  let secondaryCandidates: Awaited<ReturnType<typeof matchShampooProducts>> = []
  if (decision.secondary_bucket && decision.secondary_bucket !== decision.matched_bucket) {
    secondaryCandidates = await matchShampooProducts({
      query: message,
      thickness: hairProfile.thickness,
      shampooBucket: decision.secondary_bucket,
      count: 1,
    })
    for (const product of secondaryCandidates) {
      ;(product as unknown as Record<string, unknown>).shampoo_role = "daily"
    }
    for (const product of shampooCandidates) {
      ;(product as unknown as Record<string, unknown>).shampoo_role = "treatment"
    }
  }

  const allCandidates = [...shampooCandidates, ...secondaryCandidates]
  const updatedDecision = buildShampooDecision(hairProfile, allCandidates.length)
  const products = annotateShampooRecommendations(allCandidates, updatedDecision)

  return { products, updatedDecisions: { shampoo: updatedDecision } }
}

async function selectConditioner(
  message: string,
  hairProfile: HairProfile | null,
  decision: ConditionerDecision,
): Promise<SelectionResult> {
  if (!decision.eligible || !hairProfile?.thickness || !hairProfile?.protein_moisture_balance) {
    return { products: [], updatedDecisions: { conditioner: decision } }
  }

  const candidates = await matchConditionerProducts({
    query: message,
    thickness: hairProfile.thickness,
    proteinMoistureBalance: hairProfile.protein_moisture_balance,
    count: 10,
  })

  const updatedDecision = buildConditionerDecision(hairProfile, candidates.length)

  if (candidates.length === 0) {
    return { products: [], updatedDecisions: { conditioner: updatedDecision } }
  }

  const supabase = createAdminClient()
  const { data: specs, error: specsError } = await supabase
    .from("product_conditioner_rerank_specs")
    .select("*")
    .in(
      "product_id",
      candidates.map((c) => c.id),
    )

  if (specsError) {
    console.error("Failed to load conditioner specs for reranking:", specsError)
  }

  const products = rerankConditionerProducts(
    candidates,
    (specs ?? []) as ProductConditionerSpecs[],
    updatedDecision,
  ).slice(0, 3)

  return { products, updatedDecisions: { conditioner: updatedDecision } }
}

async function selectLeaveIn(
  message: string,
  hairProfile: HairProfile | null,
  decision: LeaveInDecision,
): Promise<SelectionResult> {
  if (
    !decision.eligible ||
    !hairProfile?.thickness ||
    !decision.need_bucket ||
    !decision.styling_context
  ) {
    return { products: [], updatedDecisions: { leaveIn: decision } }
  }

  const candidates = await matchLeaveInProducts({
    query: message,
    thickness: hairProfile.thickness,
    needBucket: decision.need_bucket,
    stylingContext: decision.styling_context,
    count: 10,
  })

  if (candidates.length === 0) {
    const updatedDecision = buildLeaveInDecision(hairProfile, 0)
    return { products: [], updatedDecisions: { leaveIn: updatedDecision } }
  }

  const supabase = createAdminClient()
  const { data: specs, error: specsError } = await supabase
    .from("product_leave_in_specs")
    .select("*")
    .in(
      "product_id",
      candidates.map((c) => c.id),
    )

  if (specsError) {
    console.error("Failed to load leave-in specs for reranking:", specsError)
    const updatedDecision = buildLeaveInDecision(hairProfile, 0)
    return { products: [], updatedDecisions: { leaveIn: updatedDecision } }
  }

  const reranked = rerankLeaveInProducts(
    candidates,
    (specs ?? []) as ProductLeaveInSpecs[],
    decision,
  )

  const updatedDecision = buildLeaveInDecision(hairProfile, reranked.length)
  return { products: reranked.slice(0, 3), updatedDecisions: { leaveIn: updatedDecision } }
}

async function selectOil(
  message: string,
  hairProfile: HairProfile | null,
  decision: OilDecision,
): Promise<SelectionResult> {
  if (
    !decision.eligible ||
    !hairProfile?.thickness ||
    !decision.matched_subtype ||
    decision.no_recommendation
  ) {
    return { products: [], updatedDecisions: { oil: decision } }
  }

  const candidates = await matchOilProducts({
    query: message,
    thickness: hairProfile.thickness,
    oilSubtype: decision.matched_subtype,
    count: 10,
  })

  const updatedDecision = buildOilDecision(hairProfile, message, candidates.length)
  const products = annotateOilRecommendations(candidates.slice(0, 3), updatedDecision)

  return { products, updatedDecisions: { oil: updatedDecision } }
}

async function selectMask(
  message: string,
  hairProfile: HairProfile | null,
  decision: MaskDecision,
): Promise<SelectionResult> {
  if (!decision.needs_mask || !decision.mask_type) {
    return { products: [], updatedDecisions: { mask: decision } }
  }

  const concernSearchOrder = buildMaskConcernSearchOrder(decision.mask_type)
  let products: MatchedProduct[] = []

  for (const concernCode of concernSearchOrder) {
    const candidates = await matchProducts({
      query: message,
      thickness: hairProfile?.thickness ?? undefined,
      concerns: [concernCode],
      category: "mask",
      count: 10,
    })

    if (candidates.length === 0) continue

    const prioritized = candidates.filter((c) => c.suitable_concerns.includes(concernCode))
    if (prioritized.length === 0) continue

    const supabase = createAdminClient()
    const { data: specs, error: specsError } = await supabase
      .from("product_mask_specs")
      .select("*")
      .in(
        "product_id",
        prioritized.map((c) => c.id),
      )

    if (specsError) {
      console.error("Failed to load mask specs for reranking:", specsError)
      products = prioritized.slice(0, 3) as MatchedProduct[]
      break
    }

    const reranked = rerankMaskProducts(
      prioritized,
      (specs ?? []) as ProductMaskSpecs[],
      hairProfile,
      decision,
    )

    if (reranked.length > 0) {
      products = reranked
      break
    }
  }

  return { products, updatedDecisions: { mask: decision } }
}

async function selectGeneric(
  message: string,
  hairProfile: HairProfile | null,
): Promise<SelectionResult> {
  const products = await matchProducts({
    query: message,
    thickness: hairProfile?.thickness ?? undefined,
    concerns: [],
    count: 3,
  })
  return { products, updatedDecisions: {} }
}

// ── Public dispatcher ────────────────────────────────────────────────────────

/**
 * Select products for the given category.
 * Dispatches to category-specific selection logic.
 * Memory constraints (downranking) are applied after selection.
 */
export async function selectProducts(params: {
  category: ProductCategory
  message: string
  hairProfile: HairProfile | null
  decisions: CategoryDecisions
  memoryContext: UserMemoryContext
  shouldPlanRoutine: boolean
}): Promise<SelectionResult> {
  const { category, message, hairProfile, decisions, memoryContext, shouldPlanRoutine } = params

  // Routine selection is handled separately by the orchestrator (uses product-attachments.ts)
  if (shouldPlanRoutine) {
    return { products: [], updatedDecisions: {} }
  }

  let result: SelectionResult

  switch (category) {
    case "shampoo":
      result = decisions.shampoo
        ? await selectShampoo(message, hairProfile, decisions.shampoo)
        : { products: [], updatedDecisions: {} }
      break
    case "conditioner":
      result = decisions.conditioner
        ? await selectConditioner(message, hairProfile, decisions.conditioner)
        : { products: [], updatedDecisions: {} }
      break
    case "leave_in":
      result = decisions.leaveIn
        ? await selectLeaveIn(message, hairProfile, decisions.leaveIn)
        : { products: [], updatedDecisions: {} }
      break
    case "oil":
      result = decisions.oil
        ? await selectOil(message, hairProfile, decisions.oil)
        : { products: [], updatedDecisions: {} }
      break
    case "mask": {
      const maskDecision = decisions.mask ?? deriveMaskDecision(hairProfile)
      result = await selectMask(message, hairProfile, maskDecision)
      break
    }
    default:
      result = await selectGeneric(message, hairProfile)
      break
  }

  // Apply memory constraints (downranking disliked products)
  result.products = applyProductMemoryConstraints(result.products, memoryContext)

  return result
}
