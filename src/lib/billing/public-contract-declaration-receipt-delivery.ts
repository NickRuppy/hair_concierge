import "server-only"

import {
  publicDeclarationReceiptText,
  type PublicContractDeclarationReceipt,
} from "@/lib/billing/public-contract-declaration"
import {
  CustomerIoAmbiguousDeliveryError,
  CustomerIoHttpError,
  sendCustomerIoTransactionalEmailWithReceipt,
  type CustomerIoTransactionalDeliveryReceipt,
} from "@/lib/customerio/transactional"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  buildRequiredNoticeEmail,
  DEFAULT_REQUIRED_NOTICE_SENDER,
  DEFAULT_REQUIRED_NOTICE_TRIGGER,
  REQUIRED_NOTICE_FROM_ENV,
} from "@/lib/customerio/trial-required-notices"

// One claim per invocation keeps the active lease longer than the 60-second
// route budget, including the bounded provider request below.
export const PUBLIC_DECLARATION_RECEIPT_DELIVERY_LIMIT = 1
export const PUBLIC_DECLARATION_RECEIPT_DELIVERY_LEASE_SECONDS = 90
export const PUBLIC_CONTRACT_DECLARATION_RECEIPT_MESSAGE_ID_ENV =
  "CUSTOMERIO_PUBLIC_CONTRACT_DECLARATION_RECEIPT_TRANSACTIONAL_MESSAGE_ID"

type RpcResult = { data: unknown; error: unknown }

export type PublicDeclarationReceiptClaim = Readonly<{
  declarationId: string
  attemptId: string
  receiptPayload: PublicContractDeclarationReceipt
}>

type Outcome =
  | { status: "queued"; deliveryId: string; queuedAt: string | number }
  | { status: "retryable_error" | "support_required"; errorCode: string }

type Dependencies = Readonly<{
  messageId: string | undefined
  apiKeyPresent: boolean
  claim: () => Promise<unknown[]>
  send: (input: {
    email: string
    messageId: string
    receiptText: string
  }) => Promise<CustomerIoTransactionalDeliveryReceipt>
  settle: (claim: PublicDeclarationReceiptClaim, outcome: Outcome) => Promise<void>
}>

export type PublicDeclarationReceiptDeliveryStats = Readonly<{
  claimed: number
  queued: number
  retryable: number
  supportRequired: number
  blocked: boolean
}>

type ReceiptClient = Readonly<{
  rpc: (name: string, args: Record<string, string>) => PromiseLike<RpcResult>
}>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseClaim(value: unknown): PublicDeclarationReceiptClaim | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const receipt = row.receipt_payload
  if (
    typeof row.declaration_id !== "string" ||
    !UUID.test(row.declaration_id) ||
    typeof row.attempt_id !== "string" ||
    !UUID.test(row.attempt_id) ||
    !receipt ||
    typeof receipt !== "object" ||
    Array.isArray(receipt)
  )
    return null
  const snapshot = receipt as Record<string, unknown>
  const declaration = snapshot.declaration
  if (
    typeof snapshot.declarationId !== "string" ||
    snapshot.declarationId !== row.declaration_id ||
    typeof snapshot.submittedAt !== "string" ||
    !Number.isFinite(Date.parse(snapshot.submittedAt)) ||
    !declaration ||
    typeof declaration !== "object" ||
    Array.isArray(declaration)
  )
    return null
  const d = declaration as Record<string, unknown>
  const kinds = ["ordinary_cancellation", "extraordinary_cancellation", "withdrawal"]
  if (
    typeof d.requestId !== "string" ||
    !UUID.test(d.requestId) ||
    !kinds.includes(String(d.kind)) ||
    typeof d.name !== "string" ||
    typeof d.email !== "string" ||
    typeof d.contract !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email) ||
    !(typeof d.requestedEnd === "string" || d.requestedEnd === null) ||
    !(typeof d.reason === "string" || d.reason === null)
  )
    return null
  return {
    declarationId: row.declaration_id,
    attemptId: row.attempt_id,
    receiptPayload: snapshot as PublicContractDeclarationReceipt,
  }
}

async function claimPublicDeclarationReceiptDelivery(): Promise<unknown[]> {
  const client = createAdminClient() as ReceiptClient
  const { data, error } = await client.rpc("claim_public_contract_declaration_receipt_deliveries", {
    p_limit: String(PUBLIC_DECLARATION_RECEIPT_DELIVERY_LIMIT),
    p_lease_seconds: String(PUBLIC_DECLARATION_RECEIPT_DELIVERY_LEASE_SECONDS),
  })
  if (error || !Array.isArray(data)) throw new Error("Unable to claim declaration receipt delivery")
  return data
}

async function settlePublicDeclarationReceiptDelivery(
  claim: PublicDeclarationReceiptClaim,
  outcome: Outcome,
) {
  const client = createAdminClient() as ReceiptClient
  const args: Record<string, string> = {
    p_declaration_id: claim.declarationId,
    p_attempt_id: claim.attemptId,
    p_outcome: outcome.status,
    p_error_code: "errorCode" in outcome ? outcome.errorCode : "",
    p_provider_delivery_id: "deliveryId" in outcome ? outcome.deliveryId : "",
    p_provider_queued_at: "queuedAt" in outcome ? String(outcome.queuedAt) : "",
  }
  const { data, error } = await client.rpc(
    "complete_public_contract_declaration_receipt_delivery",
    args,
  )
  if (error || data !== true) throw new Error("Unable to settle declaration receipt delivery")
}

function configuredMessageId(value: string | undefined) {
  const id = value?.trim()
  return id && id.length <= 200 ? id : null
}

function errorOutcome(error: unknown): Outcome {
  if (error instanceof CustomerIoAmbiguousDeliveryError) {
    // Customer.io's transactional endpoint has no per-send idempotency key.
    // An unknown result must be investigated, never sent again automatically.
    return { status: "support_required", errorCode: "customerio_delivery_ambiguous" }
  }
  if (error instanceof CustomerIoHttpError) {
    // A non-2xx response does not prove the provider did not accept the send.
    // Without an idempotency key, both 4xx and 5xx outcomes require support.
    return { status: "support_required", errorCode: "customerio_http_unconfirmed" }
  }
  return { status: "support_required", errorCode: "receipt_delivery_unexpected" }
}

function normalizedProviderQueuedAt(value: string | number): string {
  const milliseconds =
    typeof value === "number" ? (value < 100_000_000_000 ? value * 1000 : value) : Date.parse(value)
  if (!Number.isFinite(milliseconds)) {
    throw new CustomerIoAmbiguousDeliveryError("Customer.io queued timestamp is invalid")
  }
  const date = new Date(milliseconds)
  if (Number.isNaN(date.getTime())) {
    throw new CustomerIoAmbiguousDeliveryError("Customer.io queued timestamp is invalid")
  }
  return date.toISOString()
}

const defaultDependencies: Dependencies = {
  messageId:
    process.env[PUBLIC_CONTRACT_DECLARATION_RECEIPT_MESSAGE_ID_ENV] ??
    DEFAULT_REQUIRED_NOTICE_TRIGGER,
  apiKeyPresent: Boolean(process.env.CUSTOMERIO_APP_API_KEY?.trim()),
  claim: claimPublicDeclarationReceiptDelivery,
  send: ({ email, messageId, receiptText }) =>
    sendCustomerIoTransactionalEmailWithReceipt(
      buildRequiredNoticeEmail({
        email,
        messageId,
        sender: process.env[REQUIRED_NOTICE_FROM_ENV] ?? DEFAULT_REQUIRED_NOTICE_SENDER,
        message: {
          subject: "Deine Erklärung zu deinem Chaarlie Vertrag",
          receipt_text: receiptText,
        },
      }),
      { timeoutMs: 10_000 },
    ),
  settle: settlePublicDeclarationReceiptDelivery,
}

/**
 * Queues required declaration confirmations through the existing transactional
 * channel. A provider queue acknowledgement is never treated as delivered.
 */
export async function dispatchPublicContractDeclarationReceipts(
  overrides: Partial<Dependencies> = {},
): Promise<PublicDeclarationReceiptDeliveryStats> {
  const dependencies = { ...defaultDependencies, ...overrides }
  const messageId = configuredMessageId(dependencies.messageId)
  if (!messageId || !dependencies.apiKeyPresent) {
    return { claimed: 0, queued: 0, retryable: 0, supportRequired: 0, blocked: true }
  }

  const rawClaims = await dependencies.claim()
  const claims = rawClaims.map((row) => {
    const claim = parseClaim(row)
    if (!claim) throw new Error("Malformed declaration receipt delivery claim")
    return claim
  })
  const stats = {
    claimed: claims.length,
    queued: 0,
    retryable: 0,
    supportRequired: 0,
    blocked: false,
  }
  for (const claim of claims) {
    let receipt: CustomerIoTransactionalDeliveryReceipt
    let queuedAt: string
    try {
      receipt = await dependencies.send({
        email: claim.receiptPayload.declaration.email,
        messageId,
        receiptText: publicDeclarationReceiptText(claim.receiptPayload),
      })
      queuedAt = normalizedProviderQueuedAt(receipt.queuedAt)
    } catch (error) {
      const outcome = errorOutcome(error)
      await dependencies.settle(claim, outcome)
      if (outcome.status === "retryable_error") stats.retryable++
      else stats.supportRequired++
      continue
    }
    // Do not catch settlement errors here: a successful provider call followed
    // by a failed DB update is uncertain and must not trigger a second settle.
    await dependencies.settle(claim, {
      status: "queued",
      deliveryId: receipt.deliveryId,
      queuedAt,
    })
    stats.queued++
  }
  return stats
}
