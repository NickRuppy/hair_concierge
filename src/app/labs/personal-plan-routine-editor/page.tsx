import { notFound } from "next/navigation"

import { isPersonalPlanStage3LabEnabled } from "@/lib/labs/personal-plan-stage3-access"

import { RoutineEditorLab } from "./routine-editor-lab"

export default function PersonalPlanRoutineEditorLabPage() {
  if (!isPersonalPlanStage3LabEnabled(process.env)) notFound()
  return <RoutineEditorLab />
}
