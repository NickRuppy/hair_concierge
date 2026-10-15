import "server-only"
import { z } from "zod"
import type { CustomerIoTransactionalEmailPayload } from "@/lib/customerio/transactional"

export const PRODUCT_INTAKE_ADMIN_REVIEW_MESSAGE_ID_ENV =
  "CUSTOMERIO_PRODUCT_INTAKE_REVIEW_TRANSACTIONAL_MESSAGE_ID"
export const PRODUCT_INTAKE_ADMIN_REVIEW_ALERT_EMAIL_ENV = "PRODUCT_INTAKE_REVIEW_ALERT_EMAIL"

export const ADMIN_REVIEW_EMAIL_SUBJECT =
  "{% if trigger.is_test %}[TEST] {% endif %}Produktprüfung: {{ trigger.outcome_label }}"

const REVIEW_ORIGIN = "https://chaarlie.de"
const GENERIC_PRODUCT_NAME = "Produkt zur Prüfung"
const MAX_TEXT_LENGTH = 180

export const ADMIN_REVIEW_QUESTION_CODES = [
  "research_gaps",
  "research_blockers",
  "image_review",
] as const
export type AdminReviewQuestionCode = (typeof ADMIN_REVIEW_QUESTION_CODES)[number]

export const ADMIN_REVIEW_OUTCOMES = ["ready_for_review", "needs_nick"] as const
export type AdminReviewOutcome = (typeof ADMIN_REVIEW_OUTCOMES)[number]

const CATEGORY_LABELS: Record<string, string> = {
  shampoo: "Shampoo",
  conditioner: "Conditioner",
  leave_in: "Leave-in",
  heat_protectant: "Hitzeschutz",
  oil: "Haaröl",
  mask: "Haarmaske",
  scalp_care: "Kopfhautpflege",
  dry_shampoo: "Trockenshampoo",
  bondbuilder: "Bondbuilder",
  deep_cleansing_shampoo: "Tiefenreinigung",
}

const OUTCOME_LABELS: Record<AdminReviewOutcome, string> = {
  ready_for_review: "Bereit zur Prüfung",
  needs_nick: "Entscheidung nötig",
}

const QUESTION_LABELS: Record<AdminReviewQuestionCode, string> = {
  research_gaps: "Bitte prüfe die noch fehlenden Rechercheangaben.",
  research_blockers: "Bitte entscheide über die offenen Recherchepunkte.",
  image_review: "Bitte prüfe die Produktbilder separat.",
}

export type AdminReviewEmailSnapshot = {
  product_name: string
  category_label: string
  outcome_label: string
  question_1: string
  question_2: string
  question_3: string
  review_url: string
  is_test: boolean
}

export type AdminReviewSnapshotInput = {
  submissionId: string
  category?: string | null
  researchedPayload: unknown
  outcome: AdminReviewOutcome
  questionCodes?: readonly AdminReviewQuestionCode[]
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function safeIdentityPart(value: unknown): string | null {
  if (typeof value !== "string") return null
  const text = value.trim().replace(/\s+/g, " ")
  if (
    !text ||
    text.length > MAX_TEXT_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(text) ||
    /@|:\/\/|\b(?:https?|www\.)\b/i.test(text)
  )
    return null
  return text
}

function publicProductName(researchedPayload: unknown): string {
  const final = record(researchedPayload)?.final
  const product = record(record(final)?.product)
  const brand = safeIdentityPart(product?.canonical_brand)
  const name = safeIdentityPart(product?.clean_name)
  if (!brand || !name) return GENERIC_PRODUCT_NAME
  const value = `${brand} ${name}`.trim()
  return value.length <= MAX_TEXT_LENGTH ? value : GENERIC_PRODUCT_NAME
}

export function adminReviewURL(submissionId: string): string {
  if (!z.uuid().safeParse(submissionId).success)
    throw new Error("Invalid admin review submission ID")
  return new URL(`/admin/produkt-intake/${submissionId}`, REVIEW_ORIGIN).toString()
}

export function buildAdminReviewSnapshot(
  input: AdminReviewSnapshotInput,
): AdminReviewEmailSnapshot {
  if (!ADMIN_REVIEW_OUTCOMES.includes(input.outcome))
    throw new Error("Invalid admin review outcome")
  const seen = new Set<AdminReviewQuestionCode>()
  const questions = (input.questionCodes ?? []).flatMap((code) => {
    if (!ADMIN_REVIEW_QUESTION_CODES.includes(code))
      throw new Error("Invalid admin review question")
    if (seen.has(code)) return []
    seen.add(code)
    return [QUESTION_LABELS[code]]
  })
  if (questions.length > 3) throw new Error("Too many admin review questions")
  return {
    product_name: publicProductName(input.researchedPayload),
    // Context can be absent on an otherwise valid terminal outcome. Never
    // substitute a raw submission value into an alert; use the neutral label.
    category_label:
      (typeof input.category === "string" && CATEGORY_LABELS[input.category]) || "Produkt",
    outcome_label: OUTCOME_LABELS[input.outcome],
    question_1: questions[0] ?? "",
    question_2: questions[1] ?? "",
    question_3: questions[2] ?? "",
    review_url: adminReviewURL(input.submissionId),
    is_test: false,
  }
}

const snapshotSchema = z
  .object({
    product_name: z.string().min(1).max(MAX_TEXT_LENGTH),
    category_label: z.string().min(1).max(MAX_TEXT_LENGTH),
    outcome_label: z.enum([OUTCOME_LABELS.ready_for_review, OUTCOME_LABELS.needs_nick]),
    question_1: z.string().max(MAX_TEXT_LENGTH),
    question_2: z.string().max(MAX_TEXT_LENGTH),
    question_3: z.string().max(MAX_TEXT_LENGTH),
    review_url: z.string(),
    is_test: z.boolean(),
  })
  .strict()

function safeSnapshotText(value: string, allowBlank = false) {
  return (
    (allowBlank || value.length > 0) &&
    !/[\u0000-\u001f\u007f]/.test(value) &&
    !/@|:\/\/|\b(?:https?|www\.)\b/i.test(value)
  )
}

/** Validate the narrowly allow-listed payload read from the outbox before it reaches a provider. */
export function validateAdminReviewSnapshot(
  value: unknown,
  options: { test?: boolean } = {},
): AdminReviewEmailSnapshot {
  const snapshot = snapshotSchema.parse(value)
  if (snapshot.is_test !== Boolean(options.test)) throw new Error("Invalid admin review test mode")
  if (
    !safeSnapshotText(snapshot.product_name) ||
    !safeSnapshotText(snapshot.category_label) ||
    !safeSnapshotText(snapshot.outcome_label) ||
    !safeSnapshotText(snapshot.question_1, true) ||
    !safeSnapshotText(snapshot.question_2, true) ||
    !safeSnapshotText(snapshot.question_3, true)
  )
    throw new Error("Invalid admin review snapshot text")
  const detailUrl =
    /^https:\/\/chaarlie\.de\/admin\/produkt-intake\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      snapshot.review_url,
    )
  const testAdminUrl =
    options.test === true &&
    snapshot.is_test === true &&
    snapshot.review_url === "https://chaarlie.de/admin"
  if (options.test ? !testAdminUrl : !detailUrl) throw new Error("Invalid admin review URL")
  return snapshot
}

export function adminReviewMessageId(): string | number {
  const value = process.env[PRODUCT_INTAKE_ADMIN_REVIEW_MESSAGE_ID_ENV]?.trim()
  if (!value || value.length > 200 || /[\r\n]/.test(value))
    throw new Error("Product Intake review transactional message ID is not configured")
  return /^\d+$/.test(value) ? Number(value) : value
}

export function buildAdminReviewEmail(
  snapshot: AdminReviewEmailSnapshot,
  recipient = process.env[PRODUCT_INTAKE_ADMIN_REVIEW_ALERT_EMAIL_ENV],
  messageId = adminReviewMessageId(),
  options: { test?: boolean } = {},
): CustomerIoTransactionalEmailPayload {
  const email = recipient?.trim() ?? ""
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\r\n]/.test(email))
    throw new Error("Product Intake review alert recipient is not configured")
  return {
    to: email,
    transactionalMessageId: messageId,
    tracked: false,
    messageData: validateAdminReviewSnapshot(snapshot, options),
  }
}
