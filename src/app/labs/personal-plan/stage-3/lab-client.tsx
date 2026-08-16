"use client"

import { useMemo } from "react"

import { Stage3ProductsFlow } from "@/components/personal-plan-products/stage3-products-flow"
import { developmentStage3Analytics } from "@/lib/personal-plan/products/stage3-development-analytics"
import { createFixtureStage3Gateway } from "@/lib/personal-plan/products/fixture-gateway"
import {
  FIXTURE_STAGE3_SCENARIOS,
  createFixtureInventoryOnlyConditionerEntryContext,
  createFixtureOwnedSearchOverflowCatalog,
  createFixtureUncoveredConditionerEntryContext,
} from "@/lib/personal-plan/products/fixture-scenarios"

export function PersonalPlanStage3LabClient({ scenario }: { scenario?: string }) {
  // Labs deliberately owns an in-memory gateway. The production flow defaults
  // to the HTTP/server-authoritative gateway when no adapter is injected.
  const gateway = useMemo(
    () =>
      createFixtureStage3Gateway({
        searchDelayMs: 0,
        catalog:
          scenario === FIXTURE_STAGE3_SCENARIOS.ownedSearchOverflow
            ? createFixtureOwnedSearchOverflowCatalog()
            : undefined,
      }),
    [scenario],
  )
  const entryContext = useMemo(
    () =>
      scenario === FIXTURE_STAGE3_SCENARIOS.inventoryOnlyConditioner
        ? createFixtureInventoryOnlyConditionerEntryContext()
        : scenario === FIXTURE_STAGE3_SCENARIOS.uncoveredConditioner
          ? createFixtureUncoveredConditionerEntryContext()
          : undefined,
    [scenario],
  )

  return (
    <Stage3ProductsFlow
      analytics={developmentStage3Analytics}
      entryContext={entryContext}
      draftId={
        scenario === FIXTURE_STAGE3_SCENARIOS.inventoryOnlyConditioner
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
