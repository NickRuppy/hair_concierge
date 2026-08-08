"use client"

import { Stage3ProductsFlow } from "@/components/personal-plan-products/stage3-products-flow"
import { developmentStage3Analytics } from "@/lib/personal-plan/products/stage3-development-analytics"

export function PersonalPlanStage3LabClient() {
  return <Stage3ProductsFlow analytics={developmentStage3Analytics} />
}
