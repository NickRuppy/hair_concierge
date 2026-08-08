import type { Metadata } from "next"

import { PlanStartFlow, PlanStartProductionGate } from "@/components/personal-plan-start"
import { isPersonalPlanAppV1Enabled } from "@/lib/personal-plan/release"

export const metadata: Metadata = {
  title: "Dein Personal Plan | Chaarlie",
  robots: { index: false, follow: false },
}

export default function PlanStartPage() {
  if (!isPersonalPlanAppV1Enabled()) {
    return <PlanStartFlow state="unavailable" />
  }

  return <PlanStartProductionGate />
}
