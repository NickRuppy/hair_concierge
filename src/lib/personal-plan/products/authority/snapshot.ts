import { CATEGORY_ROLE_POLICIES } from "../authorities"
import type {
  Stage3AuthorityDraftInput,
  PersonalPlanCategory,
  Stage3AuthoritySnapshotV1,
} from "../contracts"
import { requireCurrentProductLoadResolution } from "../product-load-resolution"

export class Stage3AuthoritySnapshotError extends Error {
  constructor(public readonly code: "stale_authority_snapshot" | "stale_refined_source") {
    super(code)
    this.name = "Stage3AuthoritySnapshotError"
  }
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
