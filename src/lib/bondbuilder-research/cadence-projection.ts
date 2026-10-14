import type { BondbuilderResearchProfile } from "./contracts"
import { validateBondbuilderResearchProfile } from "./production-adapter"

type Clause = NonNullable<
  NonNullable<BondbuilderResearchProfile["application"]["cadence"]["value"]>["maintenance"]
>

function clauseCopy(clause: Clause): string {
  if (clause.kind === "consecutive_washes") return `bei den ersten ${clause.count} Haarwäschen`
  if (clause.kind === "every_n_washes")
    return clause.minimum === clause.maximum
      ? clause.minimum === 1
        ? "bei jeder Haarwäsche"
        : `bei jeder ${clause.minimum}. Haarwäsche`
      : `alle ${clause.minimum}–${clause.maximum} Haarwäschen`
  return clause.minimum === clause.maximum
    ? `${clause.minimum}× pro Woche`
    : `${clause.minimum}–${clause.maximum}× pro Woche`
}

/** Label display only: no additional wash event or personalized allocation is created. */
export function projectBondbuilderCadence(
  input: BondbuilderResearchProfile,
): Record<string, unknown> | null {
  const validation = validateBondbuilderResearchProfile(input)
  if (!validation.success) return null
  const profile = validation.profile,
    fact = profile.application.cadence,
    value = fact.value
  if (
    !value ||
    value.status !== "source_stated" ||
    value.branches.length ||
    fact.confidence === "low" ||
    profile.application.market_applicability === "unresolved" ||
    !fact.source_ids.every((id) => profile.application.direction_source_ids.includes(id)) ||
    (!value.initial && !value.maintenance)
  )
    return null
  const parts = [
    value.initial ? clauseCopy(value.initial) : null,
    value.maintenance ? clauseCopy(value.maintenance) : null,
  ].filter((part): part is string => part !== null)
  const copy = parts.join(", danach ")
  return {
    kind: value.initial ? "label_course" : "label_schedule",
    copy_de: copy.charAt(0).toLocaleUpperCase("de-DE") + copy.slice(1) + ".",
    initial: value.initial,
    maintenance: value.maintenance,
    source_ids: [...fact.source_ids],
    source_urls: profile.sources
      .filter((source) => fact.source_ids.includes(source.id))
      .map((source) => source.url),
  }
}

/* ── S4: damage-branched cadence (Aveda, decisions B1/D-b) ───────────────── */

const DAMAGE_LEVELS = ["none", "low", "moderate", "high", "severe"] as const
type DamageLevel = (typeof DAMAGE_LEVELS)[number]

/**
 * A reviewed ruling that binds each manufacturer damage condition of ONE frozen profile to the
 * plan's damage levels (`assessments.damage.structuralLevel`) and a German line. The projector
 * never invents a band: unbound levels stay on the generic runtime line.
 */
export type BondbuilderDamageCadenceBinding = {
  version: "bondbuilder-damage-cadence-binding-v1"
  research_key: string
  product_id: string
  profile_sha256: string
  ruling: string
  branches: Array<{ condition: string; structural_levels: DamageLevel[]; copy_de: string }>
}

export type BondbuilderDamageCadenceProjection =
  | { status: "ok"; cadence: Record<string, unknown> }
  | {
      status: "refused"
      reason:
        | "invalid_profile"
        | "product_mismatch"
        | "profile_digest_mismatch"
        | "not_conditional"
        | "confidence_low"
        | "market_unresolved"
        | "source_outside_directions"
        | "condition_mismatch"
        | "levels_empty"
        | "level_unknown"
        | "levels_overlap"
        | "copy_blank"
    }

/** Builds the `damage_branched` protocol cadence from a frozen profile plus its reviewed binding. */
export function projectBondbuilderDamageBranchedCadence(
  input: BondbuilderResearchProfile,
  binding: BondbuilderDamageCadenceBinding,
): BondbuilderDamageCadenceProjection {
  const refuse = (
    reason: Extract<BondbuilderDamageCadenceProjection, { status: "refused" }>["reason"],
  ): BondbuilderDamageCadenceProjection => ({ status: "refused", reason })
  const validation = validateBondbuilderResearchProfile(input)
  if (!validation.success) return refuse("invalid_profile")
  const profile = validation.profile
  if (profile.identity.product_id !== binding.product_id) return refuse("product_mismatch")
  if (profile.review.profile_sha256 !== binding.profile_sha256) {
    return refuse("profile_digest_mismatch")
  }
  const fact = profile.application.cadence
  const value = fact.value
  if (!value || value.status !== "source_stated_conditional" || value.branches.length === 0) {
    return refuse("not_conditional")
  }
  if (fact.confidence === "low") return refuse("confidence_low")
  if (profile.application.market_applicability === "unresolved") return refuse("market_unresolved")
  const directions = new Set(profile.application.direction_source_ids)
  if (
    !fact.source_ids.every((id) => directions.has(id)) ||
    !value.branches.every(
      (branch) =>
        branch.source_ids.length > 0 && branch.source_ids.every((id) => directions.has(id)),
    )
  ) {
    return refuse("source_outside_directions")
  }
  const conditions = value.branches.map((branch) => branch.condition)
  if (
    binding.branches.length !== value.branches.length ||
    new Set(binding.branches.map((entry) => entry.condition)).size !== binding.branches.length ||
    !binding.branches.every((entry) => conditions.includes(entry.condition)) ||
    value.branches.some(
      (branch) => branch.initial !== null || branch.timing !== null || !branch.maintenance,
    )
  ) {
    return refuse("condition_mismatch")
  }
  const seen = new Set<string>()
  for (const entry of binding.branches) {
    if (entry.structural_levels.length === 0) return refuse("levels_empty")
    for (const level of entry.structural_levels) {
      if (!DAMAGE_LEVELS.includes(level)) return refuse("level_unknown")
      if (seen.has(level)) return refuse("levels_overlap")
      seen.add(level)
    }
    if (entry.copy_de.trim().length === 0) return refuse("copy_blank")
  }
  return {
    status: "ok",
    cadence: {
      kind: "damage_branched",
      branches: value.branches.map((branch) => {
        const entry = binding.branches.find(
          (candidate) => candidate.condition === branch.condition,
        )!
        return {
          structural_levels: [...entry.structural_levels],
          copy_de: entry.copy_de.trim(),
          maintenance: branch.maintenance,
          source_ids: [...branch.source_ids],
        }
      }),
      source_ids: [...fact.source_ids],
      binding_ruling: binding.ruling,
    },
  }
}
