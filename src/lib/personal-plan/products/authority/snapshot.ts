import { CATEGORY_ROLE_POLICIES } from "../authorities"
import type {
  PersonalPlanCategory,
  Stage3AuthoritySnapshotV1,
  Stage3ProductDraft,
} from "../contracts"
import { requireCurrentProductLoadResolution } from "../product-load-resolution"

export class Stage3AuthoritySnapshotError extends Error {
  constructor(public readonly code: "stale_authority_snapshot" | "stale_refined_source") {
    super(code)
    this.name = "Stage3AuthoritySnapshotError"
  }
}

export function requireCurrentAuthoritySnapshot(
  draft: Stage3ProductDraft,
): Stage3AuthoritySnapshotV1 {
  const snapshot = draft.authoritySnapshot
  const overlayOrder = draft.productLoadResolution?.requirements.map((item) => item.category) ?? []
  const overlayCategories = new Set(overlayOrder)
  const baseDraftOrder = draft.orderedCategories.filter(
    (category) => !overlayCategories.has(category),
  )
  if (
    !snapshot ||
    snapshot.schemaVersion !== 1 ||
    snapshot.refinedNeedVersionId !== draft.refinedVersionId ||
    !snapshot.refinedInputHash?.trim() ||
    !sameValues(snapshot.orderedCategories, baseDraftOrder) ||
    !sameValues(draft.orderedCategories.slice(baseDraftOrder.length), overlayOrder)
  ) {
    throw new Stage3AuthoritySnapshotError("stale_authority_snapshot")
  }

  const inventoryOnlyCategories = new Set(snapshot.inventoryOnlyCategories ?? [])
  for (const category of draft.orderedCategories) {
    if (overlayCategories.has(category) || inventoryOnlyCategories.has(category)) {
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
