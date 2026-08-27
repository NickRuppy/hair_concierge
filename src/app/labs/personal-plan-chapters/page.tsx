import { notFound } from "next/navigation"

import type { PersonalPlanChapterStage } from "@/components/personal-plan-journey/journey-content"

import { PersonalPlanChaptersLabClient } from "./lab-client"

// Stage 5 has no chapter screen any more (field test 26.08.2026).
const STAGES = new Set([1, 2, 3, 4])

export default async function PersonalPlanChaptersLabPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>
}) {
  if (process.env.NODE_ENV !== "development") notFound()

  const { stage: stageParam } = await searchParams
  const stage = Number(stageParam ?? "1")
  if (!STAGES.has(stage)) notFound()

  return <PersonalPlanChaptersLabClient stage={stage as PersonalPlanChapterStage} />
}
