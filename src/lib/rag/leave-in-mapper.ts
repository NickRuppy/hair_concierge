import type { HairProfile } from "@/lib/types"

/**
 * Maps broad profile concerns to the coarse leave-in concern buckets
 * currently present in the product matrix (`protein`, `feuchtigkeit`, `performance`).
 */
export function mapProfileToLeaveInConcernCodes(
  profile: HairProfile | null
): string[] {
  if (!profile) return []

  const mapped = new Set<string>()

  for (const concern of profile.concerns ?? []) {
    if (concern === "dryness" || concern === "frizz") {
      mapped.add("feuchtigkeit")
      continue
    }

    if (concern === "split_ends" || concern === "hair_damage") {
      mapped.add("protein")
      continue
    }

    if (concern === "thinning" || concern === "hair_loss") {
      mapped.add("performance")
    }
  }

  if (profile.protein_moisture_balance === "snaps") {
    mapped.add("feuchtigkeit")
  }
  if (profile.protein_moisture_balance === "stretches_stays") {
    mapped.add("protein")
  }

  if (mapped.size === 0 && (profile.goals ?? []).length > 0) {
    mapped.add("performance")
  }

  return [...mapped]
}
