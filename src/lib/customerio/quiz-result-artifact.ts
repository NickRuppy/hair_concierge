import {
  APP_VALUE_STACK_CTA_LABEL,
  APP_VALUE_STACK_STORIES,
  buildAppValueStackHeroCopy,
} from "@/lib/quiz/app-value-stack-copy"
import { buildQuizOfferPreview } from "@/lib/quiz/offer-preview"
import { buildQuizResultNarrative } from "@/lib/quiz/result-narrative"
import type { QuizAnswers } from "@/lib/quiz/types"

import type { CustomerIoTransactionalEmailPayload } from "./transactional"

export const QUIZ_RESULT_ARTIFACT_MESSAGE_ID = "quiz_result_artifact"
export const QUIZ_RESULT_ARTIFACT_MESSAGE_ID_ENV = "CUSTOMERIO_QUIZ_RESULT_TRANSACTIONAL_MESSAGE_ID"
export const QUIZ_RESULT_ARTIFACT_CTA_LABEL = APP_VALUE_STACK_CTA_LABEL

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
  const url = new URL(`/result/${encodeURIComponent(leadId)}`, siteUrl)
  url.searchParams.set("focus", "unlock-plan")
  url.searchParams.set("entry", "result_email")

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
  const preview = buildQuizOfferPreview(input.quizAnswers)
  const sanitizedFirstName = firstName(input.name)
  const hero = buildAppValueStackHeroCopy({
    name: sanitizedFirstName,
    narrative,
    lane: preview.lane,
  })
  const foundationProducts = preview.products.filter((product) => !product.suggested)

  return {
    to: input.email,
    transactionalMessageId: getQuizResultArtifactMessageId(),
    messageData: {
      lead_id: input.leadId,
      first_name: sanitizedFirstName,
      headline: hero.headline,
      intro: hero.intro,
      signals: preview.signals.map((signal) => ({
        label: signal.label,
        conclusion: signal.conclusion,
      })),
      foundation_products: foundationProducts.map((product) => ({
        category_label: product.categoryLabel,
        name: product.name,
        note: product.note,
        image_url: product.imageUrl,
        cadence_label: product.cadence.label,
        cadence_qualifier: product.cadence.qualifier ?? "",
      })),
      app_stories: APP_VALUE_STACK_STORIES.map((story) => ({
        label: story.label,
        headline: story.headline,
        body: story.body,
      })),
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
