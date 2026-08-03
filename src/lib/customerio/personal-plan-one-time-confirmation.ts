import { z } from "zod"

import type { CustomerIoMessageData, CustomerIoTransactionalEmailPayload } from "./transactional"
import { sendCustomerIoTransactionalEmail } from "./transactional"

export const PERSONAL_PLAN_ONE_TIME_CONFIRMATION_MESSAGE_ID = "personal_plan_one_time_confirmation"
export const PERSONAL_PLAN_ONE_TIME_CONFIRMATION_MESSAGE_ID_ENV =
  "CUSTOMERIO_PERSONAL_PLAN_ONE_TIME_CONFIRMATION_TRANSACTIONAL_MESSAGE_ID"

const PERSONAL_PLAN_NAME = "Persönlicher Haarplan"
const PERSONAL_PLAN_AMOUNT_EUR = "29.99"
const PERSONAL_PLAN_CURRENCY = "EUR"

const contractSnapshotSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("purchase_context"),
    text: z
      .string()
      .min(1)
      .max(2_000)
      .refine((value) => value.trim().length > 0, "Purchase-context text is required"),
    version: z.string().trim().min(1).max(100),
    createdAt: z.string().datetime({ offset: true }),
  }),
  z.object({
    kind: z.literal("historical_consent"),
    text: z
      .string()
      .min(1)
      .max(2_000)
      .refine((value) => value.trim().length > 0, "Consent text is required"),
    version: z.string().trim().min(1).max(100),
    acceptedAt: z.string().datetime({ offset: true }),
  }),
])

const confirmationInputSchema = z.object({
  email: z.string().trim().email(),
  contractSnapshot: contractSnapshotSchema,
  payment: z.object({
    provider: z.enum(["stripe", "paypal"]),
    reference: z.string().trim().min(1).max(500),
  }),
  supportUrl: z.string().trim().url(),
  withdrawalUrl: z.string().trim().url(),
  resultUrl: z.string().trim().url().optional(),
})

export type PersonalPlanOneTimeConfirmationInput = z.input<typeof confirmationInputSchema>

export type PersonalPlanOneTimeConfirmationSendResult = {
  confirmationReference: string
}

export type SendPersonalPlanOneTimeConfirmationDependencies = {
  send?: (payload: CustomerIoTransactionalEmailPayload) => Promise<void>
}

export function getPersonalPlanOneTimeConfirmationMessageId(
  environment: Record<string, string | undefined> = process.env,
): string | number {
  const configured = environment[PERSONAL_PLAN_ONE_TIME_CONFIRMATION_MESSAGE_ID_ENV]?.trim()
  if (!configured) return PERSONAL_PLAN_ONE_TIME_CONFIRMATION_MESSAGE_ID
  return /^\d+$/.test(configured) ? Number(configured) : configured
}

export function buildPersonalPlanOneTimeConfirmationReference(input: {
  provider: "stripe" | "paypal"
  reference: string
}): string {
  const payment = confirmationInputSchema.shape.payment.parse(input)
  return `customerio:${PERSONAL_PLAN_ONE_TIME_CONFIRMATION_MESSAGE_ID}:${payment.provider}:${payment.reference}`
}

export function buildPersonalPlanOneTimeConfirmationPayload(
  input: PersonalPlanOneTimeConfirmationInput,
): CustomerIoTransactionalEmailPayload {
  const parsed = confirmationInputSchema.parse(input)
  const providerLabel = parsed.payment.provider === "stripe" ? "Stripe" : "PayPal"
  const contractSnapshotData: CustomerIoMessageData =
    parsed.contractSnapshot.kind === "purchase_context"
      ? {
          purchase_context_text: parsed.contractSnapshot.text,
          purchase_context_version: parsed.contractSnapshot.version,
          purchase_context_created_at: parsed.contractSnapshot.createdAt,
        }
      : {
          consent_text: parsed.contractSnapshot.text,
          consent_version: parsed.contractSnapshot.version,
          consent_accepted_at: parsed.contractSnapshot.acceptedAt,
        }

  return {
    to: parsed.email,
    transactionalMessageId: getPersonalPlanOneTimeConfirmationMessageId(),
    messageData: {
      product_name: PERSONAL_PLAN_NAME,
      amount_eur: PERSONAL_PLAN_AMOUNT_EUR,
      currency: PERSONAL_PLAN_CURRENCY,
      is_subscription: false,
      subscription_text: "Kein Abo. Es handelt sich um eine einmalige Zahlung.",
      ...contractSnapshotData,
      payment_provider: providerLabel,
      payment_reference: parsed.payment.reference,
      support_contact_url: parsed.supportUrl,
      withdrawal_url: parsed.withdrawalUrl,
      ...(parsed.resultUrl ? { result_url: parsed.resultUrl } : {}),
    },
  }
}

/**
 * Sends the paid-contract confirmation after payment verification. A successful App API response
 * establishes only `sent`; delivery requires separate provider evidence before it may be recorded.
 */
export async function sendPersonalPlanOneTimeConfirmation(
  input: PersonalPlanOneTimeConfirmationInput,
  dependencies: SendPersonalPlanOneTimeConfirmationDependencies = {},
): Promise<PersonalPlanOneTimeConfirmationSendResult> {
  const payload = buildPersonalPlanOneTimeConfirmationPayload(input)
  await (dependencies.send ?? sendCustomerIoTransactionalEmail)(payload)

  return {
    confirmationReference: buildPersonalPlanOneTimeConfirmationReference({
      provider: confirmationInputSchema.parse(input).payment.provider,
      reference: confirmationInputSchema.parse(input).payment.reference,
    }),
  }
}
