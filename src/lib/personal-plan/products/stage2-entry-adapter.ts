import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"

import { CATEGORY_ROLE_POLICIES } from "./authorities"
import type { PersonalPlanCategory, Stage3EntryContext } from "./contracts"

const NEED_SUMMARIES: Record<PersonalPlanCategory, string> = {
  shampoo: "Reinigt Kopfhaut und Haar passend zu deiner Wasch-Routine.",
  conditioner: "Pflegt und entwirrt die Längen nach der Haarwäsche.",
  leave_in: "Unterstützt die Längen zwischen den Haarwäschen mit leichter Pflege.",
  heat_protectant: "Schützt das Haar bei Styling mit Hitze.",
  oil: "Versorgt die Längen gezielt und unterstützt Pre-Wash, Leave-in und Finish.",
  mask: "Gibt den Längen eine intensive, auswaschbare Pflegeeinheit.",
  scalp_care: "Unterstützt die Kopfhaut mit gezielter Pflege.",
  dry_shampoo: "Frischt den Ansatz zwischen den Haarwäschen auf.",
  bondbuilder: "Unterstützt beanspruchtes Haar mit einer aufbauenden Pflege.",
  deep_cleansing_shampoo: "Entfernt Ablagerungen und klärt Haar und Kopfhaut bei Bedarf.",
}

type Stage3EntryIds = Pick<Stage3EntryContext, "personalPlanId" | "refinedVersionId">

function requireOpaqueId(value: string, label: keyof Stage3EntryIds): string {
  if (!value.trim()) {
    throw new Error(`${label} must be a non-empty opaque ID`)
  }

  return value
}

export function buildStage3EntryContext(
  snapshot: InitialNeedPlanSnapshot,
  ids: Stage3EntryIds,
): Stage3EntryContext {
  if (snapshot.profile.source.projection !== "refined_post_plan") {
    throw new Error("Stage 3 entry requires a refined_post_plan snapshot")
  }
  if (snapshot.renderedOrder.length === 0) {
    throw new Error("Stage 3 entry requires at least one rendered category")
  }

  const personalPlanId = requireOpaqueId(ids.personalPlanId, "personalPlanId")
  const refinedVersionId = requireOpaqueId(ids.refinedVersionId, "refinedVersionId")

  return {
    schemaVersion: 1,
    personalPlanId,
    refinedVersionId,
    orderedCategories: snapshot.renderedOrder.map((category) => {
      const decision = snapshot.decisions.find((candidate) => candidate.category === category)
      if (!decision) throw new Error(`Stage 3 entry is missing a refined decision for ${category}`)
      const authority = CATEGORY_ROLE_POLICIES[category]
      const requiredRoles = decision.roles.filter((role) =>
        authority.allowedRoles.includes(role as never),
      )
      if (requiredRoles.length !== decision.roles.length) {
        throw new Error(`Stage 3 role is not allowed for category ${category}`)
      }
      const qualifyingRoutes =
        category === "heat_protectant" ? requireHeatQualifyingRoutes(decision.target) : undefined

      return {
        category,
        requiredRoles,
        ...(qualifyingRoutes ? { qualifyingRoutes } : {}),
        needSummary: NEED_SUMMARIES[category],
        authorityVersion: authority.authorityVersion,
      }
    }),
    inventoryPrompts: snapshot.renderedOrder.map((category) => ({
      category,
      allowsMultiple: CATEGORY_ROLE_POLICIES[category].allowsMultiple,
      allowsExplicitNone: true,
    })),
  }
}

function requireHeatQualifyingRoutes(
  target: InitialNeedPlanSnapshot["decisions"][number]["target"],
) {
  if (!target || target.category !== "heat_protectant" || target.qualifyingRoutes.length === 0) {
    throw new Error("Stage 3 Heat Protectant entry requires qualifying routes")
  }

  return [...target.qualifyingRoutes]
}
