import { z } from "zod"

import {
  derivePersonalPlanPrimaryMessage,
  type PersonalPlanPrimaryMessage,
} from "@/lib/personal-plan-quiz/prepared-plan"

import type { CustomerIoTransactionalEmailPayload } from "./transactional"

export const PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID = "personal_plan_result_artifact"
export const PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID_ENV =
  "CUSTOMERIO_PERSONAL_PLAN_RESULT_TRANSACTIONAL_MESSAGE_ID"
export const PERSONAL_PLAN_RESULT_ARTIFACT_CTA_LABEL = "Meinen Plan freischalten"

const primaryMessageSchema = z.object({
  kind: z.enum(["concern", "goal", "positive"]),
  label: z.string().trim().min(1).max(500),
})

const diagnosticRowSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  todayLabel: z.string().trim().min(1),
  summary: z.string().trim().min(1),
})

const publicOfferModelSchema = z.object({
  profileLine: z.string().trim().min(1),
  diagnosticRows: z.tuple([diagnosticRowSchema, diagnosticRowSchema, diagnosticRowSchema]),
  primaryMessage: primaryMessageSchema.optional(),
  planFitStatement: z.string().trim().min(1),
})

const prioritySchema = z.object({
  family: z.string().trim().min(1),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal("positive")]),
  variantId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  matchedConcerns: z.array(z.string()),
  isCentral: z.boolean(),
  isFallback: z.boolean().optional(),
})

export interface PersonalPlanResultArtifactEmailInput {
  leadId: string
  email: string
  siteUrl: string
  publicOfferModel: unknown
  priorities: unknown
}

function resultUrl(siteUrl: string, leadId: string): string {
  const url = new URL(`/result/${encodeURIComponent(leadId)}`, siteUrl)
  url.searchParams.set("entry", "result_email")
  url.hash = "pricing"
  return url.toString()
}

function comparisonImageUrl(siteUrl: string): string {
  return new URL("/images/emails/personal-plan-before-after.jpg", siteUrl).toString()
}

export function getPersonalPlanResultArtifactMessageId(): string | number {
  const configured = process.env[PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID_ENV]?.trim()
  if (!configured) return PERSONAL_PLAN_RESULT_ARTIFACT_MESSAGE_ID
  return /^\d+$/.test(configured) ? Number(configured) : configured
}

function resolvePrimaryMessage(
  parsedModel: z.infer<typeof publicOfferModelSchema>,
  priorities: unknown,
): PersonalPlanPrimaryMessage {
  if (parsedModel.primaryMessage) return parsedModel.primaryMessage
  const parsedPriorities = z.array(prioritySchema).min(1).parse(priorities)
  const central = parsedPriorities.find((priority) => priority.isCentral) ?? parsedPriorities[0]
  if (central.family !== parsedModel.diagnosticRows[0].id) {
    throw new Error("Personal-plan email central priority does not match diagnostic row one")
  }
  return derivePersonalPlanPrimaryMessage({
    ...central,
    isFallback: central.isFallback ?? false,
  })
}

export function buildPersonalPlanResultArtifactEmailPayload(
  input: PersonalPlanResultArtifactEmailInput,
): CustomerIoTransactionalEmailPayload {
  const publicOfferModel = publicOfferModelSchema.parse(input.publicOfferModel)
  const primaryMessage = resolvePrimaryMessage(publicOfferModel, input.priorities)

  return {
    to: input.email.trim(),
    transactionalMessageId: getPersonalPlanResultArtifactMessageId(),
    messageData: {
      lead_id: input.leadId,
      profile_line: publicOfferModel.profileLine,
      comparison_image_url: comparisonImageUrl(input.siteUrl),
      primary_message: primaryMessage,
      diagnostic_rows: publicOfferModel.diagnosticRows.map((row) => ({
        id: row.id,
        title: row.title,
        today_label: row.todayLabel,
        summary: row.summary,
      })),
      plan_fit_statement: publicOfferModel.planFitStatement,
      cta_label: PERSONAL_PLAN_RESULT_ARTIFACT_CTA_LABEL,
      result_url: resultUrl(input.siteUrl, input.leadId),
    },
  }
}
