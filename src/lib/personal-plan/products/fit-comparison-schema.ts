import type { PlanProductRole } from "@/lib/personal-plan/types"

import type { PersonalPlanCategory } from "./contracts"

export type CompactCriterionSchemaItem = { criterionId: string; label: string }

export function compactCriterionSchema(
  category: PersonalPlanCategory,
  role: PlanProductRole,
): readonly CompactCriterionSchemaItem[] {
  switch (category) {
    case "shampoo":
      return role === "shampoo_dandruff"
        ? [{ criterionId: "shampoo.fit", label: "Shampoo-Passung" }]
        : []
    case "heat_protectant":
      return [{ criterionId: "heat_protectant.capability", label: "Verifizierter Hitzeschutz" }]
    case "scalp_care":
      return [
        { criterionId: "scalp_care.role.exact_match", label: "Exakte Kopfhautpflege-Rolle" },
        { criterionId: "scalp_care.format.verified", label: "Verifiziertes Format" },
        { criterionId: "scalp_care.protocol.verified", label: "Verifizierte Anwendung" },
      ]
    case "dry_shampoo":
      return [
        { criterionId: "dry_shampoo.identity.active", label: "Aktive Produktidentität" },
        {
          criterionId: "dry_shampoo.sensitivity.verified",
          label: "Kopfhautverträglichkeit",
        },
        { criterionId: "dry_shampoo.protocol.verified", label: "Verifizierte Anwendung" },
      ]
    case "bondbuilder":
      return [
        { criterionId: "bondbuilder.thickness", label: "Haarstärke" },
        { criterionId: "bondbuilder.relationship", label: "Rollenbeziehung" },
        { criterionId: "bondbuilder.protocol", label: "Kritisches Protokoll" },
      ]
    case "deep_cleansing_shampoo":
      return [
        { criterionId: "deep_cleansing.reset_role", label: "Reset-Rolle" },
        { criterionId: "deep_cleansing.protocol", label: "Anwendungsprotokoll" },
      ]
    case "conditioner":
    case "leave_in":
    case "mask":
    case "oil":
      return []
  }
}
