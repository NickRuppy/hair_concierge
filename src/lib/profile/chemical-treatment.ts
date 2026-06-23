import type { ChemicalTreatment } from "@/lib/vocabulary"

const ACTIVE_CHEMICAL_TREATMENTS = new Set<ChemicalTreatment>([
  "colored",
  "bleached",
  "permed",
  "chemically_straightened",
])

const COLOR_OR_BLEACH_TREATMENTS = new Set<ChemicalTreatment>(["colored", "bleached"])
const SHAPE_CHANGING_TREATMENTS = new Set<ChemicalTreatment>(["permed", "chemically_straightened"])

const DAMAGE_DRIVER_BY_TREATMENT: Partial<Record<ChemicalTreatment, string>> = {
  bleached: "bleached_hair",
  colored: "colored_hair",
  permed: "permed_hair",
  chemically_straightened: "chemically_straightened_hair",
}

function toTreatmentSet(treatments: readonly ChemicalTreatment[]): Set<ChemicalTreatment> {
  return new Set(treatments)
}

export function hasActiveChemicalTreatment(treatments: readonly ChemicalTreatment[]): boolean {
  return treatments.some((treatment) => ACTIVE_CHEMICAL_TREATMENTS.has(treatment))
}

export function hasColorOrBleachTreatment(treatments: readonly ChemicalTreatment[]): boolean {
  return treatments.some((treatment) => COLOR_OR_BLEACH_TREATMENTS.has(treatment))
}

export function hasBleachTreatment(treatments: readonly ChemicalTreatment[]): boolean {
  return treatments.includes("bleached")
}

export function hasShapeChangingTreatment(treatments: readonly ChemicalTreatment[]): boolean {
  return treatments.some((treatment) => SHAPE_CHANGING_TREATMENTS.has(treatment))
}

export function getChemicalTreatmentDamageWeight(treatments: readonly ChemicalTreatment[]): number {
  const treatmentSet = toTreatmentSet(treatments)

  if (treatmentSet.has("bleached")) return 4
  if (treatmentSet.has("chemically_straightened")) return 3

  const nonBleachStressors = ["colored", "permed"].filter((treatment) =>
    treatmentSet.has(treatment as ChemicalTreatment),
  ).length

  if (nonBleachStressors >= 2) return 3
  if (nonBleachStressors === 1) return 2
  return 0
}

export function getChemicalTreatmentDamageDrivers(
  treatments: readonly ChemicalTreatment[],
): string[] {
  const treatmentSet = toTreatmentSet(treatments)
  return (["bleached", "colored", "permed", "chemically_straightened"] as const)
    .filter((treatment) => treatmentSet.has(treatment))
    .map((treatment) => DAMAGE_DRIVER_BY_TREATMENT[treatment])
    .filter((driver): driver is string => Boolean(driver))
}
