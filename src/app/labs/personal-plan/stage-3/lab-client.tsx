"use client"

import { useMemo } from "react"

import { Stage3ProductsFlow } from "@/components/personal-plan-products/stage3-products-flow"
import { developmentStage3Analytics } from "@/lib/personal-plan/products/stage3-development-analytics"
import { createFixtureStage3Gateway } from "@/lib/personal-plan/products/fixture-gateway"
import { createStage3Draft } from "@/lib/personal-plan/products/state-machine"
import { CATEGORY_ROLE_POLICIES } from "@/lib/personal-plan/products/authorities"
import type { Stage3Bootstrap } from "@/lib/personal-plan/products/stage2-entry-adapter"
import {
  FIXTURE_STAGE3_SCENARIOS,
  createFixtureDeferredHeatProtectionEntryContext,
  createFixtureInventoryOnlyConditionerEntryContext,
  createFixtureOwnedSearchOverflowCatalog,
  createFixtureUncoveredConditionerEntryContext,
} from "@/lib/personal-plan/products/fixture-scenarios"

export function PersonalPlanStage3LabClient({ scenario }: { scenario?: string }) {
  const legacyBootstrap = useMemo(
    () => (scenario === "legacy-prefill" ? createLegacyPrefillFixture() : undefined),
    [scenario],
  )
  // Labs deliberately owns an in-memory gateway. The production flow defaults
  // to the HTTP/server-authoritative gateway when no adapter is injected.
  const gateway = useMemo(
    () =>
      createFixtureStage3Gateway({
        initialDraft: legacyBootstrap
          ? { draft: legacyBootstrap.draft, requirements: legacyBootstrap.requirements }
          : undefined,
        searchDelayMs: 0,
        catalog:
          scenario === FIXTURE_STAGE3_SCENARIOS.ownedSearchOverflow
            ? createFixtureOwnedSearchOverflowCatalog()
            : undefined,
      }),
    [scenario, legacyBootstrap],
  )
  const entryContext = useMemo(
    () =>
      scenario === FIXTURE_STAGE3_SCENARIOS.deferredHeatProtection
        ? createFixtureDeferredHeatProtectionEntryContext()
        : scenario === FIXTURE_STAGE3_SCENARIOS.inventoryOnlyConditioner
          ? createFixtureInventoryOnlyConditionerEntryContext()
          : scenario === FIXTURE_STAGE3_SCENARIOS.uncoveredConditioner
            ? createFixtureUncoveredConditionerEntryContext()
            : undefined,
    [scenario],
  )

  return (
    <Stage3ProductsFlow
      bootstrap={legacyBootstrap}
      analytics={developmentStage3Analytics}
      entryContext={entryContext}
      draftId={
        scenario === FIXTURE_STAGE3_SCENARIOS.deferredHeatProtection
          ? "fixture-draft-deferred-heat-protection"
          : scenario === FIXTURE_STAGE3_SCENARIOS.inventoryOnlyConditioner
            ? "fixture-draft-inventory-only-conditioner"
            : scenario === FIXTURE_STAGE3_SCENARIOS.uncoveredConditioner
              ? "fixture-draft-uncovered-conditioner"
              : scenario === FIXTURE_STAGE3_SCENARIOS.ownedSearchOverflow
                ? "fixture-draft-owned-search-overflow"
                : undefined
      }
      gateway={gateway}
      searchDebounceMs={0}
    />
  )
}

function createLegacyPrefillFixture(): Stage3Bootstrap {
  const requirements = [
    {
      category: "conditioner" as const,
      requiredRoles: ["conditioner_rinse_out" as const],
      needSummary: "Pflege nach der Haarwäsche",
      authorityVersion: CATEGORY_ROLE_POLICIES.conditioner.authorityVersion,
    },
  ]
  const draft = createStage3Draft({
    draftId: "fixture-legacy-prefill",
    userId: "fixture-owner",
    personalPlanId: "fixture-plan",
    refinedVersionId: "fixture-refined",
    requirements,
    now: "2026-08-28T00:00:00Z",
  })
  draft.products = [
    {
      capturedProductId: "fixture-imported",
      userProductId: "fixture-owned",
      source: "existing_inventory",
      ownership: "owned",
      frequencyRange: "weekly_2x",
      identity: {
        kind: "catalog_product",
        productId: "fixture-product-conditioner-1",
        category: "conditioner",
        displayName: "Chaarlie Fixture Conditioner Balance",
      },
    },
  ]
  draft.legacyPrefillHints = {
    schemaVersion: 1,
    sourceFingerprint: "fixture",
    categories: {
      conditioner: [
        {
          kind: "search_name",
          usageId: "fixture-unresolved",
          category: "conditioner",
          productName: "Mein bisheriger Conditioner",
        },
      ],
    },
  }
  return {
    draft,
    requirements,
    authorityEvaluations: [],
    entryContext: {
      schemaVersion: 1,
      personalPlanId: draft.personalPlanId,
      refinedVersionId: draft.refinedVersionId,
      orderedCategories: requirements,
      inventoryPrompts: [
        { category: "conditioner", allowsMultiple: true, allowsExplicitNone: true },
      ],
    },
  }
}
