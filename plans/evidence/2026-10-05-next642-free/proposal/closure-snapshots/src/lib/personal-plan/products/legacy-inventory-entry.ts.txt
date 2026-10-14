import "server-only"

import type {
  LegacyExactInventorySeed,
  LegacyProductHint,
  LegacyRefinementPrefill,
} from "@/lib/personal-plan/legacy-prefill"
import {
  PERSONAL_PLAN_PRODUCT_CATEGORIES,
  type PersonalPlanCategory,
  type Stage3AuthoritySnapshotV1,
  type Stage3CategoryRequirement,
  type Stage3LegacyPrefillHintsV1,
} from "./contracts"
import { createStage3Draft } from "./state-machine"

const stage3CategorySet = new Set<string>(PERSONAL_PLAN_PRODUCT_CATEGORIES)

export function isStage3LegacyInventoryCategory(value: string): value is PersonalPlanCategory {
  return stage3CategorySet.has(value)
}

export function filterStage3ExactInventory(input: {
  prefill: LegacyRefinementPrefill
  orderedCategories: readonly PersonalPlanCategory[]
}): LegacyExactInventorySeed[] {
  const allowed = new Set(input.orderedCategories)
  return input.prefill.exactInventory.filter(
    (item) => isStage3LegacyInventoryCategory(item.category) && allowed.has(item.category),
  )
}

export function buildStage3LegacyPrefillHints(input: {
  prefill: LegacyRefinementPrefill
  orderedCategories: readonly PersonalPlanCategory[]
}): Stage3LegacyPrefillHintsV1 {
  const allowed = new Set(input.orderedCategories)
  const categories: Stage3LegacyPrefillHintsV1["categories"] = {}
  for (const hint of input.prefill.productHints) {
    if (!isStage3LegacyInventoryCategory(hint.category) || !allowed.has(hint.category)) continue
    const stage3Hint = hint as LegacyProductHint & { category: PersonalPlanCategory }
    const current = categories[stage3Hint.category] ?? []
    categories[stage3Hint.category] = [...current, stage3Hint]
  }
  return {
    schemaVersion: 1,
    sourceFingerprint: input.prefill.sourceFingerprint,
    categories,
  }
}

export function createStage3OptionalInventorySeedDraft(input: {
  draftId: string
  userId: string
  personalPlanId: string
  refinedVersionId: string
  requirements: Stage3CategoryRequirement[]
  authoritySnapshot?: Stage3AuthoritySnapshotV1
  prefill: LegacyRefinementPrefill
  now: string
}) {
  return {
    ...createStage3Draft({
      draftId: input.draftId,
      userId: input.userId,
      personalPlanId: input.personalPlanId,
      refinedVersionId: input.refinedVersionId,
      requirements: input.requirements,
      authoritySnapshot: input.authoritySnapshot,
      now: input.now,
    }),
    legacyPrefillHints: buildStage3LegacyPrefillHints({
      prefill: input.prefill,
      orderedCategories: input.requirements.map((requirement) => requirement.category),
    }),
  }
}
