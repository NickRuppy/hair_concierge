import { CATEGORY_ROLE_POLICIES } from "../authorities"
import type {
  Stage3AuthorityDraftInput,
  PersonalPlanCategory,
  Stage3ProductDraft,
  Stage3AuthoritySnapshotV1,
} from "../contracts"
import { PERSONAL_PLAN_PRODUCT_CATEGORIES } from "../contracts"
import { requireCurrentProductLoadResolution } from "../product-load-resolution"
import { isValidPersistedCategoryDecision } from "./category-decision-schema"
import { canonicalJson } from "@/lib/personal-plan/routine/canonicalize"

export class Stage3AuthoritySnapshotError extends Error {
  constructor(public readonly code: "stale_authority_snapshot" | "stale_refined_source") {
    super(code)
    this.name = "Stage3AuthoritySnapshotError"
  }
}

/**
 * Identifies only a structurally usable active snapshot whose signed category
 * authority versions have aged out. Malformed or source-stale snapshots stay
 * on the normal fail-closed path instead of being silently reconstructed.
 */
export function authoritySnapshotMayNeedVersionRefresh(
  draft: Stage3AuthorityDraftInput & Pick<Stage3ProductDraft, "status">,
): boolean {
  if (draft.status !== "active") return false
  const snapshot = draft.authoritySnapshot
  if (
    !snapshot ||
    snapshot.schemaVersion !== 1 ||
    snapshot.refinedNeedVersionId !== draft.refinedVersionId ||
    !snapshot.refinedInputHash?.trim()
  ) {
    return false
  }

  const knownCategories = new Set<PersonalPlanCategory>(PERSONAL_PLAN_PRODUCT_CATEGORIES)
  if (
    !uniqueKnownCategories(snapshot.orderedCategories, knownCategories) ||
    !uniqueKnownCategories(snapshot.inventoryOnlyCategories ?? [], knownCategories) ||
    (!snapshot.orderedCategories.includes("shampoo") &&
      !snapshot.inventoryOnlyCategories?.includes("shampoo"))
  ) {
    return false
  }

  const overlayOrder = draft.productLoadResolution?.requirements.map((item) => item.category) ?? []
  if (!uniqueKnownCategories(overlayOrder, knownCategories)) return false
  const baseCategories = new Set(snapshot.orderedCategories)
  const expectedOrder = [
    ...snapshot.orderedCategories,
    ...overlayOrder.filter((category) => !baseCategories.has(category)),
  ]
  if (!sameValues(draft.orderedCategories, expectedOrder)) return false

  for (const [categoryValue, authorityVersion] of Object.entries(draft.authorityVersions)) {
    const category = categoryValue as PersonalPlanCategory
    if (
      !knownCategories.has(category) ||
      authorityVersion !== snapshot.authorityVersions[category]
    ) {
      return false
    }
  }
  if (
    draft.authorityVersions.shampoo !== "personal-plan.shampoo.v3" ||
    snapshot.authorityVersions.shampoo !== "personal-plan.shampoo.v3"
  ) {
    return false
  }
  if (
    Object.keys(snapshot.authorityVersions).length !== PERSONAL_PLAN_PRODUCT_CATEGORIES.length ||
    Object.keys(snapshot.authorityVersions).some(
      (category) => !knownCategories.has(category as PersonalPlanCategory),
    )
  ) {
    return false
  }
  for (const category of PERSONAL_PLAN_PRODUCT_CATEGORIES) {
    const expected = CATEGORY_ROLE_POLICIES[category].authorityVersion
    if (category !== "shampoo" && snapshot.authorityVersions[category] !== expected) return false
  }

  const inventoryOnly = new Set(snapshot.inventoryOnlyCategories ?? [])
  const ordered = new Set(snapshot.orderedCategories)
  const decisionCounts = new Map<PersonalPlanCategory, number>()
  for (const decision of snapshot.categoryDecisions as unknown[]) {
    if (!isValidPersistedCategoryDecision(decision)) return false
    const category = (decision as { category: PersonalPlanCategory }).category
    if (!ordered.has(category) || inventoryOnly.has(category)) return false
    decisionCounts.set(category, (decisionCounts.get(category) ?? 0) + 1)
  }
  for (const category of snapshot.orderedCategories) {
    if (!inventoryOnly.has(category) && decisionCounts.get(category) !== 1) return false
  }
  if ([...decisionCounts.values()].some((count) => count !== 1)) return false

  try {
    requireCurrentProductLoadResolution(draft)
  } catch {
    return false
  }
  return true
}

/**
 * Admits refresh only when the persisted immutable authority is exactly what
 * the current refined source re-derives. The sole permitted difference is the
 * supported Shampoo authority version transition from v3 to v4.
 */
export function authoritySnapshotNeedsVersionRefresh(
  draft: Stage3AuthorityDraftInput & Pick<Stage3ProductDraft, "status">,
  currentSnapshot: Stage3AuthoritySnapshotV1,
): boolean {
  if (!authoritySnapshotMayNeedVersionRefresh(draft)) return false
  if (
    currentSnapshot.refinedNeedVersionId !== draft.refinedVersionId ||
    currentSnapshot.authorityVersions.shampoo !== CATEGORY_ROLE_POLICIES.shampoo.authorityVersion
  ) {
    return false
  }

  const persistedSnapshot = draft.authoritySnapshot!
  const normalizedPersistedSnapshot: Stage3AuthoritySnapshotV1 = {
    ...persistedSnapshot,
    authorityVersions: {
      ...persistedSnapshot.authorityVersions,
      shampoo: currentSnapshot.authorityVersions.shampoo,
    },
  }
  return canonicalJson(normalizedPersistedSnapshot) === canonicalJson(currentSnapshot)
}

export function requireCurrentAuthoritySnapshot(
  draft: Stage3AuthorityDraftInput,
): Stage3AuthoritySnapshotV1 {
  const snapshot = draft.authoritySnapshot
  if (
    !snapshot ||
    snapshot.schemaVersion !== 1 ||
    snapshot.refinedNeedVersionId !== draft.refinedVersionId ||
    !snapshot.refinedInputHash?.trim()
  ) {
    throw new Stage3AuthoritySnapshotError("stale_authority_snapshot")
  }

  const overlayOrder = draft.productLoadResolution?.requirements.map((item) => item.category) ?? []
  const baseCategories = new Set(snapshot.orderedCategories)
  const appendedOverlayOrder = overlayOrder.filter((category) => !baseCategories.has(category))
  const expectedOrder = [...snapshot.orderedCategories, ...appendedOverlayOrder]
  if (!sameValues(draft.orderedCategories, expectedOrder)) {
    throw new Stage3AuthoritySnapshotError("stale_authority_snapshot")
  }

  const appendedOverlayCategories = new Set(appendedOverlayOrder)
  const inventoryOnlyCategories = new Set(snapshot.inventoryOnlyCategories ?? [])
  for (const category of draft.orderedCategories) {
    if (appendedOverlayCategories.has(category) || inventoryOnlyCategories.has(category)) {
      continue
    }
    const decisions = snapshot.categoryDecisions.filter(
      (decision) => decision.category === category,
    )
    if (
      decisions.length !== 1 ||
      snapshot.authorityVersions[category] !== CATEGORY_ROLE_POLICIES[category].authorityVersion ||
      draft.authorityVersions[category] !== CATEGORY_ROLE_POLICIES[category].authorityVersion
    ) {
      throw new Stage3AuthoritySnapshotError("stale_authority_snapshot")
    }
  }

  for (const category of Object.keys(CATEGORY_ROLE_POLICIES) as PersonalPlanCategory[]) {
    if (
      snapshot.authorityVersions[category] !== CATEGORY_ROLE_POLICIES[category].authorityVersion
    ) {
      throw new Stage3AuthoritySnapshotError("stale_authority_snapshot")
    }
  }

  requireCurrentProductLoadResolution(draft)
  return snapshot
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function uniqueKnownCategories(
  categories: readonly PersonalPlanCategory[],
  knownCategories: ReadonlySet<PersonalPlanCategory>,
): boolean {
  return (
    categories.every((category) => knownCategories.has(category)) &&
    new Set(categories).size === categories.length
  )
}
