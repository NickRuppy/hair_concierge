import { PRODUCT_FREQUENCY_LABELS, type ProductFrequency } from "@/lib/vocabulary/frequencies"
import type {
  InitialNeedPlanSnapshot,
  InitialProductPreview,
  PlanCategoryDecision,
  PlanFrequencyTarget,
  PlanProductRole,
  Stage1Category,
} from "@/lib/personal-plan/types"

import type { NeedCardViewModel } from "./need-card"
import type { NeedPlanScreenViewModel } from "./need-plan-screen"
import type { PlanStartReadyViewModel } from "./plan-start-flow"

const CATEGORY_LABELS: Record<Stage1Category, string> = {
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

const CATEGORY_EXAMPLE_IMAGES = {
  shampoo:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-04/1ef2be82-259c-4a1f-af2e-3ac3403f9731/37-1ef2be82-259c-4a1f-af2e-3ac3403f9731-salthouse-salthouse-anti-juckreiz-d55447789e9c.webp",
  conditioner:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/pilot-2026-06-10/007a0b35-2372-4836-9aa5-fd089cd588d4/05-007a0b35-2372-4836-9aa5-fd089cd588d4-balea-balea-natural-beauty-hibiskus-78479c0a7a2f.webp",
  leave_in:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-02/5dc2fae3-a0ca-4e6c-9c30-02dd192772f0/16-5dc2fae3-a0ca-4e6c-9c30-02dd192772f0-gliss-gliss-ultimate-repair-spruh-conditioner-e4d12ef3de4d.webp",
  heat_protectant:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-enrichment/personal-plan-launch-v1/heat/jean-len-beat-the-heat-100ml/manufacturer-front.webp",
  oil: "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-03/4a95e1de-54e9-4fcd-b227-72a5824d13c1/11-4a95e1de-54e9-4fcd-b227-72a5824d13c1-dr-scheller-dr-scheller-jojobaol-18ac55078631.webp",
  mask: "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-02/9e1442c9-4ab8-4819-a851-66859a98ed80/13-9e1442c9-4ab8-4819-a851-66859a98ed80-fructis-fructis-hair-food-papaya-00daf3210708.webp",
  scalp_care:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-01/6b01025d-9e72-4514-b42e-bbb6065fbe1c/13-6b01025d-9e72-4514-b42e-bbb6065fbe1c-elvital-elvital-ol-magique-midnight-serum-ae5a315dc466.webp",
  dry_shampoo:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-05/786a1396-914e-4739-a32c-1c3ead39a3d1/03-786a1396-914e-4739-a32c-1c3ead39a3d1-batiste-trockenshampoo-original-43040f50c097.webp",
  bondbuilder:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/pilot-2026-06-10/38dace91-0fba-49ee-a93f-ac36e488fe4b/17-38dace91-0fba-49ee-a93f-ac36e488fe4b-k18-k18-leave-in-molecular-repair-hair-mask-8595971dcd08.webp",
  deep_cleansing_shampoo:
    "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-additions/2026-07-03/deep-cleansing/balea-professional-shampoo-tiefenreinigung.webp",
} satisfies Record<Stage1Category, string>

const ROLE_PILLS: Partial<Record<PlanProductRole, string>> = {
  shampoo_everyday: "sanft",
  shampoo_dandruff: "Kopfhaut",
  conditioner_rinse_out: "leichte Pflege",
  post_wash_leave_in: "Schutz & Glättung",
  pre_heat_application: "vor Hitze",
  intensive_conditioning_mask: "intensiv",
  pre_wash_fibre_treatment: "Vorwäsche",
  leave_on_fibre_conditioning: "Längenpflege",
  dry_finish: "Finish & Glanz",
  residue_reset: "Reset",
  mineral_reset: "Mineral-Reset",
  root_refresh_bridge: "Ansatz auffrischen",
  pre_heat_protection: "Hitzeschutz",
  specialized_bond_treatment: "Strukturpflege",
  scalp_comfort: "Kopfhautkomfort",
  scalp_flake_oil_adjunct: "Schuppen & Öl",
  density_claim_tonic: "begrenzte Evidenz",
  scalp_exfoliant: "Kopfhaut-Reset",
}

const DETAIL_TITLE_PRODUCT = "Worauf es beim Produkt ankommt"
const DETAIL_TITLE_FIT = "Warum das zu deinem Haar passt"
const DETAIL_TITLE_FREQUENCY = "Empfohlener Rhythmus"

type CategoryPresentation = {
  targetType: string
  purpose: string
  productCriteria: string
  fit: string
}

function hasOwn<T extends object, K extends PropertyKey>(
  value: T,
  key: K,
): value is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function isStage1Category(value: unknown): value is Stage1Category {
  return typeof value === "string" && hasOwn(CATEGORY_LABELS, value)
}

function isInitialProductPreview(value: unknown): value is InitialProductPreview {
  if (!isRecord(value) || !isStage1Category(value.category)) return false
  if (value.state === "absent") return typeof value.reason === "string"
  return (
    value.state === "selected" && typeof value.imageUrl === "string" && value.imageUrl.length > 0
  )
}

function displayFrequencyValue(value: ProductFrequency): string {
  return PRODUCT_FREQUENCY_LABELS[value].replace("x/", "×/")
}

function frequencyLabel(frequency: PlanFrequencyTarget | null, paused: boolean): string | null {
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

function presentationFor(decision: PlanCategoryDecision): CategoryPresentation | null {
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
    case "shampoo":
      if (decision.target.everydayConstraint.includes("irritation")) {
        return {
          targetType: "Sanft reinigend",
          purpose:
            "Entfernt Talg und Rückstände, ohne deine empfindliche Kopfhaut unnötig zu reizen.",
          productCriteria: "Sanft und zuverlässig reinigen, ohne stark entfettend zu sein.",
          fit: "Deine Kopfhaut braucht deshalb eine sanfte Reinigungsrichtung.",
        }
      }
      return {
        targetType:
          decision.target.scalpRoute === "balanced"
            ? "Ausgeglichen reinigend"
            : "Ausgleichend reinigend",
        purpose: "Reinigt passend zu deiner Kopfhaut und deiner Haaranalyse.",
        productCriteria: "Ausgeglichen reinigen, ohne unnötig stark zu entfetten.",
        fit: "Deine Kopfhaut-Angaben bestimmen die Reinigungsrichtung.",
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

function cardFromDecision(decision: PlanCategoryDecision): NeedCardViewModel | null {
  if (decision.needTier !== "basis" && decision.needTier !== "optional") return null
  if (decision.resolution === "deferred_until_post_plan_onboarding") return null
  if (!decision.target || decision.target.category !== decision.category) return null

  const presentation = presentationFor(decision)
  if (!presentation) return null

  const cadence = frequencyLabel(decision.frequency, decision.executionState === "paused")
  if (!cadence) return null

  const pills = decision.roles
    .map((role) => ROLE_PILLS[role])
    .filter((pill): pill is string => Boolean(pill))

  return {
    id: decision.category,
    tone: decision.needTier,
    categoryLabel: CATEGORY_LABELS[decision.category],
    statusLabel:
      decision.executionState === "paused"
        ? "Pausiert"
        : decision.needTier === "basis"
          ? "Basis"
          : "Optional",
    targetType: presentation.targetType,
    purpose: presentation.purpose,
    pills: [...new Set(pills)].slice(0, 2),
    frequency: cadence,
    imageUrl: CATEGORY_EXAMPLE_IMAGES[decision.category] ?? null,
    imageAlt: `Beispielbild für ${CATEGORY_LABELS[decision.category]}; kein ausgewähltes Produkt.`,
    paused: decision.executionState === "paused",
    detailBlocks: [
      { title: DETAIL_TITLE_PRODUCT, body: presentation.productCriteria },
      { title: DETAIL_TITLE_FIT, body: presentation.fit },
      { title: DETAIL_TITLE_FREQUENCY, body: cadence },
    ],
  }
}

function screenFor(
  kind: "basis" | "optional",
  cards: NeedCardViewModel[],
  hasOptionalPage: boolean,
): NeedPlanScreenViewModel {
  const countLabel =
    kind === "basis"
      ? `${cards.length} ${cards.length === 1 ? "Kategorie" : "Kategorien"}`
      : `${cards.length} ${cards.length === 1 ? "Vorschlag" : "Vorschläge"}`

  return {
    kind,
    overline: kind === "basis" ? "Dein persönlicher Plan" : "Optionale Empfehlungen",
    title: kind === "basis" ? "Deine Basis" : "Zusätzlich sinnvoll",
    lead:
      kind === "basis"
        ? "Basierend auf deiner Haaranalyse sind das die Grundlagen für deine Routine."
        : "Basierend auf deiner Haaranalyse können diese Ergänzungen deine Ziele zusätzlich unterstützen.",
    sectionTitle: kind === "basis" ? "Von uns klar empfohlen" : "Für deine Ziele",
    countLabel,
    progress: kind === "basis" && hasOptionalPage ? 50 : 100,
    cards,
  }
}

function asInitialNeedPlanSnapshot(value: unknown): InitialNeedPlanSnapshot | null {
  if (!isRecord(value)) return null
  if (value.schemaVersion !== 1 || value.snapshotKind !== "initial_need") return null
  if (!Array.isArray(value.decisions) || !Array.isArray(value.renderedOrder)) return null
  if (!Array.isArray(value.productPreviews)) return null
  if (!value.renderedOrder.every(isStage1Category)) return null
  if (!value.productPreviews.every(isInitialProductPreview)) return null
  if (
    !value.decisions.every(
      (decision) =>
        isRecord(decision) &&
        isStage1Category(decision.category) &&
        (decision.needTier === "basis" ||
          decision.needTier === "optional" ||
          decision.needTier === "not_needed" ||
          decision.needTier === null) &&
        (decision.executionState === "available" || decision.executionState === "paused"),
    )
  ) {
    return null
  }
  return value as InitialNeedPlanSnapshot
}

export function adaptInitialNeedSnapshotToPlanStartViewModel(
  value: unknown,
): PlanStartReadyViewModel | null {
  const snapshot = asInitialNeedPlanSnapshot(value)
  if (!snapshot) return null

  let cards: Array<NeedCardViewModel | null>
  try {
    cards = snapshot.renderedOrder.map((category) => {
      const decision = snapshot.decisions.find((candidate) => candidate.category === category)
      if (!decision) return null
      return cardFromDecision(decision)
    })
  } catch {
    return null
  }
  if (cards.some((card) => card === null)) return null

  const basisCards = cards.filter((card): card is NeedCardViewModel => card?.tone === "basis")
  const optionalCards = cards.filter((card): card is NeedCardViewModel => card?.tone === "optional")
  if (basisCards.length === 0) return null

  const pausedOnlyOptional = optionalCards.length > 0 && optionalCards.every((card) => card.paused)
  const visibleBasisCards = pausedOnlyOptional ? [...basisCards, ...optionalCards] : basisCards
  const visibleOptionalCards = pausedOnlyOptional ? [] : optionalCards
  const hasOptionalPage = visibleOptionalCards.length > 0
  return {
    basis: screenFor("basis", visibleBasisCards, hasOptionalPage),
    optional: hasOptionalPage ? screenFor("optional", visibleOptionalCards, hasOptionalPage) : null,
  }
}
