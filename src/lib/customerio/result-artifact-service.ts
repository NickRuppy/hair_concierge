import { normalizeStoredQuizAnswers } from "@/lib/quiz/normalization"
import { quizAnswersSchema } from "@/lib/quiz/validators"

import { buildQuizResultArtifactEmailPayload } from "./quiz-result-artifact"
import type { CustomerIoTransactionalEmailPayload } from "./transactional"

export interface ResultArtifactLead {
  id: string
  name: string | null
  email: string | null
  quiz_answers: Parameters<typeof normalizeStoredQuizAnswers>[0]
  artifact_email_status: string | null
}

export interface ResultArtifactStore {
  claimLead(leadId: string): Promise<ResultArtifactLead | null>
  markSent(leadId: string): Promise<void>
  markFailed(leadId: string, error: string): Promise<void>
}

export interface HandleResultArtifactEmailInput {
  leadId: string
  siteUrl: string
  store: ResultArtifactStore
  send: (payload: CustomerIoTransactionalEmailPayload) => Promise<void>
}

export interface ResultArtifactEmailResult {
  sent: boolean
  skipped: boolean
}

const MAX_ERROR_LENGTH = 500

function truncateError(message: string): string {
  return message.length > MAX_ERROR_LENGTH ? message.slice(0, MAX_ERROR_LENGTH) : message
}

export function sanitizeArtifactEmailError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown result artifact email error"

  return truncateError(
    raw
      .replace(/secret[-_\s]*token[\w-]*/gi, "[redacted]")
      .replace(/(bearer\s+)[a-z0-9._~+/=-]+/gi, "$1[redacted]")
      .replace(/(api[-_\s]*key[=:]\s*)[a-z0-9._~+/=-]+/gi, "$1[redacted]")
      .trim(),
  )
}

function missingLeadDataError(missing: string[]): string {
  return `Result artifact email missing stored lead data: ${missing.join(", ")}`
}

export async function handleResultArtifactEmail({
  leadId,
  siteUrl,
  store,
  send,
}: HandleResultArtifactEmailInput): Promise<ResultArtifactEmailResult> {
  const lead = await store.claimLead(leadId)

  if (!lead) {
    return { sent: false, skipped: true }
  }

  const missing: string[] = []
  if (!lead.email?.trim()) missing.push("email")
  if (!lead.quiz_answers) missing.push("quiz answers")

  if (missing.length > 0) {
    await store.markFailed(leadId, missingLeadDataError(missing))
    return { sent: false, skipped: false }
  }

  const name = lead.name?.trim() ?? ""
  const email = lead.email?.trim() ?? ""
  const normalizedAnswers = normalizeStoredQuizAnswers(lead.quiz_answers)
  const parsedAnswers = quizAnswersSchema.safeParse(normalizedAnswers)

  if (!parsedAnswers.success) {
    await store.markFailed(leadId, "Result artifact email has incomplete quiz answers")
    return { sent: false, skipped: false }
  }

  const payload = buildQuizResultArtifactEmailPayload({
    leadId,
    name,
    email,
    quizAnswers: parsedAnswers.data,
    siteUrl,
  })

  try {
    await send(payload)
  } catch (error) {
    await store.markFailed(leadId, sanitizeArtifactEmailError(error))
    return { sent: false, skipped: false }
  }

  await store.markSent(leadId)
  return { sent: true, skipped: false }
}
