import { notFound } from "next/navigation"

import { isPersonalPlanStage3LabEnabled } from "@/lib/labs/personal-plan-stage3-access"
import { PersonalPlanStage3LabClient } from "./lab-client"

export default function PersonalPlanStage3LabPage() {
  if (
    !isPersonalPlanStage3LabEnabled({
      CI: process.env.CI,
      CI_PERSONAL_PLAN_STAGE3_LAB_ENABLED: process.env.CI_PERSONAL_PLAN_STAGE3_LAB_ENABLED,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
    })
  ) {
    notFound()
  }

  return <PersonalPlanStage3LabClient />
}
