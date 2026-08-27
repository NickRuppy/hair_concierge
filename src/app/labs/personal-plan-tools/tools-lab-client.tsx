"use client"

import { useState } from "react"

import { Stage3ToolCheckpoint } from "@/components/personal-plan-products/tool-checkpoint"
import { RefinementQuestion } from "@/components/personal-plan-refinement/refinement-question"
import { RoutinePage } from "@/components/routine/personal-plan/routine-page"
import type { PersonalPlanRoutineView } from "@/lib/personal-plan/routine/contracts"
import type { Stage2RefinementSession } from "@/lib/personal-plan/refinement/session"
import type { Stage2QuestionId } from "@/lib/personal-plan/refinement/types"
import type { ToolCardViewModel } from "@/lib/personal-plan/tools/presentation"

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

export function ToolsLabCheckpoint({ cards }: { cards: ToolCardViewModel[] }) {
  return <Stage3ToolCheckpoint cards={cards} onContinue={() => {}} />
}

export function ToolsLabRoutine({ view }: { view: PersonalPlanRoutineView }) {
  return <RoutinePage view={view} />
}
