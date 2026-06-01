import { buildQuizResultNarrative } from "@/lib/quiz/result-narrative"
import type { QuizAnswers } from "@/lib/quiz/types"

import type { CustomerIoTransactionalEmailPayload } from "./transactional"

export const QUIZ_RESULT_ARTIFACT_MESSAGE_ID = "quiz_result_artifact"
export const QUIZ_RESULT_ARTIFACT_MESSAGE_ID_ENV = "CUSTOMERIO_QUIZ_RESULT_TRANSACTIONAL_MESSAGE_ID"
export const QUIZ_RESULT_ARTIFACT_CTA_LABEL = "Zur Routine"

export interface QuizResultArtifactEmailInput {
  leadId: string
  name: string
  email: string
  quizAnswers: QuizAnswers
  siteUrl: string
}

function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? ""

  return first.replace(/[^\p{L}\p{N}' -]/gu, "").slice(0, 60)
}

function resultUrl(siteUrl: string, leadId: string): string {
  const url = new URL(`/result/${leadId}`, siteUrl)
  url.searchParams.set("focus", "routine")

  return url.toString()
}

export function getQuizResultArtifactMessageId(): string | number {
  const configured = process.env[QUIZ_RESULT_ARTIFACT_MESSAGE_ID_ENV]?.trim()

  if (!configured) {
    return QUIZ_RESULT_ARTIFACT_MESSAGE_ID
  }

  return /^\d+$/.test(configured) ? Number(configured) : configured
}

export function buildQuizResultArtifactEmailPayload(
  input: QuizResultArtifactEmailInput,
): CustomerIoTransactionalEmailPayload {
  const narrative = buildQuizResultNarrative(input.quizAnswers)

  return {
    to: input.email,
    transactionalMessageId: getQuizResultArtifactMessageId(),
    messageData: {
      lead_id: input.leadId,
      first_name: firstName(input.name),
      headline: narrative.heroHeadline,
      intro: narrative.intro,
      rows: narrative.rows.map((row) => ({
        label: row.label,
        scope: row.scope,
        before: row.before,
        after: row.after,
      })),
      main_lever_title: narrative.needs.mainLeverTitle,
      main_lever_why: narrative.needs.mainLeverWhy,
      routine_levers: narrative.needs.products.map((product) => ({
        name: product.name,
        description: product.description,
      })),
      cta_label: QUIZ_RESULT_ARTIFACT_CTA_LABEL,
      result_url: resultUrl(input.siteUrl, input.leadId),
    },
  }
}
