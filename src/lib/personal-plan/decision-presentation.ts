import { PRODUCT_FREQUENCY_LABELS, type ProductFrequency } from "@/lib/vocabulary/frequencies"
import type {
  PlanCategoryDecision,
  PlanFrequencyTarget,
  Stage1Category,
} from "@/lib/personal-plan/types"

/**
 * Category-level presentation copy shared between the Stage 1 plan-start
 * screen (`snapshot-adapter.ts`) and the Stage 1 product preview payload
 * (`product-previews.ts`). Both derive the same three reasoning blocks from
 * the same `PlanCategoryDecision` — this module is their single source so
 * the two surfaces never drift.
 */

export const CATEGORY_LABELS: Record<Stage1Category, string> = {
  shampoo: "Shampoo",
  conditioner: "Conditioner",
  leave_in: "Leave-in",
  heat_protectant: "Hitzeschutz",
  oil: "Haaröl",
  mask: "Haarmaske",
  scalp_care: "Kopfhautpflege",
  dry_shampoo: "Trockenshampoo",
  bondbuilder: "Bondbuilder",
  deep_cleansing_shampoo: "Tiefenreinigung",
}

export const DETAIL_TITLE_PRODUCT = "Worauf es beim Produkt ankommt"
export const DETAIL_TITLE_FIT = "Warum das zu deinem Haar passt"
export const DETAIL_TITLE_FREQUENCY = "Empfohlener Rhythmus"

export type CategoryPresentation = {
  targetType: string
  purpose: string
  productCriteria: string
  fit: string
}

export function isStage1Category(value: unknown): value is Stage1Category {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, value)
}

function displayFrequencyValue(value: ProductFrequency): string {
  return PRODUCT_FREQUENCY_LABELS[value].replace("x/", "×/")
}

export function frequencyLabel(frequency: PlanFrequencyTarget | null, paused: boolean): string {
  const prefix = paused ? "später: " : ""
  if (!frequency) return paused ? "später: nach Klärung" : "wird im nächsten Schritt verfeinert"

  switch (frequency.kind) {
    case "wet_wash_total":
      return `${prefix}${displayFrequencyValue(frequency.target)}`
    case "after_each_eligible_wash":
      return `${prefix}nach jeder Haarwäsche`
    case "event_based":
      return `${prefix}vor jeder passenden Hitze-Anwendung`
    case "every_nth_wash":
      return `${prefix}jede ${frequency.every}. Haarwäsche`
    case "unscheduled_as_needed":
      return `${prefix}bei Bedarf`
    case "mask_regular_interval":
      if (frequency.baseInterval === "weekly_1x") return `${prefix}1× pro Woche`
      if (frequency.baseInterval === "biweekly_1x") return `${prefix}etwa alle 2 Wochen`
      return `${prefix}etwa alle 3 Wochen`
    case "role_based_wash_linked":
      return `${prefix}nach Bedarf`
    case "product_protocol_course":
      return `${prefix}nach Herstellerangabe`
    case "role_keyed_product_protocol":
      return `${prefix}nach Herstellerangabe`
  }
}

const ROLE_CADENCE_LABELS: Record<string, string> = {
  before_every_compatible_wash: "vor jeder passenden Haarwäsche",
  after_every_compatible_wash: "nach jeder passenden Haarwäsche",
  finish_after_every_compatible_wash: "als Finish nach jeder Haarwäsche",
  optional_allocation_deferred_to_day_type: "nach Bedarf",
}

/**
 * Role-scoped cadence copy for categories whose frequency is
 * `role_based_wash_linked` (oil today): each role has its own cadence, unlike
 * the category-level `frequencyLabel`, which only has one generic sentence
 * ("nach Bedarf") for the whole category. Falls back to `frequencyLabel` for
 * every other frequency kind and for a role this frequency doesn't cover.
 */
export function roleFrequencyLabel(
  frequency: PlanFrequencyTarget | null,
  role: string,
  paused: boolean,
): string {
  if (frequency?.kind === "role_based_wash_linked") {
    const entry = frequency.roleFrequencies.find((candidate) => candidate.role === role)
    const label = entry ? ROLE_CADENCE_LABELS[entry.cadence] : undefined
    if (label) return `${paused ? "später: " : ""}${label}`
  }
  return frequencyLabel(frequency, paused)
}

export function presentationFor(decision: PlanCategoryDecision): CategoryPresentation | null {
  if (!decision.target || !isStage1Category(decision.target.category)) return null

  if (decision.executionState === "paused") {
    return {
      targetType: "Aktuell nicht anwenden",
      purpose: "Die Kategorie kann sinnvoll sein, soll aber gerade pausieren.",
      productCriteria: "Die Anwendung setzt voraus, dass die pausierende Bedingung geklärt ist.",
      fit: "Deine Haaranalyse zeigt einen möglichen Bedarf, aber auch einen Grund für Vorsicht.",
    }
  }

  switch (decision.target.category) {
    case "shampoo": {
      const dandruffSentence = decision.target.requiresTargetedDandruffCapability
        ? " Außerdem soll das Shampoo gezielt gegen Schuppen arbeiten."
        : ""
      if (decision.target.everydayConstraint.includes("irritation")) {
        return {
          targetType: "Sanft reinigend",
          purpose:
            "Entfernt Talg und Rückstände, ohne deine empfindliche Kopfhaut unnötig zu reizen.",
          productCriteria: "Sanft und zuverlässig reinigen, ohne stark entfettend zu sein.",
          fit: `Deine Kopfhaut reagiert empfindlich. Deshalb eine sanfte Reinigung, die auf unnötige Reizstoffe verzichtet.${dandruffSentence}`,
        }
      }
      const scalpFit: Record<typeof decision.target.scalpRoute, string> = {
        oily: "Deine Kopfhaut fettet schneller nach. Deshalb eine ausgleichende Reinigung, die Talg zuverlässig mitnimmt, ohne die Kopfhaut zu reizen.",
        dry: "Deine Kopfhaut ist eher trocken. Deshalb eine milde Reinigung, die ihr nicht zusätzlich Fett entzieht.",
        balanced:
          "Deine Kopfhaut ist im Gleichgewicht. Deshalb eine Reinigung, die genau das erhält – nicht zu mild, nicht zu stark.",
      }
      return {
        targetType:
          decision.target.scalpRoute === "balanced"
            ? "Ausgeglichen reinigend"
            : "Ausgleichend reinigend",
        purpose: "Reinigt passend zu deiner Kopfhaut und deiner Haaranalyse.",
        productCriteria: "Ausgeglichen reinigen, ohne unnötig stark zu entfetten.",
        fit: `${scalpFit[decision.target.scalpRoute]}${dandruffSentence}`,
      }
    }
    case "conditioner":
      return {
        targetType: decision.target.weight === "light" ? "Leicht pflegend" : "Pflegend",
        purpose: "Glättet deine Längen nach der Wäsche, ohne unnötig zu beschweren.",
        productCriteria: "Pflege, Glättung und Kämmbarkeit passend zum Gewicht deines Haars.",
        fit: "Deine Längen brauchen nach der Wäsche eine verlässliche Basispflege.",
      }
    case "leave_in":
      return {
        targetType: "Leicht schützend",
        purpose: "Gibt deinen Längen zusätzlichen Schutz vor Trockenheit und Reibung.",
        productCriteria: "Leicht pflegen, die Oberfläche glätten und vor Alltagsreibung schützen.",
        fit: "Deine Längen brauchen mehr als nur ausspülbare Pflege.",
      }
    case "mask":
      return {
        targetType: "Intensive Pflege",
        purpose: "Ergänzt deine normale Pflege, wenn die Längen mehr Unterstützung brauchen.",
        productCriteria: "Konzentrierte Pflege in einer passenden Pflegerichtung liefern.",
        fit: "Deine Haaranalyse zeigt einen erhöhten Pflegebedarf in den Längen.",
      }
    case "oil":
      return {
        targetType: decision.target.roles.includes("pre_wash_fibre_treatment")
          ? "Reichhaltige Vorwäsche"
          : "Leichtes Finish",
        purpose: "Glättet Frizz und gibt Glanz, ohne unnötig zu beschweren.",
        productCriteria: "Mit kleiner Dosierung glätten und Glanz geben, ohne schwer zu wirken.",
        fit: "Deine raueren Spitzen und dein Frizz profitieren von einem gezielten Finish.",
      }
    case "dry_shampoo":
      return {
        targetType: "Sensitives Aerosol",
        purpose:
          "Überbrückt einen fettigeren Ansatz, wenn du keinen zusätzlichen Waschtag möchtest.",
        productCriteria:
          "Öl am Ansatz aufnehmen und sich ohne starken sichtbaren Rückstand ausarbeiten lassen.",
        fit: "Dein Ansatz kann vor dem nächsten geplanten Waschtag nachfetten.",
      }
    case "bondbuilder":
      const hasChemicalTreatmentReason = decision.reasons.some((reason) =>
        reason.evidence.some((evidence) => evidence.key === "chemicalTreatments"),
      )
      return {
        targetType: "Gezielter Strukturschutz",
        purpose: "Unterstützt beanspruchte Längen gezielter als normale Pflege allein.",
        productCriteria: hasChemicalTreatmentReason
          ? "Spezialisierte Strukturpflege für chemisch beanspruchtes Haar bieten."
          : "Spezialisierte Strukturpflege für strukturell beanspruchte Längen bieten.",
        fit: hasChemicalTreatmentReason
          ? "Deine chemische Behandlung macht gezielte Strukturpflege sinnvoll."
          : "Deine beobachteten Haarsignale machen gezielte Strukturpflege sinnvoll.",
      }
    case "deep_cleansing_shampoo":
      return {
        targetType: "Tiefenreinigender Reset",
        purpose: "Entfernt Rückstände, wenn normale Reinigung dafür nicht ausreicht.",
        productCriteria: "Rückstände gezielt lösen, ohne den regelmäßigen Reiniger zu ersetzen.",
        fit: "Der Reset ergänzt deine normale Haarwäsche nur bei Bedarf.",
      }
    case "heat_protectant":
      return {
        targetType: "Hitzeschutz vor Styling",
        purpose: "Schützt dein Haar vor passenden Hitze-Ereignissen.",
        productCriteria:
          "Vor jeder passenden Hitze-Anwendung eine verlässliche Schutzschicht bieten.",
        fit: "Deine Styling-Angaben bestimmen, wann dieser Schutz relevant wird.",
      }
    case "scalp_care":
      return {
        targetType: "Gezielte Kopfhautpflege",
        purpose: "Kann deine Kopfhaut zusätzlich unterstützen, ohne Shampoo zu ersetzen.",
        productCriteria:
          "Gezielt auf Kopfhautkomfort arbeiten und nicht als Haarlängenpflege auftreten.",
        fit: "Deine Kopfhaut-Angaben machen eine zusätzliche Unterstützung sinnvoll.",
      }
  }
}
