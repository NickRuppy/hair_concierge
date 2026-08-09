"use client"

import { useMemo } from "react"

import { Stage3ProductsFlow } from "@/components/personal-plan-products/stage3-products-flow"
import { developmentStage3Analytics } from "@/lib/personal-plan/products/stage3-development-analytics"
import { createFixtureStage3Gateway } from "@/lib/personal-plan/products/fixture-gateway"

export function PersonalPlanStage3LabClient() {
  // Labs deliberately owns an in-memory gateway. The production flow defaults
  // to the HTTP/server-authoritative gateway when no adapter is injected.
  const gateway = useMemo(() => createFixtureStage3Gateway({ searchDelayMs: 0 }), [])

  return (
    <Stage3ProductsFlow
      analytics={developmentStage3Analytics}
      gateway={gateway}
      searchDebounceMs={0}
    />
  )
}
