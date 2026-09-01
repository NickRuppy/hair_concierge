import { CATEGORY_ROLE_POLICIES } from "./authorities"
import type {
  Stage3AuthoritySnapshotV1,
  Stage3CatalogCandidate,
  Stage3CategoryRequirement,
  Stage3EntryContext,
} from "./contracts"

export const FIXTURE_STAGE3_SCENARIOS = {
  deferredHeatProtection: "deferred-heat-protection",
  inventoryOnlyConditioner: "inventory-only-conditioner",
  uncoveredConditioner: "uncovered-conditioner",
  ownedSearchOverflow: "owned-search-overflow",
} as const

export function createFixtureDeferredHeatProtectionEntryContext(): Stage3EntryContext {
  const refinedVersionId = "fixture-refined-deferred-heat-protection"
  const requirements: Stage3CategoryRequirement[] = [
    {
      category: "heat_protectant",
      requiredRoles: [],
      needSummary: "Vorhandenen Hitzeschutz erfassen",
      authorityVersion: CATEGORY_ROLE_POLICIES.heat_protectant.authorityVersion,
    },
  ]
  const authoritySnapshot: Stage3AuthoritySnapshotV1 = {
    schemaVersion: 1,
    refinedNeedVersionId: refinedVersionId,
    refinedInputHash: "deferred-heat-protection-fixture",
    categoryDecisions: [
      {
        category: "heat_protectant",
        resolution: "deferred_until_post_plan_onboarding",
        needTier: null,
        roles: [],
        target: {
          category: "heat_protectant",
          roles: [],
          qualifyingRoutes: [],
          carrierPolicy: "integrated_or_separate_verified_binary_capability",
        },
        frequency: null,
        reasons: [],
        executionState: "available",
        executionPauseReason: null,
        deferredFacts: ["heat_tool_use"],
      },
    ],
    coverage: [],
    orderedCategories: ["heat_protectant"],
    inventoryOnlyCategories: ["heat_protectant"],
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
      ownedCategories: ["heat_protectant"],
    },
  }

  return {
    schemaVersion: 1,
    personalPlanId: "fixture-plan-deferred-heat-protection",
    refinedVersionId,
    orderedCategories: requirements,
    inventoryPrompts: [
      { category: "heat_protectant", allowsMultiple: true, allowsExplicitNone: true },
    ],
    authoritySnapshot,
  }
}

export function createFixtureInventoryOnlyConditionerEntryContext(): Stage3EntryContext {
  return {
    schemaVersion: 1,
    personalPlanId: "fixture-plan-inventory-only-conditioner",
    refinedVersionId: "fixture-refined-inventory-only-conditioner",
    orderedCategories: [
      {
        category: "conditioner",
        requiredRoles: [],
        needSummary: "Conditioner ist aktuell nicht Teil deines Plans",
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
