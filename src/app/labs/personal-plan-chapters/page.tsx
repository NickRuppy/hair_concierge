import { notFound } from "next/navigation"

import type { PersonalPlanChapterStage } from "@/components/personal-plan-journey/journey-content"

import { PersonalPlanChaptersLabClient } from "./lab-client"

// Only stages 3 and 4 still have chapter screens: stage 5 lost its chapter
// with the Routine hero button (field test 26.08.2026), stages 1 and 2 with
// the relic removal (28.08.2026).
const STAGES = new Set([3, 4])

export default async function PersonalPlanChaptersLabPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>
}) {
  if (process.env.NODE_ENV !== "development") notFound()

  const { stage: stageParam } = await searchParams
  const stage = Number(stageParam ?? "3")
  if (!STAGES.has(stage)) notFound()

  return <PersonalPlanChaptersLabClient stage={stage as PersonalPlanChapterStage} />
}
