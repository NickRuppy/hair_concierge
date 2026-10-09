import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import type { BudgetCandidateView, BudgetNotice } from "@/lib/personal-plan/products/budget-policy"
import type { PlanProductRole } from "@/lib/personal-plan/types"
import type { ShoppingBudget } from "@/lib/user-facts/schema"

export const CATEGORY_COPY: Record<
  PersonalPlanCategory,
  { label: string; need: string; selectionHeading: string }
> = {
  shampoo: {
    label: "Shampoo",
    need: "Reinigung passend zu deiner Kopfhaut",
    selectionHeading: "Wähle dein Shampoo",
  },
  conditioner: {
    label: "Conditioner",
    need: "Pflege nach jeder Wäsche",
    selectionHeading: "Wähle deinen Conditioner",
  },
  leave_in: {
    label: "Leave-in",
    need: "Pflege, die im Haar bleibt",
    selectionHeading: "Wähle dein Leave-in",
  },
  heat_protectant: {
    label: "Hitzeschutz",
    need: "Schutz bei Styling mit Hitze",
    selectionHeading: "Wähle deinen Hitzeschutz",
  },
  oil: {
    label: "Öl",
    need: "Schutz und Finish für deine Längen",
    selectionHeading: "Wähle dein Öl",
  },
  mask: {
    label: "Maske",
    need: "Zusätzliche intensive Pflege",
    selectionHeading: "Wähle deine Maske",
  },
  scalp_care: {
    label: "Kopfhautprodukt",
    need: "Beruhigende Pflege für deine Kopfhaut",
    selectionHeading: "Wähle dein Kopfhautprodukt",
  },
  dry_shampoo: {
    label: "Trockenshampoo",
    need: "Frische zwischen den Haarwäschen",
    selectionHeading: "Wähle dein Trockenshampoo",
  },
  bondbuilder: {
    label: "Bondbuilder",
    need: "Unterstützung für beanspruchtes Haar",
    selectionHeading: "Wähle deinen Bondbuilder",
  },
  deep_cleansing_shampoo: {
    label: "Tiefenreinigung",
    need: "Gezielte Entfernung von Rückständen",
    selectionHeading: "Wähle deine Tiefenreinigung",
  },
}

export function categorySelectionHeading(categoryLabel: string): string {
  return (
    Object.values(CATEGORY_COPY).find((category) => category.label === categoryLabel)
      ?.selectionHeading ?? `Wähle dein ${categoryLabel || "Produkt"}`
  )
}

/** The oil roles from `getCategoryRolePolicy("oil").allowedRoles`. */
export type OilUseCaseRole =
  | "pre_wash_fibre_treatment"
  | "leave_on_fibre_conditioning"
  | "dry_finish"

export type OilUseCaseCopy = {
  /** Row title on the grouped Öl screen. */
  title: string
  /** Row subtitle on the grouped Öl screen. */
  subtitle: string
  /** Scope suffix for the follow-up heading: `Wähle dein Öl ${scopePhrase}`. */
  scopePhrase: string
  /** Short form used in the follow-up screen's committed-for context line, e.g. "Vorwäsche". */
  shortLabel: string
}

export const OIL_USE_CASE_COPY: Record<OilUseCaseRole, OilUseCaseCopy> = {
  pre_wash_fibre_treatment: {
    title: "Vor der Haarwäsche",
    subtitle: "Als Pflege vor dem Waschen",
    scopePhrase: "für die Vorwäsche",
    shortLabel: "Vorwäsche",
  },
  leave_on_fibre_conditioning: {
    title: "Im feuchten Haar",
    subtitle: "Nach dem Waschen, bleibt im Haar",
    scopePhrase: "fürs feuchte Haar",
    shortLabel: "Feuchtes Haar",
  },
  dry_finish: {
    title: "Im trockenen Haar",
    subtitle: "Für Glanz und Finish",
    scopePhrase: "fürs trockene Haar",
    shortLabel: "Trockenes Haar",
  },
}

export function oilUseCaseCopy(role: PlanProductRole): OilUseCaseCopy | null {
  return OIL_USE_CASE_COPY[role as OilUseCaseRole] ?? null
}

export const ROLE_COPY: Record<PlanProductRole, { label: string; description: string }> = {
  shampoo_everyday: { label: "Hauptreinigung", description: "Für deine regelmäßige Haarwäsche" },
  shampoo_dandruff: { label: "Gezielte Reinigung", description: "Als gezielte Ergänzung" },
  conditioner_rinse_out: { label: "Pflege nach der Wäsche", description: "Zum Ausspülen" },
  post_wash_leave_in: { label: "Pflege im feuchten Haar", description: "Nach der Haarwäsche" },
  pre_heat_application: { label: "Vor dem Styling", description: "Vor Wärme im Haar" },
  intensive_conditioning_mask: { label: "Intensivpflege", description: "Als auswaschbare Pflege" },
  pre_wash_fibre_treatment: {
    label: "Vor der Haarwäsche",
    description: "Als Pflege vor dem Waschen",
  },
  leave_on_fibre_conditioning: {
    label: "Im feuchten Haar",
    description: "Nach dem Waschen im feuchten Haar",
  },
  dry_finish: { label: "Im trockenen Haar", description: "Für Glanz und Finish" },
  residue_reset: { label: "Rückstände lösen", description: "Bei Bedarf" },
  mineral_reset: { label: "Mineralrückstände lösen", description: "Bei Bedarf" },
  root_refresh_bridge: { label: "Ansatz auffrischen", description: "Zwischen Haarwäschen" },
  pre_heat_protection: { label: "Schutz vor Stylinghitze", description: "Vor Hitze" },
  specialized_bond_treatment: { label: "Bondpflege", description: "Nach Herstellerangabe" },
  scalp_comfort: { label: "Kopfhaut beruhigen", description: "Für ein ruhigeres Hautgefühl" },
  scalp_flake_oil_adjunct: {
    label: "Schuppen kontrollieren",
    description: "Bei sichtbaren Schuppen",
  },
  density_claim_tonic: { label: "Kopfhaut-Tonic", description: "Mit begrenzter Evidenz" },
  scalp_exfoliant: { label: "Kopfhaut klären", description: "Bei Bedarf" },
}

/* ---------------------------------------------------------------- budget */

/** A saved package-price budget, as the shopping-preferences door stores it. */
export type Stage3ShoppingBudget = ShoppingBudget
export type Stage3BudgetNotice = BudgetNotice
export type Stage3BudgetLabelKind = BudgetCandidateView["label"]

export const STAGE3_BUDGET_COPY = {
  eyebrow: "Dein Budget",
  question: "Was darf ein Pflegeprodukt ungefähr kosten?",
  helper: "Preis pro Packung – gilt für jedes Produkt deiner Routine.",
  limitOptions: [
    { value: 5, label: "Bis 5 €" },
    { value: 15, label: "Bis 15 €" },
    { value: "uncapped", label: "Keine feste Preisgrenze" },
  ],
  suggestionChip: "Wie deine bisherigen Produkte",
  strictOption: {
    label: "Ja, für jedes.",
    description: "Teurere zeigen wir nur, wenn es im Budget kaum Passendes gibt.",
  },
  flexibleOption: {
    label: "Einzelne dürfen mehr kosten.",
    description: "Nur einzelne – wenn sie deutlich besser passen.",
  },
  continueLabel: "Weiter",
  retryLabel: "Erneut versuchen",
  conflictRetryLabel: "Meine Auswahl speichern",
  unavailableMessage: "Nicht gespeichert. Deine Auswahl bleibt erhalten.",
  conflictMessage:
    "Dein Budget wurde gerade an anderer Stelle geändert. Deine Auswahl ist noch nicht gespeichert.",
  editLabel: "Ändern",
  overBudgetBadge: "Über deinem Budget",
} as const

export const STAGE3_BUDGET_LIMIT_OPTIONS = STAGE3_BUDGET_COPY.limitOptions

/** „Bis 15 € für jedes Produkt?“ — the follow-up for a capped answer. */
export function budgetFlexibilityQuestion(limitEur: 5 | 15): string {
  return `Bis ${limitEur} € für jedes Produkt?`
}

/** The value of the compact budget line above a budgeted comparison (without the „Budget:“ lead). */
export function budgetLineValue(budget: Stage3ShoppingBudget): string {
  if (budget.kind === "uncapped") return "Ohne feste Preisgrenze"
  return budget.allowExceptions
    ? `Bis ${budget.limitEur} € · einzelne dürfen mehr kosten`
    : `Bis ${budget.limitEur} € für jedes Produkt`
}

/** Card label for a budgeted alternative; `null` keeps the card's existing label. */
export function budgetCardLabel(labelKind: Stage3BudgetLabelKind | undefined): string | null {
  if (labelKind === "within_budget") return "Im Budget"
  if (labelKind === "recommended") return "Empfohlen"
  if (labelKind === "alternative") return "Alternative"
  return null
}

const BUDGET_DIMENSION_LABELS: Record<string, string> = {
  "conditioner.weight": "Pflegegewicht",
  "mask.weight": "Pflegegewicht",
  "leave_in.weight": "Pflegegewicht",
  "oil.weight": "Pflegegewicht",
  "conditioner.repair_support": "Repair-Unterstützung",
  "mask.repair_support": "Repair-Unterstützung",
  "leave_in.repair_support": "Repair-Unterstützung",
}

/** German dative preposition + article for the dimension labels the budget can name. */
function withDativePreposition(label: string): string {
  if (label === "Pflegegewicht") return `beim ${label}`
  if (label === "Repair-Unterstützung") return `bei der ${label}`
  return `bei ${label}`
}

/**
 * The info notice a budgeted comparison carries. Returns `null` when the notice needs a value
 * the client does not have (the saved limit, or an improved dimension's label).
 */
export function budgetNoticeCopy(input: {
  notice: Stage3BudgetNotice
  budget: Stage3ShoppingBudget | null
  improvedDimensionIds?: readonly string[]
  /** Label lookup from the comparison's own evidence rows (rowId = dimensionId). */
  dimensionLabel?: (dimensionId: string) => string | null
}): string | null {
  const limit = input.budget?.kind === "capped" ? input.budget.limitEur : null
  switch (input.notice) {
    case "strict_none_affordable":
      return limit === null
        ? null
        : `Bis ${limit} € gibt es hier nichts, das zu deinem Haar passt. Du kannst eine teurere Option wählen oder ohne neues Produkt weitergehen.`
    case "strict_one_affordable":
      return limit === null
        ? null
        : `Nur eine passende Option bis ${limit} €. Weitere Optionen liegen über deinem Budget.`
    case "flex_gap":
      return limit === null
        ? null
        : `Bis ${limit} € gibt es hier nichts Passendes. Diese Option liegt darüber.`
    case "allowance_used_elsewhere":
      return "Ein Produkt liegt schon über deinem Budget. Hier bleiben wir im Budget."
    case "flex_improvement": {
      const dimensionId = input.improvedDimensionIds?.[0]
      if (!dimensionId) return null
      const label = input.dimensionLabel?.(dimensionId) ?? BUDGET_DIMENSION_LABELS[dimensionId]
      if (!label) return null
      return `Passt ${withDativePreposition(label)} deutlich besser als die Option im Budget.`
    }
  }
}
