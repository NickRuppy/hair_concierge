import type { PersonalPlanTexture } from "./texture-question"

const RECOVERY_KEY = "personal-plan-progressive-entry-recovery"
const TEXTURES = new Set<PersonalPlanTexture>(["straight", "wavy", "curly", "coily"])

type SelectedProgressiveEntryRecovery = {
  attempt: number
  kind: "selected"
  quizStarted: boolean
  selectedAt: number
  texture: PersonalPlanTexture
}

type ResumeProgressiveEntryRecovery = {
  attempt: number
  kind: "local_draft"
}

export type ProgressiveEntryRecovery =
  | SelectedProgressiveEntryRecovery
  | ResumeProgressiveEntryRecovery

export type ProgressiveEntryRecoveryStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">

export function persistProgressiveEntryRecovery(
  storage: ProgressiveEntryRecoveryStorage,
  recovery: ProgressiveEntryRecovery,
) {
  storage.setItem(RECOVERY_KEY, JSON.stringify(recovery))
}

export function consumeProgressiveEntryRecovery(
  storage: ProgressiveEntryRecoveryStorage,
): ProgressiveEntryRecovery | null {
  const serialized = storage.getItem(RECOVERY_KEY)
  if (!serialized) return null
  storage.removeItem(RECOVERY_KEY)
  try {
    const value: unknown = JSON.parse(serialized)
    if (!value || typeof value !== "object") return null
    const candidate = value as Record<string, unknown>
    if (
      typeof candidate.attempt !== "number" ||
      !Number.isInteger(candidate.attempt) ||
      candidate.attempt < 1
    ) {
      return null
    }
    if (candidate.kind === "local_draft") {
      return { attempt: candidate.attempt, kind: candidate.kind }
    }
    if (
      candidate.kind !== "selected" ||
      typeof candidate.texture !== "string" ||
      !TEXTURES.has(candidate.texture as PersonalPlanTexture) ||
      typeof candidate.selectedAt !== "number" ||
      !Number.isFinite(candidate.selectedAt) ||
      typeof candidate.quizStarted !== "boolean"
    ) {
      return null
    }
    return candidate as SelectedProgressiveEntryRecovery
  } catch {
    return null
  }
}
