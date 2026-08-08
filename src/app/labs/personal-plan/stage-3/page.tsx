import { notFound } from "next/navigation"

import { isPersonalPlanStage3LabEnabled } from "@/lib/labs/personal-plan-stage3-access"
import { PersonalPlanStage3LabClient } from "./lab-client"

export default function PersonalPlanStage3LabPage() {
  if (!isPersonalPlanStage3LabEnabled(process.env)) notFound()

  return <PersonalPlanStage3LabClient />
}
