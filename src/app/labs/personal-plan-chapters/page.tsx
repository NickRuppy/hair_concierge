import { notFound } from "next/navigation"

import type { PersonalPlanJourneyStage } from "@/components/personal-plan-journey/journey-content"

import { PersonalPlanChaptersLabClient } from "./lab-client"

const STAGES = new Set([1, 2, 3, 4, 5])

export default async function PersonalPlanChaptersLabPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; screen?: string }>
}) {
  if (process.env.NODE_ENV !== "development") notFound()

  const { stage: stageParam, screen } = await searchParams

  if (screen === "fork") {
    return <PersonalPlanChaptersLabClient stage={1} screen="fork" />
  }

  const stage = Number(stageParam ?? "1")
  if (!STAGES.has(stage)) notFound()

  return <PersonalPlanChaptersLabClient stage={stage as PersonalPlanJourneyStage} />
}
