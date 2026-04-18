type PersistedQuizDiagnosticsProfile = {
  hair_texture?: string | null
  thickness?: string | null
  cuticle_condition?: string | null
  protein_moisture_balance?: string | null
  scalp_type?: string | null
  scalp_condition?: string | null
  chemical_treatment?: string[] | null
  concerns?: string[] | null
} | null

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

function hasCompletedScalpStep(profile: NonNullable<PersistedQuizDiagnosticsProfile>): boolean {
  return (
    hasNonEmptyString(profile.scalp_type) &&
    (profile.scalp_condition === null || hasNonEmptyString(profile.scalp_condition))
  )
}

export function hasCompletedQuizDiagnostics(profile: PersistedQuizDiagnosticsProfile): boolean {
  if (!profile) {
    return false
  }

  return (
    hasNonEmptyString(profile.hair_texture) &&
    hasNonEmptyString(profile.thickness) &&
    hasNonEmptyString(profile.cuticle_condition) &&
    hasNonEmptyString(profile.protein_moisture_balance) &&
    hasCompletedScalpStep(profile) &&
    Array.isArray(profile.chemical_treatment) &&
    profile.chemical_treatment.length > 0 &&
    Array.isArray(profile.concerns)
  )
}

export type { PersistedQuizDiagnosticsProfile }
