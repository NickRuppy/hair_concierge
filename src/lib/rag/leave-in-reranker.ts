import type { HairProfile } from "@/lib/types"
import type { MatchedProduct } from "@/lib/rag/product-matcher"
import type { ProductLeaveInSpecs } from "@/lib/leave-in/constants"
import {
  buildLeaveInDecision,
  rerankLeaveInProducts as rerankStrictLeaveInProducts,
} from "@/lib/rag/leave-in-decision"

/**
 * Backwards-compatible wrapper around the strict leave-in decision flow.
 * New code should import from `leave-in-decision.ts` directly.
 */
export function rerankLeaveInProducts(
  candidates: MatchedProduct[],
  specs: ProductLeaveInSpecs[],
  hairProfile: HairProfile | null
): MatchedProduct[] {
  return rerankStrictLeaveInProducts(
    candidates,
    specs,
    buildLeaveInDecision(hairProfile, candidates.length)
  )
}
