import type { InitialNeedPlanSnapshot, PlanProductRole } from "@/lib/personal-plan/types"

import { CATEGORY_ROLE_POLICIES, roleAllowedForCategory } from "./authorities"
import type {
  PersonalPlanCategory,
  Stage3AuthoritySnapshotV1,
  Stage3CategoryRequirement,
  Stage3ProductDraft,
  Stage3RoleAssignment,
} from "./contracts"
import { createStage3Draft } from "./state-machine"
import { buildStage3EntryContext } from "./stage2-entry-adapter"

const REPAIR_NEED_SUMMARY = "Vorhandenes Produkt aus deiner früheren Produktauswahl."

export function buildRoutineAuthorityRepairDraft(input: {
  sourceDraft: Stage3ProductDraft
  refinedNeedSnapshot: InitialNeedPlanSnapshot
  userId: string
  personalPlanId: string
  refinedVersionId: string
  now: string
}): { draft: Stage3ProductDraft; requirements: Stage3CategoryRequirement[] } {
  if (input.sourceDraft.status !== "completed") {
    throw new Error("stage3_repair_source_draft_not_completed")
  }
  if (
    input.sourceDraft.userId !== input.userId ||
    input.sourceDraft.personalPlanId !== input.personalPlanId ||
    input.sourceDraft.refinedVersionId !== input.refinedVersionId
  ) {
    throw new Error("stage3_repair_source_scope_mismatch")
  }

  const entry = buildStage3EntryContext(input.refinedNeedSnapshot, {
    personalPlanId: input.personalPlanId,
    refinedVersionId: input.refinedVersionId,
  })
  const sourceCategories = uniqueCategories(
    input.sourceDraft.products.map((product) => product.identity.category),
  )
  const requirements = extendRequirementsWithInventoryCategories(
    entry.orderedCategories,
    sourceCategories,
  )
  const authoritySnapshot = extendAuthoritySnapshotWithInventoryCategories(
    entry.authoritySnapshot,
    sourceCategories,
  )
  const categorySet = new Set(requirements.map((requirement) => requirement.category))
  const products = dedupeCapturedProducts(input.sourceDraft.products).filter((product) =>
    categorySet.has(product.identity.category),
  )
  const productIds = new Set(products.map((product) => product.capturedProductId))
  const roleAssignments = input.sourceDraft.roleAssignments
    .filter((assignment) => productIds.has(assignment.capturedProductId))
    .map((assignment) => normalizeRepairAssignment(assignment))
    .filter((assignment): assignment is Stage3RoleAssignment => assignment.roles.length > 0)
  const assignedRoles = new Set(
    roleAssignments.flatMap((assignment) =>
      assignment.roles.map((role) => `${assignment.category}:${role}`),
    ),
  )
  const uncoveredRoles = requirements.flatMap((requirement) =>
    requirement.requiredRoles
      .filter((role) => !assignedRoles.has(`${requirement.category}:${role}`))
      .map((role) => ({
        category: requirement.category,
        role,
        reason: "no_product_owned" as const,
      })),
  )
  const base = createStage3Draft({
    draftId: "pending-sql-assignment",
    userId: input.userId,
    personalPlanId: input.personalPlanId,
    refinedVersionId: input.refinedVersionId,
    requirements,
    authoritySnapshot,
    now: input.now,
  })

  return {
    requirements,
    draft: {
      ...base,
      pass: "product_capture",
      categoryCursor: null,
      products,
      roleAssignments,
      uncoveredRoles,
      decisions: [],
      completedCaptureCategories: requirements.map((requirement) => requirement.category),
      completedDecisionKeys: [],
      inventoryAuthority: undefined,
      inventoryDispositions: undefined,
      productLoadResolution: undefined,
    },
  }
}

function uniqueCategories(categories: readonly PersonalPlanCategory[]): PersonalPlanCategory[] {
  const seen = new Set<PersonalPlanCategory>()
  const result: PersonalPlanCategory[] = []
  for (const category of categories) {
    if (seen.has(category)) continue
    seen.add(category)
    result.push(category)
  }
  return result
}

function extendRequirementsWithInventoryCategories(
  base: readonly Stage3CategoryRequirement[],
  sourceCategories: readonly PersonalPlanCategory[],
): Stage3CategoryRequirement[] {
  const existing = new Set(base.map((requirement) => requirement.category))
  return [
    ...base,
    ...sourceCategories
      .filter((category) => !existing.has(category))
      .map((category) => ({
        category,
        requiredRoles: [] as PlanProductRole[],
        needSummary: REPAIR_NEED_SUMMARY,
        authorityVersion: CATEGORY_ROLE_POLICIES[category].authorityVersion,
      })),
  ]
}

function extendAuthoritySnapshotWithInventoryCategories(
  base: Stage3AuthoritySnapshotV1,
  sourceCategories: readonly PersonalPlanCategory[],
): Stage3AuthoritySnapshotV1 {
  const existing = new Set(base.orderedCategories)
  const extra = sourceCategories.filter((category) => !existing.has(category))
  if (extra.length === 0) return base
  return {
    ...base,
    orderedCategories: [...base.orderedCategories, ...extra],
    inventoryOnlyCategories: [...new Set([...(base.inventoryOnlyCategories ?? []), ...extra])],
  }
}

function dedupeCapturedProducts(products: Stage3ProductDraft["products"]) {
  const seen = new Set<string>()
  return products.filter((product) => {
    if (seen.has(product.capturedProductId)) return false
    seen.add(product.capturedProductId)
    return true
  })
}

function normalizeRepairAssignment(assignment: Stage3RoleAssignment): Stage3RoleAssignment {
  return {
    ...assignment,
    roles: assignment.roles.filter((role) => roleAllowedForCategory(assignment.category, role)),
  }
}
