/**
 * `POST /api/profile/answers` answers 409 `profile_conflict` when the profile changed between
 * reading it and saving (another tab, a quiz linked meanwhile). The editors show their own notice
 * for it instead of the generic save error: retrying the same save cannot succeed, a reload can.
 */

export const PROFILE_CONFLICT_NOTICE = {
  title: "Dein Profil wurde inzwischen geändert",
  description: "Lade die Seite neu und versuch es noch einmal.",
} as const

export async function isProfileConflict(response: Response): Promise<boolean> {
  if (response.status !== 409) return false
  try {
    const body = (await response.clone().json()) as { error?: unknown }
    return body.error === "profile_conflict"
  } catch {
    return false
  }
}
