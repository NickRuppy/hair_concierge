import type { HairProfile } from "@/lib/types"

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
}

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
    const normalized = normalize(concern)

    if (normalized.includes("trocken") || normalized.includes("frizz")) {
      mapped.add("feuchtigkeit")
      continue
    }

    if (normalized.includes("spliss") || normalized.includes("schad")) {
      mapped.add("protein")
      continue
    }

    if (normalized.includes("volumen") || normalized.includes("glanz")) {
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
