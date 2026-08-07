import { notFound } from "next/navigation"

import { Stage3ProductsFlow } from "@/components/personal-plan-products/stage3-products-flow"
import { isPersonalPlanStage3LabEnabled } from "@/lib/labs/personal-plan-stage3-access"

export default function PersonalPlanStage3LabPage() {
  if (!isPersonalPlanStage3LabEnabled(process.env)) notFound()

  return <Stage3ProductsFlow />
}
