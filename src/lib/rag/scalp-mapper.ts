import type { ScalpCondition, ScalpType } from "@/lib/vocabulary"
import { deriveShampooBucket } from "@/lib/shampoo/constants"

/**
 * Maps user scalp profile fields to product concern codes used in the
 * `suitable_concerns` column on products and the `concern` metadata
 * field on content_chunks.
 *
 * Priority: scalp_condition (specific problem) > scalp_type (general).
 */
export function mapScalpToConcernCode(
  scalpType?: ScalpType | null,
  scalpCondition?: ScalpCondition | null
): string | null {
  return deriveShampooBucket(scalpType, scalpCondition)
}
