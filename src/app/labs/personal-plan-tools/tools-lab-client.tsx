"use client"

import { useState } from "react"

import { ToolCheckpoint } from "@/components/personal-plan-refinement/tool-checkpoint"
import { RefinementQuestion } from "@/components/personal-plan-refinement/refinement-question"
import { RoutinePage } from "@/components/routine/personal-plan"
import type { Stage2RefinementSession } from "@/lib/personal-plan/refinement/session"
import type { Stage2QuestionId } from "@/lib/personal-plan/refinement/types"
import type { PersonalPlanRoutineView } from "@/lib/personal-plan/routine/contracts"
import type { PortfolioPresentation } from "@/lib/personal-plan/routine/portfolio-presentation"
import type { ToolCheckpointGroup } from "@/lib/personal-plan/tools/checkpoint"

/** Dev-only client shell: the real components, with inert handlers. */

export function ToolsLabRefinementQuestion({
  session,
  questionId,
}: {
  session: Stage2RefinementSession
  questionId: Stage2QuestionId
}) {
  const [answer, setAnswer] = useState<unknown>(undefined)
  return (
    <RefinementQuestion
      session={session}
      questionId={questionId}
      localAnswer={answer}
      onLocalAnswerChange={setAnswer}
      status="idle"
      canGoBack
      onBack={() => {}}
      onSubmit={() => {}}
      onSecondaryExit={() => {}}
      focusOnQuestionChange={false}
    />
  )
}

export function ToolsLabCheckpoint({ groups }: { groups: ToolCheckpointGroup[] }) {
  return <ToolCheckpoint groups={groups} onContinue={() => {}} onAddTools={() => {}} />
}

export function ToolsLabRoutine({
  view,
  portfolioPresentation,
}: {
  view: PersonalPlanRoutineView
  portfolioPresentation: PortfolioPresentation
}) {
  return <RoutinePage view={view} portfolioPresentation={portfolioPresentation} />
}
