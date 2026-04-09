import { createAdminClient } from "@/lib/supabase/admin"
import { rerankConditionerProducts } from "@/lib/rag/conditioner-decision"
import { rerankLeaveInProducts } from "@/lib/rag/leave-in-decision"
import { buildMaskConcernSearchOrder } from "@/lib/rag/mask-mapper"
import { rerankMaskProducts } from "@/lib/rag/mask-reranker"
import { buildOilDecision, annotateOilRecommendations } from "@/lib/rag/oil-decision"
import {
  matchConditionerProducts,
  matchLeaveInProducts,
  matchOilProducts,
  matchProducts,
  matchShampooProducts,
} from "@/lib/rag/product-matcher"
import { annotateShampooRecommendations } from "@/lib/rag/shampoo-decision"
import { applyProductMemoryConstraints } from "@/lib/rag/user-memory"
import { getRoutineAutofillSlots } from "@/lib/routines/planner"
import type { ProductConditionerSpecs } from "@/lib/conditioner/constants"
import type { ProductLeaveInSpecs } from "@/lib/leave-in/constants"
import type { ProductMaskSpecs } from "@/lib/mask/constants"
import type {
  ConditionerDecision,
  HairProfile,
  LeaveInDecision,
  MaskDecision,
  Product,
  RoutinePlan,
  RoutineSlotAdvice,
  ShampooDecision,
} from "@/lib/types"

const ROUTINE_ATTACHMENT_SCORE_THRESHOLD = 72
const ROUTINE_ATTACHMENT_SLOT_LIMIT = 2

type SupabaseAdmin = ReturnType<typeof createAdminClient>
type MemoryContextLike = {
  enabled: boolean
  dislikedProductNames: string[]
}

type DecisionWithCatalogCount = {
  eligible: boolean
  candidate_count: number
  no_catalog_match: boolean
}

function isConfidentProduct(product: Product): boolean {
  const metaScore = product.recommendation_meta?.score
  if (typeof metaScore === "number" && Number.isFinite(metaScore)) {
    return metaScore >= ROUTINE_ATTACHMENT_SCORE_THRESHOLD
  }

  return false
}

function withCandidateCount<T extends DecisionWithCatalogCount>(
  decision: T,
  candidateCount: number,
): T {
  return {
    ...decision,
    candidate_count: candidateCount,
    no_catalog_match: decision.eligible && candidateCount === 0,
  }
}

async function attachShampooProduct(
  slot: RoutineSlotAdvice,
  hairProfile: HairProfile | null,
  decision: ShampooDecision,
): Promise<Product[]> {
  if (!decision.eligible || !hairProfile?.thickness || !decision.matched_bucket) return []

  const candidates = await matchShampooProducts({
    query: slot.product_query ?? "Ich suche ein Shampoo fuer meine Routine.",
    thickness: hairProfile.thickness,
    shampooBucket: decision.matched_bucket,
    count: 3,
  })

  const annotated = annotateShampooRecommendations(candidates, withCandidateCount(decision, candidates.length))
  return annotated.filter(isConfidentProduct).slice(0, 1)
}

async function attachConditionerProduct(
  supabase: SupabaseAdmin,
  slot: RoutineSlotAdvice,
  hairProfile: HairProfile | null,
  decision: ConditionerDecision,
): Promise<Product[]> {
  if (!decision.eligible || !hairProfile?.thickness || !hairProfile?.protein_moisture_balance) return []

  const candidates = await matchConditionerProducts({
    query: slot.product_query ?? "Ich suche einen Conditioner fuer meine Routine.",
    thickness: hairProfile.thickness,
    proteinMoistureBalance: hairProfile.protein_moisture_balance,
    count: 10,
  })
  if (candidates.length === 0) return []

  const { data: specs, error } = await supabase
    .from("product_conditioner_rerank_specs")
    .select("*")
    .in("product_id", candidates.map((candidate) => candidate.id))

  if (error) {
    console.error("Failed to load conditioner specs for routine attachment:", error)
    return []
  }

  return rerankConditionerProducts(
    candidates,
    (specs ?? []) as ProductConditionerSpecs[],
    withCandidateCount(decision, candidates.length)
  ).filter(isConfidentProduct).slice(0, 1)
}

async function attachLeaveInProduct(
  supabase: SupabaseAdmin,
  slot: RoutineSlotAdvice,
  hairProfile: HairProfile | null,
  decision: LeaveInDecision,
): Promise<Product[]> {
  if (
    !decision.eligible ||
    !hairProfile?.thickness ||
    !decision.need_bucket ||
    !decision.styling_context
  ) {
    return []
  }

  const candidates = await matchLeaveInProducts({
    query: slot.product_query ?? "Ich suche ein Leave-in fuer meine Routine.",
    thickness: hairProfile.thickness,
    needBucket: decision.need_bucket,
    stylingContext: decision.styling_context,
    count: 10,
  })
  if (candidates.length === 0) return []

  const { data: specs, error } = await supabase
    .from("product_leave_in_specs")
    .select("*")
    .in("product_id", candidates.map((candidate) => candidate.id))

  if (error) {
    console.error("Failed to load leave-in specs for routine attachment:", error)
    return []
  }

  return rerankLeaveInProducts(
    candidates,
    (specs ?? []) as ProductLeaveInSpecs[],
    withCandidateCount(decision, candidates.length)
  ).filter(isConfidentProduct).slice(0, 1)
}

async function attachMaskProduct(
  supabase: SupabaseAdmin,
  slot: RoutineSlotAdvice,
  hairProfile: HairProfile | null,
  decision: MaskDecision,
): Promise<Product[]> {
  if (!decision.needs_mask || !decision.mask_type) return []

  for (const concernCode of buildMaskConcernSearchOrder(decision.mask_type)) {
    const candidates = await matchProducts({
      query: slot.product_query ?? "Ich suche eine Maske fuer meine Routine.",
      thickness: hairProfile?.thickness ?? undefined,
      concerns: [concernCode],
      category: "mask",
      count: 10,
    })

    const prioritized = candidates.filter((candidate) =>
      candidate.suitable_concerns.includes(concernCode)
    )
    if (prioritized.length === 0) continue

    const { data: specs, error } = await supabase
      .from("product_mask_specs")
      .select("*")
      .in("product_id", prioritized.map((candidate) => candidate.id))

    if (error) {
      console.error("Failed to load mask specs for routine attachment:", error)
      return []
    }

    const reranked = rerankMaskProducts(
      prioritized,
      (specs ?? []) as ProductMaskSpecs[],
      hairProfile,
      decision
    )

    const confident = reranked.filter(isConfidentProduct).slice(0, 1)
    if (confident.length > 0) return confident
  }

  return []
}

async function attachOilProduct(
  slot: RoutineSlotAdvice,
  hairProfile: HairProfile | null,
): Promise<Product[]> {
  const query = slot.product_query ?? "Ich moechte Hair Oiling vor dem Waschen machen."
  const decision = buildOilDecision(hairProfile, query)

  if (
    !decision.eligible ||
    !hairProfile?.thickness ||
    !decision.matched_subtype ||
    decision.no_recommendation
  ) {
    return []
  }

  const candidates = await matchOilProducts({
    query,
    thickness: hairProfile.thickness,
    oilSubtype: decision.matched_subtype,
    count: 10,
  })

  return annotateOilRecommendations(
    candidates.slice(0, 3),
    withCandidateCount(decision, candidates.length)
  ).filter(isConfidentProduct).slice(0, 1)
}

async function attachProductsForSlot(
  supabase: SupabaseAdmin,
  slot: RoutineSlotAdvice,
  hairProfile: HairProfile | null,
  plan: RoutinePlan,
): Promise<Product[]> {
  const { decision_context: decisionContext } = plan

  switch (slot.category) {
    case "shampoo":
      return attachShampooProduct(slot, hairProfile, decisionContext.shampoo)
    case "conditioner":
      return attachConditionerProduct(supabase, slot, hairProfile, decisionContext.conditioner)
    case "leave_in":
      return attachLeaveInProduct(supabase, slot, hairProfile, decisionContext.leave_in)
    case "mask":
      return attachMaskProduct(supabase, slot, hairProfile, decisionContext.mask)
    case "oil":
      return attachOilProduct(slot, hairProfile)
    default:
      return []
  }
}

export async function attachProductsToRoutinePlan(params: {
  plan: RoutinePlan
  hairProfile: HairProfile | null
  memoryContext: MemoryContextLike
  supabase?: SupabaseAdmin
}): Promise<{ plan: RoutinePlan; matchedProducts: Product[] }> {
  const { plan, hairProfile, memoryContext } = params
  const supabase = params.supabase ?? createAdminClient()
  const slotAttachments = new Map<string, Product[]>()
  const matchedProducts: Product[] = []
  const autofillSlots = getRoutineAutofillSlots(plan)

  for (let start = 0; start < autofillSlots.length; start += ROUTINE_ATTACHMENT_SLOT_LIMIT) {
    if (slotAttachments.size >= ROUTINE_ATTACHMENT_SLOT_LIMIT) break

    const batch = autofillSlots.slice(start, start + ROUTINE_ATTACHMENT_SLOT_LIMIT)
    const batchResults = await Promise.all(
      batch.map(async (slot) => ({
        slot,
        products: await attachProductsForSlot(supabase, slot, hairProfile, plan),
      }))
    )

    for (const { slot, products } of batchResults) {
      if (slotAttachments.size >= ROUTINE_ATTACHMENT_SLOT_LIMIT) break
      if (products.length === 0) continue

      const constrained = applyProductMemoryConstraints(products, memoryContext)
      if (constrained.length === 0) continue

      slotAttachments.set(slot.id, constrained)
      matchedProducts.push(...constrained)
    }
  }

  if (slotAttachments.size === 0) {
    return { plan, matchedProducts: [] }
  }

  return {
    plan: {
      ...plan,
      sections: plan.sections.map((section) => ({
        ...section,
        slots: section.slots.map((slot) => {
          const attachedProducts = slotAttachments.get(slot.id)
          return attachedProducts
            ? { ...slot, attached_products: attachedProducts }
            : slot
        }),
      })),
    },
    matchedProducts,
  }
}
