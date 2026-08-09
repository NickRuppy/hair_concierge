import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"

import { CATEGORY_ROLE_POLICIES } from "./authorities"
import { PERSONAL_PLAN_PRODUCT_CATEGORIES } from "./contracts"
import type {
  PersonalPlanCategory,
  Stage3AuthoritySnapshotV1,
  Stage3EntryContext,
} from "./contracts"

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

function stage3OrderedCategories(snapshot: InitialNeedPlanSnapshot): PersonalPlanCategory[] {
  const renderedCategories = new Set<PersonalPlanCategory>(snapshot.renderedOrder)
  const inventoryOnlyCategories = new Set<PersonalPlanCategory>()
  const routine = snapshot.profile.routine
  if (routine?.currentProductLoad.state === "known") {
    for (const category of routine.currentProductLoad.value.categories) {
      if (!renderedCategories.has(category)) {
        inventoryOnlyCategories.add(category)
      }
    }
  }

  return [
    ...snapshot.renderedOrder,
    ...PERSONAL_PLAN_PRODUCT_CATEGORIES.filter((category) => inventoryOnlyCategories.has(category)),
  ]
}

export function buildStage3EntryContext(
  snapshot: InitialNeedPlanSnapshot,
  ids: Stage3EntryIds,
): Stage3EntryContext & { authoritySnapshot: Stage3AuthoritySnapshotV1 } {
  if (snapshot.profile.source.projection !== "refined_post_plan") {
    throw new Error("Stage 3 entry requires a refined_post_plan snapshot")
  }
  if (snapshot.renderedOrder.length === 0) {
    throw new Error("Stage 3 entry requires at least one rendered category")
  }

  const personalPlanId = requireOpaqueId(ids.personalPlanId, "personalPlanId")
  const refinedVersionId = requireOpaqueId(ids.refinedVersionId, "refinedVersionId")
  const orderedCategories = stage3OrderedCategories(snapshot)
  const renderedCategories = new Set(snapshot.renderedOrder)
  const inventoryOnlyCategories = orderedCategories.filter(
    (category) => !renderedCategories.has(category),
  )
  const categoryDecisions = snapshot.renderedOrder.map((category) => {
    const matches = snapshot.decisions.filter((candidate) => candidate.category === category)
    if (matches.length !== 1) {
      throw new Error(`Stage 3 entry requires exactly one refined decision for ${category}`)
    }
    return matches[0]!
  })
  if (!snapshot.inputHash?.trim()) {
    throw new Error("Stage 3 entry requires a refined input hash")
  }

  return {
    schemaVersion: 1,
    personalPlanId,
    refinedVersionId,
    orderedCategories: orderedCategories.map((category) => {
      const decision = snapshot.decisions.find((candidate) => candidate.category === category)
      const authority = CATEGORY_ROLE_POLICIES[category]
      const requiredRoles = (decision?.roles ?? []).filter((role) =>
        authority.allowedRoles.includes(role as never),
      )
      if (decision && requiredRoles.length !== decision.roles.length) {
        throw new Error(`Stage 3 role is not allowed for category ${category}`)
      }
      const qualifyingRoutes =
        category === "heat_protectant" && decision
          ? requireHeatQualifyingRoutes(decision.target)
          : undefined

      return {
        category,
        requiredRoles,
        ...(qualifyingRoutes ? { qualifyingRoutes } : {}),
        needSummary: NEED_SUMMARIES[category],
        authorityVersion: authority.authorityVersion,
      }
    }),
    inventoryPrompts: orderedCategories.map((category) => ({
      category,
      allowsMultiple: CATEGORY_ROLE_POLICIES[category].allowsMultiple,
      allowsExplicitNone: true,
    })),
    authoritySnapshot: {
      schemaVersion: 1,
      refinedNeedVersionId: refinedVersionId,
      refinedInputHash: snapshot.inputHash,
      ...(snapshot.profile.routine
        ? {
            productLoadContext: {
              schemaVersion: 1 as const,
              scalpOiliness: snapshot.profile.scalp.oiliness,
              deepCleansingScalpPause:
                snapshot.profile.scalp.concerns.includes("irritated") ||
                snapshot.profile.scalp.concerns.includes("dry_dandruff"),
              hasLowVolumeOrWeighedDown: snapshot.profile.concerns.includes(
                "low_volume_or_weighed_down",
              ),
              shampooFrequency:
                snapshot.profile.routine.shampooFrequency.state === "known"
                  ? snapshot.profile.routine.shampooFrequency.value
                  : null,
              oilPurposes:
                snapshot.profile.routine.currentProductLoad.state === "known"
                  ? [...snapshot.profile.routine.currentProductLoad.value.oilPurposes]
                  : [],
            },
          }
        : {}),
      categoryDecisions,
      coverage: [...snapshot.coverage],
      orderedCategories: [...orderedCategories],
      inventoryOnlyCategories,
      authorityVersions: Object.fromEntries(
        Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
          category,
          policy.authorityVersion,
        ]),
      ) as Stage3AuthoritySnapshotV1["authorityVersions"],
    },
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
