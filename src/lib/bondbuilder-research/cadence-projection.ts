import type { BondbuilderResearchProfile } from "./contracts"
import { validateBondbuilderResearchProfile } from "./production-adapter"

type Clause = NonNullable<NonNullable<BondbuilderResearchProfile["application"]["cadence"]["value"]>["maintenance"]>

function clauseCopy(clause: Clause): string {
  if (clause.kind === "consecutive_washes") return `bei den ersten ${clause.count} Haarwäschen`
  if (clause.kind === "every_n_washes") return clause.minimum === clause.maximum
    ? clause.minimum === 1 ? "bei jeder Haarwäsche" : `bei jeder ${clause.minimum}. Haarwäsche`
    : `alle ${clause.minimum}–${clause.maximum} Haarwäschen`
  return clause.minimum === clause.maximum ? `${clause.minimum}× pro Woche` : `${clause.minimum}–${clause.maximum}× pro Woche`
}

/** Label display only: no additional wash event or personalized allocation is created. */
export function projectBondbuilderCadence(input: BondbuilderResearchProfile): Record<string, unknown> | null {
  const validation = validateBondbuilderResearchProfile(input)
  if (!validation.success) return null
  const profile = validation.profile, fact = profile.application.cadence, value = fact.value
  if (!value || value.status !== "source_stated" || value.branches.length || fact.confidence === "low" ||
      profile.application.market_applicability === "unresolved" ||
      !fact.source_ids.every(id => profile.application.direction_source_ids.includes(id)) ||
      (!value.initial && !value.maintenance)) return null
  const parts = [value.initial ? clauseCopy(value.initial) : null, value.maintenance ? clauseCopy(value.maintenance) : null].filter((part): part is string => part !== null)
  const copy = parts.join(", danach ")
  return {
    kind: value.initial ? "label_course" : "label_schedule",
    copy_de: copy.charAt(0).toLocaleUpperCase("de-DE") + copy.slice(1) + ".",
    initial: value.initial,
    maintenance: value.maintenance,
    source_ids: [...fact.source_ids],
    source_urls: profile.sources.filter(source => fact.source_ids.includes(source.id)).map(source => source.url),
  }
}
