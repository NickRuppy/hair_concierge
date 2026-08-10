import { notFound } from "next/navigation"

import { Stage2PreviewClient, type Stage2PreviewScenario } from "./preview-client"

const SCENARIOS = new Set<Stage2PreviewScenario>([
  "ready",
  "conditional",
  "save-error",
  "conflict",
  "resume",
  "complete",
  "complete-error",
])

export default async function PersonalPlanStage2LabPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>
}) {
  if (process.env.NODE_ENV !== "development") notFound()

  const scenario = (await searchParams).scenario ?? "ready"
  if (!SCENARIOS.has(scenario as Stage2PreviewScenario)) notFound()

  return <Stage2PreviewClient scenario={scenario as Stage2PreviewScenario} />
}
