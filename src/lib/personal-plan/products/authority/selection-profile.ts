import { planVolumeDirection } from "@/lib/personal-plan/categories/volume-direction"
import type {
  InitialNeedPlanSnapshot,
  PlanProfile,
  PlanScalpOiliness,
} from "@/lib/personal-plan/types"

export type Stage3VisibleHairColor = "light_blonde" | "brown" | "dark"

/**
 * The profile answers the Stage-3 selection of dry shampoo and deep cleansing needs, built in
 * one place (`buildStage3SelectionProfile`) and passed on every authority input.
 */
export type Stage3SelectionProfile = Readonly<{
  /** Quiz `scalpOiliness`; deep-cleansing soft scalp target. */
  scalpOiliness: PlanScalpOiliness | null
  /** Quiz scalp concern `irritated` („gereizt oder empfindlich"); dry-shampoo sensitivity. */
  sensitiveScalp: boolean
  /** Derived from the profile (`planVolumeDirection`); dry-shampoo styling direction. */
  volumeDirection: "more" | "less" | null
  /** Refinement answer with `user` provenance only; null = unknown. */
  visibleHairColor: Stage3VisibleHairColor | null
}>

/** Neutral slice for synthetic, lab and audit callers without a real profile. */
export const UNKNOWN_SELECTION_PROFILE: Stage3SelectionProfile = Object.freeze({
  scalpOiliness: null,
  sensitiveScalp: false,
  volumeDirection: null,
  visibleHairColor: null,
})

export function buildStage3SelectionProfile(
  snapshot: Pick<InitialNeedPlanSnapshot, "profile">,
  visibleHairColor: Stage3VisibleHairColor | null,
): Stage3SelectionProfile {
  // The snapshot is persisted JSON read back on plan, preview and scan paths. A partial profile
  // degrades to the neutral answer for the missing part instead of failing the request.
  const profile = snapshot.profile as Partial<PlanProfile> | undefined
  const scalp = profile?.scalp as Partial<PlanProfile["scalp"]> | undefined
  const oiliness = scalp?.oiliness
  return Object.freeze({
    scalpOiliness:
      oiliness === "oily" || oiliness === "balanced" || oiliness === "dry" ? oiliness : null,
    // Deliberately not `irritationState`: its Stage-2 detail can be the assumed default.
    sensitiveScalp: Array.isArray(scalp?.concerns) && scalp.concerns.includes("irritated"),
    volumeDirection:
      profile?.hair && Array.isArray(profile.goals) && Array.isArray(profile.concerns)
        ? planVolumeDirection(profile as PlanProfile)
        : null,
    visibleHairColor,
  })
}
