import { planVolumeDirection } from "@/lib/personal-plan/categories/volume-direction"
import type { BondbuilderTiming } from "@/lib/personal-plan/refinement/types"
import { bondbuilderTimingFromSnapshot } from "./bondbuilder-timing"
import type {
  InitialNeedPlanSnapshot,
  PlanProfile,
  PlanScalpOiliness,
} from "@/lib/personal-plan/types"

export type Stage3VisibleHairColor = "light_blonde" | "brown" | "dark"

/**
 * The profile answers the Stage-3 selection of dry shampoo, deep cleansing and Bondbuilder needs, built in
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
  /**
   * Bondbuilder routine answer (S4, `bondbuilderTimingFromSnapshot`): ranks the equally trusted
   * Bondbuilders by how they are used. `no_preference` leaves the trust → K18 order untouched.
   */
  bondbuilderTiming: BondbuilderTiming
}>

/** Neutral slice for synthetic, lab and audit callers without a real profile. */
export const UNKNOWN_SELECTION_PROFILE: Stage3SelectionProfile = Object.freeze({
  scalpOiliness: null,
  sensitiveScalp: false,
  volumeDirection: null,
  visibleHairColor: null,
  bondbuilderTiming: "no_preference",
})

function stringList(value: unknown): readonly string[] | null {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : null
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null
}

/**
 * `planVolumeDirection` on a persisted, possibly partial profile. Only validated facts decide;
 * when a fact the rule needs is missing the result is neutral (null), never a guessed route.
 * For a complete profile this equals `planVolumeDirection` (pinned by a matrix test).
 */
function persistedVolumeDirection(
  profile: Partial<PlanProfile> | undefined,
): "more" | "less" | null {
  const concerns = stringList(profile?.concerns)
  // A low-volume concern is decisive on its own.
  if (concerns?.includes("low_volume_or_weighed_down")) return "more"
  // Without concerns, a decisive low-volume concern cannot be ruled out.
  if (concerns === null) return null
  const goals = stringList(profile?.goals)
  if (goals === null || !goals.includes("volume_balance")) return null
  const hair = profile?.hair as Partial<PlanProfile["hair"]> | undefined
  const texture = oneOf(hair?.texture, ["straight", "wavy", "curly", "coily"] as const)
  const thickness = oneOf(hair?.thickness, ["fine", "normal", "coarse"] as const)
  if (texture === "curly" || texture === "coily" || thickness === "coarse") return "less"
  if (texture === null || thickness === null) return null
  return planVolumeDirection({
    hair: { texture, thickness },
    goals,
    concerns,
  } as unknown as PlanProfile)
}

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
    volumeDirection: persistedVolumeDirection(profile),
    visibleHairColor,
    bondbuilderTiming: bondbuilderTimingFromSnapshot(snapshot),
  })
}
