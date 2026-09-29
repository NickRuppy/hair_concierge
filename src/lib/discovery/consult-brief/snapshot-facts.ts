import { DIAGNOSTIC_CONCERNS, type DiagnosticConcern } from "@/lib/quiz/diagnostic-input"
import { PRODUCT_FREQUENCIES, type ProductFrequency } from "@/lib/vocabulary/frequencies"

/**
 * The consult brief's facts off the Idealplan's own snapshot (consult-agent T2) — the same
 * profile the Idealroutine was computed from (`ScanEvaluationContext.snapshot`). Pure and
 * defensive like `discoveryConcernProfileFacts`: whatever cannot be read is `null` (unknown).
 */
export type DiscoveryConsultSnapshotFacts = {
  /** `profile.concerns` — her quiz concerns. */
  concerns: DiagnosticConcern[] | null
  /** `profile.scalp.concerns` (`oily_dandruff`, `dry_dandruff`, `irritated`). */
  scalpConcerns: string[] | null
  /** Tools of the heat-exposure assessment; `[]` when heat is absent. */
  profileHeatTools: string[] | null
  /** `profile.routine.shampooFrequency` when known (a frequency or `does_not_wash`). */
  currentWashFrequency: string | null
  /** The shampoo decision's wash target (`wet_wash_total`). */
  idealWashFrequency: ProductFrequency | null
  /** `assessments.hairLossBoundary.state === "present"`. */
  hairLossBoundary: boolean | null
}

export function discoveryConsultSnapshotFacts(snapshot: unknown): DiscoveryConsultSnapshotFacts {
  const profile = field(snapshot, "profile")
  const assessments = field(snapshot, "assessments")

  const concerns = field(profile, "concerns")
  const scalpConcerns = field(field(profile, "scalp"), "concerns")

  const heat = field(assessments, "heatExposure")
  const heatState = field(heat, "state")
  const events = field(heat, "events")
  const profileHeatTools =
    heatState === "absent"
      ? []
      : heatState === "present" && Array.isArray(events)
        ? events.map((event) => field(event, "tool")).filter(isString)
        : null

  const shampooFrequency = field(field(profile, "routine"), "shampooFrequency")
  const current = field(shampooFrequency, "value")

  const decisions = field(snapshot, "decisions")
  const shampoo = Array.isArray(decisions)
    ? decisions.find((decision) => field(decision, "category") === "shampoo")
    : undefined
  const target = field(shampoo, "frequency")
  const ideal = field(target, "kind") === "wet_wash_total" ? field(target, "target") : null

  const boundary = field(field(assessments, "hairLossBoundary"), "state")

  return {
    concerns: Array.isArray(concerns)
      ? concerns.filter((entry): entry is DiagnosticConcern =>
          (DIAGNOSTIC_CONCERNS as readonly unknown[]).includes(entry),
        )
      : null,
    scalpConcerns: Array.isArray(scalpConcerns) ? scalpConcerns.filter(isString) : null,
    profileHeatTools,
    currentWashFrequency:
      field(shampooFrequency, "state") === "known" && isString(current) ? current : null,
    idealWashFrequency: (PRODUCT_FREQUENCIES as readonly unknown[]).includes(ideal)
      ? (ideal as ProductFrequency)
      : null,
    hairLossBoundary: boundary === "present" ? true : boundary === "absent" ? false : null,
  }
}

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}
