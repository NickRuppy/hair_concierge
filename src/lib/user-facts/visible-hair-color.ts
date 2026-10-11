import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import { DRY_SHAMPOO_VISIBLE_HAIR_COLORS } from "@/lib/personal-plan/refinement/types"
import type { Stage3VisibleHairColor } from "@/lib/personal-plan/products/authority/selection-profile"

const colorSchema = z.enum(DRY_SHAMPOO_VISIBLE_HAIR_COLORS)

function plainObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * The visible root colour the user answered themselves. An assumed or historical value adds no
 * constraint (it would silently down-rate tinted dry shampoos), so only `user` provenance counts.
 */
export function readUserVisibleHairColor(
  careHabits: unknown,
  factsProvenance: unknown,
): Stage3VisibleHairColor | null {
  const fields = plainObject(plainObject(plainObject(factsProvenance)?.care_habits)?.fields)
  if (fields?.dryShampooVisibleHairColor !== "user") return null
  const parsed = colorSchema.safeParse(plainObject(careHabits)?.dryShampooVisibleHairColor)
  return parsed.success ? parsed.data : null
}

/**
 * Fail-open loader for plan, preview and scan paths: a read error never blocks a plan or a scan;
 * it only means "colour unknown".
 */
export async function loadVisibleHairColor(
  client: SupabaseClient,
  userId: string,
): Promise<Stage3VisibleHairColor | null> {
  try {
    const { data, error } = await client
      .from("hair_profiles")
      .select("care_habits, facts_provenance")
      .eq("user_id", userId)
      .maybeSingle()
    if (error) {
      console.warn("visible_hair_color_unavailable", { userId })
      return null
    }
    const row = plainObject(data)
    return row ? readUserVisibleHairColor(row.care_habits, row.facts_provenance) : null
  } catch {
    console.warn("visible_hair_color_unavailable", { userId })
    return null
  }
}
