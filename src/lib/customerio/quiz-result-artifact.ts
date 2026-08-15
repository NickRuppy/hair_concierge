import { buildPersonalPlanAssessmentRows } from "@/lib/personal-plan-quiz/assessment-copy"
import { assessPersonalPlanHair } from "@/lib/personal-plan-quiz/hair-assessment"
import { adaptLegacyQuizAnswersForAssessment } from "@/lib/personal-plan-quiz/offer-adapter"
import { derivePersonalPlanPrimaryMessage } from "@/lib/personal-plan-quiz/prepared-plan"
import { rankGuidedStoryPriorities } from "@/lib/quiz/guided-story-priorities"
import type { QuizAnswers } from "@/lib/quiz/types"

import { buildPersonalPlanResultArtifactEmailPayload } from "./personal-plan-result-artifact"
import type { CustomerIoTransactionalEmailPayload } from "./transactional"

export interface QuizResultArtifactEmailInput {
  leadId: string
  name: string
  email: string
  quizAnswers: QuizAnswers
  siteUrl: string
}

const structureLabels: Record<string, string> = {
  straight: "glattes",
  wavy: "welliges",
  curly: "lockiges",
  coily: "stark gelocktes",
}

const thicknessLabels: Record<string, string> = {
  fine: "feines",
  normal: "mittelstarkes",
  coarse: "kräftiges",
}

function profileLine(answers: QuizAnswers): string {
  const texture = answers.structure ? structureLabels[answers.structure] : null
  const thickness = answers.thickness ? thicknessLabels[answers.thickness] : null
  if (texture && thickness) return `Für ${texture}, ${thickness} Haar`
  return "Für dein persönliches Haarprofil"
}

/**
 * The regular quiz now uses the same compact Customer.io result email as the
 * Personal Plan quiz. Its public diagnosis is derived from the same assessment
 * model as the regular result page; product and routine details stay behind the
 * result-page paywall.
 */
export function buildQuizResultArtifactEmailPayload(
  input: QuizResultArtifactEmailInput,
): CustomerIoTransactionalEmailPayload {
  const diagnosticInput = adaptLegacyQuizAnswersForAssessment(input.quizAnswers)
  const assessment = assessPersonalPlanHair(diagnosticInput)
  const diagnosticRows = buildPersonalPlanAssessmentRows(assessment, diagnosticInput)
  const priorities = rankGuidedStoryPriorities(input.quizAnswers)
  const centralPriority = priorities.find((priority) => priority.isCentral) ?? priorities[0]

  if (!centralPriority) {
    throw new Error("Regular quiz result email could not produce a central priority")
  }

  return buildPersonalPlanResultArtifactEmailPayload({
    email: input.email,
    leadId: input.leadId,
    priorities,
    publicOfferModel: {
      modelVersion: "personal_plan_offer_v2",
      profileLine: profileLine(input.quizAnswers),
      diagnosticRows,
      primaryMessage: derivePersonalPlanPrimaryMessage(centralPriority),
      planFitStatement:
        "Eine verlässliche Richtung für dein Haar: Dein Plan baut auf deiner Ausgangslage auf und macht die nächsten Pflegeschritte klar.",
    },
    siteUrl: input.siteUrl,
  })
}
