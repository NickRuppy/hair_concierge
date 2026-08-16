import { CATEGORY_ROLE_POLICIES } from "./authorities"
import type {
  Stage3AuthoritySnapshotV1,
  Stage3CatalogCandidate,
  Stage3CategoryRequirement,
  Stage3EntryContext,
} from "./contracts"

export const FIXTURE_STAGE3_SCENARIOS = {
  inventoryOnlyConditioner: "inventory-only-conditioner",
  uncoveredConditioner: "uncovered-conditioner",
  ownedSearchOverflow: "owned-search-overflow",
} as const

export function createFixtureInventoryOnlyConditionerEntryContext(): Stage3EntryContext {
  return {
    schemaVersion: 1,
    personalPlanId: "fixture-plan-inventory-only-conditioner",
    refinedVersionId: "fixture-refined-inventory-only-conditioner",
    orderedCategories: [
      {
        category: "conditioner",
        requiredRoles: [],
        needSummary: "Conditioner ist aktuell nicht Teil des Idealplans",
        authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
      },
    ],
    inventoryPrompts: [{ category: "conditioner", allowsMultiple: true, allowsExplicitNone: true }],
  }
}

export function createFixtureOwnedSearchOverflowCatalog(): Stage3CatalogCandidate[] {
  return Array.from({ length: 9 }, (_, index) => {
    const position = index + 1
    return {
      candidateId: `fixture-candidate-conditioner-overflow-${position}`,
      productId: `fixture-product-conditioner-overflow-${position}`,
      displayName: `Overflow Conditioner ${position}`,
      category: "conditioner" as const,
      brandName: "Chaarlie Fixture",
      confidence: "exact" as const,
    }
  })
}

/**
 * A Labs-only entry that follows the real Stage 2 ownership contract: the
 * Conditioner category is known, but omitted from the user's owned product
 * load. `createStage3Draft` therefore creates an uncovered role rather than
 * relying on a post-hoc `mark_role_uncovered` mutation.
 */
export function createFixtureUncoveredConditionerEntryContext(): Stage3EntryContext {
  const requirements: Stage3CategoryRequirement[] = [
    {
      category: "conditioner",
      requiredRoles: ["conditioner_rinse_out"],
      needSummary: "Leichte Pflege nach der Haarwäsche",
      authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
    },
  ]
  const authoritySnapshot: Stage3AuthoritySnapshotV1 = {
    schemaVersion: 1,
    refinedNeedVersionId: "fixture-refined-uncovered-conditioner",
    refinedInputHash: "fixture-refined-uncovered-conditioner",
    categoryDecisions: [],
    coverage: [],
    orderedCategories: ["conditioner"],
    authorityVersions: Object.fromEntries(
      Object.entries(CATEGORY_ROLE_POLICIES).map(([category, policy]) => [
        category,
        policy.authorityVersion,
      ]),
    ) as Stage3AuthoritySnapshotV1["authorityVersions"],
    productLoadContext: {
      schemaVersion: 1,
      scalpOiliness: "balanced",
      deepCleansingScalpPause: false,
      hasLowVolumeOrWeighedDown: false,
      shampooFrequency: "weekly_2x",
      oilPurposes: [],
      // Deliberately empty: this is the Stage-2 fact that makes Conditioner
      // an uncovered role when createStage3Draft runs.
      ownedCategories: [],
    },
  }

  return {
    schemaVersion: 1,
    personalPlanId: "fixture-plan-uncovered-conditioner",
    refinedVersionId: authoritySnapshot.refinedNeedVersionId,
    orderedCategories: requirements,
    inventoryPrompts: [{ category: "conditioner", allowsMultiple: true, allowsExplicitNone: true }],
    authoritySnapshot,
  }
}
