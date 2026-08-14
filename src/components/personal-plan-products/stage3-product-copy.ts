import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import type { PlanProductRole } from "@/lib/personal-plan/types"

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
