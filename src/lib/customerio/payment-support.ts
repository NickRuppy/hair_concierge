import { z } from "zod"

import {
  sendCustomerIoTransactionalEmailWithReceipt,
  type CustomerIoTransactionalDeliveryReceipt,
  type CustomerIoTransactionalEmailPayload,
} from "./transactional"

export const PAYMENT_SUPPORT_RECEIPT_MESSAGE_ID_ENV =
  "CUSTOMERIO_PAYMENT_SUPPORT_RECEIPT_TRANSACTIONAL_MESSAGE_ID"
export const PAYMENT_SUPPORT_RESOLUTION_MESSAGE_ID_ENV =
  "CUSTOMERIO_PAYMENT_SUPPORT_RESOLUTION_TRANSACTIONAL_MESSAGE_ID"

const reportCodeSchema = z.string().regex(/^PAY-[23456789ABCDEFGHJKMNPQRSTUVWXYZ_]{8}$/)
const attemptIdSchema = z.string().trim().min(1).max(120)
const recipientSchema = z.string().trim().email()
const resolutionNoteSchema = z.string().trim().min(1).max(600)

type PaymentSupportMessageKind = "receipt" | "resolution"

export function getPaymentSupportMessageId(
  kind: PaymentSupportMessageKind,
  environment: Record<string, string | undefined> = process.env,
): string | number {
  const key =
    kind === "receipt"
      ? PAYMENT_SUPPORT_RECEIPT_MESSAGE_ID_ENV
      : PAYMENT_SUPPORT_RESOLUTION_MESSAGE_ID_ENV
  const configured = environment[key]?.trim()
  if (!configured) throw new Error(`${key} is not set`)
  return /^\d+$/.test(configured) ? Number(configured) : configured
}

export type PaymentSupportReceiptInput = {
  email: string
  reportCode: string
  attemptId: string
}

export type PaymentSupportResolutionInput = PaymentSupportReceiptInput & {
  resolutionNote: string
}

export function buildPaymentSupportReceiptPayload(
  input: PaymentSupportReceiptInput,
  environment: Record<string, string | undefined> = process.env,
): CustomerIoTransactionalEmailPayload {
  const email = recipientSchema.parse(input.email)
  const reportCode = reportCodeSchema.parse(input.reportCode)
  const attemptId = attemptIdSchema.parse(input.attemptId)
  return {
    to: email,
    transactionalMessageId: getPaymentSupportMessageId("receipt", environment),
    messageData: {
      report_code: reportCode,
      delivery_attempt_id: attemptId,
    },
  }
}

export function buildPaymentSupportResolutionPayload(
  input: PaymentSupportResolutionInput,
  environment: Record<string, string | undefined> = process.env,
): CustomerIoTransactionalEmailPayload {
  const email = recipientSchema.parse(input.email)
  const reportCode = reportCodeSchema.parse(input.reportCode)
  const attemptId = attemptIdSchema.parse(input.attemptId)
  return {
    to: email,
    transactionalMessageId: getPaymentSupportMessageId("resolution", environment),
    messageData: {
      report_code: reportCode,
      delivery_attempt_id: attemptId,
      resolution_note: resolutionNoteSchema.parse(input.resolutionNote),
    },
  }
}

type PaymentSupportSenderDependencies = {
  environment?: Record<string, string | undefined>
  send?: (
    payload: CustomerIoTransactionalEmailPayload,
  ) => Promise<CustomerIoTransactionalDeliveryReceipt>
}

export async function sendPaymentSupportReceipt(
  input: PaymentSupportReceiptInput,
  dependencies: PaymentSupportSenderDependencies = {},
) {
  return (dependencies.send ?? sendCustomerIoTransactionalEmailWithReceipt)(
    buildPaymentSupportReceiptPayload(input, dependencies.environment),
  )
}

export async function sendPaymentSupportResolution(
  input: PaymentSupportResolutionInput,
  dependencies: PaymentSupportSenderDependencies = {},
) {
  return (dependencies.send ?? sendCustomerIoTransactionalEmailWithReceipt)(
    buildPaymentSupportResolutionPayload(input, dependencies.environment),
  )
}
