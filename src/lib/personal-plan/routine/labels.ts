// Shared German copy for Routine category/purpose labels. Kept as a plain module (no "use
// client" pragma, no UI imports) so it can be imported both by client Routine UI components
// (src/components/routine/personal-plan/routine-item-card.tsx) and by server-only API routes
// that need the same label vocabulary without pulling in Button/Card/lucide-react.

import type { Stage3DecisionDeferralReason } from "../products/contracts"

const purposeLabels: Record<string, string> = {
  shampoo_everyday: "Regelmäßige Reinigung",
  shampoo_dandruff: "Schuppenpflege",
  conditioner_rinse_out: "Pflege nach der Reinigung",
  post_wash_leave_in: "Pflege ohne Ausspülen",
  pre_heat_application: "Pflege vor dem Hitzestyling",
  intensive_conditioning_mask: "Intensivpflege",
  pre_wash_fibre_treatment: "Pflege vor der Haarwäsche",
  leave_on_fibre_conditioning: "Pflege ohne Ausspülen",
  dry_finish: "Finish",
  residue_reset: "Tiefenreinigung",
  mineral_reset: "Mineralablagerungen entfernen",
  root_refresh_bridge: "Ansatz auffrischen",
  pre_heat_protection: "Hitzeschutz",
  specialized_bond_treatment: "Strukturpflege",
  scalp_comfort: "Kopfhaut beruhigen",
  scalp_flake_oil_adjunct: "Kopfhautöl als Ergänzung",
  density_claim_tonic: "Kopfhaut-Tonic",
  scalp_exfoliant: "Kopfhaut-Peeling",
}

/**
 * One sentence per role saying what that role does. Shared with the Stage-1
 * plan-start cards: a category with several roles renders one card per role,
 * and the secondary card needs role-level copy instead of the category-level
 * presentation (`decision-presentation.ts`), which is identical for all roles
 * of a category.
 */
const purposeDescriptions: Record<string, string> = {
  shampoo_everyday: "Regelmäßige Reinigung für deine Kopfhaut.",
  shampoo_dandruff: "Hilft, deine Kopfhautpflege gezielter einzuplanen.",
  conditioner_rinse_out: "Pflegt und entwirrt die Längen nach der Haarwäsche.",
  post_wash_leave_in: "Gibt den Längen Pflege, die im Haar bleibt.",
  pre_heat_application: "Bereitet die Längen auf Hitze-Styling vor.",
  intensive_conditioning_mask: "Gibt den Längen eine intensive, auswaschbare Pflegeeinheit.",
  pre_wash_fibre_treatment: "Pflegt die Längen vor der Haarwäsche.",
  leave_on_fibre_conditioning: "Bleibt im Haar und ergänzt die Pflege nach der Wäsche.",
  dry_finish: "Schließt die Routine als Finish für die Längen ab.",
  residue_reset: "Entfernt Rückstände, wenn die Routine einen Reset braucht.",
  mineral_reset: "Hilft gegen mineralische Ablagerungen in den Längen.",
  root_refresh_bridge: "Frischt den Ansatz zwischen Haarwäschen auf.",
  pre_heat_protection: "Schützt dein Haar vor passender Hitze-Anwendung.",
  specialized_bond_treatment: "Ergänzt die Routine, wenn Strukturpflege sinnvoll ist.",
  scalp_comfort: "Beruhigt die Kopfhaut, wenn sie zusätzliche Pflege braucht.",
  scalp_flake_oil_adjunct: "Ergänzt die Kopfhautpflege punktuell.",
  density_claim_tonic: "Unterstützt die Kopfhautpflege als Leave-on-Schritt.",
  scalp_exfoliant: "Löst Schuppen und Rückstände kontrolliert von der Kopfhaut.",
}

const categoryLabels: Record<string, string> = {
  shampoo: "Shampoo",
  conditioner: "Conditioner",
  mask: "Maske",
  oil: "Öl",
  leave_in: "Leave-in",
  heat_protectant: "Hitzeschutz",
  scalp_care: "Kopfhautpflege",
  dry_shampoo: "Trockenshampoo",
  bondbuilder: "Bondbuilder",
  deep_cleansing_shampoo: "Tiefenreinigendes Shampoo",
}

function labelFor(labels: Record<string, string>, value: string) {
  return labels[value] ?? value.replaceAll("_", " ")
}

export function routinePurposeLabel(value: string) {
  return labelFor(purposeLabels, value)
}

export function routineCategoryLabel(value: string) {
  return labelFor(categoryLabels, value)
}

/** `null` when the role has no dedicated sentence — callers own the fallback. */
export function routineRolePurposeDescription(value: string): string | null {
  return purposeDescriptions[value] ?? null
}

export type RoutineDeferralCopy = {
  text: string
  /** Module-1 entry (Feinschliff `products`) — a first visit or an edit visit. */
  href: string | null
}

/**
 * Exact reason-specific copy for a deferred-role placeholder step (Task 2.2).
 * Only `refinement_required` (first visit) and `unseen_recommendation` (edit
 * re-entry into the finished module) link into Modul 1 — `no_product` and
 * `preview_unavailable` are facts about the catalog/engine, not something a
 * refinement pass fixes.
 */
const deferralCopy: Record<Stage3DecisionDeferralReason, RoutineDeferralCopy> = {
  refinement_required: {
    text: "Empfehlung folgt — 2 Min. im Feinschliff.",
    href: "/plan-start?refine=products",
  },
  no_product: {
    text: "Für diese Kategorie haben wir noch kein passendes Produkt.",
    href: null,
  },
  preview_unavailable: {
    text: "Empfehlung wird geprüft.",
    href: null,
  },
  unseen_recommendation: {
    text: "Neue Empfehlung für diesen Baustein — ansehen.",
    href: "/plan-start?refine=products",
  },
}

export function routineDeferralCopyFor(reason: Stage3DecisionDeferralReason): RoutineDeferralCopy {
  return deferralCopy[reason]
}
