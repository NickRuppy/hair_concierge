/**
 * Maps user scalp profile fields to product concern codes used in the
 * `suitable_concerns` column on products and the `concern` metadata
 * field on content_chunks.
 *
 * Priority: scalp_condition (specific problem) > scalp_type (general).
 */
export function mapScalpToConcernCode(
  scalpType?: string | null,
  scalpCondition?: string | null
): string | null {
  // Scalp condition takes priority (specific problem > general type)
  if (scalpCondition && scalpCondition !== "none") {
    if (scalpCondition === "dandruff") return "schuppen"
    if (scalpCondition === "irritated") return "irritationen"
  }

  // Scalp type (general)
  if (scalpType === "oily") return "dehydriert-fettig"
  if (scalpType === "dry") return "trocken"
  if (scalpType === "balanced") return "normal"

  return null
}
