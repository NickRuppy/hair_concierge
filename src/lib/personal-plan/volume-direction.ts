import type { PlanHairTexture, PlanHairThickness } from "./types"

/**
 * The single source of truth for reading the direction of the `volume_balance`
 * goal.
 *
 * The released quiz aliases BOTH "mehr Volumen" (`volume`) and "weniger Volumen"
 * (`less_volume`) onto the one `volume_balance` token, so the goal alone cannot
 * say which the user meant. Texture and thickness resolve it: curly, coily,
 * coarse, and wavy-that-also-wants-definition read as wanting control, and
 * everything else reads as wanting more volume.
 *
 * Both Conditioner weight and the Hair Tools styling routes consume this. Keep
 * it here rather than duplicating the predicate — the same profile must never
 * mean "more volume" in one category and "less volume" in another.
 */
export type VolumeDirectionInput = {
  texture: PlanHairTexture
  thickness: PlanHairThickness
  hasVolumeGoal: boolean
  hasDefinitionGoal: boolean
  hasLostShapeConcern: boolean
}

export type VolumeDirection = "control" | "volume_up"

export function resolveVolumeDirection(input: VolumeDirectionInput): VolumeDirection {
  const controlRoute =
    input.texture === "curly" ||
    input.texture === "coily" ||
    input.thickness === "coarse" ||
    (input.texture === "wavy" && (input.hasDefinitionGoal || input.hasLostShapeConcern))
  return controlRoute ? "control" : "volume_up"
}

/** True only when the user named the volume goal AND it reads as wanting more. */
export function wantsMoreVolume(input: VolumeDirectionInput): boolean {
  return input.hasVolumeGoal && resolveVolumeDirection(input) === "volume_up"
}

/** Adapts a full `PlanProfile` onto the narrow input this predicate reads. */
export function volumeDirectionInputFor(profile: {
  hair: { texture: PlanHairTexture; thickness: PlanHairThickness }
  goals: readonly string[]
  concerns: readonly string[]
}): VolumeDirectionInput {
  return {
    texture: profile.hair.texture,
    thickness: profile.hair.thickness,
    hasVolumeGoal: profile.goals.includes("volume_balance"),
    hasDefinitionGoal: profile.goals.includes("shape_definition"),
    hasLostShapeConcern: profile.concerns.includes("lost_shape"),
  }
}
