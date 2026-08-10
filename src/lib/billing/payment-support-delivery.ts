import { randomUUID } from "node:crypto"

import { sendPaymentSupportReceipt } from "@/lib/customerio/payment-support"
import {
  CustomerIoAmbiguousDeliveryError,
  CustomerIoHttpError,
  type CustomerIoTransactionalDeliveryReceipt,
} from "@/lib/customerio/transactional"
import { createAdminClient } from "@/lib/supabase/admin"

export type PaymentSupportReceiptClaim = {
  caseId: string
  reportCode: string
  attemptId: string
  identity: { kind: "lead" | "user"; id: string }
}

type PaymentSupportReceiptOutcome =
  | { status: "sent"; deliveryId: string }
  | { status: "failed" | "delivery_uncertain"; deliveryId?: never }

type PaymentSupportReceiptDependencies = {
  claim: (caseId: string) => Promise<PaymentSupportReceiptClaim | null>
  resolveRecipient: (identity: PaymentSupportReceiptClaim["identity"]) => Promise<string>
  send: (input: {
    email: string
    reportCode: string
    attemptId: string
  }) => Promise<CustomerIoTransactionalDeliveryReceipt>
  settle: (
    claim: PaymentSupportReceiptClaim,
    outcome: PaymentSupportReceiptOutcome,
  ) => Promise<void>
}

class PaymentSupportRecipientError extends Error {}

async function claimPaymentSupportReceipt(
  caseId: string,
): Promise<PaymentSupportReceiptClaim | null> {
  const attemptId = randomUUID()
  const { data, error } = await createAdminClient()
    .from("payment_support_cases")
    .update({
      receipt_delivery_status: "sending",
      receipt_attempt_id: attemptId,
      receipt_sending_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", caseId)
    .eq("receipt_delivery_status", "pending")
    .select("id, report_code, lead_id, user_id")
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const identity =
    typeof data.lead_id === "string"
      ? ({ kind: "lead", id: data.lead_id } as const)
      : typeof data.user_id === "string"
        ? ({ kind: "user", id: data.user_id } as const)
        : null
  if (!identity || typeof data.report_code !== "string") {
    throw new PaymentSupportRecipientError("payment support identity is unavailable")
  }
  return { caseId: data.id, reportCode: data.report_code, attemptId, identity }
}

async function resolvePaymentSupportRecipient(
  identity: PaymentSupportReceiptClaim["identity"],
): Promise<string> {
  const admin = createAdminClient()
  if (identity.kind === "lead") {
    const { data, error } = await admin
      .from("leads")
      .select("email")
      .eq("id", identity.id)
      .maybeSingle()
    if (error || typeof data?.email !== "string") {
      throw new PaymentSupportRecipientError("payment support lead email is unavailable")
    }
    return data.email
  }
  const { data, error } = await admin.auth.admin.getUserById(identity.id)
  if (error || typeof data.user?.email !== "string") {
    throw new PaymentSupportRecipientError("payment support user email is unavailable")
  }
  return data.user.email
}

async function settlePaymentSupportReceipt(
  claim: PaymentSupportReceiptClaim,
  outcome: PaymentSupportReceiptOutcome,
) {
  const now = new Date().toISOString()
  const values =
    outcome.status === "sent"
      ? {
          receipt_delivery_status: "sent",
          receipt_customerio_delivery_id: outcome.deliveryId,
          receipt_sent_at: now,
          updated_at: now,
        }
      : {
          receipt_delivery_status: outcome.status,
          receipt_failed_at: now,
          updated_at: now,
        }
  const { data, error } = await createAdminClient()
    .from("payment_support_cases")
    .update(values)
    .eq("id", claim.caseId)
    .eq("receipt_attempt_id", claim.attemptId)
    .eq("receipt_delivery_status", "sending")
    .select("id")
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error("payment support receipt settlement lost its delivery claim")
}

const defaultDependencies: PaymentSupportReceiptDependencies = {
  claim: claimPaymentSupportReceipt,
  resolveRecipient: resolvePaymentSupportRecipient,
  send: sendPaymentSupportReceipt,
  settle: settlePaymentSupportReceipt,
}

export async function deliverPaymentSupportReceipt(
  caseId: string,
  overrides: Partial<PaymentSupportReceiptDependencies> = {},
): Promise<void> {
  const dependencies = { ...defaultDependencies, ...overrides }
  const claim = await dependencies.claim(caseId)
  if (!claim) return

  try {
    const email = await dependencies.resolveRecipient(claim.identity)
    const receipt = await dependencies.send({
      email,
      reportCode: claim.reportCode,
      attemptId: claim.attemptId,
    })
    await dependencies.settle(claim, { status: "sent", deliveryId: receipt.deliveryId })
  } catch (error) {
    const status =
      error instanceof CustomerIoAmbiguousDeliveryError
        ? "delivery_uncertain"
        : error instanceof CustomerIoHttpError || error instanceof PaymentSupportRecipientError
          ? "failed"
          : "delivery_uncertain"
    await dependencies.settle(claim, { status })
  }
}
